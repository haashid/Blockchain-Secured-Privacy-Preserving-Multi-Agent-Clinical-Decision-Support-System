import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { tasksApi } from '../lib/api';
import { cn, formatDate } from '../lib/utils';
import { Zap, ChevronRight, ListTodo } from 'lucide-react';

export default function TasksPage() {
  const { data: tasks, isLoading } = useQuery({ queryKey: ['tasks'], queryFn: () => tasksApi.list(50) });

  return (
    <div className="admin-theme min-h-screen bg-[var(--bg-app)] text-[var(--text-primary)] font-urbanist p-6 lg:p-8 animate-fade-in">
      <div className="max-w-[1600px] mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[var(--border-subtle)] pb-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              Clinical <span className="text-[var(--accent-primary)] italic font-playfair">Operations</span>
            </h1>
            <p className="text-sm font-medium text-[var(--text-secondary)] mt-1.5 flex items-center gap-2">
              <ListTodo className="w-4 h-4 text-sky-400" /> Manage and monitor multi-agent tasks
            </p>
          </div>
          <Link to="/admin/tasks/new" className="btn-primary">
            <Zap className="w-4 h-4 mr-2" /> Dispatch Task
          </Link>
        </div>

        {/* Table Panel */}
        <div className="panel flex flex-col border-[var(--border-strong)]">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[var(--border-subtle)] text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest bg-[var(--bg-panel-hover)]">
                  <th className="px-6 py-4">Title</th>
                  <th className="px-6 py-4">Domain</th>
                  <th className="px-6 py-4">Mode</th>
                  <th className="px-6 py-4">Priority</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Created</th>
                  <th className="px-6 py-4"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)]">
                {isLoading && (
                  <tr><td colSpan={7} className="px-6 py-12 text-center text-xs text-[var(--text-muted)] font-mono uppercase tracking-widest">Loading Telemetry...</td></tr>
                )}
                {(tasks || []).map((task) => (
                  <tr key={task.id} className="hover:bg-[var(--bg-panel-hover)] transition-colors group">
                    <td className="px-6 py-4">
                      <Link to={`/admin/tasks/${task.id}`} className="block">
                        <p className="text-[13px] font-bold text-[var(--text-primary)] group-hover:text-[var(--accent-primary)] transition-colors">{task.title}</p>
                        <p className="text-[10px] text-[var(--text-muted)] font-mono mt-0.5">{task.id}</p>
                      </Link>
                    </td>
                    <td className="px-6 py-4 text-[12px] font-medium text-[var(--text-secondary)] capitalize">{task.domain}</td>
                    <td className="px-6 py-4">
                      <span className={cn('badge text-[10px]', task.coordination_mode === 'blockchain' ? 'badge-healthy' : 'badge-warning')}>
                        {task.coordination_mode}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={cn('badge text-[10px]', {
                        'badge-danger': task.priority === 'critical',
                        'badge-warning': task.priority === 'high' || task.priority === 'medium',
                        'bg-slate-500/10 text-slate-400 border-slate-500/20': task.priority === 'low',
                      })}>
                        {task.priority}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={cn('badge text-[10px]', {
                        'badge-healthy': task.status === 'completed',
                        'badge-warning': task.status === 'running' || task.status === 'pending',
                        'badge-danger': task.status === 'failed',
                      })}>
                        {task.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-[11px] font-mono text-[var(--text-secondary)]">{formatDate(task.created_at)}</td>
                    <td className="px-6 py-4 text-right">
                      <Link to={`/admin/tasks/${task.id}`} className="text-[var(--text-muted)] hover:text-[var(--accent-primary)] transition-colors inline-block p-1">
                        <ChevronRight className="w-4 h-4" />
                      </Link>
                    </td>
                  </tr>
                ))}
                {!isLoading && (!tasks || tasks.length === 0) && (
                  <tr><td colSpan={7} className="px-6 py-12 text-center text-xs text-[var(--text-muted)]">No operations registered</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
