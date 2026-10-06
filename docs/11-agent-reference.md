# 11 — Agent Reference

All agents are defined in `backend/agents/llm/clinical_agents.py` (LLM mode)  
and `backend/agents/mock/mock_agents.py` (Mock mode).  
Output schemas are defined in `backend/agents/base.py`.

---

## Agent 1: Supervisor Agent

**Class (LLM)**: `GroqSupervisorAgent`  
**Class (Mock)**: `MockSupervisorAgent`  
**Role string**: `"supervisor"`  
**Model used**: `GROQ_MODEL` (heavy — llama-3.1-70b)

### Purpose
Reads the case description, classifies its complexity, and selects the required specialist agents.

### Input
```python
{
    "title": "Case title",
    "description": "Clinical narrative text",
    "patient_context": { ... }
}
```

### Output Schema: `SupervisorOutput`
```python
class SupervisorOutput(BaseModel):
    case_type: str                  # e.g. "clinical_case_review"
    complexity: Literal["low", "medium", "high", "critical"]
    required_agents: list[str]      # e.g. ["clinical_reasoning", "laboratory", "verifier", "synthesizer"]
    required_tools: list[str]       # Currently always []
    verification_required: bool     # Always True
    human_review_required: bool     # Always True
    execution_plan: dict
    reasoning_summary: str
```

### System Prompt
> "You are the orchestration engine. Analyze the case description and triage its complexity. Select the required agents. Required agents must ALWAYS include 'clinical_reasoning', 'verifier', and 'synthesizer'. If there is medication history, include 'medication'. If there are lab results, include 'laboratory'."

### Beginner Explanation
Think of the Supervisor like a **charge nurse at triage**. When a patient arrives, they quickly assess: "This patient has chest pain — we need the cardiologist, the ECG tech, and the pharmacist." The Supervisor does the same: reads the case and decides which specialists are needed.

---

## Agent 2: Clinical Reasoning Agent

**Class (LLM)**: `GroqClinicalReasoningAgent`  
**Class (Mock)**: `MockClinicalReasoningAgent`  
**Role string**: `"clinical_reasoning"`  
**Model used**: `GROQ_MODEL` (heavy)

### Purpose
Generates a differential diagnosis — a list of possible conditions ranked by probability.

### Output Schema: `ClinicalReasoningOutput`
```python
class ClinicalReasoningOutput(BaseModel):
    agent_id: str
    role: str = "clinical_reasoning"
    summary: str                            # Narrative analysis
    possible_conditions: list[dict]         # [{condition, probability, type}]
    supporting_findings: list[str]          # Evidence supporting diagnosis
    contradicting_findings: list[str]       # Evidence against
    missing_information: list[str]          # What data would help
    confidence: float                       # 0.0 - 1.0
    uncertainties: list[str]               # Hedging statements
```

### Beginner Explanation
Think of this as the **attending physician's first pass**. Given symptoms and context, they brainstorm: "This could be pneumonia, or a pulmonary embolism, or heart failure." They list each possibility with supporting and contradicting evidence.

---

## Agent 3: Medical History Agent

**Class (LLM)**: `GroqHistoryAgent`  
**Class (Mock)**: `MockHistoryAgent`  
**Role string**: `"history"`  
**Model used**: `GROQ_FAST_MODEL` (fast — llama-3.1-8b)

### Purpose
Analyzes longitudinal patient history: past diagnoses, medications, allergies, surgical history.

### Output Schema: `HistoryOutput`
```python
class HistoryOutput(BaseModel):
    agent_id: str
    role: str = "history"
    summary: str
    previous_diagnoses: list[dict]      # [{diagnosis, year, status}]
    medications: list[dict]             # [{name, dose, frequency}]
    allergies: list[str]               # ["Penicillin", ...]
    procedures: list[dict]             # [{procedure, year, outcome}]
    significant_changes: list[str]     # Recent clinical changes
    confidence: float
```

### Mock Output Note
In mock mode, the agent returns **hardcoded demo data** (Type 2 DM, Hypertension, Metformin, Lisinopril, Penicillin allergy). In LLM mode, it reasons from the `patient_context` provided.

---

## Agent 4: Laboratory Analysis Agent

**Class (LLM)**: `GroqLaboratoryAgent`  
**Class (Mock)**: `MockLaboratoryAgent`  
**Role string**: `"laboratory"`  
**Model used**: `GROQ_FAST_MODEL`

### Purpose
Analyzes laboratory test results, identifies abnormalities, suggests missing tests.

### Output Schema: `LaboratoryOutput`
```python
class LaboratoryOutput(BaseModel):
    agent_id: str
    role: str = "laboratory"
    summary: str
    test_results: list[dict]            # [{test, value, unit, reference, status}]
    abnormal_values: list[dict]         # [{test, deviation, clinical_relevance}]
    trends: list[str]                   # Temporal patterns
    missing_tests: list[str]            # Suggested additional tests
    confidence: float
```

### Beginner Explanation
Think of this as the **lab technician + clinical pathologist** combined. They take raw numbers (hemoglobin: 10.2 g/dL, reference: 12-16) and flag: "This is low. Could mean anemia or chronic disease."

---

## Agent 5: Pharmacotherapy Agent (Medication Safety)

**Class (LLM)**: `GroqMedicationAgent`  
**Class (Mock)**: `MockMedicationAgent`  
**Role string**: `"medication"`  
**Model used**: `GROQ_FAST_MODEL`

### Purpose
Reviews medications for dangerous interactions, contraindications, allergy conflicts, dosage issues.

### Output Schema: `MedicationOutput`
```python
class MedicationOutput(BaseModel):
    agent_id: str
    role: str = "medication"
    summary: str
    medications_reviewed: list[dict]
    interaction_flags: list[dict]       # [{drug_a, drug_b, severity, description}]
    allergy_flags: list[str]
    duplicate_flags: list[str]
    risk_level: Literal["low", "medium", "high"]
    requires_clinician_review: bool     # Always True
    confidence: float
```

### Beginner Explanation
Think of this as the **hospital pharmacist**. They review all medications and ask: "Is this safe given the patient's allergies? Does Drug A interact with Drug B? Is the dose appropriate?"

---

## Agent 6: Risk Assessment Agent

**Class (LLM)**: `GroqRiskAgent`  
**Class (Mock)**: `MockRiskAgent`  
**Role string**: `"risk"`  
**Model used**: `GROQ_MODEL` (heavy — clinical urgency is critical)

### Purpose
Evaluates overall clinical risk level and urgency. Determines triage priority.

### Output Schema: `RiskOutput`
```python
class RiskOutput(BaseModel):
    agent_id: str
    role: str = "risk"
    summary: str
    overall_risk: Literal["low", "medium", "high", "critical"]
    risk_factors: list[dict]            # [{factor, weight, description}]
    missing_data: list[str]
    urgency: Literal["low", "medium", "high", "critical"]
    confidence: float
```

### Beginner Explanation
Think of this as the **triage nurse** with a risk scoring tool. They assess: "Is this patient stable? Do they need to be seen immediately? What's the mortality risk?"

---

## Agent 7: Evidence-Based Medicine Agent

**Class (LLM)**: `GroqEvidenceAgent`  
**Class (Mock)**: `MockEvidenceAgent`  
**Role string**: `"evidence"`  
**Model used**: `GROQ_FAST_MODEL`

### Purpose
Cross-references diagnoses with clinical guidelines (AHA, CDC, ACC, WHO, IDSA).

### Output Schema: `EvidenceOutput`
```python
class EvidenceOutput(BaseModel):
    agent_id: str
    role: str = "evidence"
    summary: str
    evidence_items: list[dict]          # [{source_id, title, source_type, claim_supported}]
    sources_checked: list[str]          # e.g. ["Clinical Guidelines DB", "PubMed"]
    confidence: float
```

### ⚠️ Important Limitation
**PLANNED BUT NOT IMPLEMENTED**: True Evidence-Based Medicine requires RAG (Retrieval Augmented Generation) — fetching real documents from a vector database. Currently, the LLM agent **recalls guidelines from its training data** (which may be outdated or hallucinated). This is academically noted as a limitation.

In mock mode, it returns hardcoded references to CDC, IDSA, and ASH guidelines.

---

## Agent 8: Peer Review Critic Agent

**Class (LLM)**: `GroqCriticAgent`  
**Class (Mock)**: `MockCriticAgent`  
**Role string**: `"critic"`  
**Model used**: `GROQ_FAST_MODEL`

### Purpose
Acts as an **adversarial reviewer**. Challenges the outputs of all preceding agents. Identifies logical fallacies, cognitive biases, contradictions, and unsupported claims.

### Output Schema: `CriticOutput`
```python
class CriticOutput(BaseModel):
    agent_id: str
    role: str = "critic"
    issues: list[dict]                  # [{type, agent, description, severity}]
    contradictions: list[str]
    missing_evidence: list[str]         # What should have been checked
    severity: Literal["low", "medium", "high", "critical"]
    requires_reanalysis: bool           # True = agents should re-run (not currently acted upon)
    confidence: float
```

### Current Limitation
The `requires_reanalysis` field is defined and populated, but the **orchestrator does not currently loop back** to re-run agents if the critic flags a problem. The critic's output is recorded and shown in the report, but does not trigger re-execution. This is a known architectural gap.

### Beginner Explanation
Think of this as a **peer reviewer on a journal article**. They read what the other doctors concluded and ask: "Did you consider X? Your diagnosis seems premature. The lab values suggest an alternative explanation."

---

## Agent 9: Verification Agent

**Class (LLM)**: `GroqVerifierAgent`  
**Class (Mock)**: `MockVerifierAgent`  
**Role string**: `"verifier"`  
**Model used**: `GROQ_FAST_MODEL`

### Purpose
Final AI-level safety and consistency check across all outputs before synthesis.

### Output Schema: `VerificationOutput`
```python
class VerificationOutput(BaseModel):
    agent_id: str
    role: str = "verifier"
    verified: bool                     # True = safe to proceed
    checks: dict[str, bool]            # {schema: True, evidence: True, ...}
    failures: list[str]               # Specific failure descriptions
    confidence: float
```

### ⚠️ Note on Naming Confusion
There are **TWO verification concepts** in this system:
1. **AI Verifier Agent** (this agent): Checks logical consistency of agent outputs.
2. **Cryptographic Verification** (in `workflow.py`): Re-downloads encrypted MinIO blob, re-hashes, compares with blockchain hash.

These are completely separate systems. Do not confuse them.

### Beginner Explanation
Think of this as the **department head doing a final review** before signing off. "Are there any red flags? Is anyone prescribing something the patient is allergic to? Did the agents contradict each other badly?"

---

## Agent 10: Clinical Synthesis Agent

**Class (LLM)**: `GroqSynthesizerAgent`  
**Class (Mock)**: `MockSynthesizerAgent`  
**Role string**: `"synthesizer"`  
**Model used**: `GROQ_MODEL` (heavy — final report quality is critical)  
**Consensus weight**: `2.0` (highest weight in consensus calculation)

### Purpose
Merges all agent outputs into a clear, actionable clinical summary for the attending physician.

### Output Schema: `SynthesisOutput`
```python
class SynthesisOutput(BaseModel):
    agent_id: str
    role: str = "synthesizer"
    case_summary: str                          # Concise narrative
    relevant_history: str                      # Key history points
    clinical_findings: str                     # From clinical reasoning
    laboratory_findings: str                   # From lab agent
    medication_safety_findings: str            # From medication agent
    potential_concerns: list[str]              # Red flags
    supporting_evidence: list[str]             # Guidelines supporting conclusions
    conflicting_evidence: list[str]            # Contradictions
    uncertainty: str                           # What is not known
    risk_assessment: str                       # From risk agent
    suggested_clinical_review_points: list[str] # Action items for doctor
    verification_status: str                   # Summary of verification
    blockchain_provenance: str                 # Reference to blockchain proof
    disclaimer: str                            # ALWAYS: "AI-generated... clinician final decision"
    confidence: float
```

### Beginner Explanation
Think of this as the **consultant's written report** that the patient's primary doctor receives. It takes input from the cardiologist, the pharmacist, the pathologist, and the risk assessor — and writes one clear, readable, actionable summary.

---

## Agent Summary Table

| # | Agent | Role Key | Mode Weight | When Selected |
|---|-------|----------|-------------|--------------|
| — | Supervisor | `supervisor` | — | Always (orchestrates) |
| 1 | Clinical Reasoning | `clinical_reasoning` | 1.5 | Always |
| 2 | Medical History | `history` | 1.0 | Medication cases, complex |
| 3 | Laboratory | `laboratory` | 1.1 | When lab values mentioned |
| 4 | Pharmacotherapy | `medication` | 1.0 | When medications mentioned |
| 5 | Risk Assessment | `risk` | 1.2 | Lab cases, complex cases |
| 6 | Evidence | `evidence` | 1.0 | Complex cases |
| 7 | Critic | `critic` | 1.3 | Complex/critical cases |
| 8 | Verifier | `verifier` | 1.8 | Always |
| 9 | Synthesizer | `synthesizer` | 2.0 | Always (final output) |
