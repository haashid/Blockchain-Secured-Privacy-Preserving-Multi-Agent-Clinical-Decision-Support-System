import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.database import get_db
from backend.core.deps import get_current_user, require_role
from backend.models.models import User
from backend.schemas.hospital import *
from backend.services.hospital import *
from backend.services.ai_analysis import request_ai_analysis

router = APIRouter(prefix="/api/hospital", tags=["Hospital"])

# -- Patients --
@router.post("/patients", response_model=PatientResponse, status_code=201)
async def api_create_patient(
    body: PatientCreate, 
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(require_role("admin", "doctor"))]
):
    return await create_patient(db, body)

@router.get("/patients", response_model=list[PatientResponse])
async def api_list_patients(db: Annotated[AsyncSession, Depends(get_db)], user: Annotated[User, Depends(get_current_user)]):
    return await list_patients(db)

@router.get("/patients/{patient_id}", response_model=PatientResponse)
async def api_get_patient(patient_id: uuid.UUID, db: Annotated[AsyncSession, Depends(get_db)]):
    pat = await get_patient(db, patient_id)
    if not pat:
        raise HTTPException(status_code=404, detail="Patient not found")
    return pat

@router.get("/patients/{patient_id}/clinical-summary", response_model=PatientClinicalSummaryResponse)
async def api_get_patient_clinical_summary(
    patient_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    """Consolidated clinical summary for doctor patient workspace and authorized patient."""
    if user.role == "patient":
        pat = await resolve_patient_for_user(db, user)
        if pat.id != patient_id:
            raise HTTPException(
                status_code=403,
                detail="Access denied: You are not authorized to view another patient's clinical summary.",
            )
    elif user.role not in ("doctor", "admin"):
        raise HTTPException(
            status_code=403,
            detail=f"Access denied: Role '{user.role}' is not authorized to view patient clinical summaries.",
        )

    summary = await get_patient_clinical_summary(db, patient_id)
    if not summary:
        raise HTTPException(status_code=404, detail="Patient not found")
    return summary

# -- Doctors --
@router.post("/doctors", response_model=DoctorResponse, status_code=201)
async def api_create_doctor(
    body: DoctorCreate, 
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(require_role("admin"))]
):
    return await create_doctor(db, body)

@router.get("/doctors", response_model=list[DoctorResponse])
async def api_list_doctors(db: Annotated[AsyncSession, Depends(get_db)], user: Annotated[User, Depends(get_current_user)]):
    return await list_doctors(db)

# -- Appointments --
@router.post("/appointments", response_model=AppointmentResponse, status_code=201)
async def api_create_appointment(
    body: AppointmentCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)]
):
    return await create_appointment(db, body, current_user=user)

@router.get("/appointments")
async def api_list_appointments(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(require_role("doctor", "admin"))],
    doctor_id: uuid.UUID | None = None,
    patient_id: uuid.UUID | None = None,
    status: str | None = None,
):
    return await list_all_appointments(db, doctor_id=doctor_id, patient_id=patient_id, status=status)

@router.patch("/appointments/{appointment_id}")
async def api_update_appointment(
    appointment_id: uuid.UUID,
    body: AppointmentUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(require_role("doctor", "admin"))],
):
    if not body.status and body.notes is None:
        raise HTTPException(status_code=400, detail="Status or notes required for update")
    appt = await update_appointment_status(db, appointment_id, status=body.status, notes=body.notes)
    if not appt:
        raise HTTPException(status_code=404, detail="Appointment not found")
    return {"status": "success", "id": str(appt.id), "appointment_status": appt.status}

@router.get("/doctors/{doctor_id}/appointments", response_model=list[AppointmentResponse])
async def api_doctor_appointments(doctor_id: uuid.UUID, db: Annotated[AsyncSession, Depends(get_db)]):
    return await list_appointments_for_doctor(db, doctor_id)

@router.get("/patients/{patient_id}/appointments", response_model=list[AppointmentResponse])
async def api_patient_appointments(patient_id: uuid.UUID, db: Annotated[AsyncSession, Depends(get_db)]):
    return await list_appointments_for_patient(db, patient_id)

# -- Medical Records --
@router.post("/records", response_model=MedicalRecordResponse, status_code=201)
async def api_create_record(
    body: MedicalRecordCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)]
):
    return await create_medical_record(db, body, current_user=user)

@router.get("/records")
async def api_list_records(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(require_role("doctor", "admin"))],
    patient_id: uuid.UUID | None = None,
    doctor_id: uuid.UUID | None = None,
    record_type: str | None = None,
):
    return await list_all_records(db, patient_id=patient_id, doctor_id=doctor_id, record_type=record_type)

@router.get("/me/doctor", response_model=DoctorResponse)
async def api_get_my_doctor_record(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(require_role("doctor", "admin"))]
):
    """Doctor: get own doctor record."""
    doc = await resolve_doctor_for_user(db, user, raise_on_not_found=True)
    return DoctorResponse.model_validate(doc)

@router.get("/patients/{patient_id}/records", response_model=list[MedicalRecordResponse])
async def api_patient_records(
    patient_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)] = None,
):
    if user and user.role == "patient":
        pat = await resolve_patient_for_user(db, user, raise_on_not_found=True)
        if pat.id != patient_id:
            raise HTTPException(status_code=403, detail="Access denied. You can only view your own records.")
    return await list_records_for_patient(db, patient_id)

# -- Patient Reports --
@router.post("/patients/{patient_id}/reports", response_model=PatientReportResponse, status_code=201)
async def api_upload_report(
    patient_id: uuid.UUID,
    file: Annotated[UploadFile, File(...)],
    description: Annotated[str, Form()] = "",
    db: Annotated[AsyncSession, Depends(get_db)] = None,
    user: Annotated[User, Depends(get_current_user)] = None,
):
    if user and user.role == "patient":
        pat = await resolve_patient_for_user(db, user, raise_on_not_found=True)
        if pat.id != patient_id:
            raise HTTPException(status_code=403, detail="Access denied. You can only upload reports for your own profile.")

    from backend.storage.factory import get_storage_provider
    storage = get_storage_provider()
    content = await file.read()
    
    # Generate unique key
    ext = file.filename.split('.')[-1] if '.' in file.filename else 'bin'
    storage_key = f"reports/{patient_id}/{uuid.uuid4()}.{ext}"
    
    # Upload to storage
    await storage.upload_document(storage_key, content, content_type=file.content_type)
    
    # Save to DB
    return await create_patient_report(
        db=db,
        patient_id=patient_id,
        uploaded_by=user.id if user else None,
        filename=file.filename,
        file_type=file.content_type,
        file_size=len(content),
        storage_key=storage_key,
        description=description
    )

@router.get("/patients/{patient_id}/reports", response_model=list[PatientReportResponse])
async def api_list_reports(
    patient_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)] = None,
):
    if user and user.role == "patient":
        pat = await resolve_patient_for_user(db, user, raise_on_not_found=True)
        if pat.id != patient_id:
            raise HTTPException(status_code=403, detail="Access denied. You can only view your own reports.")
    return await list_reports_for_patient(db, patient_id)

@router.delete("/reports/{report_id}", status_code=204)
async def api_delete_report(report_id: uuid.UUID, db: Annotated[AsyncSession, Depends(get_db)]):
    await delete_patient_report(db, report_id)
    return None

@router.get("/patients/{patient_id}/prescriptions", response_model=list[PrescriptionResponse])
async def api_patient_prescriptions(
    patient_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)]
):
    if user.role == "patient":
        pat = await resolve_patient_for_user(db, user, raise_on_not_found=True)
        if pat.id != patient_id:
            raise HTTPException(status_code=403, detail="Access denied. You can only view your own prescriptions.")
    from sqlalchemy import select
    from backend.models.hospital import Prescription
    result = await db.execute(select(Prescription).where(Prescription.patient_id == patient_id).order_by(Prescription.prescribed_at.desc()))
    return result.scalars().all()

@router.get("/prescriptions")
async def api_my_prescriptions(db: Annotated[AsyncSession, Depends(get_db)], user: Annotated[User, Depends(require_role("patient"))]):
    """Patient: get their own prescriptions by resolving linked patient profile."""
    from sqlalchemy import select
    from backend.models.hospital import Prescription
    patient = await resolve_patient_for_user(db, user, raise_on_not_found=False)
    if not patient:
        return []
    result = await db.execute(select(Prescription).where(Prescription.patient_id == patient.id).order_by(Prescription.prescribed_at.desc()))
    scripts = result.scalars().all()
    return [
        {
            "id": str(s.id),
            "medication_name": s.medication_name,
            "dosage": s.dosage,
            "frequency": s.frequency,
            "duration": s.duration,
            "instructions": s.instructions,
            "is_active": s.is_active,
            "prescribed_at": s.prescribed_at.isoformat(),
            "patient_id": str(s.patient_id),
            "doctor_id": str(s.doctor_id),
        }
        for s in scripts
    ]

@router.get("/me/patient", response_model=PatientResponse)
async def api_get_my_patient_record(db: Annotated[AsyncSession, Depends(get_db)], user: Annotated[User, Depends(require_role("patient"))]):
    """Patient: get own patient record."""
    pat = await resolve_patient_for_user(db, user, raise_on_not_found=True)
    return PatientResponse.model_validate(pat)

@router.get("/me/appointments")
async def api_my_appointments(db: Annotated[AsyncSession, Depends(get_db)], user: Annotated[User, Depends(require_role("patient"))]):
    """Patient: get own appointments."""
    from sqlalchemy import select
    from backend.models.hospital import Appointment, Doctor
    patient = await resolve_patient_for_user(db, user, raise_on_not_found=False)
    if not patient:
        return []
    result = await db.execute(select(Appointment).where(Appointment.patient_id == patient.id).order_by(Appointment.scheduled_at.desc()))
    appointments = result.scalars().all()
    out = []
    for a in appointments:
        doctor_result = await db.execute(select(Doctor).where(Doctor.id == a.doctor_id))
        doc = doctor_result.scalar_one_or_none()
        out.append({
            "id": str(a.id),
            "scheduled_at": a.scheduled_at.isoformat(),
            "duration_minutes": a.duration_minutes,
            "status": a.status,
            "chief_complaint": a.chief_complaint,
            "notes": a.notes,
            "priority": a.priority,
            "doctor_name": f"Dr. {doc.first_name} {doc.last_name}" if doc else "Unknown",
            "doctor_specialization": doc.specialization if doc else None,
        })
    return out

# -- AI Analysis --
@router.post("/patients/{patient_id}/analyze")
async def api_analyze_patient(
    patient_id: uuid.UUID,
    body: AIAnalysisRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
    background_tasks: BackgroundTasks
):
    try:
        result = await request_ai_analysis(
            db=db,
            patient_id=patient_id,
            doctor_id=body.doctor_id,
            chief_complaint=body.chief_complaint,
            symptoms=body.symptoms,
            vitals=body.vitals.model_dump() if body.vitals else None,
            created_by_user_id=user.id,
            background_tasks=background_tasks
        )
        return result
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
