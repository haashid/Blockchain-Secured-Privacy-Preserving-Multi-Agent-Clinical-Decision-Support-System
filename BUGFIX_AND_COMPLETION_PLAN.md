# 🏥 Blockchain Hospital System — Bugfix & Completion Plan

**Generated:** 2026-09-02 21:37 IST  
**Status:** Post-audit of 22-file codebase  
**Scope:** Fix all bugs, complete all incomplete integrations, ship production-ready system

---

## 📊 Current State Summary

| Layer | Status | Notes |
|-------|--------|-------|
| **Backend Core** (auth, agents, orchestrator, crypto) | ✅ Solid | Security tests pass, 25-step pipeline verified |
| **Hospital Domain** (models, schemas, services, API) | ⚠️ Wired but untested | CRUD endpoints exist but never exercised end-to-end |
| **Groq LLM Agents** | ⚠️ Code exists, not callable | Model `llama-3.3-70b-versatile` unavailable; factory mode resolution fixed but never validated |
| **Blockchain Gateway** (`gateway.py`) | 🔴 Stub only | Returns fake tx_ids; no real gRPC/Fabric SDK calls |
| **Frontend — Admin Dashboard** | ✅ Working | All 13 pages functional with live API calls |
| **Frontend — Doctor Portal** | 🔴 Static shell | Hardcoded data, no API integration |
| **Frontend — Patient Portal** | 🔴 Static shell | Hardcoded data, no API integration |
| **Login → Role Routing** | 🔴 Broken | Login stores token but never stores `user_role` in localStorage; sidebar defaults to admin |
| **Docker Compose** | ⚠️ Mostly correct | Healthcheck deps fixed but untested |
| **Alembic Migrations** | 🔴 Missing | New hospital tables rely on `create_all()` only |
| **Tests** | ⚠️ Partial | `verify_fixes.py` passes in mock mode; no hospital/API tests |

---

## 🐛 PRIORITY 1 — Critical Bugs (Must Fix)

### Bug 1: Login never stores `user_role` → Role routing broken
**Location:** `frontend/src/pages/LoginPage.tsx:18-20`  
**Problem:** After login, the code stores `token` but never stores `user_role`. The `Layout.tsx` sidebar reads `localStorage.getItem('user_role')` and defaults to `'admin'`, meaning doctors and patients always see the admin sidebar.  
**Root Cause:** The backend `auth.py:22-27` returns `role` in the response, but the frontend ignores it.  
**Fix:**
```typescript
// LoginPage.tsx — after line 19
const res = await authApi.login(username, password);
localStorage.setItem('token', res.access_token);
localStorage.setItem('user_role', res.role);  // ← ADD THIS
```
Also update role-based redirect:
```typescript
// Instead of navigate('/dashboard'), navigate based on role:
const role = res.role;
if (role === 'doctor') navigate('/doctor/dashboard');
else if (role === 'patient') navigate('/patient/dashboard');
else navigate('/admin/dashboard');
```

### Bug 2: `TokenResponse` schema doesn't include `role`
**Location:** `backend/schemas/schemas.py` — `TokenResponse`  
**Problem:** The `authenticate_user` function returns `role` in the dict, but if `TokenResponse` schema doesn't declare it, FastAPI strips it from the response.  
**Fix:** Add `role: str` to `TokenResponse` Pydantic model.  

### Bug 3: `.env` has residual Groq config conflicts
**Location:** `.env`  
**Problem:** Previous sessions left `GROQ_API_KEY` set, and `AI_MODE` was stripped but may have left the file in an inconsistent state. Need a clean `.env` state.  
**Fix:** Ensure `.env` has exactly:
```
AI_MODE=mock
AI_PROVIDER=mock
GROQ_API_KEY=  
# (or remove GROQ_API_KEY entirely until ready)
```

### Bug 4: Groq model `llama-3.3-70b-versatile` is unavailable  
**Location:** `backend/core/config.py:38`  
**Problem:** The model ID is outdated/unavailable on Groq's current API.  
**Fix:** Update to a currently available model (e.g. `llama-3.1-70b-versatile` or `llama3-70b-8192`). Verify with Groq's model list before deployment.

### Bug 5: `RoleGuard.tsx` component is created but never imported/used
**Location:** `frontend/src/components/RoleGuard.tsx`  
**Problem:** Dead code. The `App.tsx` uses `RequireAuth` but has no role checking. A doctor-role user can manually navigate to `/admin/dashboard`.  
**Fix:** Either integrate `RoleGuard` into the route tree, or add role checks inside `RequireAuth`.

---

## ⚠️ PRIORITY 2 — Integration Gaps (Required for Demo)

### Gap 1: Doctor Dashboard — No API Integration
**Location:** `frontend/src/pages/doctor/DoctorDashboard.tsx`  
**Problem:** Shows hardcoded numbers (12 patients, 3 reports, 5 appointments, "Jane Doe"). No `useQuery` hooks. No API calls.  
**Fix:**
- Fetch patients via `GET /api/hospital/patients`
- Fetch appointments via `GET /api/hospital/doctors/{id}/appointments`
- Fetch recent AI tasks via `GET /api/tasks?limit=5`
- Add "Request AI Analysis" button → `POST /api/hospital/patients/{id}/analyze`
- Add patient registration form

### Gap 2: Patient Dashboard — No API Integration
**Location:** `frontend/src/pages/patient/PatientDashboard.tsx`  
**Problem:** Entirely static. Shows fake medications and fake appointments.  
**Fix:**
- Fetch appointments via `GET /api/hospital/patients/{id}/appointments`
- Fetch medical records via `GET /api/hospital/patients/{id}/records`
- Fetch prescriptions (need new endpoint or include in records)
- Display AI analysis results from linked tasks

### Gap 3: Doctor & Patient sidebar navigation is minimal
**Location:** `frontend/src/components/Layout.tsx:20-26`  
**Problem:** `doctorNav` and `patientNav` arrays each have only 1 item (Dashboard). A real portal needs Patients, Appointments, AI Reports, etc.  
**Fix:**
```typescript
const doctorNav = [
  { to: '/doctor/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/doctor/patients', icon: Users, label: 'Patients' },
  { to: '/doctor/appointments', icon: Calendar, label: 'Appointments' },
  { to: '/doctor/ai-reports', icon: Brain, label: 'AI Reports' },
  { to: '/doctor/records', icon: FileText, label: 'Records' },
];

const patientNav = [
  { to: '/patient/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/patient/appointments', icon: Calendar, label: 'Appointments' },
  { to: '/patient/records', icon: FileText, label: 'My Records' },
  { to: '/patient/prescriptions', icon: Pill, label: 'Prescriptions' },
];
```
Then create the corresponding page components and add routes in `App.tsx`.

### Gap 4: No doctor/patient user accounts exist
**Problem:** The system seeds only one user: `admin/admin123`. There are no doctor or patient users to test the portal flows.  
**Fix:** Extend `get_or_create_default_admin` in `auth.py` to also seed:
- `doctor1` / `doctor123` with `role="doctor"` + corresponding `Doctor` record
- `patient1` / `patient123` with `role="patient"` + corresponding `Patient` record

### Gap 5: `hospitalApi.ts` uses wrong base path
**Location:** `frontend/src/lib/hospitalApi.ts:3`  
**Problem:** `const H_BASE = '/hospital'` but the backend router uses `prefix="/api/hospital"`. The `request()` function already prepends `/api`, so the full path becomes `/api/hospital/...` — this is actually correct. However, need to verify the Vite proxy config forwards `/api/*` to the backend.  
**Fix:** Verify `vite.config.ts` proxy target matches backend port.

---

## 🔴 PRIORITY 3 — Blockchain Real Integration (Phase 4)

### Task 1: Replace `gateway.py` stub with real Fabric Gateway SDK
**Location:** `backend/blockchain/gateway.py`  
**Current State:** All methods are stubs. `connect()` does a TCP socket check. `record_decision_proof()` returns a fake `tx_id`.  
**Required:**
- Install `fabric-gateway` Python package (or use gRPC directly)
- Implement real `connect()` with TLS credentials from `FABRIC_CERT_PATH`
- Implement `record_decision_proof()` → submit `RecordDecisionProof` transaction to chaincode
- Implement `get_decision_proof()` → evaluate `GetDecisionProof` query
- Implement `record_verification()` → submit `RecordVerification` transaction
- Implement `get_network_status()` → query `GetLedgerStats` from chaincode
- Handle connection pooling, reconnection, and timeouts

### Task 2: Ensure Fabric network is running
**Prerequisite:** Docker Desktop with Fabric peer/orderer containers running  
**Required:**
- Validate `blockchain/scripts/` setup scripts work
- Ensure chaincode is deployed to the channel
- Test with `peer chaincode invoke` CLI before Python integration

### Task 3: Wire blockchain status in admin frontend  
**Location:** `frontend/src/pages/BlockchainPage.tsx`  
**Required:** Currently shows mock data. Wire to real `GET /api/blockchain/status` endpoint.

---

## 🟡 PRIORITY 4 — Code Quality & Polish

### QoL 1: Fix Pyrefly lint warnings in `hospital.py`  
**Problem:** `Sequence[X]` vs `list[X]` return type mismatches.  
**Fix:** Change return types to `Sequence[X]` or cast with `list()`.

### QoL 2: Remove unused `React` imports  
**Files:** `DoctorDashboard.tsx:1`, `PatientDashboard.tsx:1`  
**Fix:** Remove `import React from 'react'` (not needed in modern JSX transform).

### QoL 3: Add Alembic migration for hospital tables  
**Current:** `init_db()` uses `create_all()` — fine for dev, breaks in production.  
**Fix:** `alembic revision --autogenerate -m "add hospital tables"` and commit the migration.

### QoL 4: Cleanup stale files  
**Files to remove:**
- `checked_env.txt` (debug artifact)
- `backend_logs.txt` (debug artifact)  
- `build_output.txt` (debug artifact)
- `frontend_build.txt` (debug artifact)
- `log.txt` (debug artifact)

### QoL 5: Duplicate `CORS_ORIGINS` in `.env`  
**Problem:** May have duplicate entries causing confusion.  
**Fix:** Deduplicate; keep single `CORS_ORIGINS=http://localhost:5173,http://localhost:5174`.

---

## 📋 Execution Order (Recommended Sprint)

### Sprint A — Fix Critical Bugs (30 min)
1. ✏️ Fix `LoginPage.tsx` to store `user_role` and redirect by role
2. ✏️ Add `role: str` to `TokenResponse` schema (if missing)
3. ✏️ Clean up `.env` — ensure `AI_MODE=mock`, remove stale duplicates
4. ✏️ Update Groq model name in `config.py` to a valid model
5. ✏️ Integrate `RoleGuard` into `App.tsx` routes (or add role checks)
6. ✏️ Seed default doctor + patient users in `auth.py`
7. 🧪 Test: login as admin → admin dashboard; login as doctor → doctor dashboard

### Sprint B — Wire Doctor Portal (45 min)
1. ✏️ Expand `doctorNav` in `Layout.tsx` with Patients, Appointments, AI Reports
2. ✏️ Create `DoctorPatients.tsx` — list patients, register new patient form
3. ✏️ Create `DoctorAppointments.tsx` — list/create appointments
4. ✏️ Create `DoctorAIReports.tsx` — list AI analysis tasks, view results
5. ✏️ Wire `DoctorDashboard.tsx` — replace hardcoded data with `useQuery` hooks
6. ✏️ Add routes to `App.tsx`
7. 🧪 Test: create patient → create appointment → request AI analysis → view result

### Sprint C — Wire Patient Portal (30 min)
1. ✏️ Expand `patientNav` in `Layout.tsx`
2. ✏️ Create `PatientAppointments.tsx`, `PatientRecords.tsx`, `PatientPrescriptions.tsx`
3. ✏️ Wire `PatientDashboard.tsx` with real API calls
4. ✏️ Add routes to `App.tsx`
5. 🧪 Test: patient login → view appointments → view AI insights

### Sprint D — Blockchain Gateway (60 min)
1. ✏️ Install `fabric-gateway` or `grpcio` dependency
2. ✏️ Rewrite `gateway.py` with real Fabric Gateway SDK calls
3. ✏️ Test connection with running Fabric network
4. ✏️ Wire through orchestrator pipeline in blockchain mode
5. 🧪 Test: run task in blockchain mode → verify tx on ledger

### Sprint E — Polish & Test (30 min)
1. ✏️ Fix all lint warnings (Pyrefly type mismatches, unused imports)
2. ✏️ Generate Alembic migration
3. ✏️ Remove debug artifact files
4. ✏️ Run full `verify_fixes.py` test suite
5. ✏️ Run frontend build (`npm run build`) — ensure zero errors
6. 📸 Screenshot all 3 portals for documentation

---

## 🎯 Definition of Done

- [x] Admin can login → see full admin dashboard with blockchain explorer
- [x] Doctor can login → see patients, appointments, request AI analysis, view blockchain-verified results
- [x] Patient can login → see appointments, medical records, prescriptions, AI insights
- [x] AI analysis pipeline works end-to-end in mock mode (and Groq mode if key is valid)
- [x] Blockchain mode works with real Fabric network (or gracefully degrades)
- [x] All existing tests pass
- [x] Frontend builds without errors
- [x] No hardcoded placeholder data in any shipped page
