import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { appointmentsApi, patientsApi, doctorsApi } from '../../lib/hospitalApi';
import { formatDate, cn } from '../../lib/utils';
import {
  Calendar, Clock, UserRound, Plus, Search, Filter, CheckCircle2,
  AlertTriangle, Stethoscope, Play, Check, X, Brain, ArrowRight,
  ShieldCheck, AlertCircle
} from 'lucide-react';

export default function DoctorAppointments() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showScheduleModal, setShowScheduleModal] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    patient_id: '',
    doctor_id: '',
    scheduled_at: '',
    duration_minutes: 30,
    priority: 'routine' as 'routine' | 'urgent' | 'emergency',
    chief_complaint: '',
    notes: '',
  });
  const [formError, setFormError] = useState<string | null>(null);

  // Queries
  const { data: appointments, isLoading } = useQuery({
    queryKey: ['appointments'],
    queryFn: () => appointmentsApi.list(),
  });

  const { data: patients } = useQuery({
    queryKey: ['patients'],
    queryFn: patientsApi.list,
  });

  const { data: doctors } = useQuery({
    queryKey: ['doctors'],
    queryFn: doctorsApi.list,
  });

  const { data: myDoctor } = useQuery({
    queryKey: ['myDoctor'],
    queryFn: doctorsApi.myDoctor,
    retry: false,
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: (data: any) => appointmentsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      setShowScheduleModal(false);
      setFormData({
        patient_id: '',
        doctor_id: '',
        scheduled_at: '',
        duration_minutes: 30,
        priority: 'routine',
        chief_complaint: '',
        notes: '',
      });
      setFormError(null);
    },
    onError: (err: any) => {
      setFormError(err.message || 'Failed to schedule appointment');
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      appointmentsApi.updateStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
    },
  });

  const handleScheduleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.patient_id) {
      setFormError('Please select a patient.');
      return;
    }
    if (!formData.scheduled_at) {
      setFormError('Please select a date and time for consultation.');
      return;
    }

    createMutation.mutate({
      ...formData,
      doctor_id: formData.doctor_id || myDoctor?.id || undefined,
      scheduled_at: new Date(formData.scheduled_at).toISOString(),
    });
  };

  // Filter & Search logic
  const allAppointments = appointments || [];
  const filtered = allAppointments.filter((a) => {
    if (statusFilter !== 'all' && a.status !== statusFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchPatient = (a.patient_name || '').toLowerCase().includes(q);
      const matchMRN = (a.patient_mrn || '').toLowerCase().includes(q);
      const matchComplaint = (a.chief_complaint || '').toLowerCase().includes(q);
      return matchPatient || matchMRN || matchComplaint;
    }
    return true;
  });

  // Stats
  const totalCount = allAppointments.length;
  const scheduledCount = allAppointments.filter((a) => a.status === 'scheduled').length;
  const inProgressCount = allAppointments.filter((a) => a.status === 'in_progress').length;
  const completedCount = allAppointments.filter((a) => a.status === 'completed').length;

  return (
    <div className="max-w-[1240px] mx-auto space-y-6 pb-20 animate-fade-in">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--border-subtle)] pb-6">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 mb-2 rounded-full bg-[var(--accent-primary)]/10 border border-[var(--accent-primary)]/20 text-[var(--accent-primary)] text-[10px] font-bold uppercase tracking-widest">
            <Calendar className="w-3.5 h-3.5" /> Care Consultations
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-[var(--text-primary)]">
            Clinical <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-indigo-400">Appointments</span>
          </h1>
          <p className="text-[var(--text-muted)] text-sm mt-1">
            Schedule and manage doctor-patient visits, routine consultations, and AI-assisted clinical checkups.
          </p>
        </div>

        <button
          onClick={() => {
            setFormData((prev) => ({
              ...prev,
              doctor_id: myDoctor?.id || '',
              scheduled_at: new Date(Date.now() + 3600000 * 2).toISOString().slice(0, 16),
            }));
            setShowScheduleModal(true);
          }}
          className="btn-primary"
        >
          <Plus className="w-4 h-4 mr-2" /> Schedule Consultation
        </button>
      </div>

      {/* Stats Counter */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Consultations', value: totalCount, icon: Calendar, color: 'text-indigo-400' },
          { label: 'Upcoming Scheduled', value: scheduledCount, icon: Clock, color: 'text-sky-400' },
          { label: 'In Consultation', value: inProgressCount, icon: Play, color: 'text-amber-400' },
          { label: 'Completed Visits', value: completedCount, icon: CheckCircle2, color: 'text-emerald-400' },
        ].map((s) => (
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

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 panel p-3">
        <div className="flex items-center gap-1.5 flex-wrap">
          {[
            { id: 'all', label: 'All' },
            { id: 'scheduled', label: 'Scheduled' },
            { id: 'in_progress', label: 'In Progress' },
            { id: 'completed', label: 'Completed' },
            { id: 'cancelled', label: 'Cancelled' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={cn(
                'px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all',
                statusFilter === tab.id
                  ? 'bg-[var(--accent-primary)] text-white shadow-sm'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-panel-hover)]'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative min-w-[260px] flex-1 sm:flex-initial">
          <Search className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search patient, MRN, complaint..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input pl-9 text-xs w-full py-1.5"
          />
        </div>
      </div>

      {/* Appointment Cards List */}
      <div className="space-y-4">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="panel p-6 space-y-3">
              <div className="skeleton h-5 w-1/3 rounded" />
              <div className="skeleton h-4 w-1/4 rounded" />
              <div className="skeleton h-10 w-full rounded" />
            </div>
          ))
        ) : filtered.length === 0 ? (
          <div className="panel p-12 text-center flex flex-col items-center justify-center">
            <Calendar className="w-12 h-12 text-[var(--text-muted)] mb-3 opacity-40" />
            <h3 className="font-bold text-base text-[var(--text-primary)]">No Consultations Found</h3>
            <p className="text-xs text-[var(--text-muted)] mt-1.5 max-w-sm">
              {searchQuery || statusFilter !== 'all'
                ? 'No appointments match the active filter or search query.'
                : 'No appointments are currently scheduled. Click above to schedule a new consultation.'}
            </p>
          </div>
        ) : (
          filtered.map((appt) => {
            const isUrgent = appt.priority === 'urgent' || appt.priority === 'emergency';
            return (
              <div
                key={appt.id}
                className="panel p-5 border border-[var(--border-subtle)] hover:border-[var(--accent-primary)]/40 transition-all flex flex-col lg:flex-row items-start lg:items-center justify-between gap-5"
              >
                <div className="flex items-start gap-4 flex-1 min-w-0">
                  <div
                    className={cn(
                      'w-12 h-12 rounded-2xl flex flex-col items-center justify-center shrink-0 border font-bold',
                      appt.status === 'in_progress'
                        ? 'bg-amber-500/10 border-amber-500/30 text-amber-400 animate-pulse'
                        : appt.status === 'completed'
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                        : 'bg-[var(--accent-primary)]/10 border-[var(--accent-primary)]/20 text-[var(--accent-primary)]'
                    )}
                  >
                    <Calendar className="w-6 h-6" />
                  </div>

                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <Link
                        to={`/doctor/patients?patientId=${appt.patient_id}`}
                        className="font-bold text-base text-[var(--text-primary)] hover:text-[var(--accent-primary)] transition-colors truncate"
                      >
                        {appt.patient_name}
                      </Link>
                      {appt.patient_mrn && (
                        <span className="font-mono text-[10px] text-[var(--text-muted)] bg-[var(--bg-panel-hover)] px-2 py-0.5 rounded border border-[var(--border-subtle)]">
                          {appt.patient_mrn}
                        </span>
                      )}
                      <span
                        className={cn(
                          'badge text-[10px] font-bold uppercase tracking-wider',
                          appt.status === 'completed'
                            ? 'badge-healthy'
                            : appt.status === 'in_progress'
                            ? 'badge-warning'
                            : 'badge-neutral'
                        )}
                      >
                        {appt.status.replace('_', ' ')}
                      </span>
                      {isUrgent && (
                        <span className="badge badge-danger text-[10px] font-bold uppercase">
                          {appt.priority}
                        </span>
                      )}
                    </div>

                    <p className="text-sm font-medium text-[var(--text-secondary)]">
                      {appt.chief_complaint || 'General Clinical Consultation'}
                    </p>

                    <div className="flex flex-wrap items-center gap-4 text-xs text-[var(--text-muted)] pt-0.5">
                      <span className="flex items-center gap-1.5 font-medium">
                        <Clock className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                        {formatDate(appt.scheduled_at)} ({appt.duration_minutes} min)
                      </span>
                      <span className="w-1 h-1 rounded-full bg-[var(--border-strong)]" />
                      <span className="flex items-center gap-1.5">
                        <Stethoscope className="w-3.5 h-3.5 text-purple-400" />
                        {appt.doctor_name}
                      </span>
                    </div>

                    {appt.notes && (
                      <p className="text-xs text-[var(--text-muted)] bg-[var(--bg-panel-hover)]/70 p-2.5 rounded-lg border border-[var(--border-subtle)] mt-2 italic">
                        <strong>Clinical Notes:</strong> {appt.notes}
                      </p>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-wrap items-center gap-2.5 self-end lg:self-center shrink-0">
                  {appt.status === 'scheduled' && (
                    <button
                      onClick={() => statusMutation.mutate({ id: appt.id, status: 'in_progress' })}
                      disabled={statusMutation.isPending}
                      className="btn-primary text-xs py-1.5 px-3 bg-amber-500 hover:bg-amber-600 border-amber-600"
                    >
                      <Play className="w-3.5 h-3.5 mr-1.5" /> Start Visit
                    </button>
                  )}

                  {appt.status === 'in_progress' && (
                    <button
                      onClick={() => statusMutation.mutate({ id: appt.id, status: 'completed' })}
                      disabled={statusMutation.isPending}
                      className="btn-primary text-xs py-1.5 px-3 bg-emerald-600 hover:bg-emerald-700 border-emerald-700"
                    >
                      <Check className="w-3.5 h-3.5 mr-1.5" /> Mark Completed
                    </button>
                  )}

                  <Link
                    to={`/doctor/patients?patientId=${appt.patient_id}&tab=reviews`}
                    className="btn-secondary text-xs py-1.5 px-3"
                  >
                    <Brain className="w-3.5 h-3.5 mr-1.5 text-purple-400" /> AI Review
                  </Link>

                  <Link
                    to={`/doctor/patients?patientId=${appt.patient_id}`}
                    className="btn-secondary text-xs py-1.5 px-3"
                  >
                    View Chart <ArrowRight className="w-3.5 h-3.5 ml-1" />
                  </Link>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Schedule Consultation Modal */}
      {showScheduleModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
          <div className="bg-[var(--bg-panel)] border border-[var(--border-strong)] rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-[var(--border-subtle)] flex items-center justify-between bg-[var(--bg-app)]">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-[var(--accent-primary)]" />
                <h2 className="text-lg font-bold text-[var(--text-primary)]">Schedule New Consultation</h2>
              </div>
              <button
                onClick={() => {
                  setShowScheduleModal(false);
                  setFormError(null);
                }}
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleScheduleSubmit} className="p-6 space-y-4 overflow-y-auto">
              {formError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-xl flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Patient Selection */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-1.5">
                  Select Patient *
                </label>
                <select
                  value={formData.patient_id}
                  onChange={(e) => setFormData({ ...formData, patient_id: e.target.value })}
                  required
                  className="input text-xs w-full"
                >
                  <option value="">-- Choose patient from registry --</option>
                  {(patients || []).map((p: any) => (
                    <option key={p.id} value={p.id}>
                      {p.first_name} {p.last_name} ({p.medical_record_number})
                    </option>
                  ))}
                </select>
              </div>

              {/* Doctor Selection */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-1.5">
                  Attending Physician
                </label>
                <select
                  value={formData.doctor_id}
                  onChange={(e) => setFormData({ ...formData, doctor_id: e.target.value })}
                  className="input text-xs w-full"
                >
                  <option value="">
                    {myDoctor ? `Dr. ${myDoctor.first_name} ${myDoctor.last_name} (Current User)` : '-- Auto-assign Doctor --'}
                  </option>
                  {(doctors || []).map((d: any) => (
                    <option key={d.id} value={d.id}>
                      Dr. {d.first_name} {d.last_name} ({d.specialization})
                    </option>
                  ))}
                </select>
              </div>

              {/* Date & Duration */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-1.5">
                    Consultation Date & Time *
                  </label>
                  <input
                    type="datetime-local"
                    value={formData.scheduled_at}
                    onChange={(e) => setFormData({ ...formData, scheduled_at: e.target.value })}
                    required
                    className="input text-xs w-full"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-1.5">
                    Duration
                  </label>
                  <select
                    value={formData.duration_minutes}
                    onChange={(e) => setFormData({ ...formData, duration_minutes: Number(e.target.value) })}
                    className="input text-xs w-full"
                  >
                    <option value={15}>15 minutes (Quick follow-up)</option>
                    <option value={30}>30 minutes (Standard visit)</option>
                    <option value={45}>45 minutes (Detailed exam)</option>
                    <option value={60}>60 minutes (Comprehensive review)</option>
                  </select>
                </div>
              </div>

              {/* Priority */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-1.5">
                  Clinical Priority
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['routine', 'urgent', 'emergency'] as const).map((p) => (
                    <button
                      type="button"
                      key={p}
                      onClick={() => setFormData({ ...formData, priority: p })}
                      className={cn(
                        'py-2 rounded-xl text-xs font-bold uppercase tracking-wider border transition-all',
                        formData.priority === p
                          ? p === 'emergency'
                            ? 'bg-rose-500/20 text-rose-400 border-rose-500/40'
                            : p === 'urgent'
                            ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                            : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                          : 'bg-[var(--bg-panel-hover)] text-[var(--text-muted)] border-[var(--border-subtle)]'
                      )}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              {/* Chief Complaint */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-1.5">
                  Chief Complaint / Reason for Visit
                </label>
                <input
                  type="text"
                  placeholder="e.g. Chest tightness, hypertension re-check, diabetes review..."
                  value={formData.chief_complaint}
                  onChange={(e) => setFormData({ ...formData, chief_complaint: e.target.value })}
                  className="input text-xs w-full"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-1.5">
                  Preliminary Clinical Notes
                </label>
                <textarea
                  rows={3}
                  placeholder="Additional context, vital thresholds to observe, or specific specialist review requested..."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="input text-xs w-full leading-relaxed"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-[var(--border-subtle)]">
                <button
                  type="button"
                  onClick={() => setShowScheduleModal(false)}
                  className="btn-secondary text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="btn-primary text-xs"
                >
                  {createMutation.isPending ? 'Scheduling...' : 'Confirm Appointment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
