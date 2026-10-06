"""Pydantic v2 schemas for all API request/response models."""

import uuid
from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field, EmailStr


# ─── Auth ───────────────────────────────────────────────────────────
class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str


class UserResponse(BaseModel):
    id: uuid.UUID
    username: str
    email: str
    role: str
    is_active: bool
    created_at: datetime


# ─── Agents ─────────────────────────────────────────────────────────
class AgentCreate(BaseModel):
    id: str = Field(..., min_length=3, max_length=100)
    display_name: str = Field(..., min_length=1, max_length=200)
    role: str
    organization: str = "Org1MSP"
    capabilities: list[str] = []


class AgentUpdate(BaseModel):
    display_name: str | None = None
    status: Literal["active", "inactive", "suspended"] | None = None
    capabilities: list[str] | None = None


class AgentResponse(BaseModel):
    id: str
    display_name: str
    role: str
    organization: str
    status: str
    trust_score: float
    capabilities: list[str]
    created_at: datetime
    last_seen_at: datetime | None
    total_decisions: int
    verification_successes: int
    anomalies_detected: int
    unauthorized_attempts: int

    model_config = {"from_attributes": True}


class AgentIdentityResponse(BaseModel):
    agent_id: str
    fabric_enrollment_id: str
    fabric_msp_id: str
    fabric_organization: str
    role_attribute: str | None
    is_active: bool
    enrolled_at: datetime


class TrustHistoryEntry(BaseModel):
    previous_score: float
    new_score: float
    delta: float
    reason: str
    risk_level: str
    created_at: datetime


class AgentActivity(BaseModel):
    agent_id: str
    recent_decisions: int
    recent_anomalies: int
    last_active: datetime | None


# ─── Tasks ──────────────────────────────────────────────────────────
class TaskCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=500)
    description: str | None = None
    domain: str = "healthcare"
    priority: Literal["low", "medium", "high", "critical"] = "medium"
    coordination_mode: Literal["centralized", "blockchain"] = "blockchain"
    patient_context: dict[str, Any] | None = None
    required_agents: list[str] = []
    timeout_seconds: int | None = None
    min_consensus_threshold: float | None = None
    required_verification_level: str | None = None


class TaskResponse(BaseModel):
    id: uuid.UUID
    title: str
    description: str | None
    domain: str
    priority: str
    coordination_mode: str
    status: str
    required_agents: list[str]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class TaskDetail(TaskResponse):
    patient_context: dict[str, Any] | None
    timeout_seconds: int | None
    min_consensus_threshold: float | None
    required_verification_level: str | None


# ─── Runs ───────────────────────────────────────────────────────────
class RunResponse(BaseModel):
    id: uuid.UUID
    task_id: uuid.UUID
    mode: str
    status: str
    selected_agents: list[str]
    supervisor_plan: dict[str, Any] | None
    final_result: dict[str, Any] | None
    consensus_result: dict[str, Any] | None
    total_latency_ms: float | None
    agent_latency_ms: float | None
    blockchain_latency_ms: float | None
    verification_latency_ms: float | None
    started_at: datetime | None
    completed_at: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}


class RunTimelineEntry(BaseModel):
    timestamp: datetime
    event: str
    agent_id: str | None = None
    details: dict[str, Any] | None = None


# ─── Agent Outputs ──────────────────────────────────────────────────
class AgentOutputResponse(BaseModel):
    id: uuid.UUID
    execution_id: uuid.UUID
    agent_id: str
    output_data: dict[str, Any]
    output_schema_version: str
    created_at: datetime

    model_config = {"from_attributes": True}


# ─── Decision Proofs ────────────────────────────────────────────────
class DecisionProofResponse(BaseModel):
    id: uuid.UUID
    proof_id: str
    task_id: uuid.UUID
    run_id: uuid.UUID
    agent_id: str
    agent_role: str
    organization: str
    content_hash: str
    hash_algorithm: str
    storage_reference: str | None
    output_version: int
    status: str
    confidence: float | None
    fabric_tx_id: str | None
    fabric_block_number: int | None
    fabric_ledger_status: str | None
    submitted_at: datetime
    verified_at: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}


# ─── Verification ───────────────────────────────────────────────────
class VerificationRequest(BaseModel):
    proof_id: str


class VerificationResponse(BaseModel):
    verified: bool
    proof_id: str
    blockchain_hash: str | None
    computed_hash: str | None
    hash_algorithm: str
    transaction_id: str | None
    agent_id: str | None
    verified_at: datetime
    verification_checks: dict[str, bool] | None
    failures: list[str]


# ─── Audit ──────────────────────────────────────────────────────────
class AuditEventResponse(BaseModel):
    id: uuid.UUID
    event_type: str
    agent_id: str | None
    organization: str | None
    task_id: uuid.UUID | None
    run_id: uuid.UUID | None
    proof_id: str | None
    transaction_id: str | None
    status: str | None
    details: dict[str, Any] | None
    timestamp: datetime

    model_config = {"from_attributes": True}


# ─── Blockchain ─────────────────────────────────────────────────────
class BlockchainStatus(BaseModel):
    connected: bool
    network: str
    channel: str
    chaincode: str
    organizations: list[str]
    peer_count: int
    transaction_count: int | None


class BlockchainTransaction(BaseModel):
    tx_id: str
    block_number: int | None
    timestamp: datetime | None
    agent_id: str | None
    function: str | None
    status: str | None


# ─── Benchmarks ─────────────────────────────────────────────────────
class BenchmarkRunRequest(BaseModel):
    coordination_mode: Literal["centralized", "blockchain"] | None = None
    num_agents: list[int] = [1, 2, 4]
    tasks_per_config: int = 5
    name: str | None = None


class BenchmarkResultResponse(BaseModel):
    id: uuid.UUID
    name: str | None
    coordination_mode: str
    num_agents: int
    total_tasks: int
    completed_tasks: int
    failed_tasks: int
    avg_latency_ms: float | None
    min_latency_ms: float | None
    max_latency_ms: float | None
    p50_latency_ms: float | None
    p95_latency_ms: float | None
    p99_latency_ms: float | None
    throughput_tasks_per_min: float | None
    avg_agent_latency_ms: float | None
    avg_blockchain_latency_ms: float | None
    avg_verification_latency_ms: float | None
    started_at: datetime | None
    completed_at: datetime | None

    model_config = {"from_attributes": True}


# ─── System ─────────────────────────────────────────────────────────
class HealthResponse(BaseModel):
    status: str
    timestamp: datetime


class ReadyResponse(BaseModel):
    status: str
    database: str
    storage: str
    fabric: str
    ai_provider: str


class MetricsResponse(BaseModel):
    total_tasks: int
    completed_tasks: int
    active_runs: int
    verified_decisions: int
    verification_failures: int
    suspicious_agents: int
    blockchain_transactions: int
    avg_latency_ms: float | None
    verification_success_rate: float | None


# ─── Error ──────────────────────────────────────────────────────────
class ErrorResponse(BaseModel):
    success: bool = False
    error: dict[str, str]
    request_id: str | None = None


# --- Consensus ---
class ConsensusResult(BaseModel):
    agreement_score: float
    threshold: float
    status: Literal["accepted", "warning", "rejected"]
    agent_scores: dict[str, float]
    contradictions: list[str]
    final_decision: dict[str, Any] | None
