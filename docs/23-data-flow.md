# 23 — Data Flow

## Complete End-to-End Data Flow

This document traces data from a doctor's browser through every system component.

---

## Phase 1: Authentication

```
1. Doctor opens http://localhost:5173
2. LoginPage renders
3. Doctor types: username="doctor1", password="doctor123"
4. POST /api/auth/login {username, password}
5. auth.py router receives request
6. authenticate_user(db, "doctor1", "doctor123"):
   a. SELECT user WHERE username="doctor1" → User record
   b. bcrypt.verify("doctor123", user.hashed_password) → True
   c. Returns User object
7. create_access_token({sub: user_id, username, role: "doctor"})
8. Response: {access_token: "eyJ...", role: "doctor"}
9. LoginPage stores in localStorage:
   - localStorage.setItem("token", "eyJ...")
   - localStorage.setItem("user_role", "doctor")
10. React Router: Navigate to /doctor/dashboard
```

---

## Phase 2: View Patient List

```
1. DoctorDashboard renders
2. useQuery(["patients"], hospitalApi.getPatients())
3. GET /api/hospital/patients
   - Authorization: Bearer eyJ...
4. hospital router: check_role("admin", "doctor") → OK
5. get_patients(db) → SELECT * FROM patients
6. Response: [{id, first_name, last_name, medical_record_number, ...}]
7. React renders patient list
```

---

## Phase 3: Submit Clinical Case

```
1. Doctor fills case form:
   - Title: "Complex Diabetic Patient"
   - Description: "65-year-old with fever, elevated WBC..."
   - Priority: "high"
   - Mode: "blockchain"
   - patient_context: {age: 65, symptoms: [...], ...}

2. POST /api/tasks {title, description, priority, coordination_mode, patient_context}
3. Task router: check_role("admin", "operator", "doctor") → OK
4. create_task(db, data, user_id) → INSERT INTO tasks → Task record
5. POST /api/tasks/{task_id}/execute
6. create_run(db, task_id, "blockchain") → INSERT INTO runs → Run record
7. run_workflow(task_id, task_data, mode="blockchain", ...) called
```

---

## Phase 4: Agent Pipeline

```
Step 1: SUPERVISOR
  Input:  {title, description, patient_context}
  Process: MockSupervisorAgent.execute() [AI_MODE=mock]
  Output:  {case_type: "clinical_case_review", complexity: "medium",
            required_agents: ["clinical_reasoning", "laboratory", "risk", 
                              "medication", "verifier", "synthesizer"]}
  → required_agents list stored

Step 2: Create agent instances
  create_agents_for_roles(["clinical_reasoning", ...])
  → {clinical_reasoning: MockClinicalReasoningAgent, ...}

Step 3: CLINICAL REASONING
  Input:  {description, patient_context, previous_outputs: {}}
  Process: MockClinicalReasoningAgent.execute()
  Keywords found: "fever", "diabetes" → adds conditions
  Output:  {possible_conditions: [{condition: "Infection", probability: 0.75},...],
            confidence: 0.78, ...}
  
  → Pydantic validate: ClinicalReasoningOutput.model_validate(output) ✓
  → Add to task_with_context["previous_outputs"]["clinical_reasoning"]
  
  → canonical_json(output) → sorted JSON string
  → compute_sha256(canonical) → "a1b2c3d4e5f6..."   [HASH A]
  → encrypt_json(canonical) → bytes(nonce + ciphertext)
  → storage.put_object("tasks/UUID/runs/UUID/agents/clinical_reasoning/output.json.enc", bytes)
  → MinIO stores encrypted blob
  
  → build proof: {proof_id: "proof-abc-clinical_reasoning", content_hash: HASH_A, ...}
  → fabric_service.record_decision_proof(proof)
    [If Fabric connected]: gRPC → peer → chaincode → RecordDecisionProof → ledger tx
    [If not connected]:    proof["fabric_tx_id"] = "local-{hex}"
  → proof appended to result.proofs

Step 4-N: [Similar for LABORATORY, RISK, MEDICATION, VERIFIER]

Step N: SYNTHESIZER
  Input:  {previous_outputs: {clinical_reasoning: {...}, laboratory: {...}, ...}}
  Output: {case_summary: "Patient with suspected infection...",
           potential_concerns: [...],
           suggested_clinical_review_points: [...],
           blockchain_provenance: "Decision proofs registered",
           disclaimer: "AI-generated...clinician review required",
           confidence: 0.82}
```

---

## Phase 5: Verification Pipeline

```
For each proof in result.proofs:
  1. path = proof["storage_reference"]
  2. encrypted = storage.get_object(path)
  3. json_str = decrypt(encrypted)         # AES-GCM → raises if tampered
  4. stored_output = json.loads(json_str)
  5. computed_hash = compute_sha256(stored_output)
  6. original_hash = proof["content_hash"]
  7. match = hmac.compare_digest(computed_hash, original_hash)
  
  If match:
    verification_results[proof_id] = True
    result.add_event("verification.passed", proof_id=proof_id)
  Else:
    verification_results[proof_id] = False
    result.anomalies.append({type: "hash_mismatch", severity: "high"})
    result.add_event("verification.hash_mismatch")

[If simulate_tampering=True]
  Before step 4: stored_output["tampered"] = True
  → step 5 produces different computed_hash
  → step 7: False → anomaly detected
```

---

## Phase 6: Consensus + Finalization

```
calculate_consensus(agent_outputs, verification_results):
  clinical_reasoning: confidence=0.78, weight=1.5, verified=True → 0.78 * 1.1 * 1.5 = 1.287
  laboratory:         confidence=0.88, weight=1.1, verified=True → 0.88 * 1.1 * 1.1 = 1.064
  risk:               confidence=0.82, weight=1.2, verified=True → 0.82 * 1.1 * 1.2 = 1.082
  synthesizer:        confidence=0.82, weight=2.0, verified=True → 0.82 * 1.1 * 2.0 = 1.804
  
  total_weight = 1.5 + 1.1 + 1.2 + 2.0 = 5.8
  weighted_sum = 1.287 + 1.064 + 1.082 + 1.804 = 5.237
  agreement_score = 5.237 / 5.8 ≈ 0.90
  
  status = "accepted" (≥ 0.70)

WorkflowResult populated
update_run_result(db, run_id, result) → UPDATE runs SET final_result=...
```

---

## Phase 7: Response to Doctor

```
API returns complete WorkflowResult including:
  - agent_outputs: {clinical_reasoning: {...}, laboratory: {...}, ...}
  - proofs: [{proof_id, content_hash, fabric_tx_id, ...}, ...]
  - consensus_result: {agreement_score: 0.90, status: "accepted"}
  - events: [{event_type: "supervisor.plan_ready", ...}, ...]
  - anomalies: []
  - final_result: {case_summary: "...", disclaimer: "...", ...}
  - total_latency_ms: 345.2

Browser renders:
  - Clinical summary from synthesizer
  - Per-agent output cards (expandable)
  - Timeline of events
  - Decision proof table with hashes
  - Verification status badges
```

---

## Data Never Crosses These Boundaries

| Data | Database | MinIO | Fabric | Groq API |
|------|---------|-------|--------|----------|
| User passwords (bcrypt) | ✅ | ❌ | ❌ | ❌ |
| Patient demographics | ✅ | ❌ | ❌ | In context (LLM mode) |
| AI agent outputs (plaintext) | ❌ | ❌ | ❌ | ✅ (as response) |
| AI agent outputs (encrypted) | ❌ | ✅ | ❌ | ❌ |
| SHA-256 hashes | ✅ | ❌ | ✅ | ❌ |
| Fabric TX IDs | ✅ | ❌ | ✅ | ❌ |
