"""Clinical review service — bridges the Task/Run AI execution layer with the
ClinicalReview persistence layer that tracks approval and patient-release lifecycle."""

import uuid
from datetime import datetime, timezone
from typing import Any
from fastapi import BackgroundTasks, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from sqlalchemy.orm import noload

from backend.models.models import Task, Run, DecisionProof, VerificationRecord, Agent, AuditEvent, AgentExecution, AgentOutput
from backend.models.hospital import Doctor, Patient, ClinicalReview, Prescription, PatientNotification
from backend.services.ai_analysis import request_ai_analysis
from backend.services.hospital import get_patient
from backend.services.task import get_task, get_run


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


# ─── Purpose → review_type mapping ───────────────────────────────────

_PURPOSE_TO_TYPE = {
    "clinical case review": "comprehensive",
    "comprehensive case review": "comprehensive",
    "laboratory review": "laboratory",
    "lab review": "laboratory",
    "medication safety review": "medication_safety",
    "risk assessment": "risk_assessment",
    "follow-up review": "follow_up",
    "follow up review": "follow_up",
}

def _map_purpose_to_type(purpose: str) -> str:
    return _PURPOSE_TO_TYPE.get(purpose.lower(), "comprehensive")


# ─── Start Clinical Review ────────────────────────────────────────────

async def start_clinical_review(
    db: AsyncSession,
    patient_id: uuid.UUID,
    doctor_user_id: uuid.UUID,
    purpose: str,
    chief_complaint: str,
    symptoms: list[str],
    vitals: dict[str, Any] | None = None,
    background_tasks: BackgroundTasks | None = None,
) -> dict[str, Any]:
    # Verify patient exists
    patient = await get_patient(db, patient_id)
    if not patient:
        raise ValueError(f"Patient {patient_id} not found")

    # Fetch doctor record from user ID
    dr_result = await db.execute(select(Doctor).where(Doctor.user_id == doctor_user_id))
    doctor = dr_result.scalar_one_or_none()
    if not doctor:
        dr_result = await db.execute(select(Doctor).limit(1))
        doctor = dr_result.scalar_one_or_none()
    if not doctor:
        raise ValueError(f"Doctor record not found for user {doctor_user_id}")

    # Fetch consent for this patient
    from backend.models.models import ConsentRecord
    cr_result = await db.execute(select(ConsentRecord).where(ConsentRecord.patient_id == patient_id))
    consent_record = cr_result.scalar_one_or_none()
    consent_policy = None
    if consent_record:
        consent_policy = {
            "patient_id": str(patient_id),
            "allowed_roles": consent_record.allowed_roles,
            "allowed_organizations": consent_record.allowed_organizations,
            "emergency_breakglass": consent_record.emergency_breakglass,
        }

    enhanced_complaint = f"[{purpose}] {chief_complaint}" if purpose else chief_complaint

    result = await request_ai_analysis(
        db=db,
        patient_id=patient_id,
        doctor_id=doctor_user_id,
        chief_complaint=enhanced_complaint,
        symptoms=symptoms,
        vitals=vitals,
        created_by_user_id=doctor_user_id,
        background_tasks=background_tasks,
        consent_policy=consent_policy,
        review_purpose=purpose,
    )

    # Create ClinicalReview record linking everything
    review_type = _map_purpose_to_type(purpose)
    cr = ClinicalReview(
        task_id=uuid.UUID(result["task_id"]),
        patient_id=patient_id,
        doctor_id=doctor.id,
        purpose=purpose,
        chief_complaint=chief_complaint,
        review_type=review_type,
        approval_status="DRAFT",
    )
    db.add(cr)
    await db.commit()
    await db.refresh(cr)

    return {
        "clinical_review_id": str(cr.id),
        "task_id": result["task_id"],
        "run_id": result["run_id"],
        "status": result["status"],
        "purpose": purpose,
        "approval_status": "DRAFT",
    }


# ─── Mappers ─────────────────────────────────────────────────────────

def _map_task_to_summary(t: Task, cr: "ClinicalReview | None" = None) -> dict:
    base = {
        "id": str(cr.id) if cr else str(t.id),
        "task_id": str(t.id),
        "title": t.title,
        "status": t.status,
        "created_at": t.created_at.isoformat(),
        "purpose": cr.purpose if cr else t.domain,
        "chief_complaint": cr.chief_complaint if cr else None,
        "approval_status": cr.approval_status if cr else None,
        "created_by": str(t.created_by) if t.created_by else None,
        "patient_id": str(cr.patient_id) if cr else None,
    }
    return base


async def _get_cr_for_task(db: AsyncSession, task_id: uuid.UUID) -> "ClinicalReview | None":
    result = await db.execute(select(ClinicalReview).where(ClinicalReview.task_id == task_id))
    return result.scalar_one_or_none()


# ─── List Operations ─────────────────────────────────────────────────

async def list_all_reviews(db: AsyncSession, limit: int = 25, status: str | None = None) -> list[dict[str, Any]]:
    query = (
        select(Task, ClinicalReview)
        .outerjoin(ClinicalReview, ClinicalReview.task_id == Task.id)
        .options(
            noload(Task.runs),
            noload(Task.user),
            noload(Task.proofs),
            noload(ClinicalReview.patient),
            noload(ClinicalReview.doctor),
            noload(ClinicalReview.approver),
            noload(ClinicalReview.prescription),
        )
        .order_by(Task.created_at.desc())
        .limit(limit)
    )
    if status == "active":
        query = query.where(Task.status.in_(["pending", "running"]))

    result = await db.execute(query)
    rows = result.all()

    seen_task_ids = set()
    summaries = []
    for task, cr in rows:
        if task.id not in seen_task_ids:
            seen_task_ids.add(task.id)
            summaries.append(_map_task_to_summary(task, cr))
    return summaries


async def list_reviews_for_patient(db: AsyncSession, patient_id: uuid.UUID) -> list[dict[str, Any]]:
    query = (
        select(Task, ClinicalReview)
        .join(Task, Task.id == ClinicalReview.task_id)
        .options(
            noload(Task.runs),
            noload(Task.user),
            noload(Task.proofs),
            noload(ClinicalReview.patient),
            noload(ClinicalReview.doctor),
            noload(ClinicalReview.approver),
            noload(ClinicalReview.prescription),
        )
        .where(ClinicalReview.patient_id == patient_id)
        .order_by(ClinicalReview.created_at.desc())
    )
    result = await db.execute(query)
    return [_map_task_to_summary(task, cr) for task, cr in result.all()]


async def list_reviews_for_doctor(db: AsyncSession, doctor_user_id: uuid.UUID) -> list[dict[str, Any]]:
    # Get doctor record
    dr_result = await db.execute(select(Doctor).where(Doctor.user_id == doctor_user_id))
    doctor = dr_result.scalar_one_or_none()
    if doctor:
        query = (
            select(Task, ClinicalReview)
            .join(Task, Task.id == ClinicalReview.task_id)
            .options(
                noload(Task.runs),
                noload(Task.user),
                noload(Task.proofs),
                noload(ClinicalReview.patient),
                noload(ClinicalReview.doctor),
                noload(ClinicalReview.approver),
                noload(ClinicalReview.prescription),
            )
            .where(ClinicalReview.doctor_id == doctor.id)
            .order_by(ClinicalReview.created_at.desc())
        )
        result = await db.execute(query)
        return [_map_task_to_summary(task, cr) for task, cr in result.all()]

    # Fallback: tasks created by user
    tasks_result = await db.execute(
        select(Task).where(Task.created_by == doctor_user_id).order_by(Task.created_at.desc())
    )
    tasks = tasks_result.scalars().all()
    if not tasks:
        return []

    task_ids = [t.id for t in tasks]
    crs_result = await db.execute(select(ClinicalReview).where(ClinicalReview.task_id.in_(task_ids)))
    cr_map = {cr.task_id: cr for cr in crs_result.scalars().all()}
    return [_map_task_to_summary(t, cr_map.get(t.id)) for t in tasks]


async def list_released_reviews_for_patient(db: AsyncSession, patient_id: uuid.UUID) -> list[dict[str, Any]]:
    """Patient-facing: only return RELEASED reviews."""
    crs_result = await db.execute(
        select(ClinicalReview).where(
            and_(ClinicalReview.patient_id == patient_id, ClinicalReview.approval_status == "RELEASED")
        ).order_by(ClinicalReview.created_at.desc())
    )
    crs = crs_result.scalars().all()
    return [_map_released_review(cr) for cr in crs]


def _map_released_review(cr: "ClinicalReview") -> dict:
    """Map a released ClinicalReview to patient-safe fields."""
    report = cr.clinician_edited_report or cr.ai_draft_report or {}
    return {
        "id": str(cr.id),
        "purpose": cr.purpose,
        "chief_complaint": cr.chief_complaint,
        "released_at": cr.released_at.isoformat() if cr.released_at else None,
        "approved_at": cr.approved_at.isoformat() if cr.approved_at else None,
        "clinician_notes": cr.clinician_notes,
        "patient_friendly_summary": cr.patient_friendly_summary,
        "report": {
            "case_summary": report.get("case_summary", ""),
            "laboratory_findings": report.get("laboratory_findings", ""),
            "medication_safety_findings": report.get("medication_safety_findings", ""),
            "potential_concerns": report.get("potential_concerns", []),
            "suggested_clinical_review_points": report.get("suggested_clinical_review_points", []),
            "uncertainty": report.get("uncertainty", ""),
            "disclaimer": report.get("disclaimer", "AI-generated clinical decision support. Final clinical decisions remain with qualified healthcare professionals."),
        },
        "prescription_id": str(cr.prescription_id) if cr.prescription_id else None,
    }


# ─── Get Single Review ────────────────────────────────────────────────

async def get_clinical_review(db: AsyncSession, review_id: uuid.UUID) -> dict[str, Any] | None:
    """Get by ClinicalReview.id or Task.id (backward compat)."""
    # Try ClinicalReview.id first
    cr_result = await db.execute(select(ClinicalReview).where(ClinicalReview.id == review_id))
    cr = cr_result.scalar_one_or_none()

    if cr:
        task = await get_task(db, cr.task_id)
        task_id = cr.task_id
    else:
        # Try as task_id
        task = await get_task(db, review_id)
        if not task:
            return None
        cr = await _get_cr_for_task(db, task.id)
        task_id = task.id

    result = {
        "id": str(cr.id) if cr else str(task_id),
        "task_id": str(task_id),
        "run_id": None,
        "title": task.title if task else "Unknown",
        "purpose": cr.purpose if cr else None,
        "chief_complaint": cr.chief_complaint if cr else None,
        "review_type": cr.review_type if cr else None,
        "approval_status": cr.approval_status if cr else "DRAFT",
        "status": task.status if task else "unknown",
        "workflow_status": task.status if task else None,
        "created_at": (cr.created_at if cr else task.created_at).isoformat() if (cr or task) else None,
        "completed_at": None,
        "patient": None,
        "patient_context": task.patient_context if task else None,
        "selected_agents": task.required_agents if task else [],
        "executed_agents": [],
        "failed_agents": [],
        "revised_agents": [],
        "reasoning_rounds": 1,
        "critic_interventions": 0,
        "supervisor_plan": None,
        "consensus": None,
        "latency_ms": 0,
        "integrity": "pending",
        "blockchain": "pending",
        "runs": [],
        "clinician_notes": cr.clinician_notes if cr else None,
        "ai_draft_report": cr.ai_draft_report if cr else None,
        "clinician_edited_report": cr.clinician_edited_report if cr else None,
        "patient_id": str(cr.patient_id) if cr else None,
        "doctor_id": str(cr.doctor_id) if cr else None,
    }

    # Patient info
    if cr:
        patient = getattr(cr, "patient", None)
        if not patient and cr.patient_id:
            pat_result = await db.execute(select(Patient).where(Patient.id == cr.patient_id))
            patient = pat_result.scalar_one_or_none()
        if patient:
            result["patient"] = {
                "id": str(patient.id),
                "first_name": patient.first_name,
                "last_name": patient.last_name,
                "medical_record_number": patient.medical_record_number,
                "date_of_birth": patient.date_of_birth,
                "gender": patient.gender,
                "blood_type": patient.blood_type,
                "allergies": patient.allergies,
                "chronic_conditions": patient.chronic_conditions,
            }

    runs_result = await db.execute(select(Run).where(Run.task_id == task_id).order_by(Run.created_at.desc()))
    runs = runs_result.scalars().all()

    for r in runs:
        if not result["run_id"]:
            result["run_id"] = str(r.id)
            result["supervisor_plan"] = r.supervisor_plan
            result["consensus"] = r.consensus_result
            result["latency_ms"] = r.total_latency_ms

        run_final = r.final_result or {}
        result["executed_agents"] = run_final.get("executed_agents", [])
        result["failed_agents"] = run_final.get("failed_agents", [])
        result["revised_agents"] = run_final.get("revised_agents", [])
        result["reasoning_rounds"] = run_final.get("reasoning_rounds", 1)
        result["critic_interventions"] = run_final.get("critic_interventions", 0)
        result["integrity"] = run_final.get("integrity", "pending")
        result["blockchain"] = run_final.get("blockchain", "pending")

        result["runs"].append({
            "id": str(r.id),
            "status": r.status,
            "started_at": r.started_at.isoformat() if r.started_at else None,
            "completed_at": r.completed_at.isoformat() if r.completed_at else None,
        })

        if r.status == "completed":
            result["completed_at"] = r.completed_at.isoformat() if r.completed_at else None

    # If task completed and AI draft not yet persisted, capture it now
    if task and task.status == "completed" and cr and not cr.ai_draft_report:
        report_data = await get_review_report(db, review_id)
        if report_data.get("synthesis"):
            cr.ai_draft_report = report_data["synthesis"]
            if cr.approval_status == "DRAFT":
                cr.approval_status = "AWAITING_REVIEW"
            await db.flush()
            result["ai_draft_report"] = cr.ai_draft_report
            result["approval_status"] = cr.approval_status

    return result


# ─── Agent outputs ────────────────────────────────────────────────────

async def get_review_agents(db: AsyncSession, review_id: uuid.UUID) -> list[dict[str, Any]]:
    # Resolve task_id
    cr_result = await db.execute(select(ClinicalReview).where(ClinicalReview.id == review_id))
    cr = cr_result.scalar_one_or_none()
    task_id = cr.task_id if cr else review_id

    runs_result = await db.execute(select(Run).where(Run.task_id == task_id))
    runs = runs_result.scalars().all()
    if not runs:
        return []

    run_ids = [r.id for r in runs]
    exec_result = await db.execute(
        select(AgentExecution, AgentOutput)
        .outerjoin(AgentOutput, AgentOutput.execution_id == AgentExecution.id)
        .where(AgentExecution.run_id.in_(run_ids))
        .order_by(AgentExecution.sequence_order.asc(), AgentExecution.started_at.asc())
    )
    exec_rows = exec_result.all()

    agent_ids = list({e.agent_id for e, _ in exec_rows if e.agent_id})
    agent_map = {}
    if agent_ids:
        from backend.models.models import Agent as AgentModel
        agents_res = await db.execute(select(AgentModel).where(AgentModel.id.in_(agent_ids)))
        agent_map = {a.id: a for a in agents_res.scalars().all()}

    agents_out = []
    for e, agent_output in exec_rows:
        agent = agent_map.get(e.agent_id)
        agents_out.append({
            "agent_id": e.agent_id,
            "role": agent.role if agent else (e.agent_id.split("-")[1] if "-" in e.agent_id else e.agent_id),
            "display_name": agent.display_name if agent else e.agent_id,
            "status": e.status,
            "latency_ms": e.latency_ms,
            "started_at": e.started_at.isoformat() if e.started_at else None,
            "completed_at": e.completed_at.isoformat() if e.completed_at else None,
            "error_message": e.error_message,
            "output": agent_output.output_data if agent_output else None,
            "confidence": (agent_output.output_data or {}).get("confidence") if agent_output else None,
            "revised": False,
        })

    # Also include agent outputs from the final_result if no execution records yet
    if not agents_out:
        for run in runs:
            if run.final_result and run.final_result.get("agent_outputs"):
                for role, output in run.final_result["agent_outputs"].items():
                    agents_out.append({
                        "agent_id": f"agent-{role}-01",
                        "role": role,
                        "display_name": role.replace("_", " ").title() + " Agent",
                        "status": "completed",
                        "latency_ms": None,
                        "started_at": None,
                        "completed_at": None,
                        "error_message": None,
                        "output": output,
                        "confidence": output.get("confidence") if output else None,
                        "revised": role in (run.final_result.get("revised_agents") or []),
                    })

    return agents_out


async def get_review_evidence(db: AsyncSession, review_id: uuid.UUID) -> dict[str, Any]:
    agents = await get_review_agents(db, review_id)
    for a in agents:
        if a["role"] == "evidence" and a["output"]:
            return a["output"]

    return {
        "evidence_items": [],
        "supported_claims": [],
        "unsupported_claims": [],
        "knowledge_gaps": [],
        "insufficient_evidence": False,
        "confidence": None,
    }


async def get_review_report(db: AsyncSession, review_id: uuid.UUID) -> dict[str, Any]:
    # Resolve task_id
    cr_result = await db.execute(select(ClinicalReview).where(ClinicalReview.id == review_id))
    cr = cr_result.scalar_one_or_none()
    task_id = cr.task_id if cr else review_id

    # If CR has clinician-edited report, return that alongside AI draft
    if cr and cr.clinician_edited_report:
        return {
            "review_id": str(review_id),
            "synthesis": cr.clinician_edited_report,
            "ai_draft": cr.ai_draft_report,
            "critic": None,
            "verifier": None,
            "specialists": {},
            "consensus": None,
            "workflow_status": cr.approval_status,
            "approval_status": cr.approval_status,
            "clinician_notes": cr.clinician_notes,
        }

    task = await get_task(db, task_id)
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

    # Also check run final_result
    if not synthesis:
        runs_result = await db.execute(select(Run).where(Run.task_id == task_id).order_by(Run.created_at.desc()))
        runs = runs_result.scalars().all()
        for r in runs:
            if r.final_result and r.final_result.get("agent_outputs", {}).get("synthesizer"):
                synthesis = r.final_result["agent_outputs"]["synthesizer"]
                for role, output in r.final_result["agent_outputs"].items():
                    if role == "critic":
                        critic = output
                    elif role == "verifier":
                        verifier = output
                    elif role != "supervisor":
                        specialists[role] = output
                break

    return {
        "review_id": str(review_id),
        "synthesis": synthesis,
        "ai_draft": cr.ai_draft_report if cr else None,
        "critic": critic,
        "verifier": verifier,
        "specialists": specialists,
        "consensus": None,
        "workflow_status": task.status if task else None,
        "approval_status": cr.approval_status if cr else "DRAFT",
        "clinician_notes": cr.clinician_notes if cr else None,
    }


async def get_review_security(db: AsyncSession, review_id: uuid.UUID) -> dict[str, Any]:
    # Resolve patient_id from ClinicalReview
    cr_result = await db.execute(select(ClinicalReview).where(ClinicalReview.id == review_id))
    cr = cr_result.scalar_one_or_none()

    consent_policy_data = None
    if cr:
        from backend.models.models import ConsentRecord
        consent_result = await db.execute(
            select(ConsentRecord).where(ConsentRecord.patient_id == cr.patient_id)
        )
        consent_record = consent_result.scalar_one_or_none()
        if consent_record:
            consent_policy_data = {
                "patient_id": str(cr.patient_id),
                "allowed_roles": consent_record.allowed_roles,
                "allowed_organizations": consent_record.allowed_organizations,
                "emergency_breakglass": consent_record.emergency_breakglass,
                "explicit": True,
                "notes": consent_record.notes,
                "updated_at": consent_record.updated_at.isoformat() if consent_record.updated_at else None,
            }

    # Get audit events for consent
    task_id = cr.task_id if cr else review_id
    consent_events_result = await db.execute(
        select(AuditEvent).where(
            and_(AuditEvent.task_id == task_id, AuditEvent.event_type.like("consent%"))
        ).order_by(AuditEvent.timestamp.desc())
    )
    consent_events = consent_events_result.scalars().all()

    return {
        "consent_policy": consent_policy_data or {
            "patient_id": str(cr.patient_id) if cr else "unknown",
            "allowed_roles": ["*"],
            "allowed_organizations": ["*"],
            "emergency_breakglass": False,
            "explicit": False,
            "notes": None,
            "updated_at": None,
        },
        "consent_events": [
            {
                "event_type": e.event_type,
                "timestamp": e.timestamp.isoformat(),
                "status": e.status,
                "details": e.details,
            }
            for e in consent_events
        ],
        "authorization_enforced": True,
    }


async def get_review_provenance(db: AsyncSession, review_id: uuid.UUID) -> dict[str, Any]:
    cr_result = await db.execute(select(ClinicalReview).where(ClinicalReview.id == review_id))
    cr = cr_result.scalar_one_or_none()
    task_id = cr.task_id if cr else review_id

    proofs_result = await db.execute(select(DecisionProof).where(DecisionProof.task_id == task_id))
    proofs = proofs_result.scalars().all()

    # Also check run final_result for proof data if DB proofs are empty
    proof_list = []
    if proofs:
        for p in proofs:
            fabric_status = p.fabric_ledger_status
            # Truthful status labels
            if fabric_status == "committed":
                blockchain_display = "COMMITTED"
            elif fabric_status == "local":
                blockchain_display = "LOCAL_SIMULATION"
            elif fabric_status == "failed":
                blockchain_display = "FAILED"
            else:
                blockchain_display = "PENDING"

            proof_list.append({
                "proof_id": str(p.id),
                "agent_id": p.agent_id,
                "agent_role": p.agent_role,
                "hash": p.content_hash,
                "hash_algorithm": p.hash_algorithm,
                "storage_ref": p.storage_reference,
                "fabric_tx_id": p.fabric_tx_id,
                "fabric_block_number": p.fabric_block_number,
                "fabric_ledger_status": p.fabric_ledger_status,
                "blockchain_display_status": blockchain_display,
                "status": p.status,
                "confidence": p.confidence,
                "created_at": p.created_at.isoformat() if p.created_at else None,
            })
    else:
        # Try from run final_result
        runs_result = await db.execute(select(Run).where(Run.task_id == task_id).order_by(Run.created_at.desc()))
        runs = runs_result.scalars().all()
        for r in runs:
            if r.final_result and r.final_result.get("proofs"):
                for p in r.final_result["proofs"]:
                    fabric_status = p.get("fabric_ledger_status", "local")
                    blockchain_display = "COMMITTED" if fabric_status == "committed" else "LOCAL_SIMULATION"
                    proof_list.append({
                        "proof_id": p.get("proof_id"),
                        "agent_id": p.get("agent_id"),
                        "agent_role": p.get("agent_role"),
                        "hash": p.get("content_hash"),
                        "hash_algorithm": p.get("hash_algorithm", "SHA-256"),
                        "storage_ref": p.get("storage_reference"),
                        "fabric_tx_id": p.get("fabric_tx_id"),
                        "fabric_block_number": p.get("fabric_block_number"),
                        "fabric_ledger_status": fabric_status,
                        "blockchain_display_status": blockchain_display,
                        "status": p.get("status", "submitted"),
                        "confidence": p.get("confidence"),
                        "created_at": None,
                    })
                break

    return {"proofs": proof_list, "count": len(proof_list)}


async def get_review_verification(db: AsyncSession, review_id: uuid.UUID) -> list[dict[str, Any]]:
    cr_result = await db.execute(select(ClinicalReview).where(ClinicalReview.id == review_id))
    cr = cr_result.scalar_one_or_none()
    task_id = cr.task_id if cr else review_id

    proofs_result = await db.execute(select(DecisionProof.proof_id).where(DecisionProof.task_id == task_id))
    proof_ids = proofs_result.scalars().all()

    if proof_ids:
        verifs_result = await db.execute(
            select(VerificationRecord).where(VerificationRecord.proof_id.in_(proof_ids))
        )
        verifs = verifs_result.scalars().all()
        return [{
            "proof_id": v.proof_id,
            "verified": v.verified,
            "computed_hash": v.computed_hash,
            "blockchain_hash": v.blockchain_hash,
            "hash_algorithm": v.hash_algorithm,
            "checks": v.verification_checks,
            "failures": v.failures,
            "verified_at": v.verified_at.isoformat() if v.verified_at else None,
        } for v in verifs]

    # Fallback to run final_result
    runs_result = await db.execute(select(Run).where(Run.task_id == task_id).order_by(Run.created_at.desc()))
    runs = runs_result.scalars().all()
    for r in runs:
        if r.final_result and r.final_result.get("verifications"):
            return r.final_result["verifications"]

    return []


async def get_review_audit(db: AsyncSession, review_id: uuid.UUID) -> list[dict[str, Any]]:
    cr_result = await db.execute(select(ClinicalReview).where(ClinicalReview.id == review_id))
    cr = cr_result.scalar_one_or_none()
    task_id = cr.task_id if cr else review_id

    audit_result = await db.execute(
        select(AuditEvent).where(AuditEvent.task_id == task_id).order_by(AuditEvent.timestamp.desc())
    )
    events = audit_result.scalars().all()
    return [{
        "id": str(e.id),
        "event_type": e.event_type,
        "agent_id": e.agent_id,
        "status": e.status,
        "details": e.details,
        "timestamp": e.timestamp.isoformat(),
    } for e in events]


# ─── Approval / Rejection / Release ──────────────────────────────────

async def approve_clinical_review(
    db: AsyncSession,
    review_id: uuid.UUID,
    approver_user_id: uuid.UUID,
    clinician_notes: str | None,
    edited_report: dict | None,
) -> dict[str, Any]:
    """Doctor approves the AI-generated report, optionally editing it."""
    cr_result = await db.execute(select(ClinicalReview).where(ClinicalReview.id == review_id))
    cr = cr_result.scalar_one_or_none()
    if not cr:
        raise ValueError(f"ClinicalReview {review_id} not found")

    if cr.approval_status in ("APPROVED", "RELEASED"):
        raise ValueError(f"Review already {cr.approval_status}")

    # If draft not yet saved from run, capture it
    if not cr.ai_draft_report:
        report_data = await get_review_report(db, review_id)
        if report_data.get("synthesis"):
            cr.ai_draft_report = report_data["synthesis"]

    cr.approval_status = "APPROVED"
    cr.approved_by = approver_user_id
    cr.approved_at = utcnow()
    if clinician_notes:
        cr.clinician_notes = clinician_notes
    if edited_report:
        cr.clinician_edited_report = edited_report
    elif cr.ai_draft_report and not cr.clinician_edited_report:
        cr.clinician_edited_report = cr.ai_draft_report

    await db.flush()

    # Audit event
    db.add(AuditEvent(
        event_type="review.approved",
        task_id=cr.task_id,
        agent_id=None,
        status="approved",
        details={"review_id": str(review_id), "approved_by": str(approver_user_id)},
    ))
    await db.commit()
    await db.refresh(cr)

    return {"status": "approved", "review_id": str(review_id), "approved_at": cr.approved_at.isoformat()}


async def reject_clinical_review(
    db: AsyncSession,
    review_id: uuid.UUID,
    rejector_user_id: uuid.UUID,
    reason: str,
) -> dict[str, Any]:
    cr_result = await db.execute(select(ClinicalReview).where(ClinicalReview.id == review_id))
    cr = cr_result.scalar_one_or_none()
    if not cr:
        raise ValueError(f"ClinicalReview {review_id} not found")

    cr.approval_status = "REJECTED"
    cr.rejected_at = utcnow()
    cr.rejection_reason = reason

    await db.flush()

    db.add(AuditEvent(
        event_type="review.rejected",
        task_id=cr.task_id,
        status="rejected",
        details={"review_id": str(review_id), "reason": reason, "rejected_by": str(rejector_user_id)},
    ))
    await db.commit()
    await db.refresh(cr)

    return {"status": "rejected", "review_id": str(review_id)}


async def release_clinical_review(
    db: AsyncSession,
    review_id: uuid.UUID,
    releaser_user_id: uuid.UUID,
    patient_friendly_summary: str | None = None,
) -> dict[str, Any]:
    """Release an approved review to the patient portal."""
    cr_result = await db.execute(select(ClinicalReview).where(ClinicalReview.id == review_id))
    cr = cr_result.scalar_one_or_none()
    if not cr:
        raise ValueError(f"ClinicalReview {review_id} not found")

    if cr.approval_status != "APPROVED":
        raise ValueError(f"Cannot release a review with status {cr.approval_status}. Must be APPROVED first.")

    cr.approval_status = "RELEASED"
    cr.released_at = utcnow()
    if patient_friendly_summary:
        cr.patient_friendly_summary = patient_friendly_summary

    await db.flush()

    # Create patient notification
    report = cr.clinician_edited_report or cr.ai_draft_report or {}
    notification = PatientNotification(
        patient_id=cr.patient_id,
        notification_type="review_released",
        title="New clinical report available",
        message=f"Dr. Jenkins has released a clinical review report for your review. Purpose: {cr.purpose}",
        reference_id=cr.id,
        is_read=False,
    )
    db.add(notification)

    # Audit event
    db.add(AuditEvent(
        event_type="review.released",
        task_id=cr.task_id,
        status="released",
        details={"review_id": str(review_id), "released_by": str(releaser_user_id), "patient_id": str(cr.patient_id)},
    ))
    await db.commit()
    await db.refresh(cr)

    return {
        "status": "released",
        "review_id": str(review_id),
        "released_at": cr.released_at.isoformat(),
        "patient_id": str(cr.patient_id),
    }


async def create_prescription_from_review(
    db: AsyncSession,
    review_id: uuid.UUID,
    doctor_user_id: uuid.UUID,
    medication_name: str,
    dosage: str,
    frequency: str,
    duration: str | None,
    instructions: str | None,
) -> dict[str, Any]:
    """Issue a prescription from an approved clinical review."""
    cr_result = await db.execute(select(ClinicalReview).where(ClinicalReview.id == review_id))
    cr = cr_result.scalar_one_or_none()
    if not cr:
        raise ValueError(f"ClinicalReview {review_id} not found")

    if cr.approval_status not in ("APPROVED", "RELEASED"):
        raise ValueError(f"Cannot issue prescription from review with status {cr.approval_status}")

    # Get doctor record
    dr_result = await db.execute(select(Doctor).where(Doctor.user_id == doctor_user_id))
    doctor = dr_result.scalar_one_or_none()
    if not doctor:
        # Fallback to any existing doctor in DB
        dr_result = await db.execute(select(Doctor).limit(1))
        doctor = dr_result.scalar_one_or_none()
    if not doctor:
        raise ValueError(f"No doctor profile found in system. Please seed doctors first.")

    # Get or create a medical record to attach the prescription to
    from backend.models.hospital import MedicalRecord
    mr_result = await db.execute(
        select(MedicalRecord).where(MedicalRecord.patient_id == cr.patient_id).order_by(MedicalRecord.created_at.desc())
    )
    latest_record = mr_result.scalars().first()

    if not latest_record:
        latest_record = MedicalRecord(
            patient_id=cr.patient_id,
            doctor_id=doctor.id,
            record_type="consultation",
            title=f"Clinical Consultation: {cr.purpose or 'Review'}",
            content={"chief_complaint": cr.chief_complaint, "plan": "AI Review & Prescription"},
            notes=f"Prescription issued from clinical review {cr.id}",
        )
        db.add(latest_record)
        await db.flush()

    # Create prescription
    prescription = Prescription(
        medical_record_id=latest_record.id,
        patient_id=cr.patient_id,
        doctor_id=doctor.id,
        medication_name=medication_name,
        dosage=dosage,
        frequency=frequency,
        duration=duration,
        instructions=instructions,
        is_active=True,
    )
    db.add(prescription)
    await db.flush()

    # Link to clinical review
    cr.prescription_id = prescription.id
    await db.flush()

    # Notify patient
    notification = PatientNotification(
        patient_id=cr.patient_id,
        notification_type="prescription_issued",
        title="New prescription issued",
        message=f"Dr. Jenkins has issued a prescription: {medication_name} {dosage}.",
        reference_id=prescription.id,
        is_read=False,
    )
    db.add(notification)

    # Audit event
    db.add(AuditEvent(
        event_type="prescription.issued",
        task_id=cr.task_id,
        status="issued",
        details={
            "review_id": str(review_id),
            "prescription_id": str(prescription.id),
            "medication": medication_name,
            "issued_by": str(doctor_user_id),
        },
    ))
    await db.commit()
    await db.refresh(cr)

    return {
        "status": "prescribed",
        "prescription_id": str(prescription.id),
        "medication_name": medication_name,
        "dosage": dosage,
        "frequency": frequency,
        "duration": duration,
        "instructions": instructions,
        "patient_id": str(cr.patient_id),
        "review_id": str(review_id),
    }


async def get_patient_notifications(
    db: AsyncSession, patient_id: uuid.UUID
) -> list[dict[str, Any]]:
    result = await db.execute(
        select(PatientNotification).where(PatientNotification.patient_id == patient_id)
        .order_by(PatientNotification.created_at.desc())
    )
    notifs = result.scalars().all()
    return [{
        "id": str(n.id),
        "type": n.notification_type,
        "title": n.title,
        "message": n.message,
        "reference_id": str(n.reference_id) if n.reference_id else None,
        "is_read": n.is_read,
        "created_at": n.created_at.isoformat(),
    } for n in notifs]


async def mark_notification_read(db: AsyncSession, notification_id: uuid.UUID) -> None:
    result = await db.execute(
        select(PatientNotification).where(PatientNotification.id == notification_id)
    )
    n = result.scalar_one_or_none()
    if n:
        n.is_read = True
        await db.flush()
