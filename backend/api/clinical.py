import uuid
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel

from backend.core.database import get_db
from backend.core.deps import get_current_user, require_role
from backend.models.models import User
from backend.services.clinical_review import (
    start_clinical_review,
    get_clinical_review,
    list_reviews_for_patient,
    list_reviews_for_doctor,
    list_all_reviews,
    get_review_provenance,
    get_review_verification,
    get_review_audit,
    get_review_agents,
    get_review_evidence,
    get_review_report,
    get_review_security
)

router = APIRouter(prefix="/api/clinical-reviews", tags=["Clinical Reviews"])

class ClinicalReviewStartRequest(BaseModel):
    patient_id: uuid.UUID
    purpose: str
    chief_complaint: str
    symptoms: list[str]
    vitals: dict[str, Any] | None = None

@router.post("")
async def api_start_clinical_review(
    body: ClinicalReviewStartRequest,
    background_tasks: BackgroundTasks,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(require_role("doctor", "admin"))]
):
    try:
        return await start_clinical_review(
            db=db,
            patient_id=body.patient_id,
            doctor_user_id=user.id,
            purpose=body.purpose,
            chief_complaint=body.chief_complaint,
            symptoms=body.symptoms,
            vitals=body.vitals,
            background_tasks=background_tasks
        )
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("")
async def api_list_all_reviews(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(require_role("doctor", "admin"))]
):
    active = await list_all_reviews(db, limit=25, status="active")
    mine = await list_reviews_for_doctor(db, user.id)
    return {"active": active, "mine": mine}

@router.get("/active")
async def api_list_active_reviews(
    limit: int = 25,
    db: Annotated[AsyncSession, Depends(get_db)] = None
):
    return await list_all_reviews(db, limit=limit, status="active")

@router.get("/patient/{patient_id}")
async def api_list_patient_reviews(
    patient_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)]
):
    return await list_reviews_for_patient(db, patient_id)

@router.get("/{review_id}")
async def api_get_clinical_review(
    review_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)]
):
    review = await get_clinical_review(db, review_id)
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")
    return review

@router.get("/{review_id}/agents")
async def api_get_clinical_review_agents(
    review_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)]
):
    return await get_review_agents(db, review_id)

@router.get("/{review_id}/evidence")
async def api_get_clinical_review_evidence(
    review_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)]
):
    return await get_review_evidence(db, review_id)

@router.get("/{review_id}/report")
async def api_get_clinical_review_report(
    review_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)]
):
    return await get_review_report(db, review_id)

@router.get("/{review_id}/security")
async def api_get_clinical_review_security(
    review_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)]
):
    return await get_review_security(db, review_id)

@router.get("/{review_id}/provenance")
async def api_get_clinical_review_provenance(
    review_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)]
):
    return await get_review_provenance(db, review_id)

@router.get("/{review_id}/verification")
async def api_get_clinical_review_verification(
    review_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)]
):
    return await get_review_verification(db, review_id)

@router.get("/{review_id}/audit")
async def api_get_clinical_review_audit(
    review_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)]
):
    return await get_review_audit(db, review_id)
