import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { runsApi } from '../lib/api';
import { cn, formatDate, formatMs, hashShort } from '../lib/utils';
import { ArrowLeft, CheckCircle2, Clock, Loader2, Hash, Link2 } from 'lucide-react';

export default function RunDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: run, isLoading } = useQuery({ queryKey: ['run', id], queryFn: () => runsApi.get(id!) });
  const { data: result } = useQuery({ queryKey: ['runResult', id], queryFn: () => runsApi.result(id!), enabled: !!id });

  const navigate = useNavigate();

  if (isLoading) return <div className="text-[var(--color-text-muted)] p-8 text-center">Loading...</div>;
  if (!run) return <div className="text-[var(--color-text-muted)] p-8 text-center">Run not found</div>;

  const isRunning = run.status === 'running';
  const isComplete = run.status === 'completed';
  const agents = run.selected_agents || [];
  const agentOutputs = result?.agent_outputs || [];
  const proofs = result?.proofs || [];
  const consensus = run.consensus_result || result?.consensus;
  const timeline = result?.timeline || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">Run {run.id.slice(0, 8)}</h1>
          <p className="text-[var(--color-text-secondary)] text-sm mt-1">
            Task {run.task_id.slice(0, 8)} • {run.mode} mode
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isRunning && <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />}
          <span className={cn('text-sm font-medium px-3 py-1 rounded-full', {
            'bg-emerald-500/20 text-emerald-400': isComplete,
            'bg-blue-500/20 text-blue-400': isRunning,
            'bg-yellow-500/20 text-yellow-400': run.status === 'pending',
            'bg-red-500/20 text-red-400': run.status === 'failed',
          })}>{run.status}</span>
        </div>
      </div>

      {/* Metrics Bar */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total Latency', value: formatMs(run.total_latency_ms) },
          { label: 'Agent Latency', value: formatMs(run.agent_latency_ms) },
          { label: 'Blockchain Latency', value: formatMs(run.blockchain_latency_ms) },
          { label: 'Verification Latency', value: formatMs(run.verification_latency_ms) },
        ].map(m => (
          <div key={m.label} className="bg-[var(--color-bg-card)] rounded-xl border border-[var(--color-border)] p-4 text-center">
            <p className="text-xs text-[var(--color-text-muted)]">{m.label}</p>
            <p className="text-lg font-bold text-[var(--color-text-primary)] mt-1">{m.value}</p>
          </div>
        ))}
      </div>

      {/* Agent Cards */}
      {agents.length > 0 && (
        <div className="bg-[var(--color-bg-card)] rounded-xl border border-[var(--color-border)] p-5">
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-4">Agent Outputs</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {agents.map((agentId: string) => {
              const output = agentOutputs.find((o: any) => o.agent_id === agentId);
              const proof = proofs.find((p: any) => p.agent_id === agentId);
              return (
                <div key={agentId} className="bg-[var(--color-bg-primary)] rounded-lg border border-[var(--color-border)] p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-[var(--color-text-primary)]">{agentId}</span>
                    {proof ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    ) : output ? (
                      <Clock className="w-4 h-4 text-yellow-400" />
                    ) : (
                      <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
                    )}
                  </div>
                  {output?.confidence != null && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-[var(--color-text-muted)]">Confidence:</span>
                      <div className="flex-1 h-1.5 bg-[var(--color-border)] rounded-full overflow-hidden">
                        <div className="h-full bg-[var(--color-accent)] rounded-full" style={{ width: `${output.confidence * 100}%` }} />
                      </div>
                      <span className="text-xs text-[var(--color-text-primary)]">{(output.confidence * 100).toFixed(0)}%</span>
                    </div>
                  )}
                  {proof?.content_hash && (
                    <div className="flex items-center gap-1.5">
                      <Hash className="w-3 h-3 text-[var(--color-text-muted)]" />
                      <span className="text-xs font-mono text-[var(--color-text-muted)]">{hashShort(proof.content_hash)}</span>
                    </div>
                  )}
                  {proof?.fabric_tx_id && (
                    <div className="flex items-center gap-1.5">
                      <Link2 className="w-3 h-3 text-purple-400" />
                      <span className="text-xs font-mono text-purple-400">TX: {hashShort(proof.fabric_tx_id)}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Consensus */}
      {consensus && (
        <div className="bg-[var(--color-bg-card)] rounded-xl border border-[var(--color-border)] p-5">
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3">Consensus Result</h3>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-[var(--color-text-muted)]">Status</p>
              <p className={cn('text-sm font-medium', {
                'text-emerald-400': consensus.final_status === 'accepted',
                'text-yellow-400': consensus.final_status === 'warning',
                'text-red-400': consensus.final_status === 'rejected',
              })}>{consensus.final_status || '—'}</p>
            </div>
            <div>
              <p className="text-xs text-[var(--color-text-muted)]">Agreement Score</p>
              <p className="text-sm font-medium text-[var(--color-text-primary)]">{consensus.agreement_score != null ? `${(consensus.agreement_score * 100).toFixed(0)}%` : '—'}</p>
            </div>
            <div>
              <p className="text-xs text-[var(--color-text-muted)]">Anomalies</p>
              <p className="text-sm font-medium text-[var(--color-text-primary)]">{consensus.anomalies?.length || 0}</p>
            </div>
          </div>
          {consensus.consensus && (
            <p className="text-sm text-[var(--color-text-secondary)] mt-3">{consensus.consensus}</p>
          )}
        </div>
      )}

      {/* Timeline */}
      {timeline.length > 0 && (
        <div className="bg-[var(--color-bg-card)] rounded-xl border border-[var(--color-border)] p-5">
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-4">Execution Timeline</h3>
          <div className="space-y-0">
            {timeline.map((event: any, i: number) => {
              const done = i < timeline.length - 1 || isComplete;
              return (
                <div key={i} className="flex items-start gap-3">
                  <div className="flex flex-col items-center">
                    <div className={cn('w-2.5 h-2.5 rounded-full mt-1.5 shrink-0', done ? 'bg-emerald-400' : 'bg-[var(--color-border)]')} />
                    {i < timeline.length - 1 && <div className="w-px h-6 bg-[var(--color-border)]" />}
                  </div>
                  <div className="pb-3">
                    <p className="text-sm text-[var(--color-text-primary)]">{event.event || event}</p>
                    {event.timestamp && <p className="text-xs text-[var(--color-text-muted)]">{formatDate(event.timestamp)}</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
