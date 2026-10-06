"""Comprehensive behavioral verification for all fixes applied.

This script exercises the ACTUAL code paths and asserts real behavior,
not just compilation or import success.
"""
import asyncio
import json
import os
import sys
import time
import traceback

# Ensure backend is importable
try:
    _here = os.path.dirname(os.path.abspath(__file__))
except NameError:
    _here = os.path.abspath(os.getcwd())
_backend = os.path.normpath(os.path.join(_here, '..', 'backend'))
if not os.path.isdir(_backend):
    _backend = os.path.join(os.path.abspath(os.getcwd()), 'backend')
if _backend not in sys.path:
    sys.path.insert(0, _backend)

# Track all results
results = []

def test(name, passed, detail=""):
    results.append((name, passed, detail))
    status = "PASS" if passed else "FAIL"
    suffix = f" ({detail})" if detail else ""
    print(f"  [{status}] {name}{suffix}")
    if not passed:
        sys.exit(1)


def run_async(coro):
    return asyncio.get_event_loop().run_until_complete(coro)


# ═══════════════════════════════════════════════════════════════════
# FIX 1: Timing-safe hash verification
# ═══════════════════════════════════════════════════════════════════
print("\n--- Fix 1: Timing-safe hash verification ---")

from backend.crypto.hashing import compute_sha256, verify_hash
import hmac

data = {"role": "clinical_reasoning", "confidence": 0.92, "findings": ["fever", "elevated WBC"]}
correct_hash = compute_sha256(data)

# Verify correct hash passes
test("Correct hash verified", verify_hash(data, correct_hash))

# Verify wrong hash fails
test("Wrong hash rejected", not verify_hash(data, "a" * 64))

# Verify the comparison uses hmac.compare_digest (not ==)
import inspect
source = inspect.getsource(verify_hash)
test("Uses hmac.compare_digest", "hmac.compare_digest" in source, "constant-time comparison")
test("Does NOT use plain ==", "==" not in source.split("return")[-1], "no timing leak")


# ═══════════════════════════════════════════════════════════════════
# FIX 2: Malformed JWT token → 401, not 500
# ═══════════════════════════════════════════════════════════════════
print("\n--- Fix 2: Malformed JWT token handling ---")

from backend.core.security import create_access_token, decode_access_token
from fastapi import HTTPException

# Create a valid token
token = create_access_token({"sub": "00000000-0000-0000-0000-000000000001", "role": "admin"})
decoded = decode_access_token(token)
test("Valid token decodes", decoded is not None and decoded["sub"] == "00000000-0000-0000-0000-000000000001")

# Invalid token returns None (not crash)
test("Invalid token returns None", decode_access_token("garbage-token") is None)
test("Empty token returns None", decode_access_token("") is None)

# Test the actual deps code path
from backend.core.deps import get_current_user
import inspect
source = inspect.getsource(get_current_user)
test("get_current_user catches ValueError", "ValueError" in source)
test("get_current_user catches UUID parse error", "try:" in source and "uuid.UUID" in source)


# ═══════════════════════════════════════════════════════════════════
# FIX 3: Encryption serialization matches hash computation
# ═══════════════════════════════════════════════════════════════════
print("\n--- Fix 3: Encryption serialization consistency ---")

from backend.crypto.canonical_json import canonical_json
from backend.crypto.encryption import encrypt_json, decrypt_json

# Test with a complex agent output containing various types
output = {
    "agent_id": "agent-clinical-reasoning-01",
    "role": "clinical_reasoning",
    "summary": "Patient analysis",
    "possible_conditions": [
        {"condition": "Infection", "probability": 0.75, "type": "infectious"},
        {"condition": "Cardiac Event", "probability": 0.45, "type": "cardiovascular"},
    ],
    "confidence": 0.78,
    "missing_information": ["Complete blood count", "Vital signs trending"],
}

# Hash the output
original_hash = compute_sha256(output)

# Encrypt using canonical_json (the fix)
encrypted = encrypt_json(canonical_json(output))
# Decrypt and re-hash
decrypted = decrypt_json(encrypted)
stored_output = json.loads(decrypted)
recomputed_hash = compute_sha256(stored_output)

test("Hash roundtrip through encryption", original_hash == recomputed_hash,
     f"{original_hash[:16]}... == {recomputed_hash[:16]}...")

# Verify that canonical_json is used (not json.dumps with default=str)
from backend.orchestrator import workflow as workflow_module
wf_source = inspect.getsource(workflow_module)
test("Workflow uses canonical_json for encryption", "canonical_json(output)" in wf_source)
test("Workflow does NOT use json.dumps for encryption", 
     "json_mod.dumps(output" not in wf_source and "json.dumps(output" not in wf_source,
     "prevents serialization mismatch")


# ═══════════════════════════════════════════════════════════════════
# FIX 4: No unused canonical variable in workflow
# ═══════════════════════════════════════════════════════════════════
print("\n--- Fix 4: Dead code removal ---")

# Count occurrences of "canonical = canonical_json" in workflow
canonical_assign_count = wf_source.count("canonical = canonical_json(output)")
test("No unused canonical variable", canonical_assign_count == 0,
     f"found {canonical_assign_count} dead assignments")


# ═══════════════════════════════════════════════════════════════════
# FULL E2E LIFECYCLE: Task → Agents → Hash → Store → Verify → Tamper
# ═══════════════════════════════════════════════════════════════════
print("\n--- Full E2E Lifecycle ---")

from backend.orchestrator.workflow import run_workflow
from backend.storage.local import LocalStorageProvider
from backend.services.trust import calculate_risk_level

storage = LocalStorageProvider('./test-storage-verify')

task_data = {
    'task_id': 'e2e-verify-001',
    'title': 'Emergency Case Review',
    'domain': 'healthcare',
    'priority': 'critical',
    'description': 'Patient presents with severe chest pain, fever 39.2C, WBC 15000, diabetic. Possible sepsis with cardiac involvement. Urgent assessment required.',
    'patient_context': {'temperature': 39.2, 'diabetic': True},
    'required_agents': ['clinical_reasoning', 'laboratory', 'medication', 'risk', 'evidence', 'critic', 'verifier', 'synthesizer'],
}

# ── Step A: Normal execution (no tampering) ──
print("\n  Step A: Normal workflow execution")
r_normal = run_async(run_workflow(
    task_id='e2e-verify-001', task_data=task_data,
    mode='centralized', storage=storage, simulate_tampering=False,
))

test("Task created", r_normal.task_id == 'e2e-verify-001')
test("Run ID generated", len(r_normal.run_id) == 36)  # UUID format
test("Supervisor selected agents", len(r_normal.selected_agents) >= 3,
     f"selected: {r_normal.selected_agents}")
test("Agent outputs produced", len(r_normal.agent_outputs) >= 3,
     f"count: {len(r_normal.agent_outputs)}")

# Verify each agent output has valid schema
from backend.agents.base import AGENT_OUTPUT_TYPES
for role, output in r_normal.agent_outputs.items():
    schema = AGENT_OUTPUT_TYPES.get(role)
    if schema:
        schema.model_validate(output)

test("All agent outputs pass schema validation", True, f"{len(r_normal.agent_outputs)} agents")

test("Decision proofs created", len(r_normal.proofs) >= 3)
test("Hashes generated", all(len(p["content_hash"]) == 64 for p in r_normal.proofs),
     "all SHA-256 hashes are 64 hex chars")

# Verify off-chain storage happened
for proof in r_normal.proofs:
    if proof.get("storage_reference"):
        data = run_async(storage.get_object(proof["storage_reference"]))
        decrypted = decrypt_json(data)
        stored = json.loads(decrypted)
        recomputed = compute_sha256(stored)
        test(f"Off-chain storage hash matches for {proof['agent_role']}",
             recomputed == proof["content_hash"])

# Verify verifications ran
test("Verifications completed", len(r_normal.verifications) >= 3)
test("All verifications passed",
     all(v["verified"] for v in r_normal.verifications),
     f"{sum(1 for v in r_normal.verifications if v['verified'])}/{len(r_normal.verifications)}")

# Final integrity check
test("Final integrity: VERIFIED", r_normal.final_result["integrity"] == "verified")
test("Consensus calculated", r_normal.consensus["status"] in ("accepted", "warning"),
     f"status={r_normal.consensus['status']}, score={r_normal.consensus['agreement_score']}")
test("No anomalies in normal run", len(r_normal.anomalies) == 0)

# Timeline has all required events
events = [e["event"] for e in r_normal.timeline]
required_events = [
    "task.created", "run.started", "supervisor.classifying", "supervisor.plan_ready",
    "hash.generated", "storage.saved", "verification.started", "verification.completed",
    "consensus.started", "consensus.completed", "run.completed",
]
missing = [e for e in required_events if e not in events]
test("All pipeline events present", len(missing) == 0, f"missing: {missing}" if missing else "none")

test("Latency recorded", r_normal.total_latency_ms > 0, f"{r_normal.total_latency_ms:.1f}ms")


# ── Step B: Tamper detection ──
print("\n  Step B: Tamper detection lifecycle")

r_tamper = run_async(run_workflow(
    task_id='e2e-verify-002', task_data=task_data,
    mode='centralized', storage=storage, simulate_tampering=True,
))

test("Tamper detected: integrity FAILED", r_tamper.final_result["integrity"] == "failed")
test("Tamper anomalies raised",
     any(a["type"] == "hash_mismatch" for a in r_tamper.anomalies),
     f"anomaly types: {[a['type'] for a in r_tamper.anomalies]}")
test("Tamper verifications show failures",
     not all(v["verified"] for v in r_tamper.verifications),
     f"{sum(1 for v in r_tamper.verifications if v['verified'])}/{len(r_tamper.verifications)} verified")
test("Tamper simulation event emitted",
     any(e["event"] == "tamper.simulated" for e in r_tamper.timeline))

# Verify the hash mismatch details are correct
mismatch_events = [e for e in r_tamper.timeline if e["event"] == "verification.hash_mismatch"]
test("Hash mismatch events have correct details",
     len(mismatch_events) >= 1 and "blockchain_hash" in mismatch_events[0].get("details", {}))


# ── Step C: Trust scoring after tamper ──
print("\n--- Trust Scoring Behavior ---")

assert calculate_risk_level(100) == "trusted"
assert calculate_risk_level(80) == "trusted"
assert calculate_risk_level(79.9) == "normal"
assert calculate_risk_level(60) == "normal"
assert calculate_risk_level(59.9) == "warning"
assert calculate_risk_level(40) == "warning"
assert calculate_risk_level(39.9) == "suspicious"
assert calculate_risk_level(20) == "suspicious"
assert calculate_risk_level(19.9) == "critical"
assert calculate_risk_level(0) == "critical"

test("Risk level boundaries correct", True, "all 5 levels verified")

from backend.services.trust import clamp_score
assert clamp_score(-10) == 0.0
assert clamp_score(0) == 0.0
assert clamp_score(50) == 50.0
assert clamp_score(100) == 100.0
assert clamp_score(150) == 100.0
test("Score clamping correct", True, "0-100 range enforced")


# ── Step D: Anomaly detection with various inputs ──
print("\n--- Anomaly Detection Edge Cases ---")

from backend.services.anomaly import detect_anomalies

# Empty outputs → no crash
anomalies = detect_anomalies({}, [], None)
test("Empty inputs: no crash", True, f"{len(anomalies)} anomalies (expected 0)")
test("Empty inputs: no false positives", len(anomalies) == 0)

# All normal → no anomalies
anomalies = detect_anomalies(
    {"reasoning": {"confidence": 0.8}, "risk": {"confidence": 0.7}},
    [{"verified": True, "agent_id": "agent-reasoning"}],
    {"agent-reasoning": 90},
)
test("Normal outputs: no anomalies", len(anomalies) == 0)

# Multiple anomaly types at once
anomalies = detect_anomalies(
    {"a": {"confidence": 0.5}, "b": {"confidence": 1.5}, "c": {}},
    [{"verified": False, "agent_id": "agent-a"}],
    {"agent-a": 25},
)
types = set(a["type"] for a in anomalies)
test("Hash mismatch detected", "hash_mismatch" in types)
test("Impossible confidence detected", "impossible_confidence" in types)
test("Overconfidence detected", "overconfidence" in types)
test("Invalid output schema detected", "invalid_output_schema" in types)
test("Low trust score detected", "low_trust_score" in types)


# ═══════════════════════════════════════════════════════════════════
# SUMMARY
# ═══════════════════════════════════════════════════════════════════
print("\n" + "=" * 60)
passed = sum(1 for _, p, _ in results if p)
failed = sum(1 for _, p, _ in results if not p)
print(f"RESULTS: {passed} passed, {failed} failed, {len(results)} total")
if failed == 0:
    print("ALL BEHAVIORAL TESTS PASSED")
else:
    print("SOME TESTS FAILED")
    for name, p, detail in results:
        if not p:
            print(f"  FAILED: {name} - {detail}")
    sys.exit(1)
print("=" * 60)
