import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { clinicalApi, reviewStatusLabel, reviewStatusTone } from '../../lib/clinicalApi';
import { cn, formatDate } from '../../lib/utils';
import {
  ArrowLeft, Brain, ShieldCheck, FileText, Activity, Users, Lock, ChevronRight, Hash
} from 'lucide-react';

export default function DoctorReviewDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'summary' | 'agents' | 'evidence' | 'provenance'>('summary');

  const { data: review, isLoading } = useQuery({
    queryKey: ['clinicalReview', id],
    queryFn: () => clinicalApi.get(id!),
    enabled: !!id,
    refetchInterval: (query) => {
      return (query.state.data?.status === 'completed' || query.state.data?.status === 'failed') ? false : 3000;
    }
  });

  const { data: provenance } = useQuery({
    queryKey: ['clinicalReviewProvenance', id],
    queryFn: () => clinicalApi.provenance(id!),
    enabled: !!id && activeTab === 'provenance',
  });

  const { data: report } = useQuery({
    queryKey: ['clinicalReviewReport', id],
    queryFn: () => clinicalApi.report(id!),
    enabled: !!id && (activeTab === 'summary' || activeTab === 'agents'),
  });

  if (isLoading || !review) {
    return <div className="p-8 text-center text-[var(--text-muted)]">Loading clinical review...</div>;
  }

  const activeRun = review.runs?.[0];
  const finalReport = report?.synthesis || activeRun?.final_report;

  return (
    <div className="max-w-[1200px] mx-auto space-y-6 pb-16 animate-fade-in">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/doctor/reviews')} className="p-2 border border-[var(--border-strong)] rounded-full text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-panel-hover)] transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-[var(--text-primary)] tracking-tight">
              {review.title}
            </h1>
            <div className="flex items-center gap-3 mt-1.5 text-sm font-medium text-[var(--text-secondary)]">
              <span className={cn('badge', reviewStatusTone(review.status))}>{reviewStatusLabel(review.status)}</span>
              <span className="w-1 h-1 rounded-full bg-[var(--border-strong)]" />
              <span>{formatDate(review.created_at)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-[var(--border-subtle)] pb-px mt-6">
        {[
          { id: 'summary', label: 'Clinical Summary', icon: FileText },
          { id: 'agents', label: 'Agent Reasoning', icon: Brain },
          { id: 'evidence', label: 'Evidence & Citations', icon: Activity },
          { id: 'provenance', label: 'Blockchain Provenance', icon: ShieldCheck },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 text-[13px] font-bold uppercase tracking-wider transition-colors border-b-2",
              activeTab === tab.id
                ? "border-[var(--accent-primary)] text-[var(--text-primary)]"
                : "border-transparent text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
            )}
          >
            <tab.icon className="w-4 h-4" /> {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="panel p-6 min-h-[500px]">
        {activeTab === 'summary' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-bold text-[var(--text-secondary)] uppercase tracking-widest mb-3">Final Clinical Report</h3>
              {finalReport ? (
                <div className="bg-[var(--bg-panel-hover)] border border-[var(--border-subtle)] rounded-lg p-5">
                  <div className="font-mono text-sm text-[var(--text-primary)] whitespace-pre-wrap leading-relaxed">
                    {typeof finalReport === 'string' ? finalReport : JSON.stringify(finalReport, null, 2)}
                  </div>
                </div>
              ) : (
                <div className="text-[var(--text-muted)] p-8 text-center bg-[var(--bg-panel-hover)] rounded-lg">
                  Report is currently being generated. Check agent reasoning for real-time progress.
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'agents' && (
          <div className="space-y-6">
             <h3 className="text-sm font-bold text-[var(--text-secondary)] uppercase tracking-widest mb-3">Multi-Agent Workflow</h3>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.entries(report?.specialists || {}).map(([role, output]) => (
                  <div key={role} className="border border-[var(--border-subtle)] rounded-lg p-4 bg-[var(--bg-panel-hover)]">
                    <h4 className="font-bold text-[var(--accent-primary)] capitalize mb-2 flex items-center gap-2">
                      <Users className="w-4 h-4" /> {role.replace('_', ' ')} Agent
                    </h4>
                    <div className="font-mono text-xs text-[var(--text-secondary)] whitespace-pre-wrap">
                      {typeof output === 'string' ? output : JSON.stringify(output, null, 2)}
                    </div>
                  </div>
                ))}
             </div>
          </div>
        )}

        {activeTab === 'evidence' && (
          <div className="space-y-6 text-[var(--text-muted)] text-center p-8">
             <Activity className="w-8 h-8 mx-auto mb-3 opacity-50" />
             <p>Evidence mapping is being compiled.</p>
          </div>
        )}

        {activeTab === 'provenance' && (
          <div className="space-y-4">
             <h3 className="text-sm font-bold text-[var(--text-secondary)] uppercase tracking-widest mb-3">Cryptographic Trace</h3>
             {!provenance?.proofs?.length ? (
                <div className="text-[var(--text-muted)] p-8 text-center bg-[var(--bg-panel-hover)] rounded-lg">
                  No cryptographic proofs generated yet.
                </div>
             ) : (
                provenance.proofs.map(p => (
                  <div key={p.proof_id} className="border border-[var(--border-subtle)] rounded-lg p-4 bg-[var(--bg-panel-hover)] flex items-start gap-4">
                    <ShieldCheck className="w-5 h-5 text-[var(--status-healthy)] shrink-0 mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-[var(--text-primary)] text-sm">{p.agent_role} Agent Decision</p>
                      <p className="font-mono text-xs text-[var(--text-muted)] mt-1 truncate">Hash: {p.hash}</p>
                      <p className="text-xs text-[var(--text-muted)] mt-1">Tx: {p.fabric_tx_id || 'Pending anchor'}</p>
                    </div>
                  </div>
                ))
             )}
          </div>
        )}
      </div>
    </div>
  );
}
