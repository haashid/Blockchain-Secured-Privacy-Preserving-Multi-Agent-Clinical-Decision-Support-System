#!/usr/bin/env python3
"""Ingest demo medical documents into the knowledge base.

Usage:
    PYTHONPATH=. python scripts/knowledge/ingest_demo_documents.py
"""

import os
import sys
import time

# Ensure project root is in path
project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
if project_root not in sys.path:
    sys.path.insert(0, project_root)

from backend.knowledge.loader import load_directory
from backend.knowledge.service import get_rag_service
from backend.core.config import get_settings

settings = get_settings()


def main():
    print("=" * 60)
    print("Medical Knowledge Base — Document Ingestion")
    print("=" * 60)

    rag_service = get_rag_service()
    print(f"\nRAG Enabled: {settings.RAG_ENABLED}")
    print(f"Knowledge Directory: {settings.RAG_KNOWLEDGE_DIR}")

    # Resolve knowledge directory
    knowledge_dir = os.path.join(project_root, settings.RAG_KNOWLEDGE_DIR)
    if not os.path.exists(knowledge_dir):
        print(f"\nKnowledge directory not found: {knowledge_dir}")
        print("Creating directory...")
        os.makedirs(knowledge_dir, exist_ok=True)

    # Load documents
    print(f"\nLoading documents from {knowledge_dir}...")
    documents = load_directory(
        knowledge_dir,
        source_type="official_guideline",
        trust_level="high",
        organization="Demo Medical Knowledge Base",
    )

    if not documents:
        print("No documents found. Please add .txt, .md, or .pdf files to the knowledge directory.")
        return

    print(f"Found {len(documents)} documents")

    # Ingest
    start = time.time()
    results = rag_service.ingest_documents(documents)
    elapsed = time.time() - start

    # Report
    print("\n" + "=" * 60)
    print("Ingestion Results")
    print("=" * 60)

    for r in results:
        status = r.get("status", "unknown")
        title = r.get("title", "Unknown")
        chunks = r.get("chunks", 0)
        checksum = r.get("checksum", "")[:16]
        print(f"  [{status}] {title} — {chunks} chunks (checksum: {checksum}...)")

    # Status
    status = rag_service.get_status()
    print(f"\nKnowledge Base Status:")
    print(f"  Version: {status.version}")
    print(f"  Documents: {status.document_count}")
    print(f"  Chunks: {status.chunk_count}")
    print(f"  Embedding model: {status.embedding_model}")
    print(f"  Embedding dimension: {status.embedding_dimension}")
    print(f"  Total ingestion time: {elapsed:.2f}s")

    print("\nIngestion complete.")


if __name__ == "__main__":
    main()
