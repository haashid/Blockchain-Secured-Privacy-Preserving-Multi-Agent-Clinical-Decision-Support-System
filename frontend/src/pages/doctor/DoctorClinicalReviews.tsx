import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { clinicalApi, reviewStatusTone, reviewStatusLabel, hasActiveReviews, REVIEW_PURPOSES } from '../../lib/clinicalApi';
import { patientsApi } from '../../lib/hospitalApi';
import { cn, formatDate } from '../../lib/utils';
import {
  Brain, Clock, FileText, CheckCircle2, ChevronRight, Activity, Filter, Send, AlertTriangle,
  Plus, Loader2, X, Stethoscope, ShieldCheck
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function DoctorClinicalReviews() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [filterTab, setFilterTab] = useState<'all' | 'pending' | 'approved' | 'released'>('all');
  const [showNewModal, setShowNewModal] = useState(false);

  // New Review Form State
  const [formPatientId, setFormPatientId] = useState('');
  const [formPurpose, setFormPurpose] = useState<string>(REVIEW_PURPOSES[0].value);
  const [formComplaint, setFormComplaint] = useState('');
  const [formSymptoms, setFormSymptoms] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const { data: patients } = useQuery({
    queryKey: ['patients'],
    queryFn: patientsApi.list,
  });

  const startMutation = useMutation({
    mutationFn: () =>
      clinicalApi.start({
        patient_id: formPatientId,
        purpose: formPurpose,
        chief_complaint: formComplaint,
        symptoms: formSymptoms.split(',').map((s) => s.trim()).filter(Boolean),
        vitals: {},
      }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['clinicalReviews'] });
      setShowNewModal(false);
      setFormPatientId('');
      setFormComplaint('');
      setFormSymptoms('');
      setFormError(null);
      navigate(`/doctor/reviews/${res.clinical_review_id}`);
    },
    onError: (err: any) => {
      setFormError(err.message || 'Failed to initiate clinical review');
    },
  });

  const { data, isLoading } = useQuery({
    queryKey: ['clinicalReviews'],
    queryFn: () => clinicalApi.list(),
    refetchIntervalInBackground: false,
    staleTime: 10000,
    refetchInterval: (query) => {
      if (query.state.error) return false;
      const reviewData = query.state.data;
      if (!reviewData) return 4000;
      const combined = [...(reviewData.active || []), ...(reviewData.mine || [])];
      // Only continue polling if at least one review in the doctor's queue is actively running
      return hasActiveReviews(combined) ? 4000 : false;
    },
  });

  const reviews = data?.active || [];
  const myReviews = data?.mine || [];
  const allReviews = [...reviews, ...myReviews].filter((v, i, a) => a.findIndex(t => (t.id === v.id)) === i); // deduplicate

  const filteredReviews = allReviews.filter(r => {
    const status = (r as any).approval_status || r.status;
    if (filterTab === 'pending') return status === 'PENDING_APPROVAL' || status === 'AWAITING_REVIEW' || status === 'running' || status === 'completed';
    if (filterTab === 'approved') return status === 'APPROVED';
    if (filterTab === 'released') return status === 'RELEASED' || status === 'RELEASED_TO_PATIENT';
    return true;
  });

  const stats = {
    total: allReviews.length,
    pending: allReviews.filter(t => (t as any).approval_status === 'PENDING_APPROVAL' || (t as any).approval_status === 'AWAITING_REVIEW' || t.status === 'completed').length,
    approved: allReviews.filter(t => (t as any).approval_status === 'APPROVED').length,
    released: allReviews.filter(t => (t as any).approval_status === 'RELEASED' || (t as any).approval_status === 'RELEASED_TO_PATIENT').length,
  };

  const handleStartReview = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formPatientId) {
      setFormError('Please select a patient from the registry.');
      return;
    }
    if (!formComplaint.trim()) {
      setFormError('Please enter a chief complaint or reason for review.');
      return;
    }
    setFormError(null);
    startMutation.mutate();
  };

  return (
    <div className="max-w-[1240px] mx-auto space-y-6 pb-20 animate-fade-in">
      {/* New Clinical Review Modal */}
      {showNewModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
          <div className="bg-[var(--bg-panel)] border border-[var(--border-strong)] rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-[var(--border-subtle)] flex items-center justify-between bg-[var(--bg-app)]">
              <div className="flex items-center gap-2">
                <Brain className="w-5 h-5 text-purple-400" />
                <h2 className="text-lg font-bold text-[var(--text-primary)]">New Clinical Review</h2>
              </div>
              <button onClick={() => setShowNewModal(false)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">✕</button>
            </div>

            <form onSubmit={handleStartReview} className="p-6 space-y-4">
              <div>
                <label className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider block mb-1">Select Patient *</label>
                <select
                  className="field-input text-xs"
                  value={formPatientId}
                  onChange={(e) => setFormPatientId(e.target.value)}
                  required
                >
                  <option value="">Choose patient from registry...</option>
                  {(patients || []).map((p: any) => (
                    <option key={p.id} value={p.id}>
                      {p.first_name} {p.last_name} ({p.medical_record_number})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider block mb-1">Review Purpose</label>
                <select
                  className="field-input text-xs"
                  value={formPurpose}
                  onChange={(e) => setFormPurpose(e.target.value)}
                >
                  {REVIEW_PURPOSES.map((pur) => (
                    <option key={pur.value} value={pur.value}>
                      {pur.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider block mb-1">Chief Complaint *</label>
                <input
                  type="text"
                  placeholder="e.g. Exertional chest tightness, elevated BP 154/96, fatigue"
                  className="field-input text-xs"
                  value={formComplaint}
                  onChange={(e) => setFormComplaint(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider block mb-1">Symptoms (comma-separated)</label>
                <input
                  type="text"
                  placeholder="chest pressure, shortness of breath on exertion, lightheadedness"
                  className="field-input text-xs"
                  value={formSymptoms}
                  onChange={(e) => setFormSymptoms(e.target.value)}
                />
              </div>

              <div className="p-3 bg-[var(--bg-panel-hover)] rounded-xl border border-[var(--border-subtle)] text-xs text-[var(--text-muted)] flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 text-[var(--accent-primary)] shrink-0 mt-0.5" />
                <p>
                  Initiating this case runs the 10-specialist agent network (Supervisor, History, Lab, Reasoning, Risk, Evidence, Critic, Verifier, Synthesis) with cryptographic SHA-256 provenance.
                </p>
              </div>

              {formError && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-xs">
                  {formError}
                </div>
              )}

              <div className="flex justify-end gap-3 pt-3 border-t border-[var(--border-subtle)]">
                <button type="button" onClick={() => setShowNewModal(false)} className="btn-secondary text-xs">Cancel</button>
                <button type="submit" disabled={startMutation.isPending} className="btn-primary text-xs flex items-center gap-1.5">
                  {startMutation.isPending ? (
                    <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Launching Analysis...</>
                  ) : (
                    <><Brain className="w-3.5 h-3.5" /> Start AI Analysis</>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-[var(--text-primary)]">
            AI Clinical <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-indigo-400">Decision Reviews</span>
          </h1>
          <p className="text-[var(--text-muted)] text-sm mt-1">
            Doctor oversight, multi-agent reasoning outputs, and blockchain-anchored clinical approvals.
          </p>
        </div>
        <button
          onClick={() => setShowNewModal(true)}
          className="btn-primary flex items-center gap-2 text-sm shadow-sm"
        >
          <Plus className="w-4 h-4" /> New Clinical Review
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Reviews', value: stats.total, icon: FileText, color: 'text-indigo-400' },
          { label: 'Pending Approval', value: stats.pending, icon: Clock, color: 'text-amber-600' },
          { label: 'Doctor Approved', value: stats.approved, icon: CheckCircle2, color: 'text-emerald-400' },
          { label: 'Released to Patient', value: stats.released, icon: Send, color: 'text-sky-400' },
        ].map(s => (
          <div key={s.label} className="panel p-4 flex items-center gap-4">
            <div className={cn('p-2.5 rounded-xl bg-[var(--bg-panel-hover)] border border-[var(--border-subtle)]', s.color)}>
              <s.icon className="w-5 h-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-[var(--text-primary)] tabular-nums">{s.value}</p>
              <p className="text-[11px] text-[var(--text-muted)] font-semibold uppercase tracking-wider">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-[var(--border-subtle)] pb-2 text-xs font-bold">
        {[
          { id: 'all', label: 'All Reviews' },
          { id: 'pending', label: 'Pending Approval' },
          { id: 'approved', label: 'Doctor Approved' },
          { id: 'released', label: 'Released to Patient' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setFilterTab(tab.id as any)}
            className={cn(
              "px-4 py-2 rounded-xl transition-all",
              filterTab === tab.id
                ? "bg-[var(--accent-primary)] text-white shadow-sm"
                : "text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-panel-hover)]"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Case Reviews List */}
      <div className="panel overflow-hidden">
        <div className="p-4 border-b border-[var(--border-subtle)] flex items-center justify-between">
          <div className="flex items-center gap-2.5 text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">
            <Brain className="w-4 h-4 text-purple-400" />
            Clinical Decision Support Cases
          </div>
          <span className="text-xs text-[var(--text-muted)]">{filteredReviews.length} cases</span>
        </div>

        <div className="divide-y divide-[var(--border-subtle)]">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="p-5 space-y-2">
                <div className="skeleton h-4 w-1/3 rounded" />
                <div className="skeleton h-3 w-1/4 rounded" />
              </div>
            ))
          ) : filteredReviews.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center px-6">
              <Brain className="w-12 h-12 text-[var(--text-muted)] mb-3 opacity-40 text-purple-400" />
              <p className="text-[var(--text-primary)] font-bold text-sm">No clinical reviews match this filter</p>
              <p className="text-[var(--text-muted)] text-xs mt-1">Initiate a new AI review from any registered patient profile or click below.</p>
              <button
                onClick={() => setShowNewModal(true)}
                className="btn-primary text-xs py-2 px-4 mt-4 inline-flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" /> Start New Clinical Review
              </button>
            </div>
          ) : (
            filteredReviews.map(review => {
              const status = (review as any).approval_status || review.status;
              return (
                <div
                  key={review.id}
                  onClick={() => navigate(`/doctor/reviews/${review.id}`)}
                  className="w-full text-left p-5 transition-all hover:bg-[var(--bg-panel-hover)] group flex items-center justify-between cursor-pointer"
                >
                  <div className="space-y-1.5 min-w-0 pr-4">
                    <div className="flex items-center gap-3">
                      <p className="text-sm font-bold text-[var(--text-primary)] group-hover:text-[var(--accent-primary)] transition-colors truncate">
                        {review.title || 'Clinical Review Case'}
                      </p>
                      <span className={cn('badge text-[10px] font-bold uppercase tracking-wider', reviewStatusTone(status))}>
                        {reviewStatusLabel(status)}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-4 text-xs text-[var(--text-muted)]">
                      <span>Purpose: <strong className="text-[var(--text-secondary)]">{review.purpose || 'General Assessment'}</strong></span>
                      <span className="w-1 h-1 rounded-full bg-[var(--border-strong)]" />
                      <span>{formatDate(review.created_at)}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-xs font-bold text-[var(--accent-primary)] opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                      Open Review <ChevronRight className="w-4 h-4" />
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
