import uuid
from datetime import datetime
from typing import Any, Literal, List, Optional
from pydantic import BaseModel, Field

class Vitals(BaseModel):
    blood_pressure: str | None = None
    heart_rate: int | None = None
    temperature: float | None = None
    spo2: int | None = None
    weight: float | None = None
    height: float | None = None

class PatientCreate(BaseModel):
    first_name: str
    last_name: str
    date_of_birth: str | None = None
    gender: str | None = None
    blood_type: str | None = None
    phone: str | None = None
    email: str | None = None
    emergency_contact: str | None = None
    medical_record_number: str
    insurance_id: str | None = None
    allergies: List[str] = []
    chronic_conditions: List[str] = []

class PatientResponse(BaseModel):
    id: uuid.UUID
    first_name: str
    last_name: str
    date_of_birth: str | None
    gender: str | None
    blood_type: str | None
    phone: str | None
    email: str | None
    emergency_contact: str | None
    medical_record_number: str
    insurance_id: str | None
    allergies: List[str]
    chronic_conditions: List[str]
    created_at: datetime
    
    model_config = {"from_attributes": True}

class DoctorCreate(BaseModel):
    user_id: uuid.UUID
    first_name: str
    last_name: str
    specialization: str
    license_number: str
    department: str
    years_of_experience: int = 0
    qualifications: List[str] = []

class DoctorResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    first_name: str
    last_name: str
    specialization: str
    license_number: str
    department: str
    years_of_experience: int
    qualifications: List[str]
    is_available: bool
    created_at: datetime
    
    model_config = {"from_attributes": True}

class AppointmentCreate(BaseModel):
    patient_id: uuid.UUID
    doctor_id: uuid.UUID
    scheduled_at: datetime
    duration_minutes: int = 30
    chief_complaint: str | None = None
    notes: str | None = None
    priority: Literal["routine", "urgent", "emergency"] = "routine"

class AppointmentResponse(BaseModel):
    id: uuid.UUID
    patient_id: uuid.UUID
    doctor_id: uuid.UUID
    scheduled_at: datetime
    duration_minutes: int
    status: str
    chief_complaint: str | None
    notes: str | None
    priority: str
    linked_task_id: uuid.UUID | None
    created_at: datetime
    updated_at: datetime
    
    model_config = {"from_attributes": True}

class MedicalRecordCreate(BaseModel):
    patient_id: uuid.UUID
    doctor_id: uuid.UUID
    appointment_id: uuid.UUID | None = None
    record_type: Literal["consultation", "lab_result", "prescription", "imaging", "discharge_summary"]
    title: str
    content: dict[str, Any]
    vitals: Vitals | None = None
    lab_results: dict[str, Any] | None = None
    prescriptions: List[dict[str, Any]] | None = None
    diagnosis_codes: List[str] | None = None
    notes: str | None = None

class MedicalRecordResponse(BaseModel):
    id: uuid.UUID
    patient_id: uuid.UUID
    doctor_id: uuid.UUID
    appointment_id: uuid.UUID | None
    record_type: str
    title: str
    content: dict[str, Any]
    vitals: dict[str, Any] | None
    lab_results: dict[str, Any] | None
    prescriptions: List[dict[str, Any]] | None
    diagnosis_codes: List[str] | None
    notes: str | None
    ai_analysis_task_id: uuid.UUID | None
    created_at: datetime
    
    model_config = {"from_attributes": True}

class PrescriptionCreate(BaseModel):
    medical_record_id: uuid.UUID
    patient_id: uuid.UUID
    doctor_id: uuid.UUID
    medication_name: str
    dosage: str
    frequency: str
    duration: str | None = None
    instructions: str | None = None

class PrescriptionResponse(BaseModel):
    id: uuid.UUID
    medical_record_id: uuid.UUID
    patient_id: uuid.UUID
    doctor_id: uuid.UUID
    medication_name: str
    dosage: str
    frequency: str
    duration: str | None
    instructions: str | None
    is_active: bool
    prescribed_at: datetime
    
    model_config = {"from_attributes": True}

class AIAnalysisRequest(BaseModel):
    doctor_id: uuid.UUID
    chief_complaint: str
    symptoms: List[str]
    vitals: Vitals | None = None

class PatientReportResponse(BaseModel):
    id: uuid.UUID
    patient_id: uuid.UUID
    uploaded_by: uuid.UUID
    filename: str
    file_type: str
    file_size: int
    storage_key: str
    description: str | None
    uploaded_at: datetime
    
    model_config = {"from_attributes": True}
