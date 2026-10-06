"""Agent registry for managing agent classes and instances.

Stores mock and LLM agent classes separately per role so that the
mode parameter correctly selects between them.
"""

from typing import Any

from backend.agents.base import BaseAgent


class AgentRegistry:
    """Central registry for agent classes.

    Agents are stored by (role, mode_type) where mode_type is "mock" or "llm".
    This allows both mock and LLM implementations to coexist for the same role.
    """

    def __init__(self):
        self._agents: dict[tuple[str, str], type[BaseAgent]] = {}

    @staticmethod
    def _mode_type(agent_class: type[BaseAgent]) -> str:
        """Determine if a class is an LLM agent or a mock agent."""
        # Import here to avoid circular imports
        from backend.agents.llm.llm_base import LLMAgent
        return "llm" if issubclass(agent_class, LLMAgent) else "mock"

    def register(self, agent_class: type[BaseAgent]) -> type[BaseAgent]:
        """Register an agent class by its role and mode type."""
        key = (agent_class.role, self._mode_type(agent_class))
        self._agents[key] = agent_class
        return agent_class

    def get(self, role: str, mode: str = "mock") -> type[BaseAgent] | None:
        mode_type = "llm" if mode in ("llm", "groq") else "mock"
        return self._agents.get((role, mode_type)) or self._agents.get((role, "mock"))

    def list_available(self) -> list[dict[str, Any]]:
        seen_roles = set()
        result = []
        for (role, _mode_type), cls in self._agents.items():
            if role not in seen_roles:
                seen_roles.add(role)
                result.append({
                    "role": cls.role,
                    "name": cls.name,
                    "capabilities": cls.capabilities,
                })
        return result

    def create(self, role: str, agent_id: str, mode: str = "mock",
               config: dict[str, Any] | None = None) -> BaseAgent:
        """Create an agent by role, selecting mock or LLM based on mode."""
        mode_type = "llm" if mode in ("llm", "groq") else "mock"
        cls = self._agents.get((role, mode_type)) or self._agents.get((role, "mock"))
        if not cls:
            raise ValueError(f"Unknown agent role: {role}")
        return cls(agent_id=agent_id, mode=mode, config=config)

    @property
    def roles(self) -> list[str]:
        return list({role for role, _ in self._agents.keys()})


# Global registry singleton
registry = AgentRegistry()
