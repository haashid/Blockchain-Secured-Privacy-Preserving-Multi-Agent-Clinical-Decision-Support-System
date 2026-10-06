"""Task and run management service."""

import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.models.models import Task, Run, AgentExecution, AgentOutput


async def create_task(db: AsyncSession, **kwargs) -> Task:
    task = Task(id=uuid.uuid4(), **kwargs)
    db.add(task)
    await db.flush()
    return task


async def get_task(db: AsyncSession, task_id: uuid.UUID) -> Task | None:
    result = await db.execute(select(Task).where(Task.id == task_id))
    return result.scalar_one_or_none()


async def list_tasks(db: AsyncSession, limit: int = 50, offset: int = 0) -> list[Task]:
    result = await db.execute(
        select(Task).order_by(Task.created_at.desc()).limit(limit).offset(offset)
    )
    return list(result.scalars().all())


async def create_run(db: AsyncSession, task_id: uuid.UUID, mode: str = "blockchain") -> Run:
    run = Run(id=uuid.uuid4(), task_id=task_id, mode=mode)
    db.add(run)
    await db.flush()
    return run


async def get_run(db: AsyncSession, run_id: uuid.UUID) -> Run | None:
    result = await db.execute(select(Run).where(Run.id == run_id))
    return result.scalar_one_or_none()


async def list_runs_for_task(db: AsyncSession, task_id: uuid.UUID) -> list[Run]:
    result = await db.execute(
        select(Run).where(Run.task_id == task_id).order_by(Run.created_at.desc())
    )
    return list(result.scalars().all())


async def update_run(db: AsyncSession, run_id: uuid.UUID, **kwargs) -> Run | None:
    run = await get_run(db, run_id)
    if not run:
        return None
    for k, v in kwargs.items():
        if hasattr(run, k):
            setattr(run, k, v)
    await db.flush()
    return run


async def create_agent_execution(
    db: AsyncSession, run_id: uuid.UUID, agent_id: str, sequence_order: int = 0
) -> AgentExecution:
    exec = AgentExecution(id=uuid.uuid4(), run_id=run_id, agent_id=agent_id, sequence_order=sequence_order)
    db.add(exec)
    await db.flush()
    return exec


async def get_agent_executions(db: AsyncSession, run_id: uuid.UUID) -> list[AgentExecution]:
    result = await db.execute(
        select(AgentExecution).where(AgentExecution.run_id == run_id)
        .order_by(AgentExecution.sequence_order)
    )
    return list(result.scalars().all())
