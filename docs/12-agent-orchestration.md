# 12 — Agent Orchestration

## Orchestrator Design

**File**: `backend/orchestrator/workflow.py`  
**Entry point**: `async def run_workflow(...) -> WorkflowResult`

The orchestrator is the central coordinator that ties together the AI agents, cryptographic pipeline, storage, and blockchain layers.

---

## WorkflowResult Object

```python
@dataclass
class WorkflowResult:
    task_id: str
    run_id: str
    mode: str                           # "blockchain" or "centralized"
    status: str                         # "completed", "failed", "partial"
    agent_outputs: dict[str, dict]      # {role: output_dict}
    proofs: list[dict]                  # DecisionProof dicts
    consensus_result: dict              # agreement_score, status, weights
    anomalies: list[dict]              # hash_mismatch, schema_failure, etc.
    events: list[dict]                  # Chronological event timeline
    final_result: dict                  # Synthesizer output
    total_latency_ms: float
    verification_results: dict[str, bool]  # {proof_id: verified}
    
    def add_event(self, event_type: str, **kwargs):
        self.events.append({
            "event_type": event_type,
            "timestamp": datetime.utcnow().isoformat(),
            **kwargs
        })
```

---

## Full 25-Step Workflow

```
SETUP:
1.  WorkflowResult() created, run.started event added
2.  Supervisor.execute(task_data) → required_agents list
3.  create_agents_for_roles(required_agents) → agents dict

FOR EACH AGENT (loop):
4.  agent.started event logged
5.  output = await agent.execute(task_with_context)
6.  Pydantic validation: validate_output(output, role)
7.  Store in result.agent_outputs[role]
8.  Add to task_with_context["previous_outputs"]
9.  canonical_json(output) → canonical string
10. compute_sha256(canonical) → content_hash
11. encrypt_json(canonical) → encrypted bytes
12. storage.put_object(path, encrypted) → MinIO

BLOCKCHAIN:
13. Build proof_data dict
14. If blockchain mode: fabric_service.record_decision_proof(proof)
    - On success: proof["fabric_tx_id"] = tx_id
    - On failure: proof["fabric_ledger_status"] = "failed"
15. Save proof to result.proofs

VERIFICATION:
16. storage.get_object(path) → encrypted bytes
17. If simulate_tampering: add "tampered: True" field to output dict
18. decrypt(encrypted) → json string
19. json.loads(json_string) → stored_output dict
20. compute_sha256(stored_output) → computed_hash

INTEGRITY CHECK:
21. If computed_hash != proof["content_hash"]:
    anomalies.append(hash_mismatch)
    verification_results[proof_id] = False
22. Else: verification_results[proof_id] = True

END OF LOOP

FINALIZATION:
23. calculate_consensus(agent_outputs, verification_results)
24. Populate result.final_result from synthesizer output
25. Return WorkflowResult
```

---

## Consensus Calculation

```python
def calculate_consensus(
    agent_outputs: dict[str, dict],
    verification_results: dict[str, bool]
) -> dict:
    
    ROLE_WEIGHTS = {
        "synthesizer": 2.0,
        "verifier": 1.8,
        "clinical_reasoning": 1.5,
        "critic": 1.3,
        "risk": 1.2,
        "laboratory": 1.1,
        # all others: 1.0
    }
    
    total_weight = 0.0
    weighted_sum = 0.0
    
    for role, output in agent_outputs.items():
        if role == "supervisor": continue  # supervisor doesn't vote
        
        confidence = output.get("confidence", 0.5)
        weight = ROLE_WEIGHTS.get(role, 1.0)
        
        # Verification bonus/penalty
        is_verified = any(
            verified for key, verified in verification_results.items()
            if role in key
        )
        if is_verified:
            confidence *= 1.1   # 10% verification bonus
        else:
            confidence *= 0.8   # 20% penalty for unverified
        
        weighted_sum += confidence * weight
        total_weight += weight
    
    agreement_score = weighted_sum / total_weight if total_weight > 0 else 0.0
    
    if agreement_score >= CONSENSUS_THRESHOLD:  # default 0.70
        status = "accepted"
    elif agreement_score >= 0.50:
        status = "warning"
    else:
        status = "rejected"
    
    return {
        "agreement_score": round(agreement_score, 4),
        "status": status,
        "total_agents": len(agent_outputs),
        "verified_agents": sum(1 for v in verification_results.values() if v),
    }
```

---

## Workflow Modes

### `"blockchain"` mode
- Fabric gateway called for each agent proof.
- Real TX IDs recorded if Fabric available.
- Falls back to local simulation if Fabric unavailable.

### `"centralized"` mode
- Fabric gateway NOT called.
- Local `fabric_tx_id = f"local-{uuid.hex[:16]}"`.
- Proofs still stored in DB and MinIO.
- No blockchain immutability guarantee.

**Key point**: Cryptographic operations (SHA-256, AES-GCM, MinIO storage) happen in BOTH modes. The only difference is whether the hash is submitted to Fabric.

---

## Anomaly Detection

The orchestrator automatically generates anomaly records for:

| Anomaly Type | Trigger | Severity |
|-------------|---------|---------|
| `hash_mismatch` | Computed hash ≠ stored hash | high |
| `schema_failure` | Agent output fails Pydantic validation | medium |
| `agent_timeout` | Agent execution exceeds time limit | medium |
| `storage_failure` | MinIO put/get operation failed | high |
| `blockchain_failure` | Fabric submission failed | medium |
| `low_consensus` | agreement_score < 0.50 | high |

Each anomaly is stored in `result.anomalies` and creates an `AuditEvent` record in the database.
