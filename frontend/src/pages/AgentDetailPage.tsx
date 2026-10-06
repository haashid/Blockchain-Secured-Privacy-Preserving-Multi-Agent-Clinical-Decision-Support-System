import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { agentsApi } from '../lib/api';
import { cn, trustColor, formatDate } from '../lib/utils';
import { ArrowLeft, Shield, Activity, AlertTriangle, Lock } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

export default function AgentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: agent, isLoading } = useQuery({ queryKey: ['agent', id], queryFn: () => agentsApi.get(id!) });
  const { data: trustData } = useQuery({ queryKey: ['agentTrust', id], queryFn: () => agentsApi.trust(id!), enabled: !!id });

  if (isLoading) return <div className="text-[var(--color-text-muted)] p-8 text-center">Loading...</div>;
  if (!agent) return <div className="text-[var(--color-text-muted)] p-8 text-center">Agent not found</div>;

  const history = trustData?.history || [];
  const trustHistory = history.map((t: any) => ({
    score: t.new_score,
    label: formatDate(t.created_at),
  })).reverse();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold">{agent.display_name}</h1>
          <p className="text-[var(--color-text-secondary)] text-sm mt-1">{agent.id} • {agent.organization}</p>
        </div>
      </div>

      {/* Info Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { icon: Shield, label: 'Trust Score', value: `${agent.trust_score.toFixed(0)}/100`, color: trustColor(agent.trust_score) },
          { icon: Activity, label: 'Total Decisions', value: agent.total_decisions, color: 'text-[var(--color-accent)]' },
          { icon: Lock, label: 'Verification Rate', value: agent.total_decisions > 0 ? `${((agent.verification_successes / agent.total_decisions) * 100).toFixed(0)}%` : '—', color: 'text-emerald-400' },
          { icon: AlertTriangle, label: 'Anomalies', value: agent.anomalies_detected, color: agent.anomalies_detected > 0 ? 'text-orange-400' : 'text-[var(--color-text-secondary)]' },
        ].map(item => (
          <div key={item.label} className="bg-[var(--color-bg-card)] rounded-xl border border-[var(--color-border)] p-4">
            <div className="flex items-center gap-2 mb-1">
              <item.icon className={`w-4 h-4 ${item.color}`} />
              <span className="text-xs text-[var(--color-text-muted)]">{item.label}</span>
            </div>
            <p className={`text-xl font-bold ${item.color}`}>{item.value}</p>
          </div>
        ))}
      </div>

      {/* Trust Chart */}
      {trustHistory.length > 1 && (
        <div className="bg-[var(--color-bg-card)] rounded-xl border border-[var(--color-border)] p-5">
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-4">Trust Score History</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={trustHistory}>
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#64748b' }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#64748b' }} />
              <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }} />
              <Line type="monotone" dataKey="score" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Trust History Table */}
      {history.length > 0 && (
        <div className="bg-[var(--color-bg-card)] rounded-xl border border-[var(--color-border)] p-5">
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-4">Trust Events</h3>
          <div className="space-y-2">
            {history.slice(0, 20).map((t: any, i: number) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-[var(--color-border)] last:border-0 text-sm">
                <span className="text-[var(--color-text-secondary)]">{t.reason}</span>
                <div className="flex items-center gap-3">
                  <span className="text-[var(--color-text-muted)]">{formatDate(t.created_at)}</span>
                  <span className={cn('font-medium', t.delta > 0 ? 'text-emerald-400' : t.delta < 0 ? 'text-red-400' : 'text-[var(--color-text-muted)]')}>
                    {t.delta > 0 ? '+' : ''}{t.delta.toFixed(0)}
                  </span>
                  <span className={cn('font-mono text-xs', trustColor(t.new_score))}>{t.new_score.toFixed(0)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
