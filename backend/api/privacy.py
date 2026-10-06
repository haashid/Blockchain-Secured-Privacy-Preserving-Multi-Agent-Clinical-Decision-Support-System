import uuid
from typing import Annotated, Any
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel

from backend.core.database import get_db
from backend.core.deps import get_current_user, require_role
from backend.models.models import User, AuditEvent

router = APIRouter(prefix="/api/privacy", tags=["Privacy"])

class ConsentUpdateRequest(BaseModel):
    allowed_roles: list[str] | None = None
    allowed_organizations: list[str] | None = None
    emergency_breakglass: bool | None = None
    notes: str | None = None

@router.get("/access-history/{patient_id}")
async def get_access_history(
    patient_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(require_role("patient", "admin", "doctor"))]
):
    result = await db.execute(
        select(AuditEvent).order_by(AuditEvent.timestamp.desc()).limit(20)
    )
    events = result.scalars().all()
    
    return [
        {
            "id": str(e.id),
            "timestamp": e.timestamp.isoformat(),
            "actor": e.agent_id or "Doctor",
            "action": e.event_type,
            "resource": "Clinical Record",
            "status": e.status or "Allowed",
            "task_id": str(e.task_id) if e.task_id else None,
            "details": e.details
        }
        for e in events
    ]

@router.get("/consent/{patient_id}")
async def get_consent_settings(
    patient_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(require_role("patient", "admin", "doctor"))]
):
    return {
        "patient_id": str(patient_id),
        "allowed_organizations": ["*"],
        "allowed_roles": ["doctor", "supervisor", "clinical_reasoning", "history", "laboratory", "medication", "risk", "evidence", "critic", "verifier", "synthesizer"],
        "emergency_breakglass": False,
        "explicit": False,
        "notes": None,
        "updated_at": "2023-10-01T12:00:00Z"
    }

@router.put("/consent/{patient_id}")
async def update_consent_settings(
    patient_id: uuid.UUID,
    body: ConsentUpdateRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(require_role("patient", "admin"))]
):
    return {
        "patient_id": str(patient_id),
        "allowed_organizations": body.allowed_organizations or ["*"],
        "allowed_roles": body.allowed_roles or ["doctor", "supervisor", "clinical_reasoning", "history", "laboratory", "medication", "risk", "evidence", "critic", "verifier", "synthesizer"],
        "emergency_breakglass": body.emergency_breakglass if body.emergency_breakglass is not None else False,
        "explicit": True,
        "notes": body.notes,
        "updated_at": "2023-10-01T12:00:00Z"
    }

@router.get("/available-roles")
async def get_available_roles(
    user: Annotated[User, Depends(get_current_user)]
):
    return {
        "roles": [
            "supervisor", "clinical_reasoning", "history", 
            "laboratory", "medication", "risk", "evidence", 
            "critic", "verifier", "synthesizer"
        ]
    }
