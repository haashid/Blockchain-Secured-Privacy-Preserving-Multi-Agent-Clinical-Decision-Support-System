import { useQuery } from '@tanstack/react-query';
import { privacyApi } from '../../lib/clinicalApi';
import { formatDate } from '../../lib/utils';
import { ScrollText, ShieldCheck, AlertTriangle } from 'lucide-react';

export default function PatientAccessHistory() {
  const patientId = '00000000-0000-0000-0000-000000000000';
  
  const { data: history, isLoading } = useQuery({
    queryKey: ['accessHistory', patientId],
    queryFn: () => privacyApi.accessHistory(patientId),
  });

  return (
    <div className="max-w-[1000px] mx-auto space-y-8 pb-16 animate-fade-in">
      <div>
        <h1 className="text-[28px] font-extrabold tracking-tight text-[var(--text-primary)]">
          Access <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">History</span>
        </h1>
        <p className="text-[var(--text-muted)] text-sm mt-1">An immutable audit trail of who accessed your clinical data.</p>
      </div>

      <div className="panel overflow-hidden">
        <div className="p-4 border-b border-[var(--border-subtle)] flex items-center gap-3">
          <div className="p-2 rounded-lg bg-[var(--status-healthy)]/10 border border-[var(--status-healthy)]/20 text-[var(--status-healthy)]">
            <ScrollText className="w-4 h-4" />
          </div>
          <h3 className="font-bold text-[var(--text-primary)] text-[14px]">Data Access Log</h3>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[var(--bg-panel-hover)] border-b border-[var(--border-subtle)]">
                <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Timestamp</th>
                <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Actor</th>
                <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Action</th>
                <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Resource</th>
                <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Status</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-[var(--text-muted)]">Loading audit logs...</td>
                </tr>
              ) : !history?.length ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-[var(--text-muted)]">No access records found.</td>
                </tr>
              ) : (
                history.map((record) => (
                  <tr key={record.id} className="border-b border-[var(--border-subtle)] hover:bg-[var(--bg-panel-hover)] transition-colors">
                    <td className="px-4 py-3 text-xs text-[var(--text-muted)] whitespace-nowrap">
                      {formatDate(record.timestamp)}
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold text-[var(--text-primary)]">
                      {record.actor}
                    </td>
                    <td className="px-4 py-3 text-sm text-[var(--text-secondary)]">
                      {record.action}
                    </td>
                    <td className="px-4 py-3 text-sm text-[var(--text-secondary)]">
                      {record.resource}
                    </td>
                    <td className="px-4 py-3">
                      {record.status === 'Denied' || record.status === 'blocked' ? (
                        <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-bold bg-[var(--status-danger)]/10 text-[var(--status-danger)] border border-[var(--status-danger)]/20">
                          <AlertTriangle className="w-3 h-3" /> Blocked
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-bold bg-[var(--status-healthy)]/10 text-[var(--status-healthy)] border border-[var(--status-healthy)]/20">
                          <ShieldCheck className="w-3 h-3" /> Allowed
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
