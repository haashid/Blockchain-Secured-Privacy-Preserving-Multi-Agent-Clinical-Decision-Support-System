import { useQuery } from '@tanstack/react-query';
import { privacyApi } from '../../lib/clinicalApi';
import { patientsApi } from '../../lib/hospitalApi';
import { formatDate } from '../../lib/utils';
import { ScrollText, ShieldCheck, AlertTriangle, Key } from 'lucide-react';

export default function PatientAccessHistory() {
  const { data: myPatient } = useQuery({
    queryKey: ['myPatientRecord'],
    queryFn: patientsApi.myRecord,
    retry: false,
  });

  const patientId = myPatient?.id || '00000000-0000-0000-0000-000000000000';
  
  const { data: history, isLoading } = useQuery({
    queryKey: ['accessHistory', patientId],
    queryFn: () => privacyApi.accessHistory(patientId),
    enabled: !!patientId && patientId !== '00000000-0000-0000-0000-000000000000',
  });

  return (
    <div className="max-w-[1000px] mx-auto space-y-6 pb-20 animate-fade-in">
      <div>
        <div className="inline-flex items-center gap-1.5 px-3 py-1 mb-2 rounded-full bg-[var(--status-healthy)]/10 border border-[var(--status-healthy)]/20 text-[var(--status-healthy)] text-[10px] font-bold uppercase tracking-widest">
          <Key className="w-3.5 h-3.5" /> Immutable Audit Trail
        </div>
        <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-[var(--text-primary)]">
          EHR Access <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">History</span>
        </h1>
        <p className="text-[var(--text-muted)] text-sm mt-1">
          Cryptographically recorded ledger of every clinician, specialist AI agent, and audit actor that accessed your records.
        </p>
      </div>

      <div className="panel overflow-hidden">
        <div className="p-4 border-b border-[var(--border-subtle)] flex items-center justify-between">
          <div className="flex items-center gap-2.5 text-xs font-bold text-[var(--text-primary)]">
            <ScrollText className="w-4 h-4 text-emerald-400" />
            Blockchain-Anchored Access Events
          </div>
          <span className="badge badge-healthy text-[10px] font-bold">Zero Tamper Integrity</span>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[var(--bg-panel-hover)] border-b border-[var(--border-subtle)] text-[10px] text-[var(--text-muted)] uppercase tracking-wider">
                <th className="px-4 py-3 font-semibold">Timestamp</th>
                <th className="px-4 py-3 font-semibold">Actor / Agent</th>
                <th className="px-4 py-3 font-semibold">Action</th>
                <th className="px-4 py-3 font-semibold">Resource</th>
                <th className="px-4 py-3 font-semibold">Authorization</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)]">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-[var(--text-muted)]">Loading audit logs...</td>
                </tr>
              ) : !history?.length ? (
                <tr>
                  <td colSpan={5} className="p-10 text-center">
                    <ScrollText className="w-8 h-8 text-[var(--text-muted)] mx-auto mb-2 opacity-40" />
                    <p className="text-xs font-bold text-[var(--text-primary)]">No Access Events Recorded</p>
                    <p className="text-[11px] text-[var(--text-muted)] mt-1">
                      No clinician or AI specialist agent has accessed your protected EHR records yet.
                    </p>
                  </td>
                </tr>
              ) : (
                history.map((record) => (
                  <tr key={record.id} className="hover:bg-[var(--bg-panel-hover)] transition-colors">
                    <td className="px-4 py-3 text-[var(--text-muted)] font-mono whitespace-nowrap">
                      {formatDate(record.timestamp)}
                    </td>
                    <td className="px-4 py-3 font-bold text-[var(--text-primary)]">
                      {record.actor}
                    </td>
                    <td className="px-4 py-3 text-[var(--text-secondary)] font-mono text-[11px]">
                      {record.action}
                    </td>
                    <td className="px-4 py-3 text-[var(--text-secondary)]">
                      {record.resource}
                    </td>
                    <td className="px-4 py-3">
                      {record.status !== 'Allowed' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                          <AlertTriangle className="w-3 h-3" /> Blocked
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          <ShieldCheck className="w-3 h-3" /> Authorized
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
