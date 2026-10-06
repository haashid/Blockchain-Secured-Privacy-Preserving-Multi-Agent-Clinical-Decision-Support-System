# 06 — Backend Architecture

## Layer Diagram

```mermaid
graph TB
    subgraph API["Layer 1: API (FastAPI Routers)"]
        R_AUTH[/api/auth]
        R_HOSP[/api/hospital]
        R_TASKS[/api/tasks]
        R_AGENTS[/api/agents]
        R_VER[/api/verification]
        R_AUDIT[/api/audit]
        R_BLOCK[/api/blockchain]
        R_BENCH[/api/benchmarks]
    end

    subgraph SVC["Layer 2: Services (Business Logic)"]
        S_AUTH[auth.py]
        S_HOSP[hospital.py]
        S_TASK[task.py]
        S_RUN[run.py]
    end

    subgraph DOMAIN["Layer 3: Domain"]
        M_CORE[models/models.py]
        M_HOSP[models/hospital.py]
        SCH[schemas/schemas.py]
    end

    subgraph ORCH["Layer 4: Orchestrator"]
        WF[workflow.py - run_workflow]
    end

    subgraph AI["Layer 5: Agents"]
        FAC[factory.py]
        REG[registry.py]
        MOCK[mock_agents.py]
        LLM[clinical_agents.py]
    end

    subgraph CRYP["Layer 6: Crypto"]
        CJ[canonical_json.py]
        HS[hashing.py]
        EN[encryption.py]
    end

    subgraph OUT["Layer 7: Output"]
        MIO[storage/minio.py]
        GW[blockchain/gateway.py]
        DB[(SQLite/PostgreSQL)]
    end

    API --> SVC
    SVC --> DOMAIN
    SVC --> DB
    R_TASKS --> WF
    WF --> FAC --> REG
    REG --> MOCK
    REG --> LLM
    WF --> CRYP
    WF --> MIO
    WF --> GW
    WF --> DB
```

---

## Layer 1: API Routers (`backend/api/`)

Each file in `api/` is a FastAPI `APIRouter` mounted to `app.py`.

### `api/auth.py`
- `POST /api/auth/login` — Username/password → JWT token + role
- `POST /api/auth/register` — Admin only: create new user
- `GET /api/auth/me` — Current user profile from JWT

### `api/hospital.py`
All hospital CRUD endpoints under `/api/hospital/`:
- Patients: list, create, get, update
- Doctors: list, create, get
- Appointments: list, create, update status
- Medical Records: list, create, get by patient
- Prescriptions: list, create by doctor

### `api/tasks.py`
- `POST /api/tasks` — Create a new clinical task
- `GET /api/tasks` — List tasks (paginated, filterable)
- `GET /api/tasks/{id}` — Task detail
- `POST /api/tasks/{id}/execute` — **Triggers `run_workflow()`**

### `api/agents.py`
- `GET /api/agents` — List all registered agents from DB
- `GET /api/agents/{id}` — Agent detail + trust history

### `api/verification.py`
- `GET /api/verification` — List verification records
- `POST /api/verification/{proof_id}` — Manually verify a proof

### `api/audit.py`
- `GET /api/audit` — Audit event log (filterable by agent, type, date)

### `api/blockchain.py`
- `GET /api/blockchain/status` — Fabric network health
- `GET /api/blockchain/proofs` — All recorded proofs
- `GET /api/blockchain/proofs/{id}` — Single proof detail

### `api/benchmarks.py`
- `POST /api/benchmarks/run` — Execute benchmark comparing centralized vs blockchain
- `GET /api/benchmarks` — List benchmark results

---

## Layer 2: Services (`backend/services/`)

Services contain the actual database operations. They take async `AsyncSession` as dependency.

### `services/auth.py`

**Key functions**:
```python
authenticate_user(db, username, password) -> User | None
    # Runs timing-safe bcrypt.verify()
    # Returns None if not found or password wrong

create_user(db, username, email, password, role) -> User
    # Hashes password with bcrypt
    # Inserts into users table

seed_default_data(db)
    # Creates admin, doctor1, patient1 if not exist
    # Creates corresponding Doctor and Patient hospital records
```

### `services/hospital.py`

CRUD for all hospital tables:
```python
get_patients(db) -> Sequence[Patient]
create_patient(db, data) -> Patient
get_doctors(db) -> Sequence[Doctor]
create_doctor(db, user_id, data) -> Doctor
get_appointments(db) -> Sequence[Appointment]
create_medical_record(db, data) -> MedicalRecord
```

### `services/task.py`

```python
create_task(db, data, user_id) -> Task
get_task(db, task_id) -> Task | None
list_tasks(db, limit, offset) -> list[Task]
update_task_status(db, task_id, status)
```

### `services/run.py`

```python
create_run(db, task_id, mode) -> Run
update_run_result(db, run_id, result: WorkflowResult)
get_run(db, run_id) -> Run | None
```

---

## Layer 3: Domain Models (`backend/models/`)

### `models/models.py` — AI & System Tables
`User` → `Task` → `Run` → `AgentExecution` → `AgentOutput`  
`Agent` → `AgentIdentity`, `TrustScore`  
`Task` → `DecisionProof` → `VerificationRecord`  
`AuditEvent`, `SystemMetric`, `BenchmarkResult`

### `models/hospital.py` — Hospital Tables  
`Patient` → `Appointment` ← `Doctor`  
`Patient` → `MedicalRecord` ← `Doctor`  
`MedicalRecord` → `Prescription`  
`MedicalRecord.ai_analysis_task_id` → `Task` (connecting hospital to AI)

---

## Layer 4: Orchestrator (`backend/orchestrator/workflow.py`)

This is the **most important file** in the backend.

### `run_workflow()` Signature
```python
async def run_workflow(
    task_id: str,
    task_data: dict,
    mode: str = "blockchain",      # "blockchain" or "centralized"
    storage: StorageProvider | None = None,
    db: AsyncSession | None = None,
    fabric_service = None,
    simulate_tampering: bool = False,
) -> WorkflowResult
```

### Execution Steps (Sequential)
```
Step 1-2:   Create WorkflowResult, add task.created + run.started events
Step 3:     Supervisor.execute(task_data) → required_agents list
Step 4:     create_agents_for_roles(selected_agents)
Step 5-6:   For each agent: execute → validate_output (Pydantic)
Step 7-8:   compute_sha256(output) → canonical_json
Step 9-10:  encrypt_json → storage.put_object (MinIO)
Step 11-12: Build DecisionProof dict
Step 13-15: fabric_service.record_decision_proof(proof) → tx_id
Step 16-20: Verification: get_object → decrypt → compute_sha256 → compare
Step 21-22: Anomaly detection: hash mismatch? → anomalies.append()
Step 22-23: calculate_consensus(outputs, verifications)
Step 24:    Build final_result dict
Step 25:    Return WorkflowResult
```

### `calculate_consensus()` Logic
```python
for each agent:
    score = confidence * (1.1 if verified else 0.8)

weighted_average with:
    synthesizer=2.0, verifier=1.8, clinical_reasoning=1.5,
    critic=1.3, risk=1.2, laboratory=1.1, others=1.0

if agreement_score >= CONSENSUS_THRESHOLD:  status = "accepted"
elif >= 0.50:                               status = "warning"
else:                                        status = "rejected"
```

---

## Layer 5: Agents (`backend/agents/`)

### Mode Selection Logic (`factory.py`)
```python
_AI_MODES = {"mock", "llm", "groq"}

def _resolve_ai_mode(mode: str | None) -> str:
    if mode in _AI_MODES:
        return mode
    # Coordination modes ("blockchain", "centralized") are NOT AI modes
    # Fall back to settings.AI_MODE
    return settings.AI_MODE if settings.AI_MODE in _AI_MODES else "mock"
```

### Registry (`registry.py`)
- Maintains `dict[role_string, agent_class]`.
- `register(cls)` adds both mock and LLM classes.
- `create(role, agent_id, mode)` → instantiates the right class.

---

## Layer 6: Crypto (`backend/crypto/`)

### `canonical_json.py`
```python
canonical_json(data: Any) -> str
    # json.dumps(data, sort_keys=True, separators=(',', ':'), ensure_ascii=True)
    # Deterministic: same data always produces same string, same hash
```

### `hashing.py`
```python
compute_sha256(data: Any) -> str
    # canonical_json(data) → encode UTF-8 → hashlib.sha256 → hexdigest

verify_hash(data: Any, expected_hash: str) -> bool
    # Uses hmac.compare_digest() — CONSTANT TIME — prevents timing attacks
```

### `encryption.py`
```python
_get_key() -> bytes
    # If ENCRYPTION_KEY is 64 hex chars → bytes.fromhex (32 bytes)
    # Otherwise → hashlib.sha256(key.encode()).digest() (32 bytes)

encrypt(plaintext: bytes) -> bytes
    # nonce = os.urandom(12)        # 96-bit random nonce, new each call
    # ciphertext = AESGCM(key).encrypt(nonce, plaintext, None)
    # return nonce + ciphertext     # prepend nonce for later decryption

decrypt(data: bytes) -> bytes
    # nonce = data[:12]
    # AESGCM(key).decrypt(nonce, data[12:], None) → plaintext
    # Raises InvalidTag if ciphertext was tampered
```

---

## Layer 7: Storage (`backend/storage/`)

### `base.py` — Abstract Interface
```python
class StorageProvider(ABC):
    async def put_object(path: str, data: bytes) -> None
    async def get_object(path: str) -> bytes
    async def delete_object(path: str) -> None
    async def object_exists(path: str) -> bool
```

### `minio.py` — MinIO Implementation
- Uses `aioboto3` / Boto3 for MinIO S3 API.
- Bucket: configurable via `MINIO_BUCKET` in `.env`.
- Objects stored as: `tasks/{task_id}/runs/{run_id}/agents/{role}/output.json.enc`.

---

## Core Config (`backend/core/config.py`)

```python
class Settings(BaseSettings):
    DATABASE_URL: str      # sqlite / postgresql connection
    ENCRYPTION_KEY: str    # AES key source
    JWT_SECRET_KEY: str    # HS256 signing key
    JWT_ALGORITHM: str     # "HS256"
    JWT_EXPIRY_MINUTES: int
    
    AI_MODE: str           # "mock" | "llm" | "groq"
    AI_PROVIDER: str       # "groq"
    GROQ_API_KEY: str      # Groq API key (redacted in docs)
    GROQ_MODEL: str        # "llama-3.1-70b-versatile" (heavy agents)
    GROQ_FAST_MODEL: str   # "llama-3.1-8b-instant" (fast agents)
    
    MINIO_ENDPOINT: str    # MinIO host:port
    MINIO_ACCESS_KEY: str
    MINIO_SECRET_KEY: str
    MINIO_BUCKET: str
    
    FABRIC_GATEWAY_ENDPOINT: str   # peer gRPC address
    FABRIC_MSP_ID: str             # "Org1MSP"
    FABRIC_CHANNEL_NAME: str       # "mychannel"
    FABRIC_CHAINCODE_NAME: str     # "clinical-decision-cc"
    FABRIC_CERT_PATH: str          # X.509 identity cert
    FABRIC_KEY_PATH: str           # Private key
    FABRIC_TLS_CERT_PATH: str      # TLS CA cert
    
    CONSENSUS_THRESHOLD: float     # e.g. 0.70
    APP_DEBUG: bool                # SQLAlchemy echo
```
