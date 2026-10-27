import React, { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Layout from './components/Layout';
import { Shield } from 'lucide-react';

// Route-level code-splitting with React.lazy
const LandingPage = lazy(() => import('./pages/LandingPage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const TasksPage = lazy(() => import('./pages/TasksPage'));
const TaskNewPage = lazy(() => import('./pages/TaskNewPage'));
const TaskDetailPage = lazy(() => import('./pages/TaskDetailPage'));
const RunDetailPage = lazy(() => import('./pages/RunDetailPage'));
const AgentsPage = lazy(() => import('./pages/AgentsPage'));
const AgentDetailPage = lazy(() => import('./pages/AgentDetailPage'));
const VerificationPage = lazy(() => import('./pages/VerificationPage'));
const AuditPage = lazy(() => import('./pages/AuditPage'));
const BlockchainPage = lazy(() => import('./pages/BlockchainPage'));
const BenchmarksPage = lazy(() => import('./pages/BenchmarksPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));

// Doctor portal routes
const DoctorDashboard = lazy(() => import('./pages/doctor/DoctorDashboard'));
const DoctorPatients = lazy(() => import('./pages/doctor/DoctorPatients'));
const DoctorAppointments = lazy(() => import('./pages/doctor/DoctorAppointments'));
const DoctorClinicalReviews = lazy(() => import('./pages/doctor/DoctorClinicalReviews'));
const DoctorReviewDetail = lazy(() => import('./pages/doctor/DoctorReviewDetail'));
const DoctorRecords = lazy(() => import('./pages/doctor/DoctorRecords'));

// Patient portal routes
const PatientDashboard = lazy(() => import('./pages/patient/PatientDashboard'));
const PatientAppointments = lazy(() => import('./pages/patient/PatientAppointments'));
const PatientRecords = lazy(() => import('./pages/patient/PatientRecords'));
const PatientPrescriptions = lazy(() => import('./pages/patient/PatientPrescriptions'));
const PatientAIReports = lazy(() => import('./pages/patient/PatientAIReports'));
const PatientConsent = lazy(() => import('./pages/patient/PatientConsent'));
const PatientAccessHistory = lazy(() => import('./pages/patient/PatientAccessHistory'));

// Configured QueryClient with intentional cache freshness per data characteristics
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      refetchIntervalInBackground: false,
      staleTime: 30 * 1000, // 30s default freshness
      gcTime: 10 * 60 * 1000, // 10 minutes cache retention
    },
  },
});

function PageLoadingFallback() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] p-8 space-y-4 animate-fade-in">
      <div className="relative">
        <div className="w-12 h-12 rounded-xl bg-[var(--accent-primary)]/10 border border-[var(--accent-primary)]/20 flex items-center justify-center">
          <Shield className="w-6 h-6 text-[var(--accent-primary)] animate-pulse" />
        </div>
      </div>
      <div className="text-center">
        <p className="text-sm font-semibold text-[var(--text-primary)]">Loading Secure Workspace...</p>
        <p className="text-xs text-[var(--text-muted)] mt-0.5">Verifying cryptographic session</p>
      </div>
    </div>
  );
}

function RequireRole({ children, allowed }: { children: React.ReactNode; allowed: string[] }) {
  const token = localStorage.getItem('token');
  if (!token) return <Navigate to="/login" replace />;
  const role = localStorage.getItem('user_role') || 'admin';
  if (!allowed.includes(role)) {
    // Redirect to the correct portal
    if (role === 'doctor') return <Navigate to="/doctor/dashboard" replace />;
    if (role === 'patient') return <Navigate to="/patient/dashboard" replace />;
    return <Navigate to="/admin/dashboard" replace />;
  }
  return <>{children}</>;
}

/** Smart redirect from / or /dashboard based on stored role */
function RoleRedirect() {
  const token = localStorage.getItem('token');
  if (!token) return <Navigate to="/login" replace />;
  const role = localStorage.getItem('user_role') || 'admin';
  if (role === 'doctor') return <Navigate to="/doctor/dashboard" replace />;
  if (role === 'patient') return <Navigate to="/patient/dashboard" replace />;
  return <Navigate to="/admin/dashboard" replace />;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Suspense fallback={<PageLoadingFallback />}>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<LoginPage />} />

            {/* Smart redirect for legacy /dashboard path */}
            <Route path="/dashboard" element={<RoleRedirect />} />

            {/* Admin / Operator Routes — protected to admin, operator, auditor, viewer */}
            <Route element={<RequireRole allowed={['admin', 'operator', 'auditor', 'viewer']}><Layout /></RequireRole>}>
              <Route path="/admin/dashboard" element={<DashboardPage />} />
              <Route path="/admin/tasks" element={<TasksPage />} />
              <Route path="/admin/tasks/new" element={<TaskNewPage />} />
              <Route path="/admin/tasks/:id" element={<TaskDetailPage />} />
              <Route path="/admin/runs/:id" element={<RunDetailPage />} />
              <Route path="/admin/agents" element={<AgentsPage />} />
              <Route path="/admin/agents/:id" element={<AgentDetailPage />} />
              <Route path="/admin/verification" element={<VerificationPage />} />
              <Route path="/admin/audit" element={<AuditPage />} />
              <Route path="/admin/blockchain" element={<BlockchainPage />} />
              <Route path="/admin/benchmarks" element={<BenchmarksPage />} />
              <Route path="/admin/settings" element={<SettingsPage />} />
            </Route>

            {/* Doctor Portal — protected to doctor role */}
            <Route element={<RequireRole allowed={['doctor']}><Layout /></RequireRole>}>
              <Route path="/doctor/dashboard" element={<DoctorDashboard />} />
              <Route path="/doctor/patients" element={<DoctorPatients />} />
              <Route path="/doctor/appointments" element={<DoctorAppointments />} />
              <Route path="/doctor/reviews" element={<DoctorClinicalReviews />} />
              <Route path="/doctor/reviews/:id" element={<DoctorReviewDetail />} />
              <Route path="/doctor/records" element={<DoctorRecords />} />
            </Route>

            {/* Patient Portal — protected to patient role */}
            <Route element={<RequireRole allowed={['patient']}><Layout /></RequireRole>}>
              <Route path="/patient/dashboard" element={<PatientDashboard />} />
              <Route path="/patient/appointments" element={<PatientAppointments />} />
              <Route path="/patient/records" element={<PatientRecords />} />
              <Route path="/patient/prescriptions" element={<PatientPrescriptions />} />
              <Route path="/patient/ai-reports" element={<PatientAIReports />} />
              <Route path="/patient/consent" element={<PatientConsent />} />
              <Route path="/patient/access-history" element={<PatientAccessHistory />} />
            </Route>

            {/* Catch-all: smart redirect based on role or to landing */}
            <Route path="*" element={<LandingPage />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
