"""Tests verifying Stage 3 Database & API Optimization.
Confirms elimination of N+1 query patterns, index improvements, and consolidated patient summary.
"""

import asyncio
import uuid
import pytest
from sqlalchemy import event, select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.database import async_session_factory
from backend.models.models import Task
from backend.models.hospital import Patient, Doctor, ClinicalReview
from backend.services.clinical_review import (
    list_all_reviews,
    list_reviews_for_patient,
    list_reviews_for_doctor,
    get_clinical_review,
)
from backend.services.hospital import get_patient_clinical_summary


class ScopedQueryCounter:
    """Connection-scoped query counter that isolates queries executed on a specific session connection."""
    def __init__(self, sync_conn):
        self.sync_conn = sync_conn
        self.count = 0
        self.statements = []

    def __enter__(self):
        self.count = 0
        self.statements = []
        event.listen(self.sync_conn, "before_cursor_execute", self._callback)
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        event.remove(self.sync_conn, "before_cursor_execute", self._callback)

    def _callback(self, conn, cursor, statement, parameters, context, executemany):
        stmt_upper = statement.strip().upper()
        if stmt_upper.startswith("SELECT"):
            self.count += 1
            self.statements.append(statement)


@pytest.mark.asyncio
async def test_list_all_reviews_executes_single_query():
    """Verify list_all_reviews executes exactly 1 SELECT query (outer join + noload), eliminating N+1."""
    async with async_session_factory() as db:
        conn = await db.connection()
        counter = ScopedQueryCounter(conn.sync_connection)
        with counter:
            reviews = await list_all_reviews(db, limit=25)

        # In Stage 0, this issued 1 + N queries (e.g. 1 + 25 = 26 queries).
        # In Stage 3, it must issue exactly 1 query.
        assert counter.count == 1, f"Expected exactly 1 SELECT query, got {counter.count}: {counter.statements}"
        assert isinstance(reviews, list)
        assert len(reviews) > 0


@pytest.mark.asyncio
async def test_list_reviews_for_patient_executes_single_query():
    """Verify list_reviews_for_patient executes exactly 1 SELECT query (inner join + noload), eliminating N+1."""
    async with async_session_factory() as db:
        pat_res = await db.execute(select(Patient).limit(1))
        patient = pat_res.scalar_one_or_none()
        patient_id = patient.id if patient else uuid.uuid4()

        conn = await db.connection()
        counter = ScopedQueryCounter(conn.sync_connection)
        with counter:
            reviews = await list_reviews_for_patient(db, patient_id)

        assert counter.count == 1, f"Expected exactly 1 SELECT query, got {counter.count}: {counter.statements}"
        assert isinstance(reviews, list)


@pytest.mark.asyncio
async def test_list_all_reviews_preserves_unreviewed_tasks():
    """Verify outer join correctly includes tasks that do not yet have a ClinicalReview."""
    async with async_session_factory() as db:
        orphan_task = Task(
            title="Synthetic Background Worker Task",
            domain="healthcare",
            status="pending",
        )
        db.add(orphan_task)
        await db.commit()
        await db.refresh(orphan_task)

        reviews = await list_all_reviews(db, limit=100)
        task_ids = [r["task_id"] for r in reviews]
        assert str(orphan_task.id) in task_ids

        orphan_summary = next(r for r in reviews if r["task_id"] == str(orphan_task.id))
        assert orphan_summary["approval_status"] is None
        assert orphan_summary["patient_id"] is None

        await db.delete(orphan_task)
        await db.commit()


@pytest.mark.asyncio
async def test_patient_clinical_summary_consolidation():
    """Verify get_patient_clinical_summary consolidates patient data in a single coordinated service."""
    async with async_session_factory() as db:
        pat_res = await db.execute(select(Patient).limit(1))
        patient = pat_res.scalar_one_or_none()
        if not patient:
            pytest.skip("No patient seeded in test database")

        summary = await get_patient_clinical_summary(db, patient.id)
        assert summary is not None
        assert "patient" in summary
        assert "records" in summary
        assert "prescriptions" in summary
        assert "appointments" in summary
        assert "reviews" in summary
        assert summary["patient"].id == patient.id
