# 34 — Glossary

| Term | Definition |
|------|-----------|
| **AES** | Advanced Encryption Standard. A symmetric block cipher using a shared key. AES-256 uses a 256-bit key. |
| **AES-GCM** | AES with Galois/Counter Mode. Provides both encryption (confidentiality) and authentication (integrity). Preferred over AES-CBC. |
| **Agent** | A software entity that receives input, applies reasoning (LLM or rule-based), and produces structured output. In this project: a clinical specialist AI. |
| **API** | Application Programming Interface. A defined set of HTTP endpoints that allow the frontend to communicate with the backend. |
| **ASGI** | Asynchronous Server Gateway Interface. FastAPI + Uvicorn use ASGI for non-blocking async HTTP. |
| **Authentication** | Verifying who a user is (username + password → JWT). |
| **Authorization** | Verifying what an authenticated user is allowed to do (role check). |
| **Bcrypt** | A password hashing algorithm with adaptive cost factor and built-in salt. Used in this project for user passwords. |
| **Blockchain** | An append-only linked list of data blocks where each block contains the hash of the previous block, making historical modification detectable. |
| **CA** | Certificate Authority. In Fabric: issues X.509 certificates to users, peers, and orderers. |
| **Canonical JSON** | A deterministic JSON serialization format where keys are sorted alphabetically and spacing is normalized. Ensures the same data always produces the same string, hence the same hash. |
| **Chaincode** | Smart contracts in Hyperledger Fabric. Written in Go (in this project). Defines what data can be stored and what transactions are valid. |
| **Channel** | In Hyperledger Fabric: a private subnet shared between specific organizations only. |
| **Confidence Score** | A float (0.0-1.0) an agent reports about its own certainty. This is model-reported, NOT clinical accuracy. |
| **Consensus** | In this project: the weighted average of agent confidence scores, used to determine if a multi-agent analysis is "accepted", "warning", or "rejected". |
| **CouchDB** | A document database used as the world state store in Hyperledger Fabric. Supports rich JSON queries. |
| **Cryptography** | The practice of securing communications and data using mathematical techniques. |
| **DecisionProof** | A database record and blockchain entry proving that a specific AI agent produced a specific output with a specific hash at a specific time. |
| **Docker** | Containerization platform. Packages applications and dependencies into isolated containers. |
| **Docker Compose** | Tool to define and run multi-container Docker applications using a YAML file. |
| **Endorsement** | In Fabric: the signing of a transaction by peers according to an endorsement policy, before it is submitted to the orderer. |
| **Encryption** | Transforming data (plaintext) into unreadable form (ciphertext) using a key. Reversible with the correct key. |
| **FastAPI** | A Python web framework for building REST APIs, using Python async/await, Pydantic for validation, and auto-generated documentation. |
| **Fabric Gateway** | A component (and Python SDK) that provides a simple API for client applications to interact with a Hyperledger Fabric network via gRPC. |
| **GCM** | Galois/Counter Mode. An encryption mode that adds an authentication tag (integrity checking) to AES encryption. |
| **gRPC** | Google Remote Procedure Call. A high-performance RPC framework using Protocol Buffers. Used to communicate with the Fabric peer gateway. |
| **Hash** | A fixed-size output produced by a hash function from any input. One-way (not reversible). Used to create fingerprints for data. |
| **HIPAA** | Health Insurance Portability and Accountability Act. US law governing patient data privacy. This system is academic and not HIPAA-certified. |
| **HMAC** | Hash-based Message Authentication Code. `hmac.compare_digest` provides constant-time comparison to prevent timing attacks. |
| **IDOR** | Insecure Direct Object Reference. A vulnerability where users can access other users' data by guessing IDs. |
| **JWT** | JSON Web Token. A signed token (HS256 in this project) used for authentication. Contains: user_id, username, role, expiry. |
| **Ledger** | In Fabric: the immutable record of all committed transactions. Combined with the world state, it represents the full history and current state. |
| **LLM** | Large Language Model. A neural network trained on large text corpora that can generate text, answer questions, and reason about complex topics. Groq/Llama-3.1 in this project. |
| **MinIO** | An open-source, S3-compatible object storage server. Used in this project to store encrypted AI agent output blobs. |
| **Mock Agent** | A rule-based agent implementation that produces realistic output without calling an LLM. Used in development when `AI_MODE=mock`. |
| **MSP** | Membership Service Provider. Manages and validates identities within a Fabric organization. Associates X.509 certificates with roles. |
| **Multi-Agent System** | A system where multiple independent AI agents collaborate to solve a complex problem. |
| **Nonce** | Number used ONCE. A random value used in cryptographic operations to ensure uniqueness. In AES-GCM: 96-bit random value, stored with ciphertext. |
| **Orderer** | In Fabric: the ordering service that sequences transactions into blocks and distributes them to peers. Does not execute chaincode. |
| **ORM** | Object-Relational Mapper. SQLAlchemy in this project maps Python classes to database tables. |
| **Peer** | In Fabric: a network node that maintains the ledger, executes chaincode, and endorses transactions. |
| **Permissioned Blockchain** | A blockchain where participation is restricted to authenticated, invited organizations. Opposite of public blockchains like Bitcoin/Ethereum. |
| **Pydantic** | Python library for data validation using type annotations. Version 2 (Rust core) is used in this project. Also generates JSON Schemas for LLM prompts. |
| **RAFT** | A distributed consensus algorithm. Used in this project as the Hyperledger Fabric ordering consensus mechanism. Tolerant of node failures. |
| **RAG** | Retrieval Augmented Generation. Augmenting LLM responses with relevant documents retrieved from a vector database. NOT implemented in this project. |
| **RBAC** | Role-Based Access Control. A security model where permissions are assigned to roles (admin, doctor, patient) and users are assigned roles. |
| **REST** | Representational State Transfer. An architectural style for HTTP APIs using standard methods (GET, POST, PUT, DELETE). |
| **SHA-256** | Secure Hash Algorithm — 256-bit output. A one-way function producing a 64-character hex fingerprint from any input. |
| **SQLAlchemy** | Python async ORM used to interact with SQLite/PostgreSQL databases in this project. |
| **SSE** | Server-Sent Events. A one-way stream from server to browser. Used (partially) for real-time workflow timeline updates. |
| **Supervisor Agent** | The orchestration agent that reads a clinical case and decides which specialist agents are required. |
| **Tamper Detection** | The ability to detect if stored data was modified after it was hashed and recorded on the blockchain. |
| **Token** | In this project: a JWT Bearer token sent in HTTP Authorization headers. |
| **Trust Score** | A numerical score (0-100) assigned to each AI agent, reflecting their verification history. Not equivalent to clinical accuracy. |
| **UUID** | Universally Unique Identifier. A 128-bit random identifier used as primary keys in all database tables. |
| **Uvicorn** | A Python ASGI web server for running FastAPI applications. Supports async request handling. |
| **Verification** | In this project: re-downloading the encrypted MinIO blob, decrypting it, re-hashing, and comparing the hash against the blockchain-stored hash to detect tampering. |
| **World State** | The current value of all assets on the Fabric ledger. Stored in CouchDB. Can be rebuilt from the ledger history. |
| **X.509** | A standard format for public key certificates. Used in Hyperledger Fabric for node and user identity. |
