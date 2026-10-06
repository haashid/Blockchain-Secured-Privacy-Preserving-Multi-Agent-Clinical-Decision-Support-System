"""Text chunking for the RAG pipeline.

Splits documents into overlapping chunks while preserving
page and section metadata where possible.
"""

from __future__ import annotations

import re
from typing import Any

from backend.knowledge.models import DocumentChunk


def chunk_text(
    text: str,
    document_id: str,
    chunk_size: int = 512,
    overlap: int = 64,
    metadata: dict[str, Any] | None = None,
) -> list[DocumentChunk]:
    """Split text into overlapping chunks.

    Uses paragraph boundaries when possible, falls back to sentence
    boundaries, then character splitting.
    """
    if not text or not text.strip():
        return []

    metadata = metadata or {}
    chunks: list[DocumentChunk] = []

    # Split by paragraphs first
    paragraphs = re.split(r'\n\s*\n', text)

    current_text = ""
    chunk_index = 0

    for para in paragraphs:
        para = para.strip()
        if not para:
            continue

        # Detect section headers
        section = ""
        if re.match(r'^#{1,4}\s+', para) or re.match(r'^[A-Z][A-Z\s]{3,}$', para):
            section = para[:100]

        # If adding this paragraph exceeds chunk_size, save current and start new
        if current_text and len(current_text) + len(para) + 2 > chunk_size:
            chunks.append(DocumentChunk(
                document_id=document_id,
                text=current_text.strip(),
                chunk_index=chunk_index,
                section=section or metadata.get("section", ""),
                metadata={**metadata, "section": section or metadata.get("section", "")},
            ))
            chunk_index += 1

            # Overlap: keep the tail of current_text
            if overlap > 0 and len(current_text) > overlap:
                current_text = current_text[-overlap:] + "\n\n" + para
            else:
                current_text = para
        else:
            current_text = current_text + "\n\n" + para if current_text else para

    # Don't forget the last chunk
    if current_text.strip():
        chunks.append(DocumentChunk(
            document_id=document_id,
            text=current_text.strip(),
            chunk_index=chunk_index,
            section=metadata.get("section", ""),
            metadata=metadata,
        ))

    return chunks


def chunk_document(
    text: str,
    document_id: str,
    chunk_size: int = 512,
    overlap: int = 64,
) -> list[DocumentChunk]:
    """Chunk a full document, detecting sections along the way."""
    return chunk_text(
        text=text,
        document_id=document_id,
        chunk_size=chunk_size,
        overlap=overlap,
    )
