// Package main - Hyperledger Fabric Chaincode for AI Coordination
// Provides on-chain registration of agents, tasks, decision proofs,
// verifications, audit events, and trust scores.
package main

import (
	"fmt"
	"regexp"
	"time"
)

// ═══════════════════════════════════════════════════════════════════
// Data Models
// ═══════════════════════════════════════════════════════════════════

// AgentRecord represents a registered AI agent on the ledger
type AgentRecord struct {
	DocType      string   `json:"docType"`
	AgentID      string   `json:"agentId"`
	DisplayName  string   `json:"displayName"`
	Role         string   `json:"role"`
	Organization string   `json:"organization"`
	Status       string   `json:"status"`
	TrustScore   float64  `json:"trustScore"`
	Capabilities []string `json:"capabilities"`
	CreatedAt    string   `json:"createdAt"`
	LastSeenAt   string   `json:"lastSeenAt"`
}

// TaskRecord represents a task on the ledger
type TaskRecord struct {
	DocType   string `json:"docType"`
	TaskID    string `json:"taskId"`
	Title     string `json:"title"`
	Domain    string `json:"domain"`
	Priority  string `json:"priority"`
	Status    string `json:"status"`
	CreatedBy string `json:"createdBy"`
	CreatedAt string `json:"createdAt"`
}

// DecisionProof records a SHA-256 hash proof of an agent's decision
type DecisionProof struct {
	DocType           string  `json:"docType"`
	ProofID           string  `json:"proofId"`
	TaskID            string  `json:"taskId"`
	RunID             string  `json:"runId"`
	AgentID           string  `json:"agentId"`
	AgentRole         string  `json:"agentRole"`
	Organization      string  `json:"organization"`
	ContentHash       string  `json:"contentHash"`
	HashAlgorithm     string  `json:"hashAlgorithm"`
	StorageReference  string  `json:"storageReference"`
	OutputVersion     int     `json:"outputVersion"`
	Status            string  `json:"status"`
	Confidence        float64 `json:"confidence"`
	FabricTxID        string  `json:"fabricTxId"`
	FabricBlockNumber int     `json:"fabricBlockNumber"`
	Timestamp         string  `json:"timestamp"`
}

// VerificationRecord stores verification results
type VerificationRecord struct {
	DocType            string            `json:"docType"`
	VerificationID     string            `json:"verificationId"`
	ProofID            string            `json:"proofId"`
	Verified           bool              `json:"verified"`
	BlockchainHash     string            `json:"blockchainHash"`
	ComputedHash       string            `json:"computedHash"`
	HashAlgorithm      string            `json:"hashAlgorithm"`
	TransactionID      string            `json:"transactionId"`
	AgentID            string            `json:"agentId"`
	VerificationChecks map[string]bool   `json:"verificationChecks"`
	Failures           []string          `json:"failures"`
	VerifiedAt         string            `json:"verifiedAt"`
}

// AuditEvent records an audit trail event
type AuditEvent struct {
	DocType       string                 `json:"docType"`
	EventID       string                 `json:"eventId"`
	EventType     string                 `json:"eventType"`
	AgentID       string                 `json:"agentId"`
	Organization  string                 `json:"organization"`
	TaskID        string                 `json:"taskId"`
	RunID         string                 `json:"runId"`
	ProofID       string                 `json:"proofId"`
	TransactionID string                 `json:"transactionId"`
	Status        string                 `json:"status"`
	Details       map[string]interface{} `json:"details"`
	Timestamp     string                 `json:"timestamp"`
}

// TrustRecord tracks trust score changes
type TrustRecord struct {
	DocType        string  `json:"docType"`
	TrustID        string  `json:"trustId"`
	AgentID        string  `json:"agentId"`
	PreviousScore  float64 `json:"previousScore"`
	NewScore       float64 `json:"newScore"`
	Delta          float64 `json:"delta"`
	Reason         string  `json:"reason"`
	RiskLevel      string  `json:"riskLevel"`
	AuditEventID   string  `json:"auditEventId"`
	CreatedAt      string  `json:"createdAt"`
}

// LedgerStats provides aggregate statistics
type LedgerStats struct {
	DocType          string `json:"docType"`
	TotalAgents      int    `json:"totalAgents"`
	TotalTasks       int    `json:"totalTasks"`
	TotalProofs      int    `json:"totalProofs"`
	TotalVerifications int  `json:"totalVerifications"`
	TotalAuditEvents int    `json:"totalAuditEvents"`
	TotalTrustUpdates int   `json:"totalTrustUpdates"`
}

// ═══════════════════════════════════════════════════════════════════
// Validation Helpers
// ═══════════════════════════════════════════════════════════════════

var hashRegex = regexp.MustCompile(`^[a-f0-9]{64}$`)
var validStatuses = map[string]bool{
	"active": true, "inactive": true, "suspended": true, "error": true,
}
var validProofStatuses = map[string]bool{
	"submitted": true, "verified": true, "invalid": true, "flagged": true,
}
var validTaskStatuses = map[string]bool{
	"pending": true, "running": true, "completed": true, "failed": true, "cancelled": true,
}
var validRiskLevels = map[string]bool{
	"trusted": true, "normal": true, "warning": true, "suspicious": true, "critical": true,
}

func validateHash(hash string) error {
	if !hashRegex.MatchString(hash) {
		return fmt.Errorf("invalid SHA-256 hash format: must be 64 lowercase hex characters")
	}
	return nil
}

func validateAgentID(id string) error {
	if len(id) < 3 || len(id) > 100 {
		return fmt.Errorf("invalid agent ID: length must be 3-100 characters")
	}
	return nil
}

func validateTaskID(id string) error {
	if len(id) < 1 || len(id) > 200 {
		return fmt.Errorf("invalid task ID")
	}
	return nil
}

func now() string {
	return time.Now().UTC().Format(time.RFC3339)
}
