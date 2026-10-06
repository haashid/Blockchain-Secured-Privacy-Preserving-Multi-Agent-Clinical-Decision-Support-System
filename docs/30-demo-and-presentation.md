# 30 — Demo and Presentation Guide

## 15-Minute Demonstration Script

### Pre-Demo Setup Checklist

```bash
# Terminal 1: Backend
cd backend
python -m uvicorn app:app --reload --port 8000

# Terminal 2: Frontend
cd frontend
npm run dev

# Verify:
# - http://localhost:8000/docs   (Swagger UI)
# - http://localhost:5173        (Frontend SPA)
```

Credentials ready:
- `admin` / `admin123`
- `doctor1` / `doctor123`
- `patient1` / `patient123`

---

## Scene 1: Role-Based Access Control (1 min)

1. Open **http://localhost:5173**
2. Login as `patient1` / `patient123`
3. **Show**: Patient portal only — appointments, records, prescriptions.
4. **Say**: "Patients can only see their own data. The system enforces strict role separation."
5. Logout.
6. Login as `doctor1` / `doctor123`
7. **Show**: Doctor portal — different interface, different navigation.
8. **Point out**: "The backend JWT claim `role: 'doctor'` controls this, not just frontend hiding."

---

## Scene 2: Hospital Domain (1 min)

1. In Doctor portal → **Patients** section.
2. **Show**: Patient list pulled from the database.
3. **Say**: "The hospital system manages patients, doctors, appointments, medical records, and prescriptions — the full clinical workflow."

---

## Scene 3: Submit a Clinical AI Analysis (3 min)

1. Navigate to **Admin Portal** (logout, login as admin).
2. Go to **Tasks** → **New Task**.
3. Fill the case form:
   - **Title**: "Complex Diabetic Patient - Sepsis Workup"
   - **Description**: "65-year-old diabetic patient with fever, elevated WBC, hemoglobin 10.2 g/dL, glucose 186 mg/dL. On Metformin and Lisinopril. Allergic to Penicillin. Suspected infection."
   - **Priority**: High
   - **Mode**: Blockchain
4. Click **Execute Task**.
5. **Watch the timeline**: Live SSE events showing each step.
6. **Say**: "You can see the workflow in real time — Supervisor classifies the case, then specialist agents execute one by one."

---

## Scene 4: Live Agent Execution (3 min)

1. On the task result page, expand each agent output.
2. **Point to Supervisor output**:
   - "The Supervisor classified this as medium complexity and selected: laboratory, risk, medication, clinical_reasoning, verifier, synthesizer."
3. **Point to Laboratory Agent output**:
   - "The Laboratory Agent flagged hemoglobin 10.2 (below reference 12-16), WBC 12,500 (elevated), and glucose 186."
4. **Point to Medication Agent output**:
   - "The Medication Safety Agent detected a low-severity interaction between Metformin and Lisinopril."
5. **Point to Clinical Synthesis output**:
   - "The Synthesizer merges all inputs into a single actionable clinical summary with suggested review points."
6. **Say**: "Each agent produces structured, validated output. If any agent produces an invalid schema, it's flagged as an anomaly."

---

## Scene 5: Cryptographic Proof (2 min)

1. Scroll to the **Decision Proofs** section.
2. **Point to the hash**:
   - "This SHA-256 hash is a mathematical fingerprint of the Laboratory Agent's exact output."
3. **Point to the Fabric TX ID**:
   - "This transaction ID was recorded on the Hyperledger Fabric blockchain. We can look this up on the ledger."
4. **Point to the MinIO reference**:
   - "The encrypted blob is stored at this path in MinIO. It cannot be read without the AES key."
5. Go to **Blockchain** page.
6. **Show**: Network status, list of committed proofs.
7. **Say**: "This is the tamper-evident chain. The hash on Fabric proves the data existed in this exact form."

---

## Scene 6: Tamper Demonstration — The "Insurance" (2 min)

1. Navigate to **Tasks** → **New Task**.
2. Create same case but enable **Simulate Tampering** toggle.
3. Execute the task.
4. **Show**: Verification result — `verified: false`, `hash_mismatch`.
5. **Point to the anomaly**:
   - "The system detected that the stored output no longer matches the blockchain hash."
6. **Show**: Audit event log — `verification.hash_mismatch` event recorded with severity `high`.
7. **Say**: "This is the core blockchain value. Even if someone with database access modifies the AI report after it was recorded, the blockchain catches it instantly."

---

## Scene 7: Trust Score and Agent Reliability (1 min)

1. Go to **Agents** page.
2. **Show**: Agent list with trust scores.
3. Click one agent.
4. **Show**: Trust history with score changes over time.
5. **Say**: "Agents losing verification builds distrust. If an agent consistently produces mismatching hashes — it gets flagged."

---

## Scene 8: Audit Log (1 min)

1. Go to **Audit** page.
2. **Show**: Complete chronological audit trail: task.created, supervisor.plan_ready, agent.started×N, blockchain.committed, verification.hash_mismatch.
3. **Say**: "Every event is timestamped and stored. This is the complete forensic trail — who, what, when, what happened. In a legal investigation, this is the evidence log."

---

## Scene 9: Benchmark (30 sec, optional)

1. Go to **Benchmarks**.
2. Run a quick 3-task benchmark comparing centralized vs blockchain.
3. **Show**: Latency difference — blockchain mode takes longer due to Fabric gRPC overhead.
4. **Say**: "We can measure exactly how much overhead the blockchain layer adds. Traceability has a cost — but it's a deliberate tradeoff for auditability."

---

## What Each Scene Proves

| Scene | Technical Point Proved |
|-------|----------------------|
| Role-based access | JWT + backend RBAC — not just UI hiding |
| Hospital domain | Real database-backed clinical entities |
| Task submission | Live clinical case processing |
| Agent outputs | Multi-agent specialization + Pydantic validation |
| Cryptographic proof | SHA-256 fingerprint + blockchain recording |
| Tamper detection | Hash mismatch caught, audit event generated |
| Trust scoring | Agent reliability tracking |
| Audit log | Complete forensic trail |
| Benchmarks | Quantified blockchain overhead |

---

## Pre-Canned Answers During Demo

**"Why not just use ChatGPT?"**  
→ "ChatGPT gives one generic answer with no audit trail, no specialization, and no proof it didn't change its answer later. We use 10 specialized agents that cross-check each other, and every output is fingerprinted on a blockchain."

**"Can the AI replace doctors?"**  
→ "Absolutely not. Every output carries a mandatory disclaimer. The system provides decision **support** — the physician makes the final call. The blockchain ensures they can always prove what the AI said."

**"What happens if Fabric is down?"**  
→ "The system degrades gracefully to centralized mode. Proofs are still recorded in the database. When Fabric comes back, the proofs can be reconciled. The goal is resilience."

**"What if the AI hallucinates?"**  
→ "The Critic Agent challenges other agents. The Verifier does a safety check. Both have safety constraints in their prompts. The disclaimer is mandatory. And critically — the blockchain proves what the AI said, whether right or wrong, so accountability is always traceable."
