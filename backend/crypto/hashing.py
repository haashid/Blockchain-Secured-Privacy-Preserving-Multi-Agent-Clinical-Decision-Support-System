"""SHA-256 hashing utilities."""

import hashlib
import hmac
from typing import Any

from backend.crypto.canonical_json import canonical_json


def compute_sha256(data: Any) -> str:
    """Compute SHA-256 hash of data after canonical JSON serialization."""
    canonical = canonical_json(data)
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def compute_sha256_bytes(data: bytes) -> str:
    """Compute SHA-256 hash of raw bytes."""
    return hashlib.sha256(data).hexdigest()


def verify_hash(data: Any, expected_hash: str) -> bool:
    """Verify that data produces the expected SHA-256 hash.

    Uses hmac.compare_digest for constant-time comparison to prevent timing attacks.
    """
    computed = compute_sha256(data)
    return hmac.compare_digest(computed, expected_hash)
