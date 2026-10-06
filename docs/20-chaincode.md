# 20 — Go Chaincode Reference

**File**: `blockchain/chaincode/contract.go`  
**Language**: Go 1.21+  
**Contract name**: `clinical-decision-cc`  
**Package**: `main`

---

## Chaincode Overview

Hyperledger Fabric chaincode is the "smart contract" layer — Go code that runs inside isolated containers on each peer and defines what can be stored on the ledger and who can do what.

This chaincode implements:
1. **Agent registration** — recording which AI agents are enrolled.
2. **Task recording** — logging clinical analysis tasks.
3. **Decision proof recording** — the core: per-agent cryptographic hashes.
4. **Verification** — querying and verifying proofs.
5. **Audit events** — recording compliance events.
6. **Rich queries** — CouchDB JSON queries for history.

---

## Transaction Functions

### `RegisterAgent`
**Called when**: An AI agent is enrolled in the system.
```go
func (s *SmartContract) RegisterAgent(ctx contractapi.TransactionContextInterface,
    agentID string, role string, organization string,
    enrollmentID string, mspID string) error
```
**Stores**: `agent:{agentID}` → JSON with identity, role, MSP, timestamp.

---

### `RecordTask`
**Called when**: A new clinical task is created.
```go
func (s *SmartContract) RecordTask(ctx contractapi.TransactionContextInterface,
    taskID string, agentID string, organization string) error
```
**Stores**: `task:{taskID}` → basic task metadata.

---

### `RecordDecisionProof` ⭐ CORE FUNCTION
**Called when**: An agent completes execution and its output is hashed.

```go
func (s *SmartContract) RecordDecisionProof(ctx contractapi.TransactionContextInterface,
    proofID string,
    taskID string,
    runID string,
    agentID string,
    agentRole string,
    organization string,
    contentHash string,       // ← SHA-256 hex of agent output
    hashAlgorithm string,     // "SHA-256"
    storageReference string,  // MinIO path to encrypted blob
    outputVersion int,
    confidence float64,
) error
```

**Stores**: `proof:{proofID}` → `DecisionProof` struct.

**Access control**: Only authorized organizations (from `ctx.GetClientIdentity().GetMSPID()`) can submit.

---

### `GetDecisionProof`
**Called when**: Verification or audit needs to retrieve a proof.
```go
func (s *SmartContract) GetDecisionProof(ctx..., proofID string) (*DecisionProof, error)
```
**Returns**: Full `DecisionProof` struct from world state.

---

### `VerifyDecisionProof`
**Called when**: The system verifies a stored output against its hash.
```go
func (s *SmartContract) VerifyDecisionProof(ctx...,
    proofID string,
    computedHash string,          // Re-computed hash from decrypted MinIO data
    verifierAgentID string,
) (*VerificationResult, error)
```
**Stores**: `verification:{proofID}:{txID}` → `VerificationRecord`.
**Returns**: `VerificationResult` with `verified: true/false`.

---

### `RecordAuditEvent`
**Called when**: Any significant system event occurs (agent start, completion, anomaly).
```go
func (s *SmartContract) RecordAuditEvent(ctx...,
    eventType string,
    agentID string,
    organization string,
    taskID string,
    runID string,
    proofID string,
    status string,
    details string,     // JSON string of event details
) error
```
**Stores**: `audit:{timestamp}:{txID}` → `AuditEvent` struct.

---

### `GetTaskHistory`
**Called when**: Viewing the full audit history of a task.
```go
func (s *SmartContract) GetTaskHistory(ctx..., taskID string) ([]*DecisionProof, error)
```
**Uses**: CouchDB rich JSON query — `{"selector": {"task_id": taskID}}`.

---

### `GetProofsByAgent`
**Called when**: Auditing all decisions by a specific agent.
```go
func (s *SmartContract) GetProofsByAgent(ctx..., agentID string) ([]*DecisionProof, error)
```

---

### `GetAgentAuditTrail`
**Called when**: Investigating an agent's complete blockchain history.
```go
func (s *SmartContract) GetAgentAuditTrail(ctx..., agentID string) ([]*AuditEvent, error)
```

---

## Chaincode Asset Structs (`models.go`)

```go
// Stored on ledger as JSON
type DecisionProof struct {
    ProofID          string    `json:"proof_id"`
    DocType          string    `json:"doc_type"`     // "decision_proof"
    TaskID           string    `json:"task_id"`
    RunID            string    `json:"run_id"`
    AgentID          string    `json:"agent_id"`
    AgentRole        string    `json:"agent_role"`
    Organization     string    `json:"organization"`
    ContentHash      string    `json:"content_hash"`  // SHA-256
    HashAlgorithm    string    `json:"hash_algorithm"`// "SHA-256"
    StorageReference string    `json:"storage_reference"` // MinIO path
    OutputVersion    int       `json:"output_version"`
    Status           string    `json:"status"`        // "submitted"/"verified"
    Confidence       float64   `json:"confidence"`
    SubmittedAt      time.Time `json:"submitted_at"`
    SubmittedBy      string    `json:"submitted_by"`  // MSP ID
}

type VerificationRecord struct {
    ProofID          string    `json:"proof_id"`
    Verified         bool      `json:"verified"`
    ComputedHash     string    `json:"computed_hash"`
    BlockchainHash   string    `json:"blockchain_hash"`
    TransactionID    string    `json:"transaction_id"`
    VerifierAgentID  string    `json:"verifier_agent_id"`
    VerifiedAt       time.Time `json:"verified_at"`
}

type AuditEvent struct {
    EventType    string    `json:"event_type"`
    AgentID      string    `json:"agent_id"`
    Organization string    `json:"organization"`
    TaskID       string    `json:"task_id"`
    RunID        string    `json:"run_id"`
    ProofID      string    `json:"proof_id"`
    Status       string    `json:"status"`
    Details      string    `json:"details"`   // JSON string
    Timestamp    time.Time `json:"timestamp"`
}
```

---

## Ledger Key Schema

| Asset Type | Ledger Key Format | Example |
|-----------|-------------------|---------|
| Agent | `agent:{agentID}` | `agent:agent-clinical_reasoning-01` |
| Task | `task:{taskID}` | `task:abc123...` |
| Proof | `proof:{proofID}` | `proof-abc123-clinical_reasoning` |
| Verification | `verification:{proofID}:{txID}` | |
| Audit Event | `audit:{timestamp}:{txID}` | |

---

## Deploying the Chaincode

```bash
# 1. Package
peer lifecycle chaincode package clinical-decision-cc.tar.gz \
  --path ./chaincode \
  --lang golang \
  --label clinical-decision-cc_1

# 2. Install on each peer
peer lifecycle chaincode install clinical-decision-cc.tar.gz

# 3. Approve (both orgs)
peer lifecycle chaincode approveformyorg \
  --channelID mychannel \
  --name clinical-decision-cc \
  --version 1 \
  --sequence 1

# 4. Commit to channel
peer lifecycle chaincode commit \
  --channelID mychannel \
  --name clinical-decision-cc \
  --version 1 \
  --sequence 1

# 5. Verify
peer chaincode list --installed
peer lifecycle chaincode querycommitted --channelID mychannel
```
