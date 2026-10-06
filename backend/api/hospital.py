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
    return await create_appointment(db, body)

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
    return await create_medical_record(db, body)

@router.get("/patients/{patient_id}/records", response_model=list[MedicalRecordResponse])
async def api_patient_records(patient_id: uuid.UUID, db: Annotated[AsyncSession, Depends(get_db)]):
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
        uploaded_by=user.id,
        filename=file.filename,
        file_type=file.content_type,
        file_size=len(content),
        storage_key=storage_key,
        description=description
    )

@router.get("/patients/{patient_id}/reports", response_model=list[PatientReportResponse])
async def api_list_reports(patient_id: uuid.UUID, db: Annotated[AsyncSession, Depends(get_db)]):
    return await list_reports_for_patient(db, patient_id)

@router.delete("/reports/{report_id}", status_code=204)
async def api_delete_report(report_id: uuid.UUID, db: Annotated[AsyncSession, Depends(get_db)]):
    await delete_patient_report(db, report_id)
    return None

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
