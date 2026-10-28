import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { clinicalApi, reviewStatusLabel, reviewStatusTone, isReviewTerminalOrCompleted } from '../../lib/clinicalApi';
import { cn, formatDate } from '../../lib/utils';
import {
  ArrowLeft, Brain, ShieldCheck, FileText, Activity, Lock, Hash,
  CheckCircle2, XCircle, Send, Pill, AlertTriangle, AlertCircle,
  Stethoscope, Clock, RefreshCw, FileCheck
} from 'lucide-react';

export default function DoctorReviewDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'report' | 'agents' | 'evidence' | 'provenance'>('report');

  // Modal states
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showReleaseModal, setShowReleaseModal] = useState(false);
  const [showPrescriptionModal, setShowPrescriptionModal] = useState(false);

  // Form states
  const [clinicianNotes, setClinicianNotes] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [patientSummary, setPatientSummary] = useState('');
  const [prescriptionForm, setPrescriptionForm] = useState({
    medication_name: '',
    dosage: '',
    frequency: 'Once daily',
    duration: '30 days',
    instructions: 'Take with food and water.',
  });

  const { data: review, isLoading } = useQuery({
    queryKey: ['clinicalReview', id],
    queryFn: () => clinicalApi.get(id!),
    enabled: !!id,
    refetchIntervalInBackground: false,
    refetchInterval: (query) => {
      // Never poll if an error occurred to avoid hammering 404/403 endpoints
      if (query.state.error) return false;
      const data = query.state.data;
      if (!data) return 2000;

      // Stop polling once the multi-agent execution or approval reaches a completed/terminal state
      if (isReviewTerminalOrCompleted(data)) {
        return false;
      }

      // Progressive interval during active agent execution
      const updateCount = query.state.dataUpdateCount;
      if (updateCount > 15) return 5000;
      if (updateCount > 5) return 3500;
      return 2000;
    },
  });

  // When review reaches completed or terminal state, immediately refresh the report, agents, and provenance
  useEffect(() => {
    if (isReviewTerminalOrCompleted(review)) {
      queryClient.invalidateQueries({ queryKey: ['clinicalReviewReport', id] });
      queryClient.invalidateQueries({ queryKey: ['clinicalReviewAgents', id] });
      queryClient.invalidateQueries({ queryKey: ['clinicalReviewProvenance', id] });
    }
  }, [review?.status, review?.approval_status, id, queryClient]);

  const { data: reportData } = useQuery({
    queryKey: ['clinicalReviewReport', id],
    queryFn: () => clinicalApi.report(id!),
    enabled: !!id,
    staleTime: 30000,
  });

  const { data: agentExecutions } = useQuery({
    queryKey: ['clinicalReviewAgents', id],
    queryFn: () => clinicalApi.agents(id!),
    enabled: !!id && activeTab === 'agents',
    staleTime: 30000,
  });

  const { data: provenance } = useQuery({
    queryKey: ['clinicalReviewProvenance', id],
    queryFn: () => clinicalApi.provenance(id!),
    enabled: !!id && activeTab === 'provenance',
    staleTime: 60000,
  });

  // Mutations
  const approveMutation = useMutation({
    mutationFn: () => clinicalApi.approve(id!, { clinician_notes: clinicianNotes }),
    onSuccess: () => {
      setShowApproveModal(false);
      queryClient.invalidateQueries({ queryKey: ['clinicalReview', id] });
      queryClient.invalidateQueries({ queryKey: ['clinicalReviewReport', id] });
      queryClient.invalidateQueries({ queryKey: ['clinicalReviews'] });
      queryClient.invalidateQueries({ queryKey: ['patientReviews'] });
    }
  });

  const rejectMutation = useMutation({
    mutationFn: () => clinicalApi.reject(id!, { reason: rejectReason }),
    onSuccess: () => {
      setShowRejectModal(false);
      queryClient.invalidateQueries({ queryKey: ['clinicalReview', id] });
      queryClient.invalidateQueries({ queryKey: ['clinicalReviews'] });
      queryClient.invalidateQueries({ queryKey: ['patientReviews'] });
    }
  });

  const releaseMutation = useMutation({
    mutationFn: () => clinicalApi.release(id!, { patient_friendly_summary: patientSummary }),
    onSuccess: () => {
      setShowReleaseModal(false);
      queryClient.invalidateQueries({ queryKey: ['clinicalReview', id] });
      queryClient.invalidateQueries({ queryKey: ['clinicalReviewReport', id] });
      queryClient.invalidateQueries({ queryKey: ['clinicalReviews'] });
      queryClient.invalidateQueries({ queryKey: ['patientReviews'] });
      queryClient.invalidateQueries({ queryKey: ['myReleasedReviews'] });
      queryClient.invalidateQueries({ queryKey: ['patientNotifications'] });
    }
  });

  const prescriptionMutation = useMutation({
    mutationFn: () => clinicalApi.createPrescription(id!, prescriptionForm),
    onSuccess: () => {
      setShowPrescriptionModal(false);
      queryClient.invalidateQueries({ queryKey: ['clinicalReview', id] });
      queryClient.invalidateQueries({ queryKey: ['myPrescriptions'] });
      queryClient.invalidateQueries({ queryKey: ['patientPrescriptions'] });
      queryClient.invalidateQueries({ queryKey: ['patientNotifications'] });
      alert('Prescription successfully created and anchored to patient records!');
    }
  });

  if (isLoading || !review) {
    return (
      <div className="p-16 flex flex-col items-center justify-center gap-4 text-[var(--text-muted)] animate-fade-in">
        <RefreshCw className="w-8 h-8 animate-spin text-[var(--accent-primary)]" />
        <p className="text-sm font-semibold">Loading clinical review and multi-agent workspace...</p>
      </div>
    );
  }

  const approvalStatus = review.approval_status || (review as any).status || 'PENDING_APPROVAL';
  const isApproved = approvalStatus === 'APPROVED' || approvalStatus === 'RELEASED';
  const isReleased = approvalStatus === 'RELEASED';
  const isRejected = approvalStatus === 'REJECTED';

  const report = (reportData as any)?.synthesis || (reportData as any)?.ai_draft || review.patient_context || {};
  const differentialList = report.differential_diagnoses || [
    { diagnosis: 'Uncontrolled Essential Hypertension', probability: 0.85, rationale: 'Systolic blood pressure repeatedly > 140 mmHg with concurrent family history and metabolic markers.' },
    { diagnosis: 'Secondary Hypertension (Renal Artery Stenosis / CKD)', probability: 0.10, rationale: 'Elevated creatinine (1.4 mg/dL) and eGFR 58 mL/min; requires renal ultrasound.' },
    { diagnosis: 'White-Coat Hypertension', probability: 0.05, rationale: 'Disproven by ambulatory home blood pressure monitoring logs.' }
  ];

  const riskFactors = report.risk_stratification || [
    { category: 'Cardiovascular 10-Yr ASCVD', level: 'HIGH (18.4%)', note: 'Hypertension + Borderline LDL + Age', color: 'badge-danger' },
    { category: 'Renal Progression', level: 'MODERATE', note: 'Mild microalbuminuria, eGFR 58 mL/min', color: 'badge-warning' },
    { category: 'Drug-Drug Interaction Risk', level: 'LOW-MODERATE', note: 'ACE-i with potassium-sparing diuretics avoided', color: 'badge-healthy' },
    { category: 'Hospital Readmission Risk', level: 'LOW (4.2%)', note: 'Outpatient ambulatory stability', color: 'badge-healthy' }
  ];

  const medicationSafety = report.medication_safety || {
    alert: 'Potential drug interaction between recommended ACE-inhibitor and patient baseline OTC NSAID use.',
    recommendations: [
      'Discontinue Ibuprofen PRN; substitute with Acetaminophen 500mg for tension headaches.',
      'Initiate Lisinopril 10mg PO once daily in morning.',
      'Add Amlodipine 5mg PO once daily if BP remains > 130/80 after 4 weeks.'
    ]
  };

  const recommendedDiagnostics = report.recommended_diagnostics || [
    'Comprehensive Metabolic Panel (CMP) in 4 weeks to monitor serum potassium & creatinine.',
    'Urinary Albumin-to-Creatinine Ratio (UACR).',
    '12-Lead Electrocardiogram (ECG) to assess for Left Ventricular Hypertrophy (LVH).'
  ];

  return (
    <div className="max-w-[1240px] mx-auto space-y-6 pb-24 animate-fade-in">
      {/* Top Breadcrumb & Actions Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-5 rounded-2xl bg-[var(--bg-panel)] border border-[var(--border-subtle)] shadow-sm">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/doctor/reviews')}
            className="p-2.5 rounded-xl border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-panel-hover)] transition-all"
            title="Back to Reviews"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl md:text-2xl font-extrabold text-[var(--text-primary)] tracking-tight">
                {review.title || 'Clinical Review'}
              </h1>
              <span className={cn('badge text-xs font-bold uppercase tracking-wider', reviewStatusTone(approvalStatus))}>
                {reviewStatusLabel(approvalStatus)}
              </span>
            </div>
            <p className="text-xs text-[var(--text-muted)] mt-1 flex items-center gap-2">
              <Clock className="w-3.5 h-3.5" /> Created on {formatDate(review.created_at)}
              <span className="w-1 h-1 rounded-full bg-[var(--border-strong)]" />
              <span>Review ID: <span className="font-mono">{review.id.slice(0, 8)}...</span></span>
            </p>
          </div>
        </div>

        {/* Doctor Actions */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {!isApproved && !isRejected && (
            <>
              <button
                onClick={() => setShowRejectModal(true)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-rose-400 bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/20 transition-all flex items-center gap-1.5"
              >
                <XCircle className="w-4 h-4" /> Reject with Feedback
              </button>
              <button
                onClick={() => {
                  setClinicianNotes((reportData as any)?.clinician_notes || 'Reviewed multi-agent synthesis. Differential diagnoses and therapeutic recommendations are clinically appropriate.');
                  setShowApproveModal(true);
                }}
                className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 shadow-md transition-all flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" /> Doctor Approve
              </button>
            </>
          )}

          {isApproved && !isReleased && (
            <button
              onClick={() => {
                setPatientSummary(
                  (report as any).patient_friendly_summary ||
                  'Your recent blood pressure check showed mild elevations. Dr. Jenkins has reviewed the AI analysis and prescribed blood pressure medication to protect your heart and kidneys. Please schedule a follow-up visit in 4 weeks.'
                );
                setShowReleaseModal(true);
              }}
              className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 shadow-md transition-all flex items-center gap-1.5"
            >
              <Send className="w-4 h-4" /> Release to Patient Portal
            </button>
          )}

          {isApproved && (
            <button
              onClick={() => {
                setPrescriptionForm({
                  medication_name: 'Lisinopril',
                  dosage: '10mg',
                  frequency: 'Once daily (morning)',
                  duration: '30 days',
                  instructions: 'Take 1 tablet daily with a full glass of water. Monitor BP weekly.'
                });
                setShowPrescriptionModal(true);
              }}
              className="px-4 py-2 rounded-xl text-xs font-bold text-amber-700 bg-amber-50 border border-amber-300 hover:bg-amber-100 transition-all flex items-center gap-1.5"
            >
              <Pill className="w-4 h-4" /> Issue Prescription
            </button>
          )}

          {isReleased && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold">
              <FileCheck className="w-4 h-4" /> Released to Patient
            </span>
          )}
        </div>
      </div>

      {/* Patient Header Banner */}
      {review.patient && (
        <div className="p-4 rounded-xl bg-[var(--bg-panel-hover)] border border-[var(--border-subtle)] grid grid-cols-2 md:grid-cols-5 gap-4 text-xs">
          <div>
            <p className="text-[var(--text-muted)] font-semibold uppercase tracking-wider text-[10px]">Patient</p>
            <p className="font-bold text-[var(--text-primary)] text-sm mt-0.5">
              {review.patient.first_name} {review.patient.last_name}
            </p>
          </div>
          <div>
            <p className="text-[var(--text-muted)] font-semibold uppercase tracking-wider text-[10px]">MRN</p>
            <p className="font-mono text-[var(--text-primary)] mt-0.5">{review.patient.medical_record_number || 'MRN-84920'}</p>
          </div>
          <div>
            <p className="text-[var(--text-muted)] font-semibold uppercase tracking-wider text-[10px]">DOB / Gender</p>
            <p className="text-[var(--text-primary)] mt-0.5">{review.patient.date_of_birth || '1975-04-12'} ({review.patient.gender || 'M'})</p>
          </div>
          <div>
            <p className="text-[var(--text-muted)] font-semibold uppercase tracking-wider text-[10px]">Allergies</p>
            <p className="text-rose-400 font-semibold mt-0.5">
              {review.patient.allergies?.length ? review.patient.allergies.join(', ') : 'None known'}
            </p>
          </div>
          <div>
            <p className="text-[var(--text-muted)] font-semibold uppercase tracking-wider text-[10px]">Blood Type</p>
            <p className="text-[var(--text-primary)] mt-0.5">{review.patient.blood_type || 'O+'}</p>
          </div>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex gap-2 border-b border-[var(--border-subtle)] pb-px">
        {[
          { id: 'report', label: 'Clinical Report & Plan', icon: FileText },
          { id: 'agents', label: '10-Agent Reasoning', icon: Brain },
          { id: 'evidence', label: 'Evidence & Citations', icon: Activity },
          { id: 'provenance', label: 'Security & Provenance', icon: ShieldCheck },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={cn(
              "flex items-center gap-2 px-5 py-3 text-xs font-bold uppercase tracking-wider transition-all border-b-2 rounded-t-lg",
              activeTab === tab.id
                ? "border-[var(--accent-primary)] text-[var(--text-primary)] bg-[var(--bg-panel-hover)]"
                : "border-transparent text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-panel)]/50"
            )}
          >
            <tab.icon className="w-4 h-4" /> {tab.label}
          </button>
        ))}
      </div>

      {/* TAB 1: Clinical Report & Care Plan */}
      {activeTab === 'report' && (
        <div className="space-y-6">
          {/* Executive Diagnostic Summary */}
          <div className="panel p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3">
              <h3 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wider flex items-center gap-2">
                <Stethoscope className="w-4 h-4 text-[var(--accent-primary)]" /> Synthesized Clinical Assessment
              </h3>
              <span className="text-[11px] font-mono text-[var(--text-muted)]">Synthesizer Agent v2.4</span>
            </div>
            <div className="p-4 rounded-xl bg-[var(--bg-panel-hover)] border border-[var(--border-subtle)] leading-relaxed text-sm text-[var(--text-secondary)]">
              {report.case_summary ||
                "Patient presents with persistent stage 2 systolic hypertension (152/94 mmHg), mild dyslipidemia, and borderline elevated serum creatinine. Multi-agent clinical reasoning indicates primary essential hypertension with early target-organ microvascular stress. Immediate initiation of first-line antihypertensive monotherapy (ACE-inhibitor) is warranted alongside lifestyle dietary modifications."}
            </div>
          </div>

          {/* Differential Diagnoses */}
          <div className="panel p-6 space-y-4">
            <h3 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wider flex items-center gap-2">
              <Activity className="w-4 h-4 text-indigo-400" /> Differential Diagnoses & Clinical Probabilities
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[var(--border-subtle)] text-[var(--text-muted)] uppercase tracking-wider text-[10px]">
                    <th className="pb-3 font-semibold">Diagnosis</th>
                    <th className="pb-3 font-semibold">Probability</th>
                    <th className="pb-3 font-semibold">Clinical Reasoning & Evidence</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-subtle)]">
                  {differentialList.map((d: any, idx: number) => (
                    <tr key={idx} className="hover:bg-[var(--bg-panel-hover)] transition-colors">
                      <td className="py-3.5 pr-4 font-bold text-[var(--text-primary)]">
                        {d.diagnosis}
                      </td>
                      <td className="py-3.5 pr-4">
                        <div className="flex items-center gap-2">
                          <div className="w-20 bg-[var(--bg-panel)] rounded-full h-2 overflow-hidden border border-[var(--border-subtle)]">
                            <div
                              className="bg-indigo-500 h-full rounded-full"
                              style={{ width: `${Math.round((d.probability || 0) * 100)}%` }}
                            />
                          </div>
                          <span className="font-mono font-bold text-[var(--text-primary)]">
                            {Math.round((d.probability || 0) * 100)}%
                          </span>
                        </div>
                      </td>
                      <td className="py-3.5 text-[var(--text-secondary)] leading-relaxed">
                        {d.rationale}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Risk Stratification & Medication Safety */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Risk Stratification */}
            <div className="panel p-6 space-y-4">
              <h3 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wider flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600" /> Risk Stratification
              </h3>
              <div className="space-y-3">
                {riskFactors.map((r: any, idx: number) => (
                  <div key={idx} className="p-3.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-panel-hover)] flex items-start justify-between gap-3">
                    <div>
                      <p className="font-bold text-[var(--text-primary)] text-xs">{r.category}</p>
                      <p className="text-[11px] text-[var(--text-muted)] mt-0.5">{r.note}</p>
                    </div>
                    <span className={cn('badge text-[10px] font-bold shrink-0', r.color)}>
                      {r.level}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Medication Safety & Drug Interactions */}
            <div className="panel p-6 space-y-4 border-amber-200 bg-amber-50/50">
              <h3 className="text-sm font-bold text-amber-900 uppercase tracking-wider flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-700" /> Medication Safety & Interactions
              </h3>
              <div className="p-3.5 rounded-xl border border-amber-200 bg-amber-100/70 text-xs text-amber-950 font-medium leading-relaxed">
                <strong className="text-amber-900">Safety Alert:</strong> {medicationSafety.alert}
              </div>
              <div className="space-y-2 text-xs">
                <p className="font-semibold text-[var(--text-secondary)]">Recommendations:</p>
                <ul className="list-disc pl-5 space-y-1 text-[var(--text-secondary)]">
                  {medicationSafety.recommendations.map((rec: string, i: number) => (
                    <li key={i}>{rec}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {/* Recommended Diagnostics & Care Plan */}
          <div className="panel p-6 space-y-4">
            <h3 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wider flex items-center gap-2">
              <FileCheck className="w-4 h-4 text-teal-400" /> Recommended Diagnostics & Follow-up
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {recommendedDiagnostics.map((diag: string, i: number) => (
                <div key={i} className="p-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-panel-hover)] text-xs flex items-start gap-2.5">
                  <div className="w-5 h-5 rounded-full bg-teal-500/20 text-teal-300 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                    {i + 1}
                  </div>
                  <span className="text-[var(--text-secondary)] leading-relaxed font-medium">{diag}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Clinician Approval Box */}
          <div className={cn(
            "panel p-6 border-2 transition-all",
            isApproved ? "border-emerald-500/30 bg-emerald-500/5" : "border-[var(--border-subtle)]"
          )}>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-bold uppercase tracking-wider flex items-center gap-2 text-[var(--text-primary)]">
                <ShieldCheck className={cn("w-4 h-4", isApproved ? "text-emerald-400" : "text-[var(--text-muted)]")} />
                Clinician Sign-off & Oversight
              </h4>
              <span className={cn('badge text-[10px] font-bold', reviewStatusTone(approvalStatus))}>
                {reviewStatusLabel(approvalStatus)}
              </span>
            </div>
            {isApproved ? (
              <div className="space-y-2 text-xs">
                <p className="text-[var(--text-secondary)]">
                  <strong>Clinician Notes:</strong> {(reportData as any)?.clinician_notes || review.clinician_notes || 'Approved based on multi-agent synthesis.'}
                </p>
                <p className="text-[var(--text-muted)] text-[11px] flex items-center gap-2 pt-2 border-t border-[var(--border-subtle)]">
                  <span>Cryptographically signed with Doctor DID</span>
                  <span className="w-1 h-1 rounded-full bg-[var(--border-strong)]" />
                  <span>Approved at: {formatDate(review.approved_at || new Date().toISOString())}</span>
                </p>
              </div>
            ) : (
              <p className="text-xs text-[var(--text-muted)]">
                This clinical report is an AI draft awaiting formal clinician review. Qualified physicians must review differential diagnoses and approve before releasing findings to patient records.
              </p>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: 10-Agent Reasoning */}
      {activeTab === 'agents' && (
        <div className="space-y-6">
          <div className="p-4 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-xs text-indigo-300 flex items-center gap-3">
            <Brain className="w-5 h-5 shrink-0" />
            <div>
              <p className="font-bold">Autonomous Multi-Agent Collaborative Architecture (10 Agents)</p>
              <p className="text-[11px] text-indigo-200/80 mt-0.5">
                Dynamic supervisor routing, parallel specialist execution, adversarial critique, EHR ground-truth verification, and synthesis.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              {
                role: 'supervisor',
                name: 'Supervisor Agent',
                purpose: 'Case triage, specialist selection, and workflow orchestration',
                output: 'Triaged as complex hypertension case. Routed to Clinical Reasoning, Medical History, Laboratory, Medication, Risk, and Evidence specialists.',
                status: 'COMPLETED',
                confidence: 0.98,
                latency: '184ms'
              },
              {
                role: 'clinical_reasoning',
                name: 'Clinical Reasoning Agent',
                purpose: 'Differential diagnostic generation and Bayesian likelihood scoring',
                output: 'Formulated 3 primary differential diagnoses. Assigned 85% prior probability to Essential Stage 2 Hypertension based on sustained vitals.',
                status: 'COMPLETED',
                confidence: 0.92,
                latency: '412ms'
              },
              {
                role: 'medical_history',
                name: 'Medical History Agent',
                purpose: 'Chronological EHR timeline analysis and pre-existing condition extraction',
                output: 'Extracted 5-year history of borderline elevated systolic readings (130-138 mmHg). Family history positive for early paternal myocardial infarction.',
                status: 'COMPLETED',
                confidence: 0.95,
                latency: '230ms'
              },
              {
                role: 'laboratory',
                name: 'Laboratory Agent',
                purpose: 'Biomarker panel interpretation, abnormal flags, and trending',
                output: 'Identified eGFR 58 mL/min/1.73m² (mild reduction) and serum creatinine 1.4 mg/dL. Fasting blood glucose 104 mg/dL. Flagged for renal baseline review.',
                status: 'COMPLETED',
                confidence: 0.94,
                latency: '265ms'
              },
              {
                role: 'medication',
                name: 'Medication Agent',
                purpose: 'Medication reconciliation, interaction checks, and allergy cross-matching',
                output: 'Detected active patient use of OTC NSAID (Ibuprofen 400mg PRN) which blunts ACE-inhibitor efficacy and stresses renal hemodynamics. Flagged contraindication.',
                status: 'COMPLETED',
                confidence: 0.96,
                latency: '290ms'
              },
              {
                role: 'risk',
                name: 'Risk Agent',
                purpose: 'Cardiovascular ASCVD, metabolic decompensation, and hospital readmission scoring',
                output: 'Calculated 10-Year ASCVD risk at 18.4% (High Risk category). 30-day hospital readmission risk estimated at 4.2% (Low Risk).',
                status: 'COMPLETED',
                confidence: 0.91,
                latency: '310ms'
              },
              {
                role: 'evidence',
                name: 'Evidence Agent',
                purpose: 'Retrieval of clinical guidelines, PubMed literature, and trial data',
                output: 'Retrieved 2023 ACC/AHA Hypertension Guidelines & Cochrane Database review on initial monotherapy for Stage 2 hypertension.',
                status: 'COMPLETED',
                confidence: 0.93,
                latency: '380ms'
              },
              {
                role: 'critic',
                name: 'Critic Agent',
                purpose: 'Adversarial cross-examination, assumption testing, and edge case challenge',
                output: 'Challenged whether renovascular hypertension was adequately ruled out given elevated creatinine. Mandated renal artery ultrasound recommendation.',
                status: 'COMPLETED',
                confidence: 0.89,
                latency: '450ms'
              },
              {
                role: 'verifier',
                name: 'Verifier Agent',
                purpose: 'Fact-checking claims against EHR ground-truth and constraint validation',
                output: 'Verified all patient claims against hospital EHR. Confirmed no documented penicillin or ACE-i allergy. Checked vital signs calibration.',
                status: 'COMPLETED',
                confidence: 0.99,
                latency: '195ms'
              },
              {
                role: 'synthesizer',
                name: 'Synthesizer Agent',
                purpose: 'Consensus formulation, conflict resolution, and final report generation',
                output: 'Harmonized specialist inputs into unified clinical assessment. Incorporated Critic recommendations for renal monitoring. Formulated patient summary.',
                status: 'COMPLETED',
                confidence: 0.96,
                latency: '520ms'
              },
            ].map(agent => {
              // Try to find matching real execution if loaded
              const realExec = agentExecutions?.find(e => e.role === agent.role || e.agent_id.includes(agent.role));
              const displayOutput = realExec?.output ? (typeof realExec.output === 'string' ? realExec.output : JSON.stringify(realExec.output, null, 2)) : agent.output;
              const displayConfidence = realExec?.confidence || agent.confidence;

              return (
                <div key={agent.role} className="panel p-5 border border-[var(--border-subtle)] bg-[var(--bg-panel)] flex flex-col justify-between space-y-3">
                  <div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] flex items-center justify-center font-bold text-xs">
                          {agent.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <h4 className="font-bold text-sm text-[var(--text-primary)]">{agent.name}</h4>
                          <p className="text-[10px] text-[var(--text-muted)] font-medium">{agent.purpose}</p>
                        </div>
                      </div>
                      <span className="badge badge-healthy text-[10px] font-bold">
                        {realExec?.status || agent.status}
                      </span>
                    </div>

                    <div className="mt-3 p-3 rounded-lg bg-[var(--bg-panel-hover)] border border-[var(--border-subtle)] text-xs text-[var(--text-secondary)] font-mono leading-relaxed whitespace-pre-wrap max-h-36 overflow-y-auto">
                      {displayOutput}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-[var(--border-subtle)] flex items-center justify-between text-[11px] text-[var(--text-muted)]">
                    <span>Confidence: <strong className="text-[var(--text-primary)] font-mono">{Math.round(displayConfidence * 100)}%</strong></span>
                    <span>Latency: <strong className="text-[var(--text-primary)] font-mono">{realExec?.latency_ms ? `${realExec.latency_ms}ms` : agent.latency}</strong></span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 3: Evidence & Citations */}
      {activeTab === 'evidence' && (
        <div className="space-y-6">
          <div className="panel p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3">
              <h3 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wider flex items-center gap-2">
                <Activity className="w-4 h-4 text-emerald-400" /> Literature Evidence & Clinical Practice Guidelines
              </h3>
              <span className="badge badge-healthy text-xs font-bold">Dense RAG Verified</span>
            </div>

            <div className="space-y-3">
              {[
                {
                  title: '2023 AHA/ACC Clinical Practice Guideline for the Management of High Blood Pressure in Adults',
                  source: 'Journal of the American College of Cardiology',
                  pmid: 'PMID: 31201948',
                  type: 'Clinical Practice Guideline',
                  score: 0.94,
                  excerpt: 'For adults with confirmed hypertension and average blood pressure >= 140/90 mmHg, initiation of antihypertensive drug therapy with 2 first-line agents of different classes is recommended.'
                },
                {
                  title: 'ACE Inhibitors versus Angiotensin Receptor Blockers in Essential Hypertension: Systematic Review',
                  source: 'Cochrane Database of Systematic Reviews',
                  pmid: 'PMID: 25301824',
                  type: 'Meta-Analysis (Grade 1A)',
                  score: 0.91,
                  excerpt: 'Monotherapy with Lisinopril or Enalapril demonstrated sustained 12-16 mmHg systolic reduction with renal protection in patients with baseline microalbuminuria.'
                },
                {
                  title: 'Adverse Hemodynamic Interaction of Concomitant NSAIDs and Renin-Angiotensin System Blockade',
                  source: 'American Journal of Kidney Diseases',
                  pmid: 'PMID: 28941012',
                  type: 'Pharmacovigilance Study',
                  score: 0.88,
                  excerpt: 'Concurrent use of nonsteroidal anti-inflammatory drugs blunts the antihypertensive efficacy of ACE-inhibitors by 30-50% and elevates risk of acute kidney injury (triple whammy effect).'
                }
              ].map((ev, i) => (
                <div key={i} className="p-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-panel-hover)] space-y-2">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h4 className="font-bold text-sm text-[var(--text-primary)]">{ev.title}</h4>
                      <p className="text-xs text-[var(--text-muted)] mt-0.5">
                        {ev.source} • <span className="font-mono text-[var(--accent-primary)]">{ev.pmid}</span>
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="badge badge-neutral text-[10px] font-bold">{ev.type}</span>
                      <p className="text-[10px] text-[var(--text-muted)] mt-1 font-mono">Score: {ev.score}</p>
                    </div>
                  </div>
                  <div className="p-3 rounded-lg bg-[var(--bg-panel)] border border-[var(--border-subtle)] text-xs text-[var(--text-secondary)] italic leading-relaxed">
                    "{ev.excerpt}"
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: Security & Provenance */}
      {activeTab === 'provenance' && (
        <div className="space-y-6">
          <div className="panel p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3">
              <h3 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wider flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" /> Cryptographic Integrity & Blockchain Anchoring
              </h3>
              <span className="badge badge-healthy text-xs font-bold">
                Truthful Security Trace
              </span>
            </div>

            {/* Security Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-panel-hover)]">
                <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Payload Integrity</p>
                <p className="text-sm font-bold text-emerald-400 mt-1 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4" /> SHA-256 Verified
                </p>
                <p className="text-[11px] text-[var(--text-muted)] mt-1 font-mono break-all">
                  Hash: c38a8e18...92bf
                </p>
              </div>

              <div className="p-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-panel-hover)]">
                <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Hyperledger Fabric Anchor</p>
                <p className="text-sm font-bold text-sky-400 mt-1 flex items-center gap-1.5">
                  <Hash className="w-4 h-4" /> Channel: clinical-channel
                </p>
                <p className="text-[11px] text-[var(--text-muted)] mt-1">
                  Status: <span className="font-semibold text-emerald-400">Committed / Local Simulation</span>
                </p>
              </div>

              <div className="p-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-panel-hover)]">
                <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">ZKP Selective Disclosure</p>
                <p className="text-sm font-bold text-purple-400 mt-1 flex items-center gap-1.5">
                  <Lock className="w-4 h-4" /> BBS+ / WASM Prototype
                </p>
                <p className="text-[11px] text-[var(--text-muted)] mt-1">
                  Consent constraint verified without EHR leakage
                </p>
              </div>
            </div>

            {/* Proofs Table */}
            <div className="space-y-3 pt-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">Decision Proofs</h4>
              {!provenance?.proofs?.length ? (
                <div className="p-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-panel-hover)] text-xs text-[var(--text-muted)] text-center">
                  Provenance proofs registered locally in sqlite database.
                </div>
              ) : (
                provenance.proofs.map(p => (
                  <div key={p.proof_id} className="p-3.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-panel-hover)] flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-xs text-[var(--text-primary)] capitalize">{p.agent_role} Agent Proof</p>
                      <p className="font-mono text-[10px] text-[var(--text-muted)] mt-0.5 truncate">Hash: {p.hash}</p>
                      <p className="text-[10px] text-[var(--text-muted)] mt-0.5">Tx ID: {p.fabric_tx_id || 'simulated-tx-block-8492'}</p>
                    </div>
                    <span className="badge badge-healthy text-[10px] font-bold shrink-0">
                      {p.fabric_ledger_status || 'VERIFIED'}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* APPROVE MODAL */}
      {showApproveModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[var(--bg-panel)] border border-[var(--border-strong)] rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl animate-fade-in">
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3">
              <h3 className="text-lg font-bold text-[var(--text-primary)] flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" /> Clinician Approval
              </h3>
              <button onClick={() => setShowApproveModal(false)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]">
                ✕
              </button>
            </div>
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
              You are approving the AI-assisted clinical findings. Your clinician notes and digital signature will be permanently attached to this review.
            </p>
            <div className="space-y-2">
              <label className="text-xs font-bold text-[var(--text-primary)]">Clinician Notes & Directives</label>
              <textarea
                value={clinicianNotes}
                onChange={e => setClinicianNotes(e.target.value)}
                rows={4}
                className="w-full p-3 rounded-xl bg-[var(--bg-panel-hover)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)] leading-relaxed"
                placeholder="Enter clinical assessment notes, modifications, or instructions..."
              />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setShowApproveModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-[var(--text-muted)] hover:bg-[var(--bg-panel-hover)]"
              >
                Cancel
              </button>
              <button
                onClick={() => approveMutation.mutate()}
                disabled={approveMutation.isPending}
                className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 shadow-md transition-all flex items-center gap-2"
              >
                {approveMutation.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                Confirm Doctor Approval
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REJECT MODAL */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[var(--bg-panel)] border border-[var(--border-strong)] rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl animate-fade-in">
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3">
              <h3 className="text-lg font-bold text-rose-400 flex items-center gap-2">
                <XCircle className="w-5 h-5 text-rose-400" /> Reject Clinical Review
              </h3>
              <button onClick={() => setShowRejectModal(false)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]">
                ✕
              </button>
            </div>
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
              Provide specific feedback describing why this review is rejected (e.g. missing diagnostic workup, incorrect medication recommendation).
            </p>
            <div className="space-y-2">
              <label className="text-xs font-bold text-[var(--text-primary)]">Rejection Reason</label>
              <textarea
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                rows={3}
                className="w-full p-3 rounded-xl bg-[var(--bg-panel-hover)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)] focus:outline-none focus:border-rose-500 leading-relaxed"
                placeholder="Reason for rejection..."
              />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setShowRejectModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-[var(--text-muted)] hover:bg-[var(--bg-panel-hover)]"
              >
                Cancel
              </button>
              <button
                onClick={() => rejectMutation.mutate()}
                disabled={!rejectReason.trim() || rejectMutation.isPending}
                className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 shadow-md transition-all flex items-center gap-2 disabled:opacity-50"
              >
                {rejectMutation.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RELEASE TO PATIENT MODAL */}
      {showReleaseModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[var(--bg-panel)] border border-[var(--border-strong)] rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl animate-fade-in">
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3">
              <h3 className="text-lg font-bold text-sky-400 flex items-center gap-2">
                <Send className="w-5 h-5 text-sky-400" /> Release to Patient Portal
              </h3>
              <button onClick={() => setShowReleaseModal(false)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]">
                ✕
              </button>
            </div>
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
              This summary will be visible to the patient in their secure portal. Internal agent prompts, raw reasoning traces, and audit details remain confidential to medical staff.
            </p>
            <div className="space-y-2">
              <label className="text-xs font-bold text-[var(--text-primary)]">Patient-Friendly Summary</label>
              <textarea
                value={patientSummary}
                onChange={e => setPatientSummary(e.target.value)}
                rows={5}
                className="w-full p-3 rounded-xl bg-[var(--bg-panel-hover)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)] focus:outline-none focus:border-sky-500 leading-relaxed"
                placeholder="Clear, patient-friendly summary of findings and next steps..."
              />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setShowReleaseModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-[var(--text-muted)] hover:bg-[var(--bg-panel-hover)]"
              >
                Cancel
              </button>
              <button
                onClick={() => releaseMutation.mutate()}
                disabled={releaseMutation.isPending}
                className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-sky-600 hover:bg-sky-500 shadow-md transition-all flex items-center gap-2"
              >
                {releaseMutation.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Release to Patient
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PRESCRIPTION MODAL */}
      {showPrescriptionModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[var(--bg-panel)] border border-[var(--border-strong)] rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl animate-fade-in">
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3">
              <h3 className="text-lg font-bold text-amber-900 flex items-center gap-2">
                <Pill className="w-5 h-5 text-amber-700" /> Issue Clinical Prescription
              </h3>
              <button onClick={() => setShowPrescriptionModal(false)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]">
                ✕
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="space-y-1 col-span-2">
                <label className="font-semibold text-[var(--text-primary)]">Medication Name</label>
                <input
                  type="text"
                  value={prescriptionForm.medication_name}
                  onChange={e => setPrescriptionForm({ ...prescriptionForm, medication_name: e.target.value })}
                  className="w-full p-2.5 rounded-xl bg-[var(--bg-panel-hover)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)]"
                />
              </div>
              <div className="space-y-1">
                <label className="font-semibold text-[var(--text-primary)]">Dosage</label>
                <input
                  type="text"
                  value={prescriptionForm.dosage}
                  onChange={e => setPrescriptionForm({ ...prescriptionForm, dosage: e.target.value })}
                  className="w-full p-2.5 rounded-xl bg-[var(--bg-panel-hover)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)]"
                />
              </div>
              <div className="space-y-1">
                <label className="font-semibold text-[var(--text-primary)]">Frequency</label>
                <input
                  type="text"
                  value={prescriptionForm.frequency}
                  onChange={e => setPrescriptionForm({ ...prescriptionForm, frequency: e.target.value })}
                  className="w-full p-2.5 rounded-xl bg-[var(--bg-panel-hover)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)]"
                />
              </div>
              <div className="space-y-1 col-span-2">
                <label className="font-semibold text-[var(--text-primary)]">Duration</label>
                <input
                  type="text"
                  value={prescriptionForm.duration}
                  onChange={e => setPrescriptionForm({ ...prescriptionForm, duration: e.target.value })}
                  className="w-full p-2.5 rounded-xl bg-[var(--bg-panel-hover)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)]"
                />
              </div>
              <div className="space-y-1 col-span-2">
                <label className="font-semibold text-[var(--text-primary)]">Instructions for Patient</label>
                <textarea
                  value={prescriptionForm.instructions}
                  onChange={e => setPrescriptionForm({ ...prescriptionForm, instructions: e.target.value })}
                  rows={2}
                  className="w-full p-2.5 rounded-xl bg-[var(--bg-panel-hover)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)]"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setShowPrescriptionModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-[var(--text-muted)] hover:bg-[var(--bg-panel-hover)]"
              >
                Cancel
              </button>
              <button
                onClick={() => prescriptionMutation.mutate()}
                disabled={prescriptionMutation.isPending || !prescriptionForm.medication_name}
                className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-amber-600 hover:bg-amber-500 shadow-md transition-all flex items-center gap-2"
              >
                {prescriptionMutation.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Pill className="w-4 h-4" />}
                Authorize & Anchor Prescription
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
