"""Audit event service."""

import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.models.models import AuditEvent


async def create_audit_event(
    db: AsyncSession,
    event_type: str,
    agent_id: str | None = None,
    organization: str | None = None,
    task_id: uuid.UUID | None = None,
    run_id: uuid.UUID | None = None,
    proof_id: str | None = None,
    transaction_id: str | None = None,
    status: str | None = None,
    details: dict[str, Any] | None = None,
) -> AuditEvent:
    event = AuditEvent(
        id=uuid.uuid4(),
        event_type=event_type,
        agent_id=agent_id,
        organization=organization,
        task_id=task_id,
        run_id=run_id,
        proof_id=proof_id,
        transaction_id=transaction_id,
        status=status,
        details=details,
    )
    db.add(event)
    await db.flush()
    return event


async def list_audit_events(
    db: AsyncSession,
    agent_id: str | None = None,
    organization: str | None = None,
    event_type: str | None = None,
    task_id: uuid.UUID | None = None,
    status: str | None = None,
    limit: int = 100,
    offset: int = 0,
) -> list[AuditEvent]:
    query = select(AuditEvent)
    if agent_id:
        query = query.where(AuditEvent.agent_id == agent_id)
    if organization:
        query = query.where(AuditEvent.organization == organization)
    if event_type:
        query = query.where(AuditEvent.event_type == event_type)
    if task_id:
        query = query.where(AuditEvent.task_id == task_id)
    if status:
        query = query.where(AuditEvent.status == status)
    query = query.order_by(AuditEvent.timestamp.desc()).limit(limit).offset(offset)
    result = await db.execute(query)
    return list(result.scalars().all())


async def get_audit_events_by_task(db: AsyncSession, task_id: uuid.UUID) -> list[AuditEvent]:
    result = await db.execute(
        select(AuditEvent).where(AuditEvent.task_id == task_id).order_by(AuditEvent.timestamp)
    )
    return list(result.scalars().all())


async def get_audit_events_by_agent(db: AsyncSession, agent_id: str) -> list[AuditEvent]:
    result = await db.execute(
        select(AuditEvent).where(AuditEvent.agent_id == agent_id)
        .order_by(AuditEvent.timestamp.desc()).limit(100)
    )
    return list(result.scalars().all())
