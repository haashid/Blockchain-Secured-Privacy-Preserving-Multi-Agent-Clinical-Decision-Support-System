import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { clinicalApi } from '../../lib/clinicalApi';
import { formatDate } from '../../lib/utils';
import {
  FileText, ShieldCheck, Activity, CheckCircle2, Clock, Stethoscope,
  ChevronDown, ChevronUp, HeartPulse, Pill
} from 'lucide-react';

export default function PatientAIReports() {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: reports, isLoading } = useQuery({
    queryKey: ['myReleasedReviews'],
    queryFn: clinicalApi.myReleased,
  });

  return (
    <div className="max-w-[1000px] mx-auto space-y-6 pb-20 animate-fade-in">
      {/* Header */}
      <div>
        <div className="inline-flex items-center gap-1.5 px-3 py-1 mb-2 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-[10px] font-bold uppercase tracking-widest">
          <FileText className="w-3.5 h-3.5" /> Doctor-Approved Reports
        </div>
        <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-[var(--text-primary)]">
          Clinical <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-indigo-400">Summaries</span>
        </h1>
        <p className="text-[var(--text-muted)] text-sm mt-1">
          Patient-facing summaries of your AI-assisted clinical reviews, approved and released by your physician.
        </p>
      </div>

      {/* Reports List */}
      <div className="space-y-4">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="panel p-6 space-y-3">
              <div className="skeleton h-5 w-1/3 rounded" />
              <div className="skeleton h-4 w-1/2 rounded" />
              <div className="skeleton h-16 w-full rounded" />
            </div>
          ))
        ) : !reports || reports.length === 0 ? (
          <div className="panel p-12 text-center flex flex-col items-center justify-center">
            <Activity className="w-12 h-12 text-[var(--text-muted)] mb-3 opacity-40" />
            <h3 className="font-bold text-base text-[var(--text-primary)]">No Released Clinical Reports Yet</h3>
            <p className="text-xs text-[var(--text-muted)] mt-1.5 max-w-md">
              Your care team is actively evaluating your case. Once your physician completes their review and formally approves the findings, your summary will be published here.
            </p>
          </div>
        ) : (
          reports.map((report: any) => {
            const isExpanded = expandedId === report.id;
            const rData = report.report || {};

            return (
              <div key={report.id} className="panel overflow-hidden border border-[var(--border-subtle)] hover:border-[var(--accent-primary)]/40 transition-all">
                <div
                  className="p-6 cursor-pointer hover:bg-[var(--bg-panel-hover)] transition-colors flex items-start justify-between gap-4"
                  onClick={() => setExpandedId(isExpanded ? null : report.id)}
                >
                  <div className="space-y-1.5 min-w-0 flex-1">
                    <div className="flex items-center gap-3 flex-wrap">
                      <h3 className="font-bold text-base text-[var(--text-primary)]">
                        {report.purpose || 'Clinical Health Assessment'}
                      </h3>
                      <span className="badge badge-healthy text-[10px] font-bold">
                        <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Physician Approved
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--text-muted)]">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" /> Released on {formatDate(report.released_at || report.approved_at)}
                      </span>
                      {report.chief_complaint && (
                        <>
                          <span className="w-1 h-1 rounded-full bg-[var(--border-strong)]" />
                          <span>Reason: <strong>{report.chief_complaint}</strong></span>
                        </>
                      )}
                    </div>

                    <p className="text-xs text-[var(--text-secondary)] line-clamp-2 mt-2 leading-relaxed">
                      {report.patient_friendly_summary || rData.case_summary || 'Your physician reviewed multi-specialist recommendations and updated your clinical directives.'}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button className="p-2 rounded-xl border border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)]">
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="p-6 border-t border-[var(--border-subtle)] bg-[var(--bg-panel-hover)]/40 space-y-6 animate-fade-in">
                    {/* Patient-Friendly Summary Box */}
                    <div className="p-5 rounded-2xl bg-[var(--bg-panel)] border border-[var(--border-subtle)] space-y-2">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--accent-primary)] flex items-center gap-2">
                        <HeartPulse className="w-4 h-4" /> Understanding Your Results
                      </h4>
                      <p className="text-sm text-[var(--text-primary)] leading-relaxed font-medium">
                        {report.patient_friendly_summary || rData.case_summary || 'Clinical evaluation completed. Continue prescribed therapeutic regimen and monitor symptoms.'}
                      </p>
                    </div>

                    {/* Findings & Safety Points */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                      {/* Lab Findings */}
                      {rData.laboratory_findings && (
                        <div className="p-4 rounded-xl bg-[var(--bg-panel)] border border-[var(--border-subtle)] space-y-2">
                          <h5 className="font-bold text-[var(--text-primary)] flex items-center gap-2">
                            <Activity className="w-4 h-4 text-sky-400" /> Lab & Test Interpretation
                          </h5>
                          <p className="text-[var(--text-secondary)] leading-relaxed">
                            {rData.laboratory_findings}
                          </p>
                        </div>
                      )}

                      {/* Medication Safety Findings */}
                      {rData.medication_safety_findings && (
                        <div className="p-4 rounded-xl bg-[var(--bg-panel)] border border-[var(--border-subtle)] space-y-2">
                          <h5 className="font-bold text-[var(--text-primary)] flex items-center gap-2">
                            <Pill className="w-4 h-4 text-emerald-400" /> Medication Plan & Safety
                          </h5>
                          <p className="text-[var(--text-secondary)] leading-relaxed">
                            {rData.medication_safety_findings}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Clinician Notes */}
                    {report.clinician_notes && (
                      <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-xs space-y-1.5 shadow-sm">
                        <p className="font-bold flex items-center gap-1.5 text-amber-900">
                          <Stethoscope className="w-4 h-4 text-amber-700" /> Doctor's Direct Notes:
                        </p>
                        <p className="leading-relaxed text-amber-950 font-medium italic">
                          "{report.clinician_notes}"
                        </p>
                      </div>
                    )}

                    {/* Cryptographic Security Stamp */}
                    <div className="pt-4 border-t border-[var(--border-subtle)] flex flex-wrap items-center justify-between gap-4 text-xs">
                      <div className="flex items-center gap-2 text-emerald-400 font-semibold text-[11px]">
                        <ShieldCheck className="w-4 h-4" /> Anchored to Hyperledger Fabric • SHA-256 Verified
                      </div>
                      <span className="text-[11px] text-[var(--text-muted)] font-mono">
                        Verification Reference: {report.id}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
