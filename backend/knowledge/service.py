"""High-level RAG service for the medical evidence subsystem.

Provides document ingestion, retrieval, and knowledge base management.
Singleton service accessible throughout the application.
"""

from __future__ import annotations

import asyncio
import hashlib
import json
import time
from pathlib import Path
from typing import Any

import numpy as np

from backend.knowledge.models import (
    KnowledgeDocument, DocumentChunk, RAGResult, KnowledgeBaseStatus, EvidenceItem,
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
        self._readiness: str = "UNINITIALIZED"
        self._last_error: str | None = None
        self._corpus_hash: str | None = None
        self._cache_dir = Path(settings.RAG_CACHE_DIR)

    @property
    def enabled(self) -> bool:
        return settings.RAG_ENABLED

    @property
    def readiness(self) -> str:
        return self._readiness

    @property
    def is_ready(self) -> bool:
        return self._readiness == "READY"

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
                "readiness": self._readiness,
                "corpus_hash": self._corpus_hash,
                "cached": self._corpus_hash is not None,
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

    def compute_corpus_hash(self, dir_path: Path) -> str:
        """Compute SHA256 checksum across all source files in the directory."""
        if not dir_path.exists() or not dir_path.is_dir():
            return ""
        hasher = hashlib.sha256()
        for fpath in sorted(dir_path.glob("*.md")):
            hasher.update(fpath.name.encode("utf-8"))
            try:
                hasher.update(fpath.read_bytes())
            except Exception:
                pass
        return hasher.hexdigest()

    def load_cached_index(self, dir_path: Path, current_hash: str) -> bool:
        """Attempt to restore documents and vector index from safe persisted files."""
        if not settings.RAG_PERSIST_EMBEDDINGS:
            return False

        manifest_file = self._cache_dir / "manifest.json"
        embeddings_file = self._cache_dir / "embeddings.npy"

        if not manifest_file.exists() or not embeddings_file.exists():
            return False

        try:
            with open(manifest_file, "r", encoding="utf-8") as f:
                manifest = json.load(f)

            # Validate cache integrity against inputs and configuration
            if manifest.get("corpus_hash") != current_hash:
                logger.info("rag_cache_invalidated", reason="corpus_hash_mismatch")
                return False
            if manifest.get("embedding_model") != self._provider.model_name:
                logger.info("rag_cache_invalidated", reason="model_mismatch")
                return False
            if manifest.get("chunk_size") != settings.RAG_CHUNK_SIZE:
                logger.info("rag_cache_invalidated", reason="chunk_size_mismatch")
                return False
            if manifest.get("chunk_overlap") != settings.RAG_CHUNK_OVERLAP:
                logger.info("rag_cache_invalidated", reason="chunk_overlap_mismatch")
                return False

            # Safe deserialization: load embeddings strictly without pickle
            embeddings = np.load(embeddings_file, allow_pickle=False)

            # Restore documents
            self._documents.clear()
            for doc_dict in manifest.get("documents", []):
                doc = KnowledgeDocument(
                    document_id=doc_dict["document_id"],
                    title=doc_dict["title"],
                    source=doc_dict["source"],
                    source_type=doc_dict.get("source_type", "other"),
                    trust_level=doc_dict.get("trust_level", "medium"),
                    content=doc_dict["content"],
                    checksum=doc_dict.get("checksum", ""),
                    chunk_count=doc_dict.get("chunk_count", 0),
                    file_path=doc_dict.get("file_path"),
                )
                self._documents[doc.document_id] = doc

            # Restore chunks
            chunks = []
            for c_dict in manifest.get("chunks", []):
                chunk = DocumentChunk(
                    chunk_id=c_dict["chunk_id"],
                    document_id=c_dict["document_id"],
                    text=c_dict["text"],
                    page=c_dict.get("page"),
                    section=c_dict.get("section"),
                    metadata=c_dict.get("metadata", {}),
                )
                chunks.append(chunk)

            # Initialize vector store with loaded embeddings
            self._vector_store._chunks = chunks
            self._vector_store._chunk_ids = [c.chunk_id for c in chunks]
            self._vector_store._embeddings = embeddings.astype(np.float32)
            self._vector_store._last_modified = time.time()

            # Align provider dimensions
            self._provider._dimension = embeddings.shape[1] if embeddings.ndim == 2 else self._provider.dimension
            self._corpus_hash = current_hash
            self._readiness = "READY"
            self._version = manifest.get("version", f"1.0.{len(self._documents)}")

            logger.info(
                "rag_cache_loaded",
                documents=len(self._documents),
                chunks=len(chunks),
                dimension=self._provider._dimension,
                corpus_hash=current_hash[:16],
            )
            return True
        except Exception as e:
            logger.warning("rag_cache_load_failed", error=str(e))
            return False

    def save_cached_index(self, dir_path: Path, current_hash: str) -> bool:
        """Persist current documents, chunks, and embeddings safely."""
        if not settings.RAG_PERSIST_EMBEDDINGS:
            return False

        try:
            self._cache_dir.mkdir(parents=True, exist_ok=True)
            manifest_file = self._cache_dir / "manifest.json"
            embeddings_file = self._cache_dir / "embeddings.npy"

            # 1. Save embeddings array using safe npy format
            if self._vector_store._embeddings is not None:
                np.save(embeddings_file, self._vector_store._embeddings)

            # 2. Serialize documents and chunks to JSON manifest
            docs_data = [
                {
                    "document_id": doc.document_id,
                    "title": doc.title,
                    "source": doc.source,
                    "source_type": doc.source_type,
                    "trust_level": doc.trust_level,
                    "content": doc.content,
                    "checksum": doc.checksum,
                    "chunk_count": doc.chunk_count,
                    "file_path": doc.file_path,
                }
                for doc in self._documents.values()
            ]

            chunks_data = [
                {
                    "chunk_id": chunk.chunk_id,
                    "document_id": chunk.document_id,
                    "text": chunk.text,
                    "page": chunk.page,
                    "section": chunk.section,
                    "metadata": chunk.metadata,
                }
                for chunk in self._vector_store._chunks
            ]

            manifest = {
                "format_version": "1.0",
                "corpus_hash": current_hash,
                "embedding_model": self._provider.model_name,
                "dimension": self._provider.dimension,
                "chunk_size": settings.RAG_CHUNK_SIZE,
                "chunk_overlap": settings.RAG_CHUNK_OVERLAP,
                "version": self._version,
                "created_at": time.time(),
                "documents": docs_data,
                "chunks": chunks_data,
            }

            with open(manifest_file, "w", encoding="utf-8") as f:
                json.dump(manifest, f, indent=2)

            self._corpus_hash = current_hash
            logger.info("rag_cache_saved", path=str(self._cache_dir), corpus_hash=current_hash[:16])
            return True
        except Exception as e:
            logger.error("rag_cache_save_failed", error=str(e))
            return False

    async def search(
        self,
        task: dict[str, Any],
        context: dict[str, Any] | None = None,
    ) -> RAGResult:
        """Search the knowledge base for evidence relevant to a clinical task.

        Provides a bounded wait if initialization is in progress.
        Fails safely if required evidence services are degraded or uninitialized.
        """
        # Bounded wait if currently initializing
        if self._readiness == "INITIALIZING":
            for _ in range(50):
                if self._readiness == "READY":
                    break
                await asyncio.sleep(0.1)

        if not self.enabled:
            from backend.knowledge.models import RAGResult
            return RAGResult(task_id=task.get("id", ""), evidence=[])

        if self._readiness != "READY":
            err_msg = f"RAG evidence service not ready (status: {self._readiness})"
            if self._last_error:
                err_msg += f": {self._last_error}"
            raise RuntimeError(err_msg)

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
            "readiness": self._readiness,
            "status": "healthy" if self._readiness == "READY" else ("degraded" if self._readiness == "INITIALIZING" else "unhealthy"),
            "document_count": len(self._documents),
            "chunk_count": store_health["chunk_count"],
            "embedding_model": store_health["embedding_model"],
            "cached": self._corpus_hash is not None,
            "corpus_hash": self._corpus_hash,
            "last_error": self._last_error,
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
        """Load and ingest all markdown files in a directory with cache support."""
        path = Path(dir_path)
        if not path.exists() or not path.is_dir():
            logger.warning("knowledge_dir_not_found", path=dir_path)
            self._readiness = "READY"
            return []

        current_hash = self.compute_corpus_hash(path)

        # Fast path: load persisted index if corpus and config match
        if self.load_cached_index(path, current_hash):
            return [
                {
                    "status": "cached",
                    "document_id": doc.document_id,
                    "title": doc.title,
                    "chunks": doc.chunk_count,
                    "checksum": doc.checksum,
                }
                for doc in self._documents.values()
            ]

        # Slow path: ingest documents from scratch
        self._readiness = "INITIALIZING"
        results = []
        try:
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

            # Persist the freshly generated index for instant subsequent startups
            self.save_cached_index(path, current_hash)
            self._readiness = "READY"
            self._last_error = None
        except Exception as e:
            self._readiness = "FAILED"
            self._last_error = str(e)
            logger.error("rag_initialization_failed", error=str(e))

        return results


def get_rag_service() -> RAGService:
    """Get or create the singleton RAG service."""
    global _service
    if _service is None:
        _service = RAGService()
    return _service
