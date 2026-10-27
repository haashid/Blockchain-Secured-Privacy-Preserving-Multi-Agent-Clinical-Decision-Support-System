from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime
from backend.models.models import ZKPProofRecord
from backend.privacy.zkp.client import ZKPClient
from backend.privacy.zkp.nonce import consume_nonce, hash_nonce
from backend.privacy.zkp.service import ZKPService
import os
import inspect

ZKP_MODE = os.environ.get("ZKP_MODE", "real")

class ZKPVerifier:
    @staticmethod
    async def verify_authorization_proof(
        db: AsyncSession,
        proof: str,
        revealed_claims_dict: dict,
        nonce: str,
        policy_id: str,
        agent_did: str,
        request_id: str,
        required_attributes: list[str]
    ) -> tuple[bool, str]:
        """
        Verify a BBS proof and write an audit record to the database.
        Returns (is_verified, reason_or_status).
        """
        import uuid
        record = ZKPProofRecord(
            proof_id=f"proof_{os.urandom(8).hex()}",
            agent_did=agent_did,
            policy_id=policy_id,
            authorization_request_id=request_id,
            nonce_hash=hash_nonce(nonce),
            status="PENDING",
            disclosed_attribute_names=required_attributes,
            proof_size=len(proof) if proof else 0
        )
        add_res = db.add(record)
        if inspect.isawaitable(add_res):
            await add_res
        await db.commit()
        await db.refresh(record)
        
        try:
            if ZKP_MODE == "simulated":
                record.status = "SIMULATED"
                record.verified_at = datetime.utcnow()
                await db.commit()
                return True, "SIMULATED"
            
            # 1. Nonce check
            if not consume_nonce(nonce, policy_id, agent_did, request_id):
                record.status = "FAILED"
                record.failure_reason = "WRONG_NONCE"
                await db.commit()
                return False, "WRONG_NONCE"
                
            # 2. Re-derive expected indices based on required_attributes
            indices = ZKPService.map_policy_to_indices(required_attributes)
            revealed_claims = ZKPService.get_revealed_claims(revealed_claims_dict, indices)
            
            # 3. Check expiration manually
            from dateutil.parser import parse
            if "expiration" in revealed_claims_dict:
                exp = parse(revealed_claims_dict["expiration"])
                if datetime.utcnow().replace(tzinfo=None) > exp.replace(tzinfo=None):
                    record.status = "FAILED"
                    record.failure_reason = "EXPIRED_CREDENTIAL"
                    await db.commit()
                    return False, "EXPIRED_CREDENTIAL"

            # 4. Cryptographic check
            result = await ZKPClient.verify_proof(proof, revealed_claims, nonce)
            
            if result.get("verified"):
                record.status = "VERIFIED"
                record.verified_at = datetime.utcnow()
                await db.commit()
                return True, "VERIFIED"
            else:
                record.status = "FAILED"
                record.failure_reason = result.get("error", "INVALID_PROOF")
                await db.commit()
                return False, record.failure_reason
                
        except Exception as e:
            record.status = "FAILED"
            record.failure_reason = "ZKP_SERVICE_UNAVAILABLE"
            await db.commit()
            return False, "ZKP_SERVICE_UNAVAILABLE"
