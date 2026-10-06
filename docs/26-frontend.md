# 26 — Frontend Architecture

## Technology Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| React | 18.x | Component system |
| Vite | 5.x | Build tool / dev server |
| TypeScript | 5.x | Type safety |
| TailwindCSS | 3.x | Utility-first styling |
| React Router | v6 | SPA routing |
| @tanstack/react-query | 5.x | Server state management |

---

## Component Architecture

```
App.tsx                    ← Router + RequireRole guards
├── /login → LoginPage.tsx
├── /admin/* (RequireRole: admin, operator, auditor, viewer)
│   └── Layout.tsx         ← Sidebar + Outlet
│       ├── DashboardPage.tsx
│       ├── TasksPage.tsx
│       ├── TaskNewPage.tsx
│       ├── TaskDetailPage.tsx
│       ├── AgentsPage.tsx
│       ├── VerificationPage.tsx
│       ├── AuditPage.tsx
│       ├── BlockchainPage.tsx
│       ├── BenchmarksPage.tsx
│       └── SettingsPage.tsx
├── /doctor/* (RequireRole: doctor)
│   └── Layout.tsx
│       ├── DoctorDashboard.tsx
│       ├── DoctorPatients.tsx
│       ├── DoctorAppointments.tsx
│       ├── DoctorAIReports.tsx
│       └── DoctorRecords.tsx
└── /patient/* (RequireRole: patient)
    └── Layout.tsx
        ├── PatientDashboard.tsx
        ├── PatientAppointments.tsx
        ├── PatientRecords.tsx
        └── PatientPrescriptions.tsx
```

---

## Key Files

### `frontend/src/App.tsx`
**Purpose**: Top-level router with role-based access control.

Key exports:
- `RequireRole({ children, allowed })` — Checks JWT + user_role in localStorage.
- `RoleRedirect()` — Sends users to their role-specific portal.

---

### `frontend/src/components/Layout.tsx`
**Purpose**: Persistent sidebar shell for authenticated pages.

**Behavior**:
- Reads `user_role` from localStorage.
- Renders `adminNav`, `doctorNav`, or `patientNav` depending on role.
- Sidebar is collapsible with icon-only mode.
- Logout clears localStorage and redirects to `/login`.

---

### `frontend/src/lib/api.ts`
**Purpose**: All API communication.

```typescript
// Base request with auto-JWT injection
async function request<T>(endpoint, options = {}): Promise<T>

// Auth
authApi.login(username, password) → { access_token, role, username }

// Tasks
api.getTasks() → Task[]
api.createTask(data) → Task
api.executeTask(taskId) → WorkflowResult

// Agents
api.getAgents() → Agent[]

// Blockchain
api.getBlockchainStatus() → BlockchainStatus
api.getDecisionProofs() → DecisionProof[]

// Audit
api.getAuditEvents() → AuditEvent[]
```

---

### `frontend/src/lib/hospitalApi.ts`
**Purpose**: Hospital-specific API methods separate from core system API.

```typescript
hospitalApi.getPatients() → Patient[]
hospitalApi.createPatient(data) → Patient
hospitalApi.getDoctors() → Doctor[]
hospitalApi.getAppointments() → Appointment[]
hospitalApi.getMedicalRecords() → MedicalRecord[]
```

---

## State Management

**Server state**: `@tanstack/react-query` — caches API responses, auto-refetches.

```tsx
// Example usage in a component:
const { data: patients, isLoading, error } = useQuery({
    queryKey: ["patients"],
    queryFn: () => hospitalApi.getPatients(),
    staleTime: 30_000,  // 30 second cache
});
```

**Auth state**: `localStorage` — `token` (JWT) and `user_role` (role string).

---

## Design System

The app uses a custom dark glassmorphic design defined in `index.css`:

**Color Palette**:
- Background: `#0a0a0f` (near black)
- Surface: `rgba(255,255,255,0.05)` (glassmorphic cards)
- Primary accent: Purple/violet HSL palette
- Text: `#e5e7eb` (gray-200)

**Typography**: `'Outfit'` from Google Fonts — modern geometric sans-serif.

**Micro-animations**: Hover effects, fade-ins, smooth sidebar collapse.

---

## Role-Specific Navigation

### Admin Navigation
- Dashboard, Tasks, New Task, Agents, Verification, Audit, Blockchain, Benchmarks, Settings

### Doctor Navigation
- Dashboard, Patients, Appointments, AI Reports, Medical Records

### Patient Navigation
- Dashboard, My Appointments, My Records, My Prescriptions

---

## Page Implementation Status

| Page | Connected to API | Notes |
|------|-----------------|-------|
| LoginPage | ✅ Full | JWT, role redirect |
| DashboardPage | ✅ Partial | Metrics from API |
| DoctorDashboard | ✅ Wired | React Query |
| PatientDashboard | ✅ Wired | React Query |
| TasksPage | ✅ Full | List + pagination |
| TaskDetailPage | ✅ Full | Timeline + proofs |
| AgentsPage | ✅ Full | Trust scores |
| BlockchainPage | ✅ Full | Network status |
| AuditPage | ✅ Full | Event log |
| DoctorPatients | 🟡 Shell | Component structure only |
| DoctorAppointments | 🟡 Shell | Component structure only |
| PatientAppointments | 🟡 Shell | Component structure only |
| PatientRecords | 🟡 Shell | Component structure only |
