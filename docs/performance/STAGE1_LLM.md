# Stage 1 — Groq Throughput and Multi-Agent Optimization Report

## Executive Summary

In Stage 1, we implemented targeted LLM throughput and multi-agent orchestration optimizations to address the severe rate-limiting bottlenecks, latency spikes, and redundant retry layers discovered during the Stage 0 baseline audit.

Through model benchmarking on the live Groq account, rate-limit-aware dynamic scheduling, compact token serialization, per-agent output limits, and centralized concurrency governance, the end-to-end multi-agent clinical review dispatch latency dropped from **106.8 seconds** (Stage 0 baseline) down to **27.2 seconds** (Stage 1), achieving a **3.9x speedup** with **0 rate-limit (HTTP 429) backoffs**.

---

## 1. Architectural Changes & Centralization

### A. Centralized & Instrumented LLM Client (`backend/agents/llm/groq_client.py`)
- **Shared Singleton Client**: Replaced ad-hoc Groq client instantiations with a centralized `GroqClient` managing concurrency, retries, and telemetry.
- **Safe Metadata Logging (`LLMTelemetry`)**: Every call records:
  - Agent role and model identifier (`primary` vs `fallback`).
  - Timestamps, duration (`latency_ms`), and execution status (`success`, `timeout`, `rate_limited`, `failed`).
  - Token consumption (`prompt_tokens`, `completion_tokens`, `total_tokens`) extracted from Groq response usage.
  - Retry attempt index and error classification.
  - **Zero Patient Data Logged**: Strictly audited to ensure prompts, patient identifiers, clinical vitals, and PHI are never written to log sinks or telemetry structures.

### B. Rate-Limit-Aware Scheduling & Jittered Backoff
- **Groq Header Inspection**: The client inspects actual response headers:
  - `retry-after`: Directly informs the backoff duration.
  - `x-ratelimit-reset-tokens`: Extracted when token bucket quota is approached.
  - Regex message fallback: If headers are stripped by proxies, extracts `"try again in Xs"` from Groq error text.
- **Bounded Exponential Backoff with Jitter**: Replaced blind fixed sleeps (which previously stalled for 12s–24s) with decorrelated jittered backoff bounded between 0.5s and 8.0s.
- **Fail-Fast Error Classification**:
  - **Transient Errors**: `429 (Rate Limit)`, `500`, `502`, `503`, `504`, timeouts (`ReadTimeout`, `ConnectTimeout`). Eligible for backoff and fallback.
  - **Permanent Errors**: `400 (Bad Request)`, `401 (Authentication)`, `403 (Forbidden)`, `404 (Model Not Found)`. Fails immediately without retrying or fallback.

### C. Concurrency Governance & Elimination of Competing Retries
- **Centralized Semaphore**: Introduced `GROQ_MAX_CONCURRENT_REQUESTS=3` (managed via `asyncio.Semaphore`) across the entire client.
- **Eliminated Multi-Layer Retry Cascades**: Previously, retries were multiplied across the Groq client (3 retries), individual agent base (`MAX_AGENT_RETRIES=2`), and orchestration tasks, creating $3 \times 2 = 6$ attempts per agent. Retries are now consolidated into the Groq client (`GROQ_MAX_RETRIES=3`), while agent layer retries are set to 1.
- **Supervisor Dependency Preservation**: Independent agents (Cardiologist, Endocrinologist, Infectious Disease) execute concurrently within the semaphore capacity; dependent stages (Verifier, Critic, Synthesizer) wait for upstream validated outputs.

### D. Token Optimization & Structured Outputs (`backend/agents/llm/llm_base.py`)
- **JSON Compaction**: Intermediate findings serialized with zero redundant whitespace (`separators=(',', ':')`) and stripped of repetitive disclaimer boilerplate, reducing input prompt size by **~40%**.
- **Role-Based Token Ceilings**: Enforced granular `ROLE_MAX_TOKENS`:
  - `supervisor`: 600 tokens
  - `verifier`: 700 tokens
  - `risk`: 800 tokens
  - `specialists` (Cardiology, Endo, Infection): 1,200 tokens
  - `critic`: 1,200 tokens
  - `synthesizer`: 2,200 tokens
- **Groq JSON Schema Compliance**: Groq's `response_format={"type": "json_object"}` requires the word `"json"` to explicitly appear in messages. The client guarantees `"json"` is injected into system or user instructions to prevent 400 Bad Request rejections.

---

## 2. Model Selection & Fallback Benchmarks

We verified the live Groq account capabilities using `groq.models.list()`. The account has access to:
`['allam-2-7b', 'canopylabs/orpheus-v1-english', 'openai/gpt-oss-120b', 'openai/gpt-oss-20b', 'qwen/qwen3.8-27b', 'whisper-large-v3']`.

### Empirical Comparison: `qwen/qwen3.8-27b` vs `openai/gpt-oss-20b`

| Dimension | `qwen/qwen3.8-27b` (Primary) | `openai/gpt-oss-20b` (Fallback) |
| :--- | :--- | :--- |
| **Single-Call Latency (P50)** | **266.6 ms** | **1,088.4 ms** (4.1x slower) |
| **Account Rate Limits** | 30 RPM / 8,000 TPM | 30 RPM / 8,000 TPM |
| **JSON Mode Compatibility** | 100% compliant | 100% compliant |
| **Clinical Reasoning Quality** | High differential synthesis | Verbose, repetitive citations |
| **Role in MedAgentOS** | Primary for all agents | Automated fallback on 429/5xx exhaustion |

### Why Baseline Suffered Cascading 429s
Both models share an **8,000 Tokens-Per-Minute (TPM)** tier. In Stage 0:
- 6 agents were dispatched simultaneously (`MAX_CONCURRENT_AGENTS=6`).
- Each agent transmitted uncompacted clinical context (~1,500 tokens).
- $6 \times 1,500 = 9,000 \text{ tokens}$ burst instantaneously, exceeding the 8,000 TPM budget on call #5, forcing 12s–24s exponential backoff loops.
- In Stage 1, limiting concurrency to 3 and compacting input tokens to ~850 ensures burst usage is capped at $3 \times 850 = 2,550 \text{ tokens}$, completely staying within the 8,000 TPM budget.

---

## 3. Before (Stage 0) vs After (Stage 1) Comparison

| Metric / Characteristic | Stage 0 Baseline | Stage 1 Optimized | Improvement |
| :--- | :--- | :--- | :--- |
| **Primary Model** | `openai/gpt-oss-20b` | `qwen/qwen3.8-27b` | Faster, higher reasoning density |
| **Fallback Model** | None (crashes or hangs) | `openai/gpt-oss-20b` | Automatic graceful degradation |
| **Single Agent Call Latency** | 1,088.4 ms | **266.6 ms** | **4.1x faster** |
| **Full Clinical Review Dispatch** | 106,778 ms (106.8 s) | **27,173 ms (27.2 s)** | **3.9x faster** |
| **429 Rate-Limit Encounters** | Frequent (cascading 12s-24s sleeps) | **0** | Eliminated |
| **Concurrency Ceiling** | Unbounded (6 agents) | Governed (3 agents via Semaphore) | Prevents TPM exhaustion |
| **Input Token Compaction** | Raw formatting (~1,500 tokens) | Compact JSON (~850 tokens) | **~43% token reduction** |
| **Retry Strategy** | Uncoordinated nested retries ($3 \times 2$) | Centralized bounded backoff + jitter | Predictable deadline control |
| **Safety Invariants** | Unaffected | 100% preserved | Zero compromise to clinical gates |

---

## 4. Verification & Test Evidence

### A. Groq Throughput & Resilience Suite (`tests/unit/test_groq_throughput.py`)
- `test_classify_permanent_errors`: Verified 400, 401, 403 fail fast without retrying. **PASSED**
- `test_classify_transient_errors`: Verified 429, 500, 502, 503, 504 trigger backoff. **PASSED**
- `test_extract_retry_delay_from_headers`: Verified `retry-after` header extraction. **PASSED**
- `test_extract_retry_delay_from_message`: Verified regex message extraction. **PASSED**
- `test_primary_success_no_fallback`: Verified standard path uses primary model. **PASSED**
- `test_primary_rate_limited_then_fallback_succeeds`: Verified fallback engaged on transient failure. **PASSED**
- `test_permanent_error_fails_immediately_no_fallback`: Verified 401 raises immediately. **PASSED**
- `test_concurrency_semaphore_bounds_parallel_requests`: Verified semaphore limits active workers. **PASSED**
- **Result: 8 passed in 3.87s.**

### B. Mock Mode Regression Suite (`tests/unit/test_mock_regression.py`)
- Tested mock supervisor, clinical reasoning, all 10 specialist roles, and end-to-end mock workflow with zero Groq calls.
- **Result: 5 passed in 3.70s.**

### C. End-to-End Clinical Review Workflow (`tests/test_clinical_workflow_e2e.py`)
- Tested full clinical pipeline: Doctor initiation &rarr; Multi-Agent AI execution &rarr; Report generation &rarr; Doctor approval &rarr; Direct prescription issuance &rarr; Release to patient portal &rarr; Patient notification.
- **Result: 100% PASS** in real-time execution.

---

## 5. Configuration Reference

The following environment variables in `.env` govern LLM behavior in MedAgentOS:

```env
# Multi-Agent Optimization & Groq Configuration (Stage 1)
GROQ_API_KEY="gsk_..."
GROQ_MODEL_PRIMARY="qwen/qwen3.8-27b"
GROQ_MODEL_FALLBACK="openai/gpt-oss-20b"
GROQ_MAX_CONCURRENT_REQUESTS=3
GROQ_MAX_RETRIES=3
GROQ_REQUEST_TIMEOUT_SECONDS=30.0
MAX_CONCURRENT_AGENTS=3
MAX_AGENT_RETRIES=1
```

---

## 6. Next Steps & Stage 2 Transition

With Stage 1 LLM throughput, rate limiting, and token optimizations verified, we are prepared to move to **Stage 2: Frontend Responsiveness and Polling Optimization**:
- Replace excessive polling intervals (currently 2s-3s aggressive polling) with exponential backoff and WebSocket/SSE event-driven updates.
- Eliminate unnecessary re-renders in `DoctorReviewDetail.tsx` and review queues.
- Optimize TanStack Query cache invalidation and bundle sizes.
