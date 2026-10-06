import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    String,
    Text,
    JSON,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from backend.core.database import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def gen_uuid() -> uuid.UUID:
    return uuid.uuid4()


class Patient(Base):
    __tablename__ = "patients"

    id = Column(UUID(as_uuid=True), primary_key=True, default=gen_uuid)
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    date_of_birth = Column(String(50), nullable=True) # YYYY-MM-DD
    gender = Column(String(50), nullable=True)
    blood_type = Column(String(10), nullable=True)
    phone = Column(String(50), nullable=True)
    email = Column(String(255), nullable=True)
    emergency_contact = Column(String(255), nullable=True)
    medical_record_number = Column(String(100), unique=True, nullable=False, index=True)
    insurance_id = Column(String(100), nullable=True)
    allergies = Column(JSON, default=list, nullable=False)
    chronic_conditions = Column(JSON, default=list, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False)

    appointments = relationship("Appointment", back_populates="patient", lazy="selectin")
    medical_records = relationship("MedicalRecord", back_populates="patient", lazy="selectin")
    prescriptions = relationship("Prescription", back_populates="patient", lazy="selectin")
    patient_reports = relationship("PatientReport", back_populates="patient", lazy="selectin")


class Doctor(Base):
    __tablename__ = "doctors"

    id = Column(UUID(as_uuid=True), primary_key=True, default=gen_uuid)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), unique=True, nullable=False)
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    specialization = Column(String(100), nullable=False)
    license_number = Column(String(100), nullable=False)
    department = Column(String(100), nullable=False)
    years_of_experience = Column(Integer, default=0, nullable=False)
    qualifications = Column(JSON, default=list, nullable=False)
    is_available = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)

    user = relationship("User", lazy="selectin")
    appointments = relationship("Appointment", back_populates="doctor", lazy="selectin")
    medical_records = relationship("MedicalRecord", back_populates="doctor", lazy="selectin")
    prescriptions = relationship("Prescription", back_populates="doctor", lazy="selectin")


class Appointment(Base):
    __tablename__ = "appointments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=gen_uuid)
    patient_id = Column(UUID(as_uuid=True), ForeignKey("patients.id"), nullable=False, index=True)
    doctor_id = Column(UUID(as_uuid=True), ForeignKey("doctors.id"), nullable=False, index=True)
    scheduled_at = Column(DateTime(timezone=True), nullable=False)
    duration_minutes = Column(Integer, default=30, nullable=False)
    status = Column(Enum("scheduled", "in_progress", "completed", "cancelled", name="appointment_status"), default="scheduled", nullable=False)
    chief_complaint = Column(Text, nullable=True)
    notes = Column(Text, nullable=True)
    priority = Column(Enum("routine", "urgent", "emergency", name="appointment_priority"), default="routine", nullable=False)
    linked_task_id = Column(UUID(as_uuid=True), ForeignKey("tasks.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False)

    patient = relationship("Patient", back_populates="appointments", lazy="selectin")
    doctor = relationship("Doctor", back_populates="appointments", lazy="selectin")
    linked_task = relationship("Task", lazy="selectin")


class MedicalRecord(Base):
    __tablename__ = "medical_records"

    id = Column(UUID(as_uuid=True), primary_key=True, default=gen_uuid)
    patient_id = Column(UUID(as_uuid=True), ForeignKey("patients.id"), nullable=False, index=True)
    doctor_id = Column(UUID(as_uuid=True), ForeignKey("doctors.id"), nullable=False)
    appointment_id = Column(UUID(as_uuid=True), ForeignKey("appointments.id"), nullable=True)
    record_type = Column(Enum("consultation", "lab_result", "prescription", "imaging", "discharge_summary", name="record_type"), nullable=False)
    title = Column(String(200), nullable=False)
    content = Column(JSON, nullable=False)
    vitals = Column(JSON, nullable=True)
    lab_results = Column(JSON, nullable=True)
    prescriptions = Column(JSON, nullable=True)
    diagnosis_codes = Column(JSON, nullable=True)
    notes = Column(Text, nullable=True)
    ai_analysis_task_id = Column(UUID(as_uuid=True), ForeignKey("tasks.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)

    patient = relationship("Patient", back_populates="medical_records", lazy="selectin")
    doctor = relationship("Doctor", back_populates="medical_records", lazy="selectin")
    ai_analysis_task = relationship("Task", lazy="selectin")


class Prescription(Base):
    __tablename__ = "prescriptions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=gen_uuid)
    medical_record_id = Column(UUID(as_uuid=True), ForeignKey("medical_records.id"), nullable=False)
    patient_id = Column(UUID(as_uuid=True), ForeignKey("patients.id"), nullable=False, index=True)
    doctor_id = Column(UUID(as_uuid=True), ForeignKey("doctors.id"), nullable=False)
    medication_name = Column(String(200), nullable=False)
    dosage = Column(String(100), nullable=False)
    frequency = Column(String(100), nullable=False)
    duration = Column(String(100), nullable=True)
    instructions = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    prescribed_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)

    patient = relationship("Patient", back_populates="prescriptions", lazy="selectin")
    doctor = relationship("Doctor", back_populates="prescriptions", lazy="selectin")


class PatientReport(Base):
    __tablename__ = "patient_reports"

    id = Column(UUID(as_uuid=True), primary_key=True, default=gen_uuid)
    patient_id = Column(UUID(as_uuid=True), ForeignKey("patients.id"), nullable=False, index=True)
    uploaded_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    filename = Column(String(255), nullable=False)
    file_type = Column(String(100), nullable=False)
    file_size = Column(Integer, nullable=False)
    storage_key = Column(String(500), nullable=False)
    description = Column(Text, nullable=True)
    uploaded_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)

    patient = relationship("Patient", back_populates="patient_reports", lazy="selectin")
    user = relationship("User", lazy="selectin")
