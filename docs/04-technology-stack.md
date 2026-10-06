# 04 — Technology Stack

## Complete Stack Table

| Layer | Technology | Version | Purpose | Why Chosen |
|-------|-----------|---------|---------|-----------|
| Frontend Framework | React | 18.x | SPA component system | Industry standard, rich ecosystem |
| Frontend Build | Vite | 5.x | Dev server, bundler | 10x faster HMR than CRA |
| Frontend UI | TailwindCSS | 3.x | Utility CSS | Rapid design, no naming conflicts |
| Frontend HTTP | @tanstack/react-query | 5.x | Data fetching + caching | Automatic retry, cache invalidation |
| Frontend Routing | react-router-dom | v6 | SPA routing | Nested routes, role guards |
| Backend Framework | FastAPI | 0.110+ | REST API | Async, auto-docs, Pydantic native |
| Backend Runtime | Python | 3.10+ | Language | AI/ML ecosystem dominance |
| Backend Server | Uvicorn | 0.29+ | ASGI server | Async, production-grade |
| ORM | SQLAlchemy | 2.0+ | Database abstraction | Async support, type safety |
| DB (dev) | SQLite + aiosqlite | 3.x | Embedded SQL | Zero config, fast dev cycle |
| DB (prod) | PostgreSQL | 16.x | Production RDBMS | Reliability, ACID compliance |
| Object Storage | MinIO | Latest | S3-compatible storage | Self-hosted, private, no cloud lock-in |
| AI Provider | Groq | groq-python 0.9+ | LLM inference | Ultra-low latency (LPU hardware) |
| AI Models | Llama 3.1 70B / 8B | Meta | Clinical reasoning | Open-weights, strong reasoning |
| Blockchain | Hyperledger Fabric | 2.x | Permissioned ledger | Enterprise, private, no gas fees |
| Chaincode | Go | 1.21+ | Smart contract | Fabric native, performant |
| Fabric SDK | fabric-gateway (Python) | latest | gRPC connector | Official Fabric SDK |
| Hashing | SHA-256 (hashlib) | Python stdlib | Deterministic fingerprint | Industry standard, collision resistant |
| Encryption | AES-256-GCM (cryptography lib) | 42.x | Symmetric encryption | NIST approved, authenticated |
| Schema Validation | Pydantic | v2 | Request/response models | FastAPI native, strict types |
| Password Hashing | passlib + bcrypt | 1.7 | Credential security | Adaptive cost, salt built-in |
| JWT | python-jose | 3.3+ | Auth tokens | HS256 signed claims |
| Containerization | Docker + Docker Compose | Latest | Service orchestration | Reproducible environments |
| Testing | pytest + pytest-asyncio | 8.x | Test framework | Async support, fixtures |

---

## Deep-Dive: Why Each Technology Was Chosen

### FastAPI (vs Django vs Express/Node)

**FastAPI** was chosen over Django REST Framework and Node.js/Express for these reasons:

| Criterion | FastAPI | Django REST | Express/Node |
|-----------|---------|-------------|--------------|
| Async I/O | Native | Limited | Native |
| Auto-docs | Yes (Swagger/ReDoc) | No | No |
| Pydantic integration | Native | External | External |
| Performance | Very high | Moderate | High |
| Python AI ecosystem | Yes | Yes | No |
| Learning curve | Low-medium | High | Medium |

For an AI-heavy system interacting with Groq APIs, databases, and MinIO — all I/O-bound operations — async Python is critical. FastAPI handles these naturally without callback hell.

---

### Hyperledger Fabric (vs Ethereum vs Database)

This is the most important technology decision in the project.

#### Why NOT Ethereum?
- **Public blockchain**: Patient data traces would be visible to anyone.
- **Gas fees**: Every transaction costs ETH — impractical for hospitals at scale.
- **Throughput**: Ethereum handles ~15 TPS. Fabric handles 1000+ TPS.
- **No fine-grained permissioning**: Anyone with ETH can participate.

#### Why NOT Ethereum (Private/Geth)?
- Still uses EVM mechanics designed for public chains.
- Complex PoA consensus setup.
- No native enterprise identity management.
- No fine-grained channel isolation.

#### Why NOT Only a Database?
A database audit log can be modified by a database administrator. There is no cryptographic proof that the log was not altered after the fact. This is the exact problem blockchain solves.

#### Why Hyperledger Fabric?
- **Permissioned**: Only enrolled organizations (hospital, auditor) participate.
- **Channel isolation**: Different clinical departments can have private channels.
- **MSP (Membership Service Provider)**: Identity based on X.509 certificates — compatible with enterprise PKI.
- **No cryptocurrency**: No gas fees, no token economy.
- **Pluggable consensus**: RAFT ordering for hospital use.
- **CouchDB world state**: Rich JSON queries on chain state.
- **Go chaincode**: Type-safe, performant smart contracts.

---

### Groq (vs OpenAI vs Ollama vs Local LLM)

| Criterion | Groq | OpenAI | Ollama (local) | Ollama (GPU cloud) |
|-----------|------|--------|----------------|-------------------|
| Speed | 300-500 tokens/s | ~50 tokens/s | 5-50 tokens/s | 50-200 tokens/s |
| Privacy | Dependent on ToS | Third-party | 100% local | 100% local |
| Cost | Per token | Per token | Free | GPU rental |
| Multi-agent suitability | Excellent | Good | Poor | OK |
| JSON mode | Yes | Yes | Limited | Limited |
| Availability | API key needed | API key needed | Local install | GPU required |

For a **multi-agent system with 10 sequential agents**, latency compounds. If each agent takes 5 seconds on OpenAI, the full chain takes 50 seconds. Groq reduces this to 5-10 seconds total — making the system actually usable.

**Current configuration:**
- Heavy reasoning agents (Supervisor, Clinical Reasoning, Synthesizer, Risk): `llama-3.1-70b-versatile`
- Fast agents (History, Lab, Med, Evidence, Critic, Verifier): `llama-3.1-8b-instant`

---

### MinIO (vs AWS S3 vs IPFS vs Local Filesystem)

| Criterion | MinIO | AWS S3 | IPFS | Local FS |
|-----------|-------|--------|------|----------|
| Self-hosted | Yes | No | Yes | Yes |
| S3-compatible API | Yes | Reference | No | No |
| Privacy | Strong | Cloud-dependent | Public by default | Strong |
| Scalability | High | Very high | High | Low |
| Cost | Free | Pay-per-use | Free | Free |
| Encryption | Client-side (our AES) | AES-256 optional | No standard | No standard |
| Hospital suitability | Excellent | Conditional | Poor | Poor |

MinIO gives us AWS S3 compatibility (Boto3 SDK works unchanged) while keeping all data on-premises — essential for healthcare data sovereignty.

---

### SHA-256 (vs SHA-1 vs MD5 vs Blake2)

| Algorithm | Security | Speed | Collision Risk | Used For |
|-----------|----------|-------|----------------|---------|
| MD5 | Broken | Fast | Known collisions | ❌ Never for security |
| SHA-1 | Deprecated | Fast | SHA-1 attacks known | ❌ Not for new systems |
| SHA-256 | Secure | Good | None known | ✅ Our choice |
| SHA-3 | Secure | Slower | None known | ✅ Alternative |
| Blake2 | Secure | Fastest | None known | ✅ Alternative |

SHA-256 was chosen because:
1. NIST-approved standard.
2. Used in Bitcoin, TLS, blockchain systems universally — widely understood.
3. Python stdlib `hashlib` — no extra dependency.
4. 256-bit output — collision-resistant for our use case.

---

### AES-256-GCM (vs AES-CBC vs ChaCha20)

**AES-256-GCM** is an **authenticated encryption** mode. This means:

- It encrypts the data (confidentiality).
- It produces an authentication tag (integrity — detects tampering of ciphertext).
- Uses a random 96-bit nonce per encryption (prevents replay attacks).

| Mode | Auth Tag | Nonce Required | Parallelizable | Choice |
|------|----------|----------------|----------------|--------|
| AES-CBC | No | Yes (IV) | No | ❌ No integrity |
| AES-CTR | No | Yes | Yes | ❌ No integrity |
| AES-GCM | Yes | Yes | Yes | ✅ Our choice |
| ChaCha20-Poly1305 | Yes | Yes | N/A | ✅ Alternative |

GCM was chosen because it provides both privacy AND integrity in one operation.

---

### Pydantic v2 (vs Marshmallow vs dataclasses)

| Criterion | Pydantic v2 | Marshmallow | Dataclasses |
|-----------|-------------|-------------|-------------|
| FastAPI native | Yes | No | Partial |
| JSON schema generation | Yes | Partial | No |
| Performance | Very fast (Rust core) | Medium | Fast |
| Validator syntax | Clean decorator | Verbose | No validators |
| LLM schema injection | Yes (model_json_schema) | Manual | No |

Critically for this project — Pydantic schemas are injected **directly into LLM system prompts** as JSON Schema. This teaches the LLM exactly what output format is required, dramatically reducing hallucinated fields.

---

## Technology Comparison Summary

| Decision | Chosen | Main Alternative | Key Reason |
|----------|--------|-----------------|-----------|
| Blockchain | Hyperledger Fabric | Ethereum | Permissioned, no gas fees, enterprise identity |
| Storage | MinIO | AWS S3 | Self-hosted, data sovereignty |
| AI Provider | Groq | OpenAI | 6-10x faster, critical for multi-agent |
| Backend | FastAPI | Django | Native async, auto-docs |
| Frontend | React + Vite | Next.js | Simpler SPA, faster dev |
| Hashing | SHA-256 | Blake2 | Industry standard, understood by all |
| Encryption | AES-256-GCM | AES-CBC | Authenticated encryption |
| Schema | Pydantic v2 | Marshmallow | FastAPI native + LLM schema injection |
