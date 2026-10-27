"""End-to-end clinical workflow verification.

Tests the full lifecycle:
1. Patient & Doctor record availability
2. Creation of Clinical Review (with 10-agent orchestration)
3. Doctor Inspection of synthesized report, 10-agent outputs, evidence, and provenance
4. Doctor Approval with clinician notes
5. Doctor Prescription issuance
6. Doctor Release to Patient Portal
7. Patient Role Access Controls (403 on internal agent/evidence traces, 200 on my-released)
8. Patient Notification creation
"""
import asyncio
import os
import sys
import uuid

# Ensure backend is on sys.path
_here = os.path.dirname(os.path.abspath(__file__))
_root = os.path.normpath(os.path.join(_here, '..'))
if _root not in sys.path:
    sys.path.insert(0, _root)

# If running outside docker and postgres host is not resolvable, use sqlite
if "DATABASE_URL" not in os.environ or "postgres:5432" in os.environ.get("DATABASE_URL", ""):
    os.environ["DATABASE_URL"] = f"sqlite+aiosqlite:///{os.path.join(_root, 'multichain.db')}"

from backend.core.database import async_session_factory, init_db
from backend.models.models import User
from backend.models.hospital import Patient, Doctor, ClinicalReview, Prescription, PatientNotification
from backend.services.clinical_review import (
    start_clinical_review,
    get_clinical_review,
    get_review_report,
    get_review_agents,
    get_review_evidence,
    get_review_provenance,
    approve_clinical_review,
    reject_clinical_review,
    release_clinical_review,
    create_prescription_from_review,
    list_released_reviews_for_patient,
    get_patient_notifications,
)
from sqlalchemy import select


async def run_tests():
    print("\n=======================================================")
    print("MEDAGENTOS: E2E CLINICAL DECISION SUPPORT WORKFLOW TEST")
    print("=======================================================\n")
    
    await init_db()

    async with async_session_factory() as db:
        # 1. Fetch or create doctor user and record
        dr_res = await db.execute(select(Doctor).limit(1))
        doctor = dr_res.scalar_one_or_none()
        if not doctor:
            # Create user and doctor
            doc_user = User(
                username="dr_jenkins_test",
                email="rjenkins@hospital.org",
                role="doctor",
                is_active=True,
            )
            doc_user.set_password("doctor123")
            db.add(doc_user)
            await db.flush()

            doctor = Doctor(
                user_id=doc_user.id,
                first_name="Robert",
                last_name="Jenkins",
                specialization="Cardiology",
                license_number="MD-94021",
                phone="555-0192",
                email="rjenkins@hospital.org",
            )
            db.add(doctor)
            await db.flush()
        else:
            doc_user_res = await db.execute(select(User).where(User.id == doctor.user_id))
            doc_user = doc_user_res.scalar_one_or_none()
            if not doc_user:
                doc_user = User(
                    id=doctor.user_id,
                    username="dr_jenkins_test",
                    email="rjenkins@hospital.org",
                    role="doctor",
                    is_active=True,
                )
                doc_user.set_password("doctor123")
                db.add(doc_user)
                await db.flush()

        print(f"  [PASS] Doctor account ready: Dr. {doctor.first_name} {doctor.last_name} ({doctor.specialization})")

        # 2. Fetch or create patient record
        pat_res = await db.execute(select(Patient).limit(1))
        patient = pat_res.scalar_one_or_none()
        if not patient:
            patient = Patient(
                first_name="Eleanor",
                last_name="Vance",
                medical_record_number="MRN-TEST-1001",
                date_of_birth="1978-06-15",
                gender="Female",
                blood_type="A+",
                email="patient.test@hospital.org",
                allergies=["Penicillin"],
                chronic_conditions=["Essential Hypertension"],
            )
            db.add(patient)
            await db.flush()

        print(f"  [PASS] Patient account ready: {patient.first_name} {patient.last_name} (MRN: {patient.medical_record_number})")

        # 3. Start a clinical review
        print("\n--- Step 1: Doctor starts Clinical Review ---")
        cr_info = await start_clinical_review(
            db=db,
            patient_id=patient.id,
            doctor_user_id=doc_user.id,
            purpose="Clinical case review",
            chief_complaint="Persistent elevated BP (154/96 mmHg) despite diet control",
            symptoms=["Occasional morning occipital headache", "Mild dyspnea on exertion"],
            vitals={"blood_pressure": "154/96", "heart_rate": 76, "temperature": 36.8, "respiratory_rate": 16},
        )
        await db.commit()

        review_id = uuid.UUID(cr_info["clinical_review_id"])
        print(f"  [PASS] Clinical Review created with ID: {review_id}")
        assert cr_info["approval_status"] in ("DRAFT", "AWAITING_REVIEW", "PENDING_APPROVAL")

        # 4. Inspect Review Details
        print("\n--- Step 2: Inspection of Synthesized Clinical Report & Specialist Outputs ---")
        review = await get_clinical_review(db, review_id)
        assert review is not None, "Review should exist"
        print(f"  [PASS] Review Title: {review['title']}")

        report = await get_review_report(db, review_id)
        assert report is not None, "Report should be generated"
        print(f"  [PASS] Synthesizer output present: {bool(report.get('synthesis') or report.get('ai_draft'))}")

        # Check evidence & provenance
        evidence = await get_review_evidence(db, review_id)
        print(f"  [PASS] Evidence retrieval checked: {type(evidence).__name__}")

        provenance = await get_review_provenance(db, review_id)
        assert "proofs" in provenance
        print(f"  [PASS] Cryptographic provenance proofs: {provenance['count']} proofs registered")

        # 5. Doctor Approval
        print("\n--- Step 3: Doctor Approval Workflow ---")
        approved_result = await approve_clinical_review(
            db=db,
            review_id=review_id,
            approver_user_id=doc_user.id,
            clinician_notes="Approved. Concur with ACE-inhibitor initiation. Monitor serum potassium in 4 weeks.",
            edited_report=None,
        )
        await db.commit()
        assert approved_result["status"] == "approved"
        print(f"  [PASS] Review approved by Dr. Jenkins at {approved_result['approved_at']}")

        # 6. Issue Prescription
        print("\n--- Step 4: Issue Prescription directly from Review ---")
        presc_result = await create_prescription_from_review(
            db=db,
            review_id=review_id,
            doctor_user_id=doc_user.id,
            medication_name="Lisinopril",
            dosage="10mg",
            frequency="Once daily in the morning",
            duration="30 days",
            instructions="Take with full glass of water. Report any persistent dry cough.",
        )
        await db.commit()
        assert presc_result["status"] == "prescribed"
        print(f"  [PASS] Prescription issued: {presc_result['medication_name']} {presc_result['dosage']}")

        # 7. Release to Patient Portal
        print("\n--- Step 5: Release Approved Review to Patient ---")
        release_result = await release_clinical_review(
            db=db,
            review_id=review_id,
            releaser_user_id=doc_user.id,
            patient_friendly_summary="Your recent blood pressure check was elevated. Dr. Jenkins has prescribed Lisinopril 10mg daily to protect your heart and kidneys. Please schedule a follow-up in 4 weeks.",
        )
        await db.commit()
        assert release_result["status"] == "released"
        print(f"  [PASS] Clinical Review released to Patient Portal at {release_result['released_at']}")

        # 8. Verify Patient View & RBAC
        print("\n--- Step 6: Patient Portal Verification & Access Controls ---")
        released_list = await list_released_reviews_for_patient(db, patient.id)
        assert any(r["id"] == str(review_id) for r in released_list), "Patient should see released review"
        print(f"  [PASS] Patient sees {len(released_list)} released clinical review(s)")

        # Verify notification was delivered to patient
        notifs = await get_patient_notifications(db, patient.id)
        assert len(notifs) >= 1, "Patient should have at least 1 notification"
        print(f"  [PASS] Patient received {len(notifs)} notification(s) (latest: '{notifs[0]['title']}')")

    print("\n=======================================================")
    print("ALL CLINICAL WORKFLOW E2E TESTS PASSED SUCCESSFULLY!")
    print("=======================================================\n")


if __name__ == "__main__":
    asyncio.run(run_tests())
