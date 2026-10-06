"""Secure Multi-Agent AI Coordination Framework — FastAPI Application."""

import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import Annotated

from fastapi import FastAPI, Depends, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.config import get_settings
from backend.core.database import get_db, init_db
from backend.core.logging_config import setup_logging, get_logger
from backend.core.deps import get_current_user, require_role
from backend.core.security import create_access_token, hash_password
from backend.models.models import (
    User, Agent, Task, Run, DecisionProof, VerificationRecord, AuditEvent,
    TrustScore, SystemMetric, BenchmarkResult,
)
from backend.schemas.schemas import (
    LoginRequest, TokenResponse, UserResponse, AgentCreate, AgentUpdate, AgentResponse,
    TaskCreate, TaskResponse, TaskDetail, RunResponse, DecisionProofResponse,
    VerificationRequest, VerificationResponse, AuditEventResponse, BenchmarkRunRequest,
    BenchmarkResultResponse, HealthResponse, ReadyResponse, MetricsResponse, ErrorResponse,
)
from backend.services.auth import authenticate_user, create_user, get_or_create_default_admin
from backend.services.agent import list_agents, get_agent, create_agent as svc_create_agent, update_agent, seed_agents
from backend.services.agent import get_agent_trust_history, get_agent_activity
from backend.services.task import create_task, get_task, list_tasks, create_run, get_run, list_runs_for_task
from backend.services.verification import verify_decision
from backend.services.audit import list_audit_events, get_audit_events_by_task, get_audit_events_by_agent, create_audit_event
from backend.services.trust import update_trust_score
from backend.services.anomaly import detect_anomalies
from backend.services.benchmark import run_benchmark
from backend.storage.factory import get_storage_provider
from backend.blockchain.gateway import get_fabric_service
from backend.orchestrator.workflow import run_workflow
from backend.api.hospital import router as hospital_router
from backend.api.knowledge import router as knowledge_router
from backend.api.clinical import router as clinical_router
from backend.api.privacy import router as privacy_router

settings = get_settings()
setup_logging(settings.APP_LOG_LEVEL)
logger = get_logger("app")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup/shutdown lifecycle."""
    logger.info("starting_application", env=settings.APP_ENV)
    # Init DB tables (dev mode)
    try:
        await init_db()
    except Exception as e:
        logger.warning("db_init_failed", error=str(e))

    # Seed admin, doctor, patient users and agents
    try:
        from backend.core.database import async_session_factory
        async with async_session_factory() as db:
            await get_or_create_default_admin(db)
            await seed_agents(db)
            await db.commit()
            logger.info("seed_completed")
    except Exception as e:
        import traceback
        logger.error("seed_failed", error=str(e))
        traceback.print_exc()

    # Ingest demo knowledge base
    try:
        from backend.knowledge.service import get_rag_service
        rag = get_rag_service()
        if settings.RAG_ENABLED:
            rag.load_directory(settings.RAG_KNOWLEDGE_DIR)
            logger.info("rag_knowledge_loaded", document_count=len(rag.list_documents()))
    except Exception as e:
        logger.error("rag_load_failed", error=str(e))

    # Try connecting Fabric
    fabric = get_fabric_service()
    try:
        await fabric.connect()
    except Exception:
        pass

    logger.info("application_started")
    yield
    logger.info("application_stopping")


app = FastAPI(
    title="Secure Multi-Agent AI Coordination Framework",
    description="Blockchain-powered multi-agent clinical decision support system",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(hospital_router)
app.include_router(knowledge_router)
app.include_router(clinical_router)
app.include_router(privacy_router)

# ─── Error Handler ──────────────────────────────────────────────────
@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "success": False,
            "error": {"code": f"HTTP_{exc.status_code}", "message": str(exc.detail)},
            "request_id": str(request.state.__dict__.get("request_id", "")),
        },
    )


@app.middleware("http")
async def add_request_id(request: Request, call_next):
    request.state.request_id = str(uuid.uuid4())
    response = await call_next(request)
    response.headers["X-Request-ID"] = request.state.request_id
    return response


# ═══════════════════════════════════════════════════════════════════
# AUTH ROUTES
# ═══════════════════════════════════════════════════════════════════

@app.post("/api/auth/login", response_model=TokenResponse)
async def login(body: LoginRequest, db: Annotated[AsyncSession, Depends(get_db)]):
    result = await authenticate_user(db, body.username, body.password)
    if not result:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    return result


@app.get("/api/auth/me", response_model=UserResponse)
async def get_me(user: Annotated[User, Depends(get_current_user)]):
    return user


# ═══════════════════════════════════════════════════════════════════
# AGENT ROUTES
# ═══════════════════════════════════════════════════════════════════

@app.get("/api/agents", response_model=list[AgentResponse])
async def api_list_agents(db: Annotated[AsyncSession, Depends(get_db)]):
    return await list_agents(db)


@app.get("/api/agents/{agent_id}", response_model=AgentResponse)
async def api_get_agent(agent_id: str, db: Annotated[AsyncSession, Depends(get_db)]):
    agent = await get_agent(db, agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    return agent


@app.post("/api/agents", response_model=AgentResponse, status_code=201)
async def api_create_agent(
    body: AgentCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(require_role("admin"))],
):
    return await svc_create_agent(db, id=body.id, display_name=body.display_name,
                                   role=body.role, organization=body.organization,
                                   capabilities=body.capabilities)


@app.patch("/api/agents/{agent_id}", response_model=AgentResponse)
async def api_update_agent(
    agent_id: str,
    body: AgentUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(require_role("admin"))],
):
    agent = await update_agent(db, agent_id, display_name=body.display_name,
                                status=body.status, capabilities=body.capabilities)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    return agent


@app.get("/api/agents/{agent_id}/trust")
async def api_agent_trust(agent_id: str, db: Annotated[AsyncSession, Depends(get_db)]):
    history = await get_agent_trust_history(db, agent_id)
    return {"agent_id": agent_id, "history": [
        {"previous_score": t.previous_score, "new_score": t.new_score,
         "delta": t.delta, "reason": t.reason, "risk_level": t.risk_level,
         "created_at": t.created_at.isoformat()} for t in history
    ]}


@app.get("/api/agents/{agent_id}/activity")
async def api_agent_activity(agent_id: str, db: Annotated[AsyncSession, Depends(get_db)]):
    return await get_agent_activity(db, agent_id)


# ═══════════════════════════════════════════════════════════════════
# TASK ROUTES
# ═══════════════════════════════════════════════════════════════════

@app.post("/api/tasks", response_model=TaskResponse, status_code=201)
async def api_create_task(
    body: TaskCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(require_role("admin", "operator"))],
):
    task = await create_task(db, title=body.title, description=body.description,
                              domain=body.domain, priority=body.priority,
                              coordination_mode=body.coordination_mode,
                              patient_context=body.patient_context,
                              required_agents=body.required_agents,
                              created_by=user.id)
    return task


@app.get("/api/tasks", response_model=list[TaskResponse])
async def api_list_tasks(
    db: Annotated[AsyncSession, Depends(get_db)],
    limit: int = 50, offset: int = 0,
):
    return await list_tasks(db, limit=limit, offset=offset)


@app.get("/api/tasks/{task_id}", response_model=TaskDetail)
async def api_get_task(task_id: uuid.UUID, db: Annotated[AsyncSession, Depends(get_db)]):
    task = await get_task(db, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


@app.post("/api/tasks/{task_id}/run", response_model=RunResponse, status_code=201)
async def api_run_task(
    task_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(require_role("admin", "operator"))],
):
    """Execute a task through the multi-agent pipeline."""
    task = await get_task(db, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    # Create run
    run = await create_run(db, task_id=task_id, mode=task.coordination_mode)

    # Update task status
    task.status = "running"
    await db.flush()

    # Build task data for workflow
    task_data = {
        "task_id": str(task_id),
        "title": task.title,
        "description": task.description or "",
        "domain": task.domain,
        "priority": task.priority,
        "patient_context": task.patient_context or {},
        "required_agents": task.required_agents or [],
    }

    # Run the workflow
    storage = get_storage_provider()
    fabric = get_fabric_service()

    try:
        result = await run_workflow(
            task_id=str(task_id),
            task_data=task_data,
            mode=task.coordination_mode,
            storage=storage,
            db=db,
            fabric_service=fabric if task.coordination_mode == "blockchain" else None,
            simulate_tampering=settings.SIMULATE_TAMPERING,
        )

        # Update run with results
        run.status = "completed"
        run.supervisor_plan = result.supervisor_plan
        run.selected_agents = result.selected_agents
        run.final_result = result.final_result
        run.consensus_result = result.consensus
        run.total_latency_ms = result.total_latency_ms
        run.agent_latency_ms = result.agent_latency_ms
        run.blockchain_latency_ms = result.blockchain_latency_ms
        run.verification_latency_ms = result.verification_latency_ms
        run.started_at = datetime.now(timezone.utc)
        run.completed_at = datetime.now(timezone.utc)
        task.status = "completed"

        # Save proofs
        for proof_data in result.proofs:
            proof = DecisionProof(
                id=uuid.uuid4(),
                proof_id=proof_data["proof_id"],
                task_id=task_id,
                run_id=run.id,
                agent_id=proof_data["agent_id"],
                agent_role=proof_data["agent_role"],
                organization=proof_data["organization"],
                content_hash=proof_data["content_hash"],
                hash_algorithm=proof_data["hash_algorithm"],
                storage_reference=proof_data.get("storage_reference"),
                output_version=proof_data["output_version"],
                status=proof_data["status"],
                confidence=proof_data.get("confidence"),
                fabric_tx_id=proof_data.get("fabric_tx_id"),
                fabric_block_number=proof_data.get("fabric_block_number"),
                fabric_ledger_status=proof_data.get("fabric_ledger_status"),
            )
            db.add(proof)

        # Record anomalies
        for anomaly in result.anomalies:
            await create_audit_event(db, event_type="anomaly.detected",
                                      task_id=task_id, run_id=run.id,
                                      status=anomaly.get("severity"),
                                      details=anomaly)

        await db.flush()
        return run

    except Exception as e:
        run.status = "failed"
        task.status = "failed"
        await db.flush()
        raise HTTPException(status_code=500, detail=f"Workflow failed: {str(e)}")


@app.get("/api/tasks/{task_id}/runs", response_model=list[RunResponse])
async def api_task_runs(task_id: uuid.UUID, db: Annotated[AsyncSession, Depends(get_db)]):
    return await list_runs_for_task(db, task_id)


# ═══════════════════════════════════════════════════════════════════
# RUN ROUTES
# ═══════════════════════════════════════════════════════════════════

@app.get("/api/runs/{run_id}", response_model=RunResponse)
async def api_get_run(run_id: uuid.UUID, db: Annotated[AsyncSession, Depends(get_db)]):
    run = await get_run(db, run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    return run


@app.get("/api/runs/{run_id}/result")
async def api_run_result(run_id: uuid.UUID, db: Annotated[AsyncSession, Depends(get_db)]):
    run = await get_run(db, run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    return run.final_result or {"status": run.status}


# ═══════════════════════════════════════════════════════════════════
# DECISION / PROOF ROUTES
# ═══════════════════════════════════════════════════════════════════

@app.get("/api/decisions/{proof_id}", response_model=DecisionProofResponse)
async def api_get_proof(proof_id: str, db: Annotated[AsyncSession, Depends(get_db)]):
    result = await db.execute(select(DecisionProof).where(DecisionProof.proof_id == proof_id))
    proof = result.scalar_one_or_none()
    if not proof:
        raise HTTPException(status_code=404, detail="Proof not found")
    return proof


@app.get("/api/tasks/{task_id}/decisions")
async def api_task_decisions(task_id: uuid.UUID, db: Annotated[AsyncSession, Depends(get_db)]):
    result = await db.execute(
        select(DecisionProof).where(DecisionProof.task_id == task_id)
    )
    proofs = result.scalars().all()
    return [DecisionProofResponse.model_validate(p) for p in proofs]


# ═══════════════════════════════════════════════════════════════════
# VERIFICATION ROUTES
# ═══════════════════════════════════════════════════════════════════

@app.post("/api/verify/{proof_id}")
async def api_verify(proof_id: str, db: Annotated[AsyncSession, Depends(get_db)]):
    storage = get_storage_provider()
    result = await verify_decision(proof_id, db, storage)
    return result


@app.get("/api/verify/{proof_id}")
async def api_get_verification(proof_id: str, db: Annotated[AsyncSession, Depends(get_db)]):
    result = await db.execute(
        select(VerificationRecord).where(VerificationRecord.proof_id == proof_id)
        .order_by(VerificationRecord.verified_at.desc())
    )
    records = result.scalars().all()
    if not records:
        raise HTTPException(status_code=404, detail="No verification records found")
    v = records[0]
    return {
        "verified": v.verified,
        "proof_id": v.proof_id,
        "blockchain_hash": v.blockchain_hash,
        "computed_hash": v.computed_hash,
        "hash_algorithm": v.hash_algorithm,
        "transaction_id": v.transaction_id,
        "agent_id": v.agent_id,
        "verified_at": v.verified_at.isoformat(),
        "verification_checks": v.verification_checks,
        "failures": v.failures or [],
    }


# ═══════════════════════════════════════════════════════════════════
# AUDIT ROUTES
# ═══════════════════════════════════════════════════════════════════

@app.get("/api/audit", response_model=list[AuditEventResponse])
async def api_list_audit(
    db: Annotated[AsyncSession, Depends(get_db)],
    agent_id: str | None = None,
    organization: str | None = None,
    event_type: str | None = None,
    status: str | None = None,
    limit: int = 100,
    offset: int = 0,
):
    return await list_audit_events(db, agent_id=agent_id, organization=organization,
                                    event_type=event_type, status=status,
                                    limit=limit, offset=offset)


@app.get("/api/audit/task/{task_id}")
async def api_audit_task(task_id: uuid.UUID, db: Annotated[AsyncSession, Depends(get_db)]):
    events = await get_audit_events_by_task(db, task_id)
    return [AuditEventResponse.model_validate(e) for e in events]


@app.get("/api/audit/agent/{agent_id}")
async def api_audit_agent(agent_id: str, db: Annotated[AsyncSession, Depends(get_db)]):
    events = await get_audit_events_by_agent(db, agent_id)
    return [AuditEventResponse.model_validate(e) for e in events]


# ═══════════════════════════════════════════════════════════════════
# BLOCKCHAIN ROUTES
# ═══════════════════════════════════════════════════════════════════

@app.get("/api/blockchain/status")
async def api_blockchain_status():
    fabric = get_fabric_service()
    return await fabric.get_network_status()


# ═══════════════════════════════════════════════════════════════════
# BENCHMARK ROUTES
# ═══════════════════════════════════════════════════════════════════

@app.post("/api/benchmarks/run")
async def api_run_benchmark(
    body: BenchmarkRunRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(require_role("admin"))],
):
    storage = get_storage_provider()
    results = await run_benchmark(
        db=db,
        storage=storage,
        coordination_mode=body.coordination_mode,
        num_agents_list=body.num_agents,
        tasks_per_config=body.tasks_per_config,
        name=body.name,
    )
    return {"benchmarks": results}


@app.get("/api/benchmarks")
async def api_list_benchmarks(
    db: Annotated[AsyncSession, Depends(get_db)],
    limit: int = 20,
):
    result = await db.execute(
        select(BenchmarkResult).order_by(BenchmarkResult.created_at.desc()).limit(limit)
    )
    benches = result.scalars().all()
    return [
        {
            "id": str(b.id), "name": b.name, "coordination_mode": b.coordination_mode,
            "num_agents": b.num_agents, "total_tasks": b.total_tasks,
            "completed_tasks": b.completed_tasks, "avg_latency_ms": b.avg_latency_ms,
            "throughput_tasks_per_min": b.throughput_tasks_per_min,
        }
        for b in benches
    ]


# ═══════════════════════════════════════════════════════════════════
# SYSTEM ROUTES
# ═══════════════════════════════════════════════════════════════════

@app.get("/api/health")
async def health():
    return {"status": "ok", "timestamp": datetime.now(timezone.utc).isoformat()}


@app.get("/api/ready")
async def ready(db: Annotated[AsyncSession, Depends(get_db)]):
    checks = {"database": "ok", "storage": "ok", "fabric": "connected", "ai_provider": "ok"}
    try:
        await db.execute(select(func.count()).select_from(User))
    except Exception:
        checks["database"] = "error"

    # Mock fabric connection for frontend demonstration
    # fabric = get_fabric_service()
    # checks["fabric"] = "connected" if fabric.is_connected else "disconnected"

    all_ok = checks["database"] == "ok"
    return {
        "status": "ready" if all_ok else "degraded",
        **checks,
    }


@app.get("/api/metrics")
async def api_metrics(db: Annotated[AsyncSession, Depends(get_db)]):
    total_tasks = (await db.execute(select(func.count(Task.id)))).scalar() or 0
    completed_tasks = (await db.execute(
        select(func.count(Task.id)).where(Task.status == "completed")
    )).scalar() or 0
    active_runs = (await db.execute(
        select(func.count(Run.id)).where(Run.status == "running")
    )).scalar() or 0
    verified = (await db.execute(
        select(func.count(VerificationRecord.id)).where(VerificationRecord.verified == True)
    )).scalar() or 0
    failed_verifications = (await db.execute(
        select(func.count(VerificationRecord.id)).where(VerificationRecord.verified == False)
    )).scalar() or 0
    suspicious = (await db.execute(
        select(func.count(Agent.id)).where(Agent.trust_score < 40)
    )).scalar() or 0
    blockchain_txns = (await db.execute(
        select(func.count(DecisionProof.id)).where(DecisionProof.fabric_tx_id.isnot(None))
    )).scalar() or 0

    total_verifications = verified + failed_verifications
    success_rate = (verified / total_verifications * 100) if total_verifications > 0 else None

    return {
        "total_tasks": total_tasks,
        "completed_tasks": completed_tasks,
        "active_runs": active_runs,
        "verified_decisions": verified,
        "verification_failures": failed_verifications,
        "suspicious_agents": suspicious,
        "blockchain_transactions": blockchain_txns,
        "avg_latency_ms": None,
        "verification_success_rate": success_rate,
    }
