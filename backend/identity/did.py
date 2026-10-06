"""DID generation and document resolution for did:key.

Implements ECDSA P-256 DID generation for local agent identity.
"""
from __future__ import annotations

import base58
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives import serialization

# multicodec prefix for p256-pub
# 0x1200 as varint is 0x80 0x24
P256_PUB_PREFIX = b"\x80\x24"

def generate_key_pair() -> tuple[ec.EllipticCurvePrivateKey, ec.EllipticCurvePublicKey]:
    """Generate a new ECDSA P-256 key pair."""
    private_key = ec.generate_private_key(ec.SECP256R1())
    public_key = private_key.public_key()
    return private_key, public_key

def public_key_to_did(public_key: ec.EllipticCurvePublicKey) -> str:
    """Convert an ECDSA P-256 public key to a did:key string."""
    compressed_bytes = public_key.public_bytes(
        encoding=serialization.Encoding.X962,
        format=serialization.PublicFormat.CompressedPoint
    )
    multicodec_bytes = P256_PUB_PREFIX + compressed_bytes
    encoded = base58.b58encode(multicodec_bytes).decode("ascii")
    return f"did:key:z{encoded}"

def private_key_to_pem(private_key: ec.EllipticCurvePrivateKey) -> str:
    """Serialize private key to PEM format."""
    return private_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption()
    ).decode("utf-8")

def pem_to_private_key(pem_data: str) -> ec.EllipticCurvePrivateKey:
    """Deserialize private key from PEM format."""
    return serialization.load_pem_private_key(
        pem_data.encode("utf-8"),
        password=None
    ) # type: ignore

def pem_to_public_key(pem_data: str) -> ec.EllipticCurvePublicKey:
    """Deserialize public key from PEM format."""
    return serialization.load_pem_public_key(
        pem_data.encode("utf-8")
    ) # type: ignore

def generate_did_document(did: str) -> dict:
    """Generate a valid DID document for a did:key."""
    key_id = f"{did}#{did.split(':')[-1]}"
    return {
        "@context": [
            "https://www.w3.org/ns/did/v1",
            "https://w3id.org/security/suites/jws-2020/v1"
        ],
        "id": did,
        "verificationMethod": [{
            "id": key_id,
            "type": "JsonWebKey2020",
            "controller": did,
            "publicKeyMultibase": did.split(":")[-1]
        }],
        "authentication": [key_id],
        "assertionMethod": [key_id],
        "capabilityInvocation": [key_id],
        "capabilityDelegation": [key_id]
    }
