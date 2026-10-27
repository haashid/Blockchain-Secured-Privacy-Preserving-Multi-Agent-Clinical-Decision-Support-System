from datetime import datetime
from backend.privacy.zkp.client import ZKPClient
import base64

# Canonical claim order matching Node.js
CLAIM_KEYS = [
    "credential_id",
    "agent_did",
    "organization",
    "role",
    "capabilities",
    "issued_at",
    "expiration"
]

class ZKPService:
    """Service to handle ZKP issuance and orchestration"""
    
    @staticmethod
    async def issue_bbs_credential(agent_did: str, role: str, org: str, capabilities: list, expiration_days: int = 365) -> dict:
        """Issue a BBS credential explicitly for an agent."""
        issued_at = datetime.utcnow().isoformat()
        import uuid
        import json
        from datetime import timedelta
        
        expires_at = (datetime.utcnow() + timedelta(days=expiration_days)).isoformat()
        cred_id = f"urn:uuid:{uuid.uuid4()}"
        
        claims = {
            "credential_id": cred_id,
            "agent_did": agent_did,
            "organization": org,
            "role": role,
            "capabilities": ",".join(capabilities),
            "issued_at": issued_at,
            "expiration": expires_at
        }
        
        result = await ZKPClient.issue_credential(claims)
        
        return {
            "claims": claims,
            "signature": result["signature"],
            "public_key": result["publicKey"]
        }

    @staticmethod
    def map_policy_to_indices(required_attributes: list[str]) -> list[int]:
        """Map attribute names to their canonical indices."""
        indices = []
        for attr in required_attributes:
            try:
                indices.append(CLAIM_KEYS.index(attr))
            except ValueError:
                pass # Unrecognized claim
        # Always reveal expiration
        if CLAIM_KEYS.index("expiration") not in indices:
            indices.append(CLAIM_KEYS.index("expiration"))
        return sorted(indices)

    @staticmethod
    def get_revealed_claims(all_claims: dict, indices: list[int]) -> list[str]:
        """Extract the exact claim values that will be revealed in order."""
        revealed = []
        for i in indices:
            key = CLAIM_KEYS[i]
            revealed.append(str(all_claims.get(key, "")))
        return revealed
