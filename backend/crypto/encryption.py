"""AES-256-GCM encryption for off-chain storage."""

import hashlib
import os

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from backend.core.config import get_settings


def _get_key() -> bytes:
    """Derive a 32-byte AES key from the configured encryption key."""
    settings = get_settings()
    raw = settings.ENCRYPTION_KEY.encode("utf-8")
    # If it's already a hex string of 32 bytes, decode it
    if len(settings.ENCRYPTION_KEY) == 64:
        return bytes.fromhex(settings.ENCRYPTION_KEY)
    # Otherwise hash it to get a consistent 32-byte key
    return hashlib.sha256(raw).digest()


def encrypt(plaintext: bytes) -> bytes:
    """Encrypt plaintext using AES-256-GCM. Returns nonce + ciphertext."""
    key = _get_key()
    aesgcm = AESGCM(key)
    nonce = os.urandom(12)  # 96-bit nonce for GCM
    ciphertext = aesgcm.encrypt(nonce, plaintext, None)
    return nonce + ciphertext


def decrypt(data: bytes) -> bytes:
    """Decrypt nonce + ciphertext using AES-256-GCM."""
    key = _get_key()
    aesgcm = AESGCM(key)
    nonce = data[:12]
    ciphertext = data[12:]
    return aesgcm.decrypt(nonce, ciphertext, None)


def encrypt_json(json_str: str) -> bytes:
    """Encrypt a JSON string, returning raw encrypted bytes."""
    return encrypt(json_str.encode("utf-8"))


def decrypt_json(data: bytes) -> str:
    """Decrypt bytes to a JSON string."""
    return decrypt(data).decode("utf-8")
