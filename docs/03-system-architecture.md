# 03 — System Architecture

## Overall Architecture

```mermaid
graph TB
    subgraph FE["Frontend (React/Vite)"]
        UI[Browser SPA]
        RQ[React Query Cache]
        RA[Role-Based Auth Guard]
    end

    subgraph BE["Backend (FastAPI/Python)"]
        API[FastAPI Routers]
        AUTH[Auth Service / JWT]
        HOSP[Hospital Service]
        ORCH[Orchestrator / Workflow Engine]
        
        subgraph AGENTS["Multi-Agent Network"]
            SUP[Supervisor Agent]
            CR[Clinical Reasoning]
            HIS[Medical History]
            LAB[Laboratory]
            MED[Medication Safety]
            RISK[Risk Assessment]
            EVD[Evidence]
            CRIT[Critic]
            VER[Verifier]
            SYN[Synthesizer]
        end
        
        CRYPTO[Crypto Layer<br/>SHA-256 + AES-GCM]
    end

    subgraph DATA["Data Layer"]
        DB[(SQLite / PostgreSQL)]
        MIO[MinIO Object Storage<br/>Encrypted Blobs]
    end

    subgraph CHAIN["Blockchain Layer"]
        GW[Fabric Gateway<br/>gRPC Client]
        FAB[Hyperledger Fabric Network]
        CC[Go Chaincode]
        LED[Immutable Ledger]
    end

    UI -->|HTTP+JWT| API
    API --> AUTH
    API --> HOSP
    API --> ORCH
    AUTH --> DB
    HOSP --> DB
    ORCH --> SUP --> CR & HIS & LAB & MED & RISK & EVD & CRIT & VER
    VER --> SYN
    SYN --> CRYPTO
    CRYPTO -->|Encrypted Blob| MIO
    CRYPTO -->|SHA-256 Hash| GW
    GW -->|gRPC| FAB
    FAB --> CC --> LED
    ORCH --> DB
```

---

## Component Architecture

### Layer 1: Frontend (Presentation)
- **Technology**: React + Vite + TailwindCSS
- **Purpose**: Role-aware UI portals for admin, doctor, patient
- **Communication**: REST API over HTTPS with JWT bearer tokens
- **State**: React Query for server state; localStorage for auth token and role

### Layer 2: API (Gateway)
- **Technology**: FastAPI (Python asyncio)
- **Purpose**: HTTP endpoints, input validation, authentication enforcement
- **Files**: `backend/api/*.py`

### Layer 3: Service (Business Logic)
- **Technology**: SQLAlchemy AsyncSession
- **Purpose**: Domain CRUD operations (auth, hospital, tasks, agents)
- **Files**: `backend/services/*.py`

### Layer 4: Orchestrator (AI Coordination)
- **Technology**: Pure Python async
- **Purpose**: Execute the ordered agent chain, enforce crypto pipeline
- **Files**: `backend/orchestrator/workflow.py`

### Layer 5: Agents (AI Reasoning)
- **Technology**: Groq API (LLM mode) or rule-based stubs (mock mode)
- **Purpose**: Specialized clinical reasoning tasks
- **Files**: `backend/agents/llm/`, `backend/agents/mock/`

### Layer 6: Crypto (Security)
- **Technology**: Python `hashlib`, `cryptography` library
- **Purpose**: Canonical JSON → SHA-256 → AES-GCM
- **Files**: `backend/crypto/`

### Layer 7: Storage (Off-Chain)
- **Technology**: MinIO (Boto3 SDK)
- **Purpose**: Store encrypted agent output blobs
- **Files**: `backend/storage/`

### Layer 8: Blockchain (Provenance)
- **Technology**: Hyperledger Fabric (Go chaincode, gRPC gateway)
- **Purpose**: Immutable hash proof recording
- **Files**: `backend/blockchain/gateway.py`, `blockchain/chaincode/`

---

## AI Agent Architecture

```mermaid
sequenceDiagram
    participant API
    participant Orch as Orchestrator
    participant Sup as Supervisor
    participant Agents as Specialist Agents
    participant Crit as Critic
    participant Ver as Verifier
    participant Syn as Synthesizer
    participant Crypto
    participant MinIO
    participant Fabric

    API->>Orch: run_workflow(task_data)
    Orch->>Sup: execute(task_data)
    Sup-->>Orch: required_agents list
    loop For each selected agent
        Orch->>Agents: execute(task_data)
        Agents-->>Orch: structured JSON output
        Orch->>Crypto: compute_sha256(output)
        Orch->>Crypto: encrypt_json(canonical_json)
        Orch->>MinIO: put_object(encrypted_blob)
        Orch->>Fabric: record_decision_proof(hash, metadata)
    end
    Orch->>Crit: execute(all_outputs)
    Orch->>Ver: execute(all_outputs)
    Orch->>Syn: execute(all_outputs)
    Orch->>Orch: calculate_consensus(outputs, verifications)
    Orch-->>API: WorkflowResult
```

---

## Hospital Workflow

```mermaid
flowchart LR
    A[Doctor Login] --> B[Select / Create Patient]
    B --> C[Open Patient Record]
    C --> D[Write Clinical Case Description]
    D --> E[Submit AI Analysis Request]
    E --> F[Task Created in Database]
    F --> G[Orchestrator Executes Workflow]
    G --> H[10 Agents Run Sequentially]
    H --> I[Cryptographic Pipeline]
    I --> J[Result Stored + Blockchain Proof]
    J --> K[Doctor Reviews Clinical Summary]
    K --> L[Human Clinical Decision]
```

---

## Blockchain Architecture  

```mermaid
flowchart TD
    subgraph Application
        BE[FastAPI Backend]
        GW[gateway.py - Fabric Gateway Client]
    end

    subgraph FabricNetwork["Hyperledger Fabric Network"]
        subgraph Org1
            P1[peer0.org1]
            CA1[ca.org1]
        end
        subgraph Org2
            P2[peer0.org2]
            CA2[ca.org2]
        end
        ORD[Orderer / RAFT]
        CH[Channel: mychannel]
        CC[Chaincode: clinical-decision-cc]
        WS[World State / CouchDB]
        LED[Ledger Blocks]
    end

    BE --> GW
    GW -->|gRPC| P1
    P1 --> CC
    P1 --> ORD
    ORD --> P1 & P2
    P1 --> WS
    P1 --> LED
    CC --> WS
```

---

## Data Flow Architecture

```mermaid
flowchart LR
    INPUT["Patient Case (text + context)"]
    INPUT --> ORCH
    ORCH --> AGENTS["Agent Outputs (JSON)"]
    AGENTS --> CANON["canonical_json() — sorted, deterministic"]
    CANON --> HASH["SHA-256 hash (hex string)"]
    HASH --> PROOF["DecisionProof record"]
    PROOF --> DB[(PostgreSQL / SQLite)]
    PROOF --> FABRIC[(Hyperledger Fabric)]
    AGENTS --> ENCRYPT["AES-256-GCM encrypt"]
    ENCRYPT --> MINIO[(MinIO encrypted blob)]
    
    VERIFY["Verification Engine"] --> MINIO
    VERIFY --> DECRYPT["Decrypt → canonical → SHA-256"]
    DECRYPT --> COMPARE{"Hash matches?"}
    COMPARE -->|YES| PASS[✅ Verified]
    COMPARE -->|NO| FAIL[❌ Tamper Detected → Audit Event]
```

---

## Security Architecture

```mermaid
flowchart TD
    USER[User] -->|Username + Password| LOGIN[POST /auth/login]
    LOGIN -->|Bcrypt verify| DB[(User table)]
    LOGIN -->|JWT HS256 signed| TOKEN[Bearer Token]
    TOKEN --> API[Every protected endpoint]
    API -->|Decode JWT| CLAIMS[user_id, role, username]
    CLAIMS --> RBAC{Role Check}
    RBAC -->|admin/operator| ADMIN_ROUTES[Admin endpoints]
    RBAC -->|doctor| DOCTOR_ROUTES[Doctor endpoints]
    RBAC -->|patient| PATIENT_ROUTES[Patient endpoints]
    RBAC -->|FAIL| 403[HTTP 403 Forbidden]
    
    subgraph Storage Security
        AGENT_OUT[Agent Output] -->|AES-GCM| ENCRYPTED[Encrypted Blob]
        ENCRYPTED --> MINIO[(MinIO)]
        HASH[SHA-256 Hash only] --> FABRIC[(Fabric)]
    end
```
