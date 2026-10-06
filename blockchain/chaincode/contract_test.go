package main

import (
	"encoding/json"
	"testing"

	"github.com/hyperledger/fabric-chaincode-go/shimtest"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func setupTest(t *testing.T) (*shimtest.MockStub, *AICoordinationContract) {
	t.Helper()
	cc := new(AICoordinationContract)
	stub := shimtest.NewMockStub("ai-coordination", cc)
	stub.MockInit("1", nil)
	return stub, cc
}

func invoke(t *testing.T, stub *shimtest.MockStub, args ...string) {
	t.Helper()
	res := stub.MockInvoke("tx1", toChaincodeArgs(args...))
	require.EqualValuesf(t, 200, res.Status, "invoke %s failed: %s", args[0], res.Message)
}

func toChaincodeArgs(args ...string) [][]byte {
	bargs := make([][]byte, len(args))
	for i, v := range args {
		bargs[i] = []byte(v)
	}
	return bargs
}

// ═══════════════════════════════════════════════════════════════════
// Agent Tests
// ═══════════════════════════════════════════════════════════════════

func TestRegisterAgent_Success(t *testing.T) {
	stub, _ := setupTest(t)
	// Set caller MSP identity
	stub.MockTransactionStart("tx1")
	stub.GetMockCaller().Set("MSPID", "Org1MSP")
	stub.MockTransactionEnd("tx1")

	res := stub.MockInvoke("tx2", toChaincodeArgs(
		"RegisterAgent", "agent-reasoning-01", "Clinical Reasoning",
		"clinical_reasoning", "Org1MSP", `["symptom_analysis"]`,
	))
	assert.EqualValues(t, 200, res.Status, "Should register agent successfully")
}

func TestRegisterAgent_Duplicate(t *testing.T) {
	stub, _ := setupTest(t)
	stub.MockTransactionStart("tx1")
	stub.GetMockCaller().Set("MSPID", "Org1MSP")
	stub.MockTransactionEnd("tx1")

	invoke(t, stub, "RegisterAgent", "agent-test-01", "Test Agent", "research", "Org1MSP", `[]`)
	res := stub.MockInvoke("tx2", toChaincodeArgs(
		"RegisterAgent", "agent-test-01", "Test Agent", "research", "Org1MSP", `[]`,
	))
	assert.NotEqualValues(t, 200, res.Status, "Should reject duplicate agent")
}

func TestRegisterAgent_UnauthorizedMSP(t *testing.T) {
	stub, _ := setupTest(t)
	stub.MockTransactionStart("tx1")
	stub.GetMockCaller().Set("MSPID", "Org2MSP")
	stub.MockTransactionEnd("tx1")

	res := stub.MockInvoke("tx2", toChaincodeArgs(
		"RegisterAgent", "agent-test-01", "Test", "research", "Org1MSP", `[]`,
	))
	assert.NotEqualValues(t, 200, res.Status, "Should reject unauthorized MSP")
}

func TestGetAgent(t *testing.T) {
	stub, _ := setupTest(t)
	stub.MockTransactionStart("tx1")
	stub.GetMockCaller().Set("MSPID", "Org1MSP")
	stub.MockTransactionEnd("tx1")

	invoke(t, stub, "RegisterAgent", "agent-get-01", "Get Test", "research", "Org1MSP", `[]`)
	res := stub.MockInvoke("tx2", toChaincodeArgs("GetAgent", "agent-get-01"))
	assert.EqualValues(t, 200, res.Status)

	var agent AgentRecord
	json.Unmarshal(res.Payload, &agent)
	assert.Equal(t, "agent-get-01", agent.AgentID)
	assert.Equal(t, 100.0, agent.TrustScore)
}

func TestGetAgent_NotFound(t *testing.T) {
	stub, _ := setupTest(t)
	res := stub.MockInvoke("tx1", toChaincodeArgs("GetAgent", "agent-nonexistent"))
	assert.NotEqualValues(t, 200, res.Status)
}

func TestListAgents(t *testing.T) {
	stub, _ := setupTest(t)
	stub.MockTransactionStart("tx1")
	stub.GetMockCaller().Set("MSPID", "Org1MSP")
	stub.MockTransactionEnd("tx1")

	invoke(t, stub, "RegisterAgent", "agent-list-01", "Agent 1", "research", "Org1MSP", `[]`)
	invoke(t, stub, "RegisterAgent", "agent-list-02", "Agent 2", "analysis", "Org1MSP", `[]`)

	res := stub.MockInvoke("tx3", toChaincodeArgs("ListAgents"))
	assert.EqualValues(t, 200, res.Status)

	var agents []AgentRecord
	json.Unmarshal(res.Payload, &agents)
	assert.GreaterOrEqual(t, len(agents), 2)
}

// ═══════════════════════════════════════════════════════════════════
// Task Tests
// ═══════════════════════════════════════════════════════════════════

func TestCreateTask_Success(t *testing.T) {
	stub, _ := setupTest(t)
	res := stub.MockInvoke("tx1", toChaincodeArgs(
		"CreateTask", "task-001", "Clinical Case Review", "healthcare", "high",
	))
	assert.EqualValues(t, 200, res.Status)
}

func TestCreateTask_Duplicate(t *testing.T) {
	stub, _ := setupTest(t)
	invoke(t, stub, "CreateTask", "task-dup", "Task", "healthcare", "medium")
	res := stub.MockInvoke("tx2", toChaincodeArgs("CreateTask", "task-dup", "Task 2", "healthcare", "low"))
	assert.NotEqualValues(t, 200, res.Status, "Should reject duplicate task")
}

func TestGetTask(t *testing.T) {
	stub, _ := setupTest(t)
	invoke(t, stub, "CreateTask", "task-get", "Get Task", "healthcare", "high")
	res := stub.MockInvoke("tx2", toChaincodeArgs("GetTask", "task-get"))
	assert.EqualValues(t, 200, res.Status)

	var task TaskRecord
	json.Unmarshal(res.Payload, &task)
	assert.Equal(t, "pending", task.Status)
}

func TestUpdateTaskStatus(t *testing.T) {
	stub, _ := setupTest(t)
	invoke(t, stub, "CreateTask", "task-upd", "Update Task", "healthcare", "medium")
	invoke(t, stub, "UpdateTaskStatus", "task-upd", "running")
	res := stub.MockInvoke("tx3", toChaincodeArgs("GetTask", "task-upd"))
	var task TaskRecord
	json.Unmarshal(res.Payload, &task)
	assert.Equal(t, "running", task.Status)
}

func TestUpdateTaskStatus_Invalid(t *testing.T) {
	stub, _ := setupTest(t)
	invoke(t, stub, "CreateTask", "task-inv", "Invalid Task", "healthcare", "low")
	res := stub.MockInvoke("tx2", toChaincodeArgs("UpdateTaskStatus", "task-inv", "bogus_status"))
	assert.NotEqualValues(t, 200, res.Status)
}

// ═══════════════════════════════════════════════════════════════════
// Decision Proof Tests
// ═══════════════════════════════════════════════════════════════════

func TestRecordDecisionProof_Success(t *testing.T) {
	stub, _ := setupTest(t)
	stub.MockTransactionStart("tx1")
	stub.GetMockCaller().Set("MSPID", "Org1MSP")
	stub.MockTransactionEnd("tx1")

	hash := "a92c8f5e1b3d7c6a4e2f8b0d9c7a5e3f1b6d4c8a2e0f7b9d5c3a1e8f4b6d2c0"
	res := stub.MockInvoke("tx2", toChaincodeArgs(
		"RecordDecisionProof", "proof-001", "task-001", "run-001",
		"agent-reasoning-01", "clinical_reasoning", "Org1MSP",
		hash, "storage/tasks/001/output.enc", "0.85",
	))
	assert.EqualValues(t, 200, res.Status)
}

func TestRecordDecisionProof_InvalidHash(t *testing.T) {
	stub, _ := setupTest(t)
	stub.MockTransactionStart("tx1")
	stub.GetMockCaller().Set("MSPID", "Org1MSP")
	stub.MockTransactionEnd("tx1")

	res := stub.MockInvoke("tx2", toChaincodeArgs(
		"RecordDecisionProof", "proof-002", "task-001", "run-001",
		"agent-reasoning-01", "clinical_reasoning", "Org1MSP",
		"not-a-valid-hash", "storage/path", "0.85",
	))
	assert.NotEqualValues(t, 200, res.Status, "Should reject invalid hash")
}

func TestRecordDecisionProof_Duplicate(t *testing.T) {
	stub, _ := setupTest(t)
	stub.MockTransactionStart("tx1")
	stub.GetMockCaller().Set("MSPID", "Org1MSP")
	stub.MockTransactionEnd("tx1")

	hash := "a92c8f5e1b3d7c6a4e2f8b0d9c7a5e3f1b6d4c8a2e0f7b9d5c3a1e8f4b6d2c0"
	invoke(t, stub, "RecordDecisionProof", "proof-dup", "task-001", "run-001",
		"agent-01", "research", "Org1MSP", hash, "path", "0.9")

	res := stub.MockInvoke("tx2", toChaincodeArgs(
		"RecordDecisionProof", "proof-dup", "task-001", "run-001",
		"agent-01", "research", "Org1MSP", hash, "path", "0.9",
	))
	assert.NotEqualValues(t, 200, res.Status, "Should reject duplicate proof")
}

func TestGetDecisionProof(t *testing.T) {
	stub, _ := setupTest(t)
	stub.MockTransactionStart("tx1")
	stub.GetMockCaller().Set("MSPID", "Org1MSP")
	stub.MockTransactionEnd("tx1")

	hash := "b92c8f5e1b3d7c6a4e2f8b0d9c7a5e3f1b6d4c8a2e0f7b9d5c3a1e8f4b6d2c1"
	invoke(t, stub, "RecordDecisionProof", "proof-get", "task-001", "run-001",
		"agent-01", "research", "Org1MSP", hash, "path", "0.9")

	res := stub.MockInvoke("tx2", toChaincodeArgs("GetDecisionProof", "proof-get"))
	assert.EqualValues(t, 200, res.Status)

	var proof DecisionProof
	json.Unmarshal(res.Payload, &proof)
	assert.Equal(t, "SHA-256", proof.HashAlgorithm)
	assert.Equal(t, "submitted", proof.Status)
}

func TestVerifyDecisionReference(t *testing.T) {
	stub, _ := setupTest(t)
	stub.MockTransactionStart("tx1")
	stub.GetMockCaller().Set("MSPID", "Org1MSP")
	stub.MockTransactionEnd("tx1")

	hash := "c92c8f5e1b3d7c6a4e2f8b0d9c7a5e3f1b6d4c8a2e0f7b9d5c3a1e8f4b6d2c2"
	invoke(t, stub, "RecordDecisionProof", "proof-verify", "task-001", "run-001",
		"agent-01", "research", "Org1MSP", hash, "path", "0.9")

	// Verify with correct hash
	res := stub.MockInvoke("tx2", toChaincodeArgs("VerifyDecisionReference", "proof-verify", hash))
	assert.EqualValues(t, 200, res.Status)
	var result map[string]interface{}
	json.Unmarshal(res.Payload, &result)
	assert.Equal(t, true, result["match"])

	// Verify with wrong hash
	res2 := stub.MockInvoke("tx3", toChaincodeArgs("VerifyDecisionReference", "proof-verify", "0000000000000000000000000000000000000000000000000000000000000000"))
	assert.EqualValues(t, 200, res2.Status)
	json.Unmarshal(res2.Payload, &result)
	assert.Equal(t, false, result["match"])
}

// ═══════════════════════════════════════════════════════════════════
// Trust Tests
// ═══════════════════════════════════════════════════════════════════

func TestUpdateAgentTrust(t *testing.T) {
	stub, _ := setupTest(t)
	stub.MockTransactionStart("tx1")
	stub.GetMockCaller().Set("MSPID", "Org1MSP")
	stub.MockTransactionEnd("tx1")

	invoke(t, stub, "RegisterAgent", "agent-trust-01", "Trust Test", "research", "Org1MSP", `[]`)
	invoke(t, stub, "UpdateAgentTrust", "agent-trust-01", "85.0", "Valid decision", "trusted")

	res := stub.MockInvoke("tx3", toChaincodeArgs("GetAgent", "agent-trust-01"))
	assert.EqualValues(t, 200, res.Status)
	var agent AgentRecord
	json.Unmarshal(res.Payload, &agent)
	assert.Equal(t, 85.0, agent.TrustScore)
}

func TestUpdateAgentTrust_ClampHigh(t *testing.T) {
	stub, _ := setupTest(t)
	stub.MockTransactionStart("tx1")
	stub.GetMockCaller().Set("MSPID", "Org1MSP")
	stub.MockTransactionEnd("tx1")

	invoke(t, stub, "RegisterAgent", "agent-clamp-01", "Clamp Test", "research", "Org1MSP", `[]`)
	invoke(t, stub, "UpdateAgentTrust", "agent-clamp-01", "120.0", "Over max", "trusted")

	res := stub.MockInvoke("tx3", toChaincodeArgs("GetAgent", "agent-clamp-01"))
	var agent AgentRecord
	json.Unmarshal(res.Payload, &agent)
	assert.Equal(t, 100.0, agent.TrustScore, "Should clamp to 100")
}

func TestUpdateAgentTrust_ClampLow(t *testing.T) {
	stub, _ := setupTest(t)
	stub.MockTransactionStart("tx1")
	stub.GetMockCaller().Set("MSPID", "Org1MSP")
	stub.MockTransactionEnd("tx1")

	invoke(t, stub, "RegisterAgent", "agent-clamp2-01", "Clamp Test 2", "research", "Org1MSP", `[]`)
	invoke(t, stub, "UpdateAgentTrust", "agent-clamp2-01", "-10.0", "Under min", "critical")

	res := stub.MockInvoke("tx3", toChaincodeArgs("GetAgent", "agent-clamp2-01"))
	var agent AgentRecord
	json.Unmarshal(res.Payload, &agent)
	assert.Equal(t, 0.0, agent.TrustScore, "Should clamp to 0")
}

// ═══════════════════════════════════════════════════════════════════
// Ledger Stats
// ═══════════════════════════════════════════════════════════════════

func TestGetLedgerStats(t *testing.T) {
	stub, _ := setupTest(t)
	stub.MockTransactionStart("tx1")
	stub.GetMockCaller().Set("MSPID", "Org1MSP")
	stub.MockTransactionEnd("tx1")

	invoke(t, stub, "RegisterAgent", "agent-stats-01", "Stats Test", "research", "Org1MSP", `[]`)
	invoke(t, stub, "CreateTask", "task-stats-01", "Stats Task", "healthcare", "medium")

	res := stub.MockInvoke("tx3", toChaincodeArgs("GetLedgerStats"))
	assert.EqualValues(t, 200, res.Status)

	var stats LedgerStats
	json.Unmarshal(res.Payload, &stats)
	assert.GreaterOrEqual(t, stats.TotalAgents, 1)
	assert.GreaterOrEqual(t, stats.TotalTasks, 1)
}
