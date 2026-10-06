# 24 — Security Architecture

## Security Principles

This system was designed around five core security principles:

1. **Defense in Depth**: Multiple layers of protection — JWT, role checks, encryption, blockchain immutability.
2. **Least Privilege**: Each role gets only the minimum permissions required.
3. **Zero Trust**: Frontend routing is never trusted; all authorization is server-side.
4. **Privacy by Design**: Patient data never stored on public-facing ledger; only hashes.
5. **Non-Repudiation**: Blockchain provides cryptographic proof of AI outputs.

---

## Security Controls Map

| Threat | Control | Implementation |
|--------|---------|---------------|
| Unauthorized access | JWT Authentication | `core/security.py` — HS256 tokens |
| Privilege escalation | RBAC | `check_role()` dependency on every route |
| Brute force login | (Future) Rate limiting | Currently not implemented |
| SQL Injection | ORM queries | SQLAlchemy parameterized queries — no raw SQL |
| XSS | React (default escaping) | React HTML escapes all string renders |
| CSRF | JWT Bearer header | Bearer tokens not sent automatically by browsers |
| Data breach (MinIO) | AES-256-GCM encryption | All agent outputs stored encrypted |
| Tamper of AI outputs | SHA-256 + Blockchain | Hash stored on immutable Fabric ledger |
| Weak passwords | bcrypt | Adaptive cost, built-in salt |
| Timing attacks on hashes | hmac.compare_digest | Constant-time comparison |
| Unauthorized blockchain writes | MSP identity | Only Org1MSP-enrolled identities can submit |

---

## Threat Model

### In-Scope Threats

**Insider Threat (Database Admin)**:
- Scenario: A hospital admin modifies an AI report in the database after a bad clinical outcome.
- Control: SHA-256 hash is on the blockchain. Any modification detected by verification engine.
- Result: `audit_events` table records `verification.hash_mismatch`; trust score deducted.

**External Attacker (Data Breach)**:
- Scenario: Attacker gains access to MinIO storage.
- Control: All data is AES-256-GCM encrypted. Without the `ENCRYPTION_KEY`, data is unreadable.
- Limitation: If the encryption key is also compromised, data is exposed.

**Credential Theft**:
- Scenario: Attacker steals a JWT.
- Control: JWT expires after `JWT_EXPIRY_MINUTES`. No refresh tokens.
- Limitation: Until expiry, the stolen token can be used.

**Patient Record Access (IDOR)**:
- Scenario: Patient A tries to access Patient B's records by changing URL parameters.
- Control: Role check (patients can only hit patient endpoints, doctors can see all patients within scope).
- Limitation: Full row-level security not implemented — a partial risk.

### Out of Scope
- Physical access to servers.
- Supply chain attacks on dependencies.
- Side-channel attacks on encryption hardware.
- Denial of service attacks.

---

## Data Classification

| Data Type | Classification | Storage | Encrypted |
|-----------|---------------|---------|-----------|
| User passwords | Sensitive | DB (bcrypt) | ✅ (bcrypt) |
| JWT secrets | Sensitive | .env | ❌ (at rest) |
| Patient demographics | PHI | DB | ❌ (at rest) |
| AI agent outputs | Clinical | MinIO | ✅ AES-256-GCM |
| SHA-256 hashes | Non-sensitive | DB + Fabric | N/A |
| Audit events | Operational | DB | ❌ |
| Encryption key | Critical | .env | ❌ (at rest) |

> ⚠️ **Academic project note**: In production HIPAA contexts, ALL patient data (not just AI outputs) must be encrypted at rest using HSM-backed keys and the system must be deployed in a compliant infrastructure.

---

## Cryptographic Security Analysis

### SHA-256 Security
- **Security level**: 128-bit collision resistance (NIST approved).
- **Current best attack**: None practical (Grover's algorithm on quantum computers would reduce to 128-bit security).
- **Use in this project**: Fingerprinting AI output for tamper detection.
- **Not used for**: Password storage (bcrypt is used instead).

### AES-256-GCM Security
- **Security level**: 256-bit key = 2²⁵⁶ brute force space.
- **Authentication tag**: 128 bits — detects any ciphertext modification.
- **Nonce**: 96-bit random per encryption — prevents nonce reuse attacks.
- **Limitation**: Security depends on key secrecy.

### JWT HS256 Security
- **Security level**: Depends on secret key length.
- **Best practice**: Key should be ≥256 random bits.
- **Verification**: Signature check on every request.

---

## Security Limitations (Academic Scope)

The following are known security limitations acceptable for academic demonstration but NOT suitable for a production clinical system:

1. **Keys in `.env`**: `JWT_SECRET_KEY`, `ENCRYPTION_KEY`, `GROQ_API_KEY` are all in a single plaintext file. Use a secrets manager (HashiCorp Vault, AWS Secrets Manager) in production.

2. **No MFA**: Single-factor authentication only. Production clinical systems require MFA.

3. **No rate limiting**: Unlimited login attempts possible. A brute force attack is feasible.

4. **Patient data to Groq**: In LLM mode, patient context (symptoms, medications, allergies) is sent to Groq's API (external service). This would violate HIPAA without a Business Associate Agreement.

5. **SQLite in dev**: SQLite has no user-level database access control. Any process on the machine with read access can read the database file.

6. **No TLS in dev**: API calls between frontend and backend in development are HTTP, not HTTPS. Production requires TLS certificates.

7. **IDOR partial risk**: Row-level security is not enforced on all patient endpoints.

8. **Fabric in simulation**: Without a real running Fabric network, "blockchain" mode hashes are stored in the application database — which is modifiable.
