import uuid
from typing import Annotated, Any
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel

from backend.core.database import get_db
from backend.core.deps import get_current_user, require_role
from backend.models.models import User, AgentIdentity, ZKPProofRecord
from backend.privacy.zkp.nonce import generate_nonce
from backend.privacy.zkp.service import ZKPService
from backend.privacy.zkp.verifier import ZKPVerifier
from backend.identity.authorization import authorize_agent

router = APIRouter(prefix="/api/zkp", tags=["ZKP Authorization"])

class IssueCredentialRequest(BaseModel):
    agent_did: str
    role: str
    organization: str
    capabilities: list[str]

class ChallengeRequest(BaseModel):
    policy_id: str
    agent_did: str
    request_id: str

class VerifyProofRequest(BaseModel):
    proof: str
    revealed_claims: dict[str, Any]
    nonce: str
    policy_id: str
    agent_did: str
    request_id: str
    required_attributes: list[str]

@router.post("/issue")
async def api_issue_bbs_credential(
    body: IssueCredentialRequest,
    user: Annotated[User, Depends(require_role("admin"))],
    db: Annotated[AsyncSession, Depends(get_db)]
):
    """Admin-only: Issue a new BBS credential for an agent."""
    try:
        result = await ZKPService.issue_bbs_credential(
            agent_did=body.agent_did,
            role=body.role,
            org=body.organization,
            capabilities=body.capabilities
        )
        # Update agent identity in DB if it exists
        query = select(AgentIdentity).where(AgentIdentity.did == body.agent_did)
        db_res = await db.execute(query)
        identity = db_res.scalar_one_or_none()
        if identity:
            identity.bbs_credential_signature = result["signature"]
            identity.bbs_credential_public_key = result["public_key"]
            await db.commit()
            
        return {"status": "success", "credential": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/challenge")
async def api_request_zkp_challenge(
    body: ChallengeRequest,
    user: Annotated[User, Depends(get_current_user)]
):
    """Generate a single-use nonce for ZKP verification."""
    nonce = generate_nonce(
        policy_id=body.policy_id,
        agent_did=body.agent_did,
        request_id=body.request_id
    )
    return {"nonce": nonce}

@router.post("/verify")
async def api_verify_proof(
    body: VerifyProofRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)]
):
    """Verify a ZKP proof and integrate with the full authorization flow."""
    # 1. First run standard capability checks on the required capabilities
    # Wait, the verifier will check the proof, then we check capability on the revealed claims.
    # The revealed claims must have 'role' and 'capabilities' if policy required it.
    
    is_verified, reason = await ZKPVerifier.verify_authorization_proof(
        db=db,
        proof=body.proof,
        revealed_claims_dict=body.revealed_claims,
        nonce=body.nonce,
        policy_id=body.policy_id,
        agent_did=body.agent_did,
        request_id=body.request_id,
        required_attributes=body.required_attributes
    )
    
    if not is_verified:
        raise HTTPException(status_code=403, detail=f"ZKP Verification Failed: {reason}")
        
    return {
        "status": "AUTHORIZED",
        "reason": reason,
        "disclosed_attributes": body.revealed_claims
    }
