"""Application configuration using Pydantic Settings."""

from functools import lru_cache
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # Application
    APP_ENV: Literal["development", "testing", "production"] = "development"
    APP_SECRET: str = "change-me-to-a-random-64-char-string"
    APP_HOST: str = "0.0.0.0"
    APP_PORT: int = 8000
    APP_DEBUG: bool = True
    APP_LOG_LEVEL: str = "INFO"

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://multichain:multichain_secret@localhost:5432/multichain_db"
    DATABASE_URL_SYNC: str = "postgresql://multichain:multichain_secret@localhost:5432/multichain_db"

    # AI Agent Configuration
    AI_MODE: Literal["mock", "llm", "groq"] = "mock"
    AI_PROVIDER: Literal["mock", "ollama", "openai", "groq"] = "mock"
    OPENAI_API_KEY: str = ""
    OPENAI_BASE_URL: str = "https://api.openai.com/v1"
    OPENAI_MODEL: str = "gpt-4o"
    OLLAMA_BASE_URL: str = "http://localhost:11434"
    OLLAMA_MODEL: str = "llama3"
    GROQ_API_KEY: str = ""
    GROQ_MODEL: str = "llama-3.3-70b-versatile"
    GROQ_FAST_MODEL: str = "llama3-8b-8192"

    # Hyperledger Fabric
    FABRIC_NETWORK: str = "development"
    FABRIC_CHANNEL: str = "ai-coordination-channel"
    FABRIC_CHAINCODE: str = "ai-coordination"
    FABRIC_MSP_ID: str = "Org1MSP"
    FABRIC_CERT_PATH: str = ""
    FABRIC_KEY_PATH: str = ""
    FABRIC_TLS_CERT_PATH: str = ""
    FABRIC_GATEWAY_ENDPOINT: str = "localhost:7051"
    FABRIC_ORG1_MSP: str = "Org1MSP"
    FABRIC_ORG2_MSP: str = "Org2MSP"

    # Object Storage
    MINIO_ENDPOINT: str = "localhost:9000"
    MINIO_ACCESS_KEY: str = "minioadmin"
    MINIO_SECRET_KEY: str = "minioadmin"
    MINIO_BUCKET: str = "agent-storage"
    MINIO_SECURE: bool = False

    # Encryption
    ENCRYPTION_KEY: str = "change-me-to-a-random-32-byte-hex-string"

    # Consensus
    CONSENSUS_THRESHOLD: float = 0.70

    # Workflow Orchestration
    MAX_CONCURRENT_AGENTS: int = 6
    AGENT_TIMEOUT_SECONDS: float = 60.0
    MAX_REASONING_ROUNDS: int = 3
    MAX_AGENT_RETRIES: int = 2

    # RAG (Retrieval-Augmented Generation)
    RAG_ENABLED: bool = True
    RAG_TOP_K: int = 8
    RAG_MIN_SCORE: float = 0.30
    RAG_RERANK_ENABLED: bool = True
    RAG_CHUNK_SIZE: int = 512
    RAG_CHUNK_OVERLAP: int = 64
    RAG_EMBEDDING_DIMENSION: int = 0  # 0 = auto-detect from embedding provider
    RAG_KNOWLEDGE_DIR: str = "knowledge/demo"

    # Tamper Simulation
    SIMULATE_TAMPERING: bool = False

    # JWT
    JWT_SECRET: str = "change-me-to-a-random-string"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRATION_MINUTES: int = 60

    # CORS
    CORS_ORIGINS: str = "http://localhost:5173,http://localhost:3000,http://localhost:5174,http://localhost:5175"

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
