import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { tasksApi } from '../lib/api';
import { cn, formatDate, formatMs } from '../lib/utils';
import { ArrowLeft, Play, Clock, ChevronRight, Loader2 } from 'lucide-react';

export default function TaskDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: task, isLoading } = useQuery({ queryKey: ['task', id], queryFn: () => tasksApi.get(id!) });
  const { data: runs } = useQuery({ queryKey: ['taskRuns', id], queryFn: () => tasksApi.runs(id!), enabled: !!id });

  const runMutation = useMutation({
    mutationFn: () => tasksApi.run(id!),
    onSuccess: (run) => navigate(`/runs/${run.id}`),
  });

  if (isLoading) return <div className="text-[var(--color-text-muted)] p-8 text-center">Loading...</div>;
  if (!task) return <div className="text-[var(--color-text-muted)] p-8 text-center">Task not found</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{task.title}</h1>
          <p className="text-[var(--color-text-secondary)] text-sm mt-1">{task.description || 'No description'}</p>
        </div>
        <button onClick={() => runMutation.mutate()} disabled={runMutation.isPending}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50">
          {runMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
          {runMutation.isPending ? 'Running...' : 'Run Task'}
        </button>
      </div>

      {runMutation.isError && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-lg p-3">
          {(runMutation.error as Error).message}
        </div>
      )}

      {/* Task Info */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Domain', value: task.domain },
          { label: 'Priority', value: task.priority },
          { label: 'Mode', value: task.coordination_mode },
          { label: 'Status', value: task.status },
        ].map(item => (
          <div key={item.label} className="bg-[var(--color-bg-card)] rounded-xl border border-[var(--color-border)] p-4">
            <p className="text-xs text-[var(--color-text-muted)]">{item.label}</p>
            <p className="text-sm font-medium text-[var(--color-text-primary)] mt-1">{item.value}</p>
          </div>
        ))}
      </div>

      {/* Runs */}
      <div className="bg-[var(--color-bg-card)] rounded-xl border border-[var(--color-border)] p-5">
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-4">Execution Runs</h3>
        {runs && runs.length > 0 ? (
          <div className="space-y-2">
            {runs.map((run) => (
              <Link key={run.id} to={`/runs/${run.id}`}
                className="flex items-center justify-between p-3 rounded-lg hover:bg-[var(--color-bg-hover)] transition-colors border border-[var(--color-border)]">
                <div className="flex items-center gap-4">
                  <Clock className="w-4 h-4 text-[var(--color-text-muted)]" />
                  <div>
                    <p className="text-sm text-[var(--color-text-primary)]">Run {run.id.slice(0, 8)}</p>
                    <p className="text-xs text-[var(--color-text-muted)]">{formatDate(run.created_at)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-[var(--color-text-muted)]">{formatMs(run.total_latency_ms)}</span>
                  <span className={cn('text-xs px-2 py-0.5 rounded-full', {
                    'bg-emerald-500/20 text-emerald-400': run.status === 'completed',
                    'bg-blue-500/20 text-blue-400': run.status === 'running',
                    'bg-yellow-500/20 text-yellow-400': run.status === 'pending',
                    'bg-red-500/20 text-red-400': run.status === 'failed',
                  })}>{run.status}</span>
                  <ChevronRight className="w-4 h-4 text-[var(--color-text-muted)]" />
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-[var(--color-text-muted)] text-sm text-center py-6">
            No runs yet. Click "Run Task" to execute the multi-agent pipeline.
          </p>
        )}
      </div>
    </div>
  );
}
