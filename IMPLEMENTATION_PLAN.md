# 🏥 Implementation Plan — Blockchain-Secured Multi-Agent Clinical Decision Support System

> **Project**: Secure Multi-Agent AI Coordination Framework  
> **Goal**: Transform the existing admin-only mock system into a **fully functional hospital platform** with real AI agents (Groq), real blockchain (Hyperledger Fabric), and patient/doctor portals — all testable end-to-end.  
> **Date**: 2026-09-02

---

## 📊 Current State Summary

| Component | Status | Notes |
|-----------|--------|-------|
| **Admin Dashboard (Frontend)** | ✅ Done | 13 pages, glassmorphic UI, Recharts, React Query |
| **FastAPI Backend** | ✅ Done | 30+ endpoints, JWT auth, SQLAlchemy models |
| **Agent Architecture** | 🟡 Mock only | `BaseAgent` + 10 mock agents with fake outputs |
| **Orchestrator Pipeline** | ✅ Done | 25-step workflow with crypto hashing, consensus |
| **Blockchain Chaincode (Go)** | ✅ Done | 635-line contract with tests, ready to deploy |
| **Blockchain Gateway (Python)** | 🟡 Stub | Socket check only, returns fake tx-ids |
| **Fabric Network Scripts** | ✅ Done | setup.sh, start.sh, stop.sh, deploy-chaincode.sh |
| **Verification Service** | ✅ Done | 10-step algorithm with storage+hash verification |
| **Trust Scoring** | ✅ Done | Dynamic scoring with rewards/deductions |
| **Encryption/Hashing** | ✅ Done | AES encryption, SHA-256, canonical JSON |
| **MinIO Storage** | ✅ Done | Docker-compose configured, factory pattern |
| **Hospital Patient/Doctor System** | ❌ Not started | No patient or doctor models, pages, or APIs |
| **Real LLM Integration** | ❌ Not started | Factory hardcoded to mock agents only |
| **Real Fabric Connection** | ❌ Not started | Gateway is a stub |

---

## 🗺️ Phase Overview

| Phase | Title | Priority | Est. Effort |
|-------|-------|----------|-------------|
| **1** | Groq LLM Agent Integration | 🔴 Critical | 3-4 hours |
| **2** | Hospital System — Backend (Patient/Doctor/Appointments) | 🔴 Critical | 4-5 hours |
| **3** | Hospital System — Frontend (Patient & Doctor Portals) | 🔴 Critical | 5-6 hours |
| **4** | Real Hyperledger Fabric Blockchain | 🟠 High | 3-4 hours |
| **5** | Full-Stack Wiring & Integration | 🟠 High | 2-3 hours |
| **6** | Testing & Hardening | 🟡 Medium | 2-3 hours |

---

## ═══════════════════════════════════════════════════════════════
## PHASE 1 — Groq LLM Agent Integration
## ═══════════════════════════════════════════════════════════════

**Objective**: Replace ALL mock agents with real Groq-powered LLM agents. Every agent produces genuine clinical reasoning via structured prompts.

### Task 1.1 — Groq Client Module
**File**: `backend/agents/llm/groq_client.py` (NEW)
- [ ] Install `groq` Python SDK (`pip install groq`)
- [ ] Create async Groq client wrapper with retry logic and timeout
- [ ] Support structured JSON output via system prompts
- [ ] Rate limiting handler (Groq has rate limits per model)
- [ ] Error handling: graceful fallback message if Groq API fails

### Task 1.2 — LLM Agent Base Class
**File**: `backend/agents/llm/llm_base.py` (NEW)
- [ ] Create `LLMAgent(BaseAgent)` subclass
- [ ] Each agent gets a role-specific system prompt
- [ ] `execute()` method: builds prompt → calls Groq → parses JSON → validates against Pydantic schema
- [ ] Support different Groq models (e.g., `llama-3.3-70b-versatile`, `llama-3.1-8b-instant`)
- [ ] Token usage tracking for audit/logging

### Task 1.3 — Implement All 10 LLM Agents
**File**: `backend/agents/llm/clinical_agents.py` (NEW)
- [ ] `GroqSupervisorAgent` — classifies case, selects required agents, builds plan
- [ ] `GroqClinicalReasoningAgent` — differential diagnosis from patient context
- [ ] `GroqHistoryAgent` — analyzes medical history, flags significant changes
- [ ] `GroqLaboratoryAgent` — interprets lab values, flags abnormals
- [ ] `GroqMedicationAgent` — drug interactions, allergy checks, dosage review
- [ ] `GroqRiskAgent` — overall risk stratification
- [ ] `GroqEvidenceAgent` — evidence-based medicine references
- [ ] `GroqCriticAgent` — adversarial review of other agent outputs
- [ ] `GroqVerifierAgent` — cross-validates consistency
- [ ] `GroqSynthesizerAgent` — synthesizes all outputs into final clinical summary

Each agent MUST:
- Use the existing Pydantic output schemas from `backend/agents/base.py`
- Include medical disclaimers in prompts
- Return `confidence` score (0.0-1.0)

### Task 1.4 — Update Agent Factory
**File**: `backend/agents/factory.py` (MODIFY)
- [ ] When `AI_MODE=groq` or `AI_MODE=llm`, create `Groq*Agent` instances
- [ ] Keep mock agents accessible with `AI_MODE=mock`
- [ ] Registry auto-registers both mock and LLM agent classes

### Task 1.5 — Update Config
**File**: `backend/core/config.py` (MODIFY)
- [ ] Add `GROQ_API_KEY: str = ""` setting
- [ ] Add `GROQ_MODEL: str = "llama-3.3-70b-versatile"` setting
- [ ] Add `GROQ_FAST_MODEL: str = "llama-3.1-8b-instant"` (for less critical agents)
- [ ] Extend `AI_MODE` to: `Literal["mock", "llm", "groq"]`
- [ ] Extend `AI_PROVIDER` to: `Literal["mock", "ollama", "openai", "groq"]`

### Task 1.6 — Update .env
**File**: `.env` (MODIFY)
- [ ] Add `GROQ_API_KEY=<user_provides_this>`
- [ ] Set `AI_MODE=groq`
- [ ] Set `AI_PROVIDER=groq`

### Task 1.7 — Add `groq` to Dependencies
**File**: `backend/pyproject.toml` (MODIFY)
- [ ] Add `"groq>=0.9.0"` to `dependencies`

---

## ═══════════════════════════════════════════════════════════════
## PHASE 2 — Hospital System Backend (Doctor/Patient/Appointments)
## ═══════════════════════════════════════════════════════════════

**Objective**: Build the actual hospital domain — patients, doctors, appointments, medical records — so the multi-agent system has **real clinical data** to reason about.

### Task 2.1 — Hospital Data Models
**File**: `backend/models/hospital.py` (NEW)
- [ ] `Patient` model:
  - id (UUID), first_name, last_name, date_of_birth, gender, blood_type
  - phone, email, emergency_contact
  - medical_record_number (unique), insurance_id
  - allergies (JSON), chronic_conditions (JSON)
  - created_at, updated_at
- [ ] `Doctor` model:
  - id (UUID), user_id (FK to User), first_name, last_name
  - specialization, license_number, department
  - years_of_experience, qualifications (JSON)
  - is_available (bool), created_at
- [ ] `Appointment` model:
  - id (UUID), patient_id (FK), doctor_id (FK)
  - scheduled_at, duration_minutes, status (scheduled/in_progress/completed/cancelled)
  - chief_complaint, notes, priority
  - linked_task_id (FK to Task, nullable) — links to AI analysis
  - created_at, updated_at
- [ ] `MedicalRecord` model:
  - id (UUID), patient_id (FK), doctor_id (FK), appointment_id (FK, nullable)
  - record_type (consultation/lab_result/prescription/imaging/discharge_summary)
  - title, content (JSON — flexible clinical data)
  - vitals (JSON: bp, hr, temp, spo2, weight, height)
  - lab_results (JSON), prescriptions (JSON)
  - diagnosis_codes (JSON — ICD-10), notes
  - ai_analysis_task_id (FK to Task, nullable) — links to multi-agent run
  - created_at
- [ ] `Prescription` model:
  - id (UUID), medical_record_id (FK), patient_id (FK), doctor_id (FK)
  - medication_name, dosage, frequency, duration, instructions
  - is_active, prescribed_at

### Task 2.2 — Hospital Pydantic Schemas
**File**: `backend/schemas/hospital.py` (NEW)
- [ ] Request/Response schemas for Patient CRUD
- [ ] Request/Response schemas for Doctor CRUD
- [ ] Request/Response schemas for Appointment CRUD
- [ ] Request/Response schemas for MedicalRecord CRUD
- [ ] `PatientSummaryForAI` schema — flattened view sent to AI agents
- [ ] `AIAnalysisRequest` schema — doctor requests AI analysis on a patient case
- [ ] `AIAnalysisResponse` schema — results from multi-agent pipeline

### Task 2.3 — Hospital Services Layer
**Files** (ALL NEW):
- [ ] `backend/services/patient.py` — CRUD, search by name/MRN, patient history aggregation
- [ ] `backend/services/doctor.py` — CRUD, availability management, department listing
- [ ] `backend/services/appointment.py` — booking, cancellation, status transitions, schedule queries
- [ ] `backend/services/medical_record.py` — create records, attach lab results, link prescriptions
- [ ] `backend/services/ai_analysis.py` — **KEY SERVICE**: Takes a patient case → builds `patient_context` → creates a Task → runs the multi-agent pipeline → returns results with blockchain proof IDs

### Task 2.4 — Hospital API Routes
**File**: `backend/app.py` (MODIFY) or `backend/api/hospital.py` (NEW router)
- [ ] **Patient routes**: `POST /api/hospital/patients`, `GET /api/hospital/patients`, `GET /api/hospital/patients/{id}`, `PATCH /api/hospital/patients/{id}`, `GET /api/hospital/patients/{id}/records`, `GET /api/hospital/patients/{id}/appointments`
- [ ] **Doctor routes**: `POST /api/hospital/doctors`, `GET /api/hospital/doctors`, `GET /api/hospital/doctors/{id}`, `PATCH /api/hospital/doctors/{id}`, `GET /api/hospital/doctors/{id}/schedule`
- [ ] **Appointment routes**: `POST /api/hospital/appointments`, `GET /api/hospital/appointments`, `PATCH /api/hospital/appointments/{id}`, `POST /api/hospital/appointments/{id}/complete`
- [ ] **Medical Record routes**: `POST /api/hospital/records`, `GET /api/hospital/records/{id}`, `GET /api/hospital/patients/{id}/records`
- [ ] **AI Analysis route**: `POST /api/hospital/patients/{patient_id}/analyze` — this is the **main flow**: doctor clicks "Request AI Analysis" → patient data is sent through the multi-agent pipeline → results come back with blockchain proofs
- [ ] **Prescription routes**: `POST /api/hospital/prescriptions`, `GET /api/hospital/patients/{id}/prescriptions`

### Task 2.5 — Doctor & Patient User Roles
**File**: `backend/models/models.py` (MODIFY)
- [ ] Add `"doctor"` and `"patient"` to `user_role` enum
- [ ] Add `doctor_profile_id` FK on User (nullable, for doctor users)
- [ ] Add `patient_profile_id` FK on User (nullable, for patient users)

**File**: `backend/services/auth.py` (MODIFY)
- [ ] Support doctor/patient registration (separate endpoints)
- [ ] Doctor registration creates both User + Doctor profile
- [ ] Patient registration creates both User + Patient profile
- [ ] Seed 3 demo doctors and 5 demo patients on startup

### Task 2.6 — AI Analysis Integration Service
**File**: `backend/services/ai_analysis.py` (NEW)
- [ ] `request_ai_analysis(patient_id, doctor_id, chief_complaint, ...)`:
  1. Load patient's full medical history (records, allergies, meds, vitals)
  2. Build `patient_context` dict matching what agents expect
  3. Create a `Task` with `domain="healthcare"` and `coordination_mode="blockchain"`
  4. Call `run_workflow()` from orchestrator
  5. Store the result, link back to appointment/medical_record
  6. Return analysis with proof IDs for blockchain verification
- [ ] This is where the hospital system meets the admin/agent system — the admin dashboard tracks the agent runs, proofs, and trust scores that result from real hospital requests

---

## ═══════════════════════════════════════════════════════════════
## PHASE 3 — Hospital Frontend (Patient & Doctor Portals)
## ═══════════════════════════════════════════════════════════════

**Objective**: Build two new portal views — one for **doctors** and one for **patients** — alongside the existing admin dashboard.

### Task 3.1 — Frontend Routing Architecture
**File**: `frontend/src/App.tsx` (MODIFY)
- [ ] Add role-based routing:
  - `/admin/*` → Existing admin dashboard (admin/operator roles)
  - `/doctor/*` → Doctor portal (doctor role)
  - `/patient/*` → Patient portal (patient role)
  - `/login` → Unified login, redirects based on role
- [ ] Create `RoleGuard` component that checks user role

### Task 3.2 — Hospital API Client
**File**: `frontend/src/lib/hospitalApi.ts` (NEW)
- [ ] `patientsApi` — CRUD operations for patients
- [ ] `doctorsApi` — doctor management
- [ ] `appointmentsApi` — booking, listing, status updates
- [ ] `medicalRecordsApi` — record management
- [ ] `aiAnalysisApi` — request and view AI analysis results
- [ ] `prescriptionsApi` — prescription management

### Task 3.3 — Doctor Portal Pages
**Files** (ALL NEW in `frontend/src/pages/doctor/`):
- [ ] `DoctorDashboard.tsx` — overview: today's appointments, pending AI analyses, recent patients
- [ ] `PatientList.tsx` — searchable patient list with MRN/name search, filters
- [ ] `PatientDetail.tsx` — full patient view: demographics, medical history timeline, vitals chart, lab results, prescriptions, past AI analyses
- [ ] `AppointmentSchedule.tsx` — daily/weekly calendar view, appointment management
- [ ] `NewConsultation.tsx` — form to create new consultation record with vitals, symptoms, notes
- [ ] `RequestAIAnalysis.tsx` — **KEY PAGE**: doctor selects patient, enters chief complaint, vitals, symptoms → submits for multi-agent AI analysis → shows real-time progress → displays results with blockchain verification links
- [ ] `AIAnalysisResults.tsx` — displays the synthesized AI output: differential diagnosis, risk assessment, medication safety, evidence references, with expandable sections for each agent's contribution + blockchain proof verification status
- [ ] `PrescriptionWriter.tsx` — create/manage prescriptions with AI medication safety check

### Task 3.4 — Patient Portal Pages
**Files** (ALL NEW in `frontend/src/pages/patient/`):
- [ ] `PatientDashboard.tsx` — welcome screen: upcoming appointments, recent results, active prescriptions
- [ ] `MyAppointments.tsx` — view/manage appointments, request new appointment
- [ ] `MyRecords.tsx` — view medical records, lab results, discharge summaries (read-only)
- [ ] `MyPrescriptions.tsx` — active medications list, refill reminders
- [ ] `AIReportView.tsx` — patient-friendly view of AI analysis results (simplified language, no raw agent data)

### Task 3.5 — Portal Layout Components
**Files** (NEW):
- [ ] `frontend/src/components/DoctorLayout.tsx` — sidebar nav for doctor portal (Dashboard, Patients, Appointments, AI Analysis, Prescriptions)
- [ ] `frontend/src/components/PatientLayout.tsx` — sidebar nav for patient portal (Dashboard, Appointments, Records, Prescriptions)
- [ ] Shared components: `VitalsInput.tsx`, `PatientCard.tsx`, `AppointmentCard.tsx`, `AIResultCard.tsx`, `BlockchainProofBadge.tsx`

### Task 3.6 — Portal Styling
**File**: `frontend/src/index.css` (MODIFY)
- [ ] Add hospital-specific CSS variables (medical blue/green palette)
- [ ] Doctor portal theme variant
- [ ] Patient portal theme variant (friendlier, less technical)
- [ ] Medical-specific components: vitals display, timeline, lab result cards

---

## ═══════════════════════════════════════════════════════════════
## PHASE 4 — Real Hyperledger Fabric Blockchain
## ═══════════════════════════════════════════════════════════════

**Objective**: Connect the Python backend to a real Fabric network using the Fabric Gateway SDK.

### Task 4.1 — Implement Real Fabric Gateway
**File**: `backend/blockchain/gateway.py` (REWRITE)
- [ ] Use `grpc` + Fabric Gateway SDK (`fabric-gateway` Python package)
- [ ] Implement real `connect()`: load TLS certs, create gRPC connection, authenticate identity
- [ ] Implement real `record_decision_proof()`: submit transaction to chaincode's `RecordDecisionProof`
- [ ] Implement real `get_decision_proof()`: evaluate `GetDecisionProof` query
- [ ] Implement real `verify_decision_reference()`: evaluate `VerifyDecisionReference` query
- [ ] Implement real `register_agent()`, `create_task()`, `record_verification()`, `record_audit_event()`, `update_trust()`
- [ ] Implement real `get_network_status()`: query `GetLedgerStats` from chaincode
- [ ] Implement real `get_transaction()`: query for specific transaction
- [ ] Connection pooling and retry logic
- [ ] Graceful degradation: if Fabric is down, operations continue with `fabric_ledger_status="unavailable"` but data is queued for retry

### Task 4.2 — Fabric Network Docker Setup
**File**: `blockchain/config/docker-compose-fabric.yml` (MODIFY if needed)
- [ ] Verify the existing docker-compose for Fabric peers, orderer, CA
- [ ] Ensure crypto material generation works
- [ ] Ensure channel creation and joining works
- [ ] Document any Windows-specific requirements (WSL2, Docker Desktop)

### Task 4.3 — Chaincode Deployment Automation
**File**: `blockchain/scripts/deploy-chaincode.sh` (VERIFY)
- [ ] Verify chaincode packaging, installing, approving, committing flow
- [ ] Add script to verify chaincode is operational: `scripts/test-chaincode.sh`
- [ ] Ensure the Go chaincode compiles without errors

### Task 4.4 — Update Main Docker-Compose
**File**: `docker-compose.yml` (MODIFY)
- [ ] Include Fabric services or reference the Fabric docker-compose
- [ ] Add volume mounts for crypto material
- [ ] Add environment variables for Fabric connection to backend service

### Task 4.5 — Install Python Fabric Dependencies
**File**: `backend/pyproject.toml` (MODIFY)
- [ ] Add `"grpcio>=1.60.0"`, `"grpcio-tools>=1.60.0"`
- [ ] Add `"cryptography>=42.0.0"` (already present)

---

## ═══════════════════════════════════════════════════════════════
## PHASE 5 — Full-Stack Wiring & Integration
## ═══════════════════════════════════════════════════════════════

**Objective**: Wire everything together so the complete flow works end-to-end.

### Task 5.1 — End-to-End Flow: Doctor → AI → Blockchain → Result
The complete data flow must work:
1. Doctor logs in → opens patient record → clicks "Request AI Analysis"
2. Frontend `POST /api/hospital/patients/{id}/analyze` with chief complaint + vitals
3. Backend creates Task, triggers orchestrator `run_workflow()`
4. Supervisor agent (Groq) classifies case, selects agents
5. Selected agents (Groq) execute in sequence, produce structured outputs
6. Each output: canonical JSON → SHA-256 hash → encrypt → store in MinIO
7. Hash submitted to Hyperledger Fabric chaincode (`RecordDecisionProof`)
8. Verification: re-download from MinIO → decrypt → re-hash → compare with Fabric
9. Consensus calculated, anomaly detection runs
10. Synthesizer agent produces final clinical summary
11. Result stored in DB, linked to patient record & appointment
12. Frontend displays: AI synthesis, agent contributions, blockchain proof IDs, verification status
13. Admin dashboard reflects: new task, new proofs, trust score updates, audit trail

### Task 5.2 — Admin Dashboard Enhancements
**File**: `frontend/src/pages/DashboardPage.tsx` (MODIFY)
- [ ] Add "Hospital Activity" section: recent AI analyses requested, patient count, active doctors
- [ ] Add real-time indicators for ongoing AI analyses

### Task 5.3 — Frontend Proxy Configuration
**File**: `frontend/vite.config.ts` (MODIFY if needed)
- [ ] Ensure `/api` proxy routes to backend correctly
- [ ] Add proxy for any WebSocket endpoints if using real-time updates

### Task 5.4 — Database Migration
**File**: `backend/alembic/` (MODIFY)
- [ ] Generate migration for new hospital models
- [ ] Ensure migration handles the `user_role` enum extension safely
- [ ] Add seed data migration for demo doctors and patients

### Task 5.5 — Startup Seeding
**File**: `backend/app.py` lifespan (MODIFY)
- [ ] Seed demo doctors: "Dr. Sarah Chen" (Cardiology), "Dr. Raj Patel" (Internal Medicine), "Dr. Emily Watson" (Emergency Medicine)
- [ ] Seed demo patients with realistic medical histories (allergies, conditions, past records)
- [ ] Create demo appointments linking doctors to patients

---

## ═══════════════════════════════════════════════════════════════
## PHASE 6 — Testing & Hardening
## ═══════════════════════════════════════════════════════════════

**Objective**: Ensure everything is testable and works reliably.

### Task 6.1 — Backend API Tests
**File**: `tests/test_hospital_api.py` (NEW)
- [ ] Test patient CRUD
- [ ] Test doctor CRUD
- [ ] Test appointment lifecycle
- [ ] Test AI analysis request (with mock Groq for fast tests)
- [ ] Test blockchain proof creation and verification

### Task 6.2 — Agent Output Tests
**File**: `tests/test_groq_agents.py` (NEW)
- [ ] Test each Groq agent produces valid Pydantic-schema output
- [ ] Test supervisor correctly selects agents for different case types
- [ ] Test consensus calculation with real agent outputs

### Task 6.3 — Integration Test Script
**File**: `tests/test_e2e_flow.py` (NEW)
- [ ] Full end-to-end test:
  1. Create patient
  2. Create doctor
  3. Create appointment
  4. Request AI analysis
  5. Verify blockchain proof exists
  6. Verify off-chain hash matches on-chain hash
  7. Check trust scores updated
  8. Check audit trail populated

### Task 6.4 — Manual Testing Checklist
**File**: `tests/MANUAL_TESTING.md` (NEW)
- [ ] Step-by-step guide to test:
  1. Start services (`docker-compose up`)
  2. Login as admin → verify dashboard shows system health
  3. Login as doctor → create patient → add medical record → request AI analysis → view results
  4. Login as patient → view appointments → view AI report
  5. Login as admin → verify agent trust scores → verify blockchain transactions → verify audit trail
  6. Trigger tamper simulation → verify hash mismatch detected → verify trust score deducted

### Task 6.5 — Error Handling & Edge Cases
- [ ] Handle Groq API rate limits gracefully (queue & retry)
- [ ] Handle Fabric network outage (continue with "pending-blockchain" status)
- [ ] Handle empty patient data (agents should return "insufficient data" responses)
- [ ] Handle concurrent AI analysis requests
- [ ] Handle JWT token expiry on all portals

---

## 📋 Execution Order (Recommended Build Sequence)

```
Phase 1 (Agents)  ────►  Phase 2 (Hospital Backend)  ────►  Phase 5 (Wiring)
                                    │                              │
                                    ▼                              ▼
                          Phase 3 (Hospital Frontend)      Phase 6 (Testing)
                                    │
Phase 4 (Blockchain) ──────────────►│
```

**Sprint 1** (Sessions 1-2): Phase 1 → Phase 2 Tasks 2.1-2.4  
**Sprint 2** (Sessions 3-4): Phase 2 Tasks 2.5-2.6 → Phase 3  
**Sprint 3** (Sessions 5-6): Phase 4 → Phase 5 → Phase 6  

---

## 🔑 Environment Variables Required

```env
# Groq (User provides API key)
GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxxxxxx
GROQ_MODEL=llama-3.3-70b-versatile
GROQ_FAST_MODEL=llama-3.1-8b-instant
AI_MODE=groq
AI_PROVIDER=groq

# Database (existing)
DATABASE_URL=postgresql+asyncpg://multichain:multichain_secret@localhost:5432/multichain_db

# Fabric (existing config, will be connected)
FABRIC_GATEWAY_ENDPOINT=localhost:7051

# MinIO (existing)
MINIO_ENDPOINT=localhost:9000

# App
SIMULATE_TAMPERING=false
```

---

## ✅ Definition of Done

The project is **complete** when:
1. ✅ A doctor can log in, view patients, create consultations, and request AI analysis
2. ✅ AI analysis uses real Groq LLM agents (not mock data)
3. ✅ Each agent's output is hashed, encrypted, stored in MinIO, and recorded on Hyperledger Fabric
4. ✅ Verification can prove the integrity of any agent's decision via blockchain
5. ✅ A patient can log in and view their appointments, records, and simplified AI reports
6. ✅ The admin dashboard shows real metrics: agent trust scores, blockchain transactions, verification success rates, audit trails
7. ✅ Tamper simulation correctly triggers hash mismatch detection and trust score deduction
8. ✅ All flows are testable via both automated tests and manual testing guide
