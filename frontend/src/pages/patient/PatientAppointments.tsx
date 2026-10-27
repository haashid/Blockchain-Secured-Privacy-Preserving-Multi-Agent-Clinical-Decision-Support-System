import { useQuery } from '@tanstack/react-query';
import { appointmentsApi } from '../../lib/hospitalApi';
import { formatDate } from '../../lib/utils';
import {
  Calendar, Clock, UserRound
} from 'lucide-react';

export default function PatientAppointments() {
  const { data: appointments, isLoading } = useQuery({
    queryKey: ['myAppointments'],
    queryFn: appointmentsApi.myAppointments,
  });

  return (
    <div className="max-w-[1000px] mx-auto space-y-6 pb-20 animate-fade-in">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 mb-2 rounded-full bg-[var(--accent-primary)]/10 border border-[var(--accent-primary)]/20 text-[var(--accent-primary)] text-[10px] font-bold uppercase tracking-widest">
            <Calendar className="w-3.5 h-3.5" /> Care Consultations
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-[var(--text-primary)]">
            My <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-indigo-400">Appointments</span>
          </h1>
          <p className="text-[var(--text-muted)] text-sm mt-1">
            Scheduled consultations, routine follow-ups, and clinical review visits.
          </p>
        </div>
      </div>

      {/* Appointment List */}
      <div className="space-y-4">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="panel p-6 space-y-3">
              <div className="skeleton h-5 w-1/3 rounded" />
              <div className="skeleton h-4 w-1/4 rounded" />
            </div>
          ))
        ) : !appointments || appointments.length === 0 ? (
          <div className="panel p-12 text-center flex flex-col items-center justify-center">
            <Calendar className="w-12 h-12 text-[var(--text-muted)] mb-3 opacity-40" />
            <h3 className="font-bold text-base text-[var(--text-primary)]">No Scheduled Appointments</h3>
            <p className="text-xs text-[var(--text-muted)] mt-1.5 max-w-sm">
              You do not have any upcoming visits scheduled. Contact your clinic coordinator to book your next consultation.
            </p>
          </div>
        ) : (
          appointments.map((appt: any) => (
            <div
              key={appt.id}
              className="panel p-6 border border-[var(--border-subtle)] hover:border-[var(--accent-primary)]/40 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5"
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-2xl bg-[var(--accent-primary)]/10 border border-[var(--accent-primary)]/20 text-[var(--accent-primary)] flex flex-col items-center justify-center font-bold shrink-0">
                  <Calendar className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <h3 className="font-bold text-base text-[var(--text-primary)]">
                      {appt.chief_complaint || 'General Clinical Consultation'}
                    </h3>
                    <span className="badge badge-healthy text-[10px] font-bold">
                      {appt.status || 'CONFIRMED'}
                    </span>
                  </div>

                  <p className="text-xs text-[var(--text-secondary)] font-medium flex items-center gap-2">
                    <UserRound className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                    <span>{appt.doctor_name || 'Dr. Robert Jenkins, MD'}</span>
                    {appt.doctor_specialization && (
                      <span className="text-[var(--text-muted)]">({appt.doctor_specialization})</span>
                    )}
                  </p>

                  <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--text-muted)] pt-1">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                      {formatDate(appt.scheduled_at)}
                    </span>
                    <span className="w-1 h-1 rounded-full bg-[var(--border-strong)]" />
                    <span>Duration: {appt.duration_minutes || 30} mins</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 self-end sm:self-center">
                <span className="text-xs font-semibold text-[var(--text-muted)] border border-[var(--border-subtle)] px-3 py-1.5 rounded-xl">
                  Exam Room 3
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
