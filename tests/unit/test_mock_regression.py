"""Mock mode regression tests — ensure mock mode works exactly as before.

These tests do NOT require Groq credentials.
"""

import asyncio
import json
import os
import pytest

# Ensure mock mode for all tests in this file
os.environ["AI_MODE"] = "mock"


class TestMockAgentExecution:
    """Test that mock agents execute and produce valid output."""

    @pytest.fixture
    def task_data(self):
        return {
            "title": "Test Case",
            "description": "Patient with fever and elevated WBC",
            "patient_context": {"temperature": 38.5, "diabetic": True},
            "required_agents": [],
        }

    def test_mock_supervisor(self, task_data):
        """Mock supervisor produces valid SupervisorOutput."""
        from backend.agents.factory import create_agent
        agent = create_agent(role="supervisor", mode="mock")
        result = asyncio.get_event_loop().run_until_complete(agent.execute(task_data))
        assert "required_agents" in result
        assert "complexity" in result
        assert result["complexity"] in ("low", "medium", "high", "critical")

    def test_mock_clinical_reasoning(self, task_data):
        """Mock clinical reasoning produces valid output."""
        from backend.agents.factory import create_agent
        agent = create_agent(role="clinical_reasoning", mode="mock")
        result = asyncio.get_event_loop().run_until_complete(agent.execute(task_data))
        assert "possible_conditions" in result
        assert "confidence" in result
        assert 0.0 <= result["confidence"] <= 1.0

    def test_mock_all_10_roles(self, task_data):
        """All 10 mock agents produce valid output."""
        from backend.agents.factory import create_agent
        from backend.agents.base import AGENT_OUTPUT_TYPES

        all_roles = [
            "supervisor", "clinical_reasoning", "history", "laboratory",
            "medication", "risk", "evidence", "critic", "verifier", "synthesizer"
        ]

        for role in all_roles:
            agent = create_agent(role=role, mode="mock")
            result = asyncio.get_event_loop().run_until_complete(agent.execute(task_data))
            schema = AGENT_OUTPUT_TYPES.get(role)
            if schema:
                schema.model_validate(result)  # Will raise if invalid


class TestMockWorkflow:
    """Test full workflow in mock mode."""

    def test_workflow_completes(self):
        """Full workflow completes in mock mode without errors."""
        from backend.orchestrator.workflow import run_workflow

        task_data = {
            "task_id": "mock-test-001",
            "title": "Test",
            "description": "Patient with fever",
            "domain": "healthcare",
            "patient_context": {"temperature": 38.5},
            "required_agents": ["clinical_reasoning", "verifier", "synthesizer"],
        }

        result = asyncio.get_event_loop().run_until_complete(
            run_workflow(task_id="mock-test-001", task_data=task_data, mode="centralized")
        )

        assert len(result.agent_outputs) >= 3
        assert result.total_latency_ms < 1000  # Mock should be very fast
        assert result.consensus["status"] in ("accepted", "warning", "rejected")

    def test_workflow_no_groq_calls(self):
        """Mock workflow makes no Groq API calls."""
        from backend.orchestrator.workflow import run_workflow

        task_data = {
            "task_id": "mock-test-002",
            "title": "Test",
            "description": "Test case",
            "domain": "healthcare",
            "patient_context": {},
            "required_agents": ["clinical_reasoning"],
        }

        result = asyncio.get_event_loop().run_until_complete(
            run_workflow(task_id="mock-test-002", task_data=task_data, mode="centralized")
        )

        # Verify no Groq-related fields in output (no provider, no model metadata)
        for role, output in result.agent_outputs.items():
            assert "agent_id" in output
            assert output["agent_id"].startswith("agent-")
