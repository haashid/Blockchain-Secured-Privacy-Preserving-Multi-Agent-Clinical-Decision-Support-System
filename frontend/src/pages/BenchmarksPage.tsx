import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { benchmarksApi } from '../lib/api';
import { cn, formatMs } from '../lib/utils';
import { BarChart3, Play, Loader2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';

export default function BenchmarksPage() {
  const { data: benchmarks, isLoading } = useQuery({ queryKey: ['benchmarks'], queryFn: () => benchmarksApi.list(20) });
  const [tasksPerConfig] = useState(3);

  const runMutation = useMutation({
    mutationFn: () => benchmarksApi.run({
      coordination_mode: 'both',
      num_agents: [1, 2, 4],
      tasks_per_config: tasksPerConfig,
      name: `benchmark-${Date.now()}`,
    }),
  });

  const chartData = (benchmarks || []).reduce((acc: any[], b) => {
    const existing = acc.find(a => a.agents === b.num_agents);
    if (existing) {
      existing[b.coordination_mode] = b.avg_latency_ms;
    } else {
      acc.push({ agents: b.num_agents, [b.coordination_mode]: b.avg_latency_ms });
    }
    return acc;
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Benchmarks</h1>
          <p className="text-[var(--color-text-secondary)] text-sm mt-1">Centralized vs blockchain coordination performance comparison</p>
        </div>
        <button onClick={() => runMutation.mutate()} disabled={runMutation.isPending}
          className="flex items-center gap-2 px-4 py-2 bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50">
          {runMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
          {runMutation.isPending ? 'Running...' : 'Run Benchmark'}
        </button>
      </div>

      {runMutation.isError && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-lg p-3">
          {(runMutation.error as Error).message}
        </div>
      )}

      {/* Latency Comparison Chart */}
      {chartData.length > 0 && (
        <div className="bg-[var(--color-bg-card)] rounded-xl border border-[var(--color-border)] p-5">
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-4">Average Latency by Agent Count</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <XAxis dataKey="agents" tick={{ fontSize: 11, fill: '#64748b' }} label={{ value: 'Number of Agents', position: 'bottom', fontSize: 11, fill: '#64748b' }} />
              <YAxis tick={{ fontSize: 11, fill: '#64748b' }} label={{ value: 'Latency (ms)', angle: -90, position: 'insideLeft', fontSize: 11, fill: '#64748b' }} />
              <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }} />
              <Legend />
              <Bar dataKey="centralized" fill="#3b82f6" name="Centralized" radius={[4, 4, 0, 0]} />
              <Bar dataKey="blockchain" fill="#a855f7" name="Blockchain" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Results Table */}
      <div className="bg-[var(--color-bg-card)] rounded-xl border border-[var(--color-border)] overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[var(--color-border)] text-left text-xs text-[var(--color-text-muted)]">
              <th className="px-5 py-3">Name</th>
              <th className="px-5 py-3">Mode</th>
              <th className="px-5 py-3">Agents</th>
              <th className="px-5 py-3">Tasks</th>
              <th className="px-5 py-3">Completed</th>
              <th className="px-5 py-3">Avg Latency</th>
              <th className="px-5 py-3">Throughput</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={7} className="px-5 py-8 text-center text-[var(--color-text-muted)]">Loading...</td></tr>}
            {(benchmarks || []).map((b) => (
              <tr key={b.id} className="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-bg-hover)] transition-colors">
                <td className="px-5 py-3 text-sm text-[var(--color-text-primary)]">{b.name || '—'}</td>
                <td className="px-5 py-3">
                  <span className={cn('text-xs px-2 py-0.5 rounded-full', b.coordination_mode === 'blockchain' ? 'bg-purple-500/20 text-purple-400' : 'bg-blue-500/20 text-blue-400')}>
                    {b.coordination_mode}
                  </span>
                </td>
                <td className="px-5 py-3 text-sm text-[var(--color-text-secondary)]">{b.num_agents}</td>
                <td className="px-5 py-3 text-sm text-[var(--color-text-secondary)]">{b.total_tasks}</td>
                <td className="px-5 py-3 text-sm text-[var(--color-text-secondary)]">{b.completed_tasks}</td>
                <td className="px-5 py-3 text-sm text-[var(--color-text-primary)] font-mono">{formatMs(b.avg_latency_ms)}</td>
                <td className="px-5 py-3 text-sm text-[var(--color-text-secondary)]">{b.throughput_tasks_per_min?.toFixed(1) || '—'} tasks/min</td>
              </tr>
            ))}
            {!isLoading && (!benchmarks || benchmarks.length === 0) && (
              <tr><td colSpan={7} className="px-5 py-8 text-center text-[var(--color-text-muted)]">
                <BarChart3 className="w-8 h-8 mx-auto mb-2 opacity-50" />
                No benchmarks yet. Run a benchmark to compare centralized vs blockchain performance.
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
