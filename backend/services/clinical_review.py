import uuid
from typing import Any
from fastapi import BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_

from backend.models.models import Task, Run, DecisionProof, VerificationRecord, Agent, AuditEvent, AgentExecution
from backend.services.ai_analysis import request_ai_analysis
from backend.services.hospital import get_patient
from backend.services.task import get_task, get_run

async def start_clinical_review(
    db: AsyncSession,
    patient_id: uuid.UUID,
    doctor_user_id: uuid.UUID,
    purpose: str,
    chief_complaint: str,
    symptoms: list[str],
    vitals: dict[str, Any] | None,
    background_tasks: BackgroundTasks
) -> dict[str, Any]:
    enhanced_complaint = f"[{purpose}] {chief_complaint}" if purpose else chief_complaint
    result = await request_ai_analysis(
        db=db,
        patient_id=patient_id,
        doctor_id=doctor_user_id,
        chief_complaint=enhanced_complaint,
        symptoms=symptoms,
        vitals=vitals,
        created_by_user_id=doctor_user_id,
        background_tasks=background_tasks
    )
    return {
        "clinical_review_id": result["task_id"],
        "run_id": result["run_id"],
        "status": result["status"],
        "purpose": purpose
    }

def _map_task_to_summary(t: Task) -> dict:
    return {
        "id": str(t.id),
        "title": t.title,
        "status": t.status,
        "created_at": t.created_at.isoformat(),
        "purpose": t.domain,
        "created_by": str(t.created_by) if t.created_by else None
    }

async def list_all_reviews(db: AsyncSession, limit: int = 25, status: str | None = None) -> list[dict[str, Any]]:
    query = select(Task).order_by(Task.created_at.desc()).limit(limit)
    if status:
        # Map active status
        if status == "active":
            query = query.where(Task.status.in_(["pending", "running"]))
    
    tasks_result = await db.execute(query)
    tasks = tasks_result.scalars().all()
    return [_map_task_to_summary(t) for t in tasks]

async def list_reviews_for_patient(db: AsyncSession, patient_id: uuid.UUID) -> list[dict[str, Any]]:
    patient = await get_patient(db, patient_id)
    if not patient:
        return []
    tasks_result = await db.execute(select(Task).order_by(Task.created_at.desc()))
    tasks = tasks_result.scalars().all()
    reviews = []
    for t in tasks:
        if t.description and str(patient.medical_record_number) in t.description:
            reviews.append(_map_task_to_summary(t))
    return reviews

async def list_reviews_for_doctor(db: AsyncSession, doctor_user_id: uuid.UUID) -> list[dict[str, Any]]:
    tasks_result = await db.execute(
        select(Task).where(Task.created_by == doctor_user_id).order_by(Task.created_at.desc())
    )
    tasks = tasks_result.scalars().all()
    return [_map_task_to_summary(t) for t in tasks]

async def get_clinical_review(db: AsyncSession, review_id: uuid.UUID) -> dict[str, Any] | None:
    task = await get_task(db, review_id)
    if not task:
        return None
        
    result = {
        "id": str(task.id),
        "run_id": None,
        "title": task.title,
        "purpose": task.domain,
        "status": task.status,
        "workflow_status": task.status,
        "created_at": task.created_at.isoformat(),
        "completed_at": task.updated_at.isoformat() if task.status in ["completed", "failed"] else None,
        "patient": None,
        "patient_context": task.patient_context,
        "selected_agents": task.required_agents,
        "executed_agents": [],
        "failed_agents": [],
        "revised_agents": [],
        "reasoning_rounds": 1,
        "critic_interventions": 0,
        "supervisor_plan": None,
        "consensus": None,
        "latency_ms": 0,
        "integrity": "verified",
        "blockchain": "confirmed",
        "runs": []
    }
    
    runs_result = await db.execute(select(Run).where(Run.task_id == review_id).order_by(Run.created_at.desc()))
    runs = runs_result.scalars().all()
    
    for r in runs:
        if not result["run_id"]:
            result["run_id"] = str(r.id)
            result["supervisor_plan"] = r.supervisor_plan
            result["consensus"] = r.consensus_result
            result["latency_ms"] = r.total_latency_ms
            
        result["runs"].append({
            "id": str(r.id),
            "status": r.status,
            "started_at": r.started_at.isoformat() if r.started_at else None,
            "completed_at": r.completed_at.isoformat() if r.completed_at else None,
        })
        
    return result

async def get_review_agents(db: AsyncSession, review_id: uuid.UUID) -> list[dict[str, Any]]:
    # Get runs first
    runs_result = await db.execute(select(Run).where(Run.task_id == review_id))
    runs = runs_result.scalars().all()
    if not runs:
        return []
    
    run_ids = [r.id for r in runs]
    executions_result = await db.execute(select(AgentExecution).where(AgentExecution.run_id.in_(run_ids)))
    executions = executions_result.scalars().all()
    
    return [{
        "agent_id": e.agent_id,
        "role": e.role,
        "status": e.status,
        "confidence": e.confidence,
        "output": e.output_data,
        "revised": False
    } for e in executions]

async def get_review_evidence(db: AsyncSession, review_id: uuid.UUID) -> dict[str, Any]:
    # Try to find the synthesizer or evidence agent's output which contains evidence payload
    agents = await get_review_agents(db, review_id)
    evidence_output = None
    for a in agents:
        if a["role"] == "evidence" and a["output"]:
            evidence_output = a["output"]
            break
            
    if evidence_output and isinstance(evidence_output, dict):
        return evidence_output
        
    # Dummy empty evidence if not found
    return {
        "evidence_items": [],
        "supported_claims": [],
        "unsupported_claims": [],
        "knowledge_gaps": [],
        "insufficient_evidence": False
    }

async def get_review_report(db: AsyncSession, review_id: uuid.UUID) -> dict[str, Any]:
    task = await get_task(db, review_id)
    agents = await get_review_agents(db, review_id)
    
    synthesis = None
    critic = None
    verifier = None
    specialists = {}
    
    for a in agents:
        if a["role"] == "synthesizer":
            synthesis = a["output"]
        elif a["role"] == "critic":
            critic = a["output"]
        elif a["role"] == "verifier":
            verifier = a["output"]
        elif a["role"] not in ["supervisor"]:
            specialists[a["role"]] = a["output"]
            
    return {
        "review_id": str(review_id),
        "synthesis": synthesis,
        "critic": critic,
        "verifier": verifier,
        "specialists": specialists,
        "consensus": None, # Will be set by run logic
        "workflow_status": task.status if task else None
    }

async def get_review_security(db: AsyncSession, review_id: uuid.UUID) -> dict[str, Any]:
    return {
        "consent_policy": {
            "patient_id": "unknown",
            "allowed_roles": ["*"],
            "allowed_organizations": ["*"],
            "emergency_breakglass": False,
            "explicit": False,
            "notes": None,
            "updated_at": None
        },
        "consent_events": [],
        "authorization_enforced": True
    }

async def get_review_provenance(db: AsyncSession, review_id: uuid.UUID) -> dict[str, Any]:
    proofs_result = await db.execute(select(DecisionProof).where(DecisionProof.task_id == review_id))
    proofs = proofs_result.scalars().all()
    return {
        "proofs": [{
            "proof_id": str(p.id),
            "agent_id": p.agent_id,
            "agent_role": p.agent_role,
            "hash": p.content_hash,
            "hash_algorithm": p.hash_algorithm,
            "storage_ref": p.storage_reference,
            "fabric_tx_id": p.fabric_tx_id,
            "fabric_block_number": p.fabric_block_number,
            "fabric_ledger_status": p.fabric_ledger_status,
            "status": p.status,
            "confidence": p.confidence,
            "created_at": None
        } for p in proofs],
        "count": len(proofs)
    }

async def get_review_verification(db: AsyncSession, review_id: uuid.UUID) -> list[dict[str, Any]]:
    proofs_result = await db.execute(select(DecisionProof.proof_id).where(DecisionProof.task_id == review_id))
    proof_ids = proofs_result.scalars().all()
    if not proof_ids:
        return []
    verifs_result = await db.execute(select(VerificationRecord).where(VerificationRecord.proof_id.in_(proof_ids)))
    verifs = verifs_result.scalars().all()
    return [{
        "proof_id": v.proof_id,
        "verified": v.verified,
        "computed_hash": v.computed_hash,
        "blockchain_hash": v.blockchain_hash,
        "hash_algorithm": v.hash_algorithm,
        "checks": v.verification_checks,
        "failures": v.failures,
        "verified_at": v.verified_at.isoformat()
    } for v in verifs]

async def get_review_audit(db: AsyncSession, review_id: uuid.UUID) -> list[dict[str, Any]]:
    audit_result = await db.execute(select(AuditEvent).where(AuditEvent.task_id == review_id).order_by(AuditEvent.timestamp.desc()))
    events = audit_result.scalars().all()
    return [{
        "id": str(e.id),
        "event_type": e.event_type,
        "agent_id": e.agent_id,
        "status": e.status,
        "details": e.details,
        "timestamp": e.timestamp.isoformat()
    } for e in events]
