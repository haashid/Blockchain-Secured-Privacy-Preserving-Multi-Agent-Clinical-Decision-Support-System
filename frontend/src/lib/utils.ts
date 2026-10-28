import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

export function formatMs(ms: number | null | undefined): string {
  if (ms == null) return '—';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export function trustColor(score: number): string {
  if (score >= 80) return 'text-emerald-500';
  if (score >= 60) return 'text-blue-500';
  if (score >= 40) return 'text-amber-600';
  if (score >= 20) return 'text-orange-500';
  return 'text-red-500';
}

export function statusColor(status: string): string {
  const map: Record<string, string> = {
    active: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    completed: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    verified: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    accepted: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    running: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    pending: 'bg-amber-50 text-amber-800 border-amber-300 dark:bg-yellow-500/20 dark:text-yellow-400 dark:border-yellow-500/30',
    submitted: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    warning: 'bg-amber-50 text-amber-800 border-amber-300 dark:bg-yellow-500/20 dark:text-yellow-400 dark:border-yellow-500/30',
    failed: 'bg-red-500/20 text-red-400 border-red-500/30',
    inactive: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
    suspended: 'bg-red-500/20 text-red-400 border-red-500/30',
    error: 'bg-red-500/20 text-red-400 border-red-500/30',
    invalid: 'bg-red-500/20 text-red-400 border-red-500/30',
    flagged: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  };
  return map[status] || 'bg-slate-500/20 text-slate-400 border-slate-500/30';
}

export function hashShort(hash: string): string {
  if (!hash) return '—';
  return `${hash.slice(0, 8)}…${hash.slice(-6)}`;
}
