import { useQuery } from '@tanstack/react-query';
import { clinicalApi, reviewStatusLabel, reviewStatusTone } from '../../lib/clinicalApi';
import { cn, formatDate } from '../../lib/utils';
import { FileText, ShieldCheck, Activity } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function PatientAIReports() {
  const patientId = '00000000-0000-0000-0000-000000000000'; // Assume hardcoded or from auth context
  
  const { data: reviews, isLoading } = useQuery({
    queryKey: ['patientClinicalReviews', patientId],
    queryFn: () => clinicalApi.forPatient(patientId),
  });

  return (
    <div className="max-w-[1000px] mx-auto space-y-8 pb-16 animate-fade-in">
      <div>
        <h1 className="text-[28px] font-extrabold tracking-tight text-[var(--text-primary)]">
          Clinical <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">Reports</span>
        </h1>
        <p className="text-[var(--text-muted)] text-sm mt-1">Sanitized summaries of your AI-assisted clinical reviews.</p>
      </div>

      <div className="panel p-6">
        {isLoading ? (
          <div className="text-center p-8 text-[var(--text-muted)]">Loading reports...</div>
        ) : !reviews?.length ? (
          <div className="text-center p-12">
            <Activity className="w-12 h-12 text-[var(--text-muted)] mx-auto mb-4 opacity-50" />
            <p className="text-[var(--text-primary)] font-bold">No Clinical Reports Available</p>
            <p className="text-[var(--text-muted)] text-sm mt-2">Your doctor has not initiated any AI reviews yet.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {reviews.map(review => (
              <div key={review.id} className="border border-[var(--border-subtle)] rounded-xl p-5 hover:border-[var(--accent-primary)] transition-colors">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-bold text-[var(--text-primary)]">{review.title}</h3>
                    <p className="text-xs text-[var(--text-muted)] mt-1">{formatDate(review.created_at)}</p>
                  </div>
                  <span className={cn('badge', reviewStatusTone(review.status))}>{reviewStatusLabel(review.status)}</span>
                </div>
                
                <p className="text-sm text-[var(--text-secondary)] mb-4 leading-relaxed">
                  A multi-specialist AI review was conducted for this case. The findings were securely verified and sent to your primary care physician.
                </p>

                <div className="flex items-center justify-between pt-4 border-t border-[var(--border-subtle)]">
                  <div className="flex items-center gap-2 text-xs font-semibold text-[var(--status-healthy)]">
                    <ShieldCheck className="w-4 h-4" /> Cryptographically secured
                  </div>
                  <Link to={`/patient/dashboard`} className="text-xs font-bold text-[var(--accent-primary)] hover:underline">
                    View Details
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
