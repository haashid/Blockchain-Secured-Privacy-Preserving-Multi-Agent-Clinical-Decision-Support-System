# 14 — RAG and Evidence

## What is RAG?

**RAG** (Retrieval Augmented Generation) is a technique that improves LLM responses by providing relevant documents retrieved from an external knowledge base (vector database) rather than relying solely on the model's training data.

```
Traditional LLM:
  Question → [LLM training data only] → Answer (may be stale/hallucinated)

RAG:
  Question → [Vector search: top-K similar documents] → [LLM + documents] → Grounded Answer
```

---

## Current State: NOT Implemented

The Evidence Agent in this system (`GroqEvidenceAgent` / `MockEvidenceAgent`) **does not use RAG**.

**In LLM mode**: The Groq model answers from its training data (knowledge cutoff: early 2024). Clinical guidelines change regularly — the evidence cited may be outdated.

**In mock mode**: Returns hardcoded references to CDC, IDSA, and ASH guidelines.

This is a **known and acknowledged limitation**. The schema, agent role, and infrastructure are ready — the vector database integration is the missing piece.

---

## What a RAG Implementation Would Look Like

### Step 1: Document Collection (Offline)
```python
# Load clinical guidelines
documents = [
    {"source": "AHA 2024 Heart Failure Guidelines", "text": "..."},
    {"source": "CDC Diabetes Management", "text": "..."},
    # ... thousands of guideline chunks
]
```

### Step 2: Embedding + Indexing (Offline)
```python
import chromadb
from sentence_transformers import SentenceTransformer

model = SentenceTransformer("all-MiniLM-L6-v2")
client = chromadb.Client()
collection = client.create_collection("clinical_guidelines")

embeddings = model.encode([doc["text"] for doc in documents])
collection.add(
    embeddings=embeddings,
    documents=[doc["text"] for doc in documents],
    metadatas=[{"source": doc["source"]} for doc in documents],
)
```

### Step 3: Evidence Agent Retrieval (Online, per-request)
```python
class GroqEvidenceAgentWithRAG(LLMAgent):
    async def execute(self, task, context=None):
        # 1. Create search query from case description
        query = task["description"]
        
        # 2. Get relevant documents
        results = collection.query(
            query_texts=[query],
            n_results=5
        )
        
        # 3. Inject documents into context
        retrieved_docs = "\n\n".join(results["documents"][0])
        enhanced_prompt = f"""
        RETRIEVED CLINICAL GUIDELINES:
        {retrieved_docs}
        
        Case Description:
        {task["description"]}
        
        Based ONLY on the retrieved guidelines above, provide evidence analysis.
        """
        
        # 4. Call LLM with grounded context
        return await generate_json(self.get_system_prompt(), enhanced_prompt)
```

---

## Recommended Technology Stack for RAG

| Component | Technology | Why |
|-----------|-----------|-----|
| Vector Database | ChromaDB | Easy setup, Python native, no server needed |
| Embedding Model | `all-MiniLM-L6-v2` (HuggingFace) | Free, fast, good quality |
| Clinical Sources | ClinicalBERT embeddings | Trained on medical literature |
| Document Loader | LangChain DocumentLoaders | PDF, HTML, DOCX parsers |
| Alternative VectorDB | Pinecone / Weaviate | Production-grade, managed |

---

## Impact of Implementing RAG

| Metric | Without RAG | With RAG |
|--------|------------|---------|
| Evidence accuracy | Depends on training data | Grounded in real documents |
| Hallucination risk | High for specific citations | Low (documents provided) |
| Guideline currency | Training cutoff (2024) | As current as the indexed corpus |
| Latency | +0ms | +100-500ms for vector search |
| Privacy | Patient query sent to Groq | Still sent to Groq (or use local LLM) |

---

## Current Agent Accuracy Note

The current Evidence Agent (`GroqEvidenceAgent`) in LLM mode will cite guidelines like:
- "AHA 2023 Heart Failure Guidelines — recommendation: LVEF < 40% warrants ACE inhibitor therapy"

This may be accurate, but the source, year, and specific recommendation cannot be independently verified without RAG. For a clinical system, **unverifiable citations are a patient safety risk**.

This is why the Evidence Agent is clearly labeled in the medical safety preamble: the output is AI-generated and requires clinical verification before acting on it.
