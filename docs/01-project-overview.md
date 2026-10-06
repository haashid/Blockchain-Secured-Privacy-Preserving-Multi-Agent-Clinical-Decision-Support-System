# 01 — Project Overview

## One-Sentence Description

A hospital clinical decision-support platform where ten specialized AI agents collaboratively analyze patient cases, with every AI decision cryptographically hashed and immutably recorded on a private Hyperledger Fabric blockchain for tamper-evident auditability.

---

## One-Paragraph Description

The **Blockchain-Secured Multi-Agent Clinical Decision Support System** is a full-stack application designed to assist doctors in complex clinical reasoning. When a physician submits a patient case, it is routed through a Supervisor AI that selects the appropriate specialized agents:  clinical reasoning, laboratory analysis, medication safety, risk assessment, evidence-based medicine, critic, verifier, and synthesis. Each agent produces a structured JSON output validated against a Pydantic schema. That output is then canonicalized (sorted JSON), hashed with SHA-256, encrypted with AES-256-GCM, and stored in a MinIO object storage instance. Only the cryptographic hash, agent identity, and metadata are recorded on a permissioned Hyperledger Fabric ledger via gRPC. A verification engine later re-downloads the stored encrypted output, decrypts it, re-hashes it, and compares against the blockchain-stored hash — catching any tampering. Role-based access control ensures doctors see only their portal, patients see only theirs, and admins manage the entire system.

---

## Five-Minute Explanation (For Anyone)

Imagine a hospital where a doctor needs help with a complicated case — a patient with multiple conditions, many medications, and unusual lab results. Normally the doctor might consult several specialists. But specialists are busy, expensive, and geographically scattered.

This project replicates that specialist consultation using AI. Instead of one AI model guessing everything, **ten purpose-built AI agents** each focus on one job:

- One agent looks at lab values and flags abnormalities.
- One checks every medication for dangerous interactions.
- One assesses overall risk and urgency.
- One finds supporting clinical guidelines.
- One acts like a skeptical peer reviewer, challenging the others.
- One does a final safety check.
- One synthesizes everything into a readable report.

The doctor gets a rich, multi-perspective clinical opinion.

But the important question is: **"How do we prove the AI didn't change its answer later?"**

This is where blockchain solves a real problem. Every AI output is mathematically fingerprinted (hashed). That fingerprint is written on a private, tamper-proof blockchain. If anyone ever changes the stored AI report — even one character — the fingerprint no longer matches, and the system raises an alert. The doctor, hospital administrator, or regulatory authority can independently verify that the AI's output is exactly what was recorded at the time of decision.

This creates a complete, auditable, legally defensible trail of every AI-assisted clinical decision.

---

## Technical Explanation (For Engineers)

### Architecture

```
[React Frontend]
     │
     ▼ HTTPS / JWT
[FastAPI Backend]
     │
     ├─ [Auth Service] → PostgreSQL/SQLite (Users)
     ├─ [Hospital Service] → SQLite (Patients, Doctors, Records)
     └─ [Orchestrator] → run_workflow()
            │
            ├─ Supervisor Agent (LLM / Mock)
            ├─ N × Specialist Agents (sequential loop)
            ├─ Critic Agent
            ├─ Verifier Agent
            └─ Synthesizer Agent
                 │
                 ▼
         [Crypto Layer]
         canonical_json() → SHA-256 → AES-GCM encrypt
                 │
         ┌───────┴────────┐
         ▼                ▼
    [MinIO Object      [Fabric Gateway]
     Storage]              │
    (encrypted blob)       ▼ gRPC
                    [Hyperledger Fabric]
                    peer → chaincode → ledger
```

### Key Properties

| Property | Implementation |
|----------|----------------|
| AI Provider | Groq (Llama 3.1) or Mock |
| Agent count | 10 (1 Supervisor + 9 specialists) |
| Schema validation | Pydantic v2 |
| Hash algorithm | SHA-256 (HMAC constant-time verify) |
| Encryption | AES-256-GCM with random 96-bit nonce |
| Storage | MinIO (S3-compatible) |
| Ledger | Hyperledger Fabric (permissioned) |
| Database | SQLite (dev) / PostgreSQL (prod) |
| Frontend | React + Vite + TailwindCSS |

---

## Target Users

| User | Role | Portal |
|------|------|--------|
| Hospital administrator | Manages the system, views all data | Admin portal |
| Physician / Doctor | Submits cases, views AI analysis | Doctor portal |
| Patient | Views their own records and reports | Patient portal |
| Auditor | Inspects blockchain proofs, audit logs | Admin/Audit |
| System operator | Manages agents, tasks, runs | Admin portal |

---

## What Makes This Project Different

1. **Multi-specialist reasoning** rather than single-model answers.
2. **Cryptographic proof** of every AI decision — immutable and verifiable.
3. **Tamper detection** — mathematical proof if any output is altered post-decision.
4. **Role-based portals** — doctors see doctor UI, patients see patient UI.
5. **Privacy by design** — patient data is encrypted; only hashes go on-chain.
6. **Medical safety constraints** — every LLM agent carries mandatory safety preamble.

---

## Current Implementation Status

| Component | Status |
|-----------|--------|
| 10 Agent definitions + Pydantic schemas | ✅ IMPLEMENTED |
| Sequential orchestration with supervisor | ✅ IMPLEMENTED |
| SHA-256 + AES-GCM cryptography | ✅ IMPLEMENTED |
| MinIO encrypted storage | ✅ IMPLEMENTED |
| Fabric gateway (graceful stub) | 🟡 PARTIAL |
| Role-based authentication | ✅ IMPLEMENTED |
| Hospital domain (patients/doctors) | ✅ IMPLEMENTED |
| Multi-agent parallelism | ❌ NOT IMPLEMENTED |
| RAG / vector evidence retrieval | ❌ NOT IMPLEMENTED |
| Agent memory / episodic state | ❌ NOT IMPLEMENTED |
| Native LLM tool calling | ❌ NOT IMPLEMENTED |
