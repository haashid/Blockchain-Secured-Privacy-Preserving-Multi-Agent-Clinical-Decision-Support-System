"""Database connection and session management."""

from collections.abc import AsyncGenerator

from sqlalchemy import text
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase

from backend.core.config import get_settings

settings = get_settings()

import os

_db_url = settings.DATABASE_URL
if "postgres:5432" in _db_url and not os.path.exists("/.dockerenv") and not os.environ.get("RUNNING_IN_DOCKER"):
    _root = os.path.normpath(os.path.join(os.path.dirname(__file__), "..", ".."))
    _sqlite_path = os.path.join(_root, "multichain.db").replace("\\", "/")
    _db_url = f"sqlite+aiosqlite:///{_sqlite_path}"

_engine_kwargs = {
    "echo": False,
    "pool_pre_ping": True,
}
# SQLite specific optimization
if _db_url.startswith("sqlite"):
    _engine_kwargs["connect_args"] = {
        "check_same_thread": False,
        "timeout": 30.0,
    }
else:
    _engine_kwargs["pool_size"] = 10
    _engine_kwargs["max_overflow"] = 20

engine = create_async_engine(_db_url, **_engine_kwargs)

if _db_url.startswith("sqlite"):
    from sqlalchemy import event

    @event.listens_for(engine.sync_engine, "connect")
    def _set_sqlite_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute("PRAGMA synchronous=NORMAL")
        cursor.execute("PRAGMA busy_timeout=30000")
        cursor.close()

async_session_factory = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    pass


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with async_session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


# ─── Enum definitions: model values → DB enum values ────────────────
# Keep this in sync with the Enum columns in models.py / hospital.py.
# Each entry is (enum_type_name, set_of_valid_values).
_ENUM_DEFINITIONS = {
    "user_role": {"admin", "operator", "auditor", "viewer", "doctor", "patient"},
    "agent_role": {
        "supervisor", "planner", "router", "clinical_reasoning",
        "history", "laboratory", "medication", "risk", "evidence",
        "critic", "verifier", "synthesizer",
    },
    "agent_status": {"active", "inactive", "suspended", "error"},
    "task_priority": {"low", "medium", "high", "critical"},
    "task_status": {"pending", "running", "completed", "failed", "cancelled"},
    "coordination_mode": {"centralized", "blockchain"},
    "run_mode": {"centralized", "blockchain"},
    "run_status": {"pending", "running", "completed", "failed", "timeout"},
    "exec_status": {"pending", "running", "completed", "failed", "timeout"},
    "proof_status": {"submitted", "verified", "invalid", "flagged"},
    "risk_level": {"trusted", "normal", "warning", "suspicious", "critical"},
    "bench_mode": {"centralized", "blockchain"},
    "appointment_status": {"scheduled", "in_progress", "completed", "cancelled"},
    "appointment_priority": {"routine", "urgent", "emergency"},
    "record_type": {"consultation", "lab_result", "prescription", "imaging", "discharge_summary"},
}


async def _sync_enums(conn) -> None:
    """Add any missing values to existing PostgreSQL ENUM types.

    PostgreSQL does not support DROP VALUE or ALTER VALUE on enums,
    but it does support ADD VALUE.  For enums that don't exist yet,
    ``create_all()`` will create them with the full value set.
    """
    for enum_name, required_values in _ENUM_DEFINITIONS.items():
        # Check if the enum type already exists
        result = await conn.execute(
            text(
                "SELECT e.enumlabel FROM pg_enum e "
                "JOIN pg_type t ON e.enumtypid = t.oid "
                "WHERE t.typname = :name"
            ),
            {"name": enum_name},
        )
        existing = {row[0] for row in result}
        missing = required_values - existing
        if missing:
            for val in sorted(missing):
                await conn.execute(text(f"ALTER TYPE {enum_name} ADD VALUE IF NOT EXISTS '{val}'"))


async def init_db() -> None:
    """Create all tables and sync enum types (for development)."""
    import backend.models.models
    import backend.models.hospital

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    try:
        async with engine.begin() as conn:
            await _sync_enums(conn)
    except Exception:
        pass
