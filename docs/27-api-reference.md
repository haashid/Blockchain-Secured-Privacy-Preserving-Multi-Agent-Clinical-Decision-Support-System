# 27 — API Reference

## Base URL

| Environment | URL |
|-------------|-----|
| Development | `http://localhost:8000` |
| Swagger UI | `http://localhost:8000/docs` |
| ReDoc | `http://localhost:8000/redoc` |

## Auth Header

All protected endpoints require:
```
Authorization: Bearer <jwt_token>
```

---

## Authentication Endpoints

### POST /api/auth/login
Login and receive a JWT token.

**Request:**
```json
{
  "username": "doctor1",
  "password": "doctor123"
}
```

**Response:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer",
  "role": "doctor",
  "username": "doctor1"
}
```

---

### POST /api/auth/register
Create a new user (Admin only).

**Request:**
```json
{
  "username": "newdoctor",
  "email": "newdoctor@hospital.com",
  "password": "securepassword",
  "role": "doctor"
}
```

---

### GET /api/auth/me
Returns current user profile from JWT.

**Response:**
```json
{
  "id": "uuid",
  "username": "doctor1",
  "email": "doctor@hospital.com",
  "role": "doctor",
  "is_active": true
}
```

---

## Task Endpoints

### POST /api/tasks
Create a new clinical analysis task.

**Access:** admin, operator, doctor

**Request:**
```json
{
  "title": "Diabetic Patient - Sepsis Workup",
  "description": "65-year-old diabetic with fever, elevated WBC...",
  "domain": "healthcare",
  "priority": "high",
  "coordination_mode": "blockchain",
  "patient_context": {
    "age": 65,
    "symptoms": ["fever", "elevated_wbc"],
    "current_medications": ["Metformin", "Lisinopril"],
    "allergies": ["Penicillin"]
  }
}
```

**Response:** Task object with `id`, `status: "pending"`.

---

### POST /api/tasks/{task_id}/execute
Execute the workflow for a task.

**Access:** admin, operator, doctor

**Response:** Full `WorkflowResult` including:
- `agent_outputs` — per-agent structured output  
- `proofs` — list of `DecisionProof` objects with hashes  
- `consensus_result` — agreement score and status  
- `anomalies` — any detected irregularities  
- `events` — chronological event timeline  
- `total_latency_ms`

---

### GET /api/tasks
List tasks.

**Query params:** `limit`, `offset`, `status`, `priority`

---

### GET /api/tasks/{task_id}
Get task detail including all runs and proofs.

---

## Hospital Endpoints

### Patients

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/hospital/patients` | List all patients |
| POST | `/api/hospital/patients` | Create patient |
| GET | `/api/hospital/patients/{id}` | Get patient |
| PUT | `/api/hospital/patients/{id}` | Update patient |

**Patient Object:**
```json
{
  "id": "uuid",
  "first_name": "John",
  "last_name": "Doe",
  "date_of_birth": "1969-03-15",
  "gender": "male",
  "blood_type": "A+",
  "medical_record_number": "MRN-0001",
  "allergies": ["Penicillin"],
  "chronic_conditions": ["Type 2 Diabetes"]
}
```

---

### Doctors

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/hospital/doctors` | List all doctors |
| POST | `/api/hospital/doctors` | Create doctor |
| GET | `/api/hospital/doctors/{id}` | Get doctor |

---

### Appointments

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/hospital/appointments` | List appointments |
| POST | `/api/hospital/appointments` | Create appointment |
| PUT | `/api/hospital/appointments/{id}/status` | Update status |

---

### Medical Records

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/hospital/records` | List records |
| POST | `/api/hospital/records` | Create record |
| GET | `/api/hospital/patients/{id}/records` | Records by patient |

---

## Agent Endpoints

### GET /api/agents
List all registered agents.

**Response:**
```json
[
  {
    "id": "agent-clinical_reasoning-01",
    "display_name": "Clinical Reasoning Agent",
    "role": "clinical_reasoning",
    "trust_score": 98.5,
    "status": "active",
    "total_decisions": 47
  }
]
```

---

### GET /api/agents/{agent_id}
Agent detail including trust score history.

---

## Blockchain Endpoints

### GET /api/blockchain/status
Fabric network status.

**Response:**
```json
{
  "connected": false,
  "fabric_endpoint": "localhost:7051",
  "channel": "mychannel",
  "chaincode": "clinical-decision-cc",
  "mode": "simulation",
  "message": "Fabric gateway: simulated mode"
}
```

---

### GET /api/blockchain/proofs
List all decision proofs.

**Response:**
```json
[
  {
    "proof_id": "proof-abc123-clinical_reasoning",
    "agent_role": "clinical_reasoning",
    "content_hash": "a1b2c3...",
    "fabric_tx_id": "local-f4e3d2c1",
    "fabric_ledger_status": "local",
    "status": "verified",
    "confidence": 0.78,
    "submitted_at": "2025-01-15T10:30:00Z"
  }
]
```

---

### GET /api/blockchain/proofs/{proof_id}
Single proof detail.

---

## Verification Endpoints

### GET /api/verification
List verification records.

---

### POST /api/verification/{proof_id}
Manually trigger verification of a proof.

**Process:**
1. Fetch encrypted blob from MinIO `storage_reference`.
2. Decrypt with AES-GCM.
3. Re-compute SHA-256 of canonical JSON.
4. Compare with `content_hash` on the blockchain.
5. Return `VerificationRecord`.

**Response:**
```json
{
  "proof_id": "proof-abc123-clinical_reasoning",
  "verified": true,
  "blockchain_hash": "a1b2c3...",
  "computed_hash": "a1b2c3...",
  "verification_checks": {
    "hash_match": true,
    "decryption": true,
    "schema": true
  }
}
```

---

## Audit Endpoints

### GET /api/audit
List audit events.

**Query params:** `agent_id`, `event_type`, `from_date`, `to_date`, `limit`

**Response:**
```json
[
  {
    "id": "uuid",
    "event_type": "verification.hash_mismatch",
    "agent_id": "agent-laboratory-01",
    "task_id": "uuid",
    "details": {"severity": "high"},
    "timestamp": "2025-01-15T10:30:00Z"
  }
]
```

---

## Benchmark Endpoints

### POST /api/benchmarks/run
Run a benchmark comparing centralized vs blockchain mode.

**Request:**
```json
{
  "name": "Test Benchmark",
  "num_tasks": 5,
  "modes": ["centralized", "blockchain"]
}
```

**Response:** `BenchmarkResult` with avg/p50/p95/p99 latency for each mode.

---

## Error Codes

| Code | Meaning |
|------|---------|
| `200` | Success |
| `201` | Created |
| `400` | Bad Request — invalid input |
| `401` | Unauthorized — missing/invalid JWT |
| `403` | Forbidden — wrong role |
| `404` | Not Found |
| `422` | Validation Error — Pydantic schema failed |
| `500` | Internal Server Error |

---

## Frontend API Client

The frontend uses `frontend/src/lib/api.ts` for all requests:

```typescript
// Base requester — adds Authorization header from localStorage
async function request<T>(endpoint: string, options = {}): Promise<T> {
    const token = localStorage.getItem("token");
    const response = await fetch(`${API_BASE}${endpoint}`, {
        headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        ...options,
    });
    if (!response.ok) throw new Error(await response.text());
    return response.json();
}
```

Usage with React Query:
```typescript
const { data: tasks } = useQuery({
    queryKey: ["tasks"],
    queryFn: () => api.getTasks(),
});
```
