from typing import Any, Sequence
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from backend.models.hospital import Patient, Doctor, Appointment, MedicalRecord, Prescription
from backend.schemas.hospital import PatientCreate, DoctorCreate, AppointmentCreate, MedicalRecordCreate, PrescriptionCreate

async def create_patient(db: AsyncSession, data: PatientCreate) -> Patient:
    patient = Patient(**data.model_dump())
    db.add(patient)
    await db.flush()
    return patient

async def get_patient(db: AsyncSession, patient_id: uuid.UUID) -> Patient | None:
    result = await db.execute(select(Patient).where(Patient.id == patient_id))
    return result.scalar_one_or_none()

async def list_patients(db: AsyncSession) -> Sequence[Patient]:
    result = await db.execute(select(Patient))
    return result.scalars().all()

async def create_doctor(db: AsyncSession, data: DoctorCreate) -> Doctor:
    doctor = Doctor(**data.model_dump())
    db.add(doctor)
    await db.flush()
    return doctor

async def get_doctor(db: AsyncSession, doctor_id: uuid.UUID) -> Doctor | None:
    result = await db.execute(select(Doctor).where(Doctor.id == doctor_id))
    return result.scalar_one_or_none()

async def list_doctors(db: AsyncSession) -> Sequence[Doctor]:
    result = await db.execute(select(Doctor))
    return result.scalars().all()

async def resolve_doctor_for_user(
    db: AsyncSession,
    user: Any,
    raise_on_not_found: bool = True,
) -> Doctor | None:
    from fastapi import HTTPException
    if not user or not hasattr(user, "id"):
        if raise_on_not_found:
            raise HTTPException(status_code=401, detail="Authentication required")
        return None
    res = await db.execute(select(Doctor).where(Doctor.user_id == user.id))
    doc = res.scalar_one_or_none()
    if not doc and raise_on_not_found:
        raise HTTPException(status_code=404, detail="No doctor hospital record found for current user")
    return doc

async def create_appointment(db: AsyncSession, data: AppointmentCreate, current_user: Any = None) -> Appointment:
    payload = data.model_dump()
    if not payload.get("doctor_id"):
        if current_user:
            doc = await resolve_doctor_for_user(db, current_user, raise_on_not_found=False)
            if doc:
                payload["doctor_id"] = doc.id
        if not payload.get("doctor_id"):
            first_doc = (await db.execute(select(Doctor).limit(1))).scalar_one_or_none()
            if first_doc:
                payload["doctor_id"] = first_doc.id
            else:
                raise ValueError("No doctor available to assign appointment")
    apt = Appointment(**payload)
    db.add(apt)
    await db.flush()
    return apt

async def list_appointments_for_doctor(db: AsyncSession, doctor_id: uuid.UUID) -> Sequence[Appointment]:
    result = await db.execute(select(Appointment).where(Appointment.doctor_id == doctor_id).order_by(Appointment.scheduled_at.desc()))
    return result.scalars().all()

async def list_appointments_for_patient(db: AsyncSession, patient_id: uuid.UUID) -> Sequence[Appointment]:
    result = await db.execute(select(Appointment).where(Appointment.patient_id == patient_id).order_by(Appointment.scheduled_at.desc()))
    return result.scalars().all()

async def list_all_appointments(
    db: AsyncSession,
    doctor_id: uuid.UUID | None = None,
    patient_id: uuid.UUID | None = None,
    status: str | None = None,
) -> list[dict[str, Any]]:
    stmt = (
        select(Appointment, Patient, Doctor)
        .outerjoin(Patient, Appointment.patient_id == Patient.id)
        .outerjoin(Doctor, Appointment.doctor_id == Doctor.id)
    )
    if doctor_id:
        stmt = stmt.where(Appointment.doctor_id == doctor_id)
    if patient_id:
        stmt = stmt.where(Appointment.patient_id == patient_id)
    if status:
        stmt = stmt.where(Appointment.status == status)

    stmt = stmt.order_by(Appointment.scheduled_at.desc())
    res = await db.execute(stmt)
    rows = res.all()

    out = []
    for appt, pat, doc in rows:
        out.append({
            "id": str(appt.id),
            "patient_id": str(appt.patient_id),
            "doctor_id": str(appt.doctor_id),
            "scheduled_at": appt.scheduled_at.isoformat() if hasattr(appt.scheduled_at, "isoformat") else str(appt.scheduled_at),
            "duration_minutes": appt.duration_minutes,
            "status": appt.status,
            "chief_complaint": appt.chief_complaint,
            "notes": appt.notes,
            "priority": appt.priority,
            "linked_task_id": str(appt.linked_task_id) if appt.linked_task_id else None,
            "created_at": appt.created_at.isoformat() if hasattr(appt.created_at, "isoformat") else str(appt.created_at),
            "updated_at": appt.updated_at.isoformat() if hasattr(appt.updated_at, "isoformat") else str(appt.updated_at),
            "patient_name": f"{pat.first_name} {pat.last_name}" if pat else "Unknown Patient",
            "patient_mrn": pat.medical_record_number if pat else "",
            "doctor_name": f"Dr. {doc.first_name} {doc.last_name}" if doc else "Attending Physician",
            "doctor_specialization": doc.specialization if doc else "General Medicine",
        })
    return out

async def update_appointment_status(
    db: AsyncSession,
    appointment_id: uuid.UUID,
    status: str,
    notes: str | None = None,
) -> Appointment | None:
    res = await db.execute(select(Appointment).where(Appointment.id == appointment_id))
    appt = res.scalar_one_or_none()
    if not appt:
        return None
    appt.status = status
    if notes is not None:
        appt.notes = notes
    await db.flush()
    return appt

async def create_medical_record(db: AsyncSession, data: MedicalRecordCreate, current_user: Any = None) -> MedicalRecord:
    payload = data.model_dump(exclude_unset=True)
    if not payload.get("doctor_id"):
        if current_user:
            doc = await resolve_doctor_for_user(db, current_user, raise_on_not_found=False)
            if doc:
                payload["doctor_id"] = doc.id
        if not payload.get("doctor_id"):
            first_doc = (await db.execute(select(Doctor).limit(1))).scalar_one_or_none()
            if first_doc:
                payload["doctor_id"] = first_doc.id
            else:
                raise ValueError("No doctor available to record medical history")
    rec = MedicalRecord(**payload)
    db.add(rec)
    await db.flush()
    return rec

async def list_records_for_patient(db: AsyncSession, patient_id: uuid.UUID) -> Sequence[MedicalRecord]:
    result = await db.execute(select(MedicalRecord).where(MedicalRecord.patient_id == patient_id).order_by(MedicalRecord.created_at.desc()))
    return result.scalars().all()

async def list_all_records(
    db: AsyncSession,
    patient_id: uuid.UUID | None = None,
    doctor_id: uuid.UUID | None = None,
    record_type: str | None = None,
) -> list[dict[str, Any]]:
    stmt = (
        select(MedicalRecord, Patient, Doctor)
        .outerjoin(Patient, MedicalRecord.patient_id == Patient.id)
        .outerjoin(Doctor, MedicalRecord.doctor_id == Doctor.id)
    )
    if patient_id:
        stmt = stmt.where(MedicalRecord.patient_id == patient_id)
    if doctor_id:
        stmt = stmt.where(MedicalRecord.doctor_id == doctor_id)
    if record_type:
        stmt = stmt.where(MedicalRecord.record_type == record_type)

    stmt = stmt.order_by(MedicalRecord.created_at.desc())
    res = await db.execute(stmt)
    rows = res.all()

    out = []
    for rec, pat, doc in rows:
        out.append({
            "id": str(rec.id),
            "patient_id": str(rec.patient_id),
            "doctor_id": str(rec.doctor_id),
            "appointment_id": str(rec.appointment_id) if rec.appointment_id else None,
            "record_type": rec.record_type,
            "title": rec.title,
            "content": rec.content,
            "vitals": rec.vitals,
            "lab_results": rec.lab_results,
            "prescriptions": rec.prescriptions,
            "diagnosis_codes": rec.diagnosis_codes,
            "notes": rec.notes,
            "ai_analysis_task_id": str(rec.ai_analysis_task_id) if rec.ai_analysis_task_id else None,
            "created_at": rec.created_at.isoformat() if hasattr(rec.created_at, "isoformat") else str(rec.created_at),
            "patient_name": f"{pat.first_name} {pat.last_name}" if pat else "Unknown Patient",
            "patient_mrn": pat.medical_record_number if pat else "",
            "doctor_name": f"Dr. {doc.first_name} {doc.last_name}" if doc else "Attending Physician",
            "doctor_specialization": doc.specialization if doc else "General Medicine",
        })
    return out

async def create_prescription(db: AsyncSession, data: PrescriptionCreate) -> Prescription:
    script = Prescription(**data.model_dump())
    db.add(script)
    await db.flush()
    return script

async def create_patient_report(db: AsyncSession, patient_id: uuid.UUID, uploaded_by: uuid.UUID, filename: str, file_type: str, file_size: int, storage_key: str, description: str | None = None):
    from backend.models.hospital import PatientReport
    report = PatientReport(
        patient_id=patient_id,
        uploaded_by=uploaded_by,
        filename=filename,
        file_type=file_type,
        file_size=file_size,
        storage_key=storage_key,
        description=description
    )
    db.add(report)
    await db.flush()
    return report

async def list_reports_for_patient(db: AsyncSession, patient_id: uuid.UUID):
    from backend.models.hospital import PatientReport
    result = await db.execute(select(PatientReport).where(PatientReport.patient_id == patient_id))
    return result.scalars().all()

async def get_patient_report(db: AsyncSession, report_id: uuid.UUID):
    from backend.models.hospital import PatientReport
    result = await db.execute(select(PatientReport).where(PatientReport.id == report_id))
    return result.scalar_one_or_none()

async def delete_patient_report(db: AsyncSession, report_id: uuid.UUID):
    from backend.models.hospital import PatientReport
    report = await get_patient_report(db, report_id)
    if report:
        await db.delete(report)
        await db.flush()
    return report


async def get_patient_clinical_summary(db: AsyncSession, patient_id: uuid.UUID) -> dict[str, Any] | None:
    """Consolidated clinical summary for patient workspace in doctor portal.
    Explicitly serializes via PatientClinicalSummaryResponse to prevent RecursionError
    and enforce data minimization.
    """
    from backend.services.clinical_review import list_reviews_for_patient
    from backend.models.hospital import Prescription, Appointment, MedicalRecord
    from backend.schemas.hospital import (
        PatientClinicalSummaryResponse,
        PatientResponse,
        MedicalRecordResponse,
        PrescriptionResponse,
        AppointmentResponse,
        ClinicalReviewSummary,
    )

    patient = await get_patient(db, patient_id)
    if not patient:
        return None

    records_res = await db.execute(
        select(MedicalRecord)
        .where(MedicalRecord.patient_id == patient_id)
        .order_by(MedicalRecord.created_at.desc())
        .limit(15)
    )
    records = records_res.scalars().all()

    scripts_res = await db.execute(
        select(Prescription)
        .where(Prescription.patient_id == patient_id)
        .order_by(Prescription.prescribed_at.desc())
    )
    prescriptions = scripts_res.scalars().all()

    appts_res = await db.execute(
        select(Appointment)
        .where(Appointment.patient_id == patient_id)
        .order_by(Appointment.scheduled_at.desc())
        .limit(10)
    )
    appointments = appts_res.scalars().all()

    raw_reviews = await list_reviews_for_patient(db, patient_id)
    review_summaries = []
    for r in (raw_reviews or []):
        review_summaries.append(
            ClinicalReviewSummary(
                id=str(r.get("id", "")),
                task_id=str(r.get("task_id", "")),
                title=str(r.get("title") or r.get("purpose") or "Clinical Review"),
                status=str(r.get("status", "")),
                created_at=str(r.get("created_at", "")),
                purpose=r.get("purpose"),
                chief_complaint=r.get("chief_complaint"),
                approval_status=r.get("approval_status"),
                created_by=str(r.get("created_by") or r.get("doctor_id") or ""),
                patient_id=str(r.get("patient_id") or patient_id),
            )
        )

    dto = PatientClinicalSummaryResponse(
        patient=PatientResponse.model_validate(patient),
        records=[MedicalRecordResponse.model_validate(rec) for rec in records],
        prescriptions=[PrescriptionResponse.model_validate(rx) for rx in prescriptions],
        appointments=[AppointmentResponse.model_validate(appt) for appt in appointments],
        reviews=review_summaries,
    )
    return {
        "patient": dto.patient,
        "records": dto.records,
        "prescriptions": dto.prescriptions,
        "appointments": dto.appointments,
        "reviews": dto.reviews,
    }


async def resolve_patient_for_user(
    db: AsyncSession,
    user: Any,
    raise_on_not_found: bool = True,
) -> Patient | None:
    """Resolve the authoritative Patient hospital record for an authenticated user.

    Resolution order:
    1. Direct Patient.user_id == user.id (primary, authoritative, uniquely indexed).
    2. Fallback to exact email match (Patient.email == user.email).
       - If exactly 1 match: links user_id and returns the patient.
       - If > 1 match: fails safely with HTTP 409 Conflict (ambiguous identity).
    3. Fallback to username in email match (Patient.email.like(f"%{user.username}%")).
       - If exactly 1 match: links user_id and returns the patient.
       - If > 1 match: fails safely with HTTP 409 Conflict (ambiguous identity).

    If no matches found:
    - Returns None if raise_on_not_found is False.
    - Raises HTTP 404 Not Found if raise_on_not_found is True.
    """
    from fastapi import HTTPException

    if not user or not hasattr(user, "id"):
        if raise_on_not_found:
            raise HTTPException(status_code=401, detail="Authentication required")
        return None

    # 1. Authoritative lookup by user_id
    stmt = select(Patient).where(Patient.user_id == user.id)
    res = await db.execute(stmt)
    linked_patients = res.scalars().all()
    if len(linked_patients) == 1:
        return linked_patients[0]
    elif len(linked_patients) > 1:
        raise HTTPException(
            status_code=409,
            detail=f"Ambiguous patient identity: {len(linked_patients)} patient profiles linked to user ID {user.id}",
        )

    # 2. Fallback: exact email match
    user_email = getattr(user, "email", None)
    if user_email:
        res = await db.execute(select(Patient).where(Patient.email == user_email))
        email_matches = res.scalars().all()
        if len(email_matches) == 1:
            pat = email_matches[0]
            if pat.user_id is None:
                pat.user_id = user.id
                await db.flush()
            return pat
        elif len(email_matches) > 1:
            raise HTTPException(
                status_code=409,
                detail=f"Ambiguous patient identity: multiple patient records ({len(email_matches)}) found with email '{user_email}'. Contact administrator.",
            )

    # 3. Fallback: username substring match in email
    user_name = getattr(user, "username", None)
    if user_name:
        res = await db.execute(select(Patient).where(Patient.email.like(f"%{user_name}%")))
        name_matches = res.scalars().all()
        if len(name_matches) == 1:
            pat = name_matches[0]
            if pat.user_id is None:
                pat.user_id = user.id
                await db.flush()
            return pat
        elif len(name_matches) > 1:
            raise HTTPException(
                status_code=409,
                detail=f"Ambiguous patient identity: multiple patient records ({len(name_matches)}) found matching username '{user_name}'. Contact administrator.",
            )

    if raise_on_not_found:
        raise HTTPException(
            status_code=404,
            detail="No patient hospital record found for the authenticated user.",
        )
    return None
