"""Data models for the RAG knowledge subsystem."""

from __future__ import annotations

import hashlib
import uuid
from datetime import datetime, timezone
from typing import Any, Literal

from pydantic import BaseModel, Field


def _gen_id() -> str:
    return uuid.uuid4().hex[:12]


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def compute_checksum(content: str | bytes) -> str:
    """SHA-256 checksum of document content."""
    if isinstance(content, str):
        content = content.encode("utf-8")
    return hashlib.sha256(content).hexdigest()


# ─── Document ───────────────────────────────────────────────────────

class KnowledgeDocument(BaseModel):
    """A medical knowledge document."""
    document_id: str = Field(default_factory=_gen_id)
    title: str
    source: str = ""
    source_type: Literal[
        "official_guideline", "hospital_protocol", "peer_reviewed",
        "textbook", "internal_reference", "knowledge_based", "other"
    ] = "other"
    trust_level: Literal["high", "medium", "low"] = "medium"
    author: str = ""
    publication_date: str = ""
    organization: str = ""
    version: str = ""
    content: str = ""  # Full text content
    checksum: str = ""
    file_path: str = ""
    mime_type: str = ""
    ingested_at: str = Field(default_factory=_now_iso)
    chunk_count: int = 0
    metadata: dict[str, Any] = {}

    def compute_content_checksum(self) -> str:
        self.checksum = compute_checksum(self.content)
        return self.checksum


# ─── Chunk ──────────────────────────────────────────────────────────

class DocumentChunk(BaseModel):
    """A chunk of text from a knowledge document."""
    chunk_id: str = Field(default_factory=_gen_id)
    document_id: str
    text: str
    page: int = 0
    section: str = ""
    chunk_index: int = 0
    metadata: dict[str, Any] = {}


# ─── Evidence Item ──────────────────────────────────────────────────

class EvidenceItem(BaseModel):
    """A retrieved evidence item with scoring."""
    evidence_id: str = Field(default_factory=lambda: f"EV-{_gen_id()[:8]}")
    document_id: str
    chunk_id: str
    title: str
    source: str
    source_type: str = "other"
    trust_level: str = "medium"
    page: int = 0
    section: str = ""
    text: str
    retrieval_score: float = 0.0
    rerank_score: float = 0.0
    selection_reason: str = ""


# ─── Claim Evidence Link ───────────────────────────────────────────

class ClaimEvidenceLink(BaseModel):
    """Maps a clinical claim to its supporting evidence."""
    claim: str
    evidence_ids: list[str] = []
    claim_type: Literal["supported", "unsupported", "insufficient_evidence"] = "unsupported"


# ─── RAG Result ─────────────────────────────────────────────────────

class RAGResult(BaseModel):
    """Result from the RAG retrieval pipeline."""
    query: str
    knowledge_base_version: str = ""
    embedding_model: str = ""
    retrieval_count: int = 0
    selected_count: int = 0
    evidence_items: list[EvidenceItem] = []
    insufficient_evidence: bool = False
    latency_ms: float = 0.0
    trace: dict[str, Any] = {}


# ─── Knowledge Base Status ─────────────────────────────────────────

class KnowledgeBaseStatus(BaseModel):
    """Status of the knowledge base."""
    enabled: bool = True
    version: str = "1.0.0"
    document_count: int = 0
    chunk_count: int = 0
    embedding_model: str = "tfidf"
    embedding_dimension: int = 0
    last_ingestion: str | None = None
    rag_config: dict[str, Any] = {}
