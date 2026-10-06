# 05 — Repository Structure

## Complete Annotated Directory Tree

```
final project/
│
├── .env                          # Environment variables (NEVER commit secrets)
├── .env.example                  # Template for .env — safe to commit
├── .gitignore                    # Git exclusion rules
├── docker-compose.yml            # All services: Postgres, MinIO, Fabric network
├── Makefile                      # Shortcuts: make start, make test, make deploy
│
├── docs/                         # ← YOU ARE HERE — All documentation
│
├── backend/                      # FastAPI Python application
│   ├── __init__.py
│   ├── app.py                    # FastAPI application factory, startup, routing
│   ├── pyproject.toml            # Python dependencies and build config
│   ├── backend.log               # Runtime logs (auto-generated)
│   │
│   ├── agents/                   # All AI agent definitions
│   │   ├── __init__.py
│   │   ├── base.py               # BaseAgent ABC + all 10 Pydantic output schemas
│   │   ├── factory.py            # create_agent(), create_agents_for_roles()
│   │   ├── registry.py           # AgentRegistry — maps role strings to classes
│   │   ├── clinical/             # Placeholder — currently empty (__init__ only)
│   │   ├── core/                 # Placeholder — currently empty (__init__ only)
│   │   ├── llm/                  # Real LLM (Groq) agents
│   │   │   ├── __init__.py
│   │   │   ├── llm_base.py       # LLMAgent base class — prompt building, Groq call
│   │   │   ├── clinical_agents.py # 10 Groq agent class definitions with prompts
│   │   │   └── groq_client.py    # Groq API client, retry logic, JSON mode
│   │   └── mock/                 # Rule-based mock agents (no API key needed)
│   │       ├── __init__.py
│   │       └── mock_agents.py    # All 10 mock agent implementations
│   │
│   ├── api/                      # FastAPI route handlers
│   │   ├── __init__.py
│   │   ├── auth.py               # POST /auth/login, POST /auth/register
│   │   ├── agents.py             # GET/POST /api/agents
│   │   ├── tasks.py              # CRUD /api/tasks
│   │   ├── runs.py               # GET /api/runs/:id
│   │   ├── verification.py       # GET /api/verification
│   │   ├── audit.py              # GET /api/audit
│   │   ├── blockchain.py         # GET /api/blockchain/status
│   │   ├── benchmarks.py         # POST /api/benchmarks
│   │   └── hospital.py           # All /api/hospital/* endpoints
│   │
│   ├── blockchain/               # Hyperledger Fabric integration
│   │   ├── __init__.py
│   │   └── gateway.py            # FabricGatewayService — connect, submit, query
│   │
│   ├── core/                     # Application core
│   │   ├── __init__.py
│   │   ├── app.py                # (secondary app config if exists)
│   │   ├── config.py             # Pydantic Settings — reads .env
│   │   ├── database.py           # SQLAlchemy engine, session factory, Base
│   │   ├── logging_config.py     # Structlog structured logging setup
│   │   └── security.py           # JWT, bcrypt, token creation/verification
│   │
│   ├── crypto/                   # Cryptographic utilities
│   │   ├── __init__.py
│   │   ├── canonical_json.py     # canonical_json() — deterministic sorted JSON
│   │   ├── hashing.py            # compute_sha256(), verify_hash() (HMAC compare)
│   │   └── encryption.py         # encrypt(), decrypt(), encrypt_json(), decrypt_json()
│   │
│   ├── models/                   # SQLAlchemy ORM models
│   │   ├── __init__.py
│   │   ├── models.py             # Core: User, Agent, AgentIdentity, Task, Run,
│   │   │                         #   AgentExecution, AgentOutput, DecisionProof,
│   │   │                         #   Verification, AuditEvent, TrustScore,
│   │   │                         #   SystemMetric, BenchmarkResult
│   │   └── hospital.py           # Hospital: Patient, Doctor, Appointment,
│   │                             #   MedicalRecord, Prescription
│   │
│   ├── orchestrator/             # Workflow engine
│   │   ├── __init__.py
│   │   └── workflow.py           # run_workflow(), WorkflowResult, calculate_consensus()
│   │
│   ├── schemas/                  # Pydantic request/response schemas
│   │   ├── __init__.py
│   │   └── schemas.py            # TokenResponse, TaskCreate, RunResponse, etc.
│   │
│   ├── services/                 # Business logic CRUD layer
│   │   ├── __init__.py
│   │   ├── auth.py               # authenticate_user(), create_user(), seed users
│   │   ├── task.py               # create_task(), get_task(), list_tasks()
│   │   ├── run.py                # create_run(), update_run_result()
│   │   └── hospital.py           # Patient/Doctor/Appointment/Record CRUD
│   │
│   └── storage/                  # Storage abstraction layer
│       ├── __init__.py
│       ├── base.py               # StorageProvider abstract class
│       └── minio.py              # MinIO implementation (Boto3)
│
├── frontend/                     # React/Vite SPA
│   ├── package.json
│   ├── vite.config.ts
│   ├── tsconfig.json
│   └── src/
│       ├── main.tsx              # React entry point
│       ├── App.tsx               # Router, RequireRole guards, route map
│       ├── index.css             # Global styles, glassmorphic tokens
│       ├── components/
│       │   ├── Layout.tsx        # Sidebar + Outlet — role-aware navigation
│       │   └── ui/               # Shared UI components (cards, buttons, charts)
│       ├── lib/
│       │   ├── api.ts            # Base request() + all API client methods
│       │   ├── hospitalApi.ts    # Hospital-specific API methods
│       │   └── utils.ts          # cn() className utility
│       └── pages/
│           ├── LoginPage.tsx     # Auth form → JWT → role redirect
│           ├── DashboardPage.tsx # Admin main dashboard
│           ├── TasksPage.tsx     # Task list
│           ├── TaskNewPage.tsx   # Create AI analysis task
│           ├── TaskDetailPage.tsx # Task result + timeline
│           ├── RunDetailPage.tsx # Run detail view
│           ├── AgentsPage.tsx    # Agent registry
│           ├── AgentDetailPage.tsx # Single agent + trust history
│           ├── VerificationPage.tsx # Blockchain hash verification
│           ├── AuditPage.tsx     # Audit event log
│           ├── BlockchainPage.tsx # Fabric network status
│           ├── BenchmarksPage.tsx # Latency benchmarks
│           ├── SettingsPage.tsx  # System configuration
│           ├── doctor/
│           │   ├── DoctorDashboard.tsx   # Doctor home
│           │   ├── DoctorPatients.tsx    # Patient list (shell)
│           │   ├── DoctorAppointments.tsx # Appointments (shell)
│           │   ├── DoctorAIReports.tsx   # AI case reports (shell)
│           │   └── DoctorRecords.tsx     # Medical records (shell)
│           └── patient/
│               ├── PatientDashboard.tsx  # Patient home
│               ├── PatientAppointments.tsx # Patient appointments (shell)
│               ├── PatientRecords.tsx    # Patient records (shell)
│               └── PatientPrescriptions.tsx # Prescriptions (shell)
│
├── blockchain/                   # Hyperledger Fabric infrastructure
│   ├── chaincode/
│   │   ├── contract.go           # Main chaincode — all transaction functions
│   │   ├── models.go             # Chaincode asset structs
│   │   └── go.mod                # Go module definition
│   ├── config/                   # Fabric network YAML configs
│   ├── network/                  # Network startup scripts
│   └── scripts/                  # Channel creation, peer join, chaincode deploy
│
└── tests/
    └── verify_fixes.py           # Behavioral test suite (49 tests)
```

---

## Key File Deep-Dive

### `backend/app.py`
**Purpose**: Application entry point and configuration.
**Does**:
- Creates `FastAPI()` instance.
- Mounts all API routers under their prefixes.
- Configures CORS middleware.
- Runs `init_db()` on startup to create tables.
- Runs `get_or_create_default_admin()` to seed demo users.
- Initializes MinIO storage and Fabric connection.

---

### `backend/orchestrator/workflow.py`
**Purpose**: The core business logic of the entire system.
**Key Function**: `run_workflow(task_id, task_data, mode, storage, db, fabric_service, simulate_tampering)`

**Flow**:
1. Run Supervisor → get `required_agents` list.
2. Create agent instances via `create_agents_for_roles()`.
3. For each agent: execute → validate → SHA-256 → AES-GCM → MinIO → Fabric.
4. Run verification (re-download, decrypt, re-hash, compare).
5. Run anomaly detection (hash mismatch → audit event).
6. Calculate consensus (weighted average of confidence scores).
7. Return `WorkflowResult`.

**`calculate_consensus()`**:
- Weighs each agent's confidence score.
- Applies verification bonus (+10%) or penalty (-20%).
- Applies role-specific weights (synthesizer=2.0, verifier=1.8, etc.).
- Returns `agreement_score` and `status` (accepted/warning/rejected).

---

### `backend/agents/base.py`
**Purpose**: Defines all Pydantic output schemas + `BaseAgent` ABC.

**10 Output Schemas**:
1. `SupervisorOutput` — case classification + agent list
2. `ClinicalReasoningOutput` — differential diagnoses
3. `HistoryOutput` — past diagnoses, medications, allergies
4. `LaboratoryOutput` — test results, abnormal values
5. `MedicationOutput` — interaction flags, allergy flags
6. `RiskOutput` — overall_risk, urgency, risk_factors
7. `EvidenceOutput` — evidence_items, sources
8. `CriticOutput` — issues, contradictions, severity
9. `VerificationOutput` — verified bool, checks dict, failures
10. `SynthesisOutput` — full clinical summary + disclaimer

---

### `backend/agents/llm/llm_base.py`
**Purpose**: `LLMAgent` base class all Groq agents inherit from.

**Key methods**:
- `get_system_prompt()`: Builds full prompt = Safety Preamble + Role Instructions + JSON Schema.
- `build_user_prompt()`: Constructs user message from task description + patient context + previous agent outputs.
- `execute()`: Calls `generate_json()` → validates against Pydantic schema → returns dict.

**Safety Preamble** (always injected):
> NEVER fabricate patient data. NEVER claim definitive diagnosis. NEVER prescribe autonomously. Distinguish FACTS from INFERENCE. Flag uncertainty.

---

### `backend/crypto/encryption.py`
**Purpose**: AES-256-GCM encrypt/decrypt for agent outputs.

**`encrypt(plaintext: bytes) → bytes`**:
1. Derive 32-byte key from `settings.ENCRYPTION_KEY` (SHA-256 of the key string).
2. Generate `os.urandom(12)` — 96-bit random nonce.
3. `AESGCM.encrypt(nonce, plaintext, None)` → ciphertext + auth tag.
4. Return `nonce + ciphertext` (concatenated).

**`decrypt(data: bytes) → bytes`**:
1. Split: `nonce = data[:12]`, `ciphertext = data[12:]`.
2. `AESGCM.decrypt(nonce, ciphertext, None)` → plaintext (fails if tampered).

---

### `backend/blockchain/gateway.py`
**Purpose**: Python adapter for Hyperledger Fabric.

**Current Status**: PARTIAL STUB with graceful fallback.
- If `fabric-gateway` Python package is installed AND Fabric network is reachable → uses real gRPC.
- If not → `except ImportError` catches it → falls back to TCP socket check → if unreachable → `_connected = False`.
- In centralized mode → generates `local-{hex}` fake TX IDs.
- In blockchain mode with failed connection → raises `ConnectionError`.

**Key Methods**:
- `connect()` — attempts gRPC to Fabric gateway endpoint.
- `record_decision_proof(proof_data)` — submits `RecordDecisionProof` chaincode transaction.
- `get_decision_proof(proof_id)` — queries `GetDecisionProof` from ledger.
- `get_network_status()` — returns connection state and Fabric config.

---

### `frontend/src/App.tsx`
**Purpose**: Route definitions and role-based access control.

**Key Components**:
- `RequireRole({ children, allowed })`: Checks JWT token + `user_role` from localStorage. Redirects unauthorized users to their own portal.
- `RoleRedirect()`: Smart redirect based on stored role (admin→/admin/dashboard, doctor→/doctor/dashboard, patient→/patient/dashboard).

**Routes**:
- `/login` — public
- `/admin/*` — restricted to `[admin, operator, auditor, viewer]`
- `/doctor/*` — restricted to `[doctor]`
- `/patient/*` — restricted to `[patient]`
- `*` — smart redirect via `RoleRedirect`

---

### `frontend/src/components/Layout.tsx`
**Purpose**: Persistent sidebar + content area.

**Behavior**:
- Reads `user_role` from localStorage.
- Renders role-appropriate navigation: `adminNav`, `doctorNav`, or `patientNav`.
- Collapsible sidebar with icons.
- Logout button clears localStorage and redirects to `/login`.

---

## Suspicious / Obsolete Files

| File | Issue |
|------|-------|
| `backend/agents/clinical/` | Completely empty — was intended for clinical agent implementations but agents were built in `llm/` instead |
| `backend/agents/core/` | Completely empty — no implementation |
| `tree.txt` | Auto-generated debug file — should be in `.gitignore` |
| `backend/backend.log` | Runtime log accidentally in repo directory |
| `BUGFIX_AND_COMPLETION_PLAN.md` | Development artifact — useful for team context |
| `COMPREHENSIVE_ARCHITECTURE_AND_ONBOARDING.md` | Pre-docs artifact — superseded by this `docs/` directory |
