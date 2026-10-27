# MedAgentOS — Manual Testing & Operational Verification Guide

This guide provides exact, reproducible instructions for validating the MedAgentOS clinical decision support platform locally.

---

## 1. Prerequisites & Environment Setup

- **Python**: 3.10+
- **Node.js**: 18.x or 20.x with npm
- **Docker**: (Optional) For live MinIO, ZKP BBS+, and Hyperledger Fabric services

### Environment Configuration (.env)
From the repository root, verify your `.env` file:
```env
# Core API Settings
PORT=8000
HOST=0.0.0.0
ENVIRONMENT=development
JWT_SECRET_KEY=dev-secret-key-do-not-use-in-production-change-in-env-32bytes-min
ENCRYPTION_SECRET_KEY=16_or_32_byte_hex_or_string_key_here!!

# AI Agent Inference Mode: "groq" or "mock"
AI_MODE=groq
GROQ_API_KEY=gsk_your_groq_api_key_here
GROQ_PRIMARY_MODEL=qwen/qwen3.8-27b
GROQ_FALLBACK_MODEL=openai/gpt-oss-20b
MAX_CONCURRENT_AGENTS=3

# External Services (Auto-fallback to bounded local/simulation when offline)
STORAGE_PROVIDER=minio
MINIO_ENDPOINT=localhost:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET=agent-storage

FABRIC_MODE=gateway
ZKP_SERVICE_URL=http://localhost:3000
```

> **Note on Testing Offline**: If you do not have an active Groq API key or hit API rate limits, set `AI_MODE=mock`. All 10 agents will produce deterministic synthetic clinical outputs in < 1 second.

---

## 2. Startup Commands

### Step 1: Database Initialization & Seeding (Idempotent)
Run the one-line initialization script from the root:
```bash
python backend/init.py
```
*Expected Output:*
```text
Initializing DB...
DB Initialized. Seeding...
Seeding OK.
```
*(This idempotently seeds the admin user, specialist agent metadata, sample doctors, and patients without duplicating records.)*

### Step 2: Start the FastAPI Backend
From the repository root:
```bash
uvicorn backend.app:app --host 0.0.0.0 --port 8000 --reload
```
- API Base: `http://localhost:8000`
- Swagger Interactive Docs: `http://localhost:8000/docs`
- Health Endpoint: `http://localhost:8000/health` (Returns `{"status": "ok"}`)

### Step 3: Start the React / Vite Frontend
In a separate terminal:
```bash
cd frontend
npm install
npm run dev
```
- Frontend URL: `http://localhost:5173`

### Step 4 (Optional): Start External Docker Sidecars
To test with live MinIO and ZKP BBS+ Node.js containers:
```bash
docker compose up -d zkp-service minio
```

---

## 3. Verified Demo Accounts

| Role | Username | Password | Intended Workflow |
| :--- | :--- | :--- | :--- |
| **Doctor** | `doctor` | `doctor123` | Patient registry, EHR records, appointments, launch AI review, clinical review gate, approve/reject, issue Rx, release report |
| **Patient** | `patient` | `patient123` | Patient portal, view released clinical reports, active prescriptions, manage consent, view audit access history |
| **Admin** | `admin` | `admin123` | System telemetry, agent registry health, cryptographic audit log, Fabric blockchain ledger inspector |

---

## 4. Verification of External Services Mode

MedAgentOS includes self-diagnostic probes and graceful bounded fallbacks:

| Service | Real Mode Indicator | Fallback / Simulated Indicator | How to Verify |
| :--- | :--- | :--- | :--- |
| **AI Inference** | `provider: "groq"` in logs, real inference latency | `mode: "mock"` in logs | Check `.env` `AI_MODE` or view review timeline |
| **Storage (MinIO)** | `active_provider: "minio"` | `active_provider: "local"`, `is_fallback: true` | `GET /health` or server startup logs |
| **Blockchain** | `is_simulated: false`, Fabric Gateway connected | `is_simulated: true`, `mode: "simulation"` | `GET /api/admin/metrics` or doctor report provenance |
| **ZKP BBS+** | `BBS+ sidecar responded 200` | `zkp_status: "simulated"` or offline unit bypass | `GET /api/admin/metrics` |

---

## 5. End-to-End Doctor-to-Patient Workflow Checklist

Follow this exact sequence to validate the core clinical governance loop:

### Phase A: Doctor Consultation & Clinical Review
1. Open `http://localhost:5173` and log in as Doctor (`doctor` / `doctor123`).
2. Navigate to **Patients** (`/doctor/patients`) -> Verify patient registry renders with real patients (e.g., John Smith, Emily Davis).
3. Click on **John Smith** -> Inspect Patient Profile, medical history, allergies, and current medications.
4. Navigate to **Appointments** (`/doctor/appointments`) -> Verify consultations list renders, and click **Schedule Consultation** to verify modal input validation.
5. Navigate to **Medical Records** (`/doctor/records`) -> Verify clinical notes, lab biomarker ribbons, and vitals cards render.
6. Click **AI Clinical Reviews** (`/doctor/reviews`) -> Click **New Clinical Review**.
7. Enter patient clinical intake (e.g. *"62-year-old male with persistent exertional chest tightness, elevated BP 154/96, history of hyperlipidemia"*).
8. Click **Initiate Multi-Agent Analysis**:
   - Observe live DAG visualization (`Supervisor -> Specialist Agents -> Critic -> Verifier -> Synthesizer`).
   - Check real execution status indicators (each agent card displays duration and status).
9. Once completed, inspect:
   - **Clinical Summary & Differential Diagnoses**
   - **Specialist Agent Outputs** (Clinical Reasoning, Lab, Pharmacology, Risk)
   - **Evidence & Literature Citations** (ACC/AHA guidelines)
   - **Clinical Uncertainties & Missing Information**
   - **Cryptographic Provenance** (SHA-256 hash, Merkle root proof, simulated ledger block timestamp)
10. **Clinician Approval Gate**:
    - Enter clinician clinical notes in the review box.
    - Click **Approve Case** (State transitions to `APPROVED`).
11. **Issue Prescription**:
    - Fill in medication (e.g., *Amlodipine Besylate 5mg once daily*), dosage, instructions.
    - Click **Sign & Issue Prescription** -> Verify confirmation toast and recorded prescription.
12. **Release to Patient**:
    - Enter a patient-friendly summary.
    - Click **Release Report to Patient Portal** (State transitions to `RELEASED`).

### Phase B: Patient Portal & Privacy Verification
13. Click Logout in the top-right corner.
14. Log in as Patient (`patient` / `patient123`).
15. Navigate to **Clinical Reports** (`/patient/reports`):
    - Verify that John Smith sees the newly released clinical report.
    - Verify that **internal AI specialist reasoning traces are hidden** from the patient view (protected on server side).
16. Navigate to **Prescriptions** (`/patient/prescriptions`):
    - Verify the newly authorized Amlodipine prescription is listed with instructions and prescribing doctor name.
17. Navigate to **Consent Management** (`/patient/consent`):
    - Verify granular consent toggles (EHR sharing, AI research, cross-department access).
18. Navigate to **Access History** (`/patient/access-history`):
    - Verify audit log shows truthful access events recorded when the doctor accessed the chart.

### Phase C: Negative Security & Tamper Checks
19. Inspect API security:
    - Log in as patient, attempt `GET /api/hospital/patients/{another_patient_id}/records` -> Verify HTTP `403 Forbidden` (RBAC/IDOR protection).
    - Attempt `POST /api/clinical-reviews/{id}/approve` as patient -> Verify HTTP `403 Forbidden`.
    - Attempt `GET /api/clinical-reviews/{unreleased_id}` as patient -> Verify HTTP `403 Forbidden`.

---

## 6. Automated Regression & Benchmark Verification

To run all automated verification scripts locally:

```bash
# 1. Run all unit tests (83 passing, 25 skipped for external BBS+ sidecar)
python -m pytest tests/unit/ -v

# 2. Run clinical summary and patient identity tests
python -m pytest tests/unit/test_clinical_summary_and_identity.py -v

# 3. Run complete 8-step clinical workflow test
python tests/test_clinical_workflow_e2e.py

# 4. Run full end-to-end audit (24/24 passed)
python tests/test_stage5_audit.py

# 5. Build frontend production bundle
cd frontend && npm run build
```

---

## 7. Troubleshooting & Common Questions

- **Q: Multi-agent execution takes > 60s or fails with Rate Limit?**
  - **A**: Groq free tier has Tokens-Per-Minute (TPM) limits. The client automatically backs off with exponential jitter and falls back to `openai/gpt-oss-20b`. For instant offline evaluation, set `AI_MODE=mock` in `.env`.
- **Q: MinIO or Fabric show as "Simulated" or "Local"?**
  - **A**: This is by design when Docker services are not running. The system never halts or pretends simulated operations are real commits. Start `docker compose up -d` to enable live services.
- **Q: Frontend shows 401 Unauthorized?**
  - **A**: Clear your browser `localStorage` or click Logout to reset expired tokens.
