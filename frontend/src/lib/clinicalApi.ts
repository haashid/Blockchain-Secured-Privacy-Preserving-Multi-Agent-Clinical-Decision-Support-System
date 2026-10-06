import { request } from './api';

/**
 * Clinical-facing API client.
 *
 * The backend exposes *clinical reviews* over the internal Task/Run entities,
 * so the UI never has to speak in "tasks" or "runs".
 */

export interface ClinicalPatient {
  id: string;
  first_name: string;
  last_name: string;
  medical_record_number?: string | null;
  date_of_birth?: string | null;
  gender?: string | null;
  blood_type?: string | null;
  allergies?: string[] | null;
  chronic_conditions?: string[] | null;
  risk_level?: string | null;
}

export type ReviewStatus =
  | 'CREATED'
  | 'AUTHORIZING'
  | 'AUTHORIZED'
  | 'RUNNING'
  | 'REANALYZING'
  | 'VERIFYING'
  | 'READY_FOR_REVIEW'
  | 'REVIEWED'
  | 'FAILED'
  | 'WARNING';

export interface ClinicalReview {
  id: string;
  run_id: string | null;
  title: string;
  purpose: string | null;
  status: ReviewStatus;
  workflow_status?: string | null;
  created_at: string | null;
  completed_at: string | null;
  patient: ClinicalPatient | null;
  patient_context: any;
  selected_agents: string[];
  executed_agents: string[];
  failed_agents: string[];
  revised_agents: string[];
  reasoning_rounds: number;
  critic_interventions: number;
  supervisor_plan: any;
  consensus: any;
  latency_ms: number | null;
  integrity: string | null;
  blockchain: string | null;
  runs: { id: string; status: string; started_at: string | null; completed_at: string | null }[];
}

export interface ReviewSummary {
  id: string;
  title: string;
  status: string;
  created_at: string | null;
  purpose?: string | null;
  chief_complaint?: string | null;
  patient_id?: string | null;
  created_by?: string | null;
}

export interface AgentExecution {
  agent_id: string;
  role: string;
  status: 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'RETRYING' | 'REANALYZING';
  confidence: number | null;
  output: any;
  revised: boolean;
}

export interface EvidenceItem {
  evidence_id: string;
  document_id?: string;
  chunk_id?: string;
  title?: string;
  source?: string;
  page?: number | null;
  section?: string | null;
  text?: string;
  retrieval_score?: number | null;
  rerank_score?: number | null;
}

export interface ClaimLink {
  claim: string;
  evidence_ids: string[];
  rationale?: string;
}

export interface EvidencePayload {
  evidence_items: EvidenceItem[];
  supported_claims: ClaimLink[];
  unsupported_claims: any[];
  knowledge_gaps: string[];
  insufficient_evidence: boolean;
  knowledge_base_version?: string | null;
  confidence?: number | null;
}

export interface ReviewReport {
  review_id: string;
  synthesis: any;
  critic: any;
  verifier: any;
  specialists: Record<string, any>;
  consensus: any;
  workflow_status?: string | null;
}

export interface ProvenanceProof {
  proof_id: string;
  agent_id: string;
  agent_role: string;
  hash: string;
  hash_algorithm: string;
  storage_ref: string | null;
  fabric_tx_id: string | null;
  fabric_block_number: number | null;
  fabric_ledger_status: string | null;
  status: string;
  confidence: number | null;
  created_at: string | null;
}

export interface VerificationResult {
  proof_id: string;
  verified: boolean;
  computed_hash: string | null;
  blockchain_hash: string | null;
  hash_algorithm: string;
  checks: any;
  failures: string[];
  verified_at: string | null;
}

export interface ConsentPolicy {
  patient_id: string;
  allowed_roles: string[];
  allowed_organizations: string[];
  emergency_breakglass: boolean;
  explicit: boolean;
  notes: string | null;
  updated_at: string | null;
}

export interface AccessRecord {
  id: string;
  timestamp: string | null;
  actor: string;
  action: string;
  resource: string;
  status: 'Allowed' | 'Denied';
  task_id: string | null;
  details: any;
}

export const clinicalApi = {
  start: (data: {
    patient_id: string;
    purpose: string;
    chief_complaint: string;
    symptoms: string[];
    vitals?: Record<string, any> | null;
  }) =>
    request<{ clinical_review_id: string; run_id: string; status: string; purpose: string }>(
      '/clinical-reviews',
      { method: 'POST', body: JSON.stringify(data) },
    ),

  list: () => request<{ active: ReviewSummary[]; mine: ReviewSummary[] }>('/clinical-reviews'),
  active: (limit = 25) => request<ReviewSummary[]>(`/clinical-reviews/active?limit=${limit}`),
  forPatient: (patientId: string) =>
    request<ReviewSummary[]>(`/clinical-reviews/patient/${patientId}`),

  get: (id: string) => request<ClinicalReview>(`/clinical-reviews/${id}`),
  agents: (id: string) => request<AgentExecution[]>(`/clinical-reviews/${id}/agents`),
  evidence: (id: string) => request<EvidencePayload>(`/clinical-reviews/${id}/evidence`),
  report: (id: string) => request<ReviewReport>(`/clinical-reviews/${id}/report`),
  security: (id: string) =>
    request<{ consent_policy: ConsentPolicy | null; consent_events: any[]; authorization_enforced: boolean }>(
      `/clinical-reviews/${id}/security`,
    ),
  provenance: (id: string) =>
    request<{ proofs: ProvenanceProof[]; count: number }>(`/clinical-reviews/${id}/provenance`),
  verification: (id: string) => request<VerificationResult[]>(`/clinical-reviews/${id}/verification`),
  audit: (id: string) => request<any[]>(`/clinical-reviews/${id}/audit`),
};

export const privacyApi = {
  consent: (patientId: string) => request<ConsentPolicy>(`/privacy/consent/${patientId}`),
  updateConsent: (
    patientId: string,
    data: {
      allowed_roles?: string[];
      allowed_organizations?: string[];
      emergency_breakglass?: boolean;
      notes?: string;
    },
  ) =>
    request<ConsentPolicy>(`/privacy/consent/${patientId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  accessHistory: (patientId: string) =>
    request<AccessRecord[]>(`/privacy/access-history/${patientId}`),
  availableRoles: () => request<{ roles: string[] }>('/privacy/available-roles'),
};

export const REVIEW_PURPOSES = [
  { value: 'Clinical case review', label: 'Clinical Case Review', description: 'Full multi-specialist diagnostic reasoning' },
  { value: 'Risk assessment', label: 'Risk Assessment', description: 'Urgency, deterioration risk and safety gaps' },
  { value: 'Medication safety review', label: 'Medication Safety Review', description: 'Interactions, allergies and contraindications' },
  { value: 'Laboratory review', label: 'Laboratory Review', description: 'Lab interpretation, abnormality and trend analysis' },
] as const;

export const REVIEW_STATUS_META: Record<string, { label: string; tone: string }> = {
  CREATED: { label: 'Created', tone: 'badge-neutral' },
  AUTHORIZING: { label: 'Authorizing', tone: 'badge-warning' },
  AUTHORIZED: { label: 'Authorized', tone: 'badge-healthy' },
  RUNNING: { label: 'Reviewing', tone: 'badge-warning' },
  REANALYZING: { label: 'Re-analysis', tone: 'badge-warning' },
  VERIFYING: { label: 'Verifying', tone: 'badge-warning' },
  READY_FOR_REVIEW: { label: 'Ready for review', tone: 'badge-healthy' },
  REVIEWED: { label: 'Reviewed', tone: 'badge-healthy' },
  FAILED: { label: 'Failed', tone: 'badge-danger' },
  WARNING: { label: 'Needs attention', tone: 'badge-warning' },
  pending: { label: 'Queued', tone: 'badge-neutral' },
  running: { label: 'Reviewing', tone: 'badge-warning' },
  completed: { label: 'Ready for review', tone: 'badge-healthy' },
  failed: { label: 'Failed', tone: 'badge-danger' },
};

export function reviewStatusTone(status: string | null | undefined): string {
  if (!status) return 'badge-neutral';
  return (REVIEW_STATUS_META[status] || { tone: 'badge-neutral' }).tone;
}

export function reviewStatusLabel(status: string | null | undefined): string {
  if (!status) return 'Unknown';
  return (REVIEW_STATUS_META[status] || { label: status }).label;
}
