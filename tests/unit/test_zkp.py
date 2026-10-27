import asyncio
import os
import uuid
import pytest
from unittest.mock import AsyncMock, patch

from backend.privacy.zkp.service import ZKPService
from backend.privacy.zkp.client import ZKPClient, ZKPClientError
from backend.privacy.zkp.nonce import generate_nonce, consume_nonce
from backend.privacy.zkp.verifier import ZKPVerifier

# Module-level cache for external ZKP service reachability
_ZKP_AVAILABLE: bool | None = None


async def check_zkp_service() -> bool:
    """Probe whether the external BBS+ ZKP service container is responsive."""
    global _ZKP_AVAILABLE
    if _ZKP_AVAILABLE is not None:
        return _ZKP_AVAILABLE
    import httpx
    try:
        await asyncio.wait_for(ZKPClient.get_public_key(), timeout=1.0)
        _ZKP_AVAILABLE = True
    except (httpx.HTTPError, ZKPClientError, asyncio.TimeoutError, Exception):
        _ZKP_AVAILABLE = False
    return _ZKP_AVAILABLE


# ─────────────────────────────────────────────────────────────────────────────
# 1. OFFLINE UNIT TESTS (Mocked external interface, runs anywhere without Docker)
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_zkp_nonce_lifecycle():
    """Verify nonce generation, single consumption, and replay attack prevention."""
    policy_id = "test_policy"
    agent_did = "did:test:123"
    request_id = "req_123"

    nonce = generate_nonce(policy_id, agent_did, request_id, 300)
    assert nonce is not None

    # Successful consumption
    res = consume_nonce(nonce, policy_id, agent_did, request_id)
    assert res is True

    # Replay protection: second attempt with same nonce must be rejected
    res_replay = consume_nonce(nonce, policy_id, agent_did, request_id)
    assert res_replay is False


@pytest.mark.asyncio
async def test_zkp_claim_mapping_offline():
    """Verify policy claim to index canonical mapping and mandatory expiration."""
    # Indices: role=3, capabilities=4, expiration=6
    indices = ZKPService.map_policy_to_indices(["role", "capabilities"])
    assert 3 in indices
    assert 4 in indices
    assert 6 in indices  # Expiration must always be included

    # Unrecognized claims ignored, expiration still present
    indices_unknown = ZKPService.map_policy_to_indices(["nonexistent_claim"])
    assert 6 in indices_unknown


@pytest.mark.asyncio
async def test_zkp_verifier_wrong_nonce_offline():
    """Verify that verifier rejects unissued or mismatched nonce before calling client."""
    db_session = AsyncMock()
    # Never registered nonce
    is_verified, reason = await ZKPVerifier.verify_authorization_proof(
        db=db_session,
        proof="fake_proof",
        revealed_claims_dict={"role": "doctor", "expiration": "2099-01-01T00:00:00"},
        nonce="unregistered_nonce_xyz",
        policy_id="pol_1",
        agent_did="did:example:1",
        request_id="req_1",
        required_attributes=["role"],
    )
    assert is_verified is False
    assert reason == "WRONG_NONCE"


@pytest.mark.asyncio
async def test_zkp_verifier_expired_credential_offline():
    """Verify that verifier rejects expired credentials before cryptographic checks."""
    db_session = AsyncMock()
    agent_did = "did:example:expired"
    policy_id = "pol_exp"
    req_id = "req_exp"

    nonce = generate_nonce(policy_id, agent_did, req_id)
    revealed_claims = {
        "role": "clinical_reasoning",
        "expiration": "2020-01-01T00:00:00",  # Expired timestamp
    }

    is_verified, reason = await ZKPVerifier.verify_authorization_proof(
        db=db_session,
        proof="dummy_proof",
        revealed_claims_dict=revealed_claims,
        nonce=nonce,
        policy_id=policy_id,
        agent_did=agent_did,
        request_id=req_id,
        required_attributes=["role"],
    )
    assert is_verified is False
    assert reason == "EXPIRED_CREDENTIAL"


@pytest.mark.asyncio
async def test_zkp_verifier_with_mocked_client_success():
    """Verify successful verification workflow with mocked BBS+ client response."""
    db_session = AsyncMock()
    agent_did = "did:example:ok"
    policy_id = "pol_ok"
    req_id = "req_ok"

    nonce = generate_nonce(policy_id, agent_did, req_id)
    revealed_claims = {
        "role": "clinical_reasoning",
        "capabilities": "chart_review",
        "expiration": "2099-01-01T00:00:00",
    }

    with patch.object(ZKPClient, "verify_proof", new_callable=AsyncMock) as mock_verify:
        mock_verify.return_value = {"verified": True}
        is_verified, reason = await ZKPVerifier.verify_authorization_proof(
            db=db_session,
            proof="valid_bbs_proof_bytes",
            revealed_claims_dict=revealed_claims,
            nonce=nonce,
            policy_id=policy_id,
            agent_did=agent_did,
            request_id=req_id,
            required_attributes=["role", "capabilities"],
        )
        assert is_verified is True
        assert reason == "VERIFIED"
        assert mock_verify.await_count == 1


@pytest.mark.asyncio
async def test_zkp_verifier_with_mocked_client_invalid_proof():
    """Verify rejection when cryptographic proof signature is invalid."""
    db_session = AsyncMock()
    agent_did = "did:example:bad"
    policy_id = "pol_bad"
    req_id = "req_bad"

    nonce = generate_nonce(policy_id, agent_did, req_id)
    revealed_claims = {
        "role": "clinical_reasoning",
        "expiration": "2099-01-01T00:00:00",
    }

    with patch.object(ZKPClient, "verify_proof", new_callable=AsyncMock) as mock_verify:
        mock_verify.return_value = {"verified": False, "error": "INVALID_PROOF"}
        is_verified, reason = await ZKPVerifier.verify_authorization_proof(
            db=db_session,
            proof="invalid_proof_bytes",
            revealed_claims_dict=revealed_claims,
            nonce=nonce,
            policy_id=policy_id,
            agent_did=agent_did,
            request_id=req_id,
            required_attributes=["role"],
        )
        assert is_verified is False
        assert reason == "INVALID_PROOF"


@pytest.mark.asyncio
async def test_zkp_verifier_service_unavailable():
    """Verify graceful handling and audit record update when ZKP service throws client error."""
    db_session = AsyncMock()
    agent_did = "did:example:unavail"
    policy_id = "pol_unavail"
    req_id = "req_unavail"

    nonce = generate_nonce(policy_id, agent_did, req_id)
    revealed_claims = {
        "role": "clinical_reasoning",
        "expiration": "2099-01-01T00:00:00",
    }

    with patch.object(ZKPClient, "verify_proof", side_effect=ZKPClientError("Connection refused")):
        is_verified, reason = await ZKPVerifier.verify_authorization_proof(
            db=db_session,
            proof="proof_bytes",
            revealed_claims_dict=revealed_claims,
            nonce=nonce,
            policy_id=policy_id,
            agent_did=agent_did,
            request_id=req_id,
            required_attributes=["role"],
        )
        assert is_verified is False
        assert reason == "ZKP_SERVICE_UNAVAILABLE"


# ─────────────────────────────────────────────────────────────────────────────
# 2. SERVICE-DEPENDENT INTEGRATION TESTS (Require live BBS+ container at ZKP_SERVICE_URL)
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.integration
@pytest.mark.asyncio
async def test_zkp_issue_and_verify():
    """Integration test: requires running external BBS+ ZKP service container."""
    if not await check_zkp_service():
        pytest.skip("External BBS+ ZKP service container unreachable at ZKP_SERVICE_URL")

    db_session = AsyncMock()
    agent_did = "did:example:123"
    role = "clinical_reasoning"
    org = "Org1MSP"
    capabilities = ["chart_review", "differential_diagnosis"]

    # 1. Issue Credential
    cred_res = await ZKPService.issue_bbs_credential(
        agent_did=agent_did,
        role=role,
        org=org,
        capabilities=capabilities,
        expiration_days=365,
    )

    claims = cred_res["claims"]
    signature = cred_res["signature"]

    # 2. Challenge
    nonce = generate_nonce("policy_1", agent_did, "req_1")

    # 3. Create Proof (simulating the prover agent)
    indices = ZKPService.map_policy_to_indices(["role", "capabilities"])
    proof = await ZKPClient.derive_proof(signature, claims, nonce, indices)

    revealed_claims = {
        "role": claims["role"],
        "capabilities": claims["capabilities"],
        "expiration": claims["expiration"],
    }

    # 4. Verify Proof via Verifier
    is_verified, reason = await ZKPVerifier.verify_authorization_proof(
        db=db_session,
        proof=proof,
        revealed_claims_dict=revealed_claims,
        nonce=nonce,
        policy_id="policy_1",
        agent_did=agent_did,
        request_id="req_1",
        required_attributes=["role", "capabilities"],
    )

    assert is_verified is True
    assert reason == "VERIFIED"

    # 5. Wrong nonce
    nonce2 = generate_nonce("policy_1", agent_did, "req_2")
    is_verified_2, reason_2 = await ZKPVerifier.verify_authorization_proof(
        db=db_session,
        proof=proof,
        revealed_claims_dict=revealed_claims,
        nonce=nonce2,
        policy_id="policy_1",
        agent_did=agent_did,
        request_id="req_2",
        required_attributes=["role", "capabilities"],
    )
    assert is_verified_2 is False
    assert reason_2 == "INVALID_PROOF"


@pytest.mark.integration
@pytest.mark.asyncio
@pytest.mark.parametrize("scenario", range(24))
async def test_zkp_24_scenarios(scenario):
    """
    Parametrized integration test for 24 different scenarios of ZKP verification:
    Varying roles, capabilities, nonces, and expiration statuses.
    Requires running external BBS+ ZKP service container.
    """
    if not await check_zkp_service():
        pytest.skip("External BBS+ ZKP service container unreachable at ZKP_SERVICE_URL")

    db_session = AsyncMock()
    agent_did = f"did:example:scenario{scenario}"

    is_expired = (scenario % 2 == 1)
    wrong_nonce = (scenario % 3 == 1)
    wrong_attribute = (scenario % 4 == 1)

    expiration_days = -1 if is_expired else 365
    cred_res = await ZKPService.issue_bbs_credential(
        agent_did=agent_did,
        role="history",
        org="Org1MSP",
        capabilities=["chart_review", "read_history"],
        expiration_days=expiration_days,
    )

    claims = cred_res["claims"]
    signature = cred_res["signature"]

    policy_id = f"policy_{scenario}"
    req_id = f"req_{scenario}"

    nonce = generate_nonce(policy_id, agent_did, req_id)
    derive_nonce = generate_nonce(policy_id, agent_did, "wrong_req") if wrong_nonce else nonce

    indices = ZKPService.map_policy_to_indices(["role"])
    if wrong_attribute:
        proof = await ZKPClient.derive_proof(signature, claims, derive_nonce, indices)
        req_attrs = ["role", "capabilities"]
    else:
        proof = await ZKPClient.derive_proof(signature, claims, derive_nonce, indices)
        req_attrs = ["role"]

    revealed_claims = {
        "role": claims["role"],
        "expiration": claims["expiration"],
    }

    is_verified, reason = await ZKPVerifier.verify_authorization_proof(
        db=db_session,
        proof=proof,
        revealed_claims_dict=revealed_claims,
        nonce=nonce,
        policy_id=policy_id,
        agent_did=agent_did,
        request_id=req_id,
        required_attributes=req_attrs,
    )

    if is_expired:
        assert is_verified is False
        assert reason == "EXPIRED_CREDENTIAL"
    elif wrong_nonce:
        assert is_verified is False
        assert reason in ["INVALID_PROOF", "WRONG_NONCE"]
    elif wrong_attribute:
        assert is_verified is False
    else:
        assert is_verified is True
        assert reason == "VERIFIED"
