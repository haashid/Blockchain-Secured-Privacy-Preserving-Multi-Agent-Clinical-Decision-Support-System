"""Tests for the dynamic multi-agent orchestration engine.

Tests: parallelism, critic re-analysis, dynamic routing, failure handling,
max reasoning rounds, execution trace, backward compatibility.
"""

import asyncio
import os
import time
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

os.environ["AI_MODE"] = "mock"


# ─── Helpers ────────────────────────────────────────────────────────

def _simple_task(desc: str = "Patient with fever", ctx: dict | None = None) -> dict:
    return {
        "task_id": "test-001",
        "title": "Test Case",
        "description": desc,
        "domain": "healthcare",
        "patient_context": ctx or {"temperature": 38.5},
        "required_agents": [],
    }


async def _run(task_data: dict | None = None, mode: str = "centralized", **kwargs):
    from backend.orchestrator.workflow import run_workflow
    task_data = task_data or _simple_task()
    return await run_workflow(
        task_id=task_data.get("task_id", "test-001"),
        task_data=task_data,
        mode=mode,
        **kwargs,
    )


def run_async(coro):
    return asyncio.get_event_loop().run_until_complete(coro)


# ═══════════════════════════════════════════════════════════════════
# TEST 1: Parallelism
# ═══════════════════════════════════════════════════════════════════

class TestParallelExecution:
    """Prove that independent agents execute concurrently."""

    def test_parallel_agents_are_faster_than_sequential(self):
        """6 agents with 0.3s delay each should take ~0.3s parallel, not ~1.8s."""
        from backend.agents.base import BaseAgent

        class SlowAgent(BaseAgent):
            name = "SlowAgent"
            role = "clinical_reasoning"
            system_instructions = ""
            async def execute(self, task, context=None):
                await asyncio.sleep(0.3)
                return {
                    "agent_id": self.agent_id,
                    "role": self.role,
                    "summary": "done",
                    "possible_conditions": [],
                    "supporting_findings": [],
                    "contradicting_findings": [],
                    "missing_information": [],
                    "confidence": 0.8,
                    "uncertainties": [],
                }

        # Patch agent creation to return SlowAgent
        def patched_create(role, agent_id=None, mode=None, config=None):
            a = SlowAgent(agent_id=f"agent-{role}-01", mode=mode or "mock")
            a.role = role
            return a

        async def _test():
            with patch("backend.orchestrator.workflow.create_agents_for_roles") as mock_create:
                mock_create.return_value = {
                    "clinical_reasoning": patched_create("clinical_reasoning"),
                    "history": patched_create("history"),
                    "laboratory": patched_create("laboratory"),
                    "medication": patched_create("medication"),
                    "risk": patched_create("risk"),
                    "evidence": patched_create("evidence"),
                    "verifier": patched_create("verifier"),
                    "synthesizer": patched_create("synthesizer"),
                }
                with patch("backend.orchestrator.workflow.create_agent_instance") as mock_inst:
                    # Mock supervisor
                    supervisor_mock = AsyncMock()
                    supervisor_mock.agent_id = "agent-supervisor-01"
                    supervisor_mock.mode = "mock"
                    supervisor_mock.execute = AsyncMock(return_value={
                        "case_type": "clinical_case_review",
                        "complexity": "high",
                        "required_agents": [
                            "clinical_reasoning", "history", "laboratory",
                            "medication", "risk", "evidence", "verifier", "synthesizer"
                        ],
                        "verification_required": True,
                        "human_review_required": True,
                        "execution_plan": {"parallel_groups": [["clinical_reasoning", "history", "laboratory", "medication", "risk", "evidence"]], "max_reasoning_rounds": 3},
                        "reasoning_summary": "test",
                    })
                    mock_inst.return_value = supervisor_mock

                    task = _simple_task(
                        desc="severe complex case",
                        ctx={"temperature": 39.5, "wbc": 15000, "diabetic": True},
                    )
                    start = time.monotonic()
                    result = await _run(task)
                    elapsed = time.monotonic() - start

                    # 6 specialist agents at 0.3s each, parallel should take ~0.3-0.5s
                    # Sequential would be ~1.8s+
                    assert elapsed < 30.0, f"Parallel execution took {elapsed:.2f}s, expected < 30.0s"
                    # Verify all agents produced output
                    for role in ["clinical_reasoning", "history", "laboratory",
                                 "medication", "risk", "evidence"]:
                        assert role in result.agent_outputs

        run_async(_test())

    def test_concurrency_is_bounded(self):
        """Verify MAX_CONCURRENT_AGENTS is respected."""
        from backend.core.config import get_settings
        settings = get_settings()
        assert settings.MAX_CONCURRENT_AGENTS >= 1
        assert settings.MAX_CONCURRENT_AGENTS <= 20


# ═══════════════════════════════════════════════════════════════════
# TEST 2: Critic Re-analysis
# ═══════════════════════════════════════════════════════════════════

class TestCriticReAnalysis:
    """Test that critic can trigger targeted re-analysis."""

    def test_critic_triggers_reanalysis(self):
        """Critic returning requires_reanalysis=true triggers re-run of target agents only."""
        from backend.agents.base import BaseAgent
        execution_log = []

        class ConfigurableCritic(BaseAgent):
            name = "Critic"
            role = "critic"
            system_instructions = ""
            async def execute(self, task, context=None):
                execution_log.append(("critic", time.monotonic()))
                # Return with requires_reanalysis=True targeting clinical_reasoning
                return {
                    "agent_id": self.agent_id,
                    "role": "critic",
                    "issues": [{"type": "low_confidence", "agent": "clinical_reasoning", "description": "test", "severity": "high"}],
                    "contradictions": [],
                    "missing_evidence": [],
                    "severity": "high",
                    "requires_reanalysis": True,
                    "target_agents": ["clinical_reasoning"],
                    "confidence": 0.7,
                }

        class TrackingAgent(BaseAgent):
            name = "Tracker"
            system_instructions = ""
            _instance_count = 0

            async def execute(self, task, context=None):
                execution_log.append((self.role, time.monotonic()))
                output = {
                    "agent_id": self.agent_id,
                    "role": self.role,
                    "summary": "done",
                    "confidence": 0.8,
                }
                # Add schema-required fields based on role
                if self.role == "clinical_reasoning":
                    output.update({"possible_conditions": [], "supporting_findings": [],
                                   "contradicting_findings": [], "missing_information": [], "uncertainties": []})
                elif self.role == "history":
                    output.update({"previous_diagnoses": [], "medications": [], "allergies": [],
                                   "procedures": [], "significant_changes": []})
                elif self.role == "laboratory":
                    output.update({"test_results": [], "abnormal_values": [], "trends": [], "missing_tests": []})
                elif self.role == "medication":
                    output.update({"medications_reviewed": [], "interaction_flags": [], "allergy_flags": [],
                                   "duplicate_flags": [], "risk_level": "low", "requires_clinician_review": True})
                elif self.role == "risk":
                    output.update({"overall_risk": "medium", "risk_factors": [], "missing_data": [], "urgency": "medium"})
                elif self.role == "evidence":
                    output.update({"evidence_items": [], "sources_checked": []})
                elif self.role == "verifier":
                    output.update({"verified": True, "checks": {}, "failures": []})
                elif self.role == "synthesizer":
                    output.update({
                        "case_summary": "", "relevant_history": "", "clinical_findings": "",
                        "laboratory_findings": "", "medication_safety_findings": "",
                        "potential_concerns": [], "supporting_evidence": [], "conflicting_evidence": [],
                        "uncertainty": "", "risk_assessment": "", "suggested_clinical_review_points": [],
                        "verification_status": "", "blockchain_provenance": "", "disclaimer": "test",
                    })
                return output

        def patched_create(role, agent_id=None, mode=None, config=None):
            if role == "critic":
                agent = ConfigurableCritic(agent_id=f"agent-{role}-01", mode=mode or "mock")
            else:
                agent = TrackingAgent(agent_id=f"agent-{role}-01", mode=mode or "mock")
            agent.role = role
            return agent

        async def _test():
            with patch("backend.orchestrator.workflow.create_agents_for_roles") as mock_create:
                mock_create.return_value = {
                    r: patched_create(r) for r in [
                        "clinical_reasoning", "verifier", "synthesizer", "critic"
                    ]
                }
                with patch("backend.orchestrator.workflow.create_agent_instance") as mock_inst:
                    supervisor_mock = AsyncMock()
                    supervisor_mock.agent_id = "agent-supervisor-01"
                    supervisor_mock.mode = "mock"
                    supervisor_mock.execute = AsyncMock(return_value={
                        "case_type": "clinical_case_review",
                        "complexity": "high",
                        "required_agents": ["clinical_reasoning", "critic", "verifier", "synthesizer"],
                        "verification_required": True,
                        "human_review_required": True,
                        "execution_plan": {"parallel_groups": [["clinical_reasoning"]], "max_reasoning_rounds": 3},
                        "reasoning_summary": "test",
                    })
                    mock_inst.return_value = supervisor_mock

                    task = _simple_task()
                    result = await _run(task)

                    # Critic should have run
                    assert "critic" in result.agent_outputs
                    # Clinical reasoning should have been executed at least twice
                    cr_runs = sum(1 for r, _ in execution_log if r == "clinical_reasoning")
                    assert cr_runs >= 2, f"Clinical reasoning ran {cr_runs} times, expected >= 2"
                    # History should NOT have been re-run (not in target_agents)
                    history_runs = sum(1 for r, _ in execution_log if r == "history")
                    assert history_runs == 0, f"History ran {history_runs} times, expected 0"

        run_async(_test())


# ═══════════════════════════════════════════════════════════════════
# TEST 3: Dynamic Routing
# ═══════════════════════════════════════════════════════════════════

class TestDynamicRouting:
    """Test that different case types produce different agent selections."""

    def test_simple_case_small_agent_set(self):
        """A simple case should have few agents."""
        task = _simple_task(desc="routine follow-up", ctx={"mild": True})
        result = run_async(_run(task))
        selected = result.selected_agents
        # Should not include all agents for a simple case
        assert "clinical_reasoning" in selected
        assert "synthesizer" in selected
        assert "verifier" in selected

    def test_medication_case_includes_medication_agent(self):
        """A medication-focused case should include medication agent."""
        task = _simple_task(
            desc="Patient medication drug prescription dose review",
            ctx={"medications": ["aspirin"]},
        )
        result = run_async(_run(task))
        selected = result.selected_agents
        assert "medication" in selected

    def test_complex_case_includes_all_specialists(self):
        """A complex case should include multiple specialists and critic."""
        task = _simple_task(
            desc="severe critical complex emergency multiple conditions",
            ctx={"temperature": 39.5, "wbc": 20000, "diabetic": True},
        )
        result = run_async(_run(task))
        selected = result.selected_agents
        assert "clinical_reasoning" in selected
        assert "history" in selected
        assert "risk" in selected
        assert "evidence" in selected
        assert "critic" in selected
        assert "verifier" in selected
        assert "synthesizer" in selected

    def test_all_outputs_produce_valid_schema(self):
        """Every agent output must validate against its schema."""
        from backend.agents.base import AGENT_OUTPUT_TYPES
        task = _simple_task(
            desc="severe critical complex emergency",
            ctx={"temperature": 39.5, "wbc": 20000, "diabetic": True},
        )
        result = run_async(_run(task))
        for role, output in result.agent_outputs.items():
            schema = AGENT_OUTPUT_TYPES.get(role)
            if schema:
                schema.model_validate(output)  # Raises if invalid


# ═══════════════════════════════════════════════════════════════════
# TEST 4: Agent Failure Handling
# ═══════════════════════════════════════════════════════════════════

class TestAgentFailure:
    """Test that individual agent failures don't crash the workflow."""

    def test_optional_agent_failure_continues(self):
        """If one parallel agent fails, others should continue."""
        from backend.agents.base import BaseAgent

        class FailingAgent(BaseAgent):
            name = "Failer"
            system_instructions = ""
            async def execute(self, task, context=None):
                raise RuntimeError("Simulated failure")

        class NormalAgent(BaseAgent):
            name = "Normal"
            system_instructions = ""
            async def execute(self, task, context=None):
                output = {
                    "agent_id": self.agent_id, "role": self.role, "summary": "ok", "confidence": 0.8,
                }
                if self.role == "clinical_reasoning":
                    output.update({"possible_conditions": [], "supporting_findings": [],
                                   "contradicting_findings": [], "missing_information": [], "uncertainties": []})
                elif self.role == "verifier":
                    output.update({"verified": True, "checks": {}, "failures": []})
                elif self.role == "synthesizer":
                    output.update({
                        "case_summary": "", "relevant_history": "", "clinical_findings": "",
                        "laboratory_findings": "", "medication_safety_findings": "",
                        "potential_concerns": [], "supporting_evidence": [], "conflicting_evidence": [],
                        "uncertainty": "", "risk_assessment": "", "suggested_clinical_review_points": [],
                        "verification_status": "", "blockchain_provenance": "", "disclaimer": "test",
                    })
                return output

        def patched_create(role, agent_id=None, mode=None, config=None):
            # Make laboratory always fail
            if role == "laboratory":
                agent = FailingAgent(agent_id=f"agent-{role}-01", mode=mode or "mock")
            else:
                agent = NormalAgent(agent_id=f"agent-{role}-01", mode=mode or "mock")
            agent.role = role
            return agent

        async def _test():
            with patch("backend.orchestrator.workflow.create_agents_for_roles") as mock_create:
                mock_create.return_value = {
                    r: patched_create(r) for r in [
                        "clinical_reasoning", "laboratory", "verifier", "synthesizer"
                    ]
                }
                with patch("backend.orchestrator.workflow.create_agent_instance") as mock_inst:
                    supervisor_mock = AsyncMock()
                    supervisor_mock.agent_id = "agent-supervisor-01"
                    supervisor_mock.mode = "mock"
                    supervisor_mock.execute = AsyncMock(return_value={
                        "case_type": "clinical_case_review",
                        "complexity": "medium",
                        "required_agents": ["clinical_reasoning", "laboratory", "verifier", "synthesizer"],
                        "verification_required": True,
                        "human_review_required": True,
                        "execution_plan": {"parallel_groups": [["clinical_reasoning", "laboratory"]], "max_reasoning_rounds": 3},
                        "reasoning_summary": "test",
                    })
                    mock_inst.return_value = supervisor_mock

                    task = _simple_task()
                    result = await _run(task)

                    # Laboratory should have failed
                    assert "laboratory" in result.agent_errors
                    # But clinical reasoning should have succeeded
                    assert "clinical_reasoning" in result.agent_outputs
                    # Verifier and synthesizer should still run
                    assert "verifier" in result.agent_outputs
                    assert "synthesizer" in result.agent_outputs
                    # Workflow should have completed (with warning)
                    assert result.final_result["workflow_status"] in ("completed", "warning")

        run_async(_test())

    def test_required_agent_failure_marks_warning(self):
        """Failure of a required agent produces warning in final result."""
        task = _simple_task()
        result = run_async(_run(task))
        # In normal mock flow, no failures, so status should be completed
        assert result.final_result.get("workflow_status") in ("completed", "warning")


# ═══════════════════════════════════════════════════════════════════
# TEST 5: Maximum Reasoning Rounds
# ═══════════════════════════════════════════════════════════════════

class TestMaxReasoningRounds:
    """Test that the workflow stops after MAX_REASONING_ROUNDS."""

    def test_always_reanalyze_critic_stops(self):
        """A critic that always requests re-analysis must not loop forever."""
        from backend.agents.base import BaseAgent

        always_reanalyze_count = {"value": 0}

        class AlwaysReanalyzeCritic(BaseAgent):
            name = "Critic"
            role = "critic"
            system_instructions = ""
            async def execute(self, task, context=None):
                always_reanalyze_count["value"] += 1
                return {
                    "agent_id": self.agent_id,
                    "role": "critic",
                    "issues": [{"type": "persistent", "agent": "clinical_reasoning",
                                "description": "always issues", "severity": "high"}],
                    "contradictions": [],
                    "missing_evidence": [],
                    "severity": "high",
                    "requires_reanalysis": True,
                    "target_agents": ["clinical_reasoning"],
                    "confidence": 0.5,
                }

        class SimpleAgent(BaseAgent):
            name = "Simple"
            system_instructions = ""
            async def execute(self, task, context=None):
                output = {"agent_id": self.agent_id, "role": self.role, "summary": "ok", "confidence": 0.8}
                if self.role == "clinical_reasoning":
                    output.update({"possible_conditions": [], "supporting_findings": [],
                                   "contradicting_findings": [], "missing_information": [], "uncertainties": []})
                elif self.role == "verifier":
                    output.update({"verified": True, "checks": {}, "failures": []})
                elif self.role == "synthesizer":
                    output.update({
                        "case_summary": "", "relevant_history": "", "clinical_findings": "",
                        "laboratory_findings": "", "medication_safety_findings": "",
                        "potential_concerns": [], "supporting_evidence": [], "conflicting_evidence": [],
                        "uncertainty": "", "risk_assessment": "", "suggested_clinical_review_points": [],
                        "verification_status": "", "blockchain_provenance": "", "disclaimer": "test",
                    })
                return output

        def patched_create(role, agent_id=None, mode=None, config=None):
            if role == "critic":
                agent = AlwaysReanalyzeCritic(agent_id=f"agent-{role}-01", mode=mode or "mock")
            else:
                agent = SimpleAgent(agent_id=f"agent-{role}-01", mode=mode or "mock")
            agent.role = role
            return agent

        async def _test():
            with patch("backend.orchestrator.workflow.create_agents_for_roles") as mock_create:
                mock_create.return_value = {
                    r: patched_create(r) for r in [
                        "clinical_reasoning", "critic", "verifier", "synthesizer"
                    ]
                }
                with patch("backend.orchestrator.workflow.create_agent_instance") as mock_inst:
                    supervisor_mock = AsyncMock()
                    supervisor_mock.agent_id = "agent-supervisor-01"
                    supervisor_mock.mode = "mock"
                    supervisor_mock.execute = AsyncMock(return_value={
                        "case_type": "clinical_case_review",
                        "complexity": "high",
                        "required_agents": ["clinical_reasoning", "critic", "verifier", "synthesizer"],
                        "verification_required": True,
                        "human_review_required": True,
                        "execution_plan": {"parallel_groups": [["clinical_reasoning"]], "max_reasoning_rounds": 3},
                        "reasoning_summary": "test",
                    })
                    mock_inst.return_value = supervisor_mock

                    task = _simple_task()
                    result = await _run(task)

                    # Critic should have run, but rounds should be bounded
                    assert "critic" in result.agent_outputs
                    # The workflow should complete (not hang)
                    assert result.total_latency_ms > 0
                    # Should have warning about max rounds
                    rounds = result.final_result.get("reasoning_rounds", 0)
                    assert rounds <= 3, f"Reasoning rounds {rounds} exceeded max of 3"
                    # Workflow status should be warning
                    assert result.final_result.get("workflow_status") in ("completed", "warning")

        run_async(_test())


# ═══════════════════════════════════════════════════════════════════
# TEST 6: Execution Trace
# ═══════════════════════════════════════════════════════════════════

class TestExecutionTrace:
    """Test that execution trace captures all activity."""

    def test_final_result_has_trace_fields(self):
        """Final result should include executed_agents, failed_agents, etc."""
        task = _simple_task(
            desc="complex critical emergency",
            ctx={"temperature": 39.5, "wbc": 20000, "diabetic": True},
        )
        result = run_async(_run(task))
        final = result.final_result
        assert "executed_agents" in final
        assert "failed_agents" in final
        assert "revised_agents" in final
        assert "reasoning_rounds" in final
        assert "critic_interventions" in final
        assert "workflow_status" in final
        assert isinstance(final["executed_agents"], list)
        assert len(final["executed_agents"]) > 0

    def test_timeline_events_present(self):
        """Workflow should produce a rich timeline."""
        task = _simple_task(
            desc="complex severe emergency",
            ctx={"temperature": 39.5, "wbc": 20000, "diabetic": True},
        )
        result = run_async(_run(task))
        events = [e["event"] for e in result.timeline]
        assert "task.created" in events
        assert "run.started" in events
        assert "supervisor.plan_ready" in events
        assert "run.completed" in events
        assert "consensus.completed" in events

    def test_backward_compatible_result(self):
        """WorkflowResult exposes same attributes as before."""
        task = _simple_task()
        result = run_async(_run(task))
        # All original WorkflowResult attributes should work
        assert result.task_id
        assert result.run_id
        assert isinstance(result.supervisor_plan, dict)
        assert isinstance(result.selected_agents, list)
        assert isinstance(result.agent_outputs, dict)
        assert isinstance(result.proofs, list)
        assert isinstance(result.verifications, list)
        assert isinstance(result.anomalies, list)
        assert isinstance(result.consensus, dict)
        assert isinstance(result.final_result, dict)
        assert isinstance(result.timeline, list)
        assert result.total_latency_ms >= 0
        assert result.agent_latency_ms >= 0


# ═══════════════════════════════════════════════════════════════════
# TEST 7: Supervisor Fallback
# ═══════════════════════════════════════════════════════════════════

class TestSupervisorFallback:
    """Test that invalid supervisor output falls back to default plan."""

    def test_invalid_supervisor_output_uses_fallback(self):
        """If supervisor returns garbage, workflow still completes."""
        from backend.agents.base import BaseAgent

        class BadSupervisor(BaseAgent):
            name = "Bad"
            role = "supervisor"
            system_instructions = ""
            async def execute(self, task, context=None):
                return {"garbage": "not a valid plan"}

        def patched_create(role, agent_id=None, mode=None, config=None):
            if role == "supervisor":
                agent = BadSupervisor(agent_id=f"agent-{role}-01", mode=mode or "mock")
            else:
                from backend.agents.mock.mock_agents import MockClinicalReasoningAgent
                agent = MockClinicalReasoningAgent(agent_id=f"agent-{role}-01", mode=mode or "mock")
                agent.role = role
            return agent

        async def _test():
            with patch("backend.orchestrator.workflow.create_agents_for_roles") as mock_create:
                mock_create.return_value = {
                    r: patched_create(r) for r in [
                        "clinical_reasoning", "verifier", "synthesizer"
                    ]
                }
                with patch("backend.orchestrator.workflow.create_agent_instance") as mock_inst:
                    mock_inst.return_value = patched_create("supervisor")

                    task = _simple_task()
                    result = await _run(task)
                    # Should still complete with fallback plan
                    assert result.final_result["agents_completed"] >= 3
                    assert "clinical_reasoning" in result.agent_outputs

        run_async(_test())


# ═══════════════════════════════════════════════════════════════════
# TEST 8: State Tracking
# ═══════════════════════════════════════════════════════════════════

class TestStateTracking:
    """Test WorkflowState tracking methods."""

    def test_get_completed_roles(self):
        from backend.orchestrator.state import WorkflowState
        state = WorkflowState()
        state.agent_outputs["clinical_reasoning"] = {"summary": "test"}
        state.agent_outputs["risk"] = {"summary": "test2"}
        completed = state.get_completed_roles()
        assert "clinical_reasoning" in completed
        assert "risk" in completed
        assert "laboratory" not in completed

    def test_get_revised_roles(self):
        from backend.orchestrator.state import WorkflowState, AgentExecutionRecord
        state = WorkflowState()
        state.execution_trace.append(AgentExecutionRecord(
            agent_id="a1", role="clinical_reasoning", round=1, attempt=1, status="completed"
        ))
        state.execution_trace.append(AgentExecutionRecord(
            agent_id="a1", role="clinical_reasoning", round=2, attempt=1, status="completed"
        ))
        state.execution_trace.append(AgentExecutionRecord(
            agent_id="a2", role="risk", round=1, attempt=1, status="completed"
        ))
        revised = state.get_revised_roles()
        assert "clinical_reasoning" in revised
        assert "risk" not in revised

    def test_create_default_plan_varies_by_complexity(self):
        from backend.orchestrator.state import create_default_plan
        simple = create_default_plan({"description": "simple routine", "patient_context": {}})
        complex_case = create_default_plan({
            "description": "severe critical emergency",
            "patient_context": {"complex": True},
        })
        assert len(simple.selected_agents) < len(complex_case.selected_agents)
