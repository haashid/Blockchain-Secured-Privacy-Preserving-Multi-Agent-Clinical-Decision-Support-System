"""Mock agent implementations for demo/testing without LLM API keys."""

import uuid
from datetime import datetime, timezone

from backend.agents.base import (
    BaseAgent,
    ClinicalReasoningOutput,
    CriticOutput,
    EvidenceOutput,
    HistoryOutput,
    LaboratoryOutput,
    MedicationOutput,
    RiskOutput,
    SupervisorOutput,
    SynthesisOutput,
    VerificationOutput,
)


class MockSupervisorAgent(BaseAgent):
    name = "Clinical Supervisor"
    role = "supervisor"
    capabilities = ["task_classification", "agent_selection", "execution_planning"]
    system_instructions = "Coordinate clinical case review by selecting appropriate specialist agents."

    async def execute(self, task: dict, context: dict | None = None) -> dict:
        desc = task.get("description", "").lower()
        complexity = "medium"
        required = ["clinical_reasoning", "verifier", "synthesizer"]

        if any(w in desc for w in ["lab", "test", "blood", "hemoglobin", "cbc"]):
            required.insert(1, "laboratory")
            required.insert(2, "risk")
        if any(w in desc for w in ["medication", "drug", "prescription", "dose"]):
            required.insert(1, "medication")
            required.insert(2, "history")
        if any(w in desc for w in ["complex", "multiple", "severe", "critical", "emergency"]):
            complexity = "high"
            for r in ["history", "evidence", "risk", "critic"]:
                if r not in required:
                    required.insert(-1, r)
        if complexity == "high" and "critic" not in required:
            required.insert(-1, "critic")

        # Build parallel groups: specialists run in parallel, then critic, then verifier, then synthesizer
        specialists = [r for r in required if r not in ("critic", "verifier", "synthesizer")]
        parallel_groups = [specialists] if specialists else [required]

        return SupervisorOutput(
            case_type="clinical_case_review",
            complexity=complexity,
            required_agents=required,
            required_tools=["patient_record", "medical_knowledge"],
            verification_required=True,
            human_review_required=True,
            execution_plan={
                "parallel_groups": parallel_groups,
                "sequential_order": required,
                "estimated_steps": len(required),
                "max_reasoning_rounds": 3,
            },
            reasoning_summary=f"Classified case as {complexity} complexity requiring {len(required)} specialist agents.",
        ).model_dump()


class MockClinicalReasoningAgent(BaseAgent):
    name = "Clinical Reasoning Agent"
    role = "clinical_reasoning"
    capabilities = ["symptom_analysis", "condition_differential", "clinical_assessment"]
    system_instructions = "Analyze clinical presentation and identify possible conditions."

    async def execute(self, task: dict, context: dict | None = None) -> dict:
        desc = task.get("description", "Patient presents with symptoms")
        ctx = task.get("patient_context") or {}

        conditions = []
        findings = []
        if "fever" in desc.lower() or ctx.get("temperature", 0) > 38.0:
            conditions.append({"condition": "Infection", "probability": 0.75, "type": "infectious"})
            findings.append("Elevated temperature suggests infectious process")
        if "chest" in desc.lower() or "cardiac" in desc.lower():
            conditions.append({"condition": "Cardiac Event", "probability": 0.45, "type": "cardiovascular"})
            findings.append("Chest symptoms require cardiac evaluation")
        if "pain" in desc.lower():
            findings.append("Pain assessment requires localization and characterization")
        if "diabetes" in desc.lower() or ctx.get("diabetic"):
            conditions.append({"condition": "Metabolic Complication", "probability": 0.6, "type": "metabolic"})

        if not conditions:
            conditions.append({"condition": "Undetermined - requires further workup", "probability": 0.3, "type": "unknown"})
            findings.append("Insufficient clinical information for definitive assessment")

        return ClinicalReasoningOutput(
            agent_id=self.agent_id,
            summary=f"Clinical analysis of case: {len(conditions)} potential conditions identified.",
            possible_conditions=conditions,
            supporting_findings=findings,
            contradicting_findings=[],
            missing_information=["Complete blood count", "Vital signs trending", "Patient history"],
            confidence=0.78,
            uncertainties=["Limited patient history available", "No imaging results yet"],
        ).model_dump()


class MockHistoryAgent(BaseAgent):
    name = "Medical History Agent"
    role = "history"
    capabilities = ["longitudinal_analysis", "medication_history", "allergy_review"]
    system_instructions = "Analyze longitudinal patient information and identify relevant history."

    async def execute(self, task: dict, context: dict | None = None) -> dict:
        return HistoryOutput(
            agent_id=self.agent_id,
            summary="Retrieved and analyzed patient longitudinal history. Key findings documented.",
            previous_diagnoses=[
                {"diagnosis": "Type 2 Diabetes Mellitus", "year": 2019, "status": "active"},
                {"diagnosis": "Hypertension", "year": 2020, "status": "controlled"},
            ],
            medications=[
                {"name": "Metformin", "dose": "500mg", "frequency": "twice daily"},
                {"name": "Lisinopril", "dose": "10mg", "frequency": "once daily"},
            ],
            allergies=["Penicillin", "Sulfa drugs"],
            procedures=[
                {"procedure": "Appendectomy", "year": 2015, "outcome": "successful"},
            ],
            significant_changes=["Recent HbA1c increase noted", "Blood pressure trending upward"],
            confidence=0.85,
        ).model_dump()


class MockLaboratoryAgent(BaseAgent):
    name = "Laboratory Analysis Agent"
    role = "laboratory"
    capabilities = ["lab_analysis", "abnormality_detection", "trend_analysis"]
    system_instructions = "Analyze laboratory test results and identify abnormalities."

    async def execute(self, task: dict, context: dict | None = None) -> dict:
        return LaboratoryOutput(
            agent_id=self.agent_id,
            summary="Laboratory analysis completed. Multiple values outside reference ranges detected.",
            test_results=[
                {"test": "hemoglobin", "value": 10.2, "unit": "g/dL", "reference": "12.0-16.0", "status": "abnormal_low"},
                {"test": "white_blood_cells", "value": 12500, "unit": "/uL", "reference": "4500-11000", "status": "abnormal_high"},
                {"test": "glucose", "value": 186, "unit": "mg/dL", "reference": "70-100", "status": "abnormal_high"},
                {"test": "creatinine", "value": 1.1, "unit": "mg/dL", "reference": "0.7-1.3", "status": "normal"},
            ],
            abnormal_values=[
                {"test": "hemoglobin", "deviation": "low", "clinical_relevance": "May indicate anemia or chronic disease"},
                {"test": "white_blood_cells", "deviation": "high", "clinical_relevance": "Suggests possible infection or inflammatory response"},
                {"test": "glucose", "deviation": "high", "clinical_relevance": "Poor glycemic control, consistent with diabetes history"},
            ],
            trends=["WBC trending upward over past 3 results", "Hemoglobin slowly declining"],
            missing_tests=["Procalcitonin", "Blood culture", "Lactate"],
            confidence=0.88,
        ).model_dump()


class MockMedicationAgent(BaseAgent):
    name = "Medication Safety Agent"
    role = "medication"
    capabilities = ["interaction_check", "allergy_check", "dosage_review"]
    system_instructions = "Review medications for safety including interactions, allergies, and dosage."

    async def execute(self, task: dict, context: dict | None = None) -> dict:
        return MedicationOutput(
            agent_id=self.agent_id,
            summary="Medication review completed. One potential interaction flag identified.",
            medications_reviewed=[
                {"name": "Metformin", "dose": "500mg", "frequency": "BID", "status": "reviewed"},
                {"name": "Lisinopril", "dose": "10mg", "frequency": "QD", "status": "reviewed"},
            ],
            interaction_flags=[
                {"drug_a": "Metformin", "drug_b": "Lisinopril", "severity": "low",
                 "description": "ACE inhibitors may enhance hypoglycemic effect of metformin"}
            ],
            allergy_flags=[],
            duplicate_flags=[],
            risk_level="low",
            requires_clinician_review=True,
            confidence=0.92,
        ).model_dump()


class MockRiskAgent(BaseAgent):
    name = "Clinical Risk Agent"
    role = "risk"
    capabilities = ["risk_assessment", "urgency_scoring", "data_quality_analysis"]
    system_instructions = "Produce structured case risk assessment."

    async def execute(self, task: dict, context: dict | None = None) -> dict:
        return RiskOutput(
            agent_id=self.agent_id,
            summary="Risk assessment completed. Moderate overall risk with elevated urgency.",
            overall_risk="medium",
            risk_factors=[
                {"factor": "Elevated WBC", "weight": 0.3, "description": "Possible infection"},
                {"factor": "Poor glycemic control", "weight": 0.25, "description": "Glucose 186 mg/dL"},
                {"factor": "Anemia", "weight": 0.2, "description": "Hemoglobin 10.2 g/dL"},
            ],
            missing_data=["Blood cultures", "Imaging", "Complete medication reconciliation"],
            urgency="medium",
            confidence=0.82,
        ).model_dump()


class MockEvidenceAgent(BaseAgent):
    name = "Medical Evidence Agent"
    role = "evidence"
    capabilities = ["literature_search", "guideline_retrieval", "evidence_synthesis"]
    system_instructions = "Search medical knowledge bases for supporting evidence."

    async def execute(self, task: dict, context: dict | None = None) -> dict:
        # Check if RAG evidence was provided via workflow
        rag_evidence = task.get("rag_evidence", "")
        rag_metadata = task.get("rag_metadata", {})

        if rag_evidence and "Retrieved 0 evidence" not in rag_evidence:
            # RAG evidence available — use it
            return EvidenceOutput(
                agent_id=self.agent_id,
                summary="Analyzed retrieved medical evidence for the clinical case.",
                evidence_items=[
                    {"evidence_id": "EV-mock-001", "title": "Clinical Guidelines",
                     "source_type": "knowledge_based", "claim_supported": "Based on clinical guidelines"},
                ],
                sources_checked=["Knowledge base retrieval"],
                supported_claims=[{"claim": "Based on retrieved evidence", "evidence_ids": ["EV-mock-001"], "rationale": "Matched guidelines"}],
                unsupported_claims=[],
                knowledge_gaps=[],
                insufficient_evidence=False,
                confidence=0.85,
            ).model_dump()

        # No RAG evidence — knowledge-based only
        return EvidenceOutput(
            agent_id=self.agent_id,
            summary="Knowledge-based analysis (no retrieved evidence available).",
            evidence_items=[],
            sources_checked=["LLM training knowledge"],
            supported_claims=[],
            unsupported_claims=[{"claim": "General medical knowledge applied", "reason": "No retrieved evidence"}],
            knowledge_gaps=["No relevant documents in knowledge base"],
            insufficient_evidence=False,
            confidence=0.70,
        ).model_dump()


class MockCriticAgent(BaseAgent):
    name = "Clinical Critic Agent"
    role = "critic"
    capabilities = ["adversarial_review", "contradiction_detection", "quality_assurance"]
    system_instructions = "Challenge other agents' outputs and identify issues."

    async def execute(self, task: dict, context: dict | None = None) -> dict:
        previous_outputs = task.get("previous_outputs", {})
        issues = []
        target_agents = []

        # Check for overconfidence
        for agent_role, output in previous_outputs.items():
            if isinstance(output, dict) and output.get("confidence", 0) > 0.95:
                issues.append({
                    "type": "overconfidence",
                    "agent": agent_role,
                    "description": f"{agent_role} reported unusually high confidence",
                    "severity": "low",
                })
                target_agents.append(agent_role)

        requires_reanalysis = len(target_agents) > 0 and any(
            i.get("severity") in ("high", "critical") for i in issues
        )

        return CriticOutput(
            agent_id=self.agent_id,
            issues=issues,
            contradictions=[],
            missing_evidence=["Imaging results", "Microbiology cultures"],
            severity="low" if not issues else "medium",
            requires_reanalysis=requires_reanalysis,
            target_agents=target_agents,
            confidence=0.85,
        ).model_dump()


class MockVerifierAgent(BaseAgent):
    name = "Verification Agent"
    role = "verifier"
    capabilities = ["schema_validation", "integrity_check", "cross_agent_agreement"]
    system_instructions = "Verify the integrity and consistency of all agent outputs."

    async def execute(self, task: dict, context: dict | None = None) -> dict:
        checks = {
            "schema": True,
            "evidence": True,
            "calculations": True,
            "cross_agent": True,
            "integrity": True,
            "blockchain": True,
        }
        return VerificationOutput(
            agent_id=self.agent_id,
            verified=True,
            checks=checks,
            failures=[],
            confidence=0.95,
        ).model_dump()


class MockSynthesizerAgent(BaseAgent):
    name = "Clinical Synthesis Agent"
    role = "synthesizer"
    capabilities = ["report_generation", "decision_support", "clinical_summary"]
    system_instructions = "Synthesize all agent outputs into a clinical decision-support report."

    async def execute(self, task: dict, context: dict | None = None) -> dict:
        previous = task.get("previous_outputs", {})
        reasoning = previous.get("clinical_reasoning", {})
        labs = previous.get("laboratory", {})
        risk = previous.get("risk", {})
        meds = previous.get("medication", {})

        conditions = reasoning.get("possible_conditions", [])
        condition_list = ", ".join(
            c.get("condition", "Unknown") for c in conditions
        ) if conditions else "under evaluation"

        return SynthesisOutput(
            agent_id=self.agent_id,
            case_summary=f"Clinical case review: Patient presents with symptoms consistent with {condition_list}. "
                         f"Multiple lab abnormalities detected requiring clinical correlation.",
            relevant_history="Type 2 DM (2019), Hypertension (2020), Appendectomy (2015). Current medications: Metformin, Lisinopril. Allergies: Penicillin, Sulfa.",
            clinical_findings=reasoning.get("summary", "Clinical analysis performed."),
            laboratory_findings=labs.get("summary", "Lab results analyzed."),
            medication_safety_findings=meds.get("summary", "Medication review completed."),
            potential_concerns=[
                "Elevated WBC may indicate active infection",
                "Poor glycemic control requiring medication adjustment",
                "Mild anemia requiring further investigation",
            ],
            supporting_evidence=["CDC Diabetes Guidelines", "IDSA Infection Protocol", "ASH Anemia Guidelines"],
            conflicting_evidence=[],
            uncertainty="Microbiology results pending. Imaging recommended.",
            risk_assessment=f"Overall risk: {risk.get('overall_risk', 'medium')}. Urgency: {risk.get('urgency', 'medium')}.",
            suggested_clinical_review_points=[
                "Order blood cultures and urinalysis",
                "Review and adjust diabetes medication",
                "Monitor WBC trend",
                "Consider infectious disease consultation",
            ],
            verification_status="Verified - all agent outputs consistent",
            blockchain_provenance="Decision proofs registered on Hyperledger Fabric",
            confidence=0.82,
        ).model_dump()
