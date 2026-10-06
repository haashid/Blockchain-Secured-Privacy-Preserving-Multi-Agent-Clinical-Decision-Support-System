# 21 — Fabric Identity and Access

## How Identity Works in Hyperledger Fabric

Every participant in a Fabric network — users, applications, peers, orderers — has a cryptographic identity issued by a Certificate Authority (CA). This identity is expressed as an **X.509 certificate**.

---

## X.509 Certificates

An **X.509 certificate** is a standard format for a public key certificate. Think of it like a digital passport:

- **Subject**: Who this certificate belongs to (e.g., `CN=agent-supervisor-01, OU=clinical, O=Org1MSP`)
- **Issuer**: Who issued it (the CA, e.g., `CN=ca.org1.example.com`)
- **Public Key**: The entity's public key
- **Signature**: The CA's cryptographic signature proving the certificate is authentic
- **Validity**: Not-before and not-after dates

---

## Membership Service Provider (MSP)

An **MSP** defines the rules for validating identities in an organization:

- Which root CA certificates to trust?
- Which intermediate CAs are valid?
- Which certificate extensions indicate admin roles?

In this project:
- **Org1MSP**: Hospital organization. CA at `ca.org1.example.com:7054`.
- **Org2MSP**: Auditing organization. CA at `ca.org2.example.com:8054`.

---

## Agent Identity Mapping

The application has a database table `agent_identities` that maps AI agent identities to Fabric identities:

```python
class AgentIdentity(Base):
    __tablename__ = "agent_identities"
    
    agent_id = Column(String)           # "agent-clinical_reasoning-01"
    fabric_enrollment_id = Column(String)  # "clinical_reasoning_agent"
    fabric_msp_id = Column(String)         # "Org1MSP"
    fabric_organization = Column(String)   # "hospital-org1"
    certificate_path = Column(String)      # "/certs/clinical_reasoning/cert.pem"
    key_path = Column(String)              # "/certs/clinical_reasoning/key.pem"
    role_attribute = Column(String)        # "clinical_agent"
    is_active = Column(Boolean)
```

**Purpose**: Each AI agent has its own Fabric-enrolled identity. When an agent submits a decision proof, the transaction is signed with that agent's private key. The Fabric ledger records which specific agent submitted each proof.

---

## Identity Hierarchy

```
Hospital Org1
  └── Fabric CA (ca.org1.example.com)
        ├── peer0.org1.example.com           (peer node identity)
        ├── admin                            (admin user)
        └── clinical-agents
              ├── agent-supervisor-01
              ├── agent-clinical_reasoning-01
              ├── agent-laboratory-01
              ├── agent-medication-01
              ├── agent-risk-01
              ├── agent-evidence-01
              ├── agent-critic-01
              ├── agent-verifier-01
              └── agent-synthesizer-01
```

---

## Enrollment Flow (Production)

```
1. System admin registers agent identity with Fabric CA:
   fabric-ca-client register \
     --id.name agent-clinical_reasoning-01 \
     --id.secret secret123 \
     --id.type client \
     --id.attrs "role=clinical_agent:ecert" \
     --tls.certfiles ca-cert.pem \
     -u https://ca.org1.example.com:7054

2. Agent enrolls (gets its cert + key):
   fabric-ca-client enroll \
     --id.name agent-clinical_reasoning-01 \
     --id.secret secret123 \
     --tls.certfiles ca-cert.pem \
     -u https://ca.org1.example.com:7054

3. cert.pem and key.pem stored securely
4. Paths stored in AgentIdentity table
5. gateway.py uses these when connecting to Fabric peer
```

---

## Current Implementation Status

**In production**: Each agent would use its own X.509 certificate to sign Fabric transactions.

**In current demo**: A single application identity (`FABRIC_CERT_PATH`, `FABRIC_KEY_PATH` in `.env`) is shared. All agent proofs are submitted under this single identity. The per-agent identity model exists in the database schema but is not used in the gateway implementation yet.

---

## Channel Access Control

Only organizations enrolled on `mychannel` can read or write to it:

| Organization | Can Read | Can Write | Purpose |
|-------------|---------|----------|---------|
| Org1MSP (Hospital) | ✅ | ✅ | Submit and query proofs |
| Org2MSP (Auditor) | ✅ | ❌ | Audit and verify only |

A hospital department not on `mychannel` cannot access any data on that channel — even if they have a valid Org1MSP identity.
