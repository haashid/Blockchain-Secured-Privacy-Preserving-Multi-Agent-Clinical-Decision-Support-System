import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { patientsApi, reportsApi } from '../../lib/hospitalApi';
import { clinicalApi, REVIEW_PURPOSES } from '../../lib/clinicalApi';
import { cn, formatDate } from '../../lib/utils';
import {
  Users, Search, Plus, Calendar, Activity,
  ChevronRight, Filter, FileText, BrainCircuit, ShieldCheck, Loader2, ArrowLeft, Heart, Clock
} from 'lucide-react';

// --- Patient Workspace Component ---
function PatientWorkspace({ patientId, onBack }: { patientId: string; onBack: () => void }) {
  const { data: patient } = useQuery({
    queryKey: ['patient', patientId],
    queryFn: () => patientsApi.get(patientId),
  });

  const { data: reports } = useQuery({
    queryKey: ['reports', patientId],
    queryFn: () => reportsApi.forPatient(patientId),
  });

  const [purpose, setPurpose] = useState(REVIEW_PURPOSES[0].value);
  const [chiefComplaint, setChiefComplaint] = useState('');
  const [symptoms, setSymptoms] = useState('');
  const [activeReviewId, setActiveReviewId] = useState<string | null>(null);

  const reviewMutation = useMutation({
    mutationFn: () => clinicalApi.start({
      patient_id: patientId,
      purpose: purpose,
      chief_complaint: chiefComplaint,
      symptoms: symptoms.split(',').map(s => s.trim()).filter(Boolean),
      vitals: {}
    }),
    onSuccess: (data) => {
      setActiveReviewId(data.clinical_review_id);
      setChiefComplaint('');
      setSymptoms('');
    }
  });

  const { data: activeReview } = useQuery({
    queryKey: ['clinicalReview', activeReviewId],
    queryFn: () => clinicalApi.get(activeReviewId!),
    enabled: !!activeReviewId,
    refetchInterval: (query) => {
      return (query.state.data?.status === 'completed' || query.state.data?.status === 'failed') ? false : 3000;
    }
  });

  const isAnalyzing = activeReview?.status === 'pending' || activeReview?.status === 'running';
  const analysisComplete = activeReview?.status === 'completed';

  if (!patient) return <div className="p-8 text-center text-[var(--text-muted)]">Loading patient data...</div>;

  return (
    <div className="flex flex-col h-full animate-fade-in max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6 border-b border-[var(--border-subtle)] pb-6">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 border border-[var(--border-strong)] rounded-full text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-panel-hover)] transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-[var(--text-primary)] tracking-tight">
              {patient.first_name} {patient.last_name}
            </h1>
            <div className="flex items-center gap-3 mt-1.5 text-sm font-medium text-[var(--text-secondary)]">
              <span>{patient.medical_record_number || 'MRN-XXXX'}</span>
              <span className="w-1 h-1 rounded-full bg-[var(--border-strong)]" />
              <span>Age {Math.floor(Math.random() * 40) + 30}</span>
              <span className="w-1 h-1 rounded-full bg-[var(--border-strong)]" />
              <span className="text-[var(--status-healthy)] flex items-center gap-1">
                <Activity className="w-3.5 h-3.5" /> Stable
              </span>
            </div>
          </div>
        </div>
        <div className="flex gap-3">
          <button className="btn-secondary">View Full EHR</button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Clinical Summary */}
        <div className="lg:col-span-1 flex flex-col gap-6">
          
          <div className="panel p-6">
            <h3 className="text-[13px] font-bold text-[var(--text-secondary)] uppercase tracking-widest mb-4">Clinical Profile</h3>
            <div className="space-y-4">
              <div>
                <p className="text-xs text-[var(--text-muted)] font-medium mb-1.5">Chronic Conditions</p>
                <div className="flex flex-wrap gap-2">
                  {patient.chronic_conditions?.length ? patient.chronic_conditions.map(c => (
                    <span key={c} className="badge badge-neutral bg-[var(--bg-panel-hover)]">{c}</span>
                  )) : <span className="text-sm text-[var(--text-primary)]">None recorded</span>}
                </div>
              </div>
              <div className="h-px bg-[var(--border-subtle)]" />
              <div>
                <p className="text-xs text-[var(--text-muted)] font-medium mb-1.5">Recent Vitals</p>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="block text-[var(--text-muted)] text-xs">BP</span>
                    <span className="font-semibold text-[var(--text-primary)]">120/80</span>
                  </div>
                  <div>
                    <span className="block text-[var(--text-muted)] text-xs">HR</span>
                    <span className="font-semibold text-[var(--text-primary)]">72 bpm</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="panel p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[13px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">Documents</h3>
              <span className="text-xs font-semibold text-[var(--accent-primary)]">{reports?.length || 0} files</span>
            </div>
            <div className="space-y-3">
              {!reports?.length ? (
                <p className="text-[13px] text-[var(--text-muted)]">No documents available.</p>
              ) : (
                reports.map(r => (
                  <div key={r.id} className="flex items-center gap-3 p-2.5 rounded-md border border-[var(--border-subtle)] hover:bg-[var(--bg-panel-hover)] transition-colors cursor-pointer">
                    <FileText className="w-4 h-4 text-[var(--text-muted)] shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[12px] font-semibold text-[var(--text-primary)] truncate">{r.filename}</p>
                      <p className="text-[10px] text-[var(--text-muted)] mt-0.5">{formatDate(r.uploaded_at)}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
          
        </div>

        {/* Right Column: Live AI Review */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          <div className="panel p-0 overflow-hidden flex flex-col h-full min-h-[500px]">
            <div className="px-6 py-5 border-b border-[var(--border-subtle)] bg-[var(--bg-panel-hover)] flex items-center gap-3">
              <div className="w-8 h-8 rounded bg-[var(--accent-primary)] text-white flex items-center justify-center shadow-sm">
                <BrainCircuit className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-base font-bold text-[var(--text-primary)]">Multi-Agent Clinical Review</h2>
                <p className="text-xs text-[var(--text-muted)] font-medium">Trigger collaborative analysis by 10 specialized agents</p>
              </div>
            </div>

            <div className="p-6 flex-1 flex flex-col">
              <div className="mb-4">
                <label className="block text-xs font-bold text-[var(--text-secondary)] uppercase tracking-widest mb-1.5">Review Purpose</label>
                <select 
                  className="field-input" 
                  value={purpose} 
                  onChange={(e) => setPurpose(e.target.value)}
                  disabled={isAnalyzing}
                >
                  {REVIEW_PURPOSES.map(p => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block text-xs font-bold text-[var(--text-secondary)] uppercase tracking-widest mb-1.5">Chief Complaint</label>
                  <input
                    type="text"
                    className="field-input"
                    placeholder="e.g. Chest pain radiating to arm"
                    value={chiefComplaint}
                    onChange={e => setChiefComplaint(e.target.value)}
                    disabled={isAnalyzing}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[var(--text-secondary)] uppercase tracking-widest mb-1.5">Symptoms</label>
                  <input
                    type="text"
                    className="field-input"
                    placeholder="Comma separated"
                    value={symptoms}
                    onChange={e => setSymptoms(e.target.value)}
                    disabled={isAnalyzing}
                  />
                </div>
              </div>
              
              <button 
                className={cn("btn-primary w-full py-3 text-sm", isAnalyzing && "opacity-50 cursor-not-allowed")}
                onClick={() => reviewMutation.mutate()}
                disabled={isAnalyzing || !chiefComplaint}
              >
                {isAnalyzing ? (
                  <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Agents Analyzing Case...</>
                ) : 'Initiate Review'}
              </button>

              {/* Active Task Results */}
              {activeReviewId && (
                <div className="mt-8 flex-1 flex flex-col">
                  <div className="flex items-center justify-between mb-4 pb-2 border-b border-[var(--border-subtle)]">
                    <span className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-[var(--status-healthy)]" /> Cryptographic Consensus
                    </span>
                    <span className="badge badge-neutral capitalize">{activeReview?.status || 'Initiating...'}</span>
                  </div>
                  
                  <div className="flex-1 bg-[var(--bg-app)] border border-[var(--border-strong)] rounded-lg p-5 overflow-y-auto">
                    {analysisComplete && activeReview?.runs?.[0]?.final_report ? (
                      <div className="font-mono text-sm text-[var(--text-primary)] whitespace-pre-wrap leading-relaxed">
                        {typeof activeReview.runs[0].final_report === 'string' 
                          ? activeReview.runs[0].final_report 
                          : JSON.stringify(activeReview.runs[0].final_report, null, 2)}
                      </div>
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center text-[var(--text-muted)]">
                        <Activity className="w-8 h-8 mb-3 opacity-50" />
                        <p className="text-sm font-medium">Monitoring agent communications...</p>
                        <p className="text-xs mt-2">Fabric network hashing active</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Main Registry View ---
export default function DoctorPatients() {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all');
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);

  const { data: patients, isLoading } = useQuery({
    queryKey: ['patients'],
    queryFn: patientsApi.list,
  });

  const filtered = (patients || []).filter(p => {
    const q = search.toLowerCase();
    const name = `${p.first_name} ${p.last_name}`.toLowerCase();
    const matchSearch = !q || name.includes(q) || p.medical_record_number?.toLowerCase().includes(q);
    const risk = (p.risk_level || 'low').toLowerCase();
    const matchFilter = filter === 'all' || risk === filter;
    return matchSearch && matchFilter;
  });

  if (selectedPatientId) {
    return <PatientWorkspace patientId={selectedPatientId} onBack={() => setSelectedPatientId(null)} />;
  }

  return (
    <div className="max-w-[1400px] mx-auto space-y-6 pb-12 animate-fade-in">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[var(--text-primary)] tracking-tight">Patient Registry</h1>
          <p className="text-[var(--text-secondary)] text-sm mt-1 font-medium">Manage and monitor all registered patients.</p>
        </div>
        <button className="btn-primary">
          <Plus className="w-4 h-4 mr-2" /> Register Patient
        </button>
      </div>

      {/* Filters bar */}
      <div className="panel p-4 flex flex-wrap gap-4 items-center shadow-sm">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name or MRN..."
            className="field-input !pl-10"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-[var(--text-muted)] mr-1" />
          {(['all', 'high', 'medium', 'low'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                'px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider border transition-colors',
                filter === f
                  ? 'bg-[var(--accent-primary)]/10 border-[var(--accent-primary)]/30 text-[var(--accent-primary)]'
                  : 'bg-transparent border-[var(--border-strong)] text-[var(--text-secondary)] hover:bg-[var(--bg-panel-hover)]'
              )}
            >
              {f === 'all' ? 'All' : f}
            </button>
          ))}
        </div>
        <div className="w-px h-6 bg-[var(--border-strong)] mx-2 hidden sm:block" />
        <span className="text-[13px] font-semibold text-[var(--text-muted)]">
          {filtered.length} Patients
        </span>
      </div>

      {/* Dense Table View */}
      <div className="panel overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[var(--bg-panel-hover)] border-b border-[var(--border-strong)]">
                <th className="px-6 py-3.5 text-[11px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">ID / MRN</th>
                <th className="px-6 py-3.5 text-[11px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">Patient Name</th>
                <th className="px-6 py-3.5 text-[11px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">Conditions</th>
                <th className="px-6 py-3.5 text-[11px] font-bold text-[var(--text-secondary)] uppercase tracking-widest text-center">Risk Score</th>
                <th className="px-6 py-3.5 text-[11px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">AI Status</th>
                <th className="px-6 py-3.5 text-[11px] font-bold text-[var(--text-secondary)] uppercase tracking-widest text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)]">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-sm text-[var(--text-muted)]">Loading registry...</td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <Users className="w-8 h-8 text-[var(--border-strong)] mb-3" />
                      <p className="text-sm font-semibold text-[var(--text-secondary)]">No patients found</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map(patient => {
                  const risk = (patient.risk_level || 'low').toLowerCase();
                  const riskBadge = risk === 'high' ? 'badge-danger' : risk === 'medium' ? 'badge-warning' : 'badge-healthy';
                  const fullName = `${patient.first_name} ${patient.last_name}`;
                  
                  return (
                    <tr key={patient.id} className="hover:bg-[var(--bg-panel-hover)] transition-colors group cursor-pointer" onClick={() => setSelectedPatientId(patient.id)}>
                      <td className="px-6 py-4">
                        <span className="font-mono text-xs font-semibold text-[var(--text-secondary)]">{patient.medical_record_number}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-[var(--border-strong)] flex items-center justify-center text-[10px] font-bold text-[var(--text-primary)]">
                            {patient.first_name[0]}{patient.last_name[0]}
                          </div>
                          <span className="text-sm font-bold text-[var(--text-primary)] group-hover:text-[var(--accent-primary)] transition-colors">{fullName}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-1.5">
                          {patient.chronic_conditions?.slice(0, 2).map((c: string) => (
                            <span key={c} className="badge badge-neutral text-[10px] bg-transparent">{c}</span>
                          ))}
                          {(patient.chronic_conditions?.length || 0) > 2 && (
                            <span className="text-[10px] font-semibold text-[var(--text-muted)]">+{patient.chronic_conditions.length - 2}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`badge ${riskBadge}`}>{risk}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--text-muted)]">
                          <Activity className="w-3.5 h-3.5" /> Monitored
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button className="text-[var(--accent-primary)] opacity-0 group-hover:opacity-100 transition-opacity p-1.5 hover:bg-[var(--accent-primary)]/10 rounded-md">
                          <ChevronRight className="w-5 h-5" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
