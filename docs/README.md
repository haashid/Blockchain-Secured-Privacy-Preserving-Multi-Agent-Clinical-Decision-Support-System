# 📚 Project Documentation Index

**Blockchain-Secured Multi-Agent Clinical Decision Support System**

This directory contains the complete technical knowledge base for the project.

---

## 🗂️ Document Index

| # | Document | Description |
|---|----------|-------------|
| — | [PROJECT_MASTER_DOCUMENTATION.md](./PROJECT_MASTER_DOCUMENTATION.md) | **Complete consolidated reference** |
| 01 | [01-project-overview.md](./01-project-overview.md) | What the project is and why it exists |
| 02 | [02-problem-and-objectives.md](./02-problem-and-objectives.md) | Problem statement, objectives, scope |
| 03 | [03-system-architecture.md](./03-system-architecture.md) | High-level architecture with diagrams |
| 04 | [04-technology-stack.md](./04-technology-stack.md) | Tech stack, versions, comparisons |
| 05 | [05-repository-structure.md](./05-repository-structure.md) | File structure explained file-by-file |
| 06 | [06-backend-architecture.md](./06-backend-architecture.md) | Backend layers and component design |
| 07 | [07-database-architecture.md](./07-database-architecture.md) | All tables, relationships, ER diagram |
| 08 | [08-authentication-authorization.md](./08-authentication-authorization.md) | Auth, JWT, RBAC, permission matrix |
| 09 | [09-hospital-domain.md](./09-hospital-domain.md) | Hospital entities and workflows |
| 10 | [10-multi-agent-system.md](./10-multi-agent-system.md) | Multi-agent architecture deep-dive |
| 11 | [11-agent-reference.md](./11-agent-reference.md) | Every agent documented individually |
| 12 | [12-agent-orchestration.md](./12-agent-orchestration.md) | Orchestrator, workflow engine |
| 13 | [13-llm-and-groq.md](./13-llm-and-groq.md) | LLM integration, Groq, mock mode |
| 14 | [14-rag-and-evidence.md](./14-rag-and-evidence.md) | RAG status (not implemented) |
| 15 | [15-memory-and-state.md](./15-memory-and-state.md) | Agent memory and state |
| 16 | [16-tools-and-integrations.md](./16-tools-and-integrations.md) | Tool calling status |
| 17 | [17-cryptography.md](./17-cryptography.md) | SHA-256, AES-GCM, canonical JSON |
| 18 | [18-off-chain-storage.md](./18-off-chain-storage.md) | MinIO, storage architecture |
| 19 | [19-hyperledger-fabric.md](./19-hyperledger-fabric.md) | Fabric concepts and network |
| 20 | [20-chaincode.md](./20-chaincode.md) | Go chaincode functions |
| 21 | [21-fabric-identity-and-access.md](./21-fabric-identity-and-access.md) | X.509, MSP, identity mapping |
| 22 | [22-fabric-gateway.md](./22-fabric-gateway.md) | Python-to-Fabric gateway |
| 23 | [23-data-flow.md](./23-data-flow.md) | Complete end-to-end data flow |
| 24 | [24-security-architecture.md](./24-security-architecture.md) | Security model and threat analysis |
| 25 | [25-privacy-and-clinical-safety.md](./25-privacy-and-clinical-safety.md) | Privacy, HIPAA context, safety rules |
| 26 | [26-frontend.md](./26-frontend.md) | React architecture and pages |
| 27 | [27-api-reference.md](./27-api-reference.md) | All API endpoints documented |
| 28 | [28-testing.md](./28-testing.md) | Test suites, results, coverage |
| 29 | [29-performance.md](./29-performance.md) | Latency, benchmarking |
| 30 | [30-demo-and-presentation.md](./30-demo-and-presentation.md) | 15-minute demo script |
| 31 | [31-troubleshooting.md](./31-troubleshooting.md) | Common errors and fixes |
| 32 | [32-development-guide.md](./32-development-guide.md) | How to modify the project |
| 33 | [33-viva-preparation.md](./33-viva-preparation.md) | 50+ examiner questions with answers |
| 34 | [34-glossary.md](./34-glossary.md) | All technical terms defined |

---

## 🚀 Quick Start

```bash
# Terminal 1 — Backend
cd backend
pip install -e .
python -m uvicorn app:app --reload --port 8000

# Terminal 2 — Frontend
cd frontend
npm install
npm run dev
```

**Demo credentials:**
- Admin: `admin` / `admin123`
- Doctor: `doctor1` / `doctor123`
- Patient: `patient1` / `patient123`

---

## 📖 Recommended Reading Order

**For beginners:** 01 → 04 → 03 → 09 → 10 → 17 → 19 → 33  
**For developers:** 05 → 06 → 07 → 08 → 12 → 27 → 32  
**For viva/exam:** 33 → 01 → 02 → 03 → 19 → 34
