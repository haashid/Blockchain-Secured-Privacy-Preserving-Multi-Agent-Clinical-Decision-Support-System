import { useQuery } from '@tanstack/react-query';
import { systemApi } from '../lib/api';
import { cn } from '../lib/utils';
import { Database, HardDrive, Blocks, Server, Shield, Key, RefreshCw } from 'lucide-react';

export default function SettingsPage() {
  const { data: ready, refetch } = useQuery({ queryKey: ['ready'], queryFn: systemApi.ready, refetchInterval: 10000 });

  const configs = [
    { icon: Database, label: 'Database', status: ready?.database === 'ok' ? 'Connected' : ready?.database || 'Unknown', ok: ready?.database === 'ok' },
    { icon: HardDrive, label: 'Object Storage', status: ready?.storage === 'ok' ? 'Connected' : ready?.storage || 'Unknown', ok: ready?.storage === 'ok' },
    { icon: Blocks, label: 'Hyperledger Fabric', status: ready?.fabric === 'connected' ? 'Connected' : 'Disconnected', ok: ready?.fabric === 'connected' },
    { icon: Server, label: 'AI Provider', status: ready?.ai_provider || 'Unknown', ok: !!ready?.ai_provider },
    { icon: Shield, label: 'Encryption', status: 'AES-256-GCM', ok: true },
    { icon: Key, label: 'Authentication', status: 'JWT', ok: true },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Settings</h1>
          <p className="text-[var(--color-text-secondary)] text-sm mt-1">System configuration and health status</p>
        </div>
        <button onClick={() => refetch()}
          className="flex items-center gap-2 px-3 py-1.5 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] rounded-lg transition-colors">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {/* System Status */}
      <div className="bg-[var(--color-bg-card)] rounded-xl border border-[var(--color-border)] p-5">
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-4">System Status</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {configs.map(cfg => (
            <div key={cfg.label} className="flex items-center gap-3 p-4 bg-[var(--color-bg-primary)] rounded-lg border border-[var(--color-border)]">
              <cfg.icon className="w-5 h-5 text-[var(--color-text-muted)]" />
              <div className="flex-1">
                <p className="text-sm text-[var(--color-text-primary)]">{cfg.label}</p>
                <p className="text-xs text-[var(--color-text-muted)]">{cfg.status}</p>
              </div>
              <div className={cn('w-2.5 h-2.5 rounded-full', cfg.ok ? 'bg-emerald-400' : 'bg-yellow-400')} />
            </div>
          ))}
        </div>
      </div>

      {/* Platform Info */}
      <div className="bg-[var(--color-bg-card)] rounded-xl border border-[var(--color-border)] p-5">
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-4">Platform</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-[var(--color-text-muted)]">Backend</p>
            <p className="text-[var(--color-text-primary)]">FastAPI + Python</p>
          </div>
          <div>
            <p className="text-[var(--color-text-muted)]">Frontend</p>
            <p className="text-[var(--color-text-primary)]">React + TypeScript</p>
          </div>
          <div>
            <p className="text-[var(--color-text-muted)]">Blockchain</p>
            <p className="text-[var(--color-text-primary)]">Hyperledger Fabric</p>
          </div>
          <div>
            <p className="text-[var(--color-text-muted)]">Database</p>
            <p className="text-[var(--color-text-primary)]">SQLite (dev) / PostgreSQL</p>
          </div>
        </div>
      </div>
    </div>
  );
}
