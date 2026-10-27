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
  task_id?: string | null;
  title: string;
  purpose: string | null;
  chief_complaint?: string | null;
  approval_status?: string | null;
  approved_at?: string | null;
  clinician_notes?: string | null;
  status: ReviewStatus | string;
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
  approval_status?: string | null;
  created_at: string | null;
  purpose?: string | null;
  chief_complaint?: string | null;
  patient_id?: string | null;
  created_by?: string | null;
}

export interface AgentExecution {
  agent_id: string;
  role: string;
  status: 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'RETRYING' | 'REANALYZING' | string;
  confidence: number | null;
  output: any;
  revised: boolean;
  latency_ms?: number | null;
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
    request<{ clinical_review_id: string; run_id: string; task_id: string; status: string; purpose: string; approval_status: string }>(
      '/clinical-reviews',
      { method: 'POST', body: JSON.stringify(data) },
    ),

  list: () => request<{ active: ReviewSummary[]; mine: ReviewSummary[] }>('/clinical-reviews'),
  active: (limit = 25) => request<ReviewSummary[]>(`/clinical-reviews/active?limit=${limit}`),
  forPatient: (patientId: string) =>
    request<ReviewSummary[]>(`/clinical-reviews/patient/${patientId}`),
  myReleased: () => request<any[]>('/clinical-reviews/my-released'),

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

  approve: (id: string, data: { clinician_notes?: string; edited_report?: any }) =>
    request<any>(`/clinical-reviews/${id}/approve`, { method: 'POST', body: JSON.stringify(data) }),
  reject: (id: string, data: { reason: string }) =>
    request<any>(`/clinical-reviews/${id}/reject`, { method: 'POST', body: JSON.stringify(data) }),
  release: (id: string, data: { patient_friendly_summary?: string }) =>
    request<any>(`/clinical-reviews/${id}/release`, { method: 'POST', body: JSON.stringify(data) }),
  createPrescription: (id: string, data: {
    medication_name: string; dosage: string; frequency: string;
    duration?: string; instructions?: string;
  }) =>
    request<any>(`/clinical-reviews/${id}/prescription`, { method: 'POST', body: JSON.stringify(data) }),

  notifications: () => request<any[]>('/clinical-reviews/notifications'),
  markNotificationRead: (notifId: string) =>
    request<any>(`/clinical-reviews/notifications/${notifId}/read`, { method: 'POST', body: '{}' }),
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
  DRAFT: { label: 'Draft', tone: 'badge-neutral' },
  PENDING_APPROVAL: { label: 'Pending Approval', tone: 'badge-warning' },
  AWAITING_REVIEW: { label: 'Awaiting Review', tone: 'badge-warning' },
  APPROVED: { label: 'Doctor Approved', tone: 'badge-healthy' },
  REJECTED: { label: 'Doctor Rejected', tone: 'badge-danger' },
  RELEASED: { label: 'Released to Patient', tone: 'badge-healthy' },
  RELEASED_TO_PATIENT: { label: 'Released to Patient', tone: 'badge-healthy' },
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
  completed: { label: 'Completed', tone: 'badge-healthy' },
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

/**
 * Determines whether a review is in a terminal or completed state where
 * background multi-agent polling is no longer necessary.
 */
export function isReviewTerminalOrCompleted(
  review?: { status?: string | null; approval_status?: string | null; ai_draft_report?: any } | null
): boolean {
  if (!review) return false;
  const taskStatus = String(review.status || '').toLowerCase();
  const approval = String(review.approval_status || '').toUpperCase();

  // Terminal approval states
  if (
    approval === 'APPROVED' ||
    approval === 'REJECTED' ||
    approval === 'RELEASED' ||
    approval === 'RELEASED_TO_PATIENT'
  ) {
    return true;
  }

  // Awaiting doctor review (multi-agent analysis completed and draft report generated)
  if (approval === 'AWAITING_REVIEW' || approval === 'PENDING_APPROVAL') {
    return true;
  }

  // Task execution terminal states
  if (taskStatus === 'completed' || taskStatus === 'failed' || taskStatus === 'cancelled' || taskStatus === 'reviewed') {
    return true;
  }

  // If AI draft report is already populated
  if (review.ai_draft_report) {
    return true;
  }

  return false;
}

/**
 * Checks whether any review in a summary list is actively running in the background.
 */
export function hasActiveReviews(
  reviews?: Array<{ status?: string | null; approval_status?: string | null }> | null
): boolean {
  if (!reviews || !reviews.length) return false;
  return reviews.some((r) => {
    const taskStatus = String(r.status || '').toLowerCase();
    const approval = String(r.approval_status || '').toUpperCase();
    return (
      taskStatus === 'pending' ||
      taskStatus === 'running' ||
      (approval === 'DRAFT' && taskStatus !== 'completed' && taskStatus !== 'failed')
    );
  });
}
