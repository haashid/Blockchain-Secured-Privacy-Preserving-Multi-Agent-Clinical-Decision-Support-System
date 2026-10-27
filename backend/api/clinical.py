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
    list_released_reviews_for_patient,
    get_review_provenance,
    get_review_verification,
    get_review_audit,
    get_review_agents,
    get_review_evidence,
    get_review_report,
    get_review_security,
    approve_clinical_review,
    reject_clinical_review,
    release_clinical_review,
    create_prescription_from_review,
    get_patient_notifications,
    mark_notification_read,
)

router = APIRouter(prefix="/api/clinical-reviews", tags=["Clinical Reviews"])


# ─── Request models ───────────────────────────────────────────────────

class ClinicalReviewStartRequest(BaseModel):
    patient_id: uuid.UUID
    purpose: str
    chief_complaint: str
    symptoms: list[str]
    vitals: dict[str, Any] | None = None


class ApproveRequest(BaseModel):
    clinician_notes: str | None = None
    edited_report: dict[str, Any] | None = None


class RejectRequest(BaseModel):
    reason: str


class ReleaseRequest(BaseModel):
    patient_friendly_summary: str | None = None


class PrescriptionRequest(BaseModel):
    medication_name: str
    dosage: str
    frequency: str
    duration: str | None = None
    instructions: str | None = None


# ─── Start / List ─────────────────────────────────────────────────────

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
    db: Annotated[AsyncSession, Depends(get_db)] = None,
    user: Annotated[User, Depends(get_current_user)] = None,
):
    return await list_all_reviews(db, limit=limit, status="active")


@router.get("/patient/{patient_id}")
async def api_list_patient_reviews(
    patient_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)]
):
    # Doctor/admin can see all; patient can only see their own released reviews
    if user.role == "patient":
        from backend.services.hospital import resolve_patient_for_user
        pat = await resolve_patient_for_user(db, user, raise_on_not_found=True)
        if pat.id != patient_id:
            raise HTTPException(status_code=403, detail="Access denied. You can only view your own reviews.")
        return await list_released_reviews_for_patient(db, patient_id)
    return await list_reviews_for_patient(db, patient_id)


# ─── Patient-facing released reviews ─────────────────────────────────

@router.get("/my-released")
@router.get("/patient/me/released")
async def api_my_released_reviews(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(require_role("patient"))]
):
    """Patient endpoint: returns only RELEASED reviews for this patient's linked patient record."""
    from backend.services.hospital import resolve_patient_for_user
    patient = await resolve_patient_for_user(db, user, raise_on_not_found=False)
    if not patient:
        return []
    return await list_released_reviews_for_patient(db, patient.id)


# ─── Notifications ────────────────────────────────────────────────────

@router.get("/notifications")
@router.get("/patient/me/notifications")
async def api_get_notifications(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(require_role("patient"))]
):
    """Patient: get in-app notifications."""
    from backend.services.hospital import resolve_patient_for_user
    patient = await resolve_patient_for_user(db, user, raise_on_not_found=False)
    if not patient:
        return []
    return await get_patient_notifications(db, patient.id)


@router.post("/notifications/{notification_id}/read")
async def api_mark_notification_read(
    notification_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(require_role("patient"))]
):
    await mark_notification_read(db, notification_id)
    return {"status": "read"}


# ─── Get / Detail ─────────────────────────────────────────────────────

@router.get("/{review_id}")
async def api_get_clinical_review(
    review_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)]
):
    review = await get_clinical_review(db, review_id)
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")

    # Patient role: only return if RELEASED and belongs to this patient
    if user.role == "patient":
        from backend.services.hospital import resolve_patient_for_user
        pat = await resolve_patient_for_user(db, user, raise_on_not_found=True)
        if review.get("approval_status") != "RELEASED":
            raise HTTPException(status_code=403, detail="This review has not been released to you yet.")
        if review.get("patient_id") and str(pat.id) != str(review.get("patient_id")):
            raise HTTPException(status_code=403, detail="Access denied. You can only view your own reviews.")

    return review


@router.get("/{review_id}/agents")
async def api_get_clinical_review_agents(
    review_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)]
):
    if user.role == "patient":
        raise HTTPException(status_code=403, detail="Agent details are not available to patients.")
    return await get_review_agents(db, review_id)


@router.get("/{review_id}/evidence")
async def api_get_clinical_review_evidence(
    review_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)]
):
    if user.role == "patient":
        raise HTTPException(status_code=403, detail="Evidence details are not available to patients.")
    return await get_review_evidence(db, review_id)


@router.get("/{review_id}/report")
async def api_get_clinical_review_report(
    review_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)]
):
    # Patients can get report only if review is RELEASED and belongs to them
    if user.role == "patient":
        review = await get_clinical_review(db, review_id)
        if not review:
            raise HTTPException(status_code=404, detail="Review not found.")
        from backend.services.hospital import resolve_patient_for_user
        pat = await resolve_patient_for_user(db, user, raise_on_not_found=True)
        if review.get("approval_status") != "RELEASED":
            raise HTTPException(status_code=403, detail="Report not released.")
        if review.get("patient_id") and str(pat.id) != str(review.get("patient_id")):
            raise HTTPException(status_code=403, detail="Access denied. You can only view your own reports.")
    return await get_review_report(db, review_id)


@router.get("/{review_id}/security")
async def api_get_clinical_review_security(
    review_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)]
):
    if user.role == "patient":
        raise HTTPException(status_code=403, detail="Security details are not available to patients.")
    return await get_review_security(db, review_id)


@router.get("/{review_id}/provenance")
async def api_get_clinical_review_provenance(
    review_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)]
):
    if user.role == "patient":
        raise HTTPException(status_code=403, detail="Provenance details are not available to patients.")
    return await get_review_provenance(db, review_id)


@router.get("/{review_id}/verification")
async def api_get_clinical_review_verification(
    review_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)]
):
    if user.role == "patient":
        raise HTTPException(status_code=403, detail="Verification details are not available to patients.")
    return await get_review_verification(db, review_id)


@router.get("/{review_id}/audit")
async def api_get_clinical_review_audit(
    review_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)]
):
    if user.role == "patient":
        raise HTTPException(status_code=403, detail="Audit details are not available to patients.")
    return await get_review_audit(db, review_id)


# ─── Approval / Rejection / Release ──────────────────────────────────

@router.post("/{review_id}/approve")
async def api_approve_review(
    review_id: uuid.UUID,
    body: ApproveRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(require_role("doctor", "admin"))]
):
    try:
        res = await approve_clinical_review(
            db=db,
            review_id=review_id,
            approver_user_id=user.id,
            clinician_notes=body.clinician_notes,
            edited_report=body.edited_report,
        )
        await db.commit()
        return res
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{review_id}/reject")
async def api_reject_review(
    review_id: uuid.UUID,
    body: RejectRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(require_role("doctor", "admin"))]
):
    try:
        res = await reject_clinical_review(
            db=db,
            review_id=review_id,
            rejector_user_id=user.id,
            reason=body.reason,
        )
        await db.commit()
        return res
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{review_id}/release")
async def api_release_review(
    review_id: uuid.UUID,
    body: ReleaseRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(require_role("doctor", "admin"))]
):
    try:
        res = await release_clinical_review(
            db=db,
            review_id=review_id,
            releaser_user_id=user.id,
            patient_friendly_summary=body.patient_friendly_summary,
        )
        await db.commit()
        return res
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{review_id}/prescription")
async def api_create_prescription_from_review(
    review_id: uuid.UUID,
    body: PrescriptionRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(require_role("doctor", "admin"))]
):
    try:
        res = await create_prescription_from_review(
            db=db,
            review_id=review_id,
            doctor_user_id=user.id,
            medication_name=body.medication_name,
            dosage=body.dosage,
            frequency=body.frequency,
            duration=body.duration,
            instructions=body.instructions,
        )
        await db.commit()
        return res
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
