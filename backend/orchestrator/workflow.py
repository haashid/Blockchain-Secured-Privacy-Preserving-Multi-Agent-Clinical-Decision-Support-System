"""Dynamic multi-agent workflow orchestration engine.

Replaces the static sequential pipeline with a dynamic system:
- Supervisor creates a structured plan
- Independent agents execute concurrently (bounded)
- Critic can request targeted re-analysis
- Verification and synthesis run after all agents complete
- Full execution trace and observability
"""

from __future__ import annotations

import asyncio
import json
import time
import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from backend.agents.factory import create_agents_for_roles, create_agent
from backend.agents.base import BaseAgent, AGENT_OUTPUT_TYPES
from backend.core.config import get_settings
from backend.core.logging_config import get_logger
from backend.crypto.canonical_json import canonical_json
from backend.crypto.hashing import compute_sha256
from backend.crypto.encryption import encrypt_json, decrypt_json
from backend.storage.base import StorageProvider
from backend.schemas.schemas import RunTimelineEntry
from backend.orchestrator.state import (
    WorkflowState,
    AgentExecutionRecord,
    CriticDecision,
    ExecutionPlan,
    create_default_plan,
    parse_supervisor_plan,
)
from backend.identity.context_builders import build_minimum_necessary_context
from backend.identity.authorization import authorize_agent, AuthorizationError
from backend.identity.consent import evaluate_consent, ConsentError

logger = get_logger("orchestrator")
settings = get_settings()

# Valid specialist roles (excludes supervisor, critic, verifier, synthesizer)
_SPECIALIST_ROLES = {"clinical_reasoning", "history", "laboratory", "medication", "risk", "evidence"}
# Non-specialist sequential roles
_SEQUENTIAL_ROLES = {"critic", "verifier", "synthesizer"}


class WorkflowResult:
    """Backward-compatible result object. Wraps WorkflowState for downstream consumers."""

    def __init__(self, state: WorkflowState | None = None):
        self._state = state or WorkflowState()

    # Direct attribute access for backward compatibility
    @property
    def task_id(self) -> str:
        return self._state.task_id

    @property
    def run_id(self) -> str:
        return self._state.run_id

    @property
    def supervisor_plan(self) -> dict[str, Any]:
        return self._state.supervisor_output

    @property
    def selected_agents(self) -> list[str]:
        return self._state.execution_plan.selected_agents

    @property
    def agent_outputs(self) -> dict[str, dict]:
        return self._state.agent_outputs

    @property
    def proofs(self) -> list[dict[str, Any]]:
        return self._state.proofs

    @property
    def verifications(self) -> list[dict]:
        return self._state.verifications

    @property
    def anomalies(self) -> list[dict]:
        return self._state.anomalies

    @property
    def agent_errors(self) -> dict[str, str]:
        return self._state.agent_errors

    @property
    def consensus(self) -> dict[str, Any]:
        return self._state.consensus_result

    @property
    def final_result(self) -> dict[str, Any]:
        return self._state.final_result

    @property
    def timeline(self) -> list[dict[str, Any]]:
        return self._state.timeline

    @property
    def total_latency_ms(self) -> float:
        return self._state.total_latency_ms

    @property
    def agent_latency_ms(self) -> float:
        return self._state.agent_latency_ms

    @property
    def blockchain_latency_ms(self) -> float:
        return self._state.blockchain_latency_ms

    @property
    def verification_latency_ms(self) -> float:
        return self._state.verification_latency_ms

    def add_event(self, event: str, agent_id: str | None = None, details: dict | None = None):
        self._state.add_event(event, agent_id, details)


# ─── Agent Context Builder ─────────────────────────────────────────

def build_agent_context(
    state: WorkflowState,
    agent_role: str,
    additional_context: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Build role-specific context for an agent.

    Each agent receives only the information relevant to its role,
    rather than the full patient context blob.
    """
    task = state.task_data
    ctx: dict[str, Any] = {
        "title": task.get("title", "Unknown Case"),
        "description": task.get("description", ""),
    }

    patient = task.get("patient_context") or {}

    # Phase 5: Minimum-necessary context using capability authorization
    # For now, we pull the capabilities from the agent class (in reality, from verified JWT VC)
    # The agent_role is known. We will load the capabilities if available, or fall back to defaults.
    
    # We must fetch the actual agent's capabilities.
    # Since we only have the role in this function, we'll map role to standard capabilities.
    # Alternatively, we can pass the agent to build_agent_context, but let's just mock the DID and capabilities here for the prototype.
    agent_did = f"did:key:z{agent_role}"
    agent_capabilities = {
        "supervisor": ["task_classification", "agent_selection"],
        "planner": ["execution_planning"],
        "router": ["task_dispatch"],
        "clinical_reasoning": ["symptom_analysis", "differential_diagnosis"],
        "history": ["longitudinal_analysis", "allergy_review"],
        "laboratory": ["lab_analysis", "abnormality_detection"],
        "medication": ["interaction_check", "allergy_check"],
        "risk": ["risk_assessment", "urgency_scoring"],
        "evidence": ["literature_search", "guideline_retrieval"],
        "critic": ["adversarial_review", "contradiction_detection"],
        "verifier": ["integrity_check", "cross_agent_agreement"],
        "synthesizer": ["report_generation", "decision_support"]
    }.get(agent_role, [])
    
    agent_org = "Org1MSP" if agent_role != "verifier" else "Org2MSP" # Mock org assignment
    urgency = state.execution_plan.complexity if state.execution_plan else "medium" # Use plan complexity as proxy for urgency, or extract real urgency
    
    # Phase 6: Enforce Patient Consent
    consent_policy = task.get("consent_policy")
    try:
        # Evaluate consent (handles emergency breakglass if urgency == "critical")
        evaluate_consent(consent_policy, agent_role, agent_org, urgency)
        
        if patient:
            # Prevent unrestricted patient-record access by enforcing capability checks per section
            try:
                filtered_patient_context = build_minimum_necessary_context(
                    task=task,
                    full_patient_context=patient,
                    agent_did=agent_did,
                    agent_role=agent_role,
                    agent_capabilities=agent_capabilities
                )
                ctx["patient_context"] = filtered_patient_context
            except Exception as e:
                logger.error(f"Context building failed for {agent_role}: {e}")
                ctx["patient_context"] = {}
                
    except ConsentError as ce:
        logger.warning(f"Consent denied for {agent_role}: {ce}")
        state.add_event("consent.denied", agent_id=agent_role, details={"error": str(ce)})
        # If consent is denied, they get NO patient context
        ctx["patient_context"] = {}
        
    # Previous outputs for dependent agents
    previous = {}
    if agent_role in ("critic", "verifier", "synthesizer"):
        # These agents need outputs from completed specialists
        for role in state.get_completed_roles():
            if role != agent_role and state.agent_outputs.get(role):
                previous[role] = state.agent_outputs[role]
        ctx["previous_outputs"] = previous
    elif agent_role in ("risk", "evidence"):
        # Risk and Evidence benefit from clinical reasoning output
        cr_output = state.get_agent_output("clinical_reasoning")
        if cr_output:
            previous["clinical_reasoning"] = cr_output
        ctx["previous_outputs"] = previous

    # For re-analysis rounds, include critic feedback
    if additional_context and additional_context.get("critic_feedback"):
        ctx["previous_outputs"] = ctx.get("previous_outputs", {})
        ctx["previous_outputs"]["critic_findings"] = additional_context["critic_feedback"]

    if additional_context and additional_context.get("revision_context"):
        ctx["previous_outputs"] = ctx.get("previous_outputs", {})
        for k, v in additional_context["revision_context"].items():
            ctx["previous_outputs"][k] = v

    return ctx


# ─── Single Agent Executor ─────────────────────────────────────────

async def _execute_agent_with_retry(
    agent: BaseAgent,
    task: dict[str, Any],
    context: dict[str, Any] | None,
    state: WorkflowState,
    max_retries: int | None = None,
    timeout: float | None = None,
) -> dict[str, Any]:
    """Execute a single agent with bounded retries and timeout.

    Returns agent output dict or raises RuntimeError.
    """
    if max_retries is None:
        max_retries = settings.MAX_AGENT_RETRIES
    if timeout is None:
        timeout = settings.AGENT_TIMEOUT_SECONDS

    record = AgentExecutionRecord(
        agent_id=agent.agent_id,
        role=agent.role,
        round=state.current_round,
        attempt=0,
        start_time=time.monotonic(),
        provider="groq" if agent.mode in ("groq", "llm") else "mock",
        model=agent.config.get("model", agent.mode),
    )
    state.execution_trace.append(record)

    for attempt in range(1, max_retries + 1):
        record.attempt = attempt
        record.status = "running"
        state.add_event("agent.started", agent_id=agent.agent_id,
                        details={"round": state.current_round, "attempt": attempt})

        try:
            result = await asyncio.wait_for(
                agent.execute(task, context),
                timeout=timeout,
            )
            record.end_time = time.monotonic()
            record.latency_ms = (record.end_time - record.start_time) * 1000
            record.status = "completed"
            record.output = result

            state.add_event("agent.completed", agent_id=agent.agent_id,
                            details={"confidence": result.get("confidence", 0),
                                     "round": state.current_round,
                                     "latency_ms": round(record.latency_ms, 2)})

            return result

        except asyncio.TimeoutError:
            record.end_time = time.monotonic()
            record.latency_ms = (record.end_time - record.start_time) * 1000
            record.status = "timeout"
            record.error = f"Agent timed out after {timeout}s"
            logger.warning("agent_timeout", agent_id=agent.agent_id, timeout=timeout, attempt=attempt)

            # Timeout is retryable
            if attempt < max_retries:
                continue
            break

        except Exception as e:
            record.end_time = time.monotonic()
            record.latency_ms = (record.end_time - record.start_time) * 1000
            error_str = str(e)
            record.error = error_str[:300]

            # Check if error is retryable (auth errors are not)
            error_lower = error_str.lower()
            is_permanent = any(kw in error_lower for kw in [
                "authentication", "unauthorized", "forbidden",
                "invalid api key", "permission denied",
            ])

            if is_permanent:
                record.status = "failed"
                break

            record.status = "failed"
            if attempt < max_retries:
                record.status = "retrying"
                logger.info("agent_retry", agent_id=agent.agent_id, attempt=attempt, error=error_str[:100])
                await asyncio.sleep(min(2 ** attempt, 10))
                continue
            break

    # All retries exhausted
    state.add_event("agent.failed", agent_id=agent.agent_id,
                    details={"error": record.error, "attempts": record.attempt})
    raise RuntimeError(f"Agent {agent.role} failed after {record.attempt} attempts: {record.error}")


# ─── Parallel Execution Engine ─────────────────────────────────────

async def _execute_parallel_agents(
    agents: dict[str, BaseAgent],
    state: WorkflowState,
    additional_context: dict[str, Any] | None = None,
) -> dict[str, dict[str, Any]]:
    """Execute independent agents concurrently with bounded concurrency.

    Returns dict of role → output. Failed agents are recorded but do not
    block other agents.
    """
    semaphore = asyncio.Semaphore(settings.MAX_CONCURRENT_AGENTS)

    async def _bounded_execute(role: str, agent: BaseAgent) -> tuple[str, dict[str, Any] | None, str | None]:
        async with semaphore:
            ctx = build_agent_context(state, role, additional_context)
            task = {**state.task_data, "previous_outputs": ctx.get("previous_outputs", {})}
            try:
                output = await _execute_agent_with_retry(agent, task, ctx, state)
                return role, output, None
            except Exception as e:
                return role, None, str(e)

    tasks_list = []
    for role, agent in agents.items():
        state.add_event("agent.queued", agent_id=agent.agent_id,
                        details={"round": state.current_round})
        tasks_list.append(_bounded_execute(role, agent))

    results = await asyncio.gather(*tasks_list, return_exceptions=False)

    outputs = {}
    for role, output, error in results:
        if output is not None:
            state.agent_outputs[role] = output
            outputs[role] = output
        elif error:
            state.agent_errors[role] = error
            state.anomalies.append({
                "type": "agent_failure",
                "agent": role,
                "description": error,
                "round": state.current_round,
            })

    return outputs


# ─── Critic → Re-analysis Logic ────────────────────────────────────

async def _run_critic(
    state: WorkflowState,
    agents: dict[str, BaseAgent],
) -> CriticDecision:
    """Run the critic agent and extract its decision."""
    critic = agents.get("critic")
    if not critic:
        return CriticDecision(requires_reanalysis=False)

    state.add_event("critic.started", agent_id=critic.agent_id)
    ctx = build_agent_context(state, "critic")
    task = {**state.task_data, "previous_outputs": ctx.get("previous_outputs", {})}

    try:
        output = await _execute_agent_with_retry(critic, task, ctx, state)
        state.agent_outputs["critic"] = output

        target_agents = output.get("target_agents", [])
        # Validate target agents exist in the plan
        valid_targets = [t for t in target_agents if t in _SPECIALIST_ROLES
                         and t in state.execution_plan.selected_agents]

        decision = CriticDecision(
            requires_reanalysis=output.get("requires_reanalysis", False) and len(valid_targets) > 0,
            target_agents=valid_targets,
            issues=output.get("issues", []),
            contradictions=output.get("contradictions", []),
            missing_evidence=output.get("missing_evidence", []),
            severity=output.get("severity", "low"),
            confidence=output.get("confidence", 0),
        )

        state.critic_decision = decision
        state.add_event("critic.completed", agent_id=critic.agent_id,
                        details={
                            "requires_reanalysis": decision.requires_reanalysis,
                            "target_agents": decision.target_agents,
                            "severity": decision.severity,
                        })

        return decision

    except Exception as e:
        state.add_event("critic.failed", details={"error": str(e)})
        return CriticDecision(requires_reanalysis=False)


async def _run_re_analysis(
    state: WorkflowState,
    agents: dict[str, BaseAgent],
    target_roles: list[str],
) -> dict[str, dict[str, Any]]:
    """Re-run only the targeted agents with critic feedback."""
    state.current_round += 1
    state.revision_requests += 1
    state.add_event("revision.started", details={
        "target_agents": target_roles,
        "round": state.current_round,
    })

    re_analysis_agents = {r: agents[r] for r in target_roles if r in agents}
    if not re_analysis_agents:
        return {}

    # Build revision context with critic feedback
    critic_feedback = ""
    if state.critic_decision:
        critic_feedback = json.dumps({
            "issues": state.critic_decision.issues,
            "contradictions": state.critic_decision.contradictions,
            "missing_evidence": state.critic_decision.missing_evidence,
        })

    revision_context = {
        "critic_feedback": critic_feedback,
        "revision_context": {
            "previous_round_outputs": {
                r: state.agent_outputs.get(r, {})
                for r in target_roles if state.agent_outputs.get(r)
            },
        },
    }

    outputs = await _execute_parallel_agents(re_analysis_agents, state, revision_context)

    state.add_event("revision.completed", details={
        "revised_agents": list(outputs.keys()),
        "round": state.current_round,
    })

    return outputs


# ─── Hash / Proof / Storage ────────────────────────────────────────

async def _record_proofs(
    state: WorkflowState,
    storage: StorageProvider | None = None,
    fabric_service=None,
    simulate_tampering: bool = False,
):
    """Generate hashes, store off-chain, record proofs, submit to blockchain."""
    for agent_role, output in state.agent_outputs.items():
        content_hash = compute_sha256(output)
        proof_id = f"proof-{state.run_id[:8]}-{agent_role}"

        state.add_event("hash.generated", agent_id=f"agent-{agent_role}-01",
                        details={"hash": content_hash[:16] + "..."})

        storage_ref = None
        if storage:
            path = f"tasks/{state.task_id}/runs/{state.run_id}/agents/{agent_role}/output.json.enc"
            encrypted = encrypt_json(canonical_json(output))
            await storage.put_object(path, encrypted)
            storage_ref = path
            state.add_event("storage.saved", agent_id=f"agent-{agent_role}-01",
                            details={"path": path})

        proof = {
            "proof_id": proof_id,
            "task_id": state.task_id,
            "run_id": state.run_id,
            "agent_id": f"agent-{agent_role}-01",
            "agent_role": agent_role,
            "organization": "Org1MSP",
            "content_hash": content_hash,
            "hash_algorithm": "SHA-256",
            "storage_reference": storage_ref,
            "output_version": 1,
            "status": "submitted",
            "confidence": output.get("confidence", 0),
            "fabric_tx_id": None,
            "fabric_block_number": None,
        }

        if state.mode == "blockchain" and fabric_service:
            state.add_event("blockchain.submitting", agent_id=f"agent-{agent_role}-01")
            try:
                tx_result = await fabric_service.record_decision_proof(proof)
                proof["fabric_tx_id"] = tx_result.get("tx_id")
                proof["fabric_block_number"] = tx_result.get("block_number")
                proof["fabric_ledger_status"] = "committed"
                state.add_event("blockchain.committed", agent_id=f"agent-{agent_role}-01",
                                details={"tx_id": proof["fabric_tx_id"]})
            except Exception as e:
                proof["fabric_ledger_status"] = "failed"
                state.add_event("blockchain.failed", agent_id=f"agent-{agent_role}-01",
                                details={"error": str(e)})
        else:
            proof["fabric_tx_id"] = f"local-{uuid.uuid4().hex[:16]}"
            proof["fabric_ledger_status"] = "local"

        state.proofs.append(proof)


async def _verify_proofs(
    state: WorkflowState,
    storage: StorageProvider | None = None,
    simulate_tampering: bool = False,
):
    """Verify stored outputs against blockchain hashes."""
    verify_start = time.time()
    state.add_event("verification.started")

    if storage:
        for proof in state.proofs:
            verified = True
            computed_hash = proof["content_hash"]

            if proof.get("storage_reference"):
                try:
                    encrypted_data = await storage.get_object(proof["storage_reference"])
                    decrypted = decrypt_json(encrypted_data)
                    stored_output = json.loads(decrypted)
                    computed_hash = compute_sha256(stored_output)

                    if simulate_tampering:
                        stored_output["tampered"] = True
                        computed_hash = compute_sha256(stored_output)
                        state.add_event("tamper.simulated", agent_id=proof["agent_id"])

                    if computed_hash != proof["content_hash"]:
                        verified = False
                        state.add_event("verification.hash_mismatch", agent_id=proof["agent_id"],
                                        details={"blockchain_hash": proof["content_hash"][:16],
                                                  "computed_hash": computed_hash[:16]})
                except Exception as e:
                    verified = False
                    state.add_event("verification.error", details={"error": str(e)})

            state.verifications.append({
                "proof_id": proof["proof_id"],
                "verified": verified,
                "blockchain_hash": proof["content_hash"],
                "computed_hash": computed_hash,
                "agent_id": proof["agent_id"],
            })

    state.verification_latency_ms = (time.time() - verify_start) * 1000
    state.add_event("verification.completed", details={
        "total": len(state.verifications),
        "verified": sum(1 for v in state.verifications if v["verified"]),
    })


# ─── Consensus Calculation ─────────────────────────────────────────

def calculate_consensus(agent_outputs: dict[str, dict], verifications: list[dict]) -> dict:
    """Calculate AI consensus/agreement score from agent outputs."""
    if not agent_outputs:
        return {"agreement_score": 0, "status": "rejected", "threshold": settings.CONSENSUS_THRESHOLD}

    scores = {}
    for role, output in agent_outputs.items():
        confidence = output.get("confidence", 0.5)
        verified = any(v.get("agent_id", "").endswith(role) and v.get("verified") for v in verifications)
        score = confidence * (1.1 if verified else 0.8)
        scores[role] = min(1.0, score)

    weights = {
        "synthesizer": 2.0, "verifier": 1.8, "clinical_reasoning": 1.5,
        "critic": 1.3, "risk": 1.2, "laboratory": 1.1,
    }
    total_weight = 0
    weighted_sum = 0
    for role, score in scores.items():
        w = weights.get(role, 1.0)
        weighted_sum += score * w
        total_weight += w

    agreement_score = weighted_sum / total_weight if total_weight > 0 else 0

    contradictions = []
    conditions = set()
    for role, output in agent_outputs.items():
        if "possible_conditions" in output:
            for c in output["possible_conditions"]:
                conditions.add(c.get("condition", ""))
    if len(conditions) > 3:
        contradictions.append("Multiple agents suggest disparate conditions")

    threshold = settings.CONSENSUS_THRESHOLD
    if agreement_score >= threshold:
        status = "accepted"
    elif agreement_score >= 0.50:
        status = "warning"
    else:
        status = "rejected"

    return {
        "agreement_score": round(agreement_score, 4),
        "threshold": threshold,
        "status": status,
        "agent_scores": {k: round(v, 4) for k, v in scores.items()},
        "contradictions": contradictions,
    }


# ─── Main Workflow Entry Point ─────────────────────────────────────

async def run_workflow(
    task_id: str,
    task_data: dict[str, Any],
    mode: str = "blockchain",
    storage: StorageProvider | None = None,
    db: AsyncSession | None = None,
    fabric_service=None,
    simulate_tampering: bool = False,
) -> WorkflowResult:
    """Execute the dynamic multi-agent workflow pipeline.

    Flow:
    1. Supervisor classifies case and creates plan
    2. Independent specialists execute in parallel
    3. Critic reviews outputs
    4. If re-analysis needed → targeted re-execution (bounded rounds)
    5. Verification
    6. Synthesis
    7. Hash / storage / blockchain proofs
    8. Consensus
    """
    state = WorkflowState(
        task_id=task_id,
        run_id=str(uuid.uuid4()),
        task_data=task_data,
        mode=mode,
        max_reasoning_rounds=settings.MAX_REASONING_ROUNDS,
    )
    state.pipeline_start = time.time()

    state.add_event("task.created", details={"task_id": task_id})
    state.add_event("run.started", details={"run_id": state.run_id, "mode": mode})

    # ── PHASE 1: Supervisor Classification ──
    state.add_event("supervisor.classifying", details={"description": "Classifying case"})
    supervisor = create_agent_instance("supervisor", mode=mode)

    try:
        supervisor_output = await _execute_agent_with_retry(supervisor, task_data, {}, state, max_retries=2)
        state.supervisor_output = supervisor_output
        plan = parse_supervisor_plan(supervisor_output, task_data)
    except Exception as e:
        logger.warning("supervisor_failed_falling_back", error=str(e)[:200])
        plan = create_default_plan(task_data)
        state.add_event("supervisor.fallback", details={"error": str(e)[:200]})

    state.execution_plan = plan
    state.current_round = 1
    state.add_event("supervisor.plan_ready", details={
        "agents": plan.selected_agents,
        "complexity": plan.complexity,
        "parallel_groups": plan.parallel_groups,
    })

    # ── PHASE 2: Create All Agents ──
    all_agents = create_agents_for_roles(plan.selected_agents, mode=mode)

    # ── PHASE 2.5: RAG Evidence Retrieval (if evidence agent is selected) ──
    rag_result = None
    if "evidence" in plan.selected_agents and settings.RAG_ENABLED:
        try:
            from backend.knowledge.service import get_rag_service
            rag_service = get_rag_service()
            state.add_event("rag.search.started")
            rag_result = await rag_service.search(task_data)
            state.add_event("rag.search.completed", details={
                "retrieval_count": rag_result.retrieval_count,
                "selected_count": rag_result.selected_count,
                "insufficient_evidence": rag_result.insufficient_evidence,
                "latency_ms": rag_result.latency_ms,
                "knowledge_base_version": rag_result.knowledge_base_version,
            })
        except Exception as e:
            logger.warning("rag_retrieval_failed", error=str(e)[:200])
            state.add_event("rag.search.failed", details={"error": str(e)[:200]})

    # ── PHASE 3: Execute Specialist Agents in Parallel ──
    specialist_roles = [r for r in plan.selected_agents if r in _SPECIALIST_ROLES]
    specialist_agents = {r: all_agents[r] for r in specialist_roles if r in all_agents}

    agent_start = time.time()
    if specialist_agents:
        state.add_event("parallel.started", details={
            "agents": list(specialist_agents.keys()),
            "round": state.current_round,
        })
        await _execute_parallel_agents(specialist_agents, state)
        state.add_event("parallel.completed", details={
            "completed": list(state.agent_outputs.keys()),
            "failed": list(state.agent_errors.keys()),
        })

    # ── PHASE 4: Critic Review (if required) ──
    if plan.critic_required and "critic" in all_agents:
        critic_decision = await _run_critic(state, all_agents)

        # ── PHASE 5: Re-analysis Loop ──
        if critic_decision.requires_reanalysis and state.reasoning_rounds_used < state.max_reasoning_rounds:
            state.reasoning_rounds_used += 1
            state.add_event("revision.requested", details={
                "target_agents": critic_decision.target_agents,
                "issues_count": len(critic_decision.issues),
                "round": state.current_round,
            })

            re_analysis_output = await _run_re_analysis(
                state, all_agents, critic_decision.target_agents
            )

            # Update outputs with revised versions
            state.agent_outputs.update(re_analysis_output)

            # Second critic pass (if rounds remain)
            if state.reasoning_rounds_used < state.max_reasoning_rounds:
                second_decision = await _run_critic(state, all_agents)
                if second_decision.requires_reanalysis:
                    state.reasoning_rounds_used += 1
                    state.add_event("revision.max_rounds_reached", details={
                        "rounds_used": state.reasoning_rounds_used,
                        "max": state.max_reasoning_rounds,
                    })
                    state.add_event("warning", details={
                        "message": "Maximum reasoning rounds reached. Proceeding with current outputs.",
                        "severity": "medium",
                    })
                    state.workflow_status = "warning"
        elif critic_decision.requires_reanalysis:
            # Max rounds already reached
            state.add_event("revision.max_rounds_reached", details={
                "rounds_used": state.reasoning_rounds_used,
                "max": state.max_reasoning_rounds,
            })
            state.add_event("warning", details={
                "message": "Maximum reasoning rounds reached. Proceeding with current outputs.",
                "severity": "medium",
            })
            state.workflow_status = "warning"

    agent_end = time.time()
    state.agent_latency_ms = (agent_end - agent_start) * 1000

    # ── PHASE 6: Verification ──
    verifier = all_agents.get("verifier")
    if verifier and plan.verification_required:
        state.add_event("verification.agent_started", agent_id=verifier.agent_id)
        ctx = build_agent_context(state, "verifier")
        task = {**state.task_data, "previous_outputs": ctx.get("previous_outputs", {})}
        try:
            verifier_output = await _execute_agent_with_retry(verifier, task, ctx, state)
            state.agent_outputs["verifier"] = verifier_output
            state.add_event("verification.agent_completed", agent_id=verifier.agent_id)
        except Exception as e:
            state.agent_errors["verifier"] = str(e)
            state.add_event("verification.agent_failed", details={"error": str(e)})

    # ── PHASE 7: Synthesis ──
    synthesizer = all_agents.get("synthesizer")
    if synthesizer:
        state.add_event("synthesis.started")
        ctx = build_agent_context(state, "synthesizer")
        task = {**state.task_data, "previous_outputs": ctx.get("previous_outputs", {})}
        try:
            synthesis_output = await _execute_agent_with_retry(synthesizer, task, ctx, state)
            state.agent_outputs["synthesizer"] = synthesis_output
            state.add_event("synthesis.completed")
        except Exception as e:
            state.agent_errors["synthesizer"] = str(e)
            state.add_event("synthesis.failed", details={"error": str(e)})

    # ── PHASE 8: Hash / Storage / Blockchain ──
    await _record_proofs(state, storage, fabric_service, simulate_tampering)

    # ── PHASE 9: Verification of stored proofs ──
    await _verify_proofs(state, storage, simulate_tampering)

    # ── PHASE 10: Anomaly Detection (hash mismatches) ──
    state.add_event("anomaly.checking")
    for v in state.verifications:
        if not v["verified"]:
            state.anomalies.append({
                "type": "hash_mismatch",
                "agent": v.get("agent_id"),
                "description": "Stored output hash does not match blockchain hash — possible tampering",
                "severity": "high",
            })

    # ── PHASE 11: Consensus ──
    state.add_event("consensus.started")
    consensus = calculate_consensus(state.agent_outputs, state.verifications)
    state.consensus_result = consensus
    state.add_event("consensus.completed", details={
        "agreement_score": consensus.get("agreement_score", 0),
        "status": consensus.get("status", "unknown"),
    })

    # ── PHASE 12: Final Result ──
    all_verified = all(v["verified"] for v in state.verifications) if state.verifications else False
    state.final_result = {
        "task_id": task_id,
        "run_id": state.run_id,
        "consensus": consensus.get("status", "unknown"),
        "agreement_score": consensus.get("agreement_score", 0),
        "integrity": "verified" if all_verified else "failed",
        "blockchain": "committed" if any(p.get("fabric_ledger_status") == "committed" for p in state.proofs) else "local",
        "agents_completed": len(state.agent_outputs),
        "agents_total": len(plan.selected_agents),
        "anomalies": len(state.anomalies),
        "verification": "passed" if all_verified else "failed",
        "agent_outputs": state.agent_outputs,
        "proofs": state.proofs,
        "verifications": state.verifications,
        # New execution trace fields
        "executed_agents": state.get_executed_roles(),
        "failed_agents": list(state.agent_errors.keys()),
        "revised_agents": state.get_revised_roles(),
        "reasoning_rounds": state.reasoning_rounds_used,
        "critic_interventions": 1 if state.critic_decision and state.critic_decision.requires_reanalysis else 0,
        "workflow_status": state.workflow_status or "completed",
    }

    state.total_latency_ms = (time.time() - state.pipeline_start) * 1000
    state.add_event("run.completed", details={
        "total_latency_ms": round(state.total_latency_ms, 2),
        "status": "completed",
        "workflow_status": state.workflow_status or "completed",
    })

    if state.workflow_status not in ("warning", "failed"):
        state.workflow_status = "completed"
    state.final_result["workflow_status"] = state.workflow_status

    return WorkflowResult(state)


def create_agent_instance(role: str, mode: str = "mock", config: dict | None = None) -> BaseAgent:
    """Create a single agent instance."""
    from backend.agents.factory import create_agent
    return create_agent(role=role, mode=mode, config=config)
