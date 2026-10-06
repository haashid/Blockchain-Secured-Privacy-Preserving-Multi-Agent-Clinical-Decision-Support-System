import pytest
import numpy as np
from backend.knowledge.models import KnowledgeDocument, EvidenceItem, RAGResult
from backend.knowledge.embeddings import EmbeddingProvider, cosine_similarity
from backend.knowledge.vector_store import VectorStore
from backend.knowledge.retriever import build_search_query, _rerank_evidence

def test_cosine_similarity():
    a = np.array([1.0, 0.0])
    b = np.array([1.0, 0.0])
    assert cosine_similarity(a, b) == 1.0

    c = np.array([0.0, 1.0])
    assert cosine_similarity(a, c) == 0.0

def test_embedding_provider():
    # Use a mock dimension for tests to avoid downloading real model
    provider = EmbeddingProvider()
    provider._dimension = 4
    provider._fitted = True

    # Mock embed_texts to return random vectors
    original_embed = provider.embed_texts
    def mock_embed(texts):
        return np.ones((len(texts), 4))
    
    provider.embed_texts = mock_embed
    res = provider.embed_query("test query")
    assert res.shape == (1, 4)

def test_vector_store():
    provider = EmbeddingProvider()
    provider._dimension = 4
    provider._fitted = True
    
    store = VectorStore(provider)
    from backend.knowledge.models import DocumentChunk
    
    chunk = DocumentChunk(document_id="doc1", text="some text", metadata={"title": "Test"})
    embeddings = np.array([[1.0, 0.0, 0.0, 0.0]])
    store.add_chunks([chunk], embeddings)
    
    assert store.count == 1
    
    query = np.array([[1.0, 0.0, 0.0, 0.0]])
    results = store.search(query, top_k=1, min_score=0.5)
    assert len(results) == 1
    assert results[0][0].document_id == "doc1"

def test_build_search_query():
    task = {
        "title": "Heart attack",
        "description": "Patient has chest pain",
        "patient_context": {"symptoms": ["chest pain", "shortness of breath"]},
        "previous_outputs": {"clinical_reasoning": {"possible_conditions": [{"condition": "Myocardial Infarction"}]}}
    }
    query = build_search_query(task)
    assert "Heart attack" in query
    assert "chest pain" in query
    assert "Myocardial Infarction" in query

def test_rerank_evidence():
    items = [
        EvidenceItem(document_id="d1", chunk_id="c1", title="A", source="A", text="chest pain treatment", trust_level="high", source_type="official_guideline", retrieval_score=0.8),
        EvidenceItem(document_id="d2", chunk_id="c2", title="B", source="B", text="random unrelated text", trust_level="low", source_type="other", retrieval_score=0.9),
    ]
    query = "chest pain"
    reranked = _rerank_evidence(items, query)
    
    assert reranked[0].document_id == "d1"
    assert reranked[0].rerank_score > reranked[1].rerank_score
