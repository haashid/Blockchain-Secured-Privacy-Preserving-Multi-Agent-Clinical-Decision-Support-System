# 32 — Development Guide

## How to Safely Modify This Project

---

## Adding a New Agent

**Example: Adding a Cardiology Specialist Agent**

### Step 1: Define the Output Schema (`backend/agents/base.py`)
```python
class CardiologyOutput(BaseModel):
    agent_id: str
    role: str = "cardiology"
    summary: str
    ecg_interpretation: str = ""
    echo_findings: list[dict] = []
    cardiac_risk_score: float = Field(ge=0.0, le=1.0)
    urgency: Literal["low", "medium", "high", "critical"]
    confidence: float = Field(ge=0.0, le=1.0)

# Add to AGENT_OUTPUT_TYPES:
AGENT_OUTPUT_TYPES["cardiology"] = CardiologyOutput
```

### Step 2: Create the LLM Agent Class (`backend/agents/llm/clinical_agents.py`)
```python
class GroqCardiologyAgent(LLMAgent):
    name = "Cardiology Specialist Agent"
    role = "cardiology"
    capabilities = ["ecg_analysis", "echo_interpretation", "cardiac_risk"]
    system_instructions = (
        "Evaluate the patient's cardiac history, symptoms, and available data. "
        "Provide ECG interpretation, echocardiogram insights if available, "
        "and stratify cardiac risk. Always recommend cardiology referral."
    )
```

### Step 3: Create the Mock Agent (`backend/agents/mock/mock_agents.py`)
```python
class MockCardiologyAgent(BaseAgent):
    name = "Cardiology Specialist Agent"
    role = "cardiology"
    async def execute(self, task, context=None):
        return CardiologyOutput(
            agent_id=self.agent_id,
            summary="Cardiac evaluation completed.",
            ecg_interpretation="Sinus rhythm, no acute ST changes.",
            echo_findings=[],
            cardiac_risk_score=0.35,
            urgency="medium",
            confidence=0.80,
        ).model_dump()
```

### Step 4: Register in Factory (`backend/agents/factory.py`)
```python
from backend.agents.mock.mock_agents import MockCardiologyAgent
from backend.agents.llm.clinical_agents import GroqCardiologyAgent

# In register_all_agents():
registry.register(MockCardiologyAgent)
registry.register(GroqCardiologyAgent)
```

### Step 5: Add Role to Agent DB Enum (`backend/models/models.py`)
```python
role = Column(
    Enum(
        "supervisor", "clinical_reasoning", ..., "cardiology",  # ← add
        name="agent_role",
    ), ...
)
```

### Step 6: Update Supervisor Prompt (`backend/agents/llm/clinical_agents.py`)
```python
class GroqSupervisorAgent(LLMAgent):
    system_instructions = (
        "... If there are cardiac symptoms (chest pain, palpitations, ECG abnormalities), include 'cardiology'."
    )
```

### Step 7: Update Mock Supervisor (`backend/agents/mock/mock_agents.py`)
```python
if any(w in desc for w in ["cardiac", "chest", "ecg", "heart"]):
    required.insert(1, "cardiology")
```

### Step 8: Add Behavioral Test (`tests/verify_fixes.py`)
```python
def test_cardiology_agent_schema():
    output = MockCardiologyAgent("agent-cardiology-01").execute.__wrapped__(...)
    validated = CardiologyOutput.model_validate(output)
    assert 0.0 <= validated.confidence <= 1.0
```

---

## Adding a New API Endpoint

**Example: `GET /api/hospital/patients/{id}/summary`**

### Step 1: Add Service Method (`backend/services/hospital.py`)
```python
async def get_patient_summary(db: AsyncSession, patient_id: str) -> dict:
    patient = await get_patient(db, patient_id)
    records = await get_patient_records(db, patient_id)
    return {
        "patient": patient,
        "record_count": len(records),
        "last_visit": records[0].created_at if records else None,
    }
```

### Step 2: Add Route (`backend/api/hospital.py`)
```python
@router.get("/patients/{patient_id}/summary")
async def patient_summary(
    patient_id: str,
    db: AsyncSession = Depends(get_db),
    user = Depends(check_role("admin", "doctor"))
):
    summary = await get_patient_summary(db, patient_id)
    return summary
```

### Step 3: Add Frontend API Method (`frontend/src/lib/hospitalApi.ts`)
```typescript
getPatientSummary: async (patientId: string) => {
    return request<PatientSummary>(`/api/hospital/patients/${patientId}/summary`);
},
```

### Step 4: Use in Component
```tsx
const { data: summary } = useQuery({
    queryKey: ['patient-summary', patientId],
    queryFn: () => hospitalApi.getPatientSummary(patientId),
});
```

---

## Adding a New Database Model

**Example: Adding a `ClinicalAlert` table**

### Step 1: Define Model (`backend/models/hospital.py`)
```python
class ClinicalAlert(Base):
    __tablename__ = "clinical_alerts"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=gen_uuid)
    patient_id = Column(UUID(as_uuid=True), ForeignKey("patients.id"), nullable=False)
    doctor_id = Column(UUID(as_uuid=True), ForeignKey("doctors.id"), nullable=False)
    alert_type = Column(String(100), nullable=False)
    severity = Column(Enum("low", "medium", "high", "critical"), nullable=False)
    message = Column(Text, nullable=False)
    resolved = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
```

### Step 2: Import in database.py
```python
# backend/core/database.py
async def init_db():
    import backend.models.models
    import backend.models.hospital  # ← ClinicalAlert is here
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
```

The table is created automatically on next startup because `init_db()` calls `Base.metadata.create_all`.

---

## Adding a Frontend Page

**Example: Cardiology Reports page for Doctor portal**

### Step 1: Create the Page Component (`frontend/src/pages/doctor/DoctorCardiology.tsx`)
```tsx
import { useQuery } from "@tanstack/react-query";

export default function DoctorCardiology() {
    const { data, isLoading } = useQuery({
        queryKey: ["cardiology-reports"],
        queryFn: () => hospitalApi.getCardiologyReports(),
    });
    
    if (isLoading) return <div>Loading...</div>;
    
    return (
        <div className="p-6">
            <h1 className="text-2xl font-bold">Cardiology Reports</h1>
            {/* render data */}
        </div>
    );
}
```

### Step 2: Add Route in `App.tsx`
```tsx
import DoctorCardiology from "./pages/doctor/DoctorCardiology";

// Inside /doctor/* routes:
<Route path="cardiology" element={<DoctorCardiology />} />
```

### Step 3: Add Sidebar Link (`components/Layout.tsx`)
```typescript
const doctorNav = [
    { path: "/doctor/dashboard", label: "Dashboard", icon: Home },
    { path: "/doctor/cardiology", label: "Cardiology", icon: Heart },  // ← add
    ...
];
```

---

## Environment Variables Reference

```bash
# Database
DATABASE_URL=sqlite+aiosqlite:///./multichain.db  # dev
# DATABASE_URL=postgresql+asyncpg://user:pass@host:5432/dbname  # prod

# Security
JWT_SECRET_KEY=<strong-random-string>
ENCRYPTION_KEY=<64-char-hex-or-string>

# AI
AI_MODE=mock                         # mock | llm | groq
GROQ_API_KEY=<your-groq-api-key>
GROQ_MODEL=llama-3.1-70b-versatile
GROQ_FAST_MODEL=llama-3.1-8b-instant

# Storage
MINIO_ENDPOINT=localhost:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET=clinical-decisions

# Fabric (production)
FABRIC_GATEWAY_ENDPOINT=localhost:7051
FABRIC_MSP_ID=Org1MSP
FABRIC_CHANNEL_NAME=mychannel
FABRIC_CHAINCODE_NAME=clinical-decision-cc
FABRIC_CERT_PATH=/path/to/cert.pem
FABRIC_KEY_PATH=/path/to/key.pem
FABRIC_TLS_CERT_PATH=/path/to/tls-ca.pem

# App
CONSENSUS_THRESHOLD=0.70
APP_DEBUG=false
CORS_ORIGINS=http://localhost:5173
```

---

## Team Learning Roadmap

### Stage 1 (Week 1): Core Stack
**Learn**: Python basics, FastAPI, HTTP, REST APIs  
**Read**: `backend/app.py`, `backend/api/auth.py`, `backend/core/config.py`  
**Question you should answer**: "How does a doctor log in and get a JWT?"

### Stage 2 (Week 1-2): Database
**Learn**: SQLAlchemy async, ORM concepts, relationships  
**Read**: `backend/models/models.py`, `backend/models/hospital.py`, `backend/services/hospital.py`  
**Question**: "How is a Patient linked to a MedicalRecord linked to a Task?"

### Stage 3 (Week 2): Frontend
**Learn**: React, React Query, TypeScript, TailwindCSS  
**Read**: `frontend/src/App.tsx`, `frontend/src/components/Layout.tsx`, `frontend/src/lib/api.ts`  
**Question**: "How does the doctor's JWT token end up in an API request?"

### Stage 4 (Week 2-3): Agents
**Learn**: Pydantic, LLM concepts, prompt engineering  
**Read**: `backend/agents/base.py`, `backend/agents/llm/clinical_agents.py`, `backend/agents/llm/llm_base.py`  
**Question**: "How does the Supervisor decide which agents to run?"

### Stage 5 (Week 3): Orchestration
**Learn**: Python asyncio, workflow design  
**Read**: `backend/orchestrator/workflow.py` (all 336 lines)  
**Question**: "What happens to agent output between execution and blockchain?"

### Stage 6 (Week 3-4): Cryptography
**Learn**: SHA-256, AES-GCM, canonical JSON, nonces  
**Read**: `backend/crypto/canonical_json.py`, `backend/crypto/hashing.py`, `backend/crypto/encryption.py`  
**Question**: "Why must we canonicalize before hashing?"

### Stage 7 (Week 4): Blockchain
**Learn**: Hyperledger Fabric concepts, chaincode, channels  
**Read**: `backend/blockchain/gateway.py`, `blockchain/chaincode/contract.go`  
**Question**: "What exactly is stored on the blockchain? What is NOT?"

### Stage 8 (Week 4-5): Integration
**Learn**: Full system run from browser to blockchain  
**Read**: All docs in `docs/`  
**Action**: Run the complete system with `AI_MODE=mock`, submit a clinical case, trace the entire execution.

### Stage 9 (Week 5): Security
**Learn**: JWT security, RBAC, timing attacks, encryption key management  
**Read**: `backend/core/security.py`, `docs/08-authentication-authorization.md`, `docs/24-security-architecture.md`  
**Question**: "Why is backend authorization more important than frontend route guarding?"

### Stage 10 (Week 5-6): Testing and Demo
**Learn**: pytest, behavioral testing, demo script  
**Read**: `tests/verify_fixes.py`, `docs/30-demo-and-presentation.md`, `docs/33-viva-preparation.md`  
**Action**: Run all tests, then run the full demo yourself.
