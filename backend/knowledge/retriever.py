"""Retrieval layer for the RAG pipeline.

Handles query construction from clinical context, similarity search,
and evidence selection with minimum score filtering.
"""

from __future__ import annotations

import time
from typing import Any

from backend.knowledge.models import EvidenceItem, RAGResult
from backend.knowledge.vector_store import VectorStore
from backend.knowledge.embeddings import EmbeddingProvider
from backend.core.config import get_settings
from backend.core.logging_config import get_logger

logger = get_logger("retriever")
settings = get_settings()


def build_search_query(task: dict[str, Any], context: dict[str, Any] | None = None) -> str:
    """Construct a search query from clinical task data.

    Focuses on the clinical question rather than the full patient record.
    """
    parts = []

    # Primary clinical focus
    title = task.get("title", "")
    if title:
        parts.append(title)

    description = task.get("description", "")
    if description:
        parts.append(description)

    # Key clinical terms from patient context
    ctx = task.get("patient_context") or {}
    if ctx:
        # Extract clinically relevant keywords
        for key in ("diagnoses", "symptoms", "chief_complaint", "condition"):
            val = ctx.get(key)
            if val:
                if isinstance(val, list):
                    parts.extend(str(v) for v in val[:5])
                else:
                    parts.append(str(val)[:200])

    # Previous outputs may contain relevant differential
    prev = task.get("previous_outputs") or {}
    cr = prev.get("clinical_reasoning", {})
    if cr:
        conditions = cr.get("possible_conditions", [])
        for c in conditions[:3]:
            cond_name = c.get("condition", "")
            if cond_name:
                parts.append(cond_name)

    query = " ".join(parts).strip()
    if not query:
        query = "clinical case review"

    return query


async def retrieve_evidence(
    task: dict[str, Any],
    context: dict[str, Any] | None,
    vector_store: VectorStore,
    embedding_provider: EmbeddingProvider,
) -> RAGResult:
    """Retrieve evidence from the knowledge base for a clinical task.

    Returns RAGResult with ranked evidence items.
    """
    start = time.monotonic()

    if not settings.RAG_ENABLED:
        return RAGResult(
            query="",
            insufficient_evidence=True,
            trace={"reason": "RAG_DISABLED"},
        )

    # Check if vector store has any data
    if vector_store.count == 0:
        query = build_search_query(task, context)
        return RAGResult(
            query=query,
            insufficient_evidence=True,
            trace={"reason": "EMPTY_KNOWLEDGE_BASE"},
        )

    # Build search query
    query = build_search_query(task, context)
    logger.info("rag_search_started", query=query[:100], top_k=settings.RAG_TOP_K)

    # Embed query
    query_embedding = embedding_provider.embed_query(query)

    # Vector search
    results = vector_store.search(
        query_embedding,
        top_k=settings.RAG_TOP_K * 2,  # Retrieve extra for reranking
        min_score=settings.RAG_MIN_SCORE * 0.5,  # Lower threshold for initial retrieval
    )

    retrieval_count = len(results)

    # Build evidence items
    evidence_items: list[EvidenceItem] = []
    for chunk, score in results:
        # Find the document metadata from chunk metadata
        chunk_meta = chunk.metadata or {}
        evidence_items.append(EvidenceItem(
            document_id=chunk.document_id,
            chunk_id=chunk.chunk_id,
            title=chunk_meta.get("title", "Unknown Document"),
            source=chunk_meta.get("source", ""),
            source_type=chunk_meta.get("source_type", "other"),
            trust_level=chunk_meta.get("trust_level", "medium"),
            page=chunk.page,
            section=chunk.section,
            text=chunk.text[:1000],  # Truncate for prompt size
            retrieval_score=score,
            rerank_score=score,  # Will be updated by reranker
            selection_reason="initial_retrieval",
        ))

    # Rerank if enabled
    if settings.RAG_RERANK_ENABLED and evidence_items:
        evidence_items = _rerank_evidence(evidence_items, query)

    # Filter by minimum score
    evidence_items = [
        e for e in evidence_items
        if e.rerank_score >= settings.RAG_MIN_SCORE
    ]

    # Take top K
    evidence_items = evidence_items[:settings.RAG_TOP_K]

    selected_count = len(evidence_items)
    insufficient = selected_count == 0

    latency_ms = (time.monotonic() - start) * 1000

    result = RAGResult(
        query=query,
        knowledge_base_version=vector_store.version,
        embedding_model=embedding_provider.model_name,
        retrieval_count=retrieval_count,
        selected_count=selected_count,
        evidence_items=evidence_items,
        insufficient_evidence=insufficient,
        latency_ms=round(latency_ms, 2),
        trace={
            "query_length": len(query),
            "initial_candidates": retrieval_count,
            "after_rerank": selected_count,
            "min_score": settings.RAG_MIN_SCORE,
        },
    )

    logger.info("rag_search_completed",
                query_length=len(query),
                initial_candidates=retrieval_count,
                selected=selected_count,
                insufficient_evidence=insufficient,
                latency_ms=round(latency_ms, 2))

    return result


def _rerank_evidence(items: list[EvidenceItem], query: str) -> list[EvidenceItem]:
    """Rerank evidence items by combining retrieval score with text relevance.

    Uses a deterministic scoring approach:
    - Query term overlap bonus
    - Source trust bonus
    - Recency bonus (not applicable for static docs)
    """
    query_lower = query.lower()
    query_terms = set(query_lower.split())

    for item in items:
        text_lower = item.text.lower()

        # Term overlap: fraction of query terms found in text
        if query_terms:
            term_hits = sum(1 for t in query_terms if t in text_lower)
            term_score = term_hits / len(query_terms)
        else:
            term_score = 0.0

        # Trust bonus
        trust_bonus = {"high": 0.1, "medium": 0.0, "low": -0.05}.get(item.trust_level, 0.0)

        # Source type bonus
        source_bonus = {
            "official_guideline": 0.15,
            "peer_reviewed": 0.10,
            "hospital_protocol": 0.08,
            "textbook": 0.05,
        }.get(item.source_type, 0.0)

        # Combined rerank score
        item.rerank_score = min(1.0, item.retrieval_score * 0.6 + term_score * 0.2 + trust_bonus + source_bonus)
        item.selection_reason = f"retrieval={item.retrieval_score:.2f} term_overlap={term_score:.2f} trust={item.trust_level}"

    # Sort by rerank score
    items.sort(key=lambda x: x.rerank_score, reverse=True)
    return items
