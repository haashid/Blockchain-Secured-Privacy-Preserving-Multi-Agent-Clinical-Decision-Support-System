"""Typed workflow state for the dynamic multi-agent orchestration engine.

Represents the complete current workflow state, including agent outputs,
execution trace, reasoning rounds, and revision tracking.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Literal


@dataclass
class AgentExecutionRecord:
    """Record of a single agent execution attempt."""
    agent_id: str
    role: str
    round: int
    attempt: int
    start_time: float = 0.0
    end_time: float = 0.0
    latency_ms: float = 0.0
    status: str = "pending"  # pending | running | completed | failed | timeout | skipped
    model: str = ""
    provider: str = ""
    error: str | None = None
    output: dict[str, Any] | None = None


@dataclass
class CriticDecision:
    """Structured output from the critic about whether re-analysis is needed."""
    requires_reanalysis: bool = False
    target_agents: list[str] = field(default_factory=list)
    issues: list[dict[str, Any]] = field(default_factory=list)
    contradictions: list[str] = field(default_factory=list)
    missing_evidence: list[str] = field(default_factory=list)
    severity: str = "low"
    confidence: float = 0.0


@dataclass
class ExecutionPlan:
    """Structured plan from the supervisor."""
    case_type: str = "clinical_case_review"
    complexity: str = "medium"
    selected_agents: list[str] = field(default_factory=list)
    parallel_groups: list[list[str]] = field(default_factory=list)
    verification_required: bool = True
    critic_required: bool = True
    max_reasoning_rounds: int = 3
    reasoning_summary: str = ""


@dataclass
class WorkflowState:
    """Complete state of a workflow execution.

    Tracks the full lifecycle: supervisor plan, parallel agent execution,
    critic review, re-analysis loops, verification, and synthesis.
    """
    task_id: str = ""
    run_id: str = ""
    task_data: dict[str, Any] = field(default_factory=dict)
    mode: str = "blockchain"

    # Supervisor plan
    execution_plan: ExecutionPlan = field(default_factory=ExecutionPlan)
    supervisor_output: dict[str, Any] = field(default_factory=dict)

    # Agent tracking
    agent_outputs: dict[str, dict[str, Any]] = field(default_factory=dict)
    agent_errors: dict[str, str] = field(default_factory=dict)
    execution_trace: list[AgentExecutionRecord] = field(default_factory=list)

    # Execution state
    current_round: int = 0
    max_reasoning_rounds: int = 3
    reasoning_rounds_used: int = 0
    workflow_status: str = "pending"  # pending | running | completed | failed | warning

    # Critic / revision
    critic_decision: CriticDecision | None = None
    revision_requests: int = 0

    # Verification & consensus
    verification_result: dict[str, Any] | None = None
    consensus_result: dict[str, Any] = field(default_factory=dict)
    proofs: list[dict[str, Any]] = field(default_factory=list)
    verifications: list[dict] = field(default_factory=list)
    anomalies: list[dict[str, Any]] = field(default_factory=list)

    # Final result
    final_result: dict[str, Any] = field(default_factory=dict)

    # Timestamps
    pipeline_start: float = 0.0
    pipeline_end: float = 0.0
    total_latency_ms: float = 0.0
    agent_latency_ms: float = 0.0
    blockchain_latency_ms: float = 0.0
    verification_latency_ms: float = 0.0

    # Timeline (backward-compatible with existing WorkflowResult)
    timeline: list[dict[str, Any]] = field(default_factory=list)

    def add_event(self, event: str, agent_id: str | None = None, details: dict | None = None):
        """Add a timeline event (backward-compatible with WorkflowResult)."""
        self.timeline.append({
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "event": event,
            "agent_id": agent_id,
            "details": details,
        })

    def get_agent_output(self, role: str) -> dict[str, Any] | None:
        """Get the latest output for an agent role."""
        return self.agent_outputs.get(role)

    def get_completed_roles(self) -> list[str]:
        """Get list of agent roles that have completed output."""
        return list(self.agent_outputs.keys())

    def has_agent_failed(self, role: str) -> bool:
        """Check if an agent role has a recorded error."""
        return role in self.agent_errors

    def get_executed_roles(self) -> list[str]:
        """Get all roles that have been attempted."""
        return [r.role for r in self.execution_trace]

    def get_revised_roles(self) -> list[str]:
        """Get roles that were executed more than once (revised)."""
        role_counts: dict[str, int] = {}
        for record in self.execution_trace:
            if record.status == "completed":
                role_counts[record.role] = role_counts.get(record.role, 0) + 1
        return [role for role, count in role_counts.items() if count > 1]


def create_default_plan(task_data: dict[str, Any]) -> ExecutionPlan:
    """Create a sensible default plan when supervisor output is invalid.

    Basic case: clinical_reasoning + risk + verifier + synthesizer
    Complex case: all specialists + critic + verifier + synthesizer
    """
    desc = task_data.get("description", "").lower()
    ctx = task_data.get("patient_context") or {}
    ctx_str = str(ctx).lower() if ctx else ""

    # Detect complexity from description + context
    complexity = "medium"
    if any(w in desc or w in ctx_str for w in ["severe", "critical", "emergency", "complex", "multiple"]):
        complexity = "high"
    if any(w in desc or w in ctx_str for w in ["simple", "routine", "follow-up", "mild"]):
        complexity = "low"

    if complexity == "low":
        selected = ["clinical_reasoning", "risk", "verifier", "synthesizer"]
    elif complexity == "high":
        selected = [
            "clinical_reasoning", "history", "laboratory", "medication",
            "risk", "evidence", "critic", "verifier", "synthesizer",
        ]
    else:
        selected = ["clinical_reasoning", "risk", "evidence", "verifier", "synthesizer"]

    return ExecutionPlan(
        case_type="clinical_case_review",
        complexity=complexity,
        selected_agents=selected,
        parallel_groups=[selected],  # All run in parallel
        verification_required=True,
        critic_required=complexity in ("high", "critical"),
        max_reasoning_rounds=3,
        reasoning_summary=f"Fallback plan: {complexity} complexity, {len(selected)} agents.",
    )


def parse_supervisor_plan(supervisor_output: dict[str, Any], task_data: dict[str, Any]) -> ExecutionPlan:
    """Parse supervisor output into a validated ExecutionPlan.

    Falls back to default plan if supervisor output is invalid.
    """
    from backend.agents.base import SupervisorOutput

    # Validate with Pydantic
    try:
        validated = SupervisorOutput.model_validate(supervisor_output)
    except Exception:
        # Invalid supervisor output → use default
        return create_default_plan(task_data)

    selected = validated.required_agents

    # Ensure required agents are present
    required_always = {"clinical_reasoning", "verifier", "synthesizer"}
    for r in required_always:
        if r not in selected:
            selected.append(r)

    # Validate all roles exist
    from backend.agents.base import AGENT_OUTPUT_TYPES
    valid_roles = set(AGENT_OUTPUT_TYPES.keys()) - {"supervisor"}
    selected = [r for r in selected if r in valid_roles]

    if not selected:
        return create_default_plan(task_data)

    # Build parallel groups from execution plan
    parallel_groups = []
    plan_data = validated.execution_plan or {}
    pg = plan_data.get("parallel_groups", [])
    if pg and isinstance(pg, list):
        for group in pg:
            if isinstance(group, list):
                parallel_groups.append([r for r in group if r in valid_roles])
    if not parallel_groups:
        parallel_groups = [selected]

    return ExecutionPlan(
        case_type=validated.case_type,
        complexity=validated.complexity,
        selected_agents=selected,
        parallel_groups=parallel_groups,
        verification_required=validated.verification_required,
        critic_required=validated.complexity in ("high", "critical") or "critic" in selected,
        max_reasoning_rounds=plan_data.get("max_reasoning_rounds", 3),
        reasoning_summary=validated.reasoning_summary,
    )
