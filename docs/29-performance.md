# 29 — Performance

## Performance Overview

Performance in this system is dominated by three factors:
1. **LLM inference latency** (Groq API) — per-agent call time.
2. **Sequential execution** — no parallel agents currently.
3. **Blockchain overhead** — Fabric gRPC transaction vs centralized mode.

---

## Baseline Latency Estimates

| Component | Mock Mode | LLM Mode (Groq) |
|-----------|-----------|----------------|
| Per supervisor call | <1ms | 800ms – 2s (70B model) |
| Per heavy agent call | <1ms | 600ms – 1.5s (70B model) |
| Per fast agent call | <1ms | 200ms – 600ms (8B model) |
| SHA-256 computation | <0.1ms | <0.1ms |
| AES-GCM encrypt/decrypt | <0.5ms | <0.5ms |
| MinIO put_object | 5–50ms | 5–50ms |
| MinIO get_object | 5–50ms | 5–50ms |
| Fabric gRPC submit | 50–500ms | 50–500ms |
| Fabric gRPC query | 20–200ms | 20–200ms |

**Typical complete workflow:**
- **Mock mode, centralized**: 20–100ms (pure Python + SQLite)
- **Mock mode, blockchain**: 200ms – 2s (blockchain overhead per agent)
- **LLM mode, centralized**: 5–15s (6 agents × ~1-2s each)
- **LLM mode, blockchain**: 6–20s (LLM + blockchain per agent)

---

## Benchmarking Framework

The system includes a built-in benchmark tool accessible via:
- **API**: `POST /api/benchmarks/run`
- **UI**: Admin portal → Benchmarks page

### What It Measures

```python
# Simplified benchmark logic
for mode in ["centralized", "blockchain"]:
    for i in range(num_tasks):
        start = time.monotonic()
        await run_workflow(task_data, mode=mode, ...)
        latency_ms = (time.monotonic() - start) * 1000
        latencies.append(latency_ms)
    
    results[mode] = {
        "avg_latency_ms": statistics.mean(latencies),
        "min_latency_ms": min(latencies),
        "max_latency_ms": max(latencies),
        "p50_latency_ms": statistics.median(latencies),
        "p95_latency_ms": percentile(latencies, 95),
        "p99_latency_ms": percentile(latencies, 99),
        "throughput_tasks_per_min": 60000 / mean_latency,
    }
```

### BenchmarkResult Table

Results are stored in `benchmark_results` table:

| Column | Description |
|--------|-------------|
| `coordination_mode` | "centralized" or "blockchain" |
| `avg_latency_ms` | Mean workflow latency |
| `p50_latency_ms` | Median (50th percentile) |
| `p95_latency_ms` | 95th percentile — most users experience this |
| `p99_latency_ms` | 99th percentile — worst case |
| `throughput_tasks_per_min` | Tasks completed per minute |
| `avg_blockchain_latency_ms` | Time spent on Fabric calls |

---

## Expected Benchmark Results (Mock Mode)

| Mode | Avg Latency | Blockchain Overhead |
|------|------------|-------------------|
| Centralized | ~30ms | 0ms |
| Blockchain (simulated) | ~80ms | ~50ms (local TX ID generation) |
| Blockchain (real Fabric) | ~500ms – 2s | ~400ms – 1.5s |

The benchmark demonstrates the **tradeoff**: blockchain adds latency overhead in exchange for tamper-evident provenance. This is the expected and acceptable cost of auditability.

---

## Performance Bottlenecks

### 1. Sequential Agent Execution (Biggest Issue)

```python
# Current code in workflow.py:
for agent_role, agent in agents.items():
    output = await agent.execute(task_with_context, {})  # Sequential
```

**Impact**: 6 agents × 1s average = 6s total (vs ~1-2s if parallel).

**Fix**: `asyncio.gather()` for independent agents:
```python
independent_agents = [cr_agent, lab_agent, med_agent, risk_agent, evidence_agent]
outputs = await asyncio.gather(*[a.execute(task_data) for a in independent_agents])
# Then run critic → verifier → synthesizer sequentially (they need prior outputs)
```

### 2. Synchronous MinIO calls

The current MinIO client may use synchronous `boto3`. Using `aioboto3` for truly async S3 operations would improve throughput.

### 3. Database N+1 queries

SQLAlchemy's `lazy="selectin"` helps, but complex relationship trees can still cause N+1 query patterns. Use `selectinload()` or `joinedload()` explicitly for performance-critical endpoints.

---

## Performance Monitoring

Structured logging (structlog) records key performance metrics:

```json
{
  "event": "agent_execute_completed",
  "agent_id": "agent-clinical_reasoning-01",
  "role": "clinical_reasoning",
  "provider": "mock",
  "model": "none",
  "latency_ms": 0.42,
  "status": "completed"
}
```

All `latency_ms` values are stored in:
- `runs.agent_latency_ms` — total agent time
- `runs.blockchain_latency_ms` — total Fabric time
- `runs.verification_latency_ms` — total verification time
- `runs.total_latency_ms` — wall-clock total
- `agent_executions.latency_ms` — per-agent time
