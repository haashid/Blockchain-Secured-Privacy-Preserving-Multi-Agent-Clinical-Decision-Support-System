# 31 — Troubleshooting Guide

## Common Issues and Solutions

---

## Backend Issues

### 🔴 `ModuleNotFoundError: No module named 'backend'`

**Cause**: Python cannot find the `backend` package.

**Fix**: Run from the project root, not from inside `backend/`:
```bash
# ✅ Correct:
cd "final project"
python -m uvicorn backend.app:app --reload --port 8000

# Or install in dev mode:
pip install -e .
```

---

### 🔴 `sqlalchemy.exc.OperationalError: no such table`

**Cause**: Database tables not created.

**Fix**: Tables are created automatically on startup via `init_db()`. If this fails, check:
```bash
# Check if the .db file exists:
ls multichain.db

# If missing — start the server and it should create tables:
python -m uvicorn app:app --reload

# If still failing, check console for import errors
```

---

### 🔴 `ConnectionError: Failed to connect to Fabric gateway`

**Cause**: Hyperledger Fabric network is not running.

**Fix**: This is expected in development. Set `coordination_mode: "centralized"` in task requests, or the system auto-falls back. To run Fabric:
```bash
cd blockchain/scripts
./start-network.sh
```

---

### 🔴 `groq.APIRateLimitError` or `groq.AuthenticationError`

**Cause**: Invalid or missing Groq API key, or key has no credits.

**Fix**: Set AI_MODE to mock in `.env`:
```bash
AI_MODE=mock
```
Alternatively create your key at `https://console.groq.com` and set:
```bash
GROQ_API_KEY=your_actual_key
AI_MODE=groq
```

---

### 🔴 `pydantic.ValidationError: ... field required`

**Cause**: Agent output missing required fields. Usually happens when LLM doesn't follow the schema.

**Fix**: 
1. Use `AI_MODE=mock` — mock agents always produce valid output.
2. If using LLM mode, the agent's system prompt may need refinement for this case type.
3. Check logs for which field is missing.

---

### 🔴 `bcrypt error: Invalid salt` or `ValueError: ... hashed_password`

**Cause**: Type mismatch — password comparison between `str` and `bytes`.

**Fix**: Already fixed in `services/auth.py`. Ensure:
```python
# Must be str → str comparison:
if not bcrypt.verify(str(password), str(user.hashed_password)):
```

---

### 🔴 `cryptography.exceptions.InvalidTag`

**Cause**: AES-GCM decryption failed — ciphertext was modified (tampered), key changed, or data corrupted.

**Fix**:
1. Check if `ENCRYPTION_KEY` in `.env` changed since data was stored — if the key changed, old data cannot be decrypted.
2. If testing tamper detection — this is expected. The verification engine catches it.
3. Verify the MinIO blob was not corrupted.

---

### 🔴 `MinIO connection refused` / `boto3.exceptions.NoCredentialsError`

**Cause**: MinIO is not running or credentials are wrong.

**Fix**:
```bash
# Start MinIO with Docker:
docker run -p 9000:9000 -p 9001:9001 \
  -e MINIO_ROOT_USER=minioadmin \
  -e MINIO_ROOT_PASSWORD=minioadmin \
  minio/minio server /data --console-address ":9001"
```

Or update `.env`:
```bash
MINIO_ENDPOINT=localhost:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
```

---

## Frontend Issues

### 🔴 Blank page / Component doesn't render

**Cause**: JavaScript error during rendering.

**Fix**:
1. Open browser DevTools → Console. 
2. Look for `TypeError` or `Cannot read property of undefined`.
3. Common cause: API returned `undefined` but component expects an array → add optional chaining: `data?.patients ?? []`.

---

### 🔴 `401 Unauthorized` on all API calls

**Cause**: JWT token expired or not set.

**Fix**: 
1. Open DevTools → Application → LocalStorage.
2. Check if `token` key exists.
3. If expired (default 60 min) → logout and login again.
4. Validate token at `https://jwt.io` — paste token and inspect expiry.

---

### 🔴 `403 Forbidden` on protected routes

**Cause**: User's role doesn't have permission for this endpoint.

**Fix**: Check `user_role` in localStorage matches expected role. The RBAC Permission Matrix is in `docs/08-authentication-authorization.md`.

---

### 🔴 Login works but redirected to wrong portal

**Cause**: `user_role` in localStorage doesn't match backend role.

**Fix**: 
1. Open DevTools → Application → LocalStorage.
2. Verify `user_role = "doctor"` (not `"Doctor"` — case sensitive).
3. Logout and login again — `LoginPage.tsx` now stores the role from the API response.

---

### 🔴 `CORS error` on API calls

**Cause**: Backend CORS configuration doesn't include the frontend origin.

**Fix**: Update `backend/app.py` or `backend/core/config.py`:
```python
CORS_ORIGINS=http://localhost:5173
```

Or for dev — temporarily allow all:
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # DEV ONLY
    allow_methods=["*"],
    allow_headers=["*"],
)
```

---

### 🔴 `npm run dev` fails with `ENOENT`

**Cause**: Node modules not installed.

**Fix**:
```bash
cd frontend
npm install
npm run dev
```

---

## Database Issues

### 🔴 `UNIQUE constraint failed: users.username`

**Cause**: Trying to create a user that already exists (happens if `seed_default_data` runs twice).

**Fix**: This is handled gracefully — `seed_default_data` uses `first()` to check before creating. If you see this error, it's from a raw `INSERT` elsewhere. Check for duplicate registration calls.

---

### 🔴 `sqlalchemy.exc.IntegrityError: FOREIGN KEY constraint failed`

**Cause**: Trying to insert a record with a foreign key that doesn't exist.

**Fix**: Ensure parent records exist before creating children. Example: a `Doctor` requires a valid `user_id` in the `users` table.

---

## Blockchain Issues

### 🔴 `ERRO 001 Failed to connect to orderer`

**Cause**: Fabric orderer not running.

**Fix**: Start Fabric network:
```bash
cd blockchain/scripts
docker-compose -f ../docker-compose-fabric.yml up -d
```

---

### 🔴 `Error: could not find chaincode with name 'clinical-decision-cc'`

**Cause**: Chaincode not deployed/committed.

**Fix**:
```bash
cd blockchain/scripts
./deploy-chaincode.sh clinical-decision-cc ../chaincode 1 1
```

---

### 🔴 `ERRO: MSP doesn't match with peer's MSP`

**Cause**: Certificate from wrong organization.

**Fix**: Verify `FABRIC_CERT_PATH` and `FABRIC_MSP_ID` in `.env` match the certificate's organization.

---

## Getting Help

### View Logs
```bash
# Backend structured logs:
cat backend/backend.log

# Real-time:
tail -f backend/backend.log

# Docker services:
docker-compose logs -f fabric-peer
```

### Test Connectivity
```bash
# Backend health:
curl http://localhost:8000/health

# API docs:
# http://localhost:8000/docs

# MinIO console:
# http://localhost:9001
```

### Run Tests
```bash
cd final\ project
python -m pytest tests/verify_fixes.py -v
```

### Full Database Reset (Nuclear Option)
```bash
# Delete SQLite database:
rm backend/multichain.db

# Restart backend — creates fresh database with seed data
```
