import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { recordsApi, patientsApi, doctorsApi } from '../../lib/hospitalApi';
import { formatDate, cn } from '../../lib/utils';
import {
  FileText, FlaskConical, Stethoscope, Activity, Plus, Search,
  Filter, Calendar, Clock, UserRound, ArrowRight, Brain, AlertTriangle,
  FileCheck, Heart, Pill, X, AlertCircle
} from 'lucide-react';

const RECORD_TYPES = [
  { id: 'all', label: 'All Records', icon: FileText },
  { id: 'consultation', label: 'Consultations', icon: Stethoscope },
  { id: 'lab_result', label: 'Lab Results', icon: FlaskConical },
  { id: 'imaging', label: 'Imaging & Scans', icon: Activity },
  { id: 'discharge_summary', label: 'Discharge Summaries', icon: FileCheck },
] as const;

export default function DoctorRecords() {
  const queryClient = useQueryClient();
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    patient_id: '',
    doctor_id: '',
    record_type: 'consultation' as 'consultation' | 'lab_result' | 'imaging' | 'discharge_summary',
    title: '',
    notes: '',
    vitals: {
      blood_pressure: '',
      heart_rate: '' as any,
      temperature: '' as any,
      spo2: '' as any,
    },
    diagnosis_codes: '',
  });
  const [formError, setFormError] = useState<string | null>(null);

  // Queries
  const { data: records, isLoading } = useQuery({
    queryKey: ['records'],
    queryFn: () => recordsApi.list(),
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

  // Create Mutation
  const createMutation = useMutation({
    mutationFn: (data: any) => recordsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['records'] });
      setShowCreateModal(false);
      setFormData({
        patient_id: '',
        doctor_id: '',
        record_type: 'consultation',
        title: '',
        notes: '',
        vitals: { blood_pressure: '', heart_rate: '', temperature: '', spo2: '' },
        diagnosis_codes: '',
      });
      setFormError(null);
    },
    onError: (err: any) => {
      setFormError(err.message || 'Failed to create medical record');
    },
  });

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.patient_id) {
      setFormError('Please select a patient.');
      return;
    }
    if (!formData.title.trim()) {
      setFormError('Please enter a record title.');
      return;
    }

    // Format vitals object if entered
    const vitalsPayload: any = {};
    if (formData.vitals.blood_pressure) vitalsPayload.blood_pressure = formData.vitals.blood_pressure;
    if (formData.vitals.heart_rate) vitalsPayload.heart_rate = Number(formData.vitals.heart_rate);
    if (formData.vitals.temperature) vitalsPayload.temperature = Number(formData.vitals.temperature);
    if (formData.vitals.spo2) vitalsPayload.spo2 = Number(formData.vitals.spo2);

    const codes = formData.diagnosis_codes
      ? formData.diagnosis_codes.split(',').map((c) => c.trim()).filter(Boolean)
      : [];

    createMutation.mutate({
      patient_id: formData.patient_id,
      doctor_id: formData.doctor_id || myDoctor?.id || undefined,
      record_type: formData.record_type,
      title: formData.title,
      notes: formData.notes,
      content: { summary: formData.title },
      vitals: Object.keys(vitalsPayload).length ? vitalsPayload : undefined,
      diagnosis_codes: codes.length ? codes : undefined,
    });
  };

  // Filter & Search
  const allRecords = records || [];
  const filtered = allRecords.filter((r) => {
    if (typeFilter !== 'all' && r.record_type !== typeFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchPatient = (r.patient_name || '').toLowerCase().includes(q);
      const matchMRN = (r.patient_mrn || '').toLowerCase().includes(q);
      const matchTitle = (r.title || '').toLowerCase().includes(q);
      const matchNotes = (r.notes || '').toLowerCase().includes(q);
      return matchPatient || matchMRN || matchTitle || matchNotes;
    }
    return true;
  });

  // Stats
  const totalCount = allRecords.length;
  const consultationCount = allRecords.filter((r) => r.record_type === 'consultation').length;
  const labsCount = allRecords.filter((r) => r.record_type === 'lab_result').length;
  const imagingCount = allRecords.filter((r) => r.record_type === 'imaging').length;

  return (
    <div className="max-w-[1240px] mx-auto space-y-6 pb-20 animate-fade-in">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--border-subtle)] pb-6">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 mb-2 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400 text-[10px] font-bold uppercase tracking-widest">
            <FileText className="w-3.5 h-3.5" /> Longitudinal EHR
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-[var(--text-primary)]">
            Medical <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-indigo-400">Records & Charts</span>
          </h1>
          <p className="text-[var(--text-muted)] text-sm mt-1">
            Clinical consultations, laboratory panels, diagnostic imaging reports, and longitudinal patient charts.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <Link to="/doctor/appointments?schedule=true" className="btn-secondary">
            <Calendar className="w-4 h-4 mr-2 text-sky-400" /> Schedule Visit
          </Link>
          <button
            onClick={() => {
              setFormData((prev) => ({ ...prev, doctor_id: myDoctor?.id || '' }));
              setShowCreateModal(true);
            }}
            className="btn-primary"
          >
            <Plus className="w-4 h-4 mr-2" /> Add Medical Record
          </button>
        </div>
      </div>

      {/* Stats Counter */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Records', value: totalCount, icon: FileText, color: 'text-indigo-400' },
          { label: 'Consultations', value: consultationCount, icon: Stethoscope, color: 'text-sky-400' },
          { label: 'Laboratory Panels', value: labsCount, icon: FlaskConical, color: 'text-amber-600' },
          { label: 'Imaging & Diagnostics', value: imagingCount, icon: Activity, color: 'text-purple-400' },
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
          {RECORD_TYPES.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setTypeFilter(tab.id)}
              className={cn(
                'px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5',
                typeFilter === tab.id
                  ? 'bg-[var(--accent-primary)] text-white shadow-sm'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-panel-hover)]'
              )}
            >
              <tab.icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        <div className="relative min-w-[260px] flex-1 sm:flex-initial">
          <Search className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search patient, MRN, title, notes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input pl-9 text-xs w-full py-1.5"
          />
        </div>
      </div>

      {/* Records Cards List */}
      <div className="space-y-4">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="panel p-6 space-y-3">
              <div className="skeleton h-5 w-1/3 rounded" />
              <div className="skeleton h-4 w-1/4 rounded" />
              <div className="skeleton h-12 w-full rounded" />
            </div>
          ))
        ) : filtered.length === 0 ? (
          <div className="panel p-12 text-center flex flex-col items-center justify-center">
            <FileText className="w-12 h-12 text-[var(--text-muted)] mb-3 opacity-40" />
            <h3 className="font-bold text-base text-[var(--text-primary)]">No Records Found</h3>
            <p className="text-xs text-[var(--text-muted)] mt-1.5 max-w-sm">
              {searchQuery || typeFilter !== 'all'
                ? 'No medical records match the active filter or search query.'
                : 'No medical records are on file yet. Click above to record a new consultation or laboratory panel.'}
            </p>
          </div>
        ) : (
          filtered.map((rec) => {
            const isLab = rec.record_type === 'lab_result';
            const isConsult = rec.record_type === 'consultation';
            const isImaging = rec.record_type === 'imaging';

            return (
              <div
                key={rec.id}
                className="panel p-6 border border-[var(--border-subtle)] hover:border-[var(--accent-primary)]/40 transition-all space-y-4"
              >
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div
                      className={cn(
                        'w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border font-bold',
                        isLab
                          ? 'bg-amber-50 border-amber-300 text-amber-700'
                          : isImaging
                          ? 'bg-purple-500/10 border-purple-500/30 text-purple-400'
                          : 'bg-sky-500/10 border-sky-500/30 text-sky-400'
                      )}
                    >
                      {isLab ? (
                        <FlaskConical className="w-6 h-6" />
                      ) : isImaging ? (
                        <Activity className="w-6 h-6" />
                      ) : (
                        <Stethoscope className="w-6 h-6" />
                      )}
                    </div>

                    <div>
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <h3 className="font-bold text-base text-[var(--text-primary)]">{rec.title}</h3>
                        <span className="badge badge-neutral text-[10px] font-bold uppercase tracking-wider">
                          {rec.record_type.replace('_', ' ')}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--text-muted)] mt-1">
                        <Link
                          to={`/doctor/patients?patientId=${rec.patient_id}`}
                          className="font-bold text-[var(--text-primary)] hover:text-[var(--accent-primary)] transition-colors"
                        >
                          {rec.patient_name}
                        </Link>
                        {rec.patient_mrn && (
                          <span className="font-mono text-[10px] text-[var(--text-muted)] bg-[var(--bg-panel-hover)] px-1.5 py-0.5 rounded border border-[var(--border-subtle)]">
                            {rec.patient_mrn}
                          </span>
                        )}
                        <span className="w-1 h-1 rounded-full bg-[var(--border-strong)]" />
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                          {formatDate(rec.created_at)}
                        </span>
                        <span className="w-1 h-1 rounded-full bg-[var(--border-strong)]" />
                        <span>{rec.doctor_name}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center flex-wrap">
                    <Link
                      to={`/doctor/patients?patientId=${rec.patient_id}&tab=reviews&action=start_review`}
                      className="btn-secondary text-xs py-1.5 px-3 hover:border-purple-500/40"
                    >
                      <Brain className="w-3.5 h-3.5 mr-1.5 text-purple-400" /> Start Review
                    </Link>
                    <Link
                      to={`/doctor/patients?patientId=${rec.patient_id}`}
                      className="btn-secondary text-xs py-1.5 px-3"
                    >
                      Patient Chart <ArrowRight className="w-3.5 h-3.5 ml-1" />
                    </Link>
                    <Link
                      to={`/doctor/appointments?patientId=${rec.patient_id}&schedule=true`}
                      className="btn-secondary text-xs py-1.5 px-2.5 text-[var(--text-muted)] hover:text-sky-400"
                      title="Schedule Consultation"
                    >
                      <Calendar className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>

                {/* Vitals Ribbon */}
                {rec.vitals && Object.keys(rec.vitals).length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-[var(--bg-panel-hover)]/70 p-3 rounded-xl border border-[var(--border-subtle)] text-xs">
                    {rec.vitals.blood_pressure && (
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Blood Pressure</p>
                        <p className="font-bold font-mono text-[var(--text-primary)] mt-0.5">{rec.vitals.blood_pressure} mmHg</p>
                      </div>
                    )}
                    {rec.vitals.heart_rate && (
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Heart Rate</p>
                        <p className="font-bold font-mono text-[var(--text-primary)] mt-0.5">{rec.vitals.heart_rate} bpm</p>
                      </div>
                    )}
                    {rec.vitals.temperature && (
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Temperature</p>
                        <p className="font-bold font-mono text-[var(--text-primary)] mt-0.5">{rec.vitals.temperature} °F</p>
                      </div>
                    )}
                    {rec.vitals.spo2 && (
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">SpO2 Oxygen</p>
                        <p className="font-bold font-mono text-emerald-400 mt-0.5">{rec.vitals.spo2}%</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Lab Results Table */}
                {isLab && rec.lab_results && Object.keys(rec.lab_results).length > 0 && (
                  <div className="overflow-x-auto rounded-xl border border-[var(--border-subtle)]">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[var(--bg-panel-hover)] text-[10px] uppercase font-bold text-[var(--text-muted)] border-b border-[var(--border-subtle)]">
                        <tr>
                          <th className="p-2.5">Biomarker / Assay</th>
                          <th className="p-2.5 text-right">Result</th>
                          <th className="p-2.5 text-right">Unit</th>
                          <th className="p-2.5 text-right">Reference Range</th>
                          <th className="p-2.5 text-center">Status Flag</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--border-subtle)] font-mono">
                        {Object.entries(rec.lab_results).map(([key, item]: [string, any]) => (
                          <tr key={key} className="hover:bg-[var(--bg-panel-hover)]/50">
                            <td className="p-2.5 font-bold font-sans capitalize text-[var(--text-primary)]">{key.replace(/_/g, ' ')}</td>
                            <td className="p-2.5 text-right font-bold text-[var(--text-primary)]">{item.value}</td>
                            <td className="p-2.5 text-right text-[var(--text-muted)]">{item.unit}</td>
                            <td className="p-2.5 text-right text-[var(--text-muted)]">{item.reference || '—'}</td>
                            <td className="p-2.5 text-center">
                              {item.flag && item.flag !== 'NORMAL' ? (
                                <span className={cn(
                                  "text-[10px] font-bold uppercase px-1.5 py-0.5 rounded border",
                                  item.flag === 'HIGH' ? "bg-rose-50 text-rose-700 border-rose-200" :
                                  item.flag === 'LOW' ? "bg-blue-50 text-blue-700 border-blue-200" :
                                  "bg-amber-50 text-amber-800 border-amber-300 font-bold"
                                )}>
                                  {item.flag}
                                </span>
                              ) : (
                                <span className="text-[10px] text-[var(--text-muted)]">NORMAL</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Notes & Clinical Findings */}
                {rec.notes && (
                  <p className="text-xs text-[var(--text-secondary)] leading-relaxed bg-[var(--bg-panel)] p-3 rounded-xl border border-[var(--border-subtle)]">
                    <strong className="text-[var(--text-primary)]">Clinical Findings:</strong> {rec.notes}
                  </p>
                )}

                {/* Diagnosis Codes */}
                {rec.diagnosis_codes && rec.diagnosis_codes.length > 0 && (
                  <div className="flex items-center gap-2 flex-wrap pt-1">
                    <span className="text-[10px] font-bold uppercase text-[var(--text-muted)]">ICD-10:</span>
                    {rec.diagnosis_codes.map((code: string) => (
                      <span
                        key={code}
                        className="font-mono text-[10px] font-bold px-2 py-0.5 bg-[var(--bg-panel-hover)] border border-[var(--border-strong)] rounded text-[var(--text-secondary)]"
                      >
                        {code}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Add Medical Record Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
          <div className="bg-[var(--bg-panel)] border border-[var(--border-strong)] rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-[var(--border-subtle)] flex items-center justify-between bg-[var(--bg-app)]">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-[var(--accent-primary)]" />
                <h2 className="text-lg font-bold text-[var(--text-primary)]">New Medical Record Entry</h2>
              </div>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setFormError(null);
                }}
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="p-6 space-y-4 overflow-y-auto">
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

              {/* Record Type & Doctor */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-1.5">
                    Record Type *
                  </label>
                  <select
                    value={formData.record_type}
                    onChange={(e: any) => setFormData({ ...formData, record_type: e.target.value })}
                    className="input text-xs w-full"
                  >
                    <option value="consultation">Clinical Consultation Note</option>
                    <option value="lab_result">Laboratory Panel / Assay</option>
                    <option value="imaging">Imaging Study / Radiography</option>
                    <option value="discharge_summary">Discharge Summary</option>
                  </select>
                </div>

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
              </div>

              {/* Title */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-1.5">
                  Record Title / Header *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Comprehensive Metabolic Panel, Cardiology Consultation..."
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  required
                  className="input text-xs w-full"
                />
              </div>

              {/* Vitals Sub-section */}
              <div className="p-4 rounded-xl bg-[var(--bg-panel-hover)]/70 border border-[var(--border-subtle)] space-y-3">
                <p className="text-xs font-bold text-[var(--text-primary)] flex items-center gap-1.5">
                  <Activity className="w-4 h-4 text-[var(--accent-primary)]" /> Patient Vitals (Optional)
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-[var(--text-muted)] mb-1">
                      BP (mmHg)
                    </label>
                    <input
                      type="text"
                      placeholder="120/80"
                      value={formData.vitals.blood_pressure}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          vitals: { ...formData.vitals, blood_pressure: e.target.value },
                        })
                      }
                      className="input text-xs w-full py-1"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-[var(--text-muted)] mb-1">
                      Heart Rate (bpm)
                    </label>
                    <input
                      type="number"
                      placeholder="72"
                      value={formData.vitals.heart_rate}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          vitals: { ...formData.vitals, heart_rate: e.target.value },
                        })
                      }
                      className="input text-xs w-full py-1"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-[var(--text-muted)] mb-1">
                      Temp (°F)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      placeholder="98.6"
                      value={formData.vitals.temperature}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          vitals: { ...formData.vitals, temperature: e.target.value },
                        })
                      }
                      className="input text-xs w-full py-1"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-[var(--text-muted)] mb-1">
                      SpO2 (%)
                    </label>
                    <input
                      type="number"
                      placeholder="98"
                      value={formData.vitals.spo2}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          vitals: { ...formData.vitals, spo2: e.target.value },
                        })
                      }
                      className="input text-xs w-full py-1"
                    />
                  </div>
                </div>
              </div>

              {/* Diagnosis Codes */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-1.5">
                  Diagnosis Codes (ICD-10, comma-separated)
                </label>
                <input
                  type="text"
                  placeholder="e.g. I10, E11.9, Z79.4"
                  value={formData.diagnosis_codes}
                  onChange={(e) => setFormData({ ...formData, diagnosis_codes: e.target.value })}
                  className="input text-xs w-full"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-1.5">
                  Clinical Findings & Notes
                </label>
                <textarea
                  rows={4}
                  placeholder="Detailed observations, treatment notes, physical exam findings, or follow-up plan..."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="input text-xs w-full leading-relaxed"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-[var(--border-subtle)]">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="btn-secondary text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="btn-primary text-xs"
                >
                  {createMutation.isPending ? 'Saving...' : 'Save Medical Record'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
