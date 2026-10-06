"""Agent factory for creating agent instances."""

from typing import Any

from backend.agents.base import BaseAgent
from backend.agents.registry import registry
from backend.agents.mock.mock_agents import (
    MockClinicalReasoningAgent,
    MockCriticAgent,
    MockEvidenceAgent,
    MockHistoryAgent,
    MockLaboratoryAgent,
    MockMedicationAgent,
    MockRiskAgent,
    MockSupervisorAgent,
    MockSynthesizerAgent,
    MockVerifierAgent,
)
from backend.agents.llm.clinical_agents import (
    GroqSupervisorAgent,
    GroqClinicalReasoningAgent,
    GroqHistoryAgent,
    GroqLaboratoryAgent,
    GroqMedicationAgent,
    GroqRiskAgent,
    GroqEvidenceAgent,
    GroqCriticAgent,
    GroqVerifierAgent,
    GroqSynthesizerAgent,
)
from backend.core.config import get_settings

settings = get_settings()

# Valid AI agent modes (distinct from coordination modes like "blockchain"/"centralized")
_AI_MODES = {"mock", "llm", "groq"}


def register_all_agents():
    """Register all agent classes with the global registry."""
    # Core orchestration agents
    registry.register(MockSupervisorAgent)

    # Clinical specialist agents
    registry.register(MockClinicalReasoningAgent)
    registry.register(MockHistoryAgent)
    registry.register(MockLaboratoryAgent)
    registry.register(MockMedicationAgent)
    registry.register(MockRiskAgent)
    registry.register(MockEvidenceAgent)

    # Review agents
    registry.register(MockCriticAgent)
    registry.register(MockVerifierAgent)
    registry.register(MockSynthesizerAgent)

    # Groq LLM agents
    registry.register(GroqSupervisorAgent)
    registry.register(GroqClinicalReasoningAgent)
    registry.register(GroqHistoryAgent)
    registry.register(GroqLaboratoryAgent)
    registry.register(GroqMedicationAgent)
    registry.register(GroqRiskAgent)
    registry.register(GroqEvidenceAgent)
    registry.register(GroqCriticAgent)
    registry.register(GroqVerifierAgent)
    registry.register(GroqSynthesizerAgent)


def _resolve_ai_mode(mode: str | None) -> str:
    """Resolve the AI agent mode from a caller-provided mode or global settings.

    The caller may pass a coordination mode ("blockchain", "centralized") or an
    AI mode ("mock", "llm", "groq"). This function detects which and falls back
    to settings.AI_MODE when the caller's value isn't a valid AI mode.
    """
    if mode and mode in _AI_MODES:
        return mode
    # Fall back to global AI_MODE setting
    return settings.AI_MODE if settings.AI_MODE in _AI_MODES else "mock"


def create_agent(role: str, agent_id: str | None = None, mode: str | None = None,
                 config: dict[str, Any] | None = None) -> BaseAgent:
    """Create an agent by role, selecting mock or LLM based on AI mode."""
    if agent_id is None:
        agent_id = f"agent-{role}-01"

    ai_mode = _resolve_ai_mode(mode)
    return registry.create(role=role, agent_id=agent_id, mode=ai_mode, config=config)


def create_agents_for_roles(roles: list[str], mode: str | None = None) -> dict[str, BaseAgent]:
    """Create multiple agents by their roles."""
    agents = {}
    for role in roles:
        agent_id = f"agent-{role}-01"
        agents[role] = create_agent(role=role, agent_id=agent_id, mode=mode)
    return agents


# Auto-register on import
register_all_agents()
