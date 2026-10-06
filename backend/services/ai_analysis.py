import uuid
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession
from backend.models.models import User
from backend.services.hospital import get_patient, list_records_for_patient
from backend.services.task import create_task, create_run
from backend.orchestrator.workflow import run_workflow
from backend.storage.factory import get_storage_provider
from backend.blockchain.gateway import get_fabric_service
from backend.core.config import get_settings
from backend.core.database import async_session_factory
from fastapi import BackgroundTasks

settings = get_settings()

async def request_ai_analysis(
    db: AsyncSession,
    patient_id: uuid.UUID,
    doctor_id: uuid.UUID,
    chief_complaint: str,
    symptoms: list[str],
    vitals: dict[str, Any] | None,
    created_by_user_id: uuid.UUID | None,
    background_tasks: BackgroundTasks,
    consent_policy: dict[str, Any] | None = None,
    review_purpose: str | None = None,
) -> dict[str, Any]:
    """Orchestrates an AI analysis case based on hospital patient data."""
    # 1. Fetch patient and records
    patient = await get_patient(db, patient_id)
    if not patient:
        raise ValueError("Patient not found")
        
    records = await list_records_for_patient(db, patient_id)
    
    from backend.services.hospital import list_reports_for_patient
    reports = await list_reports_for_patient(db, patient_id)
    
    # 2. Build patient context for the AI agents
    patient_context = {
        "patient_id": str(patient_id),
        "demographics": {
            "age_dob_string": patient.date_of_birth,
            "gender": patient.gender,
            "blood_type": patient.blood_type,
        },
        "background": {
            "allergies": patient.allergies,
            "chronic_conditions": patient.chronic_conditions,
        },
        "current_presentation": {
            "chief_complaint": chief_complaint,
            "symptoms": symptoms,
            "vitals": vitals,
            "review_purpose": review_purpose,
        },
        "historical_records_summary": [
            {
                "type": r.record_type,
                "title": r.title,
                "date": str(r.created_at)
            } for r in records
        ],
        "uploaded_reports": [
            {
                "filename": r.filename,
                "file_type": r.file_type,
                "description": r.description,
                "date": str(r.uploaded_at)
            } for r in reports
        ]
    }
    
    # 3. Create Task
    task_title = f"AI Clinical Analysis: {patient.first_name} {patient.last_name} - {chief_complaint[:30]}"
    task = await create_task(
        db=db,
        title=task_title,
        description=f"Generated from Doctor portal for patient MRN {patient.medical_record_number}",
        domain="healthcare",
        priority="high",
        coordination_mode="blockchain",
        patient_context=patient_context,
        required_agents=[], # let supervisor decide
        created_by=created_by_user_id
    )
    
    # 4. Trigger run
    run = await create_run(db, task_id=task.id, mode="blockchain")
    
    # 5. Run the orchestrator workflow
    storage = get_storage_provider()
    fabric = get_fabric_service()
    
    task_data = {
        "task_id": str(task.id),
        "title": task.title,
        "description": task.description,
        "domain": task.domain,
        "priority": task.priority,
        "patient_context": task.patient_context,
        "required_agents": task.required_agents,
        # Enforce the patient's real consent policy inside the workflow.
        "consent_policy": consent_policy,
    }
    
    async def bg_workflow_runner():
        async with async_session_factory() as bg_db:
            try:
                await run_workflow(
                    task_id=str(task.id),
                    task_data=task_data,
                    mode="blockchain",
                    storage=storage,
                    db=bg_db,
                    fabric_service=fabric,
                    simulate_tampering=settings.SIMULATE_TAMPERING,
                )
                await bg_db.commit()
            except Exception as e:
                import traceback
                traceback.print_exc()
                await bg_db.rollback()
    
    background_tasks.add_task(bg_workflow_runner)
    
    return {
        "task_id": str(task.id),
        "run_id": str(run.id),
        "status": "processing"
    }
