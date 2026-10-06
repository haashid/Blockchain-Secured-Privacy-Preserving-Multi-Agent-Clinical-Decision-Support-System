# 02 — Problem Statement & Objectives

## The Problem: Why Does This System Need to Exist?

### Problem 1: The "Black Box" AI in Healthcare

Modern hospitals are beginning to use AI for clinical decision support. However, single-LLM systems (like asking one model a medical question) have critical flaws:

- **Hallucination**: LLMs invent medical facts with high confidence.
- **No audit trail**: There is no record of what the AI saw or concluded.
- **No accountability**: If the AI assists in a wrong decision, there is no way to trace what happened.
- **Single point of failure**: One model with one perspective may miss important considerations.

### Problem 2: Lack of Provenance in AI Decision Making

In clinical settings, **provenance** (the ability to trace the origin, history, and integrity of a record) is mandatory. Ask yourself:

> "If a patient is harmed following an AI recommendation, how does a hospital prove what the AI actually said — and that nobody changed it afterward?"

Traditional systems (databases, logs) can be modified by administrators. There is no guarantee that an audit log was not edited after the fact.

### Problem 3: Fragmented Hospital Workflows

Hospital systems often exist as silos:
- The doctor uses one system.
- Lab results come from another system.
- Medication history is in a third.
- An AI tool is asked a generic question without full context.

This fragmentation leads to dangerous information gaps in clinical reasoning.

---

## Why Multi-Agent AI Helps

A **multi-agent system** solves the fragmentation problem by specializing:

| Traditional Single LLM | Multi-Agent System |
|------------------------|-------------------|
| One model handles everything | Each agent is expert at one task |
| High hallucination risk | Agents cross-check each other |
| No internal review | Critic agent challenges all outputs |
| No structured output | Pydantic schemas enforce output format |
| Fixed behavior | Supervisor dynamically selects needed agents |

Instead of asking "Is this patient sick?" to one model, we ask:
- The **Clinical Reasoning Agent**: "What are the differential diagnoses?"
- The **Laboratory Agent**: "What do these lab values mean?"
- The **Medication Agent**: "Are there any drug interactions?"
- The **Risk Agent**: "How urgent is this?"
- The **Critic Agent**: "Is there anything the others got wrong?"
- The **Synthesizer**: "Combine everything into a clear report."

---

## Why Permissioned Blockchain Helps

| Problem | Blockchain Solution |
|---------|-------------------|
| Mutable audit logs | Immutable ledger — committed blocks cannot be changed |
| Centralized trust | Distributed consensus — no single administrator can alter records |
| Unauthorized access | Permissioned network — only enrolled organizations participate |
| Cannot prove AI output authenticity | Hash on-chain proves output was not modified |

### What Blockchain DOES in This Project
- Records the SHA-256 hash of every AI agent's output.
- Records agent identity, task ID, run ID, and timestamp.
- Provides a tamper-evident proof that the hash existed at a specific time.
- Enables verification: re-compute the hash of the stored output and compare with the chain.

### What Blockchain DOES NOT Do
- Does NOT store patient data.
- Does NOT store the actual AI output (only the hash).
- Does NOT guarantee the AI output is medically correct.
- Does NOT replace clinical judgment.
- Does NOT provide real-time clinical decision making.

---

## Project Objectives

### Primary Objectives

1. **Secure AI-Agent Coordination**: Implement a multi-agent clinical reasoning pipeline where specialized agents collaborate to analyze patient cases.

2. **Cryptographic Integrity**: Every agent output is hashed (SHA-256) and encrypted (AES-256-GCM) before storage.

3. **Blockchain Provenance**: Cryptographic proofs are recorded on Hyperledger Fabric — an immutable, permissioned ledger.

4. **Auditability**: A full audit trail (agent, task, run, verification, anomaly events) is maintained in the database.

5. **Role-Based Access Control**: Strict separation between admin, doctor, and patient portals.

6. **Tamper Detection**: Verification engine detects if stored outputs are modified after blockchain commitment.

7. **Clinical Decision Support**: The system assists — not replaces — clinical judgment, always requiring human review.

### Secondary Objectives

8. **Trust Scoring**: Agents are scored based on their verification success rate.

9. **Anomaly Detection**: Rule-based detection for hash mismatches, schema failures, impossible confidence scores.

10. **Benchmarking**: Side-by-side comparison of centralized vs blockchain coordination mode latency.

11. **Hospital Domain Management**: Full patient, doctor, appointment, medical record, and prescription management.

12. **Patient Portal**: Patients can view their own records, appointments, and AI-derived insights.

---

## Project Scope

### In Scope

- Multi-agent AI reasoning for clinical cases (text-based inputs).
- SHA-256 hashing and AES-GCM encryption of AI outputs.
- Hyperledger Fabric integration for decision proof recording.
- Hash-based tamper detection and verification.
- Role-based authentication (admin, doctor, patient, operator, auditor, viewer).
- Hospital domain: patients, doctors, appointments, medical records, prescriptions.
- Real-time event streaming (SSE) for workflow timeline.
- Mock agent mode for development without AI API keys.
- Benchmarking framework comparing centralized vs blockchain modes.

### Out of Scope

- **Autonomous diagnosis**: The system explicitly prohibits autonomous diagnosis.
- **Autonomous prescribing**: The system cannot prescribe medications.
- **FHIR integration**: No HL7 FHIR standard implementation.
- **Real medical device integration**: No EHR, PACS, or HIS integration.
- **RAG (Retrieval Augmented Generation)**: Not currently implemented.
- **HIPAA-compliant deployment**: The current architecture is academic/demonstrative.
- **Multi-hospital Fabric network**: Single organization pair only.
- **Production-grade key management**: Keys are stored in `.env` (academic scope).

---

## Clinical Safety Statement

This system is an **AI-assisted clinical decision support tool**.

It is **NOT**:
- An autonomous diagnosis system.
- A replacement for licensed physicians.
- A prescribing system.
- A HIPAA-compliant clinical tool for real patients.
- A guarantee of medical accuracy.

Every AI agent output contains the mandatory disclaimer:
> *"AI-generated clinical decision support. Final clinical decisions remain with qualified healthcare professionals."*
