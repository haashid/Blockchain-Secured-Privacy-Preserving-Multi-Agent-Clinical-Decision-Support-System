import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { patientsApi, appointmentsApi, prescriptionsApi } from '../../lib/hospitalApi';
import { clinicalApi } from '../../lib/clinicalApi';
import { formatDate } from '../../lib/utils';
import {
  Calendar, FileText, Pill, HeartPulse, Shield, Clock, ArrowRight,
  UserRound, Sparkles, CheckCircle2
} from 'lucide-react';

export default function PatientDashboard() {
  const { data: myPatient } = useQuery({
    queryKey: ['myPatientRecord'],
    queryFn: patientsApi.myRecord,
    retry: false,
  });

  const { data: appointments } = useQuery({
    queryKey: ['myAppointments'],
    queryFn: appointmentsApi.myAppointments,
    retry: false,
  });

  const { data: prescriptions } = useQuery({
    queryKey: ['myPrescriptions'],
    queryFn: prescriptionsApi.myPrescriptions,
    retry: false,
  });

  const { data: releasedReports } = useQuery({
    queryKey: ['myReleasedReviews'],
    queryFn: clinicalApi.myReleased,
    retry: false,
  });

  const patientName = myPatient ? `${myPatient.first_name} ${myPatient.last_name}` : 'Patient';
  const activeScriptsCount = prescriptions?.length || 0;
  const upcomingApptsCount = appointments?.length || 0;
  const reportsCount = releasedReports?.length || 0;

  return (
    <div className="flex flex-col gap-8 max-w-5xl mx-auto pb-20 animate-fade-in">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[var(--border-subtle)] pb-6">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 mb-3 rounded-full bg-[var(--status-healthy)]/10 border border-[var(--status-healthy)]/20 text-[var(--status-healthy)] text-[10px] font-bold uppercase tracking-widest">
            <Sparkles className="w-3 h-3" /> Secure Patient Portal
          </div>
          <h1 className="text-3xl font-extrabold text-[var(--text-primary)] tracking-tight">
            Welcome, <span className="text-[var(--accent-primary)]">{patientName}</span>
          </h1>
          <p className="text-sm font-medium text-[var(--text-secondary)] mt-1.5">
            Your clinical records and doctor-approved health summaries are cryptographically secured.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="badge badge-healthy text-xs font-bold">
            <Shield className="w-3.5 h-3.5 mr-1" /> SBT Identity Verified
          </span>
        </div>
      </div>

      {/* Quick Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Link to="/patient/appointments" className="panel p-5 group flex flex-col hover:border-[var(--accent-primary)] transition-all">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]">
              <Calendar className="w-5 h-5" />
            </div>
            <ArrowRight className="w-4 h-4 text-[var(--text-muted)] group-hover:text-[var(--accent-primary)] transition-colors" />
          </div>
          <p className="text-2xl font-extrabold text-[var(--text-primary)] tracking-tight">{upcomingApptsCount}</p>
          <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] mt-1">Upcoming Visits</p>
        </Link>

        <Link to="/patient/prescriptions" className="panel p-5 group flex flex-col hover:border-emerald-500 transition-all">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-emerald-500/10 text-emerald-400">
              <Pill className="w-5 h-5" />
            </div>
            <ArrowRight className="w-4 h-4 text-[var(--text-muted)] group-hover:text-emerald-400 transition-colors" />
          </div>
          <p className="text-2xl font-extrabold text-[var(--text-primary)] tracking-tight">{activeScriptsCount} Active</p>
          <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] mt-1">Prescriptions</p>
        </Link>

        <Link to="/patient/ai-reports" className="panel p-5 group flex flex-col hover:border-purple-500 transition-all">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-purple-500/10 text-purple-400">
              <FileText className="w-5 h-5" />
            </div>
            <ArrowRight className="w-4 h-4 text-[var(--text-muted)] group-hover:text-purple-400 transition-colors" />
          </div>
          <p className="text-2xl font-extrabold text-[var(--text-primary)] tracking-tight">{reportsCount} Released</p>
          <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] mt-1">Doctor AI Reports</p>
        </Link>

        <div className="panel p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-rose-500/10 text-rose-400">
              <HeartPulse className="w-5 h-5" />
            </div>
            <span className="badge badge-healthy text-[10px] font-bold">Stable</span>
          </div>
          <div>
            <p className="text-2xl font-extrabold text-[var(--text-primary)] tracking-tight">120/80 <span className="text-xs text-[var(--text-muted)] font-normal">mmHg</span></p>
            <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] mt-1">Latest Vitals</p>
          </div>
        </div>
      </div>

      {/* Main Content: Released Doctor AI Reports */}
      <div className="panel overflow-hidden">
        <div className="p-5 border-b border-[var(--border-subtle)] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 text-purple-400 flex items-center justify-center">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[var(--text-primary)]">Doctor-Approved AI Clinical Reports</h3>
              <p className="text-[11px] text-[var(--text-muted)]">Verified findings released directly by your care team</p>
            </div>
          </div>
          <Link to="/patient/ai-reports" className="text-xs font-bold text-[var(--accent-primary)] hover:underline">
            View All Reports
          </Link>
        </div>

        <div className="divide-y divide-[var(--border-subtle)]">
          {releasedReports && releasedReports.length > 0 ? (
            releasedReports.slice(0, 3).map((r: any) => (
              <div key={r.id} className="p-5 space-y-3 hover:bg-[var(--bg-panel-hover)] transition-colors">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-bold text-sm text-[var(--text-primary)]">{r.purpose || 'Clinical Review Report'}</h4>
                    <p className="text-xs text-[var(--text-muted)] mt-0.5 flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5" /> Released on {formatDate(r.released_at || r.approved_at)}
                      <span className="w-1 h-1 rounded-full bg-[var(--border-strong)]" />
                      <span>Approved by Primary Physician</span>
                    </p>
                  </div>
                  <span className="badge badge-healthy text-[10px] font-bold">
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Doctor Approved
                  </span>
                </div>

                <div className="p-4 rounded-xl bg-[var(--bg-panel)] border border-[var(--border-subtle)] text-xs text-[var(--text-secondary)] leading-relaxed">
                  <p className="font-semibold text-[var(--text-primary)] mb-1">Patient Summary:</p>
                  {r.patient_friendly_summary || r.report?.case_summary || 'Your physician has reviewed the AI analysis and updated your treatment plan.'}
                </div>

                {r.clinician_notes && (
                  <p className="text-xs text-[var(--text-muted)] italic">
                    <strong>Doctor Note:</strong> "{r.clinician_notes}"
                  </p>
                )}
              </div>
            ))
          ) : (
            <div className="p-10 text-center flex flex-col items-center justify-center">
              <Sparkles className="w-8 h-8 text-[var(--text-muted)] mb-2 opacity-50" />
              <p className="text-xs font-bold text-[var(--text-primary)]">No reports released yet</p>
              <p className="text-[11px] text-[var(--text-muted)] mt-1 max-w-sm">
                When your physician completes and approves an AI clinical review, their sanitized findings will appear here.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Two columns: Prescriptions & Care Team */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Active Prescriptions */}
        <div className="panel flex flex-col">
          <div className="p-5 border-b border-[var(--border-subtle)] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                <Pill className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[var(--text-primary)]">Active Prescriptions</h3>
                <p className="text-[11px] text-[var(--text-muted)] font-medium">Currently prescribed medications</p>
              </div>
            </div>
            <Link to="/patient/prescriptions" className="text-xs font-bold text-[var(--accent-primary)] hover:underline">
              View all
            </Link>
          </div>

          <div className="divide-y divide-[var(--border-subtle)] flex-1">
            {prescriptions && prescriptions.length > 0 ? (
              prescriptions.slice(0, 3).map((p: any) => (
                <div key={p.id} className="p-4 flex items-center justify-between hover:bg-[var(--bg-panel-hover)] transition-colors">
                  <div className="space-y-0.5">
                    <p className="text-xs font-bold text-[var(--text-primary)]">{p.medication_name} {p.dosage}</p>
                    <p className="text-[11px] text-[var(--text-secondary)]">{p.frequency} • {p.duration || 'Ongoing'}</p>
                  </div>
                  <span className="badge badge-healthy text-[10px] font-bold">Active</span>
                </div>
              ))
            ) : (
              <div className="p-8 text-center text-[var(--text-muted)] text-xs flex flex-col items-center justify-center flex-1">
                <Pill className="w-6 h-6 mb-2 opacity-50" />
                No active prescriptions on file.
              </div>
            )}
          </div>
        </div>

        {/* Care Team */}
        <div className="panel flex flex-col">
          <div className="p-5 border-b border-[var(--border-subtle)] flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] flex items-center justify-center">
              <UserRound className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[var(--text-primary)]">My Care Team</h3>
              <p className="text-[11px] text-[var(--text-muted)] font-medium">Your primary physician and clinical coordinator</p>
            </div>
          </div>

          <div className="p-5 space-y-3 flex-1 flex flex-col justify-center">
            <div className="p-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-panel-hover)] flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-full bg-[var(--accent-primary)] text-white flex items-center justify-center font-extrabold text-sm shadow-sm">
                RJ
              </div>
              <div>
                <p className="text-xs font-bold text-[var(--text-primary)]">Dr. Robert Jenkins, MD</p>
                <p className="text-[10px] text-[var(--accent-primary)] font-bold uppercase tracking-wider mt-0.5">Primary Care Physician</p>
                <p className="text-[11px] text-[var(--text-muted)] mt-0.5">Cardiology & Internal Medicine</p>
              </div>
            </div>

            <div className="p-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-panel-hover)] flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-full bg-gradient-to-tr from-purple-500 to-indigo-500 text-white flex items-center justify-center font-bold text-sm shadow-sm">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-bold text-[var(--text-primary)]">MedAgentOS Clinical Assistant</p>
                <p className="text-[10px] text-purple-400 font-bold uppercase tracking-wider mt-0.5">Privacy-Preserving Multi-Agent System</p>
                <p className="text-[11px] text-[var(--text-muted)] mt-0.5">10-agent collaborative decision support</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Cryptographic Privacy & Security Banner */}
      <div className="panel p-6 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border border-indigo-500/20 text-white rounded-2xl relative overflow-hidden">
        <div className="relative z-10 flex flex-col sm:flex-row items-center gap-5">
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center shrink-0">
            <Shield className="w-6 h-6 text-emerald-400" />
          </div>
          <div className="flex-1 text-center sm:text-left space-y-1">
            <h4 className="text-sm font-bold">Privacy-Preserving Architecture & Zero-Knowledge Proofs</h4>
            <p className="text-xs text-slate-300 leading-relaxed font-medium">
              Your health data is protected by Soulbound Token (SBT) identity controls and selective disclosure ZKP proofs. Your physician only releases curated summaries, ensuring raw notes and telemetry are never exposed without explicit consent.
            </p>
          </div>
          <Link
            to="/patient/consent"
            className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 transition-colors shrink-0 shadow"
          >
            Manage Consent
          </Link>
        </div>
      </div>
    </div>
  );
}
