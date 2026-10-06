"""Document loader for the RAG pipeline.

Supports loading documents from files: .txt, .md, .pdf, .docx.
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Any

from backend.knowledge.models import KnowledgeDocument
from backend.core.logging_config import get_logger

logger = get_logger("doc_loader")


def load_text_file(file_path: str, **kwargs: Any) -> KnowledgeDocument:
    """Load a plain text file."""
    path = Path(file_path)
    content = path.read_text(encoding="utf-8", errors="replace")

    return KnowledgeDocument(
        title=kwargs.get("title", path.stem.replace("_", " ").replace("-", " ").title()),
        source=str(path),
        source_type=kwargs.get("source_type", "other"),
        trust_level=kwargs.get("trust_level", "medium"),
        author=kwargs.get("author", ""),
        organization=kwargs.get("organization", ""),
        content=content,
        file_path=str(path),
        mime_type="text/plain",
        metadata=kwargs.get("metadata", {}),
    )


def load_markdown_file(file_path: str, **kwargs: Any) -> KnowledgeDocument:
    """Load a markdown file."""
    doc = load_text_file(file_path, **kwargs)
    doc.mime_type = "text/markdown"
    return doc


def load_pdf_file(file_path: str, **kwargs: Any) -> KnowledgeDocument:
    """Load a PDF file. Falls back to text extraction if PyPDF2 is not available."""
    path = Path(file_path)

    try:
        import PyPDF2
        reader = PyPDF2.PdfReader(str(path))
        pages = []
        for i, page in enumerate(reader.pages):
            text = page.extract_text()
            if text:
                pages.append(f"<!-- Page {i+1} -->\n{text.strip()}")
        content = "\n\n".join(pages)
    except ImportError:
        # Fallback: try to read as text
        logger.warning("pypdf2_not_available_reading_as_text", path=str(path))
        content = path.read_text(encoding="utf-8", errors="replace")
    except Exception as e:
        logger.warning("pdf_parse_error", path=str(path), error=str(e))
        content = path.read_text(encoding="utf-8", errors="replace")

    return KnowledgeDocument(
        title=kwargs.get("title", path.stem.replace("_", " ").replace("-", " ").title()),
        source=str(path),
        source_type=kwargs.get("source_type", "peer_reviewed"),
        trust_level=kwargs.get("trust_level", "medium"),
        author=kwargs.get("author", ""),
        organization=kwargs.get("organization", ""),
        content=content,
        file_path=str(path),
        mime_type="application/pdf",
        metadata=kwargs.get("metadata", {}),
    )


def load_docx_file(file_path: str, **kwargs: Any) -> KnowledgeDocument:
    """Load a DOCX file."""
    path = Path(file_path)

    try:
        from docx import Document as DocxDocument
        doc = DocxDocument(str(path))
        paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]
        content = "\n\n".join(paragraphs)
    except ImportError:
        logger.warning("python_docx_not_available", path=str(path))
        content = path.read_text(encoding="utf-8", errors="replace")
    except Exception as e:
        logger.warning("docx_parse_error", path=str(path), error=str(e))
        content = path.read_text(encoding="utf-8", errors="replace")

    return KnowledgeDocument(
        title=kwargs.get("title", path.stem.replace("_", " ").replace("-", " ").title()),
        source=str(path),
        source_type=kwargs.get("source_type", "internal_reference"),
        trust_level=kwargs.get("trust_level", "medium"),
        author=kwargs.get("author", ""),
        organization=kwargs.get("organization", ""),
        content=content,
        file_path=str(path),
        mime_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        metadata=kwargs.get("metadata", {}),
    )


LOADERS = {
    ".txt": load_text_file,
    ".md": load_markdown_file,
    ".markdown": load_markdown_file,
    ".pdf": load_pdf_file,
    ".docx": load_docx_file,
}


def load_document(file_path: str, **kwargs: Any) -> KnowledgeDocument:
    """Load a document from a file path, auto-detecting format."""
    path = Path(file_path)
    suffix = path.suffix.lower()

    loader = LOADERS.get(suffix)
    if loader is None:
        raise ValueError(f"Unsupported file format: {suffix}")

    logger.info("loading_document", path=str(path), format=suffix)
    return loader(str(path), **kwargs)


def load_directory(directory: str, **kwargs: Any) -> list[KnowledgeDocument]:
    """Load all supported documents from a directory."""
    docs = []
    dir_path = Path(directory)

    if not dir_path.exists():
        logger.warning("directory_not_found", path=directory)
        return docs

    for file_path in sorted(dir_path.rglob("*")):
        if file_path.is_file() and file_path.suffix.lower() in LOADERS:
            try:
                doc = load_document(str(file_path), **kwargs)
                docs.append(doc)
            except Exception as e:
                logger.warning("failed_to_load", path=str(file_path), error=str(e))

    return docs
