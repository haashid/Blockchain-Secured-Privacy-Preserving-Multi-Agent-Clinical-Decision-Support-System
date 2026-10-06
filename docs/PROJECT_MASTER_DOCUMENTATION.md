# PROJECT MASTER DOCUMENTATION
## Blockchain-Secured Multi-Agent Clinical Decision Support System

**Version**: 1.0  
**Date**: September 2026  
**Status**: Academic Final Project — Production-Simulation Mode

---

# PART 1: PROJECT DESCRIPTION

## One-Line Summary
A hospital AI clinical decision-support platform where ten specialized agents collaboratively analyze patient cases, with every AI output cryptographically hashed and immutably recorded on a private Hyperledger Fabric blockchain.

## Core Value Proposition

| Problem | Solution |
|---------|---------|
| Single AI = single point of failure + hallucination | 10 specialized agents that cross-check each other |
| No proof of what the AI said | SHA-256 hash immutably stored on Fabric blockchain |
| AI outputs can be silently modified | Verification engine detects SHA-256 mismatch |
| Patient data exposed in blockchain | Only hashes on-chain; data AES-encrypted in MinIO |
| Generic AI has no clinical safety constraints | Every agent has mandatory Medical Safety Preamble |

## What Makes It Different
1. Multi-specialist AI reasoning across 10 distinct clinical domains.
2. Per-agent cryptographic provenance — every output fingerprinted.
3. Tamper detection — blockchain catches silent modification.
4. Privacy by design — patient data never on blockchain.
5. Role-based portals — admin, doctor, and patient interfaces.

---

# PART 2: ARCHITECTURE SUMMARY

## Stack
```
Frontend:  React 18 + Vite + TailwindCSS + React Query
Backend:   Python FastAPI + SQLAlchemy AsyncORM
Database:  SQLite (dev) / PostgreSQL (prod)
AI:        Groq (Llama-3.1-70B / 8B) or Mock agents
Crypto:    SHA-256 (hashlib) + AES-256-GCM (cryptography)
Storage:   MinIO (S3-compatible, encrypted blobs)
Blockchain: Hyperledger Fabric 2.x (Go chaincode, gRPC gateway)
```

## Layered Architecture (7 Layers)
```
1. API        → FastAPI routers (authentication, RBAC)
2. Services   → CRUD business logic (auth, hospital, task)
3. Domain     → SQLAlchemy models + Pydantic schemas
4. Orchestrator → run_workflow() — main AI pipeline
5. Agents     → 10 specialized clinical AI agents
6. Crypto     → canonical_json → SHA-256 → AES-GCM
7. Output     → MinIO (encrypted) + Fabric (hash)
```

## Request Flow (Abbreviated)
```
Doctor Login → JWT token (role: "doctor")
  → Submit case → POST /api/tasks → create Task
  → POST /api/tasks/{id}/execute → run_workflow()
  → Supervisor selects required agents
  → Each agent: execute → Pydantic validate → SHA-256 → AES-GCM → MinIO → Fabric
  → Verification: MinIO decrypt → re-hash → compare with Fabric hash
  → calculate_consensus() → WorkflowResult
  → Doctor views clinical summary + blockchain proof
```

---

# PART 3: AGENTS

| # | Agent | Role | Default Weight | When Selected |
|---|-------|------|---------------|--------------|
| — | Supervisor | `supervisor` | N/A | Always |
| 1 | Clinical Reasoning | `clinical_reasoning` | 1.5 | Always |
| 2 | Medical History | `history` | 1.0 | Medication cases |
| 3 | Laboratory | `laboratory` | 1.1 | Lab values mentioned |
| 4 | Pharmacotherapy | `medication` | 1.0 | Drug history |
| 5 | Risk Assessment | `risk` | 1.2 | Complex cases |
| 6 | Evidence | `evidence` | 1.0 | Complex cases |
| 7 | Peer Critic | `critic` | 1.3 | Complex/critical |
| 8 | Verifier | `verifier` | 1.8 | Always |
| 9 | Synthesizer | `synthesizer` | 2.0 | Always (final report) |

**Agent execution**: Currently sequential. Groq model: 70B for heavy reasoning agents, 8B for fast agents.

---

# PART 4: CRYPTOGRAPHIC PIPELINE

## Step-by-Step
```
Agent Output (Python dict)
    ↓ canonical_json()       → deterministic sorted JSON string
    ↓ compute_sha256()       → 64-char hex hash  ← STORED ON FABRIC
    ↓ encrypt_json()         → nonce(12B) + ciphertext  ← STORED IN MINIO
    
Verification:
    MinIO encrypted blob
    ↓ decrypt()              → JSON string (InvalidTag if tampered)
    ↓ json.loads()           → dict
    ↓ compute_sha256()       → computed hash
    ↓ hmac.compare_digest()  → compare with Fabric hash → True/False
```

## Key Security Decisions
- **Canonical JSON**: Guarantees same input always produces same hash.
- **SHA-256**: Industry-standard 256-bit fingerprint.
- **AES-256-GCM**: Authenticated encryption — detects ciphertext tampering.
- **Random 96-bit nonce**: New per encryption — prevents replay attacks.
- **`hmac.compare_digest`**: Constant-time comparison — prevents timing attacks.

---

# PART 5: BLOCKCHAIN

## Hyperledger Fabric vs Ethereum

| Property | Hyperledger Fabric | Ethereum |
|----------|-------------------|---------|
| Permission | Private (invite-only) | Public |
| Gas fees | None | Required |
| Patient data risk | ✅ Channel isolated | ❌ Public visible |
| TPS | 1,000-3,500 | ~15 |
| Identity | X.509 / MSP | Public/private keypair |
| Enterprise adoption | High | Medium |

## What Is Stored on the Blockchain

**STORED**: `proof_id`, `task_id`, `run_id`, `agent_id`, `agent_role`, `org`, `content_hash` (SHA-256), `hash_algorithm`, `storage_reference` (MinIO path), `confidence`, `timestamp`

**NOT STORED**: Patient name, diagnosis, medications, AI output text, any PHI

## Go Chaincode Functions
- `RegisterAgent` — enroll AI agent identity
- `RecordTask` — log new task
- `RecordDecisionProof` ⭐ — record per-agent SHA-256 proof
- `GetDecisionProof` — retrieve proof from ledger
- `VerifyDecisionProof` — record verification result
- `RecordAuditEvent` — log compliance events
- `GetTaskHistory` — CouchDB rich query by task

---

# PART 6: AUTHENTICATION & RBAC

## Roles
`admin` | `operator` | `auditor` | `viewer` | `doctor` | `patient`

## Auth Flow
```
Username + Password → bcrypt.verify() → JWT (HS256, role claim)
JWT → every protected endpoint → check_role() dependency
```

## Frontend
`RequireRole({ allowed: ["doctor"] })` — wraps all role-specific routes.
Unauthorized users redirected to their own portal.

## Demo Credentials
| User | Password | Role |
|------|----------|------|
| `admin` | `admin123` | admin |
| `doctor1` | `doctor123` | doctor |
| `patient1` | `patient123` | patient |

---

# PART 7: HOSPITAL DOMAIN

**Entities**: Patient → Appointment ← Doctor → MedicalRecord → Prescription

**AI Bridge**: `MedicalRecord.ai_analysis_task_id` → `Task` — connects a clinical record to its AI analysis run.

**Patient Context Flow**: Patient demographics + allergies + chronic conditions + lab results → JSON `patient_context` → passed to all AI agents.

---

# PART 8: DATABASE TABLES

| Table | Purpose |
|-------|---------|
| `users` | Authentication (bcrypt passwords, role) |
| `agents` | AI agent registry (trust score, capabilities) |
| `agent_identities` | Fabric X.509 identity mapping |
| `tasks` | Clinical analysis requests |
| `runs` | Workflow executions |
| `agent_executions` | Per-agent run records |
| `agent_outputs` | Agent structured outputs |
| `decision_proofs` | SHA-256 hashes + Fabric TX IDs |
| `verifications` | Hash comparison results |
| `audit_events` | Append-only compliance log |
| `trust_scores` | Agent reliability history |
| `patients` | Patient demographics |
| `doctors` | Physician profiles |
| `appointments` | Patient-doctor scheduling |
| `medical_records` | Clinical documentation |
| `prescriptions` | Active medications |
| `benchmark_results` | Latency comparisons |

---

# PART 9: API QUICK REFERENCE

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/auth/login` | None | Login → JWT |
| POST | `/api/tasks` | doctor/admin | Create clinical task |
| POST | `/api/tasks/{id}/execute` | doctor/admin | Run AI pipeline |
| GET | `/api/agents` | admin | Agent registry |
| GET | `/api/blockchain/status` | admin | Fabric status |
| GET | `/api/blockchain/proofs` | admin/doctor | Decision proofs |
| GET | `/api/audit` | admin/auditor | Audit log |
| GET | `/api/hospital/patients` | admin/doctor | Patient list |
| POST | `/api/benchmarks/run` | admin | Run benchmark |

**Swagger UI**: http://localhost:8000/docs

---

# PART 10: FEATURE IMPLEMENTATION STATUS

| Feature | Status | Notes |
|---------|--------|-------|
| 10 AI Agent system | ✅ COMPLETE | Mock + LLM modes |
| Supervisor dynamic selection | ✅ COMPLETE | Keyword + LLM |
| Pydantic output validation | ✅ COMPLETE | All 10 schemas |
| SHA-256 canonical hashing | ✅ COMPLETE | Constant-time verify |
| AES-256-GCM encryption | ✅ COMPLETE | Random nonce |
| MinIO encrypted storage | ✅ COMPLETE | S3-compatible |
| Fabric gateway | 🟡 STUB | Graceful fallback |
| Go chaincode | ✅ COMPLETE | All functions |
| Tamper detection | ✅ COMPLETE | hash_mismatch audit |
| Role-based auth (JWT) | ✅ COMPLETE | 6 roles |
| Doctor portal | ✅ COMPLETE | React Query wired |
| Patient portal | ✅ COMPLETE | React Query wired |
| Admin portal | ✅ COMPLETE | All pages |
| Hospital domain | ✅ COMPLETE | All entities |
| Consensus calculation | ✅ COMPLETE | Weighted scoring |
| Trust scoring | ✅ COMPLETE | Delta + history |
| Audit event logging | ✅ COMPLETE | 20+ event types |
| Benchmarking | ✅ COMPLETE | p50/p95/p99 |
| Agent parallelism | ❌ NO | Sequential only |
| RAG / evidence retrieval | ❌ NO | LLM training data |
| Agent memory | ❌ NO | Stateless |
| Tool calling | ❌ NO | Context-only |
| Critic re-analysis loop | ❌ NO | Report only |
| Alembic migrations | ❌ NO | create_all() |

---

# PART 11: KNOWN LIMITATIONS

1. **Sequential agents** — `for` loop, not `asyncio.gather()`.
2. **No RAG** — Evidence agent uses training data (may hallucinate guidelines).
3. **No agent memory** — Stateless across sessions.
4. **Fabric in simulation** — Real network requires installed SDK + running peers.
5. **Keys in .env** — No HSM or secrets manager.
6. **PHI to Groq** — Patient context sent externally in LLM mode.
7. **No MFA** — Single-factor auth only.
8. **No rate limiting** — Login brute-force possible.
9. **Critic does not trigger re-runs** — Issues detected but not acted on.
10. **No Alembic** — Schema changes require DB recreation.

---

# PART 12: FOR THE EXAMINER

## Academic Contributions
1. Integration of multi-agent LLM pipeline with per-agent cryptographic provenance.
2. SHA-256 + AES-GCM pattern applied to clinical AI decision recording.
3. Automated tamper detection via Fabric hash comparison.
4. Benchmarking framework for centralized vs blockchain coordination overhead.
5. Agent trust scoring based on verification history.

## What to Demo
- ✅ Role-based login (3 portals)
- ✅ Submit clinical case → 10-agent pipeline executes
- ✅ View per-agent outputs, SHA-256 hashes, Fabric TX IDs
- ✅ Tamper simulation → hash mismatch detected
- ✅ Audit event log showing forensic trail
- ✅ Trust score history for agents

## Key Questions to Prepare
See `docs/33-viva-preparation.md` for 55 questions with full answers.

## What Blockchain DOES
Proves that a specific AI output existed at a specific time with a specific hash. The hash on the immutable ledger catches any post-hoc modification of the stored output.

## What Blockchain DOES NOT DO
Validate clinical accuracy. Guarantee AI safety. Replace physician judgment. Store patient data. Guarantee diagnosis correctness.

---

# PART 13: FILE LOCATIONS

| Item | File Path |
|------|-----------|
| Application entry | `backend/app.py` |
| Core workflow engine | `backend/orchestrator/workflow.py` |
| All agent schemas | `backend/agents/base.py` |
| LLM agents | `backend/agents/llm/clinical_agents.py` |
| Mock agents | `backend/agents/mock/mock_agents.py` |
| Groq client | `backend/agents/llm/groq_client.py` |
| Crypto: canonical JSON | `backend/crypto/canonical_json.py` |
| Crypto: SHA-256 | `backend/crypto/hashing.py` |
| Crypto: AES-GCM | `backend/crypto/encryption.py` |
| Fabric gateway | `backend/blockchain/gateway.py` |
| Go chaincode | `blockchain/chaincode/contract.go` |
| DB models (core) | `backend/models/models.py` |
| DB models (hospital) | `backend/models/hospital.py` |
| Settings/config | `backend/core/config.py` |
| Auth service | `backend/services/auth.py` |
| Hospital service | `backend/services/hospital.py` |
| React router + RBAC | `frontend/src/App.tsx` |
| Sidebar layout | `frontend/src/components/Layout.tsx` |
| API client | `frontend/src/lib/api.ts` |
| Hospital API client | `frontend/src/lib/hospitalApi.ts` |
| Test suite | `tests/verify_fixes.py` |
| Environment config | `.env` |
| Documentation index | `docs/README.md` |
| Viva Q&A | `docs/33-viva-preparation.md` |
| Glossary | `docs/34-glossary.md` |
| Demo script | `docs/30-demo-and-presentation.md` |
