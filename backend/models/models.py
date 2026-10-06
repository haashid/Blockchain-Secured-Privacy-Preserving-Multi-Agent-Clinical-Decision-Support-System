"""SQLAlchemy ORM models for all database entities."""

import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy import JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from backend.core.database import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def gen_uuid() -> uuid.UUID:
    return uuid.uuid4()


# ─── Users ──────────────────────────────────────────────────────────
class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=gen_uuid)
    username = Column(String(100), unique=True, nullable=False, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    role = Column(
        Enum("admin", "operator", "auditor", "viewer", "doctor", "patient", name="user_role"),
        nullable=False,
        default="viewer",
    )
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False)

    tasks = relationship("Task", back_populates="user", lazy="selectin")


# ─── Agents ─────────────────────────────────────────────────────────
class Agent(Base):
    __tablename__ = "agents"

    id = Column(String(100), primary_key=True)  # e.g. "agent-clinical-reasoning-01"
    display_name = Column(String(200), nullable=False)
    role = Column(
        Enum(
            "supervisor",
            "planner",
            "router",
            "clinical_reasoning",
            "history",
            "laboratory",
            "medication",
            "risk",
            "evidence",
            "critic",
            "verifier",
            "synthesizer",
            name="agent_role",
        ),
        nullable=False,
        index=True,
    )
    organization = Column(String(100), nullable=False, default="Org1MSP")
    status = Column(
        Enum("active", "inactive", "suspended", "error", name="agent_status"),
        nullable=False,
        default="active",
    )
    trust_score = Column(Float, nullable=False, default=100.0)
    capabilities = Column(JSON, default=list, nullable=False)
    system_instructions = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    last_seen_at = Column(DateTime(timezone=True), nullable=True)
    total_decisions = Column(Integer, default=0, nullable=False)
    verification_successes = Column(Integer, default=0, nullable=False)
    anomalies_detected = Column(Integer, default=0, nullable=False)
    unauthorized_attempts = Column(Integer, default=0, nullable=False)

    identity = relationship("AgentIdentity", back_populates="agent", uselist=False, lazy="selectin")
    outputs = relationship("AgentOutput", back_populates="agent", lazy="selectin")
    trust_history = relationship("TrustScore", back_populates="agent", lazy="selectin")


# ─── Agent Identities (Fabric mapping & DID) ────────────────────────
class AgentIdentity(Base):
    __tablename__ = "agent_identities"

    id = Column(UUID(as_uuid=True), primary_key=True, default=gen_uuid)
    agent_id = Column(String(100), ForeignKey("agents.id"), unique=True, nullable=False, index=True)
    fabric_enrollment_id = Column(String(200), nullable=False)
    fabric_msp_id = Column(String(100), nullable=False)
    fabric_organization = Column(String(100), nullable=False)
    certificate_path = Column(String(500), nullable=True)
    key_path = Column(String(500), nullable=True)
    role_attribute = Column(String(100), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    
    # DID and VC fields
    did = Column(String(255), unique=True, nullable=True, index=True)
    credential_jwt = Column(Text, nullable=True)
    sbt_tx_id = Column(String(200), nullable=True)
    private_key_pem = Column(Text, nullable=True)
    
    enrolled_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)

    agent = relationship("Agent", back_populates="identity")


# ─── Tasks ──────────────────────────────────────────────────────────
class Task(Base):
    __tablename__ = "tasks"

    id = Column(UUID(as_uuid=True), primary_key=True, default=gen_uuid)
    title = Column(String(500), nullable=False)
    description = Column(Text, nullable=True)
    domain = Column(String(100), nullable=False, default="healthcare")
    priority = Column(
        Enum("low", "medium", "high", "critical", name="task_priority"),
        nullable=False,
        default="medium",
    )
    coordination_mode = Column(
        Enum("centralized", "blockchain", name="coordination_mode"),
        nullable=False,
        default="blockchain",
    )
    patient_context = Column(JSON, nullable=True)
    required_agents = Column(JSON, default=list, nullable=False)
    timeout_seconds = Column(Integer, nullable=True)
    min_consensus_threshold = Column(Float, nullable=True)
    required_verification_level = Column(String(50), nullable=True)
    status = Column(
        Enum("pending", "running", "completed", "failed", "cancelled", name="task_status"),
        nullable=False,
        default="pending",
    )
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False)

    user = relationship("User", back_populates="tasks", lazy="selectin")
    runs = relationship("Run", back_populates="task", lazy="selectin")
    proofs = relationship("DecisionProof", back_populates="task", lazy="selectin")


# ─── Runs ───────────────────────────────────────────────────────────
class Run(Base):
    __tablename__ = "runs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=gen_uuid)
    task_id = Column(UUID(as_uuid=True), ForeignKey("tasks.id"), nullable=False, index=True)
    mode = Column(
        Enum("centralized", "blockchain", name="run_mode"),
        nullable=False,
        default="blockchain",
    )
    status = Column(
        Enum(
            "pending", "running", "completed", "failed", "timeout", name="run_status"
        ),
        nullable=False,
        default="pending",
    )
    supervisor_plan = Column(JSON, nullable=True)
    selected_agents = Column(JSON, default=list, nullable=False)
    final_result = Column(JSON, nullable=True)
    consensus_result = Column(JSON, nullable=True)
    total_latency_ms = Column(Float, nullable=True)
    agent_latency_ms = Column(Float, nullable=True)
    blockchain_latency_ms = Column(Float, nullable=True)
    verification_latency_ms = Column(Float, nullable=True)
    started_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)

    task = relationship("Task", back_populates="runs", lazy="selectin")
    executions = relationship("AgentExecution", back_populates="run", lazy="selectin")


# ─── Agent Executions ───────────────────────────────────────────────
class AgentExecution(Base):
    __tablename__ = "agent_executions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=gen_uuid)
    run_id = Column(UUID(as_uuid=True), ForeignKey("runs.id"), nullable=False, index=True)
    agent_id = Column(String(100), ForeignKey("agents.id"), nullable=False, index=True)
    status = Column(
        Enum("pending", "running", "completed", "failed", "timeout", name="exec_status"),
        nullable=False,
        default="pending",
    )
    started_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    latency_ms = Column(Float, nullable=True)
    error_message = Column(Text, nullable=True)
    sequence_order = Column(Integer, nullable=False, default=0)

    run = relationship("Run", back_populates="executions", lazy="selectin")
    output = relationship("AgentOutput", back_populates="execution", uselist=False, lazy="selectin")


# ─── Agent Outputs ──────────────────────────────


# Agent Outputs
class AgentOutput(Base):
    __tablename__ = "agent_outputs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=gen_uuid)
    execution_id = Column(UUID(as_uuid=True), ForeignKey("agent_executions.id"), unique=True, nullable=False)
    agent_id = Column(String(100), ForeignKey("agents.id"), nullable=False, index=True)
    output_data = Column(JSON, nullable=False)
    output_schema_version = Column(String(20), nullable=False, default="1.0")
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)

    execution = relationship("AgentExecution", back_populates="output")
    agent = relationship("Agent", back_populates="outputs")


# Decision Proofs
class DecisionProof(Base):
    __tablename__ = "decision_proofs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=gen_uuid)
    proof_id = Column(String(200), unique=True, nullable=False, index=True)
    task_id = Column(UUID(as_uuid=True), ForeignKey("tasks.id"), nullable=False, index=True)
    run_id = Column(UUID(as_uuid=True), ForeignKey("runs.id"), nullable=False, index=True)
    agent_id = Column(String(100), ForeignKey("agents.id"), nullable=False, index=True)
    agent_role = Column(String(50), nullable=False)
    organization = Column(String(100), nullable=False)
    content_hash = Column(String(64), nullable=False)
    hash_algorithm = Column(String(20), nullable=False, default="SHA-256")
    storage_reference = Column(String(500), nullable=True)
    output_version = Column(Integer, nullable=False, default=1)
    status = Column(Enum("submitted", "verified", "invalid", "flagged", name="proof_status"), nullable=False, default="submitted")
    confidence = Column(Float, nullable=True)
    fabric_tx_id = Column(String(200), nullable=True)
    fabric_block_number = Column(Integer, nullable=True)
    fabric_ledger_status = Column(String(50), nullable=True)
    submitted_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    verified_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)

    task = relationship("Task", back_populates="proofs", lazy="selectin")
    verifications = relationship("VerificationRecord", back_populates="proof", lazy="selectin")


# Verification Records
class VerificationRecord(Base):
    __tablename__ = "verifications"

    id = Column(UUID(as_uuid=True), primary_key=True, default=gen_uuid)
    proof_id = Column(String(200), ForeignKey("decision_proofs.proof_id"), nullable=False, index=True)
    verified = Column(Boolean, nullable=False)
    blockchain_hash = Column(String(64), nullable=True)
    computed_hash = Column(String(64), nullable=True)
    hash_algorithm = Column(String(20), nullable=False, default="SHA-256")
    transaction_id = Column(String(200), nullable=True)
    agent_id = Column(String(100), nullable=True)
    verification_checks = Column(JSON, nullable=True)
    failures = Column(JSON, default=list, nullable=False)
    verified_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)

    proof = relationship("DecisionProof", back_populates="verifications", lazy="selectin")


# Audit Events
class AuditEvent(Base):
    __tablename__ = "audit_events"

    id = Column(UUID(as_uuid=True), primary_key=True, default=gen_uuid)
    event_type = Column(String(100), nullable=False, index=True)
    agent_id = Column(String(100), nullable=True, index=True)
    organization = Column(String(100), nullable=True)
    task_id = Column(UUID(as_uuid=True), nullable=True, index=True)
    run_id = Column(UUID(as_uuid=True), nullable=True)
    proof_id = Column(String(200), nullable=True)
    transaction_id = Column(String(200), nullable=True)
    status = Column(String(50), nullable=True)
    details = Column(JSON, nullable=True)
    timestamp = Column(DateTime(timezone=True), default=utcnow, nullable=False, index=True)


# Trust Scores
class TrustScore(Base):
    __tablename__ = "trust_scores"

    id = Column(UUID(as_uuid=True), primary_key=True, default=gen_uuid)
    agent_id = Column(String(100), ForeignKey("agents.id"), nullable=False, index=True)
    previous_score = Column(Float, nullable=False)
    new_score = Column(Float, nullable=False)
    delta = Column(Float, nullable=False)
    reason = Column(Text, nullable=False)
    risk_level = Column(Enum("trusted", "normal", "warning", "suspicious", "critical", name="risk_level"), nullable=False)
    audit_event_id = Column(UUID(as_uuid=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)

    agent = relationship("Agent", back_populates="trust_history", lazy="selectin")


# System Metrics
class SystemMetric(Base):
    __tablename__ = "system_metrics"

    id = Column(UUID(as_uuid=True), primary_key=True, default=gen_uuid)
    metric_name = Column(String(200), nullable=False, index=True)
    metric_value = Column(Float, nullable=False)
    metric_unit = Column(String(50), nullable=True)
    tags = Column(JSON, nullable=True)
    recorded_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)


# Benchmark Results
class BenchmarkResult(Base):
    __tablename__ = "benchmark_results"

    id = Column(UUID(as_uuid=True), primary_key=True, default=gen_uuid)
    name = Column(String(200), nullable=True)
    coordination_mode = Column(Enum("centralized", "blockchain", name="bench_mode"), nullable=False)
    num_agents = Column(Integer, nullable=False)
    total_tasks = Column(Integer, nullable=False)
    completed_tasks = Column(Integer, nullable=False, default=0)
    failed_tasks = Column(Integer, nullable=False, default=0)
    avg_latency_ms = Column(Float, nullable=True)
    min_latency_ms = Column(Float, nullable=True)
    max_latency_ms = Column(Float, nullable=True)
    p50_latency_ms = Column(Float, nullable=True)
    p95_latency_ms = Column(Float, nullable=True)
    p99_latency_ms = Column(Float, nullable=True)
    throughput_tasks_per_min = Column(Float, nullable=True)
    avg_agent_latency_ms = Column(Float, nullable=True)
    avg_blockchain_latency_ms = Column(Float, nullable=True)
    avg_verification_latency_ms = Column(Float, nullable=True)
    results_detail = Column(JSON, nullable=True)
    started_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)


# ─── Patient Consent Records ────────────────────────────────────────
class ConsentRecord(Base):
    """Persisted patient consent policy governing agent access to their record."""
    __tablename__ = "consent_records"

    id = Column(UUID(as_uuid=True), primary_key=True, default=gen_uuid)
    patient_id = Column(UUID(as_uuid=True), ForeignKey("patients.id"), unique=True, nullable=False, index=True)
    allowed_roles = Column(JSON, default=list, nullable=False)
    allowed_organizations = Column(JSON, default=list, nullable=False)
    emergency_breakglass = Column(Boolean, default=True, nullable=False)
    notes = Column(Text, nullable=True)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
