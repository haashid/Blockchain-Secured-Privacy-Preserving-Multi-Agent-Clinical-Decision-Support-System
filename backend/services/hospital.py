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

async def create_appointment(db: AsyncSession, data: AppointmentCreate) -> Appointment:
    apt = Appointment(**data.model_dump())
    db.add(apt)
    await db.flush()
    return apt

async def list_appointments_for_doctor(db: AsyncSession, doctor_id: uuid.UUID) -> Sequence[Appointment]:
    result = await db.execute(select(Appointment).where(Appointment.doctor_id == doctor_id))
    return result.scalars().all()

async def list_appointments_for_patient(db: AsyncSession, patient_id: uuid.UUID) -> Sequence[Appointment]:
    result = await db.execute(select(Appointment).where(Appointment.patient_id == patient_id))
    return result.scalars().all()

async def create_medical_record(db: AsyncSession, data: MedicalRecordCreate) -> MedicalRecord:
    rec = MedicalRecord(**data.model_dump(exclude_unset=True))
    db.add(rec)
    await db.flush()
    return rec

async def list_records_for_patient(db: AsyncSession, patient_id: uuid.UUID) -> Sequence[MedicalRecord]:
    result = await db.execute(select(MedicalRecord).where(MedicalRecord.patient_id == patient_id))
    return result.scalars().all()

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
