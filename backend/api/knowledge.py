"""Knowledge management API endpoints."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException, UploadFile, File
from pydantic import BaseModel

from backend.knowledge.models import KnowledgeDocument
from backend.knowledge.service import get_rag_service
from backend.core.logging_config import get_logger

logger = get_logger("knowledge_api")
router = APIRouter(prefix="/api/knowledge", tags=["knowledge"])


# ─── Request/Response Models ────────────────────────────────────────

class DocumentUploadRequest(BaseModel):
    title: str
    content: str
    source: str = ""
    source_type: str = "other"
    trust_level: str = "medium"
    author: str = ""
    organization: str = ""


class SearchRequest(BaseModel):
    query: str
    top_k: int = 8


class DocumentResponse(BaseModel):
    document_id: str
    title: str
    source: str
    source_type: str
    trust_level: str
    chunk_count: int
    checksum: str
    ingested_at: str


class SearchResponse(BaseModel):
    query: str
    results: list[dict[str, Any]]
    total: int


class KnowledgeStatusResponse(BaseModel):
    enabled: bool
    version: str
    document_count: int
    chunk_count: int
    embedding_model: str
    embedding_dimension: int
    last_ingestion: str | None


# ─── Endpoints ──────────────────────────────────────────────────────

@router.get("/status", response_model=KnowledgeStatusResponse)
async def get_knowledge_status():
    """Get knowledge base status."""
    service = get_rag_service()
    status = service.get_status()
    return KnowledgeStatusResponse(**status.model_dump())


@router.get("/documents", response_model=list[DocumentResponse])
async def list_documents():
    """List all knowledge documents."""
    service = get_rag_service()
    docs = service.list_documents()
    return [
        DocumentResponse(
            document_id=d.document_id,
            title=d.title,
            source=d.source,
            source_type=d.source_type,
            trust_level=d.trust_level,
            chunk_count=d.chunk_count,
            checksum=d.checksum[:32],
            ingested_at=d.ingested_at,
        )
        for d in docs
    ]


@router.post("/documents", response_model=DocumentResponse, status_code=201)
async def upload_document(body: DocumentUploadRequest):
    """Upload and ingest a new knowledge document."""
    service = get_rag_service()

    doc = KnowledgeDocument(
        title=body.title,
        content=body.content,
        source=body.source,
        source_type=body.source_type,
        trust_level=body.trust_level,
        author=body.author,
        organization=body.organization,
    )

    result = service.ingest_document(doc)

    if result["status"] == "unchanged":
        return DocumentResponse(
            document_id=doc.document_id,
            title=doc.title,
            source=doc.source,
            source_type=doc.source_type,
            trust_level=doc.trust_level,
            chunk_count=doc.chunk_count,
            checksum=result["checksum"][:32],
            ingested_at=doc.ingested_at,
        )

    return DocumentResponse(
        document_id=doc.document_id,
        title=doc.title,
        source=doc.source,
        source_type=doc.source_type,
        trust_level=doc.trust_level,
        chunk_count=result.get("chunks", 0),
        checksum=result.get("checksum", "")[:32],
        ingested_at=doc.ingested_at,
    )


@router.get("/documents/{document_id}", response_model=DocumentResponse)
async def get_document(document_id: str):
    """Get a specific knowledge document."""
    service = get_rag_service()
    doc = service.get_document(document_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return DocumentResponse(
        document_id=doc.document_id,
        title=doc.title,
        source=doc.source,
        source_type=doc.source_type,
        trust_level=doc.trust_level,
        chunk_count=doc.chunk_count,
        checksum=doc.checksum[:32],
        ingested_at=doc.ingested_at,
    )


@router.delete("/documents/{document_id}")
async def delete_document(document_id: str):
    """Delete a knowledge document."""
    service = get_rag_service()
    deleted = service.delete_document(document_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Document not found")
    return {"status": "deleted", "document_id": document_id}


@router.post("/search", response_model=SearchResponse)
async def search_knowledge(body: SearchRequest):
    """Search the knowledge base."""
    service = get_rag_service()

    if not service.enabled:
        return SearchResponse(query=body.query, results=[], total=0)

    # Build a task-like structure for the retriever
    task = {
        "title": body.query,
        "description": body.query,
        "patient_context": {},
    }

    rag_result = await service.search(task)

    results = [
        {
            "evidence_id": e.evidence_id,
            "document_id": e.document_id,
            "title": e.title,
            "source": e.source,
            "source_type": e.source_type,
            "page": e.page,
            "section": e.section,
            "text": e.text[:500],
            "retrieval_score": round(e.retrieval_score, 4),
            "rerank_score": round(e.rerank_score, 4),
        }
        for e in rag_result.evidence_items
    ]

    return SearchResponse(
        query=body.query,
        results=results,
        total=len(results),
    )


@router.get("/health")
async def knowledge_health():
    """Health check for the knowledge subsystem."""
    service = get_rag_service()
    return service.health()
