.PHONY: setup dev test build clean docker-up docker-down fabric-setup fabric-start fabric-stop

# ---- Setup ----
setup:
	python -m pip install -e "backend/[dev]"
	cd frontend && pnpm install

# ---- Development ----
dev-backend:
	cd backend && python -m uvicorn app:app --reload --host 0.0.0.0 --port 8000

dev-frontend:
	cd frontend && pnpm dev

dev: dev-backend dev-frontend

# ---- Testing ----
test:
	cd backend && python -m pytest ../tests/ -v --tb=short

test-unit:
	cd backend && python -m pytest ../tests/unit/ -v

test-integration:
	cd backend && python -m pytest ../tests/integration/ -v

test-chaincode:
	cd blockchain/chaincode && go test -v ./...

test-all: test test-chaincode

# ---- Build ----
build-frontend:
	cd frontend && pnpm build

build: build-frontend

# ---- Docker ----
docker-up:
	docker compose up -d postgres minio

docker-down:
	docker compose down

docker-up-all:
	docker compose up -d

# ---- Fabric ----
fabric-setup:
	bash blockchain/scripts/setup.sh

fabric-start:
	bash blockchain/scripts/start.sh

fabric-stop:
	bash blockchain/scripts/stop.sh

fabric-deploy:
	bash blockchain/scripts/deploy-chaincode.sh

fabric-status:
	bash blockchain/scripts/status.sh

# ---- Database ----
db-migrate:
	cd backend && alembic upgrade head

db-revision:
	cd backend && alembic revision --autogenerate -m "$(msg)"

# ---- Clean ----
clean:
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
	find . -type f -name "*.pyc" -delete 2>/dev/null || true
	rm -rf .pytest_cache .mypy_cache .ruff_cache
