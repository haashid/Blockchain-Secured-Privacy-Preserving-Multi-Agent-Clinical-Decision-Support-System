package main

import (
	"encoding/json"
	"fmt"
	"strings"

	"github.com/hyperledger/fabric-contract-api-go/contractapi"
)

// AICoordinationContract provides functions for multi-agent coordination on blockchain
type AICoordinationContract struct {
	contractapi.Contract
}

// ─── Helper: GetCallerIdentity ─────────────────────────────────────

func getCallerMSP(ctx contractapi.TransactionContextInterface) (string, error) {
	return ctx.GetClientIdentity().GetMSPID()
}

func getCallerID(ctx contractapi.TransactionContextInterface) (string, error) {
	return ctx.GetClientIdentity().GetID()
}

func putState(ctx contractapi.TransactionContextInterface, key string, value interface{}) error {
	data, err := json.Marshal(value)
	if err != nil {
		return fmt.Errorf("failed to marshal: %v", err)
	}
	return ctx.GetStub().PutState(key, data)
}

func getState(ctx contractapi.TransactionContextInterface, key string) ([]byte, error) {
	return ctx.GetStub().GetState(key)
}

// ═══════════════════════════════════════════════════════════════════
// Agent Transactions
// ═══════════════════════════════════════════════════════════════════

// RegisterAgent registers a new AI agent on the ledger
func (c *AICoordinationContract) RegisterAgent(
	ctx contractapi.TransactionContextInterface,
	agentID string,
	displayName string,
	role string,
	organization string,
	capabilitiesJSON string,
) error {
	// Validate caller
	callerMSP, err := getCallerMSP(ctx)
	if err != nil {
		return fmt.Errorf("failed to get caller identity: %v", err)
	}
	if callerMSP != organization {
		return fmt.Errorf("unauthorized: caller MSP %s does not match organization %s", callerMSP, organization)
	}

	// Validate inputs
	if err := validateAgentID(agentID); err != nil {
		return err
	}
	if role == "" {
		return fmt.Errorf("role is required")
	}

	// Check duplicate
	key := fmt.Sprintf("agent~%s", agentID)
	existing, err := getState(ctx, key)
	if err != nil {
		return err
	}
	if existing != nil {
		return fmt.Errorf("agent %s already registered", agentID)
	}

	var caps []string
	if capabilitiesJSON != "" {
		json.Unmarshal([]byte(capabilitiesJSON), &caps)
	}

	agent := AgentRecord{
		DocType:      "agent",
		AgentID:      agentID,
		DisplayName:  displayName,
		Role:         role,
		Organization: organization,
		Status:       "active",
		TrustScore:   100.0,
		Capabilities: caps,
		CreatedAt:    now(),
		LastSeenAt:   now(),
	}

	if err := putState(ctx, key, agent); err != nil {
		return err
	}

	// Update stats
	return c.incrementStat(ctx, "agentCount")
}

// GetAgent retrieves an agent record
func (c *AICoordinationContract) GetAgent(
	ctx contractapi.TransactionContextInterface,
	agentID string,
) (string, error) {
	key := fmt.Sprintf("agent~%s", agentID)
	data, err := getState(ctx, key)
	if err != nil {
		return "", err
	}
	if data == nil {
		return "", fmt.Errorf("agent %s not found", agentID)
	}
	return string(data), nil
}

// ListAgents returns all registered agents
func (c *AICoordinationContract) ListAgents(
	ctx contractapi.TransactionContextInterface,
) (string, error) {
	resultsIterator, err := ctx.GetStub().GetStateByRange("agent~", "agent~~")
	if err != nil {
		return "", err
	}
	defer resultsIterator.Close()

	var agents []AgentRecord
	for resultsIterator.HasNext() {
		queryResponse, err := resultsIterator.Next()
		if err != nil {
			return "", err
		}
		var agent AgentRecord
		if err := json.Unmarshal(queryResponse.Value, &agent); err != nil {
			continue
		}
		agents = append(agents, agent)
	}

	data, _ := json.Marshal(agents)
	return string(data), nil
}

// ═══════════════════════════════════════════════════════════════════
// Task Transactions
// ═══════════════════════════════════════════════════════════════════

// CreateTask records a new task on the ledger
func (c *AICoordinationContract) CreateTask(
	ctx contractapi.TransactionContextInterface,
	taskID string,
	title string,
	domain string,
	priority string,
) error {
	if err := validateTaskID(taskID); err != nil {
		return err
	}

	key := fmt.Sprintf("task~%s", taskID)
	existing, _ := getState(ctx, key)
	if existing != nil {
		return fmt.Errorf("task %s already exists", taskID)
	}

	callerID, _ := getCallerID(ctx)

	task := TaskRecord{
		DocType:   "task",
		TaskID:    taskID,
		Title:     title,
		Domain:    domain,
		Priority:  priority,
		Status:    "pending",
		CreatedBy: callerID,
		CreatedAt: now(),
	}

	if err := putState(ctx, key, task); err != nil {
		return err
	}
	return c.incrementStat(ctx, "taskCount")
}

// GetTask retrieves a task record
func (c *AICoordinationContract) GetTask(
	ctx contractapi.TransactionContextInterface,
	taskID string,
) (string, error) {
	key := fmt.Sprintf("task~%s", taskID)
	data, err := getState(ctx, key)
	if err != nil {
		return "", err
	}
	if data == nil {
		return "", fmt.Errorf("task %s not found", taskID)
	}
	return string(data), nil
}

// UpdateTaskStatus updates the status of a task
func (c *AICoordinationContract) UpdateTaskStatus(
	ctx contractapi.TransactionContextInterface,
	taskID string,
	newStatus string,
) error {
	if !validTaskStatuses[newStatus] {
		return fmt.Errorf("invalid status: %s", newStatus)
	}

	key := fmt.Sprintf("task~%s", taskID)
	data, err := getState(ctx, key)
	if err != nil {
		return err
	}
	if data == nil {
		return fmt.Errorf("task %s not found", taskID)
	}

	var task TaskRecord
	json.Unmarshal(data, &task)
	task.Status = newStatus
	return putState(ctx, key, task)
}

// ═══════════════════════════════════════════════════════════════════
// Decision Proof Transactions
// ═══════════════════════════════════════════════════════════════════

// RecordDecisionProof registers a decision proof (hash) on the ledger
func (c *AICoordinationContract) RecordDecisionProof(
	ctx contractapi.TransactionContextInterface,
	proofID string,
	taskID string,
	runID string,
	agentID string,
	agentRole string,
	organization string,
	contentHash string,
	storageReference string,
	confidenceJSON string,
) error {
	// Validate caller
	callerMSP, err := getCallerMSP(ctx)
	if err != nil {
		return err
	}
	if callerMSP != organization {
		return fmt.Errorf("unauthorized: caller MSP %s does not match organization %s", callerMSP, organization)
	}

	// Validate hash
	if err := validateHash(contentHash); err != nil {
		return err
	}

	// Check duplicate proof
	key := fmt.Sprintf("proof~%s", proofID)
	existing, _ := getState(ctx, key)
	if existing != nil {
		return fmt.Errorf("proof %s already exists", proofID)
	}

	var confidence float64
	fmt.Sscanf(confidenceJSON, "%f", &confidence)

	proof := DecisionProof{
		DocType:          "proof",
		ProofID:          proofID,
		TaskID:           taskID,
		RunID:            runID,
		AgentID:          agentID,
		AgentRole:        agentRole,
		Organization:     organization,
		ContentHash:      contentHash,
		HashAlgorithm:    "SHA-256",
		StorageReference: storageReference,
		OutputVersion:    1,
		Status:           "submitted",
		Confidence:       confidence,
		Timestamp:        now(),
	}

	if err := putState(ctx, key, proof); err != nil {
		return err
	}
	return c.incrementStat(ctx, "proofCount")
}

// GetDecisionProof retrieves a decision proof
func (c *AICoordinationContract) GetDecisionProof(
	ctx contractapi.TransactionContextInterface,
	proofID string,
) (string, error) {
	key := fmt.Sprintf("proof~%s", proofID)
	data, err := getState(ctx, key)
	if err != nil {
		return "", err
	}
	if data == nil {
		return "", fmt.Errorf("proof %s not found", proofID)
	}
	return string(data), nil
}

// GetDecisionProofsByTask returns all proofs for a given task
func (c *AICoordinationContract) GetDecisionProofsByTask(
	ctx contractapi.TransactionContextInterface,
	taskID string,
) (string, error) {
	resultsIterator, err := ctx.GetStub().GetStateByRange("proof~", "proof~~")
	if err != nil {
		return "", err
	}
	defer resultsIterator.Close()

	var proofs []DecisionProof
	for resultsIterator.HasNext() {
		queryResponse, err := resultsIterator.Next()
		if err != nil {
			continue
		}
		var proof DecisionProof
		if err := json.Unmarshal(queryResponse.Value, &proof); err != nil {
			continue
		}
		if proof.TaskID == taskID {
			proofs = append(proofs, proof)
		}
	}

	data, _ := json.Marshal(proofs)
	return string(data), nil
}

// VerifyDecisionReference checks that a proof exists and its hash matches
func (c *AICoordinationContract) VerifyDecisionReference(
	ctx contractapi.TransactionContextInterface,
	proofID string,
	expectedHash string,
) (string, error) {
	key := fmt.Sprintf("proof~%s", proofID)
	data, err := getState(ctx, key)
	if err != nil {
		return "", err
	}
	if data == nil {
		return "", fmt.Errorf("proof %s not found", proofID)
	}

	var proof DecisionProof
	json.Unmarshal(data, &proof)

	result := map[string]interface{}{
		"proofId":        proofID,
		"blockchainHash": proof.ContentHash,
		"providedHash":   expectedHash,
		"match":          proof.ContentHash == expectedHash,
		"status":         proof.Status,
	}

	matchData, _ := json.Marshal(result)
	return string(matchData), nil
}

// ═══════════════════════════════════════════════════════════════════
// Verification Transactions
// ═══════════════════════════════════════════════════════════════════

// RecordVerification stores a verification result
func (c *AICoordinationContract) RecordVerification(
	ctx contractapi.TransactionContextInterface,
	verificationID string,
	proofID string,
	verified bool,
	blockchainHash string,
	computedHash string,
	agentID string,
	failuresJSON string,
) error {
	key := fmt.Sprintf("verification~%s", verificationID)
	existing, _ := getState(ctx, key)
	if existing != nil {
		return fmt.Errorf("verification %s already exists", verificationID)
	}

	var failures []string
	if failuresJSON != "" {
		json.Unmarshal([]byte(failuresJSON), &failures)
	}

	verification := VerificationRecord{
		DocType:        "verification",
		VerificationID: verificationID,
		ProofID:        proofID,
		Verified:       verified,
		BlockchainHash: blockchainHash,
		ComputedHash:   computedHash,
		HashAlgorithm:  "SHA-256",
		AgentID:        agentID,
		Failures:       failures,
		VerifiedAt:     now(),
	}

	if err := putState(ctx, key, verification); err != nil {
		return err
	}
	return c.incrementStat(ctx, "verificationCount")
}

// GetVerification retrieves a verification record
func (c *AICoordinationContract) GetVerification(
	ctx contractapi.TransactionContextInterface,
	verificationID string,
) (string, error) {
	key := fmt.Sprintf("verification~%s", verificationID)
	data, err := getState(ctx, key)
	if err != nil {
		return "", err
	}
	if data == nil {
		return "", fmt.Errorf("verification %s not found", verificationID)
	}
	return string(data), nil
}

// ═══════════════════════════════════════════════════════════════════
// Audit Transactions
// ═══════════════════════════════════════════════════════════════════

// RecordAuditEvent stores an audit event on the ledger
func (c *AICoordinationContract) RecordAuditEvent(
	ctx contractapi.TransactionContextInterface,
	eventID string,
	eventType string,
	agentID string,
	organization string,
	taskID string,
	status string,
	detailsJSON string,
) error {
	key := fmt.Sprintf("audit~%s", eventID)

	var details map[string]interface{}
	if detailsJSON != "" {
		json.Unmarshal([]byte(detailsJSON), &details)
	}

	event := AuditEvent{
		DocType:      "audit",
		EventID:      eventID,
		EventType:    eventType,
		AgentID:      agentID,
		Organization: organization,
		TaskID:       taskID,
		Status:       status,
		Details:      details,
		Timestamp:    now(),
	}

	if err := putState(ctx, key, event); err != nil {
		return err
	}
	return c.incrementStat(ctx, "auditCount")
}

// GetAuditEvents returns all audit events (with optional type filter)
func (c *AICoordinationContract) GetAuditEvents(
	ctx contractapi.TransactionContextInterface,
	eventType string,
) (string, error) {
	resultsIterator, err := ctx.GetStub().GetStateByRange("audit~", "audit~~")
	if err != nil {
		return "", err
	}
	defer resultsIterator.Close()

	var events []AuditEvent
	for resultsIterator.HasNext() {
		queryResponse, err := resultsIterator.Next()
		if err != nil {
			continue
		}
		var event AuditEvent
		if err := json.Unmarshal(queryResponse.Value, &event); err != nil {
			continue
		}
		if eventType == "" || event.EventType == eventType {
			events = append(events, event)
		}
	}

	data, _ := json.Marshal(events)
	return string(data), nil
}

// ═══════════════════════════════════════════════════════════════════
// Trust Transactions
// ═══════════════════════════════════════════════════════════════════

// UpdateAgentTrust updates an agent's trust score and records the change
func (c *AICoordinationContract) UpdateAgentTrust(
	ctx contractapi.TransactionContextInterface,
	agentID string,
	newScore float64,
	reason string,
	riskLevel string,
) error {
	if !validRiskLevels[riskLevel] {
		return fmt.Errorf("invalid risk level: %s", riskLevel)
	}

	// Get current agent
	agentKey := fmt.Sprintf("agent~%s", agentID)
	agentData, err := getState(ctx, agentKey)
	if err != nil {
		return err
	}
	if agentData == nil {
		return fmt.Errorf("agent %s not found", agentID)
	}

	var agent AgentRecord
	json.Unmarshal(agentData, &agent)

	previousScore := agent.TrustScore
	// Clamp 0-100
	if newScore < 0 {
		newScore = 0
	}
	if newScore > 100 {
		newScore = 100
	}
	agent.TrustScore = newScore
	agent.LastSeenAt = now()

	// Save updated agent
	if err := putState(ctx, agentKey, agent); err != nil {
		return err
	}

	// Create trust record
	trustID := fmt.Sprintf("trust~%s~%s", agentID, now())
	trust := TrustRecord{
		DocType:       "trust",
		TrustID:       trustID,
		AgentID:       agentID,
		PreviousScore: previousScore,
		NewScore:      newScore,
		Delta:         newScore - previousScore,
		Reason:        reason,
		RiskLevel:     riskLevel,
		CreatedAt:     now(),
	}

	trustKey := fmt.Sprintf("trust~%s", trustID)
	if err := putState(ctx, trustKey, trust); err != nil {
		return err
	}
	return c.incrementStat(ctx, "trustCount")
}

// ═══════════════════════════════════════════════════════════════════
// Statistics
// ═══════════════════════════════════════════════════════════════════

// GetLedgerStats returns aggregate statistics
func (c *AICoordinationContract) GetLedgerStats(
	ctx contractapi.TransactionContextInterface,
) (string, error) {
	stats := LedgerStats{DocType: "stats"}

	// Count agents
	if data, err := getState(ctx, "_stat~agentCount"); err == nil && data != nil {
		fmt.Sscanf(string(data), "%d", &stats.TotalAgents)
	}
	if data, err := getState(ctx, "_stat~taskCount"); err == nil && data != nil {
		fmt.Sscanf(string(data), "%d", &stats.TotalTasks)
	}
	if data, err := getState(ctx, "_stat~proofCount"); err == nil && data != nil {
		fmt.Sscanf(string(data), "%d", &stats.TotalProofs)
	}
	if data, err := getState(ctx, "_stat~verificationCount"); err == nil && data != nil {
		fmt.Sscanf(string(data), "%d", &stats.TotalVerifications)
	}
	if data, err := getState(ctx, "_stat~auditCount"); err == nil && data != nil {
		fmt.Sscanf(string(data), "%d", &stats.TotalAuditEvents)
	}
	if data, err := getState(ctx, "_stat~trustCount"); err == nil && data != nil {
		fmt.Sscanf(string(data), "%d", &stats.TotalTrustUpdates)
	}

	data, _ := json.Marshal(stats)
	return string(data), nil
}

func (c *AICoordinationContract) incrementStat(ctx contractapi.TransactionContextInterface, statKey string) error {
	key := "_stat~" + statKey
	data, _ := getState(ctx, key)
	count := 0
	if data != nil {
		fmt.Sscanf(string(data), "%d", &count)
	}
	count++
	return ctx.GetStub().PutState(key, []byte(fmt.Sprintf("%d", count)))
}

// InitLedger seeds the ledger with initial data
func (c *AICoordinationContract) InitLedger(ctx contractapi.TransactionContextInterface) error {
	c.GetLedgerStats(ctx)
	return nil
}

// ═══════════════════════════════════════════════════════════════════
// Main entry point
// ═══════════════════════════════════════════════════════════════════

func main() {
	chaincode, err := contractapi.NewChaincode(&AICoordinationContract{})
	if err != nil {
		fmt.Printf("Error creating chaincode: %s", err.Error())
		return
	}

	if err := chaincode.Start(); err != nil {
		fmt.Printf("Error starting chaincode: %s", err.Error())
	}
}

// Suppress unused import warnings
var _ = strings.TrimSpace
