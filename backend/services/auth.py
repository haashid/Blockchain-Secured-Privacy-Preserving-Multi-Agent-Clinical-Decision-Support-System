"""Authentication service with comprehensive demo seed data."""

import uuid
from datetime import datetime, timezone, timedelta

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.security import create_access_token, hash_password, verify_password
from backend.models.models import User


async def authenticate_user(db: AsyncSession, username: str, password: str) -> dict | None:
    """Authenticate a user and return JWT token."""
    result = await db.execute(select(User).where(User.username == username))
    user = result.scalar_one_or_none()
    if not user or not verify_password(password, str(user.hashed_password)):
        return None
    if not user.is_active:
        return None

    token = create_access_token({"sub": str(user.id), "role": user.role, "username": user.username})
    return {
        "access_token": token,
        "token_type": "bearer",
        "role": user.role,
    }


async def create_user(
    db: AsyncSession, username: str, email: str, password: str, role: str = "viewer"
) -> User:
    """Create a new user."""
    user = User(
        id=uuid.uuid4(),
        username=username,
        email=email,
        hashed_password=hash_password(password),
        role=role,
    )
    db.add(user)
    await db.flush()
    return user


async def get_or_create_default_admin(db: AsyncSession) -> User:
    """Ensure default admin, doctor, and patient users exist with full demo data.

    Idempotent and resilient to partial initialization:
    - Uses a fast-path check when all expected demo records are already present.
    - If partial records exist (e.g. user created without linked doctor/patient row),
      repairs and completes the missing entities without duplicating records.
    """
    from backend.models.hospital import (
        Doctor, Patient, Appointment, MedicalRecord, Prescription, ClinicalReview, PatientNotification
    )
    from backend.models.models import ConsentRecord

    demo_usernames = ["admin", "doctor", "doctor1", "patient", "patient1"]

    # ── Fast-path check: all demo users and profiles already complete ──
    user_stmt = select(User).where(User.username.in_(demo_usernames))
    existing_users = {u.username: u for u in (await db.execute(user_stmt)).scalars().all()}

    if len(existing_users) == len(demo_usernames):
        doc_count = (await db.execute(select(func.count(Doctor.id)))).scalar() or 0
        pat_count = (await db.execute(select(func.count(Patient.id)))).scalar() or 0
        med_count = (await db.execute(select(func.count(MedicalRecord.id)))).scalar() or 0
        if doc_count >= 2 and pat_count >= 2 and med_count >= 2:
            return existing_users["admin"]

    # ── Admin ──────────────────────────────────────────────────────────
    admin = existing_users.get("admin")
    if not admin:
        admin = await create_user(db, "admin", "admin@medagent.hospital", "admin123", "admin")
        existing_users["admin"] = admin

    # ── Doctors: Robert Jenkins, Sarah Chen ───────────────────────────
    doctor_specs = [
        ("doctor", "Robert", "Jenkins", "Internal Medicine", "Internal Medicine", "MD-2024-001"),
        ("doctor1", "Sarah", "Chen", "Cardiology", "Cardiology", "MD-2024-002"),
    ]
    doctor_rec = None
    for doc_name, first, last, spec, dept, lic in doctor_specs:
        du = existing_users.get(doc_name)
        if not du:
            du = await create_user(db, doc_name, f"{doc_name}@medagent.hospital", f"{doc_name}123", "doctor")
            existing_users[doc_name] = du

        # Verify or repair linked Doctor hospital profile
        d_stmt = select(Doctor).where(Doctor.user_id == du.id)
        d_obj = (await db.execute(d_stmt)).scalar_one_or_none()
        if not d_obj:
            d_obj = Doctor(
                id=uuid.uuid4(),
                user_id=du.id,
                first_name=first,
                last_name=last,
                specialization=spec,
                license_number=lic,
                department=dept,
                years_of_experience=12,
                qualifications=["MD", "FACP"],
            )
            db.add(d_obj)
            await db.flush()

        if doc_name == "doctor":
            doctor_rec = d_obj

    # ── Patients: John Smith, Emily Carter ────────────────────────────
    patient_specs = [
        (
            "patient", "John", "Smith", "1975-03-15", "Male", "O+",
            "MRN-2024-0001",
            ["Penicillin", "Sulfonamides"],
            ["Hypertension", "Type 2 Diabetes Mellitus", "Hyperlipidemia"],
        ),
        (
            "patient1", "Emily", "Carter", "1988-07-22", "Female", "A-",
            "MRN-2024-0002",
            ["Aspirin"],
            ["Asthma", "Seasonal Allergies"],
        ),
    ]

    primary_patient = None
    for pat_name, first, last, dob, gender, blood, mrn, allergies, conditions in patient_specs:
        pu = existing_users.get(pat_name)
        if not pu:
            pu = await create_user(db, pat_name, f"{pat_name}@email.com", f"{pat_name}123", "patient")
            existing_users[pat_name] = pu

        # Verify or repair linked Patient hospital profile
        p_stmt = select(Patient).where(Patient.medical_record_number == mrn)
        p_obj = (await db.execute(p_stmt)).scalar_one_or_none()
        if not p_obj:
            p_obj = Patient(
                id=uuid.uuid4(),
                first_name=first,
                last_name=last,
                date_of_birth=dob,
                gender=gender,
                blood_type=blood,
                phone="+1-555-0100",
                email=f"{pat_name}@email.com",
                emergency_contact="Jane Smith: +1-555-0199",
                medical_record_number=mrn,
                insurance_id=f"INS-{mrn}",
                allergies=allergies,
                chronic_conditions=conditions,
            )
            db.add(p_obj)
            await db.flush()

        if pat_name == "patient":
            primary_patient = p_obj

    # Seed rich demo data for primary patient if missing
    if primary_patient and doctor_rec:
        await _seed_patient_demo_data(db, primary_patient, doctor_rec)

    return admin


async def _seed_patient_demo_data(db, patient, doctor):
    """Seed comprehensive demo data for the primary patient."""
    from backend.models.hospital import Appointment, MedicalRecord, Prescription
    from backend.models.models import ConsentRecord

    now = datetime.now(timezone.utc)

    # ── Consent Record ──────────────────────────────────────────────
    from sqlalchemy import select
    result = await db.execute(
        __import__("sqlalchemy", fromlist=["select"]).select(ConsentRecord).where(
            ConsentRecord.patient_id == patient.id
        )
    )
    if not result.scalar_one_or_none():
        consent = ConsentRecord(
            patient_id=patient.id,
            allowed_roles=["supervisor", "clinical_reasoning", "history", "laboratory",
                           "medication", "risk", "evidence", "critic", "verifier", "synthesizer"],
            allowed_organizations=["Org1MSP", "Org2MSP"],
            emergency_breakglass=True,
            notes="Patient consents to AI-assisted clinical decision support for all care team members.",
        )
        db.add(consent)

    # ── Appointments ──────────────────────────────────────────────
    from backend.models.hospital import Appointment
    result = await db.execute(
        __import__("sqlalchemy", fromlist=["select"]).select(Appointment).where(
            Appointment.patient_id == patient.id
        )
    )
    existing_appts = result.scalars().all()
    if not existing_appts:
        # Past appointment
        past_appt = Appointment(
            id=uuid.uuid4(),
            patient_id=patient.id,
            doctor_id=doctor.id,
            scheduled_at=now - timedelta(days=45),
            duration_minutes=30,
            status="completed",
            chief_complaint="Routine diabetes and hypertension follow-up",
            notes="HbA1c reviewed. Blood pressure slightly elevated. Medication adjusted.",
            priority="routine",
        )
        db.add(past_appt)
        # Upcoming appointment
        upcoming_appt = Appointment(
            id=uuid.uuid4(),
            patient_id=patient.id,
            doctor_id=doctor.id,
            scheduled_at=now + timedelta(days=7),
            duration_minutes=30,
            status="scheduled",
            chief_complaint="Chest discomfort and fatigue — new onset",
            notes="Patient reporting exertional chest pain and shortness of breath.",
            priority="urgent",
        )
        db.add(upcoming_appt)
        await db.flush()

    # ── Medical Records ──────────────────────────────────────────────
    from backend.models.hospital import MedicalRecord
    result = await db.execute(
        __import__("sqlalchemy", fromlist=["select"]).select(MedicalRecord).where(
            MedicalRecord.patient_id == patient.id
        )
    )
    existing_records = result.scalars().all()
    if not existing_records:
        # Lab result record
        lab_record = MedicalRecord(
            id=uuid.uuid4(),
            patient_id=patient.id,
            doctor_id=doctor.id,
            record_type="lab_result",
            title="Comprehensive Metabolic Panel + Lipid Profile",
            content={
                "ordered_by": f"Dr. {doctor.first_name} {doctor.last_name}",
                "collection_date": (now - timedelta(days=10)).isoformat(),
                "lab": "Hospital Reference Laboratory",
            },
            vitals={
                "blood_pressure": "148/92",
                "heart_rate": 88,
                "temperature": 37.1,
                "spo2": 97,
                "weight_kg": 87.5,
                "height_cm": 178,
            },
            lab_results={
                "glucose_fasting": {"value": 142, "unit": "mg/dL", "reference": "70-99", "flag": "HIGH"},
                "hba1c": {"value": 8.1, "unit": "%", "reference": "<7.0", "flag": "HIGH"},
                "creatinine": {"value": 1.3, "unit": "mg/dL", "reference": "0.7-1.2", "flag": "HIGH"},
                "egfr": {"value": 62, "unit": "mL/min/1.73m²", "reference": ">60", "flag": "BORDERLINE"},
                "sodium": {"value": 138, "unit": "mEq/L", "reference": "135-145", "flag": None},
                "potassium": {"value": 3.8, "unit": "mEq/L", "reference": "3.5-5.0", "flag": None},
                "total_cholesterol": {"value": 218, "unit": "mg/dL", "reference": "<200", "flag": "HIGH"},
                "ldl": {"value": 142, "unit": "mg/dL", "reference": "<100", "flag": "HIGH"},
                "hdl": {"value": 38, "unit": "mg/dL", "reference": ">40", "flag": "LOW"},
                "triglycerides": {"value": 195, "unit": "mg/dL", "reference": "<150", "flag": "HIGH"},
                "alt": {"value": 48, "unit": "U/L", "reference": "7-56", "flag": None},
                "ast": {"value": 42, "unit": "U/L", "reference": "10-40", "flag": "HIGH"},
                "hemoglobin": {"value": 13.2, "unit": "g/dL", "reference": "13.5-17.5", "flag": "LOW"},
                "wbc": {"value": 8.1, "unit": "10³/µL", "reference": "4.5-11.0", "flag": None},
                "platelets": {"value": 245, "unit": "10³/µL", "reference": "150-400", "flag": None},
            },
            diagnosis_codes=["E11.65", "I10", "E78.5"],
            notes=(
                "Patient presents with poorly controlled diabetes (HbA1c 8.1%) and elevated blood pressure. "
                "Lipid panel shows combined dyslipidemia. Borderline eGFR warrants monitoring. "
                "Slight anemia noted — may warrant further workup."
            ),
        )
        db.add(lab_record)

        # Consultation record
        consult_record = MedicalRecord(
            id=uuid.uuid4(),
            patient_id=patient.id,
            doctor_id=doctor.id,
            record_type="consultation",
            title="Internal Medicine Consultation — Chest Discomfort Assessment",
            content={
                "presenting_complaint": "Exertional chest tightness and shortness of breath for 2 weeks",
                "history_present_illness": (
                    "Patient reports new-onset chest tightness on exertion for ~2 weeks. "
                    "Associated dyspnea on moderate activity. Denies syncope. "
                    "No documented prior cardiac history. Known hypertensive and diabetic."
                ),
                "review_of_systems": {
                    "cardiovascular": "Chest tightness, dyspnea on exertion",
                    "respiratory": "Mild SOB with activity",
                    "endocrine": "Polyuria, polydipsia (worsening)",
                    "musculoskeletal": "No joint pains",
                    "neurological": "No headache or dizziness",
                },
                "physical_examination": {
                    "general": "Alert, mildly obese, no acute distress",
                    "cardiovascular": "Regular rate and rhythm, no murmurs",
                    "respiratory": "Clear to auscultation bilaterally",
                    "abdomen": "Soft, non-tender",
                },
            },
            vitals={
                "blood_pressure": "152/94",
                "heart_rate": 92,
                "temperature": 37.0,
                "spo2": 96,
                "weight_kg": 87.5,
                "height_cm": 178,
            },
            diagnosis_codes=["R07.9", "R06.09", "E11.65", "I10"],
            notes=(
                "Differential includes unstable angina / NSTEMI, stable angina, hypertensive urgency. "
                "ECG, troponin, and stress test ordered. Cardiology consult recommended."
            ),
        )
        db.add(consult_record)
        await db.flush()

        # ── Prescriptions ────────────────────────────────────────────
        from backend.models.hospital import Prescription
        meds = [
            ("Metformin", "1000 mg", "Twice daily with meals", "Ongoing", "Monitor renal function q3mo."),
            ("Lisinopril", "10 mg", "Once daily in the morning", "Ongoing", "Hold if eGFR drops below 30."),
            ("Atorvastatin", "40 mg", "Once daily at bedtime", "Ongoing", "Monitor LFTs at 3 months."),
            ("Amlodipine", "5 mg", "Once daily", "Ongoing", "Titrate to BP target <130/80."),
        ]
        for med_name, dose, freq, dur, inst in meds:
            p = Prescription(
                id=uuid.uuid4(),
                medical_record_id=lab_record.id,
                patient_id=patient.id,
                doctor_id=doctor.id,
                medication_name=med_name,
                dosage=dose,
                frequency=freq,
                duration=dur,
                instructions=inst,
                is_active=True,
            )
            db.add(p)

        await db.flush()

    await db.flush()
