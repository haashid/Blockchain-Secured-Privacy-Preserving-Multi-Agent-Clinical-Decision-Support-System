# 16 — Tools and Integrations

## What is Tool Calling?

In LLM development, **tool calling** (also called "function calling") is the ability for an LLM agent to invoke external functions — like querying a database, making an API call, or searching the web — rather than relying solely on its training data.

```
Without tool calling:
  Agent → [LLM reasoning only] → Answer (from training data)

With tool calling:
  Agent → [LLM decides to call] → get_patient_labs(patient_id) → real DB data
                                → search_guidelines("diabetes management") → real docs
         → [LLM reasons over real data] → Grounded Answer
```

---

## Current State: Tool Calling NOT Implemented

All agents in this system receive data **only via the task context dict**. They cannot autonomously query databases, call APIs, or retrieve documents.

This is a fundamental limitation of the current architecture.

---

## Which Integrations Are Active

| Integration | Status | Notes |
|-------------|--------|-------|
| Groq LLM API | ✅ ACTIVE (when `AI_MODE=groq`) | Async, JSON mode, retries |
| SQLite / PostgreSQL (SQLAlchemy) | ✅ ACTIVE | All DB operations |
| MinIO (Boto3 S3 SDK) | ✅ ACTIVE | Encrypted blob storage |
| Hyperledger Fabric (gRPC) | 🟡 PARTIAL | Gateway stub, real if SDK installed |
| bcrypt (password hashing) | ✅ ACTIVE | Login security |
| JWT (python-jose) | ✅ ACTIVE | Auth tokens |
| Python `cryptography` library | ✅ ACTIVE | AES-256-GCM |
| Python `hashlib` | ✅ ACTIVE | SHA-256 |

---

## Which Tool Integrations Are NOT Implemented

| Tool | Use Case | Notes |
|------|---------|-------|
| ChromaDB / Pinecone | Vector search for RAG | See doc 14 |
| FHIR API | Real hospital EHR integration | Out of scope |
| PubMed API | Real-time medical literature | Future |
| Sentry / Datadog | Production monitoring | Future |
| Alembic | Database migration management | Future |
| WebSocket | Real-time bidirectional events | Future (currently SSE) |
| Redis | Caching & session storage | Future |

---

## How Tool Calling Could Be Added

Using Groq's function calling API:

```python
tools = [
    {
        "type": "function",
        "function": {
            "name": "get_patient_medications",
            "description": "Retrieve current medications for a patient",
            "parameters": {
                "type": "object",
                "properties": {
                    "patient_id": {"type": "string", "description": "Patient UUID"},
                },
                "required": ["patient_id"]
            }
        }
    }
]

response = await client.chat.completions.create(
    model="llama-3.1-70b-versatile",
    messages=messages,
    tools=tools,
    tool_choice="auto"
)

# If model calls the tool:
if response.choices[0].message.tool_calls:
    for call in response.choices[0].message.tool_calls:
        if call.function.name == "get_patient_medications":
            args = json.loads(call.function.arguments)
            result = await hospital_service.get_prescriptions(db, args["patient_id"])
            # Inject result back into conversation
```

This would allow agents to actively fetch patient data on demand, rather than requiring it pre-packaged in `patient_context`.

---

## SSE (Server-Sent Events) — Partial Integration

The system was designed to stream workflow events in real time via SSE (Server-Sent Events) — a one-way HTTP stream from server to browser.

**Status**: Architecture supports it (event timeline in `WorkflowResult`). The frontend `TaskDetailPage` displays events. Full streaming push while the workflow runs is a future enhancement — currently events are returned all at once after completion.
