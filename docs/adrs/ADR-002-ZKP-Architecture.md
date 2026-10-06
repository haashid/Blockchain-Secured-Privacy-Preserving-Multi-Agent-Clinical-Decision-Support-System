# ADR-002 v2: Zero-Knowledge Proof (ZKP) Architecture
**Status:** REVISED — AWAITING APPROVAL BEFORE IMPLEMENTATION  
**Version:** 2  
**Revision Date:** 2026-09-11  
**Supersedes:** ADR-002 v1

---

## 1. Context

The clinical multi-agent system consists of specialized AI agents operating under:
- **DID:** `did:key` self-certifying identities (ECDSA P-256, per ADR-001)
- **Verifiable Credentials:** W3C JWT VCs asserting `role` and `capabilities`, signed by the system issuer
- **SBT-style records:** Non-transferable identity records anchored on Hyperledger Fabric
- **Authorization engine:** Capability-based access control enforcing minimum-necessary EHR access

During pipeline execution, agents must prove their authorization to perform a task without exposing their raw credential signature, issuer keys, or irrelevant credential attributes. This protects against credential leakage, replay attacks, and unnecessary information disclosure to intermediate verifiers within the same backend system.

---

## 2. Problem

We must select a Zero-Knowledge Proof or selective-disclosure mechanism to allow an agent to prove:

> "I possess a valid credential issued by the trusted hospital authority asserting that I hold a specific `role` and `organization`, and that credential has not been revoked."

The verifier should learn only what the predicate requires — role, organization, validity — and nothing else.

**This is not:**
- A proof of AI reasoning correctness
- An EHR encryption scheme
- A Fabric consensus mechanism
- A replacement for AES-256-GCM
- A replacement for Fabric X.509 network identity

---

## 3. Security Requirements

| # | Requirement |
|---|---|
| SR-1 | Hide raw credential signature bytes from the verifier |
| SR-2 | Hide credential attributes not required by the policy predicate |
| SR-3 | Prevent proof replay across different sessions |
| SR-4 | Bind the proof to a specific verifier-generated nonce/challenge |
| SR-5 | Prevent proof modification or forgery |
| SR-6 | Support credential revocation checks via Fabric SBT |
| SR-7 | Maintain a controlled audit path to the agent identity for authorized auditors |

---

## 4. Target Authorization Predicate

The concrete proof assertion for this project is:

```
"I possess a valid credential issued by the trusted hospital authority that asserts:

    role = <required_role>                    (e.g., "laboratory_agent")
    organization = <authorized_organization>  (e.g., "hospital_org_1")

    AND the credential is currently valid (within validity period)
    AND the credential has not been revoked"
```

**The proof MUST hide:**
- Raw issuer signature bytes
- Unrelated capabilities/claims
- Other attributes in the credential not required by the predicate
- Private credential material / witness

**The proof MAY reveal (minimum set for policy evaluation):**
- `role` (required by predicate)
- `organization` (required by predicate)
- Proof validity status
- A pseudonymous or controlled identifier (see Section 11)

---

## 5. Candidates Evaluated

### 5.1 Circom + snarkjs
- **Paradigm:** General-purpose zk-SNARK (Groth16/PLONK) using R1CS circuits written in a custom domain-specific language.
- **Maintenance:** Active as of 2024/2025 (iden3). snarkjs handles browser/Node.js proving and verification.
- **Trusted Setup:** Groth16 requires a circuit-specific trusted setup ceremony (Powers of Tau, then circuit-specific phase 2). PLONK requires a universal trusted setup but still requires pairing assumptions.
- **Python Integration:** None native. Must use a Node.js sidecar (`snarkjs` CLI) or subprocess calls.
- **Windows:** Yes, via Node.js.
- **Proving time:** Seconds for large circuits (e.g., verifying an ECDSA signature inside a circuit is 1M+ constraints → very slow).
- **Proof size:** ~200 bytes (Groth16).
- **PQC:** No — pairing-based (BLS12-381/BN254). NOT post-quantum.
- **Critical Problem for this use case:** Building a Circom circuit to verify a credential signature (ECDSA-P256 or BLS12-381) inside R1CS requires thousands to millions of constraints, making proving very slow. This is the "wrong tool" for credential selective disclosure.

### 5.2 gnark (Go)
- **Paradigm:** General-purpose zk-SNARK (Groth16/PLONK) circuits written in Go.
- **Maintenance:** Very active (ConsenSys/Linea). Production-grade.
- **Trusted Setup:** Yes (Groth16). PlonK available.
- **Python Integration:** None native. Must use gRPC sidecar or compiled Go binary exposed via REST.
- **Windows:** Yes, via Go toolchain.
- **Proving time:** Fast for its circuit class (~100ms–2s depending on circuit size).
- **Proof size:** ~192 bytes (Groth16).
- **PQC:** No — pairing-based. NOT post-quantum.
- **Critical Problem for this use case:** Same as Circom — verifying an external credential signature inside a generic SNARK circuit is massively expensive in constraints. Total integration complexity is very high for what is fundamentally a selective-disclosure problem.

### 5.3 PySNARK
- **Paradigm:** General-purpose SNARK library in Python (academic).
- **Maintenance:** Low activity. Not production-ready.
- **Security Maturity:** Research/academic.
- **Python Integration:** Native.
- **Rejection Reason:** Insufficient security maturity. No known production use cases. Not viable.

### 5.4 BBS+ Signatures (W3C / IETF Standardized)
- **Paradigm:** Credential-oriented selective-disclosure signatures with derived zero-knowledge proofs. Pairing-based (BLS12-381).
- **Standard:** IETF CFRG `draft-irtf-cfrg-bbs-signatures` (active standardization). W3C Data Integrity `BbsBlsSignature2020` and BBS Cryptosuite v2023.
- **Maintenance:** Active. Implementations maintained by MATTR Global (`@mattrglobal/bbs-signatures`, TypeScript/Node.js + native bindings via `@mattrglobal/node-bbs-signatures`), Hyperledger Aries/AnonCreds ecosystem.
- **Trusted Setup:** **None required.** Issuer generates a BLS12-381 key pair. No ceremony.
- **Python Integration:** Fragmented. `ursa-bbs-signatures` is **end-of-life** (Hyperledger Ursa deprecated). The viable path is PyO3/Maturin bindings to a Rust crate implementing the IETF draft, or a Node.js sidecar using `@mattrglobal/bbs-signatures`.
- **Proving time:** ~10–50ms (reference estimate from MATTR benchmarks — requires measurement).
- **Verification time:** ~5–20ms (reference estimate — requires measurement).
- **Proof size:** ~1–2 KB.
- **PQC:** No — pairing-based (BLS12-381). NOT post-quantum.
- **Unlinkability:** Yes — derived proofs are statistically unlinkable across sessions.
- **Replay protection:** Native nonce/challenge parameter built into the proof derivation protocol.
- **Fit for use case:** **Excellent.** BBS+ is specifically designed for the credential selective-disclosure problem this project requires. No complex custom circuit writing.

### 5.5 Hyperledger AnonCreds (CL Signatures)
- **Paradigm:** Credential-oriented selective-disclosure using Camenisch-Lysyanskaya (CL) signatures.
- **Maintenance:** Active (Hyperledger Aries ecosystem).
- **Python Integration:** Via `aries-askar` and `anoncreds-rs` (Rust FFI).
- **Fit:** Good for credential SD. However, CL signatures are more complex to implement from scratch, and BBS+ is the newer standard being standardized by IETF/W3C with better ecosystem momentum.
- **Rejection Reason:** Higher integration complexity than BBS+ for this prototype. BBS+ better aligns with the existing JWT VC model.

### 5.6 SD-JWT (IETF RFC)
- **Paradigm:** Hash-based selective disclosure (not zero-knowledge). The holder discloses specific claim hashes; the verifier checks them.
- **Maintenance:** Very active. Modern IETF standard (RFC 9278 family).
- **Python Integration:** Native — several Python libraries exist (`py-sd-jwt`, `sd-jwt`).
- **Unlinkability:** **None.** The issuer's signature is always included and serves as a tracking correlation handle.
- **Rejection Reason:** Does not provide cryptographic unlinkability. Does not hide the issuer signature. Does not meet SR-1 or SR-2.

---

## 6. Comparison Matrix

| Feature | Circom/snarkjs | gnark (Go) | PySNARK | **BBS+ Signatures** | SD-JWT |
|---|:---:|:---:|:---:|:---:|:---:|
| **Correct paradigm for credential SD** | ✗ | ✗ | ✗ | **✓** | Partial |
| **Trusted setup required** | Yes | Yes | Yes | **No** | No |
| **Cryptographic unlinkability** | Yes | Yes | Yes | **Yes** | ✗ |
| **Native replay protection (nonce)** | Circuit-level | Circuit-level | Circuit-level | **Native** | Optional |
| **Python integration (easy)** | Sidecar | gRPC sidecar | Native (low maturity) | **FFI/Sidecar** | Native |
| **Proving time for VC SD** | Very slow (custom circuit) | Slow (custom circuit) | Slow | **Fast (~10-50ms est.)** | Instant (no ZK) |
| **Proof size** | ~200B | ~192B | Variable | ~1-2KB | ~0.5-1KB |
| **Trusted setup ceremony** | Yes (circuit-specific) | Yes (circuit-specific) | Yes | **None** | None |
| **PQC** | ✗ | ✗ | ✗ | ✗ | ✓ (w/ ML-DSA) |
| **IETF/W3C Standardized** | Partial | ✗ | ✗ | **Active standardization** | Yes (RFC) |
| **Fabriccomplexity** | Very High | High | High | **Low (off-chain verify)** | Low |
| **Security maturity** | Good | Very Good | Poor | **Good** | Very Good |
| **Windows compatible** | Yes | Yes | Yes | **Yes (via Node/Docker)** | Yes |

---

## 7. Selected Approach

**RECOMMENDED ZKP ARCHITECTURE:** BBS+ Signatures with W3C Verifiable Credential Selective Disclosure  
**PROVING SYSTEM:** BBS Signature Scheme (IETF `draft-irtf-cfrg-bbs-signatures`, BLS12-381 curve)  
**PROOF FORMAT:** W3C Verifiable Presentation with BBS+ Derived Proof  
**IMPLEMENTATION RUNTIME:** Node.js sidecar using `@mattrglobal/bbs-signatures` + `@mattrglobal/node-bbs-signatures`

---

## 8. Why Selected

The project requirement is **privacy-preserving authorization**, not general-purpose verifiable computation. Building a general SNARK circuit (Circom or gnark) to verify a standard credential signature requires hundreds of thousands to millions of R1CS constraints — a recognized engineering anti-pattern for selective disclosure.

BBS+ is the mathematical primitive standardized specifically for this problem:
- The issuer signs a vector of credential attributes using BLS12-381 pairings.
- The holder can generate a derived proof revealing only a subset of attributes.
- The verifier checks the derived proof without learning the full credential or the original signature.
- A nonce binds the proof to a specific session, preventing replay.
- No trusted setup ceremony is required.

---

## 9. Alternatives Rejected

| Candidate | Rejection Reason |
|---|---|
| Circom + snarkjs | Massive circuit complexity for credential SD. Wrong tool class. |
| gnark | Same as Circom. High operational overhead for this use case. |
| PySNARK | Insufficient security maturity. Research-only. |
| SD-JWT | No cryptographic unlinkability. Issuer signature always exposed (SR-1 violation). |
| AnonCreds (CL) | Higher complexity. BBS+ better aligned with existing JWT VC model and IETF standardization. |

---

## 10. Trust Assumptions

1. The hospital system issuer key (BLS12-381 key pair) is held securely and is only used to sign agent credentials.
2. The BLS12-381 elliptic curve pairing is computationally secure against classical adversaries.
3. Agents securely manage their private credential material and do not expose their credential witnesses.
4. The Fabric ledger is assumed to be append-only and tamper-resistant for SBT status checks.

---

## 11. Privacy and Accountability Model

This project operates in a hospital context where **full anonymity conflicts with regulatory accountability and audit requirements** (HIPAA, GDPR audit provisions).

**Architecture: Pseudonymous with Controlled Accountability**

| Verifier Type | DID Disclosure | Attributes Revealed |
|---|---|---|
| Ordinary authorization (pipeline) | **Hidden** (pseudonymous) | `role`, `organization` only |
| Authorized internal audit | **Revealed** (via controlled disclosure path) | Full credential subject |
| Unauthorized third party | **Hidden** | Nothing |

The BBS+ derived proof is generated with `role` and `organization` as disclosed attributes. The agent DID is **not included in the disclosed attributes** in ordinary authorization. However:
- The Fabric SBT record contains the `agent_did` and `credential_hash` as public metadata.
- An authorized auditor with Fabric access can resolve the SBT to the agent DID.
- This provides pseudonymous authorization to the pipeline verifier, and accountable identity to authorized auditors.

The DID is therefore **pseudonymous to ordinary verifiers** and **accountable to authorized auditors**.

---

## 12. Replay Protection

**Mechanism:** Verifier-generated nonce bound to the derived proof.

**Protocol:**
1. The verifier (Python backend orchestrator) generates a cryptographically random 32-byte nonce for each authorization request and records the session context (task ID, timestamp, resource type).
2. The agent prover calls `generate_proof(credential, nonce, disclosed_attributes=[role, organization])`.
3. The derived proof mathematically incorporates the nonce. A proof generated with nonce `N` cannot be verified against nonce `M ≠ N`.
4. The verifier rejects any proof if the nonce has already been consumed (nonce registry maintained in-memory or cache with TTL matching proof validity window).

**Anti-replay test cases (see Section 22):**
- Valid nonce → success
- Expired/reused nonce → `DENY_NONCE_INVALID`
- Nonce from a different session → `DENY_NONCE_INVALID`

---

## 13. Credential and DID Binding

**Credential binding:** The derived proof mathematically binds to the specific issuer-signed credential. The verifier checks that the revealed attributes (`role`, `organization`) were signed by the trusted issuer's BLS12-381 public key.

**DID binding:** The credential subject `id` field contains the agent's DID. In ordinary authorization, this field is **not disclosed** in the derived proof, producing pseudonymity. In authorized audit, the full credential subject (including DID) is retrievable from the SBT record.

---

## 14. SBT Relationship

**The ZKP proves credential possession and claims. The SBT proves public revocation status.**

These are explicitly separate checks:

```
Step 1: BBS+ Proof → verified (credential signature valid, role/org claims correct, nonce valid)
Step 2: Credential hash resolved from proof context
Step 3: Fabric queried → SBT record for agent_did / credential_hash
Step 4: SBT.status == ACTIVE ?
Step 5: ALL checks pass → AUTHORIZED

If SBT.status == REVOKED → DENY_CREDENTIAL_REVOKED (even if ZKP is valid)
```

The SBT itself is **never the secret**. The SBT is a public, non-secret, Fabric-anchored record. The ZKP does not prove SBT ownership.

---

## 15. Fabric Relationship

**On-chain metadata (allowed):**

| Field | Description |
|---|---|
| `sbt_id` | Unique SBT record identifier |
| `agent_did` | Agent's DID (public reference) |
| `credential_hash` | SHA-256 hash of the signed credential |
| `status` | `ACTIVE` or `REVOKED` |
| `issued_at` | Unix timestamp |
| `revoked_at` | Unix timestamp (if applicable) |
| `credential_version` | Version counter |

**NEVER on-chain:**

- BBS+ issuer private key
- Raw credential attributes beyond the hash
- BBS+ proof witness / blinding factors
- Patient data of any kind
- Private EHR records

**Verification location:** Python backend (off-chain). Proof verification does NOT occur in Fabric chaincode.

---

## 16. PQC Boundary

**BBS+ is NOT post-quantum secure.** It relies on the hardness of the discrete logarithm problem in BLS12-381 pairings, which is vulnerable to Shor's algorithm on a sufficiently powerful quantum computer.

The project's cryptographic layers have distinct purposes:

| Layer | Mechanism | Purpose | PQC? |
|---|---|---|---|
| EHR data protection | AES-256-GCM | Symmetric encryption of data at rest | N/A |
| ZKP / selective disclosure | BBS+ (BLS12-381) | Privacy-preserving authorization proof | ✗ (Classical only) |
| Application identity signatures | ECDSA P-256 → ML-DSA (Phase 8) | Agent identity and credential signing | ✓ (Phase 8) |
| Key establishment | X25519 → ML-KEM (Phase 8) | Secure key exchange | ✓ (Phase 8) |
| Fabric internal crypto | ECDSA P-256 (default) | Fabric network identity, MSP | Unchanged unless researched separately |

BBS+ and ML-DSA solve **different problems**. ML-DSA replacing the credential signing key will require migrating from the existing ECDSA P-256 credential model to BLS12-381-signed credentials that support BBS+ derivation. This migration path is defined in Section 23.

**Claims NOT made in this ADR:**
- BBS+ is NOT post-quantum.
- ML-DSA does NOT accelerate BBS+ proving.
- This system is NOT "quantum-safe" in Phase 7.

---

## 17. ZKP Modes

The system MUST explicitly distinguish two operational modes:

### ZKP_MODE=mock (Prototype / Development)
- Used for interface testing, orchestrator integration, API contract validation, UI development.
- `generate_proof()` returns a deterministic mock proof structure.
- `verify_proof()` returns `True` with status `SIMULATED`.
- **MUST NEVER** report status as `CRYPTOGRAPHICALLY_VERIFIED`, `ZKP_VERIFIED`, or `PRIVACY-PRESERVING PROOF VERIFIED`.
- Frontend and API responses MUST display: `"ZKP simulation — not cryptographic"`

### ZKP_MODE=bbs (Production / Real Cryptography)
- Uses the `@mattrglobal/bbs-signatures` Node.js library via a lightweight sidecar service.
- `generate_proof()` invokes the BBS+ derived proof algorithm.
- `verify_proof()` performs real BLS12-381 pairing-based verification.
- Status reported as `CRYPTOGRAPHICALLY_VERIFIED`.
- Frontend and API responses display: `"BBS+ proof cryptographically verified"`

The mode is set via the environment variable `ZKP_MODE` (`mock` or `bbs`). The system defaults to `mock` in development and requires explicit configuration for `bbs`.

---

## 18. Concrete Implementation Path

### Selected Library: `@mattrglobal/bbs-signatures` + `@mattrglobal/node-bbs-signatures`
- **Repository:** https://github.com/mattrglobal/bbs-signatures
- **Runtime:** Node.js 18+ LTS
- **Platform:** Linux (Docker), Windows (Node.js toolchain)
- **Performance:** `@mattrglobal/node-bbs-signatures` provides native bindings (Rust via NAPI-RS) for significantly better performance than the pure-WASM version.

**Why this library:**
- Actively maintained by MATTR Global, a leading DIF/W3C identity standards contributor.
- Implements the BLS12-381 curve with BBS+ as used in the W3C `BbsBlsSignature2020` proof suite.
- Provides the three required operations: `blsSign`, `blsCreateProof`, `blsVerifyProof`.
- Well-documented with clear API surfaces for key generation, signing, proof derivation, and verification.
- Docker-compatible (Linux x86-64 native bindings available; Windows tested with Node.js).

### Runtime Architecture

```
Python FastAPI Backend (Orchestrator)
     |
     | HTTP (localhost:3001)
     |
Node.js BBS+ Sidecar Service
     |
@mattrglobal/bbs-signatures
     |
     +─── /generate-proof    (POST)
     +─── /verify-proof      (POST)
     +─── /issue-credential  (POST, issuer key required)
     +─── /health            (GET)
```

The sidecar is a minimal Express.js service exposing the BBS+ operations over HTTP. It runs as a separate Docker container (or process) alongside the FastAPI backend.

### Credential Format
Agents hold a W3C Verifiable Credential with BBS+ signature:
```json
{
  "@context": ["https://www.w3.org/2018/credentials/v1"],
  "type": ["VerifiableCredential", "ClinicalAgentCredential"],
  "issuer": "<issuer_did>",
  "credentialSubject": {
    "id": "<agent_did>",
    "role": "laboratory_agent",
    "organization": "hospital_org_1",
    "capabilities": ["lab_analysis", "abnormality_detection"]
  },
  "proof": {
    "type": "BbsBlsSignature2020",
    "verificationMethod": "<issuer_did>#<key_id>",
    "proofValue": "<bbs_signature_bytes>"
  }
}
```

### Proof Format (Derived Proof / Verifiable Presentation)
```json
{
  "@context": ["https://www.w3.org/2018/credentials/v1"],
  "type": ["VerifiablePresentation"],
  "verifiableCredential": [{
    "@context": ["https://www.w3.org/2018/credentials/v1"],
    "type": ["VerifiableCredential", "ClinicalAgentCredential"],
    "credentialSubject": {
      "role": "laboratory_agent",
      "organization": "hospital_org_1"
    },
    "proof": {
      "type": "BbsBlsSignatureProof2020",
      "nonce": "<base64_nonce>",
      "proofValue": "<derived_proof_bytes>"
    }
  }]
}
```

### Key Management
- **Issuer keys:** BLS12-381 G2 key pair. Generated once at system setup. Private key stored securely in the backend environment (never in Fabric or the database).
- **Agent keys:** Agents hold the signed BBS+ credential (the credential itself is the "key material" for the prover). The BLS12-381 signing private key is the issuer's, not the agent's.

### Verification API (Python → Sidecar)
```python
# Conceptual interface — NOT YET IMPLEMENTED
async def verify_bbs_proof(
    proof_vp: dict,          # Derived Verifiable Presentation
    required_role: str,
    required_org: str,
    nonce: str               # Original verifier-generated nonce
) -> ZKPVerificationResult:
    ...
```

---

## 19. Authorization Decision Function

```
authorize(
    agent_identity: AgentIdentity,
    credential: VerifiableCredential,
    requested_resource: str,
    operation: str,
    purpose: str,
    policy: AuthorizationPolicy,
    proof: DerivedProof,
    credential_status: SBTStatus,
    nonce: str
) -> AuthorizationDecision
```

**Result:** `AUTHORIZED` | `DENIED` with the following reason codes:

| Code | Meaning |
|---|---|
| `DENY_ZKP_INVALID` | BBS+ proof verification failed |
| `DENY_ZKP_SIMULATED` | Proof is mock; not accepted as real authorization in production |
| `DENY_CREDENTIAL_REVOKED` | SBT status == REVOKED |
| `DENY_CREDENTIAL_EXPIRED` | Credential validity period exceeded |
| `DENY_CREDENTIAL_NOT_FOUND` | SBT record not found on Fabric |
| `DENY_CAPABILITY_MISSING` | Required capability not in disclosed attributes |
| `DENY_POLICY_MISMATCH` | Role/organization does not satisfy policy |
| `DENY_NONCE_INVALID` | Nonce already consumed, expired, or wrong session |
| `DENY_CREDENTIAL_INVALID` | BBS+ signature failed against issuer public key |

---

## 20. Explicit State Enumerations

### ZKP Status
```
NOT_REQUIRED     — ZKP gate not triggered for this request
PENDING          — Proof generation or verification in progress
SIMULATED        — Mock mode proof (not cryptographic)
VERIFIED         — BBS+ proof cryptographically verified
FAILED           — Proof verification failed
```

### Credential Status
```
VALID            — Within validity period, signature correct
EXPIRED          — Outside validity period
REVOKED          — Revoked by issuer
INVALID          — Signature verification failed
```

### SBT Status (Fabric)
```
ACTIVE           — SBT record present, status ACTIVE
REVOKED          — SBT record present, status REVOKED
NOT_FOUND        — No SBT record found for the agent/credential reference
```

### Authorization Status
```
AUTHORIZED       — All checks passed
DENIED           — One or more checks failed (reason code attached)
```

---

## 21. Implementation Structure

```
backend/privacy/zkp/
    __init__.py
    interface.py        ← Public API: generate_proof(), verify_proof()
    models.py           ← ZKPProof, ZKPVerificationResult, ZKPStatus (Pydantic)
    prover.py           ← Calls sidecar or mock based on ZKP_MODE
    verifier.py         ← Calls sidecar or mock, checks nonce, checks SBT
    nonce_registry.py   ← In-memory nonce tracking with TTL

zkp-sidecar/
    package.json
    index.js            ← Express.js REST API
    bbs_service.js      ← Wraps @mattrglobal/bbs-signatures
    Dockerfile
```

The rest of the system (orchestrator, authorization engine) depends **only** on:
- `generate_proof(credential, nonce, disclosed_attributes)` 
- `verify_proof(proof_vp, nonce, required_role, required_org, issuer_public_key)`

No other module knows about BLS12-381, pairing operations, or sidecar internals.

---

## 22. Reference / Expected Performance

> **Important:** These are reference estimates from published MATTR benchmarks and literature, NOT measured results from this implementation. All values must be empirically measured before production claims are made.

| Metric | Reference Estimate | Source |
|---|---|---|
| Proof generation | 10–50 ms | MATTR BBS+ benchmarks |
| Proof verification | 5–20 ms | MATTR BBS+ benchmarks |
| Proof size | 1–2 KB | MATTR documentation |
| Mock mode generation | < 1 ms | By design |
| Mock mode verification | < 1 ms | By design |

### Benchmark Plan (to be executed during Phase 7 implementation)
1. Prove single credential with 2 disclosed attributes (role, org) — measure P50, P95, P99 latency
2. Verify single derived proof — measure P50, P95, P99 latency
3. Concurrent authorization requests (10, 50, 100 concurrent) — measure throughput and latency impact
4. Proof size measurement (bytes serialized)
5. Memory usage per proof operation
6. Mock vs real mode latency comparison
7. Benchmark comparison table (BBS+ vs what SD-JWT would be as a baseline)

---

## 23. Test Plan

The following tests must pass before Phase 7 implementation is considered complete:

| # | Test | Expected Result |
|---|---|---|
| 1 | Valid proof, correct role, correct nonce | `AUTHORIZED` / `VERIFIED` |
| 2 | Invalid proof (tampered `proofValue`) | `DENIED` / `DENY_ZKP_INVALID` |
| 3 | Wrong role in predicate | `DENIED` / `DENY_POLICY_MISMATCH` |
| 4 | Wrong organization in predicate | `DENIED` / `DENY_POLICY_MISMATCH` |
| 5 | Expired credential (past validity period) | `DENIED` / `DENY_CREDENTIAL_EXPIRED` |
| 6 | Revoked SBT status on Fabric | `DENIED` / `DENY_CREDENTIAL_REVOKED` |
| 7 | Old nonce (already consumed) | `DENIED` / `DENY_NONCE_INVALID` |
| 8 | Replay valid proof with original nonce | `DENIED` / `DENY_NONCE_INVALID` |
| 9 | Correct proof, wrong policy | `DENIED` / `DENY_POLICY_MISMATCH` |
| 10 | Modified proof bytes | `DENIED` / `DENY_ZKP_INVALID` |
| 11 | Fabric SBT `ACTIVE` + valid proof | `AUTHORIZED` |
| 12 | Fabric SBT `REVOKED` + valid proof | `DENIED` / `DENY_CREDENTIAL_REVOKED` |
| 13 | `ZKP_MODE=mock` response | Status = `SIMULATED`, not `VERIFIED` |
| 14 | `ZKP_MODE=bbs` valid response | Status = `CRYPTOGRAPHICALLY_VERIFIED` |

---

## 24. Security Assumptions and Non-Claims

**Assumptions:**
- BLS12-381 discrete logarithm problem is computationally hard for classical computers.
- The issuer BLS12-381 private key is stored securely outside of Fabric.
- The Node.js sidecar is deployed in a trusted network environment (not exposed externally).
- The nonce registry TTL is configured to be shorter than the maximum acceptable proof window.

**NOT claimed:**
- This system is NOT "production-grade" in Phase 7 (prototype implementation).
- This system is NOT "quantum-safe" or "post-quantum secure" in the ZKP layer.
- BBS+ proofs are NOT claimed to provide "full anonymity" — the Fabric SBT provides an accountable audit path.
- The sidecar has NOT been independently security-audited.

---

## 25. Risks

| Risk | Severity | Mitigation |
|---|---|---|
| `@mattrglobal/bbs-signatures` native bindings incompatible with Windows | Medium | Use Docker for sidecar; test on Linux container |
| IETF `draft-irtf-cfrg-bbs-signatures` not yet finalized as RFC | Low | Pin to a specific draft version; monitor IETF datatracker |
| Nonce registry becomes a bottleneck under high concurrency | Medium | Use Redis TTL-keyed set in production |
| Sidecar adds ~5–15ms latency per proof operation | Low | Acceptable for authorization gate; not on the critical LLM path |
| BLS12-381 deprecated under quantum computing advances | Long-term | Migration path in Section 26 |

---

## 26. Future Migration Path

1. **Short-term:** Replace mock mode with real BBS+ sidecar for integration testing.
2. **Medium-term (Post-quantum):** When ML-DSA-signed BBS+ credentials become standardized, migrate the issuer key from BLS12-381 to a PQC-compatible selective-disclosure scheme (e.g., NIST-standardized ZK-friendly hash-based proofs when available).
3. **Long-term:** If gnark or a STARK-based system develops efficient native selective-disclosure credential circuits, consider migrating the ZKP layer to a fully post-quantum proof system.

---

## 27. References

1. IETF CFRG BBS Signatures Draft: https://datatracker.ietf.org/doc/draft-irtf-cfrg-bbs-signatures/
2. MATTR BBS Signatures (GitHub): https://github.com/mattrglobal/bbs-signatures
3. W3C BbsBlsSignature2020 (DIF): https://identity.foundation/bbs-signature/
4. W3C Verifiable Credentials Data Model: https://www.w3.org/TR/vc-data-model/
5. W3C Data Integrity BBS Cryptosuite: https://www.w3.org/TR/vc-di-bbs/
6. Hyperledger AnonCreds: https://github.com/hyperledger/anoncreds-spec
7. gnark (ConsenSys): https://docs.gnark.consensys.io/
8. Circom: https://docs.circom.io/
9. PyO3/Maturin for Rust-Python FFI: https://www.maturin.rs/

---

*This ADR requires review and explicit approval before any ZKP implementation code is written.*
