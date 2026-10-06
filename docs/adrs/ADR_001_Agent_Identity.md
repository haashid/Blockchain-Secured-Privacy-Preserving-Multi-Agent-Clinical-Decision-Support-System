# ADR 001: Agent Identity Architecture (DID, Credentials, SBT)

## 1. Context and Problem Statement
The multi-agent clinical decision support system requires strict authorization and accountability. Agents need an identity that is mathematically verifiable (DID), capabilities signed by an authority (Credentials), and a permanent, non-transferable record of their status on the blockchain (SBT-style tokens). We must define:
1. The DID method to be used.
2. The format for Verifiable Credentials.
3. How to represent SBTs (Soulbound Tokens) within Hyperledger Fabric.
4. Key separation and storage.

## 2. Decision

### 2.1 DID Method: `did:key`
We will use the `did:key` method using ECDSA secp256r1 (P-256) keys.
**Rationale:**
- Agents operate entirely within the backend system without DNS or external network discovery. `did:key` is fully self-contained and resolves deterministically from the public key, eliminating the need for a separate DID registry or VDR (Verifiable Data Registry).
- When PQC is enabled in Phase 8, we will transition or add `did:key` using ML-DSA.

### 2.2 Credential Format: W3C JWT Verifiable Credentials
We will use JSON Web Token (JWT) formatted W3C Verifiable Credentials (`jwt_vc`).
**Rationale:**
- Python has mature libraries for JWT (`python-jose`).
- The JWT payload structure naturally supports standard VC claims (`vc` object, `credentialSubject`).
- Fast verification locally before ZKP checks or database lookups.
- The issuer will be a central "Admin" or "System Authority" key.

### 2.3 SBT Representation in Hyperledger Fabric
Hyperledger Fabric does not natively support ERC-20/ERC-721/SBT standards. We will implement SBTs as a specific state asset in the Go chaincode.
**Structure:**
- Asset Type: `AgentIdentitySBT`
- Key: `sbt_<agent_did>`
- Fields: `did`, `role`, `issued_at`, `revoked`
**Enforcement:**
- The chaincode will only expose `IssueSBT` and `RevokeSBT` transactions.
- There will be **no `TransferSBT`** transaction. By definition in the chaincode logic, ownership cannot be reassigned, achieving the non-transferable property of a Soulbound Token.

### 2.4 Key Separation Policy
As specified in the Master Plan, strict separation is enforced:
1. **Agent DID Key (ECDSA P-256):** Used by the agent to sign its actions/proofs. Stored securely per-agent.
2. **Issuer Key (ECDSA P-256):** Used by the system authority to sign credentials.
3. **Fabric Identity Key (X.509):** Used by the Fabric Gateway to sign transactions submitted to the network. Managed by the Fabric MSP.

## 3. Consequences
- **Positive:** No external dependencies for DID resolution. Clear, standard-based credentials. Strong non-transferability enforced natively in Fabric chaincode.
- **Negative:** `did:key` cannot be rotated. If an agent's key is compromised, the agent must be revoked via the SBT in Fabric, and a new agent with a new DID must be provisioned. This is acceptable for automated software agents.

## 4. Implementation Steps
1. Create `backend/identity/did.py` for key pair and DID generation.
2. Create `backend/identity/credentials.py` for JWT VC issuance and verification.
3. Create `backend/identity/sbt.py` for the backend logic.
4. Update `models.py` (database) to store the DID and credential string for each agent.
5. Update the agent initialization script to automatically provision a DID and VC upon creation.
