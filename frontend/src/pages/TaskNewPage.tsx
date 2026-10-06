import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { tasksApi } from '../lib/api';
import { ArrowLeft, Send } from 'lucide-react';

const DOMAINS = ['healthcare', 'finance', 'cybersecurity', 'supply-chain', 'smart-cities', 'cloud'];
const PRIORITIES = ['low', 'medium', 'high', 'critical'];

export default function TaskNewPage() {
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [domain, setDomain] = useState('healthcare');
  const [priority, setPriority] = useState('medium');
  const [mode, setMode] = useState('blockchain');

  const createMutation = useMutation({
    mutationFn: () => tasksApi.create({ title, description, domain, priority, coordination_mode: mode }),
    onSuccess: (task) => navigate(`/tasks/${task.id}`),
  });

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold">New Task</h1>
          <p className="text-[var(--color-text-secondary)] text-sm mt-1">Submit a new multi-agent coordination task</p>
        </div>
      </div>

      <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(); }} className="bg-[var(--color-bg-card)] rounded-xl border border-[var(--color-border)] p-6 space-y-5">
        {createMutation.isError && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-lg p-3">
            {(createMutation.error as Error).message}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">Title *</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} required
            className="w-full px-4 py-2.5 bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)]"
            placeholder="e.g. Analyze cybersecurity incident report" />
        </div>

        <div>
          <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">Description</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3}
            className="w-full px-4 py-2.5 bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)] resize-none"
            placeholder="Detailed task description..." />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">Domain</label>
            <select value={domain} onChange={(e) => setDomain(e.target.value)}
              className="w-full px-4 py-2.5 bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)]">
              {DOMAINS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">Priority</label>
            <select value={priority} onChange={(e) => setPriority(e.target.value)}
              className="w-full px-4 py-2.5 bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)]">
              {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">Coordination Mode</label>
          <div className="flex gap-3">
            {[{ v: 'centralized', l: 'Centralized', d: 'No blockchain' }, { v: 'blockchain', l: 'Blockchain', d: 'With Fabric proofs' }].map(o => (
              <button key={o.v} type="button" onClick={() => setMode(o.v)}
                className={`flex-1 p-3 rounded-lg border text-left transition-colors ${mode === o.v ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/10' : 'border-[var(--color-border)] hover:border-[var(--color-text-muted)]'}`}>
                <span className="text-sm font-medium text-[var(--color-text-primary)]">{o.l}</span>
                <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{o.d}</p>
              </button>
            ))}
          </div>
        </div>

        <button type="submit" disabled={createMutation.isPending}
          className="flex items-center gap-2 px-5 py-2.5 bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50">
          <Send className="w-4 h-4" />
          {createMutation.isPending ? 'Creating...' : 'Create Task'}
        </button>
      </form>
    </div>
  );
}
