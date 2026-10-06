"""Patient consent service.

Reads and writes persisted patient consent policies that gate agent access to
clinical records. Falls back to an implicit hospital-network policy when no
explicit record exists (matching `backend.identity.consent` semantics).
"""

from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.models.models import ConsentRecord

# The full set of clinical agent roles that may participate in a review.
ALL_AGENT_ROLES = [
    "supervisor",
    "clinical_reasoning",
    "history",
    "laboratory",
    "medication",
    "risk",
    "evidence",
    "critic",
    "verifier",
    "synthesizer",
]

DEFAULT_ALLOWED_ORGS = ["Org1MSP"]


def default_policy(patient_id: uuid.UUID | str) -> dict[str, Any]:
    """Implicit hospital-network policy used when the patient has no explicit record."""
    return {
        "patient_id": str(patient_id),
        "allowed_organizations": list(DEFAULT_ALLOWED_ORGS),
        "allowed_roles": list(ALL_AGENT_ROLES),
        "emergency_breakglass": True,
        "explicit": False,
        "notes": None,
        "updated_at": None,
    }


async def get_consent_policy(db: AsyncSession, patient_id: uuid.UUID) -> dict[str, Any]:
    """Return the effective consent policy for a patient (explicit or implicit)."""
    result = await db.execute(
        select(ConsentRecord).where(ConsentRecord.patient_id == patient_id)
    )
    record = result.scalar_one_or_none()
    if not record:
        return default_policy(patient_id)

    return {
        "patient_id": str(record.patient_id),
        "allowed_organizations": list(record.allowed_organizations or []),
        "allowed_roles": list(record.allowed_roles or []),
        "emergency_breakglass": bool(record.emergency_breakglass),
        "explicit": True,
        "notes": record.notes,
        "updated_at": record.updated_at.isoformat() if record.updated_at else None,
    }


async def set_consent_policy(
    db: AsyncSession,
    patient_id: uuid.UUID,
    allowed_roles: list[str] | None = None,
    allowed_organizations: list[str] | None = None,
    emergency_breakglass: bool | None = None,
    notes: str | None = None,
) -> dict[str, Any]:
    """Create or update the explicit consent policy for a patient."""
    result = await db.execute(
        select(ConsentRecord).where(ConsentRecord.patient_id == patient_id)
    )
    record = result.scalar_one_or_none()

    if not record:
        record = ConsentRecord(
            patient_id=patient_id,
            allowed_roles=list(allowed_roles or ALL_AGENT_ROLES),
            allowed_organizations=list(allowed_organizations or DEFAULT_ALLOWED_ORGS),
            emergency_breakglass=True if emergency_breakglass is None else emergency_breakglass,
            notes=notes,
        )
        db.add(record)
    else:
        if allowed_roles is not None:
            record.allowed_roles = list(allowed_roles)
        if allowed_organizations is not None:
            record.allowed_organizations = list(allowed_organizations)
        if emergency_breakglass is not None:
            record.emergency_breakglass = emergency_breakglass
        if notes is not None:
            record.notes = notes

    await db.flush()
    await db.commit()
    return await get_consent_policy(db, patient_id)
