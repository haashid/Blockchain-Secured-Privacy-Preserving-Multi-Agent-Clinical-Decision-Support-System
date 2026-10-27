import os
import uuid
import hashlib
from datetime import datetime, timedelta
from typing import Dict, Optional

# In-memory nonce store for prototype (use Redis/DB in production)
_NONCE_STORE: Dict[str, dict] = {}

def generate_nonce(policy_id: str, agent_did: str, request_id: str, expires_in_seconds: int = 300) -> str:
    """Generate a securely random single-use nonce for ZKP verification."""
    raw_nonce = os.urandom(32).hex()
    
    expires_at = datetime.utcnow() + timedelta(seconds=expires_in_seconds)
    
    _NONCE_STORE[raw_nonce] = {
        "policy_id": policy_id,
        "agent_did": agent_did,
        "request_id": request_id,
        "expires_at": expires_at,
        "consumed": False
    }
    return raw_nonce

def consume_nonce(nonce: str, policy_id: str, agent_did: str, request_id: str) -> bool:
    """Validate and consume a nonce. Returns True if valid and consumed."""
    record = _NONCE_STORE.get(nonce)
    if not record:
        return False
        
    if record["consumed"]:
        return False
        
    if datetime.utcnow() > record["expires_at"]:
        return False
        
    if record["policy_id"] != policy_id or record["agent_did"] != agent_did or record["request_id"] != request_id:
        return False
        
    # Consume it
    record["consumed"] = True
    return True

def hash_nonce(nonce: str) -> str:
    return hashlib.sha256(nonce.encode()).hexdigest()
