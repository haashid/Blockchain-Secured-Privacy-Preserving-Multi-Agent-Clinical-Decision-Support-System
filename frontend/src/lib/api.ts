// API client for the FastAPI backend

const BASE = '/api';

export async function request<T>(path: string, options?: RequestInit, isFormData?: boolean): Promise<T> {
  const token = localStorage.getItem('token');
  const headers: Record<string, string> = {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...((options?.headers as Record<string, string>) || {}),
  };

  const res = await fetch(`${BASE}${path}`, { ...options, headers });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: { message: res.statusText } }));
    throw new Error(body.error?.message || `HTTP ${res.status}`);
  }

  return res.json();
}

// Auth
export const authApi = {
  login: (username: string, password: string) =>
    request<{ access_token: string; token_type: string; role: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),
  me: () => request<{ id: string; username: string; role: string }>('/auth/me'),
};

// Agents
export interface Agent {
  id: string;
  display_name: string;
  role: string;
  organization: string;
  status: string;
  trust_score: number;
  capabilities: string[];
  total_decisions: number;
  verification_successes: number;
  anomalies_detected: number;
  unauthorized_attempts: number;
  last_seen_at: string | null;
  created_at: string;
}

export const agentsApi = {
  list: () => request<Agent[]>('/agents'),
  get: (id: string) => request<Agent>(`/agents/${id}`),
  trust: (id: string) => request<{ agent_id: string; history: any[] }>(`/agents/${id}/trust`),
  activity: (id: string) => request<any[]>(`/agents/${id}/activity`),
};

// Tasks
export interface Task {
  id: string;
  title: string;
  description: string | null;
  domain: string;
  priority: string;
  coordination_mode: string;
  status: string;
  patient_context: any;
  required_agents: string[];
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Run {
  id: string;
  task_id: string;
  mode: string;
  status: string;
  supervisor_plan: any;
  selected_agents: string[];
  final_result: any;
  consensus_result: any;
  total_latency_ms: number | null;
  agent_latency_ms: number | null;
  blockchain_latency_ms: number | null;
  verification_latency_ms: number | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export const tasksApi = {
  list: (limit = 50, offset = 0) => request<Task[]>(`/tasks?limit=${limit}&offset=${offset}`),
  get: (id: string) => request<Task & { runs?: Run[] }>(`/tasks/${id}`),
  create: (data: {
    title: string;
    description?: string;
    domain: string;
    priority: string;
    coordination_mode: string;
    required_agents?: string[];
  }) => request<Task>('/tasks', { method: 'POST', body: JSON.stringify(data) }),
  run: (taskId: string) => request<Run>(`/tasks/${taskId}/run`, { method: 'POST' }),
  runs: (taskId: string) => request<Run[]>(`/tasks/${taskId}/runs`),
};

// Runs
export const runsApi = {
  get: (id: string) => request<Run>(`/runs/${id}`),
  result: (id: string) => request<any>(`/runs/${id}/result`),
};

// Decisions
export interface DecisionProof {
  id: string;
  proof_id: string;
  task_id: string;
  run_id: string;
  agent_id: string;
  agent_role: string;
  organization: string;
  content_hash: string;
  hash_algorithm: string;
  storage_reference: string | null;
  output_version: number;
  status: string;
  confidence: number | null;
  fabric_tx_id: string | null;
  fabric_block_number: number | null;
  fabric_ledger_status: string | null;
  submitted_at: string;
  created_at: string;
}

export const decisionsApi = {
  get: (proofId: string) => request<DecisionProof>(`/decisions/${proofId}`),
  byTask: (taskId: string) => request<DecisionProof[]>(`/tasks/${taskId}/decisions`),
};

// Verification
export const verifyApi = {
  run: (proofId: string) => request<any>(`/verify/${proofId}`, { method: 'POST' }),
  get: (proofId: string) => request<any>(`/verify/${proofId}`),
};

// Audit
export interface AuditEvent {
  id: string;
  event_type: string;
  agent_id: string | null;
  organization: string | null;
  task_id: string | null;
  run_id: string | null;
  proof_id: string | null;
  transaction_id: string | null;
  status: string | null;
  details: any;
  timestamp: string;
}

export const auditApi = {
  list: (params?: { agent_id?: string; event_type?: string; limit?: number }) => {
    const q = new URLSearchParams();
    if (params?.agent_id) q.set('agent_id', params.agent_id);
    if (params?.event_type) q.set('event_type', params.event_type);
    if (params?.limit) q.set('limit', String(params.limit));
    return request<AuditEvent[]>(`/audit?${q.toString()}`);
  },
  byTask: (taskId: string) => request<AuditEvent[]>(`/audit/task/${taskId}`),
  byAgent: (agentId: string) => request<AuditEvent[]>(`/audit/agent/${agentId}`),
};

// Blockchain
export const blockchainApi = {
  status: () => request<any>('/blockchain/status'),
};

// Benchmarks
export interface BenchmarkResult {
  id: string;
  name: string;
  coordination_mode: string;
  num_agents: number;
  total_tasks: number;
  completed_tasks: number;
  avg_latency_ms: number | null;
  throughput_tasks_per_min: number | null;
}

export const benchmarksApi = {
  list: (limit = 20) => request<BenchmarkResult[]>(`/benchmarks?limit=${limit}`),
  run: (data: { coordination_mode: string; num_agents: number[]; tasks_per_config: number; name?: string }) =>
    request<{ benchmarks: BenchmarkResult[] }>('/benchmarks/run', { method: 'POST', body: JSON.stringify(data) }),
};

// System
export const systemApi = {
  health: () => request<{ status: string; timestamp: string }>('/health'),
  ready: () => request<{ status: string; database: string; storage: string; fabric: string; ai_provider: string }>('/ready'),
  metrics: () => request<{
    total_tasks: number;
    completed_tasks: number;
    active_runs: number;
    verified_decisions: number;
    verification_failures: number;
    suspicious_agents: number;
    blockchain_transactions: number;
    avg_latency_ms: number | null;
    verification_success_rate: number | null;
  }>('/metrics'),
};
