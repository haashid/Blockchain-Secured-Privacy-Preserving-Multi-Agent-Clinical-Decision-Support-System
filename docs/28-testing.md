# 28 — Testing

## Test Suite Overview

**File**: `tests/verify_fixes.py`  
**Framework**: Python `unittest` with custom reporting  
**Total Tests**: 49  
**Scope**: Unit-level behavioral verification  
**Dependencies**: No live Groq, no live Fabric, no live MinIO (all mocked)

---

## Test Categories

### Category 1: Password Security
Tests that bcrypt hashing and verification work correctly.

```python
test_password_hashing_works()
    # bcrypt.hash("test") should produce a hash
    # bcrypt.verify("test", hash) should return True
    # bcrypt.verify("wrong", hash) should return False

test_password_hash_is_unique()
    # Two hashes of same password must be different (salt)

test_timing_safe_comparison()
    # hmac.compare_digest used, not ==
```

---

### Category 2: JWT Authentication
Tests token creation and decoding.

```python
test_jwt_creation_and_decode()
    # jose.jwt.encode({sub, username, role}) → valid token
    # jose.jwt.decode(token, secret) → correct claims

test_jwt_role_claim()
    # Role is correctly embedded in JWT
    # Token is valid for 60 minutes
```

---

### Category 3: Cryptographic Operations
Tests SHA-256, canonical JSON, and AES-GCM.

```python
test_canonical_json_is_deterministic()
    # Same data, different key order → same canonical string
    d1 = {"b": 2, "a": 1}
    d2 = {"a": 1, "b": 2}
    assert canonical_json(d1) == canonical_json(d2)  # MUST be equal

test_sha256_produces_consistent_hash()
    # Same data → same 64-char hex hash
    # Different data → different hash

test_timing_safe_hash_comparison()
    # verify_hash() uses hmac.compare_digest (not ==)

test_encryption_round_trip()
    # encrypt(data) then decrypt should return original
    
test_different_encryptions_of_same_data()
    # Two encryptions of same plaintext must produce different ciphertext (nonce)

test_tampered_data_fails_decryption()
    # Modify one byte of ciphertext → InvalidTag raised
```

---

### Category 4: Agent Output Schemas
Verifies all 10 Pydantic schemas validate correctly.

```python
test_supervisor_output_schema()
test_clinical_reasoning_output_schema()
test_history_output_schema()
test_laboratory_output_schema()
test_medication_output_schema()
test_risk_output_schema()
test_evidence_output_schema()
test_critic_output_schema()
test_verifier_output_schema()
test_synthesis_output_schema()
```

Each test:
1. Creates the relevant mock agent.
2. Calls `execute()`.
3. Validates output against the Pydantic schema.
4. Checks `confidence` is between 0.0 and 1.0.

---

### Category 5: Hash Integrity
Tests the hash verification pipeline.

```python
test_hash_detects_tampering()
    # original_output → hash_A
    # tampered_output = {**original_output, "tampered": True}
    # tampered_hash ≠ hash_A → tamper detected

test_hash_matches_for_unchanged_data()
    # verify_hash(data, compute_sha256(data)) → True
```

---

### Category 6: Consensus Calculation
Tests the weighted consensus scoring.

```python
test_consensus_with_high_confidence()
    # All agents report 0.9 confidence, all verified
    # → agreement_score > 0.7 → "accepted"

test_consensus_with_mixed_confidence()
    # Mix of high and low confidence
    # Verify synthesizer gets 2.0 weight, verifier 1.8

test_consensus_rejected_state()
    # All agents < 0.4 confidence
    # → agreement_score < 0.5 → "rejected"
```

---

## Running Tests

```bash
# From project root:
cd "final project"
python -m pytest tests/verify_fixes.py -v

# Or directly:
python tests/verify_fixes.py
```

### Expected Output
```
Running Verification Tests for Blockchain Multi-Agent System
──────────────────────────────────────────────────────────
✅ test_password_hashing_works
✅ test_password_hash_is_unique
✅ test_timing_safe_comparison
✅ test_canonical_json_is_deterministic
... (46 more)
──────────────────────────────────────────────────────────
Results: 49/49 tests passed
Status: ✅ ALL TESTS PASSED
```

---

## Test Coverage Analysis

| Component | Tested | Notes |
|-----------|--------|-------|
| bcrypt hashing | ✅ | Unit tests |
| JWT encode/decode | ✅ | Unit tests |
| canonical_json | ✅ | Determinism verified |
| SHA-256 hashing | ✅ | Consistency + tamper |
| AES-GCM encrypt/decrypt | ✅ | Round-trip + tamper |
| All 10 Pydantic schemas | ✅ | Mock agents |
| Mock agent execution | ✅ | via schema tests |
| Consensus calculation | ✅ | 3 scenarios |
| Real Groq API | ❌ | Not tested (external) |
| Real Fabric network | ❌ | Not tested (infrastructure) |
| Real MinIO | ❌ | Not tested (infrastructure) |
| FastAPI routes | ❌ | No route integration tests |
| Database operations | ❌ | No DB integration tests |
| Frontend components | ❌ | No UI tests |
| End-to-end workflow | ❌ | No E2E tests |

---

## Recommended Additional Tests

For production readiness, add:

```python
# Integration tests (would need httpx + pytest-asyncio):
async def test_login_returns_jwt():
    response = await client.post("/api/auth/login", json={"username": "admin", ...})
    assert response.status_code == 200
    assert "access_token" in response.json()

async def test_doctor_cannot_access_admin_routes():
    # Get doctor JWT, try to access /api/agents → 403

async def test_full_workflow_mock_mode():
    # Submit task → execute → verify SHA-256 in proofs
```
