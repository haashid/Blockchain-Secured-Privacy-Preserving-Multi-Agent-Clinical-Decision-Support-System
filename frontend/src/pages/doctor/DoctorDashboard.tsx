import { useQuery } from '@tanstack/react-query';
import { patientsApi, appointmentsApi } from '../../lib/hospitalApi';
import { clinicalApi, reviewStatusLabel, reviewStatusTone } from '../../lib/clinicalApi';
import { Link } from 'react-router-dom';
import { formatDate, cn } from '../../lib/utils';
import { Users, Brain, Calendar, ArrowRight, Activity, Clock, ShieldCheck, Stethoscope, ChevronRight } from 'lucide-react';

function MetricCard({ title, value, icon: Icon, colorClass, to }: any) {
  return (
    <Link to={to} className="panel p-5 group flex flex-col hover:border-[var(--accent-primary)] transition-colors">
      <div className="flex items-center justify-between mb-4">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-[var(--bg-panel-hover)] border border-[var(--border-subtle)]">
          <Icon className={`w-5 h-5 ${colorClass}`} />
        </div>
        <ArrowRight className="w-4 h-4 text-[var(--text-muted)] group-hover:text-[var(--accent-primary)] transition-colors" />
      </div>
      <div>
        <p className="text-3xl font-extrabold text-[var(--text-primary)] tracking-tight">{value}</p>
        <p className="text-[11px] font-bold uppercase tracking-widest text-[var(--text-secondary)] mt-1">{title}</p>
      </div>
    </Link>
  );
}

export default function DoctorDashboard() {
  const { data: patients } = useQuery({
    queryKey: ['patients'],
    queryFn: patientsApi.list
  });

  const { data: reviewData } = useQuery({
    queryKey: ['clinicalReviews'],
    queryFn: clinicalApi.list
  });

  const reviews = [...(reviewData?.active || []), ...(reviewData?.mine || [])].filter(
    (v, i, a) => a.findIndex(t => t.id === v.id) === i
  );

  const pendingReviews = reviews.filter(
    r => (r as any).approval_status === 'PENDING_APPROVAL' || (r as any).approval_status === 'AWAITING_REVIEW' || r.status === 'completed'
  );

  const { data: appointments } = useQuery({
    queryKey: ['appointments'],
    queryFn: () => appointmentsApi.list(),
  });

  const allAppointments = appointments || [];
  const scheduledAppointments = allAppointments.filter(
    (a) => a.status === 'scheduled' || a.status === 'in_progress'
  );

  return (
    <div className="flex flex-col gap-8 max-w-6xl mx-auto pb-20 animate-fade-in">
      {/* Header */}
      <div className="flex items-end justify-between border-b border-[var(--border-subtle)] pb-6">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 mb-3 rounded-full bg-[var(--accent-primary)]/10 border border-[var(--accent-primary)]/20 text-[var(--accent-primary)] text-[10px] font-bold uppercase tracking-widest">
            <Stethoscope className="w-3.5 h-3.5" /> Doctor Decision Workspace
          </div>
          <h1 className="text-3xl font-extrabold text-[var(--text-primary)] tracking-tight">
            Good morning, <span className="text-[var(--accent-primary)]">Dr. Jenkins</span>
          </h1>
          <p className="text-sm font-medium text-[var(--text-secondary)] mt-1">
            You have <strong className="text-[var(--text-primary)]">{pendingReviews.length}</strong> AI clinical reviews awaiting your clinical review and approval.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="badge badge-healthy text-xs font-bold">
            <ShieldCheck className="w-3.5 h-3.5 mr-1" /> Sovereign DID Active
          </span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <MetricCard
          title="Active Patients"
          value={patients?.length || 0}
          icon={Users}
          colorClass="text-[var(--accent-primary)]"
          to="/doctor/patients"
        />
        <MetricCard
          title="Pending Clinical Reviews"
          value={pendingReviews.length}
          icon={Brain}
          colorClass="text-amber-600"
          to="/doctor/reviews"
        />
        <MetricCard
          title="Upcoming Consultations"
          value={scheduledAppointments.length}
          icon={Calendar}
          colorClass="text-emerald-400"
          to="/doctor/appointments"
        />
      </div>

      {/* Two-column panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Today's Schedule */}
        <div className="panel flex flex-col">
          <div className="p-5 border-b border-[var(--border-subtle)] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-[var(--accent-primary)]/10 flex items-center justify-center">
                <Clock className="w-4 h-4 text-[var(--accent-primary)]" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[var(--text-primary)]">Upcoming Schedule</h3>
                <p className="text-[11px] text-[var(--text-muted)] font-medium">Scheduled patient consultations</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Link to="/doctor/appointments?schedule=true" className="text-xs font-bold text-[var(--accent-primary)] hover:underline">
                + Schedule
              </Link>
              <Link to="/doctor/appointments" className="text-xs font-bold text-[var(--text-muted)] hover:underline">
                View all
              </Link>
            </div>
          </div>

          <div className="flex-1 divide-y divide-[var(--border-subtle)]">
            {scheduledAppointments.length > 0 ? (
              scheduledAppointments.slice(0, 4).map((appt) => (
                <div key={appt.id} className="p-4 flex items-center justify-between hover:bg-[var(--bg-panel-hover)] transition-colors">
                  <div className="flex items-start gap-3 min-w-0 pr-3">
                    <span className="font-mono text-xs font-bold text-[var(--accent-primary)] bg-[var(--accent-primary)]/10 px-2 py-1 rounded-md shrink-0">
                      {new Date(appt.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <div className="min-w-0">
                      <Link to={`/doctor/patients?patientId=${appt.patient_id}`} className="text-xs font-bold text-[var(--text-primary)] hover:text-[var(--accent-primary)] transition-colors truncate block">
                        {appt.patient_name}
                      </Link>
                      <p className="text-[11px] text-[var(--text-secondary)] truncate">{appt.chief_complaint || 'General Consultation'}</p>
                    </div>
                  </div>
                  <span className={cn(
                    "text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider shrink-0",
                    appt.priority === 'urgent' || appt.priority === 'emergency'
                      ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                      : "text-[var(--text-muted)] border border-[var(--border-subtle)]"
                  )}>
                    {appt.status.replace('_', ' ')}
                  </span>
                </div>
              ))
            ) : (
              <div className="p-8 text-center flex flex-col items-center justify-center">
                <Calendar className="w-8 h-8 text-[var(--text-muted)] mb-2 opacity-40" />
                <p className="text-xs font-bold text-[var(--text-primary)]">No upcoming appointments</p>
                <Link to="/doctor/appointments?schedule=true" className="text-xs font-bold text-[var(--accent-primary)] hover:underline mt-1.5">
                  + Schedule a consultation
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Recent AI Reviews */}
        <div className="panel flex flex-col">
          <div className="p-5 border-b border-[var(--border-subtle)] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
                <Brain className="w-4 h-4 text-purple-400" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[var(--text-primary)]">Recent AI Reviews</h3>
                <p className="text-[11px] text-[var(--text-muted)] font-medium">Multi-agent decision support cases</p>
              </div>
            </div>
            <Link to="/doctor/reviews" className="text-xs font-bold text-[var(--accent-primary)] hover:underline">
              View all
            </Link>
          </div>

          <div className="flex flex-col flex-1 divide-y divide-[var(--border-subtle)]">
            {reviews.slice(0, 4).map(review => {
              const status = (review as any).approval_status || review.status;
              return (
                <div key={review.id} className="p-4 flex items-center justify-between hover:bg-[var(--bg-panel-hover)] transition-colors">
                  <div className="min-w-0 pr-4">
                    <p className="text-xs font-bold text-[var(--text-primary)] truncate">{review.title}</p>
                    <p className="text-[11px] text-[var(--text-muted)] mt-0.5">{formatDate(review.created_at)}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className={cn('badge text-[10px] font-bold', reviewStatusTone(status))}>
                      {reviewStatusLabel(status)}
                    </span>
                    <Link
                      to={`/doctor/reviews/${review.id}`}
                      className="px-3 py-1 rounded-lg text-xs font-bold text-white bg-[var(--accent-primary)] hover:opacity-90 transition-opacity flex items-center gap-1"
                    >
                      Review <ChevronRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              );
            })}

            {reviews.length === 0 && (
              <div className="flex-1 flex flex-col items-center justify-center min-h-[200px] p-8 text-center">
                <Brain className="w-8 h-8 text-[var(--text-muted)] mb-2 opacity-50" />
                <p className="text-[11px] text-[var(--text-muted)] mt-1">Initiate a review from the Patient Workspace or click below.</p>
                <Link to="/doctor/reviews" className="text-xs font-bold text-[var(--accent-primary)] hover:underline mt-2">
                  + Launch new AI clinical review
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
