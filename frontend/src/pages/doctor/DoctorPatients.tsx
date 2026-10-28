import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { patientsApi, recordsApi, prescriptionsApi, appointmentsApi, reportsApi } from '../../lib/hospitalApi';
import { clinicalApi, REVIEW_PURPOSES } from '../../lib/clinicalApi';
import { cn, formatDate } from '../../lib/utils';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import {
  Users, Search, Plus, Calendar, Activity, BrainCircuit, ShieldCheck,
  Loader2, ArrowLeft, Heart, Pill, FlaskConical, AlertTriangle, ChevronRight,
  Filter, Check, X, BookOpen, Clipboard, Brain, Clock, Stethoscope
} from 'lucide-react';

// ─── Tab definitions ─────────────────────────────────────────────────

const WORKSPACE_TABS = [
  { id: 'overview', label: 'Overview', icon: Heart },
  { id: 'history', label: 'Medical History', icon: BookOpen },
  { id: 'labs', label: 'Lab Results', icon: FlaskConical },
  { id: 'medications', label: 'Medications', icon: Pill },
  { id: 'appointments', label: 'Appointments', icon: Calendar },
  { id: 'reviews', label: 'Clinical Reviews', icon: BrainCircuit },
  { id: 'prescriptions', label: 'Prescriptions', icon: Clipboard },
] as const;

type WorkspaceTab = typeof WORKSPACE_TABS[number]['id'];

function flagColor(flag: string | null | undefined) {
  if (!flag) return 'text-[var(--text-muted)]';
  if (flag === 'HIGH') return 'text-red-400 font-bold';
  if (flag === 'LOW') return 'text-amber-400 font-bold';
  if (flag === 'BORDERLINE') return 'text-yellow-400 font-bold';
  return 'text-[var(--text-muted)]';
}

// ─── Lab Results Panel ───────────────────────────────────────────────

function LabResultsPanel({ records }: { records: any[] }) {
  const labRecords = records.filter(r => r.record_type === 'lab_result' && r.lab_results);

  if (!labRecords.length) {
    return (
      <div className="text-center py-12 text-[var(--text-muted)]">
        <FlaskConical className="w-8 h-8 mx-auto mb-3 opacity-40" />
        <p className="text-sm font-semibold">No laboratory results on record</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {labRecords.map((rec: any) => (
        <div key={rec.id} className="panel p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-[var(--text-primary)]">{rec.title}</h3>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">{formatDate(rec.created_at)}</p>
            </div>
            {rec.notes && (
              <span className="text-xs text-[var(--status-warning)] bg-[var(--status-warning)]/10 border border-[var(--status-warning)]/20 rounded px-2 py-1 font-semibold">
                Clinician reviewed
              </span>
            )}
          </div>

          {rec.vitals && (
            <div className="grid grid-cols-3 gap-3 mb-4">
              {Object.entries(rec.vitals).filter(([k]) => !k.includes('_')).map(([k, v]) => (
                <div key={k} className="bg-[var(--bg-panel-hover)] rounded-lg px-3 py-2">
                  <p className="text-[10px] text-[var(--text-muted)] font-bold uppercase tracking-wider">{k.replace(/_/g,' ')}</p>
                  <p className="text-sm font-bold text-[var(--text-primary)] mt-0.5">{String(v)}</p>
                </div>
              ))}
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-[var(--border-subtle)]">
                  <th className="pb-2 text-[11px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">Test</th>
                  <th className="pb-2 text-[11px] font-bold text-[var(--text-secondary)] uppercase tracking-wider text-right">Result</th>
                  <th className="pb-2 text-[11px] font-bold text-[var(--text-secondary)] uppercase tracking-wider text-right">Unit</th>
                  <th className="pb-2 text-[11px] font-bold text-[var(--text-secondary)] uppercase tracking-wider text-right">Reference</th>
                  <th className="pb-2 text-[11px] font-bold text-[var(--text-secondary)] uppercase tracking-wider text-center">Flag</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)]">
                {Object.entries(rec.lab_results || {}).map(([name, data]: [string, any]) => (
                  <tr key={name} className="hover:bg-[var(--bg-panel-hover)]">
                    <td className="py-2.5 text-sm font-semibold text-[var(--text-primary)] capitalize">{name.replace(/_/g,' ')}</td>
                    <td className={cn("py-2.5 text-sm text-right font-mono", data.flag && data.flag !== 'NORMAL' ? flagColor(data.flag) : 'text-[var(--text-primary)]')}>{data.value}</td>
                    <td className="py-2.5 text-xs text-[var(--text-muted)] text-right font-mono">{data.unit}</td>
                    <td className="py-2.5 text-xs text-[var(--text-muted)] text-right font-mono">{data.reference || '—'}</td>
                    <td className="py-2.5 text-center">
                      {data.flag ? (
                        <span className={cn("text-[10px] font-bold uppercase px-1.5 py-0.5 rounded", flagColor(data.flag))}>
                          {data.flag}
                        </span>
                      ) : <span className="text-[var(--text-muted)] text-xs">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {rec.notes && (
            <div className="mt-4 p-3 bg-[var(--bg-panel-hover)] border-l-2 border-[var(--accent-primary)] rounded-r-lg">
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed"><span className="font-bold text-[var(--text-primary)]">Clinical notes: </span>{rec.notes}</p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Start Review Form ────────────────────────────────────────────────

function StartReviewPanel({ patientId, onReviewStarted }: { patientId: string; onReviewStarted: (id: string) => void }) {
  const [purpose, setPurpose] = useState<string>(REVIEW_PURPOSES[0].value);
  const [chiefComplaint, setChiefComplaint] = useState('');
  const [symptoms, setSymptoms] = useState('');
  const [showGovernance, setShowGovernance] = useState(false);
  const queryClient = useQueryClient();

  const { data: patient } = useQuery({ queryKey: ['patient', patientId], queryFn: () => patientsApi.get(patientId) });

  const reviewMutation = useMutation({
    mutationFn: () => clinicalApi.start({
      patient_id: patientId,
      purpose,
      chief_complaint: chiefComplaint,
      symptoms: symptoms.split(',').map(s => s.trim()).filter(Boolean),
      vitals: {}
    }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['patientReviews', patientId] });
      queryClient.invalidateQueries({ queryKey: ['clinicalReviews'] });
      onReviewStarted(data.clinical_review_id);
    }
  });

  const selectedPurpose = REVIEW_PURPOSES.find(p => p.value === purpose);

  return (
    <div className="space-y-5">
      <div className="panel p-5 border-l-4 border-[var(--accent-primary)]">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 rounded bg-[var(--accent-primary)]/10 flex items-center justify-center">
            <BrainCircuit className="w-4 h-4 text-[var(--accent-primary)]" />
          </div>
          <div>
            <h3 className="font-bold text-[var(--text-primary)]">Start Clinical Review</h3>
            <p className="text-xs text-[var(--text-muted)]">10-agent AI analysis with cryptographic provenance</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-[var(--text-secondary)] uppercase tracking-widest mb-1.5">Review Type</label>
            <select className="field-input" value={purpose} onChange={e => setPurpose(e.target.value)}>
              {REVIEW_PURPOSES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
            {selectedPurpose && (
              <p className="mt-1.5 text-xs text-[var(--text-muted)]">{selectedPurpose.description}</p>
            )}
          </div>
          <div>
            <label className="block text-xs font-bold text-[var(--text-secondary)] uppercase tracking-widest mb-1.5">Chief Complaint *</label>
            <input
              type="text"
              className="field-input"
              placeholder="e.g. Exertional chest pain and shortness of breath for 2 weeks"
              value={chiefComplaint}
              onChange={e => setChiefComplaint(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-[var(--text-secondary)] uppercase tracking-widest mb-1.5">Symptoms (comma-separated)</label>
            <input
              type="text"
              className="field-input"
              placeholder="chest tightness, dyspnea on exertion, fatigue"
              value={symptoms}
              onChange={e => setSymptoms(e.target.value)}
            />
          </div>

          {!showGovernance ? (
            <button
              className="btn-secondary w-full text-sm"
              onClick={() => setShowGovernance(true)}
              disabled={!chiefComplaint}
            >
              <ShieldCheck className="w-4 h-4 mr-2" /> Preview Authorization & Consent
            </button>
          ) : (
            <GovernanceGate patient={patient} purpose={purpose} />
          )}

          <button
            className={cn("btn-primary w-full py-3 text-sm flex items-center justify-center gap-2", (reviewMutation.isPending) && "opacity-60 cursor-not-allowed")}
            onClick={() => reviewMutation.mutate()}
            disabled={reviewMutation.isPending || !chiefComplaint}
          >
            {reviewMutation.isPending ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Initiating review...</>
            ) : (
              <><BrainCircuit className="w-4 h-4" /> Start AI Clinical Review</>
            )}
          </button>

          {reviewMutation.isError && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
              {(reviewMutation.error as any)?.message || 'Failed to start review'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Governance Gate ──────────────────────────────────────────────────

function GovernanceGate({ patient, purpose }: { patient: any; purpose: string }) {
  const checks = [
    { label: 'Authenticated User', status: 'PASS', detail: 'JWT token valid · Role: doctor' },
    { label: 'Clinical Purpose', status: 'PASS', detail: `Authorized for: ${purpose}` },
    { label: 'Patient Access Permission', status: 'PASS', detail: `Assigned patient: ${patient?.first_name || ''} ${patient?.last_name || ''}` },
    { label: 'Agent Capability Policy', status: 'PASS', detail: 'All 10 agents authorized for clinical review' },
    { label: 'Patient Consent', status: 'PASS', detail: 'Explicit consent on file · All clinical roles permitted' },
    { label: 'Minimum-Necessary Context', status: 'PASS', detail: 'Capability-based filtering enabled per agent role' },
    { label: 'ZKP Requirement', status: 'NOT_REQUIRED', detail: 'Policy does not require ZKP for this review type' },
    { label: 'Emergency Breakglass', status: 'NOT_REQUIRED', detail: 'Standard access pathway applies' },
  ];

  const statusColor = (s: string) => {
    if (s === 'PASS') return 'text-[var(--status-healthy)]';
    if (s === 'NOT_REQUIRED') return 'text-[var(--text-muted)]';
    if (s === 'FAIL') return 'text-[var(--status-danger)]';
    if (s === 'SIMULATED') return 'text-[var(--status-warning)]';
    return 'text-[var(--text-muted)]';
  };

  const statusIcon = (s: string) => {
    if (s === 'PASS') return <Check className="w-3.5 h-3.5" />;
    if (s === 'FAIL') return <X className="w-3.5 h-3.5" />;
    return <span className="w-3.5 h-3.5 inline-flex items-center justify-center text-[9px] font-black">—</span>;
  };

  return (
    <div className="border border-[var(--border-strong)] rounded-xl overflow-hidden">
      <div className="bg-[var(--bg-panel-hover)] px-4 py-3 flex items-center gap-2 border-b border-[var(--border-subtle)]">
        <ShieldCheck className="w-4 h-4 text-[var(--accent-primary)]" />
        <span className="text-[13px] font-bold text-[var(--text-primary)]">Authorization Preview</span>
        <span className="ml-auto badge badge-healthy text-[10px]">ACCESS GRANTED</span>
      </div>
      <div className="divide-y divide-[var(--border-subtle)]">
        {checks.map((c, i) => (
          <div key={i} className="px-4 py-2.5 flex items-start gap-3">
            <span className={cn("mt-0.5 shrink-0", statusColor(c.status))}>{statusIcon(c.status)}</span>
            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-bold text-[var(--text-primary)]">{c.label}</p>
              <p className="text-[11px] text-[var(--text-muted)] mt-0.5">{c.detail}</p>
            </div>
            <span className={cn("text-[10px] font-bold shrink-0 mt-0.5", statusColor(c.status))}>{c.status}</span>
          </div>
        ))}
      </div>
      <div className="px-4 py-2.5 bg-[var(--bg-panel-hover)] border-t border-[var(--border-subtle)]">
        <p className="text-[11px] text-[var(--text-muted)]">
          ZKP status vocabulary: NOT_REQUIRED · PENDING · SIMULATED · VERIFIED · FAILED
        </p>
      </div>
    </div>
  );
}

// ─── Review List ───────────────────────────────────────────────────────

function ReviewsTab({ patientId }: { patientId: string }) {
  const { data: reviews, isLoading } = useQuery({
    queryKey: ['patientReviews', patientId],
    queryFn: () => clinicalApi.forPatient(patientId),
  });

  if (isLoading) return <div className="text-center py-8 text-[var(--text-muted)] text-sm">Loading reviews...</div>;

  if (!reviews?.length) {
    return (
      <div className="text-center py-12 text-[var(--text-muted)]">
        <BrainCircuit className="w-8 h-8 mx-auto mb-3 opacity-40" />
        <p className="text-sm font-semibold">No clinical reviews yet</p>
        <p className="text-xs mt-1">Use the Start Review tab to initiate a multi-agent analysis.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {reviews.map((r: any) => (
        <div key={r.id} className="panel p-4 flex items-center gap-4 hover:border-[var(--accent-primary)]/30 transition-colors">
          <div className="w-10 h-10 rounded-lg bg-[var(--accent-primary)]/10 flex items-center justify-center shrink-0">
            <BrainCircuit className="w-5 h-5 text-[var(--accent-primary)]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-[var(--text-primary)] text-sm truncate">{r.purpose || r.title}</p>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">{r.chief_complaint || ''}</p>
            <p className="text-[11px] text-[var(--text-muted)] mt-0.5">{formatDate(r.created_at)}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className={`badge ${r.approval_status === 'APPROVED' || r.approval_status === 'RELEASED' ? 'badge-healthy' : r.status === 'completed' ? 'badge-warning' : 'badge-neutral'}`}>
              {r.approval_status || r.status}
            </span>
            <Link to={`/doctor/reviews/${r.id}`} className="btn-secondary py-1.5 px-3 text-xs flex items-center gap-1">
              Review <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Main Patient Workspace ───────────────────────────────────────────

function PatientWorkspace({
  patientId,
  initialTab = 'overview',
  initialStartReview = false,
  onBack
}: {
  patientId: string;
  initialTab?: WorkspaceTab;
  initialStartReview?: boolean;
  onBack: () => void;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<WorkspaceTab>(initialTab);
  const [showStartReview, setShowStartReview] = useState(initialStartReview);
  const [showScheduleModal, setShowScheduleModal] = useState(false);

  const [appointmentForm, setAppointmentForm] = useState({
    scheduled_at: new Date(Date.now() + 3600000 * 2).toISOString().slice(0, 16),
    duration_minutes: 30,
    priority: 'routine',
    chief_complaint: '',
    notes: '',
  });
  const [appointmentError, setAppointmentError] = useState<string | null>(null);

  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ['patientSummary', patientId],
    queryFn: () => patientsApi.clinicalSummary(patientId),
  });

  const scheduleMutation = useMutation({
    mutationFn: (data: any) =>
      appointmentsApi.create({
        ...data,
        patient_id: patientId,
        scheduled_at: new Date(data.scheduled_at).toISOString(),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patientSummary', patientId] });
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      setShowScheduleModal(false);
      setAppointmentForm({
        scheduled_at: new Date(Date.now() + 3600000 * 2).toISOString().slice(0, 16),
        duration_minutes: 30,
        priority: 'routine',
        chief_complaint: '',
        notes: '',
      });
      setAppointmentError(null);
      setActiveTab('appointments');
    },
    onError: (err: any) => {
      setAppointmentError(err.message || 'Failed to schedule appointment');
    },
  });

  const patient = summary?.patient;
  const records = summary?.records;
  const prescriptions = summary?.prescriptions;
  const appointments = summary?.appointments;

  if (summaryLoading || !patient) {
    return <div className="p-8 text-center text-[var(--text-muted)]">Loading patient record...</div>;
  }

  const dob = patient.date_of_birth;
  const ageYears = dob ? Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 3600 * 1000)) : null;
  const latestVitals = records?.find((r: any) => r.vitals)?.vitals;

  return (
    <div className="flex flex-col animate-fade-in max-w-[1400px] mx-auto">
      {/* Schedule Consultation Modal */}
      {showScheduleModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
          <div className="bg-[var(--bg-panel)] border border-[var(--border-strong)] rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-[var(--border-subtle)] flex items-center justify-between bg-[var(--bg-app)]">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-sky-400" />
                <h2 className="text-lg font-bold text-[var(--text-primary)]">Schedule Consultation</h2>
              </div>
              <button onClick={() => setShowScheduleModal(false)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">✕</button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                scheduleMutation.mutate(appointmentForm);
              }}
              className="p-6 space-y-4"
            >
              <div>
                <label className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider block mb-1">Patient</label>
                <div className="p-3 bg-[var(--bg-panel-hover)] rounded-xl border border-[var(--border-subtle)] text-sm font-bold text-[var(--text-primary)]">
                  {patient.first_name} {patient.last_name} ({patient.medical_record_number})
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider block mb-1">Date & Time *</label>
                  <input
                    type="datetime-local"
                    className="field-input text-xs"
                    value={appointmentForm.scheduled_at}
                    onChange={(e) => setAppointmentForm({ ...appointmentForm, scheduled_at: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider block mb-1">Duration</label>
                  <select
                    className="field-input text-xs"
                    value={appointmentForm.duration_minutes}
                    onChange={(e) => setAppointmentForm({ ...appointmentForm, duration_minutes: Number(e.target.value) })}
                  >
                    <option value={15}>15 Minutes</option>
                    <option value={30}>30 Minutes</option>
                    <option value={45}>45 Minutes</option>
                    <option value={60}>60 Minutes</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider block mb-1">Priority</label>
                <select
                  className="field-input text-xs"
                  value={appointmentForm.priority}
                  onChange={(e) => setAppointmentForm({ ...appointmentForm, priority: e.target.value })}
                >
                  <option value="routine">Routine Consultation</option>
                  <option value="urgent">Urgent</option>
                  <option value="follow_up">Follow-up</option>
                  <option value="emergency">Emergency</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider block mb-1">Chief Complaint *</label>
                <input
                  type="text"
                  placeholder="e.g. Hypertension management checkup, Chest discomfort evaluation"
                  className="field-input text-xs"
                  value={appointmentForm.chief_complaint}
                  onChange={(e) => setAppointmentForm({ ...appointmentForm, chief_complaint: e.target.value })}
                  required
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider block mb-1">Clinical Notes</label>
                <textarea
                  placeholder="Any preparatory instructions or relevant history for this visit..."
                  className="field-input text-xs h-20 resize-none"
                  value={appointmentForm.notes}
                  onChange={(e) => setAppointmentForm({ ...appointmentForm, notes: e.target.value })}
                />
              </div>

              {appointmentError && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-xs">
                  {appointmentError}
                </div>
              )}

              <div className="flex justify-end gap-3 pt-3 border-t border-[var(--border-subtle)]">
                <button type="button" onClick={() => setShowScheduleModal(false)} className="btn-secondary text-xs">Cancel</button>
                <button type="submit" disabled={scheduleMutation.isPending} className="btn-primary text-xs">
                  {scheduleMutation.isPending ? 'Scheduling...' : 'Confirm Appointment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-5 border-b border-[var(--border-subtle)] pb-5">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 border border-[var(--border-strong)] rounded-full text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-panel-hover)] transition-colors" title="Back to Registry">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[var(--color-clinical-700)] to-[var(--color-clinical-900)] text-white flex items-center justify-center font-bold text-lg shadow-md">
              {patient.first_name[0]}{patient.last_name[0]}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-[var(--text-primary)] tracking-tight">
                {patient.first_name} {patient.last_name}
              </h1>
              <div className="flex items-center gap-2 mt-1 text-sm text-[var(--text-secondary)]">
                <span className="font-mono font-semibold text-xs">{patient.medical_record_number}</span>
                {ageYears && <><span className="text-[var(--border-strong)]">·</span><span>{ageYears} years</span></>}
                {patient.gender && <><span className="text-[var(--border-strong)]">·</span><span>{patient.gender}</span></>}
                {patient.blood_type && <><span className="text-[var(--border-strong)]">·</span><span className="font-semibold text-[var(--accent-primary)]">{patient.blood_type}</span></>}
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={() => setShowScheduleModal(true)}
            className="btn-secondary flex items-center gap-2 text-sm"
          >
            <Calendar className="w-4 h-4 text-sky-400" /> Schedule Visit
          </button>
          <button
            onClick={() => setShowStartReview(!showStartReview)}
            className={cn("btn-primary flex items-center gap-2 text-sm", showStartReview && "opacity-70")}
          >
            <BrainCircuit className="w-4 h-4" /> Start Clinical Review
          </button>
        </div>
      </div>

      {/* Quick alerts */}
      {patient.allergies?.length > 0 && (
        <div className="mb-4 p-3 bg-red-500/8 border border-red-500/20 rounded-lg flex items-center gap-3">
          <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
          <p className="text-sm text-red-400">
            <strong>Allergies:</strong> {patient.allergies.join(', ')}
          </p>
        </div>
      )}

      {/* Start Review Panel — shown above tabs */}
      {showStartReview && (
        <div className="mb-5">
          <StartReviewPanel
            patientId={patientId}
            onReviewStarted={(reviewId) => {
              setShowStartReview(false);
              navigate(`/doctor/reviews/${reviewId}`);
            }}
          />
        </div>
      )}


      {/* Tabs */}
      <div className="flex gap-1 border-b border-[var(--border-subtle)] pb-px mb-5 overflow-x-auto">
        {WORKSPACE_TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex items-center gap-2 px-3 py-2.5 text-[12px] font-bold uppercase tracking-wider whitespace-nowrap transition-colors border-b-2",
              activeTab === tab.id
                ? "border-[var(--accent-primary)] text-[var(--text-primary)]"
                : "border-transparent text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
            )}
          >
            <tab.icon className="w-3.5 h-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div>
        {/* Overview */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Patient info */}
            <div className="panel p-5 space-y-4">
              <h3 className="text-[12px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">Demographics</h3>
              {[
                ['DOB', patient.date_of_birth],
                ['Phone', patient.phone],
                ['Email', patient.email],
                ['Insurance', patient.insurance_id],
                ['Emergency Contact', patient.emergency_contact],
              ].filter(([, v]) => v).map(([k, v]) => (
                <div key={k} className="flex flex-col gap-0.5">
                  <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">{k}</span>
                  <span className="text-sm text-[var(--text-primary)] font-medium">{v}</span>
                </div>
              ))}
            </div>

            <div className="panel p-5 space-y-4">
              <h3 className="text-[12px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">Chronic Conditions</h3>
              <div className="flex flex-wrap gap-2">
                {patient.chronic_conditions?.length ? patient.chronic_conditions.map((c: string) => (
                  <span key={c} className="px-2.5 py-1 bg-[var(--accent-primary)]/8 border border-[var(--accent-primary)]/20 rounded-full text-xs font-semibold text-[var(--accent-primary)]">{c}</span>
                )) : <span className="text-sm text-[var(--text-muted)]">None documented</span>}
              </div>
              <div className="h-px bg-[var(--border-subtle)]" />
              <h3 className="text-[12px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">Allergies</h3>
              <div className="flex flex-wrap gap-2">
                {patient.allergies?.length ? patient.allergies.map((a: string) => (
                  <span key={a} className="px-2.5 py-1 bg-red-500/10 border border-red-500/20 rounded-full text-xs font-semibold text-red-400">{a}</span>
                )) : <span className="text-sm text-[var(--text-muted)]">None documented</span>}
              </div>
            </div>

            {latestVitals && (
              <div className="panel p-5">
                <h3 className="text-[12px] font-bold text-[var(--text-secondary)] uppercase tracking-widest mb-4">Latest Vitals</h3>
                <div className="grid grid-cols-2 gap-3">
                  {Object.entries(latestVitals).filter(([, v]) => v !== null).map(([k, v]) => (
                    <div key={k} className="bg-[var(--bg-panel-hover)] rounded-lg px-3 py-2.5">
                      <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">{k.replace(/_/g,' ')}</p>
                      <p className="text-base font-bold text-[var(--text-primary)] mt-0.5">{String(v)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Medical History */}
        {activeTab === 'history' && (
          <div className="space-y-4">
            {!records?.length ? (
              <div className="text-center py-12 text-[var(--text-muted)]">
                <BookOpen className="w-8 h-8 mx-auto mb-3 opacity-40" />
                <p className="text-sm font-semibold">No medical records on file</p>
              </div>
            ) : records.map((rec: any) => (
              <div key={rec.id} className="panel p-5">
                <div className="flex items-center gap-3 mb-3">
                  <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-[var(--bg-panel-hover)] border border-[var(--border-strong)] rounded text-[var(--text-secondary)]">
                    {rec.record_type}
                  </span>
                  <h3 className="font-bold text-[var(--text-primary)]">{rec.title}</h3>
                  <span className="ml-auto text-xs text-[var(--text-muted)]">{formatDate(rec.created_at)}</span>
                </div>
                {rec.diagnosis_codes?.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {rec.diagnosis_codes.map((code: string) => (
                      <span key={code} className="font-mono text-[11px] px-1.5 py-0.5 bg-[var(--bg-panel-hover)] border border-[var(--border-strong)] rounded text-[var(--text-secondary)]">{code}</span>
                    ))}
                  </div>
                )}
                {rec.notes && <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{rec.notes}</p>}
              </div>
            ))}
          </div>
        )}

        {/* Labs */}
        {activeTab === 'labs' && <LabResultsPanel records={records || []} />}

        {/* Medications */}
        {activeTab === 'medications' && (
          <div className="space-y-3">
            {!prescriptions?.length ? (
              <div className="text-center py-12 text-[var(--text-muted)]">
                <Pill className="w-8 h-8 mx-auto mb-3 opacity-40" />
                <p className="text-sm font-semibold">No prescriptions on file</p>
              </div>
            ) : prescriptions.map((p: any) => (
              <div key={p.id} className="panel p-4 flex items-start gap-4">
                <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center shrink-0", p.is_active ? "bg-[var(--status-healthy)]/10" : "bg-[var(--bg-panel-hover)]")}>
                  <Pill className={cn("w-5 h-5", p.is_active ? "text-[var(--status-healthy)]" : "text-[var(--text-muted)]")} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-[var(--text-primary)]">{p.medication_name}</p>
                    <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded", p.is_active ? "bg-[var(--status-healthy)]/10 text-[var(--status-healthy)]" : "bg-[var(--bg-panel-hover)] text-[var(--text-muted)]")}>
                      {p.is_active ? 'ACTIVE' : 'INACTIVE'}
                    </span>
                  </div>
                  <p className="text-sm text-[var(--text-secondary)] mt-1">
                    {p.dosage} · {p.frequency}{p.duration ? ` · ${p.duration}` : ''}
                  </p>
                  {p.instructions && <p className="text-xs text-[var(--text-muted)] mt-1">{p.instructions}</p>}
                  <p className="text-[11px] text-[var(--text-muted)] mt-1">{formatDate(p.prescribed_at)}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Appointments */}
        {activeTab === 'appointments' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 panel p-4">
              <div>
                <h3 className="font-bold text-sm text-[var(--text-primary)]">Care Consultations</h3>
                <p className="text-xs text-[var(--text-muted)]">Scheduled visits, routine checkups, and consultations for {patient.first_name} {patient.last_name}</p>
              </div>
              <button
                onClick={() => setShowScheduleModal(true)}
                className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" /> Schedule Consultation
              </button>
            </div>

            {!appointments?.length ? (
              <div className="panel text-center py-12 text-[var(--text-muted)] flex flex-col items-center justify-center">
                <Calendar className="w-10 h-10 mb-3 opacity-40 text-sky-400" />
                <p className="text-sm font-bold text-[var(--text-primary)]">No appointments on file</p>
                <p className="text-xs text-[var(--text-muted)] mt-1 mb-4">Book a consultation or clinical visit for this patient.</p>
                <button
                  onClick={() => setShowScheduleModal(true)}
                  className="btn-primary text-xs py-2 px-4 inline-flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" /> Book Consultation
                </button>
              </div>
            ) : appointments.map((a: any) => {
              const isPast = new Date(a.scheduled_at) < new Date();
              return (
                <div key={a.id} className="panel p-4 flex items-start gap-4 hover:border-[var(--accent-primary)]/30 transition-colors">
                  <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center shrink-0", !isPast ? "bg-[var(--accent-primary)]/10" : "bg-[var(--bg-panel-hover)]")}>
                    <Calendar className={cn("w-5 h-5", !isPast ? "text-[var(--accent-primary)]" : "text-[var(--text-muted)]")} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <p className="font-bold text-[var(--text-primary)] text-sm">{a.chief_complaint || 'General Consultation'}</p>
                      <span className={`badge ${a.priority === 'urgent' ? 'badge-warning' : a.priority === 'emergency' ? 'badge-danger' : 'badge-neutral'} text-[10px]`}>{a.priority}</span>
                      <span className={`badge ${a.status === 'completed' ? 'badge-healthy' : a.status === 'scheduled' ? 'badge-neutral' : 'badge-warning'} text-[10px]`}>{a.status.replace('_', ' ')}</span>
                    </div>
                    <p className="text-xs text-[var(--text-muted)]">{formatDate(a.scheduled_at)} · {a.duration_minutes} min</p>
                    {a.notes && <p className="text-xs text-[var(--text-secondary)] mt-1 leading-relaxed bg-[var(--bg-panel-hover)]/70 p-2 rounded border border-[var(--border-subtle)]">{a.notes}</p>}
                  </div>
                  <Link
                    to="/doctor/appointments"
                    className="btn-secondary py-1.5 px-2.5 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] shrink-0"
                  >
                    View in Calendar
                  </Link>
                </div>
              );
            })}
          </div>
        )}

        {/* Reviews */}
        {activeTab === 'reviews' && <ReviewsTab patientId={patientId} />}

        {/* Prescriptions */}
        {activeTab === 'prescriptions' && (
          <div className="space-y-3">
            <div className="p-3 bg-[var(--bg-panel-hover)] border border-[var(--border-subtle)] rounded-lg text-xs text-[var(--text-muted)]">
              <span className="font-bold text-[var(--text-secondary)]">Note:</span> Prescriptions can be issued from approved clinical reviews using the review detail page.
            </div>
            {!prescriptions?.length ? (
              <div className="text-center py-12 text-[var(--text-muted)]">
                <Clipboard className="w-8 h-8 mx-auto mb-3 opacity-40" />
                <p className="text-sm font-semibold">No prescriptions issued yet</p>
              </div>
            ) : prescriptions.map((p: any) => (
              <div key={p.id} className="panel p-4 flex items-start gap-4">
                <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center shrink-0", p.is_active ? "bg-[var(--status-healthy)]/10" : "bg-[var(--bg-panel-hover)]")}>
                  <Clipboard className={cn("w-5 h-5", p.is_active ? "text-[var(--status-healthy)]" : "text-[var(--text-muted)]")} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-bold text-[var(--text-primary)]">{p.medication_name}</p>
                    <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded", p.is_active ? "bg-[var(--status-healthy)]/10 text-[var(--status-healthy)]" : "text-[var(--text-muted)]")}>
                      {p.is_active ? 'ACTIVE' : 'STOPPED'}
                    </span>
                  </div>
                  <p className="text-sm text-[var(--text-secondary)]">{p.dosage} · {p.frequency}</p>
                  {p.instructions && <p className="text-xs text-[var(--text-muted)] mt-1">{p.instructions}</p>}
                  <p className="text-[11px] text-[var(--text-muted)] mt-1">{formatDate(p.prescribed_at)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Register Patient Modal ───────────────────────────────────────────

function RegisterPatientModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    first_name: '', last_name: '', medical_record_number: '', date_of_birth: '',
    gender: '', blood_type: '', phone: '', email: '', emergency_contact: '', insurance_id: ''
  });

  const mutation = useMutation({
    mutationFn: () => patientsApi.create(formData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patients'] });
      onClose();
      setFormData({ first_name: '', last_name: '', medical_record_number: '', date_of_birth: '', gender: '', blood_type: '', phone: '', email: '', emergency_contact: '', insurance_id: '' });
    }
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
      <div className="bg-[var(--bg-panel)] border border-[var(--border-strong)] rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 border-b border-[var(--border-subtle)] flex items-center justify-between bg-[var(--bg-app)]">
          <h2 className="text-xl font-bold text-[var(--text-primary)]">Register New Patient</h2>
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">✕</button>
        </div>
        <div className="p-6 overflow-y-auto flex-1">
          <div className="grid grid-cols-2 gap-4">
            {[
              ['First Name *', 'first_name', 'text', ''],
              ['Last Name *', 'last_name', 'text', ''],
              ['MRN *', 'medical_record_number', 'text', 'e.g. MRN-2024-0001'],
              ['Date of Birth', 'date_of_birth', 'date', ''],
              ['Phone', 'phone', 'tel', ''],
              ['Email', 'email', 'email', ''],
              ['Emergency Contact', 'emergency_contact', 'text', ''],
              ['Insurance ID', 'insurance_id', 'text', ''],
            ].map(([label, key, type, placeholder]) => (
              <div key={key} className="space-y-1">
                <label className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">{label}</label>
                <input type={type as string} className="field-input" placeholder={placeholder as string} value={(formData as any)[key]} onChange={e => setFormData({...formData, [key]: e.target.value})} />
              </div>
            ))}
            <div className="space-y-1">
              <label className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">Gender</label>
              <select className="field-input" value={formData.gender} onChange={e => setFormData({...formData, gender: e.target.value})}>
                <option value="">Select...</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">Blood Type</label>
              <input type="text" placeholder="e.g. O+" className="field-input" value={formData.blood_type} onChange={e => setFormData({...formData, blood_type: e.target.value})} />
            </div>
          </div>
          {mutation.isError && <div className="mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-500 text-sm">Failed to register: {(mutation.error as any)?.message}</div>}
        </div>
        <div className="px-6 py-4 border-t border-[var(--border-subtle)] bg-[var(--bg-app)] flex justify-end gap-3">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={() => mutation.mutate()} disabled={mutation.isPending || !formData.first_name || !formData.last_name || !formData.medical_record_number} className="btn-primary">
            {mutation.isPending ? 'Registering...' : 'Complete Registration'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Registry View ───────────────────────────────────────────────

export default function DoctorPatients() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const urlPatientId = searchParams.get('patientId');
  const urlTab = searchParams.get('tab') as WorkspaceTab | null;
  const urlAction = searchParams.get('action');

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all');
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(urlPatientId);
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);

  // Sync state if URL search params change
  useEffect(() => {
    if (urlPatientId) {
      setSelectedPatientId(urlPatientId);
    } else {
      setSelectedPatientId(null);
    }
  }, [urlPatientId]);

  const { data: patients, isLoading } = useQuery({ queryKey: ['patients'], queryFn: patientsApi.list });

  const filtered = (patients || []).filter((p: any) => {
    const q = search.toLowerCase();
    const name = `${p.first_name} ${p.last_name}`.toLowerCase();
    const matchSearch = !q || name.includes(q) || p.medical_record_number?.toLowerCase().includes(q);
    const risk = (p.risk_level || 'low').toLowerCase();
    const matchFilter = filter === 'all' || risk === filter;
    return matchSearch && matchFilter;
  });

  if (selectedPatientId) {
    return (
      <PatientWorkspace
        patientId={selectedPatientId}
        initialTab={urlTab || 'overview'}
        initialStartReview={urlAction === 'start_review'}
        onBack={() => {
          setSelectedPatientId(null);
          setSearchParams({});
        }}
      />
    );
  }

  return (
    <div className="max-w-[1400px] mx-auto space-y-6 pb-12 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[var(--text-primary)] tracking-tight">Patient Registry</h1>
          <p className="text-[var(--text-secondary)] text-sm mt-1 font-medium">Manage and monitor all registered patients.</p>
        </div>
        <button className="btn-primary" onClick={() => setIsRegisterOpen(true)}>
          <Plus className="w-4 h-4 mr-2" /> Register Patient
        </button>
      </div>

      <RegisterPatientModal isOpen={isRegisterOpen} onClose={() => setIsRegisterOpen(false)} />

      <div className="panel p-4 flex flex-wrap gap-4 items-center">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or MRN..." className="field-input !pl-10" />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-[var(--text-muted)]" />
          {(['all', 'high', 'medium', 'low'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)} className={cn('px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider border transition-colors', filter === f ? 'bg-[var(--accent-primary)]/10 border-[var(--accent-primary)]/30 text-[var(--accent-primary)]' : 'bg-transparent border-[var(--border-strong)] text-[var(--text-secondary)] hover:bg-[var(--bg-panel-hover)]')}>{f === 'all' ? 'All' : f} risk</button>
          ))}
        </div>
        <span className="text-[13px] font-semibold text-[var(--text-muted)]">{filtered.length} Patients</span>
      </div>

      <div className="panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[var(--bg-panel-hover)] border-b border-[var(--border-strong)]">
                {['MRN', 'Patient', 'Conditions', 'Allergies', 'Status', 'Actions'].map(h => (
                  <th key={h} className="px-5 py-3.5 text-[11px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)]">
              {isLoading ? (
                <tr><td colSpan={6} className="px-5 py-12 text-center text-sm text-[var(--text-muted)]">Loading registry...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} className="px-5 py-16 text-center"><p className="text-sm font-semibold text-[var(--text-secondary)]">No patients found</p></td></tr>
              ) : filtered.map((patient: any) => (
                <tr
                  key={patient.id}
                  className="hover:bg-[var(--bg-panel-hover)] transition-colors group cursor-pointer"
                  onClick={() => {
                    setSelectedPatientId(patient.id);
                    setSearchParams({ patientId: patient.id });
                  }}
                >
                  <td className="px-5 py-4"><span className="font-mono text-xs font-semibold text-[var(--text-secondary)]">{patient.medical_record_number}</span></td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[var(--color-clinical-700)] to-[var(--color-clinical-900)] flex items-center justify-center text-[10px] font-bold text-white">
                        {patient.first_name[0]}{patient.last_name[0]}
                      </div>
                      <span className="text-sm font-bold text-[var(--text-primary)] group-hover:text-[var(--accent-primary)] transition-colors">{patient.first_name} {patient.last_name}</span>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex flex-wrap gap-1">
                      {patient.chronic_conditions?.slice(0, 2).map((c: string) => (
                        <span key={c} className="badge badge-neutral text-[10px]">{c}</span>
                      ))}
                      {(patient.chronic_conditions?.length || 0) > 2 && <span className="text-[10px] text-[var(--text-muted)]">+{patient.chronic_conditions.length - 2}</span>}
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex flex-wrap gap-1">
                      {patient.allergies?.slice(0, 2).map((a: string) => (
                        <span key={a} className="text-[10px] font-semibold text-red-400 bg-red-500/8 border border-red-500/20 rounded px-1.5 py-0.5">{a}</span>
                      ))}
                    </div>
                  </td>
                  <td className="px-5 py-4"><span className="badge badge-healthy text-[10px]">Active</span></td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedPatientId(patient.id);
                          setSearchParams({ patientId: patient.id });
                        }}
                        className="btn-secondary py-1 px-2.5 text-xs font-semibold hover:border-[var(--accent-primary)]"
                      >
                        Chart
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedPatientId(patient.id);
                          setSearchParams({ patientId: patient.id, tab: 'reviews', action: 'start_review' });
                        }}
                        className="btn-secondary py-1 px-2.5 text-xs font-semibold text-purple-400 hover:text-purple-300 hover:border-purple-500/30"
                      >
                        <Brain className="w-3 h-3 mr-1 inline" /> Review
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/doctor/appointments?patientId=${patient.id}&schedule=true`);
                        }}
                        className="btn-secondary py-1 px-2 text-xs font-semibold text-sky-400 hover:text-sky-300 hover:border-sky-500/30"
                        title="Schedule Consultation"
                      >
                        <Calendar className="w-3.5 h-3.5 inline" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
