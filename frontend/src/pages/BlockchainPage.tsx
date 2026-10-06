import { useQuery } from '@tanstack/react-query';
import { blockchainApi } from '../lib/api';
import { cn } from '../lib/utils';
import { Blocks, Users, Radio } from 'lucide-react';

export default function BlockchainPage() {
  const { data: status } = useQuery({ queryKey: ['blockchain'], queryFn: blockchainApi.status, refetchInterval: 10000 });

  const connected = status?.connected || false;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Blockchain Explorer</h1>
        <p className="text-[var(--color-text-secondary)] text-sm mt-1">Hyperledger Fabric network status and transaction history</p>
      </div>

      {/* Network Status */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-[var(--color-bg-card)] rounded-xl border border-[var(--color-border)] p-4">
          <div className="flex items-center gap-2 mb-1">
            <div className={cn('w-2 h-2 rounded-full', connected ? 'bg-emerald-400' : 'bg-red-400')} />
            <span className="text-xs text-[var(--color-text-muted)]">Gateway</span>
          </div>
          <p className="text-sm font-medium text-[var(--color-text-primary)]">{connected ? 'Connected' : 'Disconnected'}</p>
        </div>
        <div className="bg-[var(--color-bg-card)] rounded-xl border border-[var(--color-border)] p-4">
          <p className="text-xs text-[var(--color-text-muted)] mb-1">Channel</p>
          <p className="text-sm font-medium text-[var(--color-text-primary)] font-mono">{status?.channel || 'ai-coordination-channel'}</p>
        </div>
        <div className="bg-[var(--color-bg-card)] rounded-xl border border-[var(--color-border)] p-4">
          <p className="text-xs text-[var(--color-text-muted)] mb-1">Chaincode</p>
          <p className="text-sm font-medium text-[var(--color-text-primary)] font-mono">{status?.chaincode || 'ai-coordination'}</p>
        </div>
        <div className="bg-[var(--color-bg-card)] rounded-xl border border-[var(--color-border)] p-4">
          <p className="text-xs text-[var(--color-text-muted)] mb-1">MSP ID</p>
          <p className="text-sm font-medium text-[var(--color-text-primary)] font-mono">{status?.msp_id || 'Org1MSP'}</p>
        </div>
      </div>

      {/* Organizations */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[
          { name: 'Org1', msp: 'Org1MSP', desc: 'AI Coordination Organization', role: 'Primary peer organization' },
          { name: 'Org2', msp: 'Org2MSP', desc: 'Verification / Audit Organization', role: 'Audit and verification peer' },
        ].map(org => (
          <div key={org.name} className="bg-[var(--color-bg-card)] rounded-xl border border-[var(--color-border)] p-5">
            <div className="flex items-center gap-3 mb-3">
              <Users className="w-5 h-5 text-[var(--color-accent)]" />
              <div>
                <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">{org.name}</h3>
                <p className="text-xs text-[var(--color-text-muted)]">{org.msp}</p>
              </div>
            </div>
            <p className="text-sm text-[var(--color-text-secondary)]">{org.desc}</p>
            <p className="text-xs text-[var(--color-text-muted)] mt-1">{org.role}</p>
          </div>
        ))}
      </div>

      {/* Network Topology */}
      <div className="bg-[var(--color-bg-card)] rounded-xl border border-[var(--color-border)] p-5">
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-4">Network Topology</h3>
        <div className="flex items-center justify-center gap-8 py-6">
          <div className="text-center">
            <div className="w-16 h-16 rounded-full bg-[var(--color-accent)]/15 flex items-center justify-center mx-auto mb-2">
              <Users className="w-6 h-6 text-[var(--color-accent)]" />
            </div>
            <p className="text-sm font-medium text-[var(--color-text-primary)]">Org1</p>
            <p className="text-xs text-[var(--color-text-muted)]">Peer</p>
          </div>
          <div className="flex flex-col items-center gap-1">
            <div className="w-20 h-px bg-[var(--color-border)]" />
            <Blocks className="w-4 h-4 text-purple-400" />
            <div className="w-20 h-px bg-[var(--color-border)]" />
          </div>
          <div className="text-center">
            <div className="w-16 h-16 rounded-full bg-purple-500/15 flex items-center justify-center mx-auto mb-2">
              <Radio className="w-6 h-6 text-purple-400" />
            </div>
            <p className="text-sm font-medium text-[var(--color-text-primary)]">Ordering</p>
            <p className="text-xs text-[var(--color-text-muted)]">Raft</p>
          </div>
          <div className="flex flex-col items-center gap-1">
            <div className="w-20 h-px bg-[var(--color-border)]" />
            <Blocks className="w-4 h-4 text-purple-400" />
            <div className="w-20 h-px bg-[var(--color-border)]" />
          </div>
          <div className="text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-500/15 flex items-center justify-center mx-auto mb-2">
              <Users className="w-6 h-6 text-emerald-400" />
            </div>
            <p className="text-sm font-medium text-[var(--color-text-primary)]">Org2</p>
            <p className="text-xs text-[var(--color-text-muted)]">Peer</p>
          </div>
        </div>
        <div className="text-center mt-4">
          <span className="text-xs text-[var(--color-text-muted)] bg-[var(--color-bg-primary)] px-3 py-1 rounded-full">
            Channel: ai-coordination-channel • Chaincode: ai-coordination
          </span>
        </div>
      </div>

      {!connected && (
        <div className="bg-yellow-500/5 border border-yellow-500/30 rounded-xl p-4 text-sm text-yellow-400">
          Fabric network is not connected. Start the Hyperledger Fabric network to enable blockchain features.
        </div>
      )}
    </div>
  );
}
