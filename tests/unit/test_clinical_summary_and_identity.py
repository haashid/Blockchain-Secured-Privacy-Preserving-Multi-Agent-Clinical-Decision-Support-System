"""Tests for Task 1 (Clinical-Summary Serialization) and Task 2 (Patient Identity Resolution).

Verifies:
1. Clinical-summary endpoint returns valid non-recursive Pydantic DTO (PatientClinicalSummaryResponse).
2. Handles normal responses and empty related collections without RecursionError.
3. Doctor/Admin authorization vs patient own-record access vs unauthorized access (403).
4. Patient identity resolution:
   - Primary user_id link resolution.
   - Duplicate unlinked candidates raise HTTP 409 Conflict (avoids arbitrary selection).
   - Missing patient record raises HTTP 404 or returns empty collection where appropriate.
   - Cross-patient IDOR protection (403 Forbidden).
"""

import uuid
import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy import select
from fastapi import HTTPException

from backend.app import app
from backend.core.database import async_session_factory
from backend.core.deps import get_current_user
from backend.models.models import User
from backend.models.hospital import Patient, Doctor, MedicalRecord, Prescription, Appointment
from backend.services.hospital import resolve_patient_for_user, get_patient_clinical_summary
from backend.schemas.hospital import PatientClinicalSummaryResponse


@pytest.fixture
def mock_doctor_user():
    return User(
        id=uuid.uuid4(),
        username="test_dr",
        email="test_dr@hospital.org",
        role="doctor",
        is_active=True,
    )


@pytest.fixture
def mock_patient_user():
    return User(
        id=uuid.uuid4(),
        username="test_patient",
        email="test_patient@example.com",
        role="patient",
        is_active=True,
    )


@pytest.fixture
def mock_other_patient_user():
    return User(
        id=uuid.uuid4(),
        username="other_patient",
        email="other_patient@example.com",
        role="patient",
        is_active=True,
    )


@pytest.mark.asyncio
async def test_clinical_summary_serialization_shape():
    """Verify get_patient_clinical_summary returns non-recursive data conforming to PatientClinicalSummaryResponse."""
    async with async_session_factory() as db:
        pat_res = await db.execute(select(Patient).limit(1))
        patient = pat_res.scalar_one_or_none()
        if not patient:
            pytest.skip("No patient seeded in test database")

        summary = await get_patient_clinical_summary(db, patient.id)
        assert summary is not None

        # Verify it validates into the explicit Pydantic DTO
        dto = PatientClinicalSummaryResponse.model_validate(summary)
        assert dto.patient.id == patient.id
        assert isinstance(dto.records, list)
        assert isinstance(dto.prescriptions, list)
        assert isinstance(dto.appointments, list)
        assert isinstance(dto.reviews, list)

        # Confirm JSON serialization succeeds without RecursionError
        dumped = dto.model_dump(mode="json")
        assert "patient" in dumped
        assert dumped["patient"]["id"] == str(patient.id)


@pytest.mark.asyncio
async def test_clinical_summary_empty_collections():
    """Verify get_patient_clinical_summary handles a patient with zero records, scripts, appts, and reviews."""
    async with async_session_factory() as db:
        empty_patient = Patient(
            first_name="Isolated",
            last_name="Subject",
            medical_record_number=f"MRN-EMPTY-{uuid.uuid4().hex[:6]}",
            date_of_birth="1990-01-01",
            gender="Female",
            email=f"empty_{uuid.uuid4().hex[:6]}@example.com",
        )
        db.add(empty_patient)
        await db.commit()
        await db.refresh(empty_patient)

        try:
            summary = await get_patient_clinical_summary(db, empty_patient.id)
            assert summary is not None
            dto = PatientClinicalSummaryResponse.model_validate(summary)
            assert dto.patient.id == empty_patient.id
            assert dto.records == []
            assert dto.prescriptions == []
            assert dto.appointments == []
            assert dto.reviews == []

            dumped = dto.model_dump(mode="json")
            assert dumped["records"] == []
            assert dumped["prescriptions"] == []
        finally:
            await db.delete(empty_patient)
            await db.commit()


@pytest.mark.asyncio
async def test_identity_resolution_authoritative_user_id():
    """Verify resolution via authoritative Patient.user_id takes precedence."""
    user_id = uuid.uuid4()
    test_user = User(
        id=user_id,
        username="auth_user",
        email="auth_user@hospital.org",
        role="patient",
    )

    async with async_session_factory() as db:
        linked_patient = Patient(
            first_name="Authoritative",
            last_name="Patient",
            medical_record_number=f"MRN-AUTH-{uuid.uuid4().hex[:6]}",
            date_of_birth="1985-05-15",
            gender="Male",
            email="different_email@example.com",
            user_id=user_id,
        )
        db.add(linked_patient)
        await db.commit()
        await db.refresh(linked_patient)

        try:
            resolved = await resolve_patient_for_user(db, test_user)
            assert resolved is not None
            assert resolved.id == linked_patient.id
            assert resolved.user_id == user_id
        finally:
            await db.delete(linked_patient)
            await db.commit()


@pytest.mark.asyncio
async def test_identity_resolution_duplicate_candidates_raises_409():
    """Verify ambiguous duplicate candidates without user_id fail safely with HTTP 409 Conflict.
    
    Rule 5: Do not replace ambiguous database identity lookups with arbitrary first-record selection.
    """
    shared_email = f"shared_{uuid.uuid4().hex[:6]}@example.com"
    ambiguous_user = User(
        id=uuid.uuid4(),
        username="ambiguous_user",
        email=shared_email,
        role="patient",
    )

    async with async_session_factory() as db:
        p1 = Patient(
            first_name="Duplicate",
            last_name="One",
            medical_record_number=f"MRN-DUP1-{uuid.uuid4().hex[:6]}",
            date_of_birth="1980-01-01",
            gender="Male",
            email=shared_email,
            user_id=None,
        )
        p2 = Patient(
            first_name="Duplicate",
            last_name="Two",
            medical_record_number=f"MRN-DUP2-{uuid.uuid4().hex[:6]}",
            date_of_birth="1982-02-02",
            gender="Female",
            email=shared_email,
            user_id=None,
        )
        db.add_all([p1, p2])
        await db.commit()
        await db.refresh(p1)
        await db.refresh(p2)

        try:
            with pytest.raises(HTTPException) as exc_info:
                await resolve_patient_for_user(db, ambiguous_user)
            assert exc_info.value.status_code == 409
            assert "Ambiguous patient identity" in exc_info.value.detail
        finally:
            await db.delete(p1)
            await db.delete(p2)
            await db.commit()


@pytest.mark.asyncio
async def test_identity_resolution_missing_patient():
    """Verify missing patient raises 404 when raise_on_not_found=True, or returns None when False."""
    missing_user = User(
        id=uuid.uuid4(),
        username="nonexistent_user",
        email="nonexistent@example.com",
        role="patient",
    )

    async with async_session_factory() as db:
        with pytest.raises(HTTPException) as exc_info:
            await resolve_patient_for_user(db, missing_user, raise_on_not_found=True)
        assert exc_info.value.status_code == 404

        res = await resolve_patient_for_user(db, missing_user, raise_on_not_found=False)
        assert res is None


@pytest.mark.asyncio
async def test_clinical_summary_endpoint_authorization(mock_doctor_user, mock_patient_user, mock_other_patient_user):
    """Verify endpoint authorization:
    - Doctor: 200 OK
    - Patient accessing own record: 200 OK
    - Patient accessing another patient: 403 Forbidden
    - Unauthorized role (e.g. researcher): 403 Forbidden
    """
    async with async_session_factory() as db:
        # Create two patients, one linked to mock_patient_user, one to mock_other_patient_user
        p1 = Patient(
            first_name="PatientOne",
            last_name="Test",
            medical_record_number=f"MRN-P1-{uuid.uuid4().hex[:6]}",
            email=mock_patient_user.email,
            user_id=mock_patient_user.id,
        )
        p2 = Patient(
            first_name="PatientTwo",
            last_name="Test",
            medical_record_number=f"MRN-P2-{uuid.uuid4().hex[:6]}",
            email=mock_other_patient_user.email,
            user_id=mock_other_patient_user.id,
        )
        db.add_all([p1, p2])
        await db.commit()
        await db.refresh(p1)
        await db.refresh(p2)

        try:
            transport = ASGITransport(app=app)
            # 1. Doctor access to p1 -> 200
            app.dependency_overrides[get_current_user] = lambda: mock_doctor_user
            async with AsyncClient(transport=transport, base_url="http://test") as ac:
                res = await ac.get(f"/api/hospital/patients/{p1.id}/clinical-summary")
                assert res.status_code == 200
                data = res.json()
                assert data["patient"]["id"] == str(p1.id)

            # 2. Patient access to OWN record p1 -> 200
            app.dependency_overrides[get_current_user] = lambda: mock_patient_user
            async with AsyncClient(transport=transport, base_url="http://test") as ac:
                res = await ac.get(f"/api/hospital/patients/{p1.id}/clinical-summary")
                assert res.status_code == 200
                data = res.json()
                assert data["patient"]["id"] == str(p1.id)

            # 3. Patient access to OTHER patient p2 -> 403
            async with AsyncClient(transport=transport, base_url="http://test") as ac:
                res = await ac.get(f"/api/hospital/patients/{p2.id}/clinical-summary")
                err_msg = res.json().get("detail") or res.json().get("error", {}).get("message", "")
                assert "Access denied" in err_msg

            # 4. Cross-patient prescriptions access -> 403
            async with AsyncClient(transport=transport, base_url="http://test") as ac:
                res = await ac.get(f"/api/hospital/patients/{p2.id}/prescriptions")
                assert res.status_code == 403

            # 5. Cross-patient records access -> 403
            async with AsyncClient(transport=transport, base_url="http://test") as ac:
                res = await ac.get(f"/api/hospital/patients/{p2.id}/records")
                assert res.status_code == 403

            # 6. Unauthorized role -> 403
            unauthorized_user = User(
                id=uuid.uuid4(),
                username="researcher",
                email="researcher@hospital.org",
                role="researcher",
                is_active=True,
            )
            app.dependency_overrides[get_current_user] = lambda: unauthorized_user
            async with AsyncClient(transport=transport, base_url="http://test") as ac:
                res = await ac.get(f"/api/hospital/patients/{p1.id}/clinical-summary")
                assert res.status_code == 403
        finally:
            app.dependency_overrides.clear()
            await db.delete(p1)
            await db.delete(p2)
            await db.commit()


@pytest.mark.asyncio
async def test_appointments_and_records_endpoints():
    """Verify GET/PATCH /api/hospital/appointments and GET /api/hospital/records."""
    from backend.services.hospital import create_appointment, create_medical_record
    from backend.schemas.hospital import AppointmentCreate, MedicalRecordCreate

    transport = ASGITransport(app=app)
    async with async_session_factory() as db:
        # Fetch or check patient and doctor
        pat_res = await db.execute(select(Patient).limit(1))
        patient = pat_res.scalar_one_or_none()
        doc_res = await db.execute(select(Doctor).limit(1))
        doctor = doc_res.scalar_one_or_none()

        if not patient or not doctor:
            pytest.skip("Patient or Doctor not found in test db")

        # Create test appointment
        from datetime import datetime, timezone
        now = datetime.now(timezone.utc)
        appt = await create_appointment(
            db,
            AppointmentCreate(
                patient_id=patient.id,
                doctor_id=doctor.id,
                scheduled_at=now,
                duration_minutes=30,
                chief_complaint="Unit test consultation",
                priority="routine",
            )
        )
        # Create test medical record
        rec = await create_medical_record(
            db,
            MedicalRecordCreate(
                patient_id=patient.id,
                doctor_id=doctor.id,
                record_type="consultation",
                title="Unit test clinical note",
                content={"summary": "Unit test note"},
                notes="Patient is doing well",
            )
        )
        await db.commit()

        doctor_user = User(
            id=doctor.user_id,
            username="doc_tester",
            email="doc_tester@hospital.org",
            role="doctor",
            is_active=True,
        )
        app.dependency_overrides[get_current_user] = lambda: doctor_user

        try:
            async with AsyncClient(transport=transport, base_url="http://test") as ac:
                # 1. GET /api/hospital/appointments
                res = await ac.get("/api/hospital/appointments")
                assert res.status_code == 200
                appts = res.json()
                assert isinstance(appts, list)
                assert len(appts) >= 1
                found_appt = next((a for a in appts if a["id"] == str(appt.id)), None)
                assert found_appt is not None
                assert found_appt["patient_name"] != ""
                assert found_appt["doctor_name"] != ""

                # 2. PATCH /api/hospital/appointments/{id}
                patch_res = await ac.patch(
                    f"/api/hospital/appointments/{appt.id}",
                    json={"status": "in_progress", "notes": "Consultation started"}
                )
                assert patch_res.status_code == 200
                assert patch_res.json()["appointment_status"] == "in_progress"

                # 3. GET /api/hospital/records
                rec_res = await ac.get("/api/hospital/records")
                assert rec_res.status_code == 200
                records = rec_res.json()
                assert isinstance(records, list)
                assert len(records) >= 1
                found_rec = next((r for r in records if r["id"] == str(rec.id)), None)
                assert found_rec is not None
                assert found_rec["title"] == "Unit test clinical note"

                # 4. GET /api/hospital/me/doctor
                doc_me_res = await ac.get("/api/hospital/me/doctor")
                assert doc_me_res.status_code == 200
                assert doc_me_res.json()["id"] == str(doctor.id)
        finally:
            app.dependency_overrides.clear()
            await db.delete(appt)
            await db.delete(rec)
            await db.commit()

