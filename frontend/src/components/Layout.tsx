import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, ListTodo, Users, ShieldCheck, ScrollText,
  Blocks, BarChart3, Settings, LogOut, Activity, ChevronLeft, ChevronRight,
  Brain, FileText, Calendar, Pill, Stethoscope, HeartPulse, Search, Bell, Menu
} from 'lucide-react';
import { useState, useEffect } from 'react';

const adminNav = [
  { to: '/admin/dashboard', icon: LayoutDashboard, label: 'Command Center', section: 'Overview' },
  { to: '/admin/tasks',     icon: ListTodo,        label: 'Coordination Tasks', section: 'Clinical' },
  { to: '/admin/agents',    icon: Users,           label: 'AI Agents',    section: 'Clinical' },
  { to: '/admin/verification', icon: ShieldCheck,  label: 'Verification', section: 'Trust & Ledger' },
  { to: '/admin/audit',     icon: ScrollText,      label: 'Audit Events', section: 'Trust & Ledger' },
  { to: '/admin/blockchain',icon: Blocks,          label: 'Fabric Ledger',section: 'Trust & Ledger' },
  { to: '/admin/benchmarks',icon: BarChart3,       label: 'System Benchmarks',section: 'Platform' },
  { to: '/admin/settings',  icon: Settings,        label: 'Platform Settings',  section: 'Platform' },
];

const doctorNav = [
  { to: '/doctor/dashboard',    icon: LayoutDashboard, label: 'My Workspace',    section: 'Practice' },
  { to: '/doctor/patients',     icon: Users,           label: 'Patient Registry',     section: 'Clinical' },
  { to: '/doctor/appointments', icon: Calendar,        label: 'Appointments', section: 'Clinical' },
  { to: '/doctor/reviews',      icon: Brain,           label: 'AI Clinical Reviews',   section: 'Intelligence' },
  { to: '/doctor/records',      icon: FileText,        label: 'EHR Records',      section: 'Clinical' },
];

const patientNav = [
  { to: '/patient/dashboard',      icon: LayoutDashboard, label: 'Overview',     section: 'Home' },
  { to: '/patient/appointments',   icon: Calendar,        label: 'Appointments',  section: 'Health' },
  { to: '/patient/records',        icon: FileText,        label: 'Medical Records',    section: 'Health' },
  { to: '/patient/prescriptions',  icon: Pill,            label: 'Medications', section: 'Health' },
  { to: '/patient/ai-reports',     icon: Brain,           label: 'AI Reports', section: 'Health' },
  { to: '/patient/consent',        icon: ShieldCheck,     label: 'Consent', section: 'Privacy' },
  { to: '/patient/access-history', icon: ScrollText,      label: 'Access History', section: 'Privacy' },
];

const roleMeta: Record<string, { label: string; icon: any; org: string }> = {
  admin:   { label: 'Administrator', icon: ShieldCheck, org: 'Hospital Operations' },
  doctor:  { label: 'Clinician',     icon: Stethoscope, org: 'Cardiology Dept' },
  patient: { label: 'Patient',       icon: HeartPulse,  org: 'Patient Portal' },
};

export default function Layout() {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user_role');
    navigate('/login');
  };

  const role = localStorage.getItem('user_role') || 'admin';
  const nav = role === 'doctor' ? doctorNav : role === 'patient' ? patientNav : adminNav;
  const meta = roleMeta[role] || roleMeta.admin;

  // Apply dark mode theme if admin
  useEffect(() => {
    if (role === 'admin') {
      document.body.classList.add('admin-theme');
    } else {
      document.body.classList.remove('admin-theme');
    }
    return () => document.body.classList.remove('admin-theme');
  }, [role]);

  // Group nav by section
  const sections: { label: string; items: typeof adminNav }[] = [];
  for (const item of nav) {
    const last = sections[sections.length - 1];
    if (!last || last.label !== item.section) {
      sections.push({ label: item.section, items: [item] });
    } else {
      last.items.push(item);
    }
  }

  return (
    <div className="flex h-screen overflow-hidden w-full transition-colors duration-300">
      
      {/* ── Sidebar ── */}
      <aside
        className={`panel relative flex flex-col flex-shrink-0 m-4 mr-0 z-20 transition-all duration-300 ${
          collapsed ? 'w-20' : 'w-[260px]'
        }`}
      >
        {/* Brand */}
        <div className={`flex items-center h-16 shrink-0 border-b border-[var(--border-subtle)] px-4 ${collapsed ? 'justify-center' : 'justify-start'}`}>
          <div className="relative shrink-0">
            <div className="w-10 h-10 rounded-md bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] flex items-center justify-center">
              <Activity className="w-5 h-5" />
            </div>
          </div>
          {!collapsed && (
            <div className="ml-3 min-w-0">
              <p className="font-bold text-[15px] tracking-tight leading-none text-[var(--text-primary)]">
                MedAgent<span className="text-[var(--accent-primary)]">OS</span>
              </p>
              <p className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-semibold mt-1">
                Clinical AI Platform
              </p>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-2 py-4 space-y-6">
          {sections.map((section) => (
            <div key={section.label} className="space-y-1">
              {!collapsed && (
                <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
                  {section.label}
                </p>
              )}
              {collapsed && <div className="my-2 mx-auto h-[1px] w-6 bg-[var(--border-subtle)]" />}
              
              {section.items.map((item) => {
                const isActive = location.pathname.startsWith(item.to);
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={`relative flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                      collapsed ? 'justify-center' : 'justify-start'
                    } ${
                      isActive 
                        ? 'bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] font-semibold' 
                        : 'text-[var(--text-secondary)] font-medium hover:bg-[var(--bg-panel-hover)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    <item.icon className={`shrink-0 transition-all ${collapsed ? 'w-5 h-5' : 'w-[18px] h-[18px]'}`} />
                    {!collapsed && <span className="truncate">{item.label}</span>}
                    {isActive && !collapsed && (
                      <span className="ml-auto w-1.5 h-1.5 rounded-full bg-[var(--accent-primary)]" />
                    )}
                  </NavLink>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="border-t border-[var(--border-subtle)] p-3 shrink-0">
          {!collapsed && (
            <div className="flex items-center gap-3 p-2 mb-2 rounded-md bg-[var(--bg-panel-hover)] border border-[var(--border-subtle)]">
              <div className="w-8 h-8 rounded-md bg-[var(--accent-primary)] flex items-center justify-center shrink-0">
                <meta.icon className="w-4 h-4 text-white" />
              </div>
              <div className="min-w-0">
                <p className="text-[13px] font-bold text-[var(--text-primary)] truncate leading-tight">Dr. Sarah Jenkins</p>
                <p className="text-[11px] text-[var(--text-muted)] mt-0.5">{meta.label}</p>
              </div>
            </div>
          )}
          <button
            onClick={logout}
            className={`flex items-center gap-3 px-3 py-2.5 w-full rounded-md text-[13px] font-medium text-[var(--text-secondary)] hover:text-[var(--status-danger)] hover:bg-[var(--status-danger)]/10 transition-colors ${
              collapsed ? 'justify-center' : 'justify-start'
            }`}
          >
            <LogOut className="w-4 h-4 shrink-0" />
            {!collapsed && <span>Sign out</span>}
          </button>
        </div>

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="absolute -right-3 top-16 z-30 w-6 h-6 bg-[var(--bg-panel)] border border-[var(--border-strong)] rounded-full flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] shadow-sm cursor-pointer"
        >
          {collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
        </button>
      </aside>

      {/* ── Main content ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        
        {/* Top bar */}
        <header className="h-20 shrink-0 flex items-center justify-between px-8 bg-transparent">
          
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
              <span className="font-semibold text-[var(--text-primary)]">
                {location.pathname.split('/').filter(Boolean).map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' / ')}
              </span>
            </div>
            
            {/* Global Search */}
            <div className="relative hidden md:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
              <input 
                type="text" 
                placeholder="Search patient, case, or transaction..." 
                className="w-80 bg-[var(--bg-panel)] border border-[var(--border-strong)] rounded-full pl-9 pr-4 py-1.5 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)] transition-all shadow-sm"
              />
            </div>
          </div>

          <div className="flex items-center gap-5">
            <span className="badge badge-healthy">
              <span className="w-1.5 h-1.5 rounded-full bg-current mr-1.5 animate-pulse" />
              SYSTEM ONLINE
            </span>
            
            <button className="relative text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
              <Bell className="w-5 h-5" />
              <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-[var(--status-danger)]" />
            </button>
            
            <div className="h-6 w-px bg-[var(--border-strong)]" />
            
            <div className="flex flex-col items-end">
              <span className="text-[13px] font-semibold text-[var(--text-primary)] leading-tight">{meta.org}</span>
              <span className="text-[11px] text-[var(--text-muted)] leading-tight">{meta.label} Access</span>
            </div>
          </div>
        </header>

        {/* Content Area */}
        <main className="flex-1 overflow-y-auto px-8 pb-8">
          <div className="max-w-7xl mx-auto h-full animate-fade-in">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
