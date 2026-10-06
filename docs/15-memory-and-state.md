# 15 — Memory and State

## What is Agent Memory?

In large language model research, **agent memory** refers to a system's ability to store, retrieve, and use information across multiple interactions or sessions.

---

## Current State: No Persistent Agent Memory

Agents in this system are **stateless per run**. Every time `run_workflow()` is called:

1. Agent instances are freshly created by `create_agents_for_roles()`.
2. No history from previous runs is available.
3. The only context available is `task_data["previous_outputs"]` — outputs from agents earlier in the **same run**.

---

## What "Memory" Exists Today

### 1. Intra-Run Memory (exists)
Within a single workflow run, agents accumulate context:
```python
task_with_context["previous_outputs"]["clinical_reasoning"] = output
# Later agents can read this
```
This is NOT persistent memory — it exists only during the execution of one run.

### 2. Database History (exists, not connected to agents)
The database stores all past runs, outputs, and proofs. A physician can view historical AI analyses through the UI. But agents themselves cannot query this history.

### 3. Trust Scores (exists, not used by agents)
Agent trust scores update over time based on verification results. This is a form of "system-level" memory about agent reliability. But agents do not read their own trust score during execution.

---

## Types of Memory Not Implemented

| Memory Type | Description | Status |
|-------------|-------------|--------|
| Episodic | Recall specific past patient case details | ❌ Not implemented |
| Semantic | Domain knowledge retrieval (RAG) | ❌ Not implemented |
| Working | Intra-run `previous_outputs` accumulation | ✅ Implemented |
| Procedural | Learning how to do tasks better over time | ❌ Not implemented |

---

## How Agent Memory Could Be Added

### Episodic Memory (Patient History Retrieval)

```python
class LLMAgentWithMemory(LLMAgent):
    async def execute(self, task, context=None):
        patient_id = task.get("patient_context", {}).get("patient_id")
        
        if patient_id:
            # Retrieve recent case history from DB
            past_cases = await db.execute(
                select(Task).where(
                    Task.patient_context["patient_id"].astext == patient_id
                ).order_by(Task.created_at.desc()).limit(3)
            )
            task["historical_cases"] = [case.description for case in past_cases]
        
        return await super().execute(task, context)
```

### Semantic Memory (RAG — see doc 14)
Connect Evidence Agent to ChromaDB vector database for real-time clinical guideline retrieval.

---

## Current Agent State Lifecycle

```
run_workflow() called
    ↓
agent = MockClinicalReasoningAgent("agent-clinical_reasoning-01")
    ↓ (stateless constructor, no memory loaded)
output = await agent.execute(task_data)
    ↓ (reads only task_data)
result.agent_outputs["clinical_reasoning"] = output
    ↓
# agent object goes out of scope — memory lost
```

Each agent is effectively a pure function of its inputs.
