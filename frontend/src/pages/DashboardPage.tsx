import { useQuery } from '@tanstack/react-query';
import { systemApi, agentsApi, auditApi } from '../lib/api';
import { clinicalApi } from '../lib/clinicalApi';
import { cn, formatDate } from '../lib/utils';
import {
  ListTodo, CheckCircle2, Activity, ShieldCheck, ShieldAlert,
  Users, Blocks, Clock, TrendingUp, Database, HardDrive,
  ArrowUpRight, Cpu, Zap, ScrollText
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { reviewStatusLabel, reviewStatusTone } from '../lib/clinicalApi';

/* ── Tooltip style ── */
const tooltipStyle = {
  background: 'var(--bg-panel)',
  border: '1px solid var(--border-strong)',
  borderRadius: 8,
  padding: '8px 12px',
  boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
  color: 'var(--text-primary)',
  fontSize: 12,
  fontWeight: 600,
  fontFamily: "'Urbanist', system-ui, sans-serif",
} as const;

function MetricCard({ title, value, icon: Icon, colorClass }: any) {
  return (
    <div className="panel p-4 flex flex-col justify-between h-28 border border-[var(--border-subtle)] relative overflow-hidden group hover:border-[var(--border-strong)] transition-colors">
      {/* Subtle glow */}
      <div className={`absolute -right-4 -top-4 w-16 h-16 rounded-full blur-xl opacity-10 ${colorClass.replace('text-', 'bg-')} group-hover:opacity-20 transition-opacity`} />
      <div className="flex items-center justify-between">
        <h3 className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">{title}</h3>
        <Icon className={`w-4 h-4 ${colorClass}`} />
      </div>
      <p className="text-3xl font-bold text-[var(--text-primary)] tracking-tight">{value}</p>
    </div>
  );
}

function StatusPill({ label, status }: { label: string; status?: string }) {
  const isHealthy = status === 'ok' || status === 'connected';
  const isMock = status === 'mock';
  const colorClass = isHealthy ? 'text-[var(--status-healthy)] bg-[var(--status-healthy)]/10 border-[var(--status-healthy)]/20' 
                   : isMock ? 'text-[var(--status-warning)] bg-[var(--status-warning)]/10 border-[var(--status-warning)]/20'
                   : 'text-[var(--status-danger)] bg-[var(--status-danger)]/10 border-[var(--status-danger)]/20';

  return (
    <div className="flex items-center justify-between bg-[var(--bg-panel-hover)] px-3 py-2 rounded-lg border border-[var(--border-subtle)]">
      <span className="text-[11px] font-bold text-[var(--text-secondary)] tracking-wider uppercase">{label}</span>
      <div className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest border ${colorClass}`}>
        {status || 'OFFLINE'}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { data: metrics } = useQuery({ queryKey: ['metrics'], queryFn: systemApi.metrics, refetchInterval: 10000 });
  const { data: ready }   = useQuery({ queryKey: ['ready'],   queryFn: systemApi.ready,   refetchInterval: 10000 });
  const { data: agents }  = useQuery({ queryKey: ['agents'],  queryFn: agentsApi.list });
  const { data: reviews } = useQuery({ queryKey: ['reviews'], queryFn: () => clinicalApi.list() });
  const { data: audits } = useQuery({ queryKey: ['auditstream'], queryFn: () => auditApi.list({ limit: 10 }) });

  const m = metrics || {
    total_tasks: 0, completed_tasks: 0, active_runs: 0,
    verified_decisions: 0, verification_failures: 0,
    suspicious_agents: 0, blockchain_transactions: 0, verification_success_rate: null,
  };
  
  const verificationRate = m.verification_success_rate != null ? `${m.verification_success_rate.toFixed(0)}%` : '—';

  const agentData = (agents || []).map(a => ({
    name: a.display_name.split(' ').slice(0, 2).join(' '),
    trust: a.trust_score,
  }));

  return (
    <div className="admin-theme min-h-screen bg-[var(--bg-app)] text-[var(--text-primary)] font-urbanist selection:bg-[var(--accent-primary)]/30">
      <div className="flex flex-col gap-6 max-w-[1600px] mx-auto animate-fade-in p-6 lg:p-8">
        
        {/* Header */}
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[var(--border-subtle)] pb-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              Clinical Intelligence <span className="text-[var(--accent-primary)] italic font-playfair">Command</span>
            </h1>
            <p className="text-sm font-medium text-[var(--text-secondary)] mt-1.5 flex items-center gap-2">
              <Activity className="w-4 h-4 text-[var(--status-healthy)]" /> Real-time system telemetry & swarm execution status
            </p>
          </div>
          <div className="flex gap-3">
            <Link to="/admin/tasks/new" className="btn-primary">
              <Zap className="w-4 h-4 mr-2" /> Dispatch Task
            </Link>
          </div>
        </div>

        {/* Top Strip: Status Telemetry */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <StatusPill label="Fabric Network" status={ready?.fabric} />
          <StatusPill label="AI Provider" status={ready?.ai_provider} />
          <StatusPill label="Database" status={ready?.database} />
          <StatusPill label="Object Storage" status={ready?.storage} />
        </div>

        {/* Middle Grid: Metrics */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard title="Active Clinical Reviews" value={reviews?.active?.length || 0} icon={ListTodo} colorClass="text-sky-400" />
          <MetricCard title="Cryptographic Blocks" value={m.blockchain_transactions} icon={Blocks} colorClass="text-[var(--accent-primary)]" />
          <MetricCard title="Active Agent Runs" value={m.active_runs} icon={Activity} colorClass="text-amber-400" />
          <MetricCard title="Verification Success" value={verificationRate} icon={ShieldCheck} colorClass="text-[var(--status-healthy)]" />
        </div>

        {/* Dense Data Tables */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Active Tasks Table */}
          <div className="panel flex flex-col border-[var(--border-strong)]">
            <div className="p-4 border-b border-[var(--border-subtle)] flex items-center justify-between bg-[var(--bg-panel-hover)]">
              <div className="flex items-center gap-2">
                <ListTodo className="w-4 h-4 text-sky-400" />
                <h3 className="text-xs font-bold uppercase tracking-widest">Active Operations</h3>
              </div>
              <Link to="/admin/tasks" className="text-xs font-bold text-[var(--accent-primary)] hover:underline">View all</Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[var(--border-subtle)] text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">
                    <th className="px-4 py-3">Review ID / Title</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-subtle)]">
                  {(reviews?.active || []).slice(0, 6).map(review => (
                    <tr key={review.id} className="hover:bg-[var(--bg-panel-hover)] transition-colors group">
                      <td className="px-4 py-3">
                        <Link to={`/admin/tasks/${review.id}`} className="block">
                          <p className="text-[12px] font-bold text-[var(--text-primary)] group-hover:text-[var(--accent-primary)] transition-colors truncate max-w-[200px]">{review.title}</p>
                          <p className="text-[10px] text-[var(--text-muted)] font-mono mt-0.5">{review.id.slice(0, 8)}</p>
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn('badge text-[10px]', reviewStatusTone(review.status))}>
                          {reviewStatusLabel(review.status)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-[11px] text-[var(--text-secondary)] font-mono">
                        {formatDate(review.created_at)}
                      </td>
                    </tr>
                  ))}
                  {(!reviews?.active || reviews.active.length === 0) && (
                    <tr>
                      <td colSpan={3} className="px-4 py-12 text-center text-xs text-[var(--text-muted)]">No active clinical reviews</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Agent Swarm Table */}
          <div className="panel flex flex-col border-[var(--border-strong)]">
            <div className="p-4 border-b border-[var(--border-subtle)] flex items-center justify-between bg-[var(--bg-panel-hover)]">
              <div className="flex items-center gap-2">
                <Cpu className="w-4 h-4 text-purple-400" />
                <h3 className="text-xs font-bold uppercase tracking-widest">Agent Swarm Integrity</h3>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[var(--border-subtle)] text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">
                    <th className="px-4 py-3">Agent Name</th>
                    <th className="px-4 py-3">Role</th>
                    <th className="px-4 py-3 text-right">Trust Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-subtle)]">
                  {(agents || []).slice(0, 6).map(agent => (
                    <tr key={agent.id} className="hover:bg-[var(--bg-panel-hover)] transition-colors">
                      <td className="px-4 py-3">
                        <p className="text-[12px] font-bold text-[var(--text-primary)]">{agent.display_name}</p>
                        <p className="text-[10px] text-[var(--text-muted)] mt-0.5">{agent.name}</p>
                      </td>
                      <td className="px-4 py-3 text-[11px] font-medium text-[var(--text-secondary)] capitalize">
                        {agent.role}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex flex-col items-end gap-1">
                          <span className={`text-[12px] font-bold font-mono ${
                            agent.trust_score >= 80 ? 'text-[var(--status-healthy)]'
                            : agent.trust_score >= 50 ? 'text-[var(--status-warning)]'
                            : 'text-[var(--status-danger)]'
                          }`}>{agent.trust_score.toFixed(1)}</span>
                          <div className="w-16 h-1 bg-[var(--border-strong)] rounded-full overflow-hidden">
                            <div 
                              className={`h-full ${
                                agent.trust_score >= 80 ? 'bg-[var(--status-healthy)]'
                                : agent.trust_score >= 50 ? 'bg-[var(--status-warning)]'
                                : 'bg-[var(--status-danger)]'
                              }`} 
                              style={{ width: `${agent.trust_score}%` }} 
                            />
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {(!agents || agents.length === 0) && (
                    <tr>
                      <td colSpan={3} className="px-4 py-12 text-center text-xs text-[var(--text-muted)]">No agents registered</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>

        {/* Audit Stream Row */}
        <div className="panel flex flex-col border-[var(--border-strong)]">
          <div className="p-4 border-b border-[var(--border-subtle)] flex items-center justify-between bg-[var(--bg-panel-hover)]">
            <div className="flex items-center gap-2">
              <ScrollText className="w-4 h-4 text-emerald-400" />
              <h3 className="text-xs font-bold uppercase tracking-widest">Live Security Audit Stream</h3>
            </div>
            <Link to="/admin/audit" className="text-xs font-bold text-[var(--accent-primary)] hover:underline">View Ledger</Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[var(--border-subtle)] text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">
                  <th className="px-4 py-3">Timestamp</th>
                  <th className="px-4 py-3">Event Type</th>
                  <th className="px-4 py-3">Actor/Agent</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)]">
                {(audits || []).slice(0, 5).map(event => (
                  <tr key={event.id} className="hover:bg-[var(--bg-panel-hover)] transition-colors">
                    <td className="px-4 py-3 text-[11px] text-[var(--text-secondary)] font-mono">
                      {formatDate(event.timestamp)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn('text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border', 
                        event.event_type.includes('anomaly') ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' : 
                        event.event_type.includes('blockchain') ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' : 
                        event.event_type.includes('verification') ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 
                        'bg-blue-500/10 text-blue-400 border-blue-500/20'
                      )}>
                        {event.event_type.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[11px] font-mono text-[var(--text-muted)] truncate max-w-[150px]">
                      {event.agent_id || 'System'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn('text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded border', 
                        event.status === 'ok' || event.status === 'success' ? 'bg-[var(--status-healthy)]/10 text-[var(--status-healthy)] border-[var(--status-healthy)]/20' : 
                        event.status === 'warning' ? 'bg-[var(--status-warning)]/10 text-[var(--status-warning)] border-[var(--status-warning)]/20' : 
                        'bg-[var(--status-danger)]/10 text-[var(--status-danger)] border-[var(--status-danger)]/20'
                      )}>
                        {event.status || 'OK'}
                      </span>
                    </td>
                  </tr>
                ))}
                {(!audits || audits.length === 0) && (
                  <tr>
                    <td colSpan={4} className="px-4 py-12 text-center text-xs text-[var(--text-muted)]">No recent audit events</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
