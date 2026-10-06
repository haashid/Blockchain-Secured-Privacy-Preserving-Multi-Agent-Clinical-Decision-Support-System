import { useQuery } from '@tanstack/react-query';
import { clinicalApi, reviewStatusTone, reviewStatusLabel } from '../../lib/clinicalApi';
import { cn, formatDate } from '../../lib/utils';
import {
  Brain, Clock, FileText, CheckCircle2, ChevronRight, Activity
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function DoctorClinicalReviews() {
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ['clinicalReviews'],
    queryFn: () => clinicalApi.list(),
    refetchInterval: 8000,
  });

  const reviews = data?.active || [];
  const myReviews = data?.mine || [];
  const allReviews = [...reviews, ...myReviews].filter((v, i, a) => a.findIndex(t => (t.id === v.id)) === i); // deduplicate

  const stats = {
    total: allReviews.length,
    completed: allReviews.filter(t => t.status === 'completed').length,
    running: allReviews.filter(t => t.status === 'running').length,
    pending: allReviews.filter(t => t.status === 'pending').length,
  };

  return (
    <div className="max-w-[1200px] mx-auto space-y-8 pb-16 stagger">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-extrabold tracking-tight text-[var(--text-primary)]">
            AI Clinical <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-indigo-400">Reviews</span>
          </h1>
          <p className="text-[var(--text-muted)] text-sm mt-1">Multi-agent reasoning outputs and blockchain-verified decisions.</p>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Reviews', value: stats.total, icon: FileText, color: 'text-indigo-400' },
          { label: 'Completed', value: stats.completed, icon: CheckCircle2, color: 'text-emerald-400' },
          { label: 'Processing', value: stats.running, icon: Activity, color: 'text-sky-400' },
          { label: 'Pending', value: stats.pending, icon: Clock, color: 'text-amber-400' },
        ].map(s => (
          <div key={s.label} className="panel p-4 flex items-center gap-4">
            <div className={cn('p-2.5 rounded-xl bg-[var(--bg-panel-hover)] border border-[var(--border-subtle)]', s.color)}>
              <s.icon className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xl font-bold text-[var(--text-primary)] tabular-nums">{s.value}</p>
              <p className="text-[11px] text-[var(--text-muted)] font-semibold uppercase tracking-wider">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="panel overflow-hidden">
        <div className="p-4 border-b border-[var(--border-subtle)] flex items-center gap-3">
          <div className="p-2 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-400">
            <Brain className="w-4 h-4" />
          </div>
          <h3 className="font-bold text-[var(--text-primary)] text-[14px]">Case Reports</h3>
        </div>
        <div className="overflow-y-auto max-h-[600px]">
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="p-4 border-b border-[var(--border-subtle)] space-y-2">
                <div className="skeleton h-4 w-1/3 rounded" />
                <div className="skeleton h-3 w-1/4 rounded" />
              </div>
            ))
          ) : allReviews.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center px-6">
              <Brain className="w-10 h-10 text-[var(--text-muted)] mb-3" />
              <p className="text-[var(--text-primary)] font-semibold">No AI reviews yet</p>
              <p className="text-[var(--text-muted)] text-sm mt-1">Initiate a review from the Patient Workspace.</p>
            </div>
          ) : (
            allReviews.map(review => {
              return (
                <button
                  key={review.id}
                  onClick={() => navigate(`/doctor/reviews/${review.id}`)}
                  className="w-full text-left p-4 border-b border-[var(--border-subtle)] transition-all hover:bg-[var(--bg-panel-hover)] group flex items-center justify-between"
                >
                  <div>
                    <p className="text-[14px] font-semibold text-[var(--text-primary)] group-hover:text-[var(--accent-primary)] transition-colors mb-1">
                      {review.title}
                    </p>
                    <div className="flex items-center gap-3">
                      <span className={cn('badge border', reviewStatusTone(review.status))}>
                        {reviewStatusLabel(review.status)}
                      </span>
                      <span className="text-[12px] text-[var(--text-muted)]">{formatDate(review.created_at)}</span>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-[var(--text-muted)] group-hover:text-[var(--accent-primary)] transition-colors" />
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
