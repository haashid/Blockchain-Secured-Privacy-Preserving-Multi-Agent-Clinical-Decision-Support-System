import { cn } from '../../lib/utils';
import { reviewStatusLabel, reviewStatusTone } from '../../lib/clinicalApi';

export function ReviewStatusBadge({ status, className }: { status: string | null | undefined; className?: string }) {
  return (
    <span className={cn('badge', reviewStatusTone(status), className)}>
      {reviewStatusLabel(status)}
    </span>
  );
}

const AGENT_TONES: Record<string, string> = {
  QUEUED: 'badge-neutral',
  RUNNING: 'badge-warning',
  COMPLETED: 'badge-healthy',
  FAILED: 'badge-danger',
  RETRYING: 'badge-warning',
  REANALYZING: 'badge-warning',
};

const AGENT_LABELS: Record<string, string> = {
  QUEUED: 'Queued',
  RUNNING: 'Running',
  COMPLETED: 'Complete',
  FAILED: 'Failed',
  RETRYING: 'Retrying',
  REANALYZING: 'Re-analysis',
};

export function AgentStatusBadge({ status, className }: { status: string | null | undefined; className?: string }) {
  const key = (status || 'QUEUED').toUpperCase();
  return (
    <span className={cn('badge', AGENT_TONES[key] || 'badge-neutral', className)}>
      {key === 'RUNNING' && <span className="w-1.5 h-1.5 rounded-full bg-current mr-1.5 animate-pulse" />}
      {AGENT_LABELS[key] || status}
    </span>
  );
}

/** Human-friendly label for an internal agent role key. */
export function agentLabel(role: string): string {
  const map: Record<string, string> = {
    supervisor: 'Supervisor',
    clinical_reasoning: 'Clinical Reasoning',
    history: 'Medical History',
    laboratory: 'Laboratory',
    medication: 'Medication Safety',
    risk: 'Clinical Risk',
    evidence: 'Medical Evidence',
    critic: 'Clinical Critic',
    verifier: 'Verification',
    synthesizer: 'Clinical Synthesis',
  };
  return map[role] || role.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function ConfidenceMeter({ value }: { value: number | null | undefined }) {
  if (value === null || value === undefined) return <span className="text-[11px] text-[var(--text-muted)]">n/a</span>;
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);
  const tone =
    pct >= 80 ? 'bg-[var(--status-healthy)]' : pct >= 60 ? 'bg-[var(--status-warning)]' : 'bg-[var(--status-danger)]';
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 rounded-full bg-[var(--border-strong)] overflow-hidden">
        <div className={cn('h-full rounded-full', tone)} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[11px] font-semibold tabular-nums text-[var(--text-secondary)]">{pct}%</span>
    </div>
  );
}
