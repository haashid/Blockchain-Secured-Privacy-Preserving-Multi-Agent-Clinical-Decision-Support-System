import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { verifyApi } from '../lib/api';
import { cn, formatDate, hashShort } from '../lib/utils';
import { ShieldCheck, Search, CheckCircle2, XCircle, RefreshCw } from 'lucide-react';

export default function VerificationPage() {
  const [proofId, setProofId] = useState('');

  const verifyMutation = useMutation({
    mutationFn: (id: string) => verifyApi.run(id),
  });

  const handleVerify = (e: React.FormEvent) => {
    e.preventDefault();
    if (proofId.trim()) verifyMutation.mutate(proofId.trim());
  };

  const result = verifyMutation.data;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Verification</h1>
        <p className="text-[var(--color-text-secondary)] text-sm mt-1">Verify decision proof integrity against blockchain records</p>
      </div>

      {/* Verify Form */}
      <form onSubmit={handleVerify} className="bg-[var(--color-bg-card)] rounded-xl border border-[var(--color-border)] p-5 flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)]" />
          <input value={proofId} onChange={(e) => setProofId(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)] font-mono text-sm focus:outline-none focus:border-[var(--color-accent)]"
            placeholder="Enter proof ID (proof-...)" />
        </div>
        <button type="submit" disabled={verifyMutation.isPending || !proofId.trim()}
          className="flex items-center gap-2 px-5 py-2.5 bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50">
          {verifyMutation.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
          Verify
        </button>
      </form>

      {/* Verification Result */}
      {result && (
        <div className={cn('rounded-xl border p-6 space-y-4', result.verified
          ? 'bg-emerald-500/5 border-emerald-500/30'
          : 'bg-red-500/5 border-red-500/30'
        )}>
          <div className="flex items-center gap-3">
            {result.verified ? (
              <CheckCircle2 className="w-8 h-8 text-emerald-400" />
            ) : (
              <XCircle className="w-8 h-8 text-red-400" />
            )}
            <div>
              <h2 className={cn('text-xl font-bold', result.verified ? 'text-emerald-400' : 'text-red-400')}>
                {result.verified ? 'HASH MATCH' : 'HASH MISMATCH'}
              </h2>
              <p className="text-sm text-[var(--color-text-secondary)]">
                {result.verified
                  ? 'Decision integrity verified. Off-chain hash matches blockchain record.'
                  : 'Potential tampering detected. Off-chain hash does not match blockchain record.'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-4">
            {[
              { label: 'Proof ID', value: result.proof_id },
              { label: 'Agent ID', value: result.agent_id },
              { label: 'Hash Algorithm', value: result.hash_algorithm },
              { label: 'Blockchain Hash', value: result.blockchain_hash ? hashShort(result.blockchain_hash) : '—', mono: true },
              { label: 'Computed Hash', value: result.computed_hash ? hashShort(result.computed_hash) : '—', mono: true },
              { label: 'Transaction ID', value: result.transaction_id ? hashShort(result.transaction_id) : '—', mono: true },
              { label: 'Verified At', value: formatDate(result.verified_at) },
            ].map(item => (
              <div key={item.label}>
                <p className="text-xs text-[var(--color-text-muted)]">{item.label}</p>
                <p className={cn('text-sm font-medium text-[var(--color-text-primary)]', item.mono && 'font-mono')}>{item.value}</p>
              </div>
            ))}
          </div>

          {/* Full hashes */}
          {(result.blockchain_hash || result.computed_hash) && (
            <div className="mt-4 space-y-2">
              <div>
                <p className="text-xs text-[var(--color-text-muted)] mb-1">Blockchain Hash (full)</p>
                <p className="text-xs font-mono text-[var(--color-text-secondary)] bg-[var(--color-bg-primary)] p-2 rounded break-all">{result.blockchain_hash}</p>
              </div>
              <div>
                <p className="text-xs text-[var(--color-text-muted)] mb-1">Computed Hash (full)</p>
                <p className="text-xs font-mono text-[var(--color-text-secondary)] bg-[var(--color-bg-primary)] p-2 rounded break-all">{result.computed_hash}</p>
              </div>
            </div>
          )}

          {result.failures?.length > 0 && (
            <div className="mt-4">
              <p className="text-xs text-[var(--color-text-muted)] mb-2">Failures</p>
              {result.failures.map((f: string, i: number) => (
                <div key={i} className="text-sm text-red-400 bg-red-500/10 rounded p-2 mb-1">{f}</div>
              ))}
            </div>
          )}

          <button onClick={() => proofId.trim() && verifyMutation.mutate(proofId.trim())}
            className="flex items-center gap-2 px-4 py-2 text-sm text-[var(--color-accent)] hover:bg-[var(--color-accent)]/10 rounded-lg transition-colors mt-4">
            <RefreshCw className="w-4 h-4" /> Verify Again
          </button>
        </div>
      )}

      {verifyMutation.isError && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-lg p-3">
          {(verifyMutation.error as Error).message}
        </div>
      )}
    </div>
  );
}
