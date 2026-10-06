"""High-level RAG service for the medical evidence subsystem.

Provides document ingestion, retrieval, and knowledge base management.
Singleton service accessible throughout the application.
"""

from __future__ import annotations

import time
from typing import Any

from backend.knowledge.models import (
    KnowledgeDocument, DocumentChunk, RAGResult, KnowledgeBaseStatus,
)
from backend.knowledge.chunker import chunk_document
from backend.knowledge.embeddings import EmbeddingProvider
from backend.knowledge.vector_store import VectorStore
from backend.knowledge.retriever import retrieve_evidence
from backend.core.config import get_settings
from backend.core.logging_config import get_logger

logger = get_logger("rag_service")
settings = get_settings()

# ─── Singleton ──────────────────────────────────────────────────────

_service: RAGService | None = None


class RAGService:
    """RAG service managing knowledge base, embeddings, and retrieval."""

    def __init__(self):
        self._provider = EmbeddingProvider(max_features=2048)
        self._vector_store = VectorStore(self._provider)
        self._documents: dict[str, KnowledgeDocument] = {}
        self._version = "1.0.0"
        self._last_ingestion: str | None = None

    @property
    def enabled(self) -> bool:
        return settings.RAG_ENABLED

    @property
    def embedding_provider(self) -> EmbeddingProvider:
        return self._provider

    @property
    def vector_store(self) -> VectorStore:
        return self._vector_store

    def get_status(self) -> KnowledgeBaseStatus:
        """Get current knowledge base status."""
        return KnowledgeBaseStatus(
            enabled=self.enabled,
            version=self._version,
            document_count=len(self._documents),
            chunk_count=self._vector_store.count,
            embedding_model=self._provider.model_name,
            embedding_dimension=self._provider.dimension,
            last_ingestion=self._last_ingestion,
            rag_config={
                "top_k": settings.RAG_TOP_K,
                "min_score": settings.RAG_MIN_SCORE,
                "rerank_enabled": settings.RAG_RERANK_ENABLED,
                "chunk_size": settings.RAG_CHUNK_SIZE,
            },
        )

    def ingest_document(self, document: KnowledgeDocument) -> dict[str, Any]:
        """Ingest a single document into the knowledge base.

        Returns ingestion metadata.
        """
        start = time.monotonic()

        # Compute checksum
        document.compute_content_checksum()

        # Check for duplicate
        if document.document_id in self._documents:
            existing = self._documents[document.document_id]
            if existing.checksum == document.checksum:
                return {
                    "status": "unchanged",
                    "document_id": document.document_id,
                    "checksum": document.checksum,
                }

        # Chunk the document
        chunks = chunk_document(
            text=document.content,
            document_id=document.document_id,
            chunk_size=settings.RAG_CHUNK_SIZE,
            overlap=settings.RAG_CHUNK_OVERLAP,
        )

        # Add document metadata to each chunk
        for chunk in chunks:
            chunk.metadata.update({
                "title": document.title,
                "source": document.source,
                "source_type": document.source_type,
                "trust_level": document.trust_level,
                "document_checksum": document.checksum,
            })

        # Fit or refit the embedding provider with all documents
        all_texts = [doc.content for doc in self._documents.values()]
        all_texts.append(document.content)
        self._provider.fit(all_texts)

        # Generate embeddings for new chunks
        chunk_texts = [c.text for c in chunks]
        embeddings = self._provider.embed_texts(chunk_texts)

        # Remove old chunks for this document if re-ingesting
        self._vector_store.delete_by_document_id(document.document_id)

        # Add to vector store
        self._vector_store.add_chunks(chunks, embeddings)

        # Store document
        document.chunk_count = len(chunks)
        self._documents[document.document_id] = document

        self._version = f"1.0.{len(self._documents)}"
        self._last_ingestion = time.time()

        latency_ms = (time.monotonic() - start) * 1000

        logger.info("document_ingested",
                     document_id=document.document_id,
                     title=document.title,
                     chunks=len(chunks),
                     checksum=document.checksum[:16],
                     latency_ms=round(latency_ms, 2))

        return {
            "status": "ingested",
            "document_id": document.document_id,
            "title": document.title,
            "chunks": len(chunks),
            "checksum": document.checksum,
            "embedding_dimension": self._provider.dimension,
            "latency_ms": round(latency_ms, 2),
        }

    def ingest_documents(self, documents: list[KnowledgeDocument]) -> list[dict[str, Any]]:
        """Ingest multiple documents."""
        results = []
        for doc in documents:
            results.append(self.ingest_document(doc))
        return results

    def get_document(self, document_id: str) -> KnowledgeDocument | None:
        return self._documents.get(document_id)

    def list_documents(self) -> list[KnowledgeDocument]:
        return list(self._documents.values())

    def delete_document(self, document_id: str) -> bool:
        """Delete a document and its chunks."""
        if document_id not in self._documents:
            return False

        removed = self._vector_store.delete_by_document_id(document_id)
        del self._documents[document_id]

        logger.info("document_deleted",
                     document_id=document_id,
                     chunks_removed=removed)
        return True

    async def search(
        self,
        task: dict[str, Any],
        context: dict[str, Any] | None = None,
    ) -> RAGResult:
        """Search the knowledge base for evidence relevant to a clinical task."""
        return await retrieve_evidence(
            task=task,
            context=context,
            vector_store=self._vector_store,
            embedding_provider=self._provider,
        )

    def health(self) -> dict[str, Any]:
        """Health check for the RAG subsystem."""
        store_health = self._vector_store.health()
        return {
            "enabled": self.enabled,
            "status": store_health["status"],
            "document_count": len(self._documents),
            "chunk_count": store_health["chunk_count"],
            "embedding_model": store_health["embedding_model"],
            "version": self._version,
        }

    def get_evidence_by_chunk_ids(self, chunk_ids: list[str]) -> list[EvidenceItem]:
        """Reconstruct EvidenceItems from chunk IDs."""
        items = []
        for cid in chunk_ids:
            chunk = self._vector_store.get_chunk(cid)
            if chunk:
                items.append(EvidenceItem(
                    document_id=chunk.document_id,
                    chunk_id=chunk.chunk_id,
                    title=chunk.metadata.get("title", ""),
                    source=chunk.metadata.get("source", ""),
                    source_type=chunk.metadata.get("source_type", "other"),
                    trust_level=chunk.metadata.get("trust_level", "medium"),
                    page=chunk.page,
                    section=chunk.section,
                    text=chunk.text,
                    retrieval_score=1.0,
                    rerank_score=1.0,
                ))
        return items

    def search_with_evidence_ids(self, evidence_ids: list[str]) -> list[EvidenceItem]:
        """Find evidence items (using chunk IDs)."""
        return self.get_evidence_by_chunk_ids(evidence_ids)

    def load_directory(self, dir_path: str) -> list[dict[str, Any]]:
        """Load and ingest all markdown files in a directory."""
        import os
        from pathlib import Path
        from backend.knowledge.models import KnowledgeDocument
        
        results = []
        path = Path(dir_path)
        if not path.exists() or not path.is_dir():
            logger.warning("knowledge_dir_not_found", path=dir_path)
            return results
            
        for file_path in path.glob("*.md"):
            try:
                with open(file_path, "r", encoding="utf-8") as f:
                    content = f.read()
                
                source_type = "internal_reference"
                if "guideline" in str(file_path).lower():
                    source_type = "official_guideline"
                elif "protocol" in str(file_path).lower():
                    source_type = "hospital_protocol"
                    
                doc = KnowledgeDocument(
                    title=file_path.stem.replace("_", " ").title(),
                    source=file_path.name,
                    source_type=source_type,
                    content=content,
                    file_path=str(file_path),
                )
                res = self.ingest_document(doc)
                results.append(res)
            except Exception as e:
                logger.error("knowledge_file_load_failed", file=str(file_path), error=str(e))
                
        return results


def get_rag_service() -> RAGService:
    """Get or create the singleton RAG service."""
    global _service
    if _service is None:
        _service = RAGService()
    return _service
