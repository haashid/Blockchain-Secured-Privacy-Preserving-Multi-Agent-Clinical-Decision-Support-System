"""In-memory vector store for the RAG pipeline.

Stores chunk embeddings with metadata. Supports similarity search,
add, delete, and count operations. Can be swapped for pgvector later.
"""

from __future__ import annotations

import time
from typing import Any

import numpy as np

from backend.knowledge.models import DocumentChunk
from backend.knowledge.embeddings import EmbeddingProvider, batch_cosine_similarity
from backend.core.logging_config import get_logger

logger = get_logger("vector_store")


class VectorStore:
    """In-memory vector store with cosine similarity search."""

    def __init__(self, embedding_provider: EmbeddingProvider):
        self._provider = embedding_provider
        self._chunks: list[DocumentChunk] = []
        self._embeddings: np.ndarray | None = None
        self._chunk_ids: list[str] = []
        self._version = "1.0.0"
        self._last_modified: float = time.time()

    @property
    def version(self) -> str:
        return self._version

    @property
    def count(self) -> int:
        return len(self._chunks)

    def add_chunks(self, chunks: list[DocumentChunk], embeddings: np.ndarray) -> None:
        """Add chunks and their embeddings to the store."""
        if not chunks:
            return

        new_embeddings = np.array(embeddings, dtype=np.float32)

        if self._embeddings is None:
            self._embeddings = new_embeddings
        else:
            self._embeddings = np.vstack([self._embeddings, new_embeddings])

        self._chunks.extend(chunks)
        self._chunk_ids.extend([c.chunk_id for c in chunks])
        self._last_modified = time.time()

        logger.info("vector_store_chunks_added",
                     count=len(chunks),
                     total=self.count,
                     dimension=embeddings.shape[1] if hasattr(embeddings, 'shape') else 0)

    def search(
        self,
        query_embedding: np.ndarray,
        top_k: int = 8,
        min_score: float = 0.0,
    ) -> list[tuple[DocumentChunk, float]]:
        """Search for the most similar chunks.

        Returns list of (chunk, score) tuples, sorted by descending score.
        """
        if self._embeddings is None or self._embeddings.shape[0] == 0:
            return []

        query = query_embedding.flatten().astype(np.float32)
        scores = batch_cosine_similarity(query, self._embeddings)

        # Filter by minimum score
        valid_mask = scores >= min_score
        valid_indices = np.where(valid_mask)[0]
        valid_scores = scores[valid_indices]

        # Sort by descending score
        sorted_order = np.argsort(valid_scores)[::-1]
        top_indices = valid_indices[sorted_order[:top_k]]

        results = []
        for idx in top_indices:
            results.append((self._chunks[idx], float(scores[idx])))

        return results

    def delete_by_document_id(self, document_id: str) -> int:
        """Remove all chunks for a given document. Returns count removed."""
        if self._embeddings is None:
            return 0

        keep_mask = np.array([c.document_id != document_id for c in self._chunks])
        removed_count = int(np.sum(~keep_mask))

        if removed_count > 0:
            self._chunks = [c for c in self._chunks if c.document_id != document_id]
            self._chunk_ids = [cid for cid, keep in zip(self._chunk_ids, keep_mask) if keep]
            self._embeddings = self._embeddings[keep_mask] if keep_mask.any() else None
            self._last_modified = time.time()

        return removed_count

    def get_chunks_by_document(self, document_id: str) -> list[DocumentChunk]:
        """Get all chunks for a document."""
        return [c for c in self._chunks if c.document_id == document_id]

    def health(self) -> dict[str, Any]:
        """Return health status."""
        return {
            "status": "healthy",
            "chunk_count": self.count,
            "embedding_dimension": self._provider.dimension,
            "embedding_model": self._provider.model_name,
            "version": self._version,
        }

    def get_chunk(self, chunk_id: str) -> DocumentChunk | None:
        """Get a specific chunk by its ID."""
        try:
            idx = self._chunk_ids.index(chunk_id)
            return self._chunks[idx]
        except ValueError:
            return None
