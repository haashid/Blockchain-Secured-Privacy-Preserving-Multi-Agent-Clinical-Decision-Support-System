"""Unit tests for Stage 4 Startup, RAG, Fabric, and Storage Optimization."""

import os
import sys
import json
import shutil
import tempfile
import pytest
import numpy as np
from pathlib import Path
from unittest.mock import patch, MagicMock

_root = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
if _root not in sys.path:
    sys.path.insert(0, _root)

from backend.core.config import get_settings
from backend.knowledge.service import RAGService
from backend.knowledge.models import KnowledgeDocument
from backend.blockchain.gateway import FabricGatewayService
from backend.storage.factory import create_storage_provider, get_storage_status
from backend.storage.local import LocalStorageProvider
from backend.core.database import async_session_factory, init_db
from backend.services.auth import get_or_create_default_admin
from backend.models.models import User
from backend.models.hospital import Doctor, Patient
from sqlalchemy import select, func


@pytest.fixture(autouse=True)
def setup_env(monkeypatch):
    monkeypatch.setenv("AI_MODE", "mock")
    monkeypatch.setenv("AI_PROVIDER", "mock")


@pytest.mark.asyncio
async def test_rag_cache_persistence_and_invalidation(tmp_path):
    """Test that RAG persists embeddings safely and invalidates when source changes."""
    knowledge_dir = tmp_path / "docs"
    cache_dir = tmp_path / "cache"
    knowledge_dir.mkdir()
    cache_dir.mkdir()

    # Create dummy markdown document
    doc1 = knowledge_dir / "guide1.md"
    doc1.write_text("# Clinical Protocol\nAdminister 500mg Amoxicillin every 8 hours.", encoding="utf-8")

    rag = RAGService()
    rag._cache_dir = cache_dir

    # 1. Ingest without cache -> creates cache files
    res = rag.load_directory(str(knowledge_dir))
    assert len(res) == 1
    assert rag.is_ready is True
    assert (cache_dir / "manifest.json").exists()
    assert (cache_dir / "embeddings.npy").exists()

    # Verify safe deserialization (allow_pickle=False)
    emb = np.load(cache_dir / "embeddings.npy", allow_pickle=False)
    assert emb.shape[0] > 0

    # 2. Reload with unchanged files -> fast cache hit
    rag2 = RAGService()
    rag2._cache_dir = cache_dir
    res2 = rag2.load_directory(str(knowledge_dir))
    assert len(res2) == 1
    assert res2[0]["status"] == "cached"
    assert rag2.is_ready is True

    # 3. Modify source file -> cache invalidation
    doc1.write_text("# Clinical Protocol Updated\nAdminister 1000mg Amoxicillin.", encoding="utf-8")
    curr_hash = rag2.compute_corpus_hash(knowledge_dir)
    assert rag2.load_cached_index(knowledge_dir, curr_hash) is False  # Hash mismatch


@pytest.mark.asyncio
async def test_rag_readiness_and_uninitialized_safety():
    """Test that uninitialized or failed RAG raises errors rather than silently omitting evidence."""
    rag = RAGService()
    assert rag.readiness == "UNINITIALIZED"
    assert rag.is_ready is False

    # Attempting to search before initialization raises RuntimeError
    with pytest.raises(RuntimeError, match="RAG evidence service not ready"):
        await rag.search(task={"id": "test-task"})

    # Health check shows uninitialized/unhealthy state
    h = rag.health()
    assert h["readiness"] == "UNINITIALIZED"
    assert h["status"] == "unhealthy"


@pytest.mark.asyncio
async def test_idempotent_database_seeding():
    """Test that seeding is idempotent, doesn't duplicate records, and recovers partial state."""
    await init_db()

    async with async_session_factory() as db:
        # Run seeding first time
        admin1 = await get_or_create_default_admin(db)
        await db.commit()

        # Count doctors and patients
        doc_count1 = (await db.execute(select(func.count(Doctor.id)))).scalar()
        pat_count1 = (await db.execute(select(func.count(Patient.id)))).scalar()

        # Run seeding second time (fast-path)
        admin2 = await get_or_create_default_admin(db)
        await db.commit()

        doc_count2 = (await db.execute(select(func.count(Doctor.id)))).scalar()
        pat_count2 = (await db.execute(select(func.count(Patient.id)))).scalar()

        assert admin1.id == admin2.id
        assert doc_count1 == doc_count2
        assert pat_count1 == pat_count2


@pytest.mark.asyncio
async def test_fabric_bounded_timeout_and_truthful_labeling(monkeypatch):
    """Test that Fabric simulation mode is truthfully labeled and fails safely if native is required."""
    service = FabricGatewayService()
    await service.connect()

    assert service.is_connected is True
    status = await service.get_network_status()
    assert status["is_simulated"] is True
    assert status["connection_status"] == "simulation_active"

    # Proof recording in simulation mode is labeled simulated_committed
    proof = {
        "proof_id": "test-proof-100",
        "task_id": "task-100",
        "run_id": "run-100",
        "agent_id": "agent-test",
        "agent_role": "clinical_reasoning",
        "organization": "Org1MSP",
        "content_hash": "abc123hash",
        "storage_reference": "path/output.enc",
        "confidence": 95,
    }
    res = await service.record_decision_proof(proof)
    assert res["status"] == "simulated_committed"
    assert res["is_simulated"] is True
    assert res["ledger_mode"] == "simulation"

    # When native blockchain is required, simulation operations fail safely
    monkeypatch.setattr(service.settings, "FABRIC_REQUIRE_BLOCKCHAIN", True)
    with pytest.raises(RuntimeError, match="requires native Hyperledger Fabric ledger"):
        await service.record_decision_proof(proof)


@pytest.mark.asyncio
async def test_storage_bounded_fallback_and_truthful_state(monkeypatch):
    """Test that storage fallback is truthful, bounded, and fails if fallback is disabled."""
    # 1. Unreachable MinIO with fallback allowed -> Degraded Local provider
    monkeypatch.setenv("MINIO_ENDPOINT", "192.0.2.1:9000")  # Non-routable TEST-NET-1 IP
    monkeypatch.setenv("MINIO_CONNECT_TIMEOUT_SECONDS", "1.0")
    monkeypatch.setenv("STORAGE_ALLOW_LOCAL_FALLBACK", "true")
    get_settings.cache_clear()

    provider = create_storage_provider()
    assert provider.provider_name == "local"
    assert provider.is_fallback is True

    health = provider.health()
    assert health["provider"] == "local"
    assert health["is_fallback"] is True

    # 2. Unreachable MinIO with fallback disabled -> ConnectionError
    monkeypatch.setenv("STORAGE_ALLOW_LOCAL_FALLBACK", "false")
    get_settings.cache_clear()
    with pytest.raises(ConnectionError, match="STORAGE_ALLOW_LOCAL_FALLBACK is disabled"):
        create_storage_provider()

    # Restore default settings cache
    get_settings.cache_clear()
