import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import TasksPage from './pages/TasksPage';
import TaskNewPage from './pages/TaskNewPage';
import TaskDetailPage from './pages/TaskDetailPage';
import RunDetailPage from './pages/RunDetailPage';
import AgentsPage from './pages/AgentsPage';
import AgentDetailPage from './pages/AgentDetailPage';
import VerificationPage from './pages/VerificationPage';
import AuditPage from './pages/AuditPage';
import BlockchainPage from './pages/BlockchainPage';
import BenchmarksPage from './pages/BenchmarksPage';
import SettingsPage from './pages/SettingsPage';
import DoctorDashboard from './pages/doctor/DoctorDashboard';
import DoctorPatients from './pages/doctor/DoctorPatients';
import DoctorAppointments from './pages/doctor/DoctorAppointments';
import DoctorClinicalReviews from './pages/doctor/DoctorClinicalReviews';
import DoctorReviewDetail from './pages/doctor/DoctorReviewDetail';
import DoctorRecords from './pages/doctor/DoctorRecords';

import PatientDashboard from './pages/patient/PatientDashboard';
import PatientAppointments from './pages/patient/PatientAppointments';
import PatientRecords from './pages/patient/PatientRecords';
import PatientPrescriptions from './pages/patient/PatientPrescriptions';
import PatientAIReports from './pages/patient/PatientAIReports';
import PatientConsent from './pages/patient/PatientConsent';
import PatientAccessHistory from './pages/patient/PatientAccessHistory';
import LandingPage from './pages/LandingPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false, staleTime: 5000 },
  },
});



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
      </BrowserRouter>
    </QueryClientProvider>
  );
}
