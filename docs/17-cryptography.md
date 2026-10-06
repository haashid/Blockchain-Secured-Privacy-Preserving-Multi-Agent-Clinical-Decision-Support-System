# 17 — Cryptography

## Overview

The cryptography layer is the technical heart of the blockchain provenance system. It provides:
1. **Determinism**: Same data always produces the same hash.
2. **Integrity**: Any change to stored data is detectable.
3. **Confidentiality**: Encrypted storage prevents unauthorized reading.
4. **Authentication**: AES-GCM auth tag prevents ciphertext tampering.

**Files**: `backend/crypto/canonical_json.py`, `backend/crypto/hashing.py`, `backend/crypto/encryption.py`

---

## Step 1: Canonical JSON

**File**: `backend/crypto/canonical_json.py`  
**Function**: `canonical_json(data: Any) -> str`

### The Problem
JSON serialization is non-deterministic: Python may serialize:
```json
{"b": 2, "a": 1}   or   {"a": 1, "b": 2}
```

These produce different strings — and different hashes — even though the data is identical.

### The Solution
```python
import json

def canonical_json(data: Any) -> str:
    return json.dumps(
        data,
        sort_keys=True,          # ← alphabetical key ordering
        separators=(',', ':'),   # ← no extra spaces
        ensure_ascii=True        # ← portable encoding
    )
```

**Result**: `{"a":1,"b":2}` — always the same, regardless of insertion order.

This is critical: **the hash stored on the blockchain must be reproducible** from the stored data. Canonical JSON makes this possible.

---

## Step 2: SHA-256 Hashing

**File**: `backend/crypto/hashing.py`

### What is SHA-256?

SHA-256 (Secure Hash Algorithm 256-bit) is a **one-way function** that maps any input to a fixed 64-character hexadecimal string. 

Properties:
- **Deterministic**: Same input → same hash always.
- **One-way**: Cannot reverse the hash to get the original data.
- **Avalanche effect**: Change one character → completely different hash.
- **Collision resistant**: Two different inputs cannot produce the same hash (computationally infeasible).

### Implementation

```python
import hashlib
import hmac

def compute_sha256(data: Any) -> str:
    canonical = canonical_json(data)          # Step 1: canonicalize
    return hashlib.sha256(                     # Step 2: hash
        canonical.encode("utf-8")             # Step 3: encode to bytes
    ).hexdigest()                             # Returns 64-char hex string

def verify_hash(data: Any, expected_hash: str) -> bool:
    computed = compute_sha256(data)
    return hmac.compare_digest(computed, expected_hash)  # ← CONSTANT TIME
```

### ⚠️ Why `hmac.compare_digest`?

Normal string comparison (`==`) can leak information via **timing attacks**:
- `"abc" == "xyz"` → fails immediately (different first char).
- `"abc" == "abz"` → takes longer (compares first two chars).

An attacker timing thousands of requests could guess hash values character by character. `hmac.compare_digest` always takes the same amount of time regardless of where the strings differ. This was one of the behavioral tests in `verify_fixes.py`.

---

## Step 3: AES-256-GCM Encryption

**File**: `backend/crypto/encryption.py`

### What is AES-GCM?

**AES** (Advanced Encryption Standard) with **GCM** (Galois/Counter Mode) is an **authenticated encryption** scheme. It provides:
- **Confidentiality**: Data is unreadable without the key.
- **Integrity**: Any modification to the ciphertext is detected (authentication tag fails).
- **Authenticity**: Proves the data was encrypted by someone with the key.

### Why GCM over CBC?

| Property | AES-CBC | AES-GCM |
|----------|---------|---------|
| Confidentiality | ✅ | ✅ |
| Integrity/Auth tag | ❌ | ✅ |
| Parallelizable | ❌ | ✅ |
| Nonce required | IV | Yes (96-bit) |
| Tamper-detectable | No | Yes |

GCM is the current NIST recommendation for authenticated encryption.

### Implementation

```python
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
import os

def _get_key() -> bytes:
    raw = settings.ENCRYPTION_KEY.encode("utf-8")
    if len(settings.ENCRYPTION_KEY) == 64:
        return bytes.fromhex(settings.ENCRYPTION_KEY)  # Pre-hashed hex key
    return hashlib.sha256(raw).digest()                 # Derive 32-byte key

def encrypt(plaintext: bytes) -> bytes:
    key = _get_key()
    aesgcm = AESGCM(key)
    nonce = os.urandom(12)              # 96-bit randomness, new each call
    ciphertext = aesgcm.encrypt(nonce, plaintext, None)
    return nonce + ciphertext           # Prepend nonce (needed for decrypt)

def decrypt(data: bytes) -> bytes:
    key = _get_key()
    aesgcm = AESGCM(key)
    nonce = data[:12]
    ciphertext = data[12:]
    return aesgcm.decrypt(nonce, ciphertext, None)
    # Raises cryptography.exceptions.InvalidTag if data was tampered
```

### The Nonce

A **nonce** (Number used ONCE) is a 96-bit random value generated fresh for every encryption. It is prepended to the ciphertext.

- **Why random?** If the same nonce is reused with the same key → serious security vulnerability in GCM mode.
- **Why 96 bits?** NIST recommends 96-bit nonces for AES-GCM for performance reasons.
- **Recovery**: The nonce is stored as the first 12 bytes of the stored blob. Decryption reads it back.

---

## Complete Cryptographic Flow

```
Agent Output (Python dict)
        ↓
canonical_json(output)          → sorted, deterministic JSON string
        ↓
compute_sha256(output)          → 64-char hex hash  ← STORED ON BLOCKCHAIN
        ↓
encrypt_json(canonical_json)    → nonce(12B) + ciphertext  ← STORED IN MinIO
```

### Verification Flow

```
MinIO encrypted blob
        ↓
decrypt(data)                   → JSON string (raises if tampered)
        ↓
json.loads(json_str)            → Python dict
        ↓
compute_sha256(dict)            → computed hash
        ↓
hmac.compare_digest(           
    computed_hash,              
    blockchain_hash             ← from Fabric ledger
)
        ↓
True  = ✅ Verified (data intact)
False = ❌ TAMPERED (hash mismatch)
```

---

## Separation of Concerns: Hash vs Encryption

This is a critical conceptual point for your viva:

| Concept | Purpose | What it Proves |
|---------|---------|---------------|
| SHA-256 Hash | Creates a unique fingerprint | The blockchain records "data X existed" |
| AES-GCM Encryption | Keeps data private | Only authorized parties can read the output |
| Both together | Integrity + Confidentiality | Data is private AND provably unmodified |

**Important**: The hash is computed **before** encryption. This means:
- The hash represents the plaintext content.
- The blockchain stores the hash of the plaintext (not of the ciphertext).
- Verification: decrypt → canonical → hash → compare to blockchain hash.

If you hashed the ciphertext, a different nonce would produce a different hash even for the same plaintext. Always hash plaintext canonical form.

---

## Key Management

**Current approach** (academic scope):
- `ENCRYPTION_KEY` stored in `.env` file.
- Key is derived by SHA-256 hashing the string value → 32-byte key.
- If already a 64-char hex string → decoded directly as 32 bytes.

**Production recommendation**:
- Use a Hardware Security Module (HSM) or cloud KMS (AWS KMS, GCP KMS).
- Rotate encryption keys periodically.
- Store key in a secrets manager (HashiCorp Vault, AWS Secrets Manager).
- Never store the key in `.env` in production.

---

## Tamper Detection

When `simulate_tampering=True` is passed to `run_workflow()`:

```python
# workflow.py — tamper simulation
if simulate_tampering:
    stored_output["tampered"] = True          # Add extra field to dict
    computed_hash = compute_sha256(stored_output)  # Recompute hash
    # Now computed_hash ≠ proof["content_hash"] (stored before tampering)
```

The verification check:
```python
if computed_hash != proof["content_hash"]:
    verified = False
    result.anomalies.append({
        "type": "hash_mismatch",
        "severity": "high",
        "description": "Stored output hash does not match blockchain hash — possible tampering"
    })
```

This demonstrates the core blockchain value proposition: **data cannot be silently modified after being hashed on-chain**.
