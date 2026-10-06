# 33 — Viva Preparation

## 55 Examiner Questions with Answers

---

## Section A: Project Basics

### Q1: Describe your project in one sentence.
**Answer**: A hospital AI clinical decision-support system where ten specialized LLM agents collaboratively analyze patient cases, with every AI output cryptographically hashed and immutably recorded on a private Hyperledger Fabric blockchain for tamper-evident auditability.

---

### Q2: What problem does this project solve?
**Answer**: Three problems:
1. **Black-box AI**: Single LLMs give opaque answers with no accountability.
2. **No provenance**: Hospitals cannot prove what an AI said at decision time if logs can be modified.
3. **Hallucination in clinical settings**: A single model may invent medical facts with high confidence.

The multi-agent system cross-validates outputs; the blockchain provides cryptographic proof that outputs were not modified.

---

### Q3: Who are the target users?
**Answer**: Hospital administrators (manage the system), physicians/doctors (submit clinical cases, get AI analysis), patients (view their own records and reports), auditors (verify blockchain proofs).

---

### Q4: Is this a real clinical system for patient care?
**Answer**: No. This is an academic clinical decision-support tool. It is NOT a replacement for licensed physicians, NOT a diagnostic system, and NOT HIPAA-certified for real patient care. Every AI output carries a mandatory disclaimer requiring human clinician review.

---

## Section B: AI and Multi-Agent Systems

### Q5: What is an AI agent?
**Answer**: An AI agent is a software entity that receives input, applies reasoning (via LLM or rule-based logic), and produces structured output. Each agent is designed for one specific task — like a clinical specialist who focuses on one area of medicine.

---

### Q6: Why use multiple agents instead of one?
**Answer**: Specialization and cross-checking. A single LLM tries to handle everything and may contradict itself or miss domain-specific patterns. With 10 agents: each focuses on one job (lab analysis, medication safety, risk assessment), the Critic actively challenges other agents' reasoning, and the Verifier does a final safety check. This produces more reliable, cross-validated outputs.

---

### Q7: How many agents does your system have?
**Answer**: 10 total. One Supervisor that orchestrates, and nine specialists: Clinical Reasoning, Medical History, Laboratory Analysis, Pharmacotherapy (Medication), Risk Assessment, Evidence-Based Medicine, Peer Review Critic, Verifier, and Clinical Synthesizer.

---

### Q8: How are agents selected dynamically?
**Answer**: The Supervisor Agent reads the case description and returns a `required_agents` list. In LLM mode, this is an actual LLM reasoning decision. In mock mode, it uses keyword matching (if "lab" or "blood" in description → add laboratory agent). The mandatory agents (clinical_reasoning, verifier, synthesizer) always run.

---

### Q9: Are agents truly parallel?
**Answer**: No. The current implementation is sequential. In `workflow.py`: `for agent_role, agent in agents.items(): await agent.execute()`. True parallel execution would require `asyncio.gather()`. This is an acknowledged architectural limitation.

**Common mistake**: Claiming parallelism because multiple agents exist. Parallelism requires concurrent execution.

---

### Q10: Does the Critic Agent trigger re-analysis?
**Answer**: No. The `CriticOutput` schema has a `requires_reanalysis: bool` field, and the agent populates it. However, the Orchestrator does NOT loop back to re-run agents if the Critic flags issues. The critic's output is recorded and shown in the report but does not cause re-execution. This is a known gap.

---

### Q11: How does one agent know what another said?
**Answer**: Via `previous_outputs` in the task context. The Orchestrator accumulates outputs: after each agent runs, its output is added to `task_with_context["previous_outputs"]`. Each subsequent agent has read-only access to all prior outputs. The Synthesizer reads all of them to compile the final report.

---

### Q12: What is the output schema for the Synthesizer Agent?
**Answer**: `SynthesisOutput` (Pydantic model) containing: `case_summary`, `relevant_history`, `clinical_findings`, `laboratory_findings`, `medication_safety_findings`, `potential_concerns`, `supporting_evidence`, `conflicting_evidence`, `uncertainty`, `risk_assessment`, `suggested_clinical_review_points`, `verification_status`, `blockchain_provenance`, `disclaimer`, and `confidence`.

---

### Q13: How does the Supervisor know which agents to select?
**Answer**: In LLM mode: it receives the case description and a JSON Schema requiring `required_agents: list[str]`. The LLM reasons from the clinical content. In mock mode: it checks for keywords like "lab", "blood", "medication", "complex", "critical" and adds relevant agents.

---

## Section C: LLM and Groq

### Q14: What LLM provider do you use?
**Answer**: Groq — a hardware AI acceleration company using custom LPU (Language Processing Unit) chips providing 300-500 tokens per second, compared to ~50 for standard GPU inference.

---

### Q15: What is the model?
**Answer**: `llama-3.1-70b-versatile` for heavy reasoning agents (Supervisor, Clinical Reasoning, Synthesizer, Risk), and `llama-3.1-8b-instant` for fast agents (History, Lab, Medication, Evidence, Critic, Verifier).

---

### Q16: Why Groq over OpenAI?
**Answer**: Speed is critical in a multi-agent system. With 10 sequential agents, a 5-second latency per agent = 50 second total. Groq's LPU hardware reduces each agent call to ~1-2 seconds, making the system actually usable.

---

### Q17: How does the LLM know what JSON format to output?
**Answer**: The `LLMAgent.get_system_prompt()` method injects the Pydantic model's JSON Schema directly into the system prompt. The prompt says: "You MUST output ONLY valid JSON matching this exact schema" and includes the full schema. Groq is called with `response_format={"type": "json_object"}` for reliable structured output.

---

### Q18: What happens if Groq is unavailable?
**Answer**: `AI_MODE=mock` in `.env` causes the factory to instantiate mock agents instead of LLM agents. Mock agents produce realistic hardcoded outputs (real Pydantic schemas, plausible clinical data). The factory resolves this: coordination modes ("blockchain", "centralized") fall back to `settings.AI_MODE`.

---

### Q19: What are the medical safety constraints?
**Answer**: Every LLM agent's system prompt begins with `MEDICAL_SAFETY_PREAMBLE` (injected automatically in `llm_base.py`): Never fabricate patient data. Never claim definitive diagnosis. Never recommend autonomous prescribing. Distinguish facts from inference. Flag uncertainty. Recommend clinician review for all conclusions.

---

## Section D: Cryptography

### Q20: What is canonical JSON and why is it necessary?
**Answer**: Canonical JSON is a deterministic serialization of a JSON object where keys are sorted alphabetically, with no extra whitespace. Without it, the same data could serialize differently (`{"b":1,"a":2}` vs `{"a":2,"b":1}`), producing different hashes for identical data. We use `json.dumps(data, sort_keys=True, separators=(',',':'))`.

---

### Q21: What is SHA-256?
**Answer**: A one-way mathematical function that maps any input to a fixed 64-character hexadecimal string. Properties: deterministic (same input → same hash), one-way (cannot reverse), avalanche (one character change → completely different hash), collision-resistant (computationally infeasible to find two inputs with same hash).

---

### Q22: Why not store the full output on the blockchain?
**Answer**: Blockchains are expensive for data storage. Storing large JSON blobs on-chain increases ledger size, reduces throughput, and creates privacy concerns. We use **off-chain storage** (MinIO) for the encrypted data and **on-chain** only for the hash fingerprint. The hash is mathematically sufficient to prove the data existed and was not modified.

---

### Q23: What is AES-256-GCM?
**Answer**: AES (Advanced Encryption Standard) with 256-bit key and GCM (Galois/Counter Mode). It provides: confidentiality (data unreadable without key) AND integrity (authentication tag detects any modification to ciphertext). GCM mode is preferred over CBC because it also detects tampering and is parallelizable.

---

### Q24: What is a nonce and why does it matter?
**Answer**: A nonce (Number used ONCE) is a 96-bit random value generated fresh for every encryption operation. It ensures that encrypting the same plaintext twice produces different ciphertext, preventing statistical analysis. Stored as the first 12 bytes of the encrypted blob.

---

### Q25: Why use `hmac.compare_digest` instead of `==` for hash comparison?
**Answer**: Normal `==` comparison can leak information via timing attacks — it can return early when strings differ at the first character. An attacker timing thousands of requests could guess hash values character by character. `hmac.compare_digest` runs in constant time regardless of where strings differ, preventing this attack.

---

### Q26: If I change one character in the stored output, what happens?
**Answer**: The verification engine re-downloads the MinIO blob, decrypts it, re-canonicalizes and re-hashes it. The new hash will not match the hash stored on the blockchain (from before tampering). The system flags `verification.hash_mismatch`, adds an anomaly of severity "high", and would trigger a trust score deduction. This is demonstrated with `simulate_tampering=True`.

---

## Section E: Blockchain

### Q27: What is Hyperledger Fabric?
**Answer**: A permissioned blockchain framework for enterprise use. Participants are organizations authenticated via X.509 certificates. No gas fees. Uses Go chaincode for smart contracts. Supports channel isolation for privacy. Consensus via RAFT ordering. Used by IBM, Oracle, and many enterprises for supply chain, finance, and healthcare.

---

### Q28: Why Hyperledger Fabric instead of Ethereum?
**Answer**: 
1. **Privacy**: Ethereum is public — anyone can see transactions. Fabric channels are private.
2. **No gas fees**: Healthcare deployments cannot pay per transaction.
3. **Performance**: Ethereum ~15 TPS, Fabric ~1000-3500 TPS.
4. **Identity**: Fabric uses X.509 certificates for enterprise identity. Ethereum uses keypairs.
5. **Permission control**: Only authorized hospitals can join the Fabric network.

---

### Q29: Why blockchain if PostgreSQL already exists?
**Answer**: PostgreSQL can be modified by a database administrator. If a hospital wants to hide an AI mistake after a bad outcome, they can change the PostgreSQL record. The blockchain cannot be modified — even by a system administrator. It provides **non-repudiation**: proof that data existed in a specific state at a specific time, independent of the application database.

---

### Q30: What exactly is stored on the blockchain?
**Answer**: The `RecordDecisionProof` chaincode function stores: `proof_id`, `task_id`, `run_id`, `agent_id`, `agent_role`, `organization` (MSP), `content_hash` (SHA-256), `hash_algorithm`, `storage_reference` (MinIO path), `output_version`, `status`, `confidence`, `timestamp`. Patient data is NEVER stored on-chain.

---

### Q31: What is an orderer?
**Answer**: The ordering service receives endorsed transactions from client applications, orders them into a deterministic sequence, packages them into blocks, and distributes blocks to all peers. It does NOT execute chaincode. In this project, RAFT-based single orderer (`orderer.example.com:7050`).

---

### Q32: What is endorsement?
**Answer**: Before a transaction is committed to the ledger, it must be endorsed (signed) by peers matching the endorsement policy. Example: "At least 1 peer from Org1 must endorse." Endorsement is chaincode execution — the peer runs the chaincode, produces a read-write set, and signs it. The signed proposal is returned to the client who bundles it and sends to the orderer.

---

### Q33: Does the blockchain guarantee the AI result is correct?
**Answer**: **No.** This is a critical distinction. The blockchain only proves that **this specific hash was recorded at this time**. It does not validate whether the AI's clinical reasoning was medically accurate. Blockchain provides provenance and tamper-evidence — not clinical truth.

---

### Q34: What is chaincode?
**Answer**: Smart contracts in Hyperledger Fabric, written in Go (in this project). Chaincode defines what data can be stored on the ledger, what queries are allowed, and who is authorized to call which functions. Deployed on peers and executed during transactions.

---

## Section F: Security

### Q35: How is authentication implemented?
**Answer**: Username/password authentication using bcrypt password hashing. On successful login, a JWT (HS256) token is issued with claims: `sub` (user_id), `username`, `role`. All protected endpoints use a `get_current_user` FastAPI dependency that decodes and validates the JWT.

---

### Q36: What roles does the system support?
**Answer**: Six roles: `admin` (full access), `operator` (task/agent management), `auditor` (read-only audit), `viewer` (general read), `doctor` (clinical portal, task submission), `patient` (own records only).

---

### Q37: Is frontend route guarding sufficient for security?
**Answer**: **No.** Frontend route guards are a convenience, not security. A user can bypass frontend JavaScript entirely by calling the API directly. Security is enforced server-side via the `check_role()` FastAPI dependency on every sensitive endpoint, which validates the JWT role claim before processing any request.

---

### Q38: What is an IDOR attack and is this system vulnerable?
**Answer**: IDOR (Insecure Direct Object Reference) — accessing data by guessing or brute-forcing IDs. For example, a patient with ID `A` accessing records of patient with ID `B` by changing the URL. The current system has partial IDOR protection (role checks on endpoints) but does not enforce strict row-level security on every patient record endpoint. This is a noted limitation for production.

---

## Section G: Architecture

### Q39: What is the layered architecture?
**Answer**: 7 layers: (1) API — FastAPI routers. (2) Services — CRUD logic. (3) Domain — SQLAlchemy models + Pydantic schemas. (4) Orchestrator — workflow engine. (5) Agents — AI reasoning. (6) Crypto — SHA-256 + AES-GCM. (7) Output — MinIO storage + Fabric blockchain.

---

### Q40: Why SQLite in development and PostgreSQL in production?
**Answer**: SQLite requires zero configuration — no server needed. It allows any developer to run the project immediately. PostgreSQL is used for production because it supports concurrent connections, row-level locking, better indexing, and proper ACID compliance at scale. SQLAlchemy abstracts the difference — switching is a one-line `DATABASE_URL` change.

---

### Q41: Why use MinIO instead of storing encrypted data in PostgreSQL?
**Answer**: PostgreSQL is a relational database optimized for structured data queries. Storing large encrypted blobs in a BLOB column degrades database performance. MinIO is an object store optimized for large binary objects, with an S3-compatible API that allows future migration to AWS S3 if needed.

---

### Q42: Why is FastAPI used instead of Django?
**Answer**: FastAPI is built on Python `asyncio`. All database operations, Groq API calls, and MinIO operations are I/O-bound — async handles them without blocking. FastAPI also auto-generates Swagger/ReDoc documentation from Pydantic schemas and has native Pydantic integration. Django would require significant async configuration.

---

## Section H: Data Flow

### Q43: Trace one complete request from doctor to blockchain.
**Answer**:
1. Doctor logs in → gets JWT with `role: "doctor"`.
2. Doctor submits case → `POST /api/tasks` → Task created in DB.
3. `POST /api/tasks/{id}/execute` → `run_workflow()` called.
4. Supervisor runs → selects agents.
5. Each agent executes → Pydantic-validated JSON output.
6. `canonical_json(output)` → `compute_sha256()` → hash.
7. `encrypt_json(canonical_json)` → bytes → `MinIO.put_object()`.
8. `fabric_service.record_decision_proof(proof)` → gRPC → Fabric chaincode → ledger.
9. Verification: re-download → decrypt → re-hash → compare.
10. `calculate_consensus()` → score and status.
11. `WorkflowResult` returned → UI shows clinical summary + blockchain TX ID.

---

### Q44: What data is stored where?
**Answer**:

| Data | Storage Location |
|------|-----------------|
| User credentials (bcrypt) | PostgreSQL/SQLite — `users` table |
| Patient demographics | PostgreSQL/SQLite — `patients` table |
| Task definitions | PostgreSQL/SQLite — `tasks` table |
| AI agent outputs (plaintext) | NOT stored — only encrypted form |
| Encrypted AI outputs | MinIO (off-chain object storage) |
| SHA-256 hash of AI outputs | Hyperledger Fabric ledger + PostgreSQL `decision_proofs` |
| Audit events | PostgreSQL/SQLite — `audit_events` table |
| Trust scores history | PostgreSQL/SQLite — `trust_scores` table |

---

## Section I: Tests

### Q45: What does your test suite verify?
**Answer**: The `tests/verify_fixes.py` suite verifies behavioral properties: password hashing works correctly, JWT encoding/decoding works, SHA-256 canonical JSON produces consistent hashes, timing-safe comparison is used, AES-GCM encrypt/decrypt round-trips correctly, mock agents produce Pydantic-valid outputs, and consensus calculation is correct. It does NOT test live Fabric or live Groq.

---

### Q46: If all 49 tests pass, does that mean the system works end-to-end?
**Answer**: No. The 49 tests verify unit-level behavior of isolated components. They mock Fabric and Groq. They do not test a real Fabric network, real LLM calls, real MinIO, or a real end-to-end run from browser to blockchain. Integration and E2E tests are a future enhancement.

---

## Section J: Limitations and Future Work

### Q47: What is RAG and why isn't it implemented?
**Answer**: RAG (Retrieval Augmented Generation) is a technique where an LLM is given real documents retrieved from a vector database as context, rather than relying on training data. It would allow the Evidence agent to retrieve actual clinical guidelines (e.g., real ACC/AHA 2024 guidelines). It is NOT implemented — the Evidence agent currently relies on the LLM's training data, which may be outdated or hallucinated.

---

### Q48: What are the main limitations of the current system?
**Answer**:
1. Sequential agents only — no parallel execution.
2. No RAG — evidence agent hallucinates guidelines.
3. No agent memory across sessions.
4. No tool calling — agents cannot query databases.
5. Fabric gateway is a graceful stub (requires installed SDK + running network).
6. No Alembic migrations — schema changes require database recreation.
7. Keys stored in `.env` — no production-grade secret management.
8. No row-level security for patient IDOR protection.
9. Critic findings don't trigger re-analysis.

---

### Q49: How would you add parallel agent execution?
**Answer**: Replace the sequential `for` loop in `workflow.py` with `asyncio.gather()`:
```python
tasks = [agent.execute(task_data) for agent in agents.values()]
outputs = await asyncio.gather(*tasks, return_exceptions=True)
```
But careful: agents that depend on previous outputs (like Synthesizer reading all outputs) cannot be parallelized with those dependencies.

---

### Q50: What is the academic contribution of this project?
**Answer**: The integration of a multi-agent clinical reasoning pipeline with a cryptographic provenance layer on a permissioned blockchain. Specifically: (1) applying SHA-256 + AES-GCM per-agent proof patterns in a clinical AI context, (2) demonstrating automated tamper detection via hash mismatch, (3) a benchmarking framework comparing centralized vs blockchain coordination overhead, and (4) a trust scoring mechanism for AI agent reliability.

---

## Section K: Demonstration

### Q51: What can you demonstrate live?
**Answer**: 
✅ Doctor login → doctor portal  
✅ Patient portal with role restriction  
✅ Submit clinical case → run 10-agent pipeline  
✅ View per-agent outputs in timeline  
✅ Show SHA-256 hash in decision proof  
✅ Tamper simulation → hash mismatch detected  
✅ Audit event log  
✅ Trust score history  
❌ Real Fabric TX (requires running network + installed SDK)  
❌ Real Groq inference (requires API key + mock disabled)

---

### Q52: How do you explain blockchain value to a non-technical examiner?
**Answer**: "Imagine a hospital prints an AI report and locks it in a sealed envelope in a bank vault. The bank records what was in the envelope. Later, if someone opens the envelope and changes the report, the bank can prove the contents were different. Our system does the same thing digitally — the blockchain is the bank vault. The hash is the sealed fingerprint. Any change to the AI report breaks the fingerprint, and our system immediately detects it."

---

### Q53: What is consensus in your system?
**Answer**: A weighted average of agent confidence scores, adjusted by verification status. Verifier gets weight 1.8, Synthesizer 2.0, Clinical Reasoning 1.5. Verified agents get a 10% bonus; unverified lose 20%. If `agreement_score >= CONSENSUS_THRESHOLD (0.7)` → "accepted"; if >= 0.5 → "warning"; else → "rejected". This is mathematical aggregation, NOT LLM-based negotiation.

---

### Q54: What is trust scoring?
**Answer**: Each agent has a `trust_score` starting at 100.0. Successful verifications increase the score; hash mismatches, schema failures, and anomalies decrease it. Score bands: trusted (>90), normal (70-90), warning (50-70), suspicious (30-50), critical (<30). Trust measures **integrity and reliability**, NOT medical accuracy.

---

### Q55: If you had more time, what would you add first?
**Answer**: RAG implementation for the Evidence Agent — connecting a vector database (e.g., ChromaDB) with real clinical guidelines (AHA, CDC, NICE). This would directly address the hallucination risk in evidence retrieval and would significantly strengthen the clinical safety story.
