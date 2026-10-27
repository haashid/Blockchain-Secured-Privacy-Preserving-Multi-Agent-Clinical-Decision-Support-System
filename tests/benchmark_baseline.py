"""Stage 0: Performance Baseline Benchmark.

Measures actual empirical baseline performance metrics for:
1. Backend Lifespan & Startup Components
2. AI Specialist Multi-Agent Execution & Workflow
3. Database Query Latencies
4. Cryptographic Hashing & Merkle Root Calculations
"""

import asyncio
import os
import sys
import time
import uuid

# Ensure backend on sys.path
_here = os.path.dirname(os.path.abspath(__file__))
_root = os.path.normpath(os.path.join(_here, '..'))
if _root not in sys.path:
    sys.path.insert(0, _root)

if "DATABASE_URL" not in os.environ or "postgres:5432" in os.environ.get("DATABASE_URL", ""):
    _sqlite_path = os.path.join(_root, 'multichain.db').replace('\\', '/')
    os.environ["DATABASE_URL"] = f"sqlite+aiosqlite:///{_sqlite_path}"

from backend.core.database import async_session_factory, init_db
from backend.core.config import get_settings
from backend.models.hospital import Patient, Doctor, ClinicalReview
from backend.models.models import Task, User
from backend.services.auth import get_or_create_default_admin
from backend.services.agent import seed_agents
from backend.services.clinical_review import (
    start_clinical_review,
    get_clinical_review,
    list_all_reviews,
)
from backend.crypto.hashing import compute_sha256, verify_hash
from sqlalchemy import select

settings = get_settings()


async def measure_startup():
    print("\n" + "=" * 60, flush=True)
    print("STAGE 0 BENCHMARK: BACKEND STARTUP & INITIALIZATION", flush=True)
    print("=" * 60, flush=True)
    
    # 1. DB Init
    t0 = time.perf_counter()
    await init_db()
    t_db_init = (time.perf_counter() - t0) * 1000
    print(f"  [MEASURED] init_db() latency: {t_db_init:.2f} ms")

    # 2. Seeding
    t0 = time.perf_counter()
    async with async_session_factory() as db:
        await get_or_create_default_admin(db)
        await seed_agents(db)
        await db.commit()
    t_seeding = (time.perf_counter() - t0) * 1000
    print(f"  [MEASURED] Seeding (admin, doctor, patient, agents): {t_seeding:.2f} ms", flush=True)

    # 3. RAG Knowledge Directory Ingestion
    t0 = time.perf_counter()
    from backend.knowledge.service import get_rag_service
    rag = get_rag_service()
    doc_count = 0
    if settings.RAG_ENABLED:
        rag.load_directory(settings.RAG_KNOWLEDGE_DIR)
        doc_count = len(rag.list_documents())
    t_rag = (time.perf_counter() - t0) * 1000
    print(f"  [MEASURED] RAG knowledge load ({doc_count} docs): {t_rag:.2f} ms", flush=True)

    # 4. Fabric Connection Attempt
    t0 = time.perf_counter()
    from backend.blockchain.gateway import get_fabric_service
    fabric = get_fabric_service()
    try:
        await fabric.connect()
    except Exception:
        pass
    t_fabric = (time.perf_counter() - t0) * 1000
    print(f"  [MEASURED] Fabric connect latency (simulation={fabric._simulation_mode}): {t_fabric:.2f} ms", flush=True)

    total_startup = t_db_init + t_seeding + t_rag + t_fabric
    print(f"  [MEASURED] Total Lifespan Startup Time: {total_startup:.2f} ms ({total_startup / 1000:.2f} s)", flush=True)
    return {
        "db_init_ms": t_db_init,
        "seeding_ms": t_seeding,
        "rag_ms": t_rag,
        "fabric_ms": t_fabric,
        "total_startup_ms": total_startup,
    }


async def measure_database_queries():
    print("\n" + "=" * 60, flush=True)
    print("STAGE 0 BENCHMARK: DATABASE QUERIES & N+1 RETRIEVALS", flush=True)
    print("=" * 60, flush=True)

    async with async_session_factory() as db:
        # Measure list_all_reviews (includes the N+1 loop)
        t0 = time.perf_counter()
        reviews = await list_all_reviews(db, limit=25)
        t_list_reviews = (time.perf_counter() - t0) * 1000
        print(f"  [MEASURED] list_all_reviews(limit=25): {t_list_reviews:.2f} ms ({len(reviews)} items returned)", flush=True)

        # Measure get_clinical_review for first review if exists
        t_single_review = 0.0
        if reviews:
            review_id = uuid.UUID(reviews[0]["id"])
            t0 = time.perf_counter()
            single = await get_clinical_review(db, review_id)
            t_single_review = (time.perf_counter() - t0) * 1000
            print(f"  [MEASURED] get_clinical_review(full details): {t_single_review:.2f} ms", flush=True)

    return {
        "list_all_reviews_ms": t_list_reviews,
        "get_clinical_review_ms": t_single_review,
    }


async def measure_cryptography():
    print("\n" + "=" * 60, flush=True)
    print("STAGE 0 BENCHMARK: CRYPTOGRAPHIC HASHING & MERKLE TREE", flush=True)
    print("=" * 60, flush=True)

    sample_output = {
        "agent_id": "agent-clinical-reasoning-01",
        "role": "clinical_reasoning",
        "confidence": 0.88,
        "possible_conditions": [
            {"condition": "Essential Hypertension", "probability": 0.88},
            {"condition": "Secondary Renovascular Hypertension", "probability": 0.12},
        ],
        "findings": ["BP 154/96", "Occipital morning headache", "Normal creatinine"],
    }

    # Measure 1,000 SHA-256 canonical hashing iterations
    t0 = time.perf_counter()
    for _ in range(1000):
        h = compute_sha256(sample_output)
    t_hash_1000 = (time.perf_counter() - t0) * 1000
    print(f"  [MEASURED] 1,000 SHA-256 canonical hashes: {t_hash_1000:.2f} ms ({t_hash_1000/1000:.4f} ms/hash)")

    # Measure Merkle Tree Root (10 hashes)
    import hashlib
    def _compute_merkle(leaf_hashes: list[str]) -> str:
        current = list(leaf_hashes)
        while len(current) > 1:
            if len(current) % 2 == 1:
                current.append(current[-1])
            nxt = []
            for i in range(0, len(current), 2):
                combined = (current[i] + current[i + 1]).encode("utf-8")
                nxt.append(hashlib.sha256(combined).hexdigest())
            current = nxt
        return current[0] if current else ""

    hashes = [compute_sha256({"agent": i, "data": sample_output}) for i in range(10)]
    t0 = time.perf_counter()
    for _ in range(1000):
        m_root = _compute_merkle(hashes)
    t_merkle_1000 = (time.perf_counter() - t0) * 1000
    print(f"  [MEASURED] 1,000 Merkle tree root computations (10 leaves): {t_merkle_1000:.2f} ms")

    return {
        "hash_1000_ms": t_hash_1000,
        "merkle_1000_ms": t_merkle_1000,
    }


async def measure_multi_agent_orchestration():
    print("\n" + "=" * 60)
    print("STAGE 0 BENCHMARK: MULTI-AGENT ORCHESTRATION & LLM LATENCY")
    print("=" * 60)
    print(f"  Current AI_MODE: {settings.AI_MODE}")
    print(f"  Current AI_PROVIDER: {settings.AI_PROVIDER}")
    print(f"  Current GROQ_MODEL: {settings.GROQ_MODEL}")
    print(f"  Current MAX_CONCURRENT_AGENTS: {settings.MAX_CONCURRENT_AGENTS}")

    async with async_session_factory() as db:
        # Fetch or create doctor
        dr_res = await db.execute(select(Doctor).limit(1))
        doctor = dr_res.scalar_one_or_none()
        dr_user_res = await db.execute(select(User).where(User.role == "doctor").limit(1))
        dr_user = dr_user_res.scalar_one_or_none()

        # Fetch or create patient
        pat_res = await db.execute(select(Patient).limit(1))
        patient = pat_res.scalar_one_or_none()

        if not doctor or not dr_user or not patient:
            print("  [ERROR] Doctor or Patient not found in DB for review start.")
            return {}

        t0 = time.perf_counter()
        review_info = await start_clinical_review(
            db=db,
            patient_id=patient.id,
            doctor_user_id=dr_user.id,
            purpose="Performance Baseline Evaluation Case",
            chief_complaint="Baseline assessment for clinical response latency",
            symptoms=["Fatigue", "Mild dyspnea"],
            vitals={"blood_pressure": "142/88", "heart_rate": 74},
        )
        await db.commit()
        t_start_cr = (time.perf_counter() - t0) * 1000
        print(f"  [MEASURED] start_clinical_review() dispatch: {t_start_cr:.2f} ms")

    return {
        "start_review_dispatch_ms": t_start_cr,
        "review_id": review_info.get("clinical_review_id"),
    }


async def main():
    print("=================================================================")
    print("MEDAGENTOS: STAGE 0 PERFORMANCE BASELINE AUDIT")
    print("=================================================================")
    
    r_startup = await measure_startup()
    r_db = await measure_database_queries()
    r_crypto = await measure_cryptography()
    r_agent = await measure_multi_agent_orchestration()

    print("\n" + "=" * 60)
    print("STAGE 0 BASELINE AUDIT COMPLETE")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(main())
