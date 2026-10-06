import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { auditApi } from '../lib/api';
import { cn, formatDate } from '../lib/utils';
import { ScrollText, Filter } from 'lucide-react';

const EVENT_TYPES = ['', 'task.created', 'agent.started', 'agent.completed', 'hash.generated', 'storage.saved', 'blockchain.committed', 'verification.completed', 'anomaly.detected', 'trust.score.updated'];

export default function AuditPage() {
  const [eventType, setEventType] = useState('');
  const [agentFilter, setAgentFilter] = useState('');

  const { data: events, isLoading } = useQuery({
    queryKey: ['audit', eventType, agentFilter],
    queryFn: () => auditApi.list({ event_type: eventType || undefined, agent_id: agentFilter || undefined, limit: 100 }),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Audit Trail</h1>
        <p className="text-[var(--color-text-secondary)] text-sm mt-1">Immutable event history and provenance records</p>
      </div>

      {/* Filters */}
      <div className="bg-[var(--color-bg-card)] rounded-xl border border-[var(--color-border)] p-4 flex gap-4 items-center">
        <Filter className="w-4 h-4 text-[var(--color-text-muted)] shrink-0" />
        <select value={eventType} onChange={(e) => setEventType(e.target.value)}
          className="px-3 py-2 bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)]">
          <option value="">All Event Types</option>
          {EVENT_TYPES.filter(Boolean).map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <input value={agentFilter} onChange={(e) => setAgentFilter(e.target.value)}
          className="px-3 py-2 bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)] w-60"
          placeholder="Filter by agent ID..." />
      </div>

      {/* Events Table */}
      <div className="bg-[var(--color-bg-card)] rounded-xl border border-[var(--color-border)] overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[var(--color-border)] text-left text-xs text-[var(--color-text-muted)]">
              <th className="px-5 py-3">Timestamp</th>
              <th className="px-5 py-3">Event</th>
              <th className="px-5 py-3">Agent</th>
              <th className="px-5 py-3">Organization</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3">TX ID</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={6} className="px-5 py-8 text-center text-[var(--color-text-muted)]">Loading...</td></tr>}
            {(events || []).map((event) => (
              <tr key={event.id} className="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-bg-hover)] transition-colors">
                <td className="px-5 py-3 text-sm text-[var(--color-text-muted)]">{formatDate(event.timestamp)}</td>
                <td className="px-5 py-3">
                  <span className={cn('text-xs px-2 py-0.5 rounded-full', event.event_type.includes('anomaly') ? 'bg-orange-500/20 text-orange-400' : event.event_type.includes('blockchain') ? 'bg-purple-500/20 text-purple-400' : event.event_type.includes('verification') ? 'bg-emerald-500/20 text-emerald-400' : 'bg-blue-500/20 text-blue-400')}>
                    {event.event_type}
                  </span>
                </td>
                <td className="px-5 py-3 text-sm text-[var(--color-text-secondary)] font-mono">{event.agent_id || '—'}</td>
                <td className="px-5 py-3 text-sm text-[var(--color-text-secondary)]">{event.organization || '—'}</td>
                <td className="px-5 py-3">
                  <span className={cn('text-xs px-2 py-0.5 rounded-full', {
                    'bg-emerald-500/20 text-emerald-400': event.status === 'ok' || event.status === 'success',
                    'bg-yellow-500/20 text-yellow-400': event.status === 'warning',
                    'bg-red-500/20 text-red-400': event.status === 'error' || event.status === 'critical',
                  })}>{event.status || '—'}</span>
                </td>
                <td className="px-5 py-3 text-xs font-mono text-[var(--color-text-muted)]">{event.transaction_id || '—'}</td>
              </tr>
            ))}
            {!isLoading && (!events || events.length === 0) && (
              <tr><td colSpan={6} className="px-5 py-8 text-center text-[var(--color-text-muted)]">
                <ScrollText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                No audit events yet
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
