"""JWT-based Verifiable Credentials (W3C standard) issuance and verification."""

from __future__ import annotations

import time
import uuid
from typing import Any
from jose import jwt

def issue_credential(
    issuer_did: str,
    issuer_private_key_pem: str,
    subject_did: str,
    capabilities: list[str],
    role: str
) -> str:
    """Issue a W3C Verifiable Credential in JWT format for an agent."""
    jti = f"urn:uuid:{uuid.uuid4()}"
    now = int(time.time())
    
    payload = {
        "iss": issuer_did,
        "sub": subject_did,
        "jti": jti,
        "nbf": now,
        "iat": now,
        "vc": {
            "@context": [
                "https://www.w3.org/2018/credentials/v1",
                "https://example.com/clinical-agent-credentials/v1"
            ],
            "type": ["VerifiableCredential", "ClinicalAgentCredential"],
            "credentialSubject": {
                "id": subject_did,
                "role": role,
                "capabilities": capabilities
            }
        }
    }
    
    token = jwt.encode(payload, issuer_private_key_pem, algorithm="ES256")
    return token

def verify_credential(
    credential_jwt: str,
    issuer_public_key_pem: str,
    expected_subject_did: str | None = None
) -> dict[str, Any]:
    """Verify a JWT verifiable credential.
    
    Returns the parsed credential Subject dictionary if valid.
    """
    payload = jwt.decode(
        credential_jwt, 
        issuer_public_key_pem, 
        algorithms=["ES256"],
        options={"require_exp": False}
    )
    
    if expected_subject_did and payload.get("sub") != expected_subject_did:
        raise ValueError(f"Credential subject {payload.get('sub')} does not match expected {expected_subject_did}")
        
    vc = payload.get("vc", {})
    return vc.get("credentialSubject", {})
