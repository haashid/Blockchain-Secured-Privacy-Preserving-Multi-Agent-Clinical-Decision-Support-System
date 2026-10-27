import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { clinicalApi, reviewStatusTone, reviewStatusLabel, hasActiveReviews } from '../../lib/clinicalApi';
import { cn, formatDate } from '../../lib/utils';
import {
  Brain, Clock, FileText, CheckCircle2, ChevronRight, Activity, Filter, Send, AlertTriangle
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function DoctorClinicalReviews() {
  const navigate = useNavigate();
  const [filterTab, setFilterTab] = useState<'all' | 'pending' | 'approved' | 'released'>('all');

  const { data, isLoading } = useQuery({
    queryKey: ['clinicalReviews'],
    queryFn: () => clinicalApi.list(),
    refetchIntervalInBackground: false,
    staleTime: 10000,
    refetchInterval: (query) => {
      if (query.state.error) return false;
      const reviewData = query.state.data;
      if (!reviewData) return 4000;
      const combined = [...(reviewData.active || []), ...(reviewData.mine || [])];
      // Only continue polling if at least one review in the doctor's queue is actively running
      return hasActiveReviews(combined) ? 4000 : false;
    },
  });

  const reviews = data?.active || [];
  const myReviews = data?.mine || [];
  const allReviews = [...reviews, ...myReviews].filter((v, i, a) => a.findIndex(t => (t.id === v.id)) === i); // deduplicate

  const filteredReviews = allReviews.filter(r => {
    const status = (r as any).approval_status || r.status;
    if (filterTab === 'pending') return status === 'PENDING_APPROVAL' || status === 'AWAITING_REVIEW' || status === 'running' || status === 'completed';
    if (filterTab === 'approved') return status === 'APPROVED';
    if (filterTab === 'released') return status === 'RELEASED' || status === 'RELEASED_TO_PATIENT';
    return true;
  });

  const stats = {
    total: allReviews.length,
    pending: allReviews.filter(t => (t as any).approval_status === 'PENDING_APPROVAL' || (t as any).approval_status === 'AWAITING_REVIEW' || t.status === 'completed').length,
    approved: allReviews.filter(t => (t as any).approval_status === 'APPROVED').length,
    released: allReviews.filter(t => (t as any).approval_status === 'RELEASED' || (t as any).approval_status === 'RELEASED_TO_PATIENT').length,
  };

  return (
    <div className="max-w-[1240px] mx-auto space-y-6 pb-20 animate-fade-in">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-[var(--text-primary)]">
            AI Clinical <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-indigo-400">Decision Reviews</span>
          </h1>
          <p className="text-[var(--text-muted)] text-sm mt-1">
            Doctor oversight, multi-agent reasoning outputs, and blockchain-anchored clinical approvals.
          </p>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Reviews', value: stats.total, icon: FileText, color: 'text-indigo-400' },
          { label: 'Pending Approval', value: stats.pending, icon: Clock, color: 'text-amber-400' },
          { label: 'Doctor Approved', value: stats.approved, icon: CheckCircle2, color: 'text-emerald-400' },
          { label: 'Released to Patient', value: stats.released, icon: Send, color: 'text-sky-400' },
        ].map(s => (
          <div key={s.label} className="panel p-4 flex items-center gap-4">
            <div className={cn('p-2.5 rounded-xl bg-[var(--bg-panel-hover)] border border-[var(--border-subtle)]', s.color)}>
              <s.icon className="w-5 h-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-[var(--text-primary)] tabular-nums">{s.value}</p>
              <p className="text-[11px] text-[var(--text-muted)] font-semibold uppercase tracking-wider">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-[var(--border-subtle)] pb-2 text-xs font-bold">
        {[
          { id: 'all', label: 'All Reviews' },
          { id: 'pending', label: 'Pending Approval' },
          { id: 'approved', label: 'Doctor Approved' },
          { id: 'released', label: 'Released to Patient' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setFilterTab(tab.id as any)}
            className={cn(
              "px-4 py-2 rounded-xl transition-all",
              filterTab === tab.id
                ? "bg-[var(--accent-primary)] text-white shadow-sm"
                : "text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-panel-hover)]"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Case Reviews List */}
      <div className="panel overflow-hidden">
        <div className="p-4 border-b border-[var(--border-subtle)] flex items-center justify-between">
          <div className="flex items-center gap-2.5 text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">
            <Brain className="w-4 h-4 text-purple-400" />
            Clinical Decision Support Cases
          </div>
          <span className="text-xs text-[var(--text-muted)]">{filteredReviews.length} cases</span>
        </div>

        <div className="divide-y divide-[var(--border-subtle)]">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="p-5 space-y-2">
                <div className="skeleton h-4 w-1/3 rounded" />
                <div className="skeleton h-3 w-1/4 rounded" />
              </div>
            ))
          ) : filteredReviews.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center px-6">
              <Brain className="w-12 h-12 text-[var(--text-muted)] mb-3 opacity-40" />
              <p className="text-[var(--text-primary)] font-bold text-sm">No clinical reviews match this filter</p>
              <p className="text-[var(--text-muted)] text-xs mt-1">Initiate a new AI review from the Patient Workspace.</p>
            </div>
          ) : (
            filteredReviews.map(review => {
              const status = (review as any).approval_status || review.status;
              return (
                <div
                  key={review.id}
                  onClick={() => navigate(`/doctor/reviews/${review.id}`)}
                  className="w-full text-left p-5 transition-all hover:bg-[var(--bg-panel-hover)] group flex items-center justify-between cursor-pointer"
                >
                  <div className="space-y-1.5 min-w-0 pr-4">
                    <div className="flex items-center gap-3">
                      <p className="text-sm font-bold text-[var(--text-primary)] group-hover:text-[var(--accent-primary)] transition-colors truncate">
                        {review.title || 'Clinical Review Case'}
                      </p>
                      <span className={cn('badge text-[10px] font-bold uppercase tracking-wider', reviewStatusTone(status))}>
                        {reviewStatusLabel(status)}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-4 text-xs text-[var(--text-muted)]">
                      <span>Purpose: <strong className="text-[var(--text-secondary)]">{review.purpose || 'General Assessment'}</strong></span>
                      <span className="w-1 h-1 rounded-full bg-[var(--border-strong)]" />
                      <span>{formatDate(review.created_at)}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-xs font-bold text-[var(--accent-primary)] opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                      Open Review <ChevronRight className="w-4 h-4" />
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
