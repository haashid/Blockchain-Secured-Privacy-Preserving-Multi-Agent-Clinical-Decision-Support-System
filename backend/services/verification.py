"""Verification service — 10-step verification algorithm."""

import json
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.logging_config import get_logger
from backend.crypto.hashing import compute_sha256
from backend.crypto.encryption import decrypt_json
from backend.models.models import DecisionProof, VerificationRecord, AuditEvent
from backend.storage.base import StorageProvider

logger = get_logger("verification")


async def verify_decision(
    proof_id: str,
    db: AsyncSession,
    storage: StorageProvider | None = None,
) -> dict:
    """
    Run the full 10-step verification algorithm:
    1. Load blockchain proof
    2. Validate transaction exists
    3. Verify transaction status
    4. Load off-chain payload
    5. Decrypt
    6. Validate payload schema
    7. Canonicalize
    8. SHA-256
    9. Compare with on-chain hash
    10. Return result + write audit event
    """
    failures = []
    checks = {}

    # Step 1: Load blockchain proof
    result = await db.execute(select(DecisionProof).where(DecisionProof.proof_id == proof_id))
    proof = result.scalar_one_or_none()
    if not proof:
        return {"verified": False, "proof_id": proof_id, "error": "Proof not found",
                "failures": ["Proof not found in database"]}

    # Step 2-3: Check transaction
    checks["transaction_exists"] = proof.fabric_tx_id is not None
    checks["transaction_committed"] = proof.fabric_ledger_status == "committed"
    if not checks["transaction_exists"]:
        failures.append("No blockchain transaction associated with this proof")
    if proof.fabric_ledger_status not in ("committed", "local"):
        failures.append(f"Transaction status is {proof.fabric_ledger_status}, expected committed")

    # Step 4-5: Load and decrypt off-chain payload
    computed_hash = None
    if storage and proof.storage_reference:
        try:
            encrypted_data = await storage.get_object(proof.storage_reference)
            decrypted_json = decrypt_json(encrypted_data)
            payload = json.loads(decrypted_json)
            checks["offchain_loaded"] = True

            # Step 6: Basic schema validation
            checks["schema_valid"] = isinstance(payload, dict) and "role" in payload

            # Step 7-8: Canonicalize + SHA-256
            computed_hash = compute_sha256(payload)
            checks["hash_computed"] = True

            # Step 9: Compare
            checks["hash_match"] = computed_hash == proof.content_hash
            if not checks["hash_match"]:
                failures.append("INTEGRITY FAILURE: stored output hash does not match blockchain hash")
        except FileNotFoundError:
            checks["offchain_loaded"] = False
            failures.append("Off-chain payload not found")
        except Exception as e:
            checks["offchain_loaded"] = False
            failures.append(f"Failed to load/decrypt off-chain payload: {str(e)}")
    else:
        checks["offchain_loaded"] = False
        checks["hash_match"] = computed_hash == proof.content_hash if computed_hash else False
        failures.append("No storage provider or storage reference")

    verified = len(failures) == 0

    # Step 10: Write audit event
    audit = AuditEvent(
        event_type="verification.completed",
        agent_id=proof.agent_id,
        organization=proof.organization,
        task_id=proof.task_id,
        proof_id=proof_id,
        transaction_id=proof.fabric_tx_id,
        status="verified" if verified else "failed",
        details={
            "checks": checks,
            "failures": failures,
            "blockchain_hash": proof.content_hash[:16] + "..." if proof.content_hash else None,
            "computed_hash": computed_hash[:16] + "..." if computed_hash else None,
        },
    )
    db.add(audit)

    # Save verification record
    verification = VerificationRecord(
        proof_id=proof_id,
        verified=verified,
        blockchain_hash=proof.content_hash,
        computed_hash=computed_hash,
        hash_algorithm="SHA-256",
        transaction_id=proof.fabric_tx_id,
        agent_id=proof.agent_id,
        verification_checks=checks,
        failures=failures,
    )
    db.add(verification)
    await db.flush()

    return {
        "verified": verified,
        "proof_id": proof_id,
        "blockchain_hash": proof.content_hash,
        "computed_hash": computed_hash,
        "hash_algorithm": "SHA-256",
        "transaction_id": proof.fabric_tx_id,
        "agent_id": proof.agent_id,
        "verified_at": datetime.now(timezone.utc).isoformat(),
        "verification_checks": checks,
        "failures": failures,
    }
