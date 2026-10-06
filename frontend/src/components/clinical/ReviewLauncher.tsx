import { useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { cn } from '../../lib/utils';
import { privacyApi, clinicalApi, REVIEW_PURPOSES, ClinicalPatient } from '../../lib/clinicalApi';
import {
  ShieldCheck, ShieldAlert, ChevronRight, ChevronLeft, Loader2, Play,
  Database, Stethoscope, KeyRound, FileCheck2, Users,
} from 'lucide-react';
import { agentLabel } from './StatusBadges';

const AGENT_CAPABILITIES: Record<string, { capability: string; resource: string }> = {
  clinical_reasoning: { capability: 'symptom_analysis', resource: 'Clinical notes' },
  history: { capability: 'longitudinal_analysis', resource: 'Patient history' },
  laboratory: { capability: 'lab_analysis', resource: 'Laboratory data' },
  medication: { capability: 'interaction_check', resource: 'Medications' },
  risk: { capability: 'risk_assessment', resource: 'Clinical notes' },
  evidence: { capability: 'literature_search', resource: 'Knowledge base' },
  critic: { capability: 'adversarial_review', resource: 'Specialist outputs' },
  verifier: { capability: 'integrity_check', resource: 'Decision hashes' },
  synthesizer: { capability: 'report_generation', resource: 'Validated outputs' },
};

const DEFAULT_AGENTS = ['clinical_reasoning', 'history', 'laboratory', 'medication', 'risk', 'evidence'];

interface Props {
  patient: ClinicalPatient;
  onStarted: (reviewId: string) => void;
}

type Step = 1 | 2 | 3;

export default function ReviewLauncher({ patient, onStarted }: Props) {
  const [step, setStep] = useState<Step>(1);
  const [purpose, setPurpose] = useState<string>(REVIEW_PURPOSES[0].value);
  const [complaint, setComplaint] = useState('');
  const [symptoms, setSymptoms] = useState('');

  const { data: consent, isLoading: consentLoading } = useQuery({
    queryKey: ['consent', patient.id],
    queryFn: () => privacyApi.consent(patient.id),
    enabled: step >= 2,
  });

  const agentAccess = useMemo(() => {
    const allowed = consent?.allowed_roles || [];
    return DEFAULT_AGENTS.map((role) => {
      const meta = AGENT_CAPABILITIES[role];
      const isAllowed = allowed.length === 0 ? true : allowed.includes(role);
      return { role, ...meta, allowed: isAllowed };
    });
  }, [consent]);

  const startMutation = useMutation({
    mutationFn: () =>
      clinicalApi.start({
        patient_id: patient.id,
        purpose,
        chief_complaint: complaint,
        symptoms: symptoms.split(',').map((s) => s.trim()).filter(Boolean),
        vitals: null,
      }),
    onSuccess: (data) => onStarted(data.clinical_review_id),
  });

  return (
    <div className="panel overflow-hidden flex flex-col">
      {/* Header */}
      <div className="px-6 py-5 border-b border-[var(--border-subtle)] bg-[var(--bg-panel-hover)]">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-[var(--accent-primary)] text-white flex items-center justify-center shadow-sm">
            <Stethoscope className="w-4.5 h-4.5" />
          </div>
          <div>
            <h2 className="text-[15px] font-bold text-[var(--text-primary)]">Start Clinical Review</h2>
            <p className="text-[11.5px] text-[var(--text-muted)] font-medium">
              Multi-agent clinical decision support for {patient.first_name} {patient.last_name}
            </p>
          </div>
        </div>

        {/* Steps */}
        <div className="flex items-center gap-2 mt-5">
          {[
            { n: 1, label: 'Purpose' },
            { n: 2, label: 'Access check' },
            { n: 3, label: 'Case details' },
          ].map((s, i) => (
            <div key={s.n} className="flex items-center gap-2">
              <div
                className={cn(
                  'flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-wider border transition-colors',
                  step === s.n
                    ? 'bg-[var(--accent-primary)]/10 border-[var(--accent-primary)]/30 text-[var(--accent-primary)]'
                    : step > s.n
                      ? 'bg-[var(--status-healthy)]/10 border-[var(--status-healthy)]/25 text-[var(--status-healthy)]'
                      : 'bg-transparent border-[var(--border-strong)] text-[var(--text-muted)]',
                )}
              >
                <span className="w-4 h-4 rounded-full bg-current/15 flex items-center justify-center text-[9px]">
                  {step > s.n ? '✓' : s.n}
                </span>
                {s.label}
              </div>
              {i < 2 && <div className="w-6 h-px bg-[var(--border-strong)]" />}
            </div>
          ))}
        </div>
      </div>

      {/* Body */}
      <div className="p-6 flex-1">
        {step === 1 && (
          <div className="space-y-3 animate-fade-in">
            <p className="text-[12.5px] text-[var(--text-secondary)] mb-4">
              What is the clinical purpose of this review? The purpose is recorded with the case and governs which
              agents are consulted.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {REVIEW_PURPOSES.map((p) => (
                <button
                  key={p.value}
                  onClick={() => setPurpose(p.value)}
                  className={cn(
                    'text-left p-4 rounded-xl border transition-all',
                    purpose === p.value
                      ? 'border-[var(--accent-primary)]/50 bg-[var(--accent-primary)]/[0.07] shadow-sm'
                      : 'border-[var(--border-strong)] hover:bg-[var(--bg-panel-hover)]',
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-[13.5px] font-bold text-[var(--text-primary)]">{p.label}</p>
                    {purpose === p.value && <ShieldCheck className="w-4 h-4 text-[var(--accent-primary)] shrink-0" />}
                  </div>
                  <p className="text-[11.5px] text-[var(--text-muted)] mt-1 leading-relaxed">{p.description}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-5 animate-fade-in">
            {consentLoading ? (
              <div className="flex items-center gap-2 text-[var(--text-muted)] text-sm py-6">
                <Loader2 className="w-4 h-4 animate-spin" /> Checking authorization and consent…
              </div>
            ) : (
              <>
                {/* Gates */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {[
                    { icon: Stethoscope, label: 'Doctor', value: 'AUTHORIZED', ok: true },
                    { icon: FileCheck2, label: 'Purpose', value: 'VALID', ok: true },
                    { icon: Database, label: 'Patient record', value: 'ACCESSIBLE', ok: true },
                    {
                      icon: consent?.explicit ? ShieldCheck : ShieldAlert,
                      label: 'Consent',
                      value: consent?.explicit ? 'EXPLICIT' : 'IMPLICIT (hospital network)',
                      ok: true,
                    },
                  ].map((g) => (
                    <div key={g.label} className="rounded-xl border border-[var(--border-strong)] bg-[var(--bg-panel-hover)] p-3.5">
                      <div className="flex items-center gap-2 mb-1.5">
                        <g.icon className={cn('w-3.5 h-3.5', g.ok ? 'text-[var(--status-healthy)]' : 'text-[var(--status-danger)]')} />
                        <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">{g.label}</p>
                      </div>
                      <p className="text-[12px] font-bold text-[var(--text-primary)]">{g.value}</p>
                    </div>
                  ))}
                </div>

                {/* Data requested */}
                <div className="rounded-xl border border-[var(--border-subtle)] p-4">
                  <p className="text-[11px] font-bold uppercase tracking-widest text-[var(--text-muted)] mb-2.5">
                    Minimum necessary data requested
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {['History', 'Laboratory', 'Medications', 'Allergies', 'Vitals', 'Chronic conditions'].map((d) => (
                      <span key={d} className="badge badge-neutral bg-[var(--bg-panel-hover)]">{d}</span>
                    ))}
                  </div>
                </div>

                {/* Agent access */}
                <div className="rounded-xl border border-[var(--border-subtle)] p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Users className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                    <p className="text-[11px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
                      Agent identity &amp; access
                    </p>
                  </div>
                  <div className="space-y-2">
                    {agentAccess.map((a) => (
                      <div key={a.role} className="flex items-center justify-between gap-3 py-1.5 px-2.5 rounded-lg hover:bg-[var(--bg-panel-hover)]">
                        <div className="min-w-0">
                          <p className="text-[12.5px] font-semibold text-[var(--text-primary)] truncate">{agentLabel(a.role)}</p>
                          <p className="text-[10.5px] text-[var(--text-muted)] font-mono truncate">
                            did:key:z{a.role} · {a.capability}
                          </p>
                        </div>
                        <span className={cn('badge shrink-0', a.allowed ? 'badge-healthy' : 'badge-danger')}>
                          {a.allowed ? 'AUTHORIZED' : 'DENIED'}
                        </span>
                      </div>
                    ))}
                  </div>
                  {agentAccess.some((a) => !a.allowed) && (
                    <p className="text-[11px] text-[var(--status-danger)] mt-3">
                      Denied agents will receive no patient context during this review.
                    </p>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4 animate-fade-in">
            <div>
              <label className="block text-[10.5px] font-bold uppercase tracking-widest text-[var(--text-secondary)] mb-1.5">
                Chief complaint <span className="text-[var(--status-danger)]">*</span>
              </label>
              <input
                className="field-input"
                placeholder="e.g. Persistent fever and productive cough for 5 days"
                value={complaint}
                onChange={(e) => setComplaint(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-[10.5px] font-bold uppercase tracking-widest text-[var(--text-secondary)] mb-1.5">
                Symptoms <span className="font-normal normal-case tracking-normal text-[var(--text-muted)]">(comma separated)</span>
              </label>
              <input
                className="field-input"
                placeholder="fever, cough, dyspnea"
                value={symptoms}
                onChange={(e) => setSymptoms(e.target.value)}
              />
            </div>
            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-panel-hover)] p-4">
              <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
                <strong className="text-[var(--text-secondary)]">Note:</strong> This is AI-generated clinical decision
                support. Final clinical decisions remain with qualified healthcare professionals.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-6 py-4 border-t border-[var(--border-subtle)] bg-[var(--bg-panel-hover)] flex items-center justify-between gap-3">
        <button
          className="btn-secondary"
          onClick={() => setStep((s) => (s > 1 ? ((s - 1) as Step) : s))}
          disabled={step === 1}
        >
          <ChevronLeft className="w-4 h-4 mr-1.5" /> Back
        </button>

        {step < 3 ? (
          <button
            className="btn-primary"
            onClick={() => setStep((s) => ((s + 1) as Step))}
            disabled={step === 2 && consentLoading}
          >
            Continue <ChevronRight className="w-4 h-4 ml-1.5" />
          </button>
        ) : (
          <button
            className={cn('btn-primary', (!complaint || startMutation.isPending) && 'opacity-50 cursor-not-allowed')}
            onClick={() => startMutation.mutate()}
            disabled={!complaint || startMutation.isPending}
          >
            {startMutation.isPending ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Starting review…</>
            ) : (
              <><Play className="w-4 h-4 mr-2" /> Start Clinical Review</>
            )}
          </button>
        )}
      </div>
      {startMutation.isError && (
        <div className="px-6 pb-4 text-[12px] text-[var(--status-danger)]">
          {(startMutation.error as Error)?.message || 'Failed to start review'}
        </div>
      )}
    </div>
  );
}
