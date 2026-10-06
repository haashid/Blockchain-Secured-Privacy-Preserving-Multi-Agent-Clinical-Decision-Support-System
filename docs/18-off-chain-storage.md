# 18 — Off-Chain Storage

## Why Off-Chain Storage?

Blockchains are designed for **small, structured, high-value state** — not large binary objects. Storing full AI agent outputs (potentially 5-50 KB each) directly on the Fabric ledger would:

1. **Inflate ledger size** — every peer replicates all data.
2. **Reduce throughput** — large transaction payloads slow consensus.
3. **Expose patient data** — even on a permissioned network, every org on the channel would hold the raw AI output.
4. **Increase cost** — in public blockchain contexts, large payloads cost proportionally more gas.

**Solution**: Store the encrypted data off-chain (MinIO), store only the hash on-chain (Fabric). The hash mathematically proves the content is authentic without revealing it.

---

## MinIO Architecture

**MinIO** is an open-source, S3-compatible object storage server designed for on-premises use.

```mermaid
flowchart LR
    ORCH[Orchestrator] -->|AES-encrypted bytes| MINIO[MinIO Server]
    MINIO --> BUCKET[clinical-decisions bucket]
    BUCKET --> OBJ[tasks/{task_id}/runs/{run_id}/agents/{role}/output.json.enc]
    
    VER[Verification Engine] -->|GET object| MINIO
    MINIO --> VER
    VER -->|decrypt| PLAIN[Plaintext JSON]
    VER -->|SHA-256| HASH[Computed Hash]
    HASH -->|compare| BLOCKCHAIN_HASH[Blockchain Hash]
```

---

## Object Storage Path Schema

```
{MINIO_BUCKET}/tasks/{task_id}/runs/{run_id}/agents/{role}/output.json.enc
```

**Examples**:
```
clinical-decisions/
  tasks/
    a1b2c3d4-e5f6-7890-abcd-ef1234567890/
      runs/
        f0e9d8c7-b6a5-4321-0987-654321fedcba/
          agents/
            clinical_reasoning/
              output.json.enc    ← encrypted canonical JSON
            laboratory/
              output.json.enc
            medication/
              output.json.enc
            risk/
              output.json.enc
            verifier/
              output.json.enc
            synthesizer/
              output.json.enc
```

**`.enc` extension**: Indicates the file is AES-256-GCM encrypted. The format is:
```
[12 bytes: random nonce] + [N bytes: ciphertext + GCM auth tag]
```

---

## Storage Provider Interface (`backend/storage/base.py`)

```python
from abc import ABC, abstractmethod

class StorageProvider(ABC):
    @abstractmethod
    async def put_object(self, path: str, data: bytes) -> None:
        """Store bytes at the given path."""
    
    @abstractmethod
    async def get_object(self, path: str) -> bytes:
        """Retrieve bytes from the given path."""
    
    @abstractmethod
    async def delete_object(self, path: str) -> None:
        """Delete an object."""
    
    @abstractmethod
    async def object_exists(self, path: str) -> bool:
        """Check if an object exists."""
```

This interface means MinIO can be swapped for AWS S3, GCP Cloud Storage, or Azure Blob Storage with only a new implementation class — the rest of the system is unchanged.

---

## MinIO Implementation (`backend/storage/minio.py`)

```python
import boto3  # or aioboto3 for async

class MinIOStorageProvider(StorageProvider):
    def __init__(self):
        self.client = boto3.client(
            "s3",
            endpoint_url=f"http://{settings.MINIO_ENDPOINT}",
            aws_access_key_id=settings.MINIO_ACCESS_KEY,
            aws_secret_access_key=settings.MINIO_SECRET_KEY,
        )
        self.bucket = settings.MINIO_BUCKET
        self._ensure_bucket()

    def _ensure_bucket(self):
        try:
            self.client.head_bucket(Bucket=self.bucket)
        except:
            self.client.create_bucket(Bucket=self.bucket)

    async def put_object(self, path: str, data: bytes) -> None:
        self.client.put_object(
            Bucket=self.bucket,
            Key=path,
            Body=data,
            ContentType="application/octet-stream"
        )

    async def get_object(self, path: str) -> bytes:
        response = self.client.get_object(Bucket=self.bucket, Key=path)
        return response["Body"].read()
```

---

## Security Properties

| Property | Implementation | Guarantee |
|----------|---------------|-----------|
| Confidentiality | AES-256-GCM encryption | Only parties with AES key can read |
| Integrity | GCM authentication tag | Ciphertext modification detected on decrypt |
| Authenticity | AES key controlled by backend | Only backend can write valid ciphertext |
| Availability | MinIO replication (configurable) | Data accessible to verification engine |
| Non-repudiation | SHA-256 hash on Fabric | Proves object existed with specific content |

---

## What Happens if MinIO Is Down

If MinIO is unavailable:
1. `storage.put_object()` raises an exception.
2. The orchestrator catches it: `storage.failed` anomaly added.
3. `proof["storage_reference"]` is set to `None`.
4. Verification step is skipped (no object to verify).
5. Blockchain proof is still submitted (hash was computed before storage attempt).

This means the system can still record blockchain proofs even if MinIO is temporarily unavailable — but verification will fail until storage is restored.

---

## Running MinIO

### Docker (Recommended for Dev)
```bash
docker run -d \
  --name minio \
  -p 9000:9000 \
  -p 9001:9001 \
  -e MINIO_ROOT_USER=minioadmin \
  -e MINIO_ROOT_PASSWORD=minioadmin \
  -v minio_data:/data \
  minio/minio server /data --console-address ":9001"
```

**MinIO Console**: http://localhost:9001  
**Login**: minioadmin / minioadmin

### In docker-compose.yml (Service)
```yaml
minio:
  image: minio/minio
  ports:
    - "9000:9000"
    - "9001:9001"
  environment:
    MINIO_ROOT_USER: minioadmin
    MINIO_ROOT_PASSWORD: minioadmin
  command: server /data --console-address ":9001"
  volumes:
    - minio_data:/data
  healthcheck:
    test: ["CMD", "curl", "-f", "http://localhost:9000/minio/health/live"]
    interval: 30s
    timeout: 10s
    retries: 5
```
