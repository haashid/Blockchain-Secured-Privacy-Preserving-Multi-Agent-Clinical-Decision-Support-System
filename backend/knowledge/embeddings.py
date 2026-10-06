"""Embedding provider for the RAG pipeline.

Uses sentence-transformers for local, dense embeddings.
No external API required.
"""

from __future__ import annotations

import numpy as np

from backend.core.logging_config import get_logger

logger = get_logger("embeddings")


class EmbeddingProvider:
    """Sentence-transformers based embedding provider.
    
    Produces dense embeddings locally.
    """

    def __init__(self, model_name: str = "all-MiniLM-L6-v2", max_features: int = 384):
        self._model_name = model_name
        self.max_features = max_features
        self._model = None
        self._fitted = False
        self._dimension = max_features

    @property
    def dimension(self) -> int:
        return self._dimension

    @property
    def model_name(self) -> str:
        return self._model_name

    def fit(self, documents: list[str]) -> None:
        """Initialize the sentence transformer model."""
        if not self._fitted:
            from sentence_transformers import SentenceTransformer
            self._model = SentenceTransformer(self._model_name)
            # Find the actual dimension
            self._dimension = self._model.get_sentence_embedding_dimension()
            self._fitted = True
            logger.info("embedding_provider_initialized",
                         model=self.model_name,
                         dimension=self._dimension)

    def embed_texts(self, texts: list[str]) -> np.ndarray:
        """Embed a list of texts. Returns (n, dimension) array."""
        if not self._fitted or self._model is None:
            self.fit([])
            
        if not texts:
            return np.zeros((0, self._dimension))

        embeddings = self._model.encode(texts, show_progress_bar=False, convert_to_numpy=True)
        return embeddings.astype(np.float32)

    def embed_query(self, query: str) -> np.ndarray:
        """Embed a single query string. Returns (1, dimension) array."""
        return self.embed_texts([query])


def cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    """Compute cosine similarity between two vectors."""
    dot = np.dot(a, b)
    norm_a = np.linalg.norm(a)
    norm_b = np.linalg.norm(b)
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return float(dot / (norm_a * norm_b))


def batch_cosine_similarity(query: np.ndarray, matrix: np.ndarray) -> np.ndarray:
    """Compute cosine similarity between a query vector and a matrix of vectors.

    Returns array of scores, one per row in matrix.
    """
    if matrix.shape[0] == 0:
        return np.array([])

    query_norm = np.linalg.norm(query)
    if query_norm == 0:
        return np.zeros(matrix.shape[0])

    norms = np.linalg.norm(matrix, axis=1)
    norms[norms == 0] = 1.0  # Avoid division by zero

    return np.dot(matrix, query.flatten()) / (norms * query_norm)
