"""Base class for all LLM-powered agents."""

from __future__ import annotations

import json
import time
from typing import Any

from pydantic import ValidationError

from backend.agents.base import BaseAgent, AGENT_OUTPUT_TYPES
from backend.agents.llm.groq_client import generate_json
from backend.core.config import get_settings
from backend.core.logging_config import get_logger

logger = get_logger("llm_agent")
settings = get_settings()

# Medical safety preamble injected into every agent's system prompt
MEDICAL_SAFETY_PREAMBLE = """
═══════════════════════════════════════════════════════════════════
CRITICAL MEDICAL SAFETY CONSTRAINTS — YOU MUST FOLLOW ALL OF THESE:
═══════════════════════════════════════════════════════════════════
1. You are a CLINICAL DECISION-SUPPORT tool, NOT a physician.
2. You must NEVER fabricate patient information, lab values, or medications.
3. You must NEVER invent clinical data that was not provided to you.
4. You must NEVER claim a definitive diagnosis — always present differentials.
5. You must NEVER recommend autonomous prescribing or treatment without clinician review.
6. You must distinguish clearly between FACTS (data provided to you) and INFERENCE (your analysis).
7. You must identify UNCERTAINTY — flag when information is insufficient.
8. You must recommend qualified clinician review for all clinical conclusions.
9. Your "confidence" field represents model-reported confidence, NOT clinical correctness.
   High confidence does NOT mean the output is medically accurate.
10. Final clinical decisions MUST remain with qualified healthcare professionals.
═══════════════════════════════════════════════════════════════════
"""


class LLMAgent(BaseAgent):
    """Base class for all functional LLM agents powered by Groq."""

    def __init__(self, agent_id: str, mode: str = "llm", config: dict[str, Any] | None = None):
        super().__init__(agent_id=agent_id, mode=mode, config=config)

    def get_system_prompt(self) -> str:
        """Build the full system prompt with schema, safety constraints, and role instructions."""
        schema = self.get_output_schema()
        schema_json = schema.model_json_schema() if schema else {}

        return (
            f"You are the {self.name} (role: {self.role}) in a "
            "Secure Multi-Agent AI Clinical Decision Support Framework.\n\n"
            f"{MEDICAL_SAFETY_PREAMBLE}\n"
            f"{self.system_instructions}\n\n"
            "═══════════════════════════════════════════════════════════════════\n"
            "OUTPUT FORMAT — STRICT JSON ONLY:\n"
            "═══════════════════════════════════════════════════════════════════\n"
            "You MUST output ONLY valid JSON matching this exact schema.\n"
            "Do NOT include markdown code blocks, explanations, or any text outside the JSON.\n"
            "Do NOT add fields not in the schema.\n"
            "Do NOT leave required fields empty — provide meaningful values.\n\n"
            f"JSON Schema:\n{json.dumps(schema_json, indent=2)}\n\n"
            "IMPORTANT RULES:\n"
            "- confidence must be a float between 0.0 and 1.0\n"
            "- All list fields must be actual arrays, not strings\n"
            "- risk_level must be one of: \"low\", \"medium\", \"high\"\n"
            "- overall_risk and urgency must be one of: \"low\", \"medium\", \"high\", \"critical\"\n"
            "- complexity must be one of: \"low\", \"medium\", \"high\", \"critical\"\n"
            "- severity must be one of: \"low\", \"medium\", \"high\", \"critical\"\n"
        )

    def build_user_prompt(self, task: dict[str, Any], context: dict[str, Any]) -> str:
        """Construct the prompt from the current task and available patient context."""
        prompt_parts: list[str] = []

        title = task.get("title", "Unknown Case")
        description = task.get("description", "")
        prompt_parts.append(f"Case Title: {title}")
        if description:
            prompt_parts.append(f"Case Description: {description}")

        patient_context = task.get("patient_context") or {}
        if patient_context:
            prompt_parts.append(f"Patient Context:\n{json.dumps(patient_context, indent=2)}")

        previous_outputs = task.get("previous_outputs") or {}
        if previous_outputs:
            prompt_parts.append("Previous Agent Outputs (for context — build upon, do not repeat):")
            for role, output in previous_outputs.items():
                if isinstance(output, dict):
                    prompt_parts.append(f"--- {role} ---\n{json.dumps(output, indent=2)}")
                else:
                    prompt_parts.append(f"--- {role} ---\n{str(output)}")

        return "\n\n".join(prompt_parts)

    async def execute(self, task: dict[str, Any], context: dict[str, Any] | None = None) -> dict[str, Any]:
        """Execute the task by calling the Groq LLM API with structured output validation."""
        agent_start = time.monotonic()
        user_prompt = self.build_user_prompt(task, context or {})
        system_prompt = self.get_system_prompt()

        # Use the main model for all agents to avoid rate limit pressure on the smaller model
        model = settings.GROQ_MODEL

        agent_info = {
            "agent_id": self.agent_id,
            "role": self.role,
            "provider": "groq",
            "model": model,
            "mode": self.mode,
        }

        logger.info(
            "agent_execute_start",
            **agent_info,
        )

        try:
            result = await generate_json(system_prompt, user_prompt, model=model)
        except Exception as e:
            latency_ms = (time.monotonic() - agent_start) * 1000
            logger.error(
                "agent_execute_failed",
                **agent_info,
                error=str(e)[:200],
                latency_ms=round(latency_ms, 2),
            )
            raise RuntimeError(
                f"Agent {self.agent_id} (role={self.role}) failed via LLM: {e}"
            ) from e

        # Inject required agent identification fields
        result["agent_id"] = self.agent_id
        result["role"] = self.role

        # Validate against Pydantic schema
        schema = self.get_output_schema()
        if schema:
            try:
                schema.model_validate(result)
            except ValidationError as ve:
                latency_ms = (time.monotonic() - agent_start) * 1000
                logger.error(
                    "agent_output_validation_failed",
                    **agent_info,
                    validation_error=str(ve)[:300],
                    latency_ms=round(latency_ms, 2),
                )
                raise RuntimeError(
                    f"Agent {self.agent_id} output failed schema validation: {ve}"
                ) from ve

        latency_ms = (time.monotonic() - agent_start) * 1000
        logger.info(
            "agent_execute_completed",
            **agent_info,
            latency_ms=round(latency_ms, 2),
            status="completed",
        )

        return result
