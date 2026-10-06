import { Link } from 'react-router-dom';
import { Calendar, FileText, Pill, HeartPulse, Shield, Clock, ArrowRight, UserRound, Sparkles, Activity } from 'lucide-react';

export default function PatientDashboard() {
  return (
    <div className="flex flex-col gap-8 max-w-5xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[var(--border-subtle)] pb-6">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 mb-3 rounded-full bg-[var(--status-healthy)]/10 border border-[var(--status-healthy)]/20 text-[var(--status-healthy)] text-[10px] font-bold uppercase tracking-widest">
            <Sparkles className="w-3 h-3" /> Secure Patient Portal
          </div>
          <h1 className="text-3xl font-bold text-[var(--text-primary)] tracking-tight">
            Good morning, <span className="text-[var(--accent-primary)]">Sarah.</span>
          </h1>
          <p className="text-sm font-medium text-[var(--text-secondary)] mt-2">
            Your clinical status is stable. All recent vitals are within normal ranges.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="badge badge-healthy">
            <Shield className="w-3 h-3 mr-1" /> Blockchain Verified
          </span>
        </div>
      </div>

      {/* Quick Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <Link to="/patient/appointments" className="panel p-5 group flex flex-col hover:border-[var(--accent-primary)] transition-colors text-left">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-[var(--accent-primary)]/10 border border-[var(--accent-primary)]/20">
              <Calendar className="w-5 h-5 text-[var(--accent-primary)]" />
            </div>
            <ArrowRight className="w-4 h-4 text-[var(--text-muted)] group-hover:text-[var(--accent-primary)] transition-colors" />
          </div>
          <div>
            <p className="text-2xl font-bold text-[var(--text-primary)] tracking-tight">None</p>
            <p className="text-[11px] font-bold uppercase tracking-widest text-[var(--text-secondary)] mt-1">Upcoming Visits</p>
          </div>
        </Link>
        <Link to="/patient/prescriptions" className="panel p-5 group flex flex-col hover:border-[var(--accent-primary)] transition-colors text-left">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-[var(--status-healthy)]/10 border border-[var(--status-healthy)]/20">
              <Pill className="w-5 h-5 text-[var(--status-healthy)]" />
            </div>
            <ArrowRight className="w-4 h-4 text-[var(--text-muted)] group-hover:text-[var(--accent-primary)] transition-colors" />
          </div>
          <div>
            <p className="text-2xl font-bold text-[var(--text-primary)] tracking-tight">2 Active</p>
            <p className="text-[11px] font-bold uppercase tracking-widest text-[var(--text-secondary)] mt-1">Prescriptions</p>
          </div>
        </Link>
        <div className="panel p-5 flex flex-col text-left">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-[var(--status-warning)]/10 border border-[var(--status-warning)]/20">
              <HeartPulse className="w-5 h-5 text-[var(--status-warning)]" />
            </div>
          </div>
          <div>
            <p className="text-2xl font-bold text-[var(--text-primary)] tracking-tight">72 <span className="text-sm text-[var(--text-muted)]">bpm</span></p>
            <p className="text-[11px] font-bold uppercase tracking-widest text-[var(--text-secondary)] mt-1">Last Heart Rate</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Care Team */}
        <div className="panel flex flex-col">
          <div className="p-5 border-b border-[var(--border-subtle)] flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-[var(--color-clinical-100)] flex items-center justify-center">
              <UserRound className="w-4 h-4 text-[var(--text-primary)]" />
            </div>
            <div>
              <h3 className="text-[14px] font-bold text-[var(--text-primary)]">My Care Team</h3>
              <p className="text-[11px] text-[var(--text-muted)] font-medium">Your dedicated healthcare professionals</p>
            </div>
          </div>
          <div className="p-5 space-y-4 flex-1 flex flex-col justify-center">
            <div className="flex items-center gap-4 p-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-panel-hover)]">
              <div className="w-12 h-12 rounded-full bg-[var(--color-clinical-800)] text-white flex items-center justify-center font-bold text-lg shrink-0">
                DR
              </div>
              <div>
                <p className="text-sm font-bold text-[var(--text-primary)]">Dr. Robert Jenkins</p>
                <p className="text-[11px] text-[var(--text-secondary)] uppercase tracking-wider font-bold mt-0.5">Primary Care Physician</p>
              </div>
            </div>
            <div className="flex items-center gap-4 p-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-panel-hover)]">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 text-white flex items-center justify-center shrink-0 shadow-sm">
                <Sparkles className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-bold text-[var(--text-primary)]">MedAgentOS Coordinator</p>
                <p className="text-[11px] text-[var(--text-secondary)] uppercase tracking-wider font-bold mt-0.5">Clinical AI Support System</p>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Documents */}
        <div className="panel flex flex-col">
          <div className="p-5 border-b border-[var(--border-subtle)] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded bg-[var(--accent-primary)]/10 flex items-center justify-center">
                <FileText className="w-4 h-4 text-[var(--accent-primary)]" />
              </div>
              <div>
                <h3 className="text-[14px] font-bold text-[var(--text-primary)]">Recent Documents</h3>
                <p className="text-[11px] text-[var(--text-muted)] font-medium">Simplified AI summaries of your records</p>
              </div>
            </div>
            <Link to="/patient/records" className="text-xs font-bold text-[var(--accent-primary)] hover:underline">
              View all
            </Link>
          </div>
          <div className="flex-1 flex flex-col divide-y divide-[var(--border-subtle)]">
            {[
              { title: 'Annual Blood Work Results', date: 'Oct 12, 2023', summary: 'All major panels are within normal healthy ranges. Cholesterol has improved since last visit.' },
              { title: 'Cardiology Consultation', date: 'Sep 05, 2023', summary: 'Resting ECG normal. No signs of arrhythmia. Continue current medication plan.' }
            ].map((doc, i) => (
              <div key={i} className="p-5 flex flex-col gap-2">
                <div className="flex justify-between items-start">
                  <p className="text-sm font-bold text-[var(--text-primary)]">{doc.title}</p>
                  <span className="text-[11px] text-[var(--text-muted)] flex items-center gap-1">
                    <Clock className="w-3 h-3" /> {doc.date}
                  </span>
                </div>
                <div className="p-3 bg-[var(--bg-panel-hover)] rounded-lg border border-[var(--border-subtle)]">
                  <p className="text-xs text-[var(--text-secondary)] leading-relaxed flex gap-2">
                    <Sparkles className="w-3.5 h-3.5 text-[var(--accent-primary)] shrink-0 mt-0.5" />
                    <span><strong className="text-[var(--text-primary)]">AI Summary:</strong> {doc.summary}</span>
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Security Banner */}
      <div className="panel p-6 bg-gradient-to-r from-[var(--color-clinical-800)] to-[var(--color-clinical-950)] border-none text-white overflow-hidden relative">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />
        <div className="relative z-10 flex flex-col sm:flex-row items-center gap-6">
          <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center shrink-0 shadow-lg border border-white/10 backdrop-blur-md">
            <Shield className="w-6 h-6 text-[var(--status-healthy)]" />
          </div>
          <div className="flex-1 text-center sm:text-left">
            <h3 className="text-base font-bold mb-1">Your data is cryptographically secured.</h3>
            <p className="text-sm text-white/70 font-medium">
              All your health records are encrypted end-to-end and anchored on a Hyperledger Fabric blockchain. Only your authorized care team can access them.
            </p>
          </div>
        </div>
      </div>

    </div>
  );
}
