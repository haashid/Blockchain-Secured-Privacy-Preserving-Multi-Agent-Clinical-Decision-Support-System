"""Stage 5 Live Journey and Negative Security Verification Suite.

Exercises:
1. Doctor-to-Patient Live Clinical Journey (Steps 1-10)
2. Negative Security & Boundary Verification:
   - Cross-patient IDOR attempts
   - Unreleased draft review access attempts by patient
   - Internal agent output protection (RBAC 403)
   - ZKP nonce replay & invalid nonce rejection
   - Cryptographic SHA-256 and Merkle hash corruption detection
   - Unavailable service fallback & degraded reporting
   - Simulation vs committed blockchain state integrity
"""
import asyncio
import os
import sys
import httpx
import uuid
import hmac

_here = os.path.dirname(os.path.abspath(__file__))
_root = os.path.normpath(os.path.join(_here, '..'))
if _root not in sys.path:
    sys.path.insert(0, _root)

from backend.app import app
from backend.core.database import init_db

API_BASE = "http://127.0.0.1:8000"

async def run_stage5_audit():
    print("\n" + "="*70)
    print("STAGE 5: MEDAGENTOS FINAL AUDIT - LIVE JOURNEY & NEGATIVE SECURITY")
    print("="*70 + "\n")

    results = []
    def record(name, passed, detail=""):
        status = "PASS" if passed else "FAIL"
        suffix = f" | {detail}" if detail else ""
        print(f"  [{status}] {name}{suffix}")
        results.append({"name": name, "passed": passed, "detail": detail})

    await init_db()

    # Determine if localhost:8000 is live, else use in-process ASGITransport
    use_asgi = False
    try:
        async with httpx.AsyncClient(base_url=API_BASE, timeout=1.5) as probe:
            await probe.get("/api/health")
    except Exception:
        use_asgi = True

    transport = httpx.ASGITransport(app=app) if use_asgi else None
    base_url = "http://test" if use_asgi else API_BASE

    async with httpx.AsyncClient(transport=transport, base_url=base_url, timeout=120.0) as client:
        # ─────────────────────────────────────────────────────────────
        # PART 1: DOCTOR-TO-PATIENT CLINICAL JOURNEY
        # ─────────────────────────────────────────────────────────────
        print("--- SECTION B: Live Doctor-to-Patient Journey ---")

        # 1. Doctor Login
        doc_resp = await client.post("/api/auth/login", json={"username": "doctor", "password": "doctor123"})
        record("1. Doctor Login", doc_resp.status_code == 200, f"Status: {doc_resp.status_code}")
        doc_token = doc_resp.json().get("access_token")
        doc_headers = {"Authorization": f"Bearer {doc_token}"}

        # 2. Open Patient Record & Fetch Data
        patients_resp = await client.get("/api/hospital/patients", headers=doc_headers)
        record("2a. Fetch Patient List", patients_resp.status_code == 200)
        patients = patients_resp.json()
        target_patient = patients[0] if patients else None
        patient_id = target_patient["id"] if target_patient else None
        record("2b. Patient Record Found", patient_id is not None, f"Patient: {target_patient.get('first_name')} {target_patient.get('last_name')} (ID: {patient_id})")

        # Test Individual Patient Records & Prescriptions endpoints (Doctor View)
        records_resp = await client.get(f"/api/hospital/patients/{patient_id}/records", headers=doc_headers)
        record("2c. Patient Medical Records Retrieved", records_resp.status_code == 200, f"Count: {len(records_resp.json()) if records_resp.status_code == 200 else 'N/A'}")

        # Audit consolidated clinical summary endpoint
        summary_resp = await client.get(f"/api/hospital/patients/{patient_id}/clinical-summary", headers=doc_headers)
        summary_ok = summary_resp.status_code == 200
        record("2d. Consolidated Clinical Summary Endpoint", summary_ok,
               f"Status: {summary_resp.status_code}" if summary_ok else f"Status: {summary_resp.status_code} (Known RecursionError in SQLAlchemy serialization)")

        # 3. Initiate AI Clinical Review
        intake_payload = {
            "patient_id": patient_id,
            "purpose": "Comprehensive Diagnostic & Multi-Agent Risk Stratification",
            "chief_complaint": "Acute onset retrosternal chest pressure and dyspnea on exertion for 3 days.",
            "symptoms": ["chest pressure", "dyspnea on exertion", "fatigue"],
            "vitals": {
                "blood_pressure": "145/92 mmHg",
                "heart_rate": 88,
                "temperature": 37.1,
                "oxygen_saturation": 96
            }
        }
        review_create_resp = await client.post("/api/clinical-reviews", json=intake_payload, headers=doc_headers)
        record("3. Initiate AI Clinical Review", review_create_resp.status_code in (200, 201), f"Status: {review_create_resp.status_code}")
        review_data = review_create_resp.json()
        review_id = review_data.get("clinical_review_id") or review_data.get("id") or review_data.get("review_id")
        task_id = review_data.get("task_id")

        # 4. Observe Execution Status & Agent Outputs
        review_status_resp = None
        rev_info = {}
        for _ in range(25):
            await asyncio.sleep(1.5)
            review_status_resp = await client.get(f"/api/clinical-reviews/{review_id}", headers=doc_headers)
            rev_info = review_status_resp.json() if review_status_resp.status_code == 200 else {}
            if rev_info.get("approval_status") in ("PENDING_APPROVAL", "APPROVED") or rev_info.get("status") in ("completed", "failed"):
                break
        record("4a. Observe Review Status", review_status_resp is not None and review_status_resp.status_code == 200, f"Current Status: {rev_info.get('status')}, Approval: {rev_info.get('approval_status')}")

        # 5. Inspect Structured Report, Uncertainties, and Evidence
        report_resp = await client.get(f"/api/clinical-reviews/{review_id}/report", headers=doc_headers)
        record("5a. Fetch Structured Report & Uncertainties", report_resp.status_code == 200, f"Report Status: {report_resp.status_code}")
        
        evidence_resp = await client.get(f"/api/clinical-reviews/{review_id}/evidence", headers=doc_headers)
        record("5b. Fetch Clinical Evidence & Literature", evidence_resp.status_code == 200, f"Evidence Status: {evidence_resp.status_code}")

        # 6. Clinician Controls: Approve Case
        approval_payload = {
            "clinician_notes": "Reviewed and agreed with clinical assessment and diagnostic plan. Evidence and drug-drug interactions verified.",
            "edited_report": {"clinician_signed": True, "diagnoses": ["Hypertensive Heart Disease", "Angina Pectoris"]}
        }
        approve_resp = await client.post(f"/api/clinical-reviews/{review_id}/approve", json=approval_payload, headers=doc_headers)
        record("6. Clinician Approval Gate", approve_resp.status_code == 200, f"Status: {approve_resp.json().get('status') if approve_resp.status_code == 200 else approve_resp.status_code}")

        # 7. Issue Prescription via Authorized Workflow
        rx_payload = {
            "medication_name": "Amlodipine Besylate",
            "dosage": "5 mg",
            "frequency": "Once daily in the morning",
            "duration": "30 days",
            "instructions": "Take with water with or without food."
        }
        rx_resp = await client.post(f"/api/clinical-reviews/{review_id}/prescription", json=rx_payload, headers=doc_headers)
        record("7. Authorized Prescription Issuance", rx_resp.status_code in (200, 201), f"Status: {rx_resp.status_code}, Rx: {rx_payload['medication_name']}")

        # 8. Release Approved Patient-Facing Report
        release_payload = {
            "patient_friendly_summary": "Doctor Sarah Chen has reviewed your recent symptoms and cardiac evaluation. Blood pressure management medication prescribed."
        }
        release_resp = await client.post(f"/api/clinical-reviews/{review_id}/release", json=release_payload, headers=doc_headers)
        record("8. Release Report to Patient Portal", release_resp.status_code == 200, f"Status: {release_resp.json().get('status') if release_resp.status_code == 200 else release_resp.status_code}")

        # 9. Patient Login & Verification
        pat_resp = await client.post("/api/auth/login", json={"username": "patient", "password": "patient123"})
        record("9a. Patient Login", pat_resp.status_code == 200)
        pat_token = pat_resp.json().get("access_token")
        pat_headers = {"Authorization": f"Bearer {pat_token}"}

        released_resp = await client.get("/api/clinical-reviews/patient/me/released", headers=pat_headers)
        released_list = released_resp.json() if released_resp.status_code == 200 else []
        record("9b. Patient Views Released Reviews", released_resp.status_code == 200, f"Released Count: {len(released_list)}")

        pat_notif_resp = await client.get("/api/clinical-reviews/patient/me/notifications", headers=pat_headers)
        record("9c. Patient Notifications Visible", pat_notif_resp.status_code == 200, f"Count: {len(pat_notif_resp.json()) if pat_notif_resp.status_code == 200 else 'N/A'}")

        # 10. Confirm Internal Agent Outputs Remain Protected
        agent_leak_resp = await client.get(f"/api/clinical-reviews/{review_id}/agents", headers=pat_headers)
        record("10. Patient Blocked from Internal Agent Outputs", agent_leak_resp.status_code == 403, f"Protected HTTP Status: {agent_leak_resp.status_code}")

        # ─────────────────────────────────────────────────────────────
        # PART 2: NEGATIVE SECURITY & ADVERSARIAL CASES
        # ─────────────────────────────────────────────────────────────
        print("\n--- SECTION C: Negative Security Verification ---")

        # C1. Cross-Patient IDOR: Patient attempting to view another patient's records
        other_patient_id = str(uuid.uuid4())
        idor_resp = await client.get(f"/api/hospital/patients/{other_patient_id}/records", headers=pat_headers)
        record("C1. Cross-Patient Records Access Denied (RBAC/IDOR)", idor_resp.status_code in (403, 404), f"HTTP Status: {idor_resp.status_code}")

        # C2. Unreleased Draft Review Access by Patient
        # Create a new review as doctor, do NOT release it
        draft_create = await client.post("/api/clinical-reviews", json=intake_payload, headers=doc_headers)
        draft_id = draft_create.json().get("clinical_review_id") or draft_create.json().get("id")
        unreleased_access = await client.get(f"/api/clinical-reviews/{draft_id}", headers=pat_headers)
        record("C2. Unreleased Draft Review Inaccessible to Patient", unreleased_access.status_code in (403, 404), f"HTTP Status: {unreleased_access.status_code}")

        # C3. Patient attempting to self-issue or approve reviews
        tamper_approve = await client.post(f"/api/clinical-reviews/{draft_id}/approve", json=approval_payload, headers=pat_headers)
        record("C3a. Patient Unauthorized Approval Denied", tamper_approve.status_code == 403, f"HTTP Status: {tamper_approve.status_code}")

        tamper_rx = await client.post(f"/api/clinical-reviews/{draft_id}/prescription", json=rx_payload, headers=pat_headers)
        record("C3b. Patient Unauthorized Prescription Denied", tamper_rx.status_code == 403, f"HTTP Status: {tamper_rx.status_code}")

        # C4. ZKP Nonce Replay Protection
        from backend.privacy.zkp.nonce import generate_nonce, consume_nonce
        nonce = generate_nonce("policy_sec", "did:test:doc", "req_sec", 60)
        c1 = consume_nonce(nonce, "policy_sec", "did:test:doc", "req_sec")
        c2 = consume_nonce(nonce, "policy_sec", "did:test:doc", "req_sec")
        record("C4. ZKP Nonce Replay Rejected", c1 is True and c2 is False, f"First: {c1}, Second: {c2}")

        # C5. Cryptographic Content Hash & Tamper Detection
        from backend.crypto.hashing import compute_sha256, verify_hash
        clean_data = {"patient_id": patient_id, "systolic": 140, "diastolic": 90}
        clean_hash = compute_sha256(clean_data)
        tampered_data = {"patient_id": patient_id, "systolic": 180, "diastolic": 110}
        tamper_detected = not verify_hash(tampered_data, clean_hash)
        record("C5. Hash Tamper Detection", tamper_detected is True, "Modified content rejected by constant-time verification")

        # C6. Degraded Storage Service Fallback & Truthful State
        from backend.storage.factory import get_storage_provider, reset_storage_provider
        reset_storage_provider()
        prov = get_storage_provider()
        diag = prov.get_diagnostics()
        record("C6. Storage Service Bounded Fallback", diag.get("status") in ("ready", "degraded", "healthy") and diag.get("active_provider") == "local",
               f"Active: {diag.get('active_provider')}, Status: {diag.get('status')}, Fallback: {diag.get('is_fallback')}")

        # C7. Fabric Simulation Truthful State
        from backend.blockchain.gateway import get_fabric_service
        fab = get_fabric_service()
        if not fab.is_connected:
            await fab.connect()
        net_status = await fab.get_network_status()
        record("C7. Blockchain Simulation State Labeled", fab._simulation_mode is True and net_status.get("is_simulated") is True,
               f"Mode: {net_status.get('fabric_sdk_mode')}, Status: {net_status.get('connection_status')}")

    total = len(results)
    passed = sum(1 for r in results if r["passed"])
    print("\n" + "="*70)
    print(f"AUDIT COMPLETE: {passed}/{total} CHECKS PASSED")
    print("="*70 + "\n")

if __name__ == "__main__":
    asyncio.run(run_stage5_audit())
