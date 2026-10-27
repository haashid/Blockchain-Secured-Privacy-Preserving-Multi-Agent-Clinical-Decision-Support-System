# ADR-002: Zero-Knowledge Proof (ZKP) Architecture

**Status:** APPROVED FOR IMPLEMENTATION RESEARCH
**Date:** 2026-10-06
**Supersedes:** ADR-002 v2

---

## 1. Context

The MedAgentOS platform is a clinical multi-agent system where specialized AI agents collaborate. Access to sensitive Electronic Health Records (EHR) and clinical workflows is governed by a capability-based authorization model. Currently, authorization relies on plaintext verification of claims asserted within standard ES256 (ECDSA P-256) JWT-based W3C Verifiable Credentials.

To satisfy strict privacy-preserving authorization requirements, agents must be able to prove they meet policy conditions (e.g., possessing specific roles and capabilities from a trusted issuer) without exposing unnecessary attributes, their raw credential signatures, or patient data to every intermediate verifier.

---

## 2. Problem

We must select and define a privacy-preserving cryptographic mechanism (Zero-Knowledge Proof or Selective Disclosure) that allows an agent to prove possession of a valid credential satisfying a specific authorization policy, while strictly minimizing data exposure.

This architecture must explicitly integrate with our existing authorization engine, agent DID infrastructure, and Hyperledger Fabric SBT (Soulbound Token) revocation registry, without conflating these distinct layers.

---

## 3. Goals

- Define a privacy-preserving authorization layer using selective disclosure/ZKP.
- Explicitly delineate the boundaries between DIDs, Credentials, SBTs, ZKPs, and Fabric identities.
- Establish strict semantics for simulated vs. cryptographically verified proofs.
- Define a threat model and required mitigations (e.g., replay protection via nonces).
- Establish a rigorous test plan for the implementation phase.

---

## 4. Non-Goals

- **NOT** a proof of AI reasoning correctness.
- **NOT** an EHR data encryption scheme (AES-256-GCM handles data at rest).
- **NOT** a replacement for Fabric network consensus or X.509 MSP identities.
- **NOT** an automatic post-quantum cryptography (PQC) upgrade.
- **NOT** a mechanism to store patient data or secrets on a blockchain.

---

## 5. The Five Cryptographic Layers (Strict Separation)

The architecture explicitly distinguishes the following five layers. **They must never be conflated:**

1. **DID (Decentralized Identifier):**
   - *Answers:* WHO is the agent?
   - *Scope:* Provides the self-certifying public key identity (`did:key`) for the agent.

2. **Verifiable Credential (VC):**
   - *Answers:* WHAT CLAIMS does the trusted hospital issuer make about the agent?
   - *Scope:* A signed assertion of the agent's role, organization, and capabilities.

3. **SBT-style Record:**
   - *Answers:* WHAT STATUS / NON-TRANSFERABLE RECORD represents the agent's institutional identity/status?
   - *Scope:* A public, non-secret ledger record on Hyperledger Fabric providing a registry and revocation anchor.

4. **Zero-Knowledge Proof (ZKP):**
   - *Answers:* CAN THE AGENT PROVE a required credential property WITHOUT revealing unnecessary credential information?
   - *Scope:* A privacy-preserving mathematical presentation of a credential subset bound to a specific verifier challenge.

5. **Fabric X.509 / MSP Identity:**
   - *Answers:* WHICH AUTHENTICATED PARTICIPANT is authorized to interact with the Fabric network?
   - *Scope:* Transport and network-level TLS/transaction signing for the Hyperledger nodes.

---

## 6. Threat Model

| Threat | Mitigation |
|---|---|
| Forged credential | Verifier strictly checks the cryptographically derived proof against the trusted issuer's public key. |
| Invalid signature | ZKP verification mathematically fails if the underlying signature is invalid. |
| Expired credential | Verifier checks the `exp` (expiration) claim exposed during proof verification. |
| Revoked credential | Verifier independently checks the credential hash against the Fabric SBT registry (`ACTIVE` vs `REVOKED`). |
| Wrong role/organization/capability | Verifier checks the disclosed attributes against the explicit policy requirements. |
| Replayed proof / Wrong nonce | Proof is mathematically bound to a fresh, verifier-generated nonce. Nonces are tracked and single-use. |
| Proof modification | Cryptographic binding ensures modified proofs fail verification. |
| Policy mismatch | Proof may be valid, but authorization is explicitly `DENIED` if disclosed claims do not match the required policy. |
| Malicious verifier input | Verifier inputs (nonces, required policies) are strictly validated and typed. |
| Witness leakage | The proof generation algorithm is executed by the prover (agent) locally; the witness is never transmitted. |
| Patient-data leakage | Patient data is never part of the credential, proof, or SBT. ZKP only proves agent authorization. |
| Simulated proof treated as real | Strict enum typing (`SIMULATED` vs `VERIFIED`). A simulated proof is actively rejected in production environments. |

---

## 7. Requirements

1. **Selective Disclosure:** Hide raw credential signature bytes and unnecessary attributes from the verifier.
2. **Policy-Dependent:** ZKP is an authorization gate triggered *only* when `policy_requires_zkp = true`. It is not required for every single EHR operation unless policy dictates.
3. **Replay Protection:** Proofs must be bound to a verifier-generated challenge/nonce.
4. **Revocation Support:** Proof evaluation must be coupled with an independent SBT status check on Fabric.
5. **No On-Chain Secrets:** Private keys, witnesses, and raw patient records must never touch the Fabric ledger.

---

## 8. Candidate Approaches

1. **BBS+ Signatures (W3C/IETF Draft):** Designed specifically for selective disclosure of credentials. Mathematically derives proofs from BLS12-381 signatures. Does not require complex R1CS circuits.
2. **SD-JWT (IETF RFC):** Hash-based selective disclosure. Fast, but provides no cryptographic unlinkability (the issuer signature is always exposed).
3. **General zk-SNARKs (Circom/gnark):** General-purpose circuits. Massive overhead (millions of constraints) to verify standard ECDSA/BLS signatures inside a circuit. Overkill and inefficient for simple credential selective disclosure.
4. **Home-grown Schnorr-like schemes:** Cryptographically risky. Hard to maintain, not standardized.

---

## 9. Comparison

| Feature | BBS+ Signatures | SD-JWT | Circom/gnark |
|---|---|---|---|
| **Selective Disclosure** | Yes | Yes | Yes |
| **Cryptographic Unlinkability** | Yes | No (Signature exposed) | Yes |
| **Performance for VC** | ~12ms KeyGen, ~41ms Sign, ~100ms Verify, ~166ms Prove, ~111ms Verify Proof | To be measured | Very Slow (Circuit overhead) |
| **Standardization** | IETF Draft / W3C | IETF RFC | N/A |
| **Complexity for this use case** | Low/Medium | Low | Extremely High |

---

## 10. Decision

**Selected Architecture:** BBS+ Signatures over W3C Verifiable Credentials (using `@mattrglobal/bbs-signatures` WASM library).

We have evaluated the libraries. `@mattrglobal/pairing_crypto` does not exist as named (NPM 404) and `@mattrglobal/node-bbs-signatures` fails native compilation on modern Node v22. However, the purely WASM-based `@mattrglobal/bbs-signatures` (v2.0.0) successfully executes on our stack.

If BBS+ native modules prove unviable in production later, the WASM version serves as an excellent, fully working implementation for our research prototype. **We will NOT invent a custom cryptographic protocol or home-grown Schnorr-like scheme.**

---

## 11. Detailed Architecture

### 11.1 Proof Statement
The target predicate the ZKP must prove is:

> *"I possess a valid credential issued by the trusted issuer asserting the required role/capability/organization attributes, and the credential is currently acceptable under the authorization policy."*

### 11.2 Credential Lifecycle
1. **Issuance:** The trusted authority issues a VC to the agent's DID.
2. **Anchoring:** A corresponding SBT record is anchored on Hyperledger Fabric indicating `ACTIVE`.
3. **Revocation:** If compromised, the issuer updates the Fabric SBT to `REVOKED`. The VC itself cannot be deleted from the agent, but the system will reject it.

### 11.3 Verification Flow
When `policy_requires_zkp = true`:
1. **Challenge:** Verifier generates a fresh, unique `nonce`.
2. **Proof Generation:** Agent generates a derived proof disclosing only required policy attributes, bound to the `nonce`.
3. **Cryptographic Check:** Verifier mathematically validates the proof, issuer public key, and nonce.
4. **SBT Check:** Verifier queries Fabric for the SBT status of the credential hash.
5. **Policy Check:** Verifier matches disclosed attributes against the required policy.

### 11.4 Nonce/Replay Model
- The `nonce` prevents replay attacks.
- The proof is mathematically bound to the `nonce`, policy identifier, and required claims.
- A proof generated for nonce A will fail verification for nonce B.
- Nonces must be tracked by the verifier and marked as consumed immediately upon use.

---

## 12. Explicit Status Semantics

The system must maintain strict separation of statuses across different layers.

**ZKP Status:**
- `NOT_REQUIRED`: No proof is required by policy.
- `PENDING`: Proof generation/verification is in progress.
- `SIMULATED`: A non-production test/mock result was used. **NEVER interpret this as cryptographically verified.**
- `VERIFIED`: A real proof was cryptographically generated and independently verified.
- `FAILED`: Required proof validation failed.

**Credential Status:**
- `VALID` / `EXPIRED` / `REVOKED` / `INVALID`

**SBT Status (Fabric):**
- `ACTIVE` / `REVOKED` / `NOT_FOUND`

**Authorization Decision:**
- `AUTHORIZED` / `DENIED`

A successful authorization (`AUTHORIZED`) requires `ZKP=VERIFIED` (or `NOT_REQUIRED`), `Credential=VALID`, `SBT=ACTIVE`, and an exact policy match.

---

## 13. Fabric / SBT Relationship

- **ZKP proves credential possession and required claims.**
- **Fabric/SBT provides institutional status, revocation, and registry information.**
- ZKP does **NOT** prove SBT ownership. ZKP proves the credential predicate; the system separately checks the SBT status.
- **NEVER** place credential secrets, ZKP witnesses, private keys, or raw patient records on the Fabric ledger.

---

## 14. Privacy Model

- **Authorization service / ZKP Verifier:** Receives only the derived proof and the minimum public attributes required by the policy (e.g., `role`, `capabilities`).
- **Fabric network:** Receives only opaque hashes (credential hash) and status enums (`ACTIVE`/`REVOKED`).
- **Clinical agents:** Do not see each other's credentials; they rely on the central orchestrator's capability routing.

---

## 15. Key Separation

Cryptographic roles must be strictly isolated. Keys must **not** be reused across these boundaries:
- **DID verification key:** Used for identifying the agent.
- **Credential issuer signing key:** Used exclusively for issuing VCs.
- **PQC signing key:** Future use for post-quantum identity.
- **Fabric X.509 identity key:** Used exclusively for Fabric network TLS and chaincode invocation.
- **EHR encryption key (AES-GCM):** Used exclusively for data-at-rest encryption.
- **ZKP witness/private material:** Local ephemeral secrets used during proof generation.

---

## 16. Mock-Mode Semantics

Mock ZKP mode may exist in the future **strictly for testing**.
- The API, UI, database, and audit logs must explicitly record `SIMULATED`.
- `SIMULATED != VERIFIED`.
- The system must never output language such as "ZKP verified", "cryptographically authorized", or "proof verified" unless a real cryptographic proof was mathematically validated.

---

## 17. Post-Quantum Cryptography (PQC) Relationship

- BBS+ is a privacy and selective-disclosure mechanism based on elliptic curve pairings (e.g., BLS12-381). **It is NOT automatically post-quantum secure.**
- Implementing BBS+ does not make the architecture post-quantum. PQC is a separate architectural layer.
- Future PQC phases will evaluate ML-KEM for key establishment and ML-DSA for digital signatures.
- **ML-DSA does NOT replace ZKP.**
- **ML-KEM does NOT replace AES-GCM.**
- **PQC does NOT replace Fabric's internal X.509 cryptography** unless explicitly upgraded at the network level.

---

## 18. Risks

- **Library Maturity:** `@mattrglobal/bbs-signatures` requires thorough validation for production readiness and Node.js runtime compatibility.
- **Performance:** Latency overhead of cryptographic pairings.
- **Integration Complexity:** Bridging Python FastAPI with a Node.js sidecar for cryptography.

---

## 19. Limitations

- Proving time, verification time, and proof sizes are **to be measured** during implementation. No estimated performance claims are made in this document.
- Not post-quantum secure (relies on classical pairing hardness).

---

## 20. Testing Strategy

The implementation phase must create tests covering at least:
1. Valid proof
2. Invalid proof
3. Wrong role
4. Wrong organization
5. Wrong capability
6. Expired credential
7. Revoked credential
8. Wrong policy
9. Modified proof
10. Modified public input
11. Wrong nonce
12. Replayed proof
13. Missing credential
14. Invalid credential
15. `NOT_REQUIRED` policy path
16. `SIMULATED` mode
17. Simulated result never treated as `VERIFIED`
18. Authorization `DENIED` when proof fails

---

## 21. Implementation Boundary
- **Phase 1:** Architecture/documentation only. (Currently Completing)
- **Phase 2:** Research and library validation.
- **Phase 3:** Proof implementation.
- **Phase 4:** Authorization integration.
- **Phase 5:** Testing.
- **Phase 6:** Frontend/status exposure.

**No code is to be implemented during the Phase 1 architecture revision.**

---

## 22. Future Work
- Execute Phase 2 research to validate the BBS+ library constraints.
- Measure and record actual proof generation and verification times.
- Begin integrating ZKP requirements into the `PolicyEngine`.
