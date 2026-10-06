import { cn } from '../../lib/utils';
import { AgentExecution } from '../../lib/clinicalApi';
import { AgentStatusBadge, ConfidenceMeter, agentLabel } from './StatusBadges';
import { ArrowDown, GitBranch, RotateCcw, ShieldCheck, Sparkles } from 'lucide-react';

interface Props {
  agents: AgentExecution[] | undefined;
  selectedAgents: string[];
  reasoningRounds?: number;
  criticInterventions?: number;
  revisionTargets?: string[];
  className?: string;
}

const SPECIALISTS = ['clinical_reasoning', 'history', 'laboratory', 'medication', 'risk', 'evidence'];

function AgentCard({ role, agent }: { role: string; agent?: AgentExecution }) {
  const status = agent?.status || 'QUEUED';
  return (
    <div
      className={cn(
        'rounded-xl border p-3.5 transition-all min-w-0',
        status === 'RUNNING'
          ? 'border-[var(--accent-primary)]/40 bg-[var(--accent-primary)]/[0.06] shadow-[0_0_0_1px_var(--accent-primary)]/20'
          : status === 'COMPLETED'
            ? 'border-[var(--status-healthy)]/25 bg-[var(--status-healthy)]/[0.05]'
            : status === 'FAILED'
              ? 'border-[var(--status-danger)]/30 bg-[var(--status-danger)]/[0.05]'
              : 'border-[var(--border-strong)] bg-[var(--bg-panel-hover)]',
      )}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className="text-[12.5px] font-bold text-[var(--text-primary)] leading-tight truncate">{agentLabel(role)}</p>
        {agent?.revised && <RotateCcw className="w-3 h-3 text-[var(--status-warning)] shrink-0 mt-0.5" />}
      </div>
      <AgentStatusBadge status={status} className="!text-[10px] !px-2 !py-0.5" />
      {agent?.confidence !== null && agent?.confidence !== undefined && (
        <div className="mt-2.5">
          <ConfidenceMeter value={agent.confidence} />
        </div>
      )}
    </div>
  );
}

function Connector({ label }: { label?: string }) {
  return (
    <div className="flex flex-col items-center py-2.5">
      <div className="w-px h-5 bg-[var(--border-strong)]" />
      {label && (
        <span className="my-1 text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] px-2.5 py-1 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-panel)]">
          {label}
        </span>
      )}
      <ArrowDown className="w-3.5 h-3.5 text-[var(--border-strong)]" />
    </div>
  );
}

export default function ClinicalReviewGraph({
  agents,
  selectedAgents,
  reasoningRounds = 0,
  criticInterventions = 0,
  revisionTargets = [],
  className,
}: Props) {
  const byRole = new Map((agents || []).map((a) => [a.role, a]));

  // Only show specialists that were actually selected (falls back to the graph set).
  const activeSpecialists = SPECIALISTS.filter(
    (r) => selectedAgents.length === 0 || selectedAgents.includes(r) || byRole.has(r),
  );

  const hasCritic = byRole.has('critic') || selectedAgents.includes('critic');
  const hasVerifier = byRole.has('verifier') || selectedAgents.includes('verifier');
  const hasSynth = byRole.has('synthesizer') || selectedAgents.includes('synthesizer');

  return (
    <div className={cn('flex flex-col', className)}>
      {/* Supervisor */}
      <AgentCard role="supervisor" agent={byRole.get('supervisor')} />

      <Connector label="Plan" />

      {/* Parallel specialists */}
      {activeSpecialists.length > 0 && (
        <>
          <div className="flex items-center gap-2 mb-2.5">
            <GitBranch className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
              Parallel specialists
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {activeSpecialists.map((role) => (
              <AgentCard key={role} role={role} agent={byRole.get(role)} />
            ))}
          </div>
          <Connector />
        </>
      )}

      {/* Critic + re-analysis */}
      {hasCritic && (
        <>
          <AgentCard role="critic" agent={byRole.get('critic')} />
          {criticInterventions > 0 && (
            <div className="mt-2.5 rounded-xl border border-[var(--status-warning)]/30 bg-[var(--status-warning)]/[0.07] p-3">
              <div className="flex items-center gap-2 mb-1.5">
                <RotateCcw className="w-3.5 h-3.5 text-[var(--status-warning)]" />
                <span className="text-[11px] font-bold uppercase tracking-widest text-[var(--status-warning)]">
                  Re-analysis requested
                </span>
              </div>
              <p className="text-[12px] text-[var(--text-secondary)]">
                {revisionTargets.length > 0
                  ? `Targeted: ${revisionTargets.map(agentLabel).join(', ')}`
                  : 'Targeted specialist re-analysis was performed.'}
              </p>
              {reasoningRounds > 0 && (
                <p className="text-[11px] text-[var(--text-muted)] mt-1">
                  {reasoningRounds} reasoning round{reasoningRounds === 1 ? '' : 's'} used
                </p>
              )}
            </div>
          )}
          <Connector />
        </>
      )}

      {/* Verifier */}
      {hasVerifier && (
        <>
          <AgentCard role="verifier" agent={byRole.get('verifier')} />
          <Connector />
        </>
      )}

      {/* Synthesis */}
      {hasSynth && (
        <>
          <div className="rounded-xl border border-[var(--accent-primary)]/30 bg-[var(--accent-primary)]/[0.07] p-3.5">
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
              <p className="text-[12.5px] font-bold text-[var(--text-primary)]">Clinical Synthesis</p>
            </div>
            <div className="flex items-center gap-3">
              <AgentStatusBadge status={byRole.get('synthesizer')?.status || 'QUEUED'} className="!text-[10px] !px-2 !py-0.5" />
              {byRole.get('synthesizer')?.confidence !== null && byRole.get('synthesizer')?.confidence !== undefined && (
                <ConfidenceMeter value={byRole.get('synthesizer')!.confidence} />
              )}
            </div>
          </div>
          <div className="flex flex-col items-center py-2.5">
            <div className="w-px h-5 bg-[var(--border-strong)]" />
            <ArrowDown className="w-3.5 h-3.5 text-[var(--border-strong)]" />
          </div>
          <div className="rounded-xl border border-[var(--status-healthy)]/30 bg-[var(--status-healthy)]/[0.07] p-3 flex items-center gap-2.5">
            <ShieldCheck className="w-4 h-4 text-[var(--status-healthy)]" />
            <p className="text-[12.5px] font-bold text-[var(--text-primary)]">Clinical Decision Support Report</p>
          </div>
        </>
      )}
    </div>
  );
}
