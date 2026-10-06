import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { agentsApi } from '../lib/api';
import { cn } from '../lib/utils';
import { Cpu, Users } from 'lucide-react';

export default function AgentsPage() {
  const { data: agents, isLoading } = useQuery({ queryKey: ['agents'], queryFn: agentsApi.list });

  return (
    <div className="admin-theme min-h-screen bg-[var(--bg-app)] text-[var(--text-primary)] font-urbanist p-6 lg:p-8 animate-fade-in">
      <div className="max-w-[1600px] mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[var(--border-subtle)] pb-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              Swarm <span className="text-[var(--accent-primary)] italic font-playfair">Registry</span>
            </h1>
            <p className="text-sm font-medium text-[var(--text-secondary)] mt-1.5 flex items-center gap-2">
              <Cpu className="w-4 h-4 text-purple-400" /> Multi-agent registry and trust management
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {isLoading && <div className="col-span-full text-center text-xs text-[var(--text-muted)] font-mono uppercase tracking-widest py-12">Loading Registry...</div>}
          
          {(agents || []).map((agent) => (
            <Link key={agent.id} to={`/admin/agents/${agent.id}`}
              className="panel p-5 border border-[var(--border-strong)] hover:border-[var(--accent-primary)] transition-all group relative overflow-hidden flex flex-col">
              
              <div className="absolute top-0 right-0 w-32 h-32 bg-[var(--accent-primary)]/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/3 group-hover:bg-[var(--accent-primary)]/10 transition-colors" />

              <div className="relative z-10 flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-[14px] font-bold text-[var(--text-primary)] group-hover:text-[var(--accent-primary)] transition-colors">{agent.display_name}</h3>
                  <p className="text-[10px] text-[var(--text-muted)] font-mono mt-1">{agent.id}</p>
                </div>
                <span className={cn('badge text-[10px]', {
                  'badge-healthy': agent.status === 'active',
                  'bg-slate-500/10 text-slate-400 border-slate-500/20': agent.status === 'inactive',
                  'badge-danger': agent.status === 'suspended',
                })}>{agent.status}</span>
              </div>
              
              <div className="relative z-10 space-y-3 mt-auto pt-4 border-t border-[var(--border-subtle)]">
                <div className="flex justify-between items-center text-[11px] font-medium text-[var(--text-secondary)]">
                  <span>Role</span>
                  <span className="capitalize">{agent.role}</span>
                </div>
                <div className="flex justify-between items-center text-[11px] font-medium text-[var(--text-secondary)]">
                  <span>Organization</span>
                  <span className="font-mono">{agent.organization}</span>
                </div>
                <div className="pt-2">
                  <div className="flex justify-between items-center text-[11px] font-bold mb-1.5">
                    <span className="text-[var(--text-secondary)] uppercase tracking-widest">Trust Authority</span>
                    <span className={cn('font-mono', {
                      'text-[var(--status-healthy)]': agent.trust_score >= 80,
                      'text-[var(--status-warning)]': agent.trust_score >= 50 && agent.trust_score < 80,
                      'text-[var(--status-danger)]': agent.trust_score < 50,
                    })}>{agent.trust_score.toFixed(1)}</span>
                  </div>
                  <div className="w-full h-1 bg-[var(--border-strong)] rounded-full overflow-hidden">
                    <div className={cn('h-full transition-all', {
                      'bg-[var(--status-healthy)]': agent.trust_score >= 80,
                      'bg-[var(--status-warning)]': agent.trust_score >= 50 && agent.trust_score < 80,
                      'bg-[var(--status-danger)]': agent.trust_score < 50,
                    })}
                      style={{ width: `${agent.trust_score}%` }} />
                  </div>
                </div>
              </div>
            </Link>
          ))}
          
          {(!agents || agents.length === 0) && !isLoading && (
            <div className="col-span-full panel py-16 flex flex-col items-center justify-center border border-[var(--border-strong)]">
              <Users className="w-12 h-12 text-[var(--border-strong)] mb-4" />
              <p className="text-xs text-[var(--text-secondary)] uppercase tracking-widest font-bold">No agents registered</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
