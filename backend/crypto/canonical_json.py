"""Deterministic JSON serialization for hash computation."""

import json
from typing import Any


def canonical_json(data: Any) -> str:
    """Produce a deterministic JSON string from any data structure.

    Rules:
    - Sort object keys alphabetically
    - No whitespace
    - Stable UTF-8 encoding
    - Deterministic separators
    - None/NaN handling: null
    """
    return json.dumps(
        data,
        sort_keys=True,
        separators=(",", ":"),
        ensure_ascii=True,
        default=_json_default,
    )


def _json_default(obj: Any) -> Any:
    """Handle types that aren't natively JSON serializable."""
    from datetime import datetime, timezone
    if isinstance(obj, datetime):
        return obj.isoformat()
    if isinstance(obj, set):
        return sorted(list(obj))
    raise TypeError(f"Object of type {type(obj).__name__} is not JSON serializable")
