"""Base agent interface and output schemas."""

from abc import ABC, abstractmethod
from typing import Any, Literal

from pydantic import BaseModel, Field


# ─── Output Schemas ─────────────────────────────────────────────────

class SupervisorOutput(BaseModel):
    case_type: str
    complexity: Literal["low", "medium", "high", "critical"]
    required_agents: list[str]
    required_tools: list[str] = []
    verification_required: bool = True
    human_review_required: bool = True
    execution_plan: dict[str, Any] = {}
    reasoning_summary: str = ""


class ClinicalReasoningOutput(BaseModel):
    agent_id: str
    role: str = "clinical_reasoning"
    summary: str
    possible_conditions: list[dict[str, Any]] = []
    supporting_findings: list[str] = []
    contradicting_findings: list[str] = []
    missing_information: list[str] = []
    confidence: float = Field(ge=0.0, le=1.0)
    uncertainties: list[str] = []


class HistoryOutput(BaseModel):
    agent_id: str
    role: str = "history"
    summary: str
    previous_diagnoses: list[dict[str, Any]] = []
    medications: list[dict[str, Any]] = []
    allergies: list[str] = []
    procedures: list[dict[str, Any]] = []
    significant_changes: list[str] = []
    confidence: float = Field(ge=0.0, le=1.0)


class LaboratoryOutput(BaseModel):
    agent_id: str
    role: str = "laboratory"
    summary: str
    test_results: list[dict[str, Any]] = []
    abnormal_values: list[dict[str, Any]] = []
    trends: list[str] = []
    missing_tests: list[str] = []
    confidence: float = Field(ge=0.0, le=1.0)


class MedicationOutput(BaseModel):
    agent_id: str
    role: str = "medication"
    summary: str
    medications_reviewed: list[dict[str, Any]] = []
    interaction_flags: list[dict[str, Any]] = []
    allergy_flags: list[str] = []
    duplicate_flags: list[str] = []
    risk_level: Literal["low", "medium", "high"]
    requires_clinician_review: bool = True
    confidence: float = Field(ge=0.0, le=1.0)


class RiskOutput(BaseModel):
    agent_id: str
    role: str = "risk"
    summary: str
    overall_risk: Literal["low", "medium", "high", "critical"]
    risk_factors: list[dict[str, Any]] = []
    missing_data: list[str] = []
    urgency: Literal["low", "medium", "high", "critical"]
    confidence: float = Field(ge=0.0, le=1.0)


class EvidenceOutput(BaseModel):
    agent_id: str
    role: str = "evidence"
    summary: str
    evidence_items: list[dict[str, Any]] = []
    sources_checked: list[str] = []
    supported_claims: list[dict[str, Any]] = []
    unsupported_claims: list[dict[str, Any]] = []
    knowledge_gaps: list[str] = []
    insufficient_evidence: bool = False
    confidence: float = Field(ge=0.0, le=1.0)


class CriticOutput(BaseModel):
    agent_id: str
    role: str = "critic"
    issues: list[dict[str, Any]] = []
    contradictions: list[str] = []
    missing_evidence: list[str] = []
    severity: Literal["low", "medium", "high", "critical"]
    requires_reanalysis: bool = False
    target_agents: list[str] = []
    confidence: float = Field(ge=0.0, le=1.0)


class VerificationOutput(BaseModel):
    agent_id: str
    role: str = "verifier"
    verified: bool
    checks: dict[str, bool] = {}
    failures: list[str] = []
    confidence: float = Field(ge=0.0, le=1.0)


class SynthesisOutput(BaseModel):
    agent_id: str
    role: str = "synthesizer"
    case_summary: str = ""
    relevant_history: str = ""
    clinical_findings: str = ""
    laboratory_findings: str = ""
    medication_safety_findings: str = ""
    potential_concerns: list[str] = []
    supporting_evidence: list[str] = []
    conflicting_evidence: list[str] = []
    uncertainty: str = ""
    risk_assessment: str = ""
    suggested_clinical_review_points: list[str] = []
    verification_status: str = ""
    blockchain_provenance: str = ""
    disclaimer: str = (
        "AI-generated clinical decision support. "
        "Final clinical decisions remain with qualified healthcare professionals."
    )
    confidence: float = Field(ge=0.0, le=1.0)


# ─── Output type map ────────────────────────────────────────────────

AGENT_OUTPUT_TYPES: dict[str, type[BaseModel]] = {
    "supervisor": SupervisorOutput,
    "clinical_reasoning": ClinicalReasoningOutput,
    "history": HistoryOutput,
    "laboratory": LaboratoryOutput,
    "medication": MedicationOutput,
    "risk": RiskOutput,
    "evidence": EvidenceOutput,
    "critic": CriticOutput,
    "verifier": VerificationOutput,
    "synthesizer": SynthesisOutput,
}


# ─── Base Agent ─────────────────────────────────────────────────────

class BaseAgent(ABC):
    """Abstract base class for all agents."""

    name: str = "base"
    role: str = "base"
    capabilities: list[str] = []
    system_instructions: str = ""

    def __init__(self, agent_id: str, mode: str = "mock", config: dict[str, Any] | None = None):
        self.agent_id = agent_id
        self.mode = mode
        self.config = config or {}

    @abstractmethod
    async def execute(self, task: dict[str, Any], context: dict[str, Any] | None = None) -> dict[str, Any]:
        """Execute the agent's task and return structured output."""
        ...

    def validate_output(self, output: dict[str, Any]) -> bool:
        """Validate output against the agent's schema."""
        output_type = AGENT_OUTPUT_TYPES.get(self.role)
        if output_type:
            try:
                output_type.model_validate(output)
                return True
            except Exception:
                return False
        return True

    def get_output_schema(self) -> type[BaseModel] | None:
        return AGENT_OUTPUT_TYPES.get(self.role)
