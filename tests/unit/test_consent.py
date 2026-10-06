import pytest
from backend.identity.consent import evaluate_consent, ConsentError, ConsentPolicy

def test_consent_policy_evaluation():
    policy = ConsentPolicy(
        patient_id="p1",
        allowed_roles=["clinical_reasoning", "supervisor"],
        allowed_organizations=["Org1MSP"]
    )
    
    # 1. Allowed role and org
    assert evaluate_consent(policy, "clinical_reasoning", "Org1MSP", "medium") is True
    
    # 2. Denied role
    with pytest.raises(ConsentError, match="not authorized by patient consent"):
        evaluate_consent(policy, "laboratory", "Org1MSP", "medium")
        
    # 3. Denied org
    with pytest.raises(ConsentError, match="not authorized by patient consent"):
        evaluate_consent(policy, "clinical_reasoning", "Org2MSP", "medium")
        
def test_emergency_breakglass():
    policy = ConsentPolicy(
        patient_id="p1",
        allowed_roles=["supervisor"],
        allowed_organizations=["Org1MSP"]
    )
    
    # Even if role and org are denied by policy, critical urgency overrides it
    assert evaluate_consent(policy, "laboratory", "Org2MSP", "critical") is True

def test_implicit_consent_no_policy():
    # If no policy, we assume Org1MSP (hospital internal) is allowed, but cross-org is denied
    assert evaluate_consent(None, "clinical_reasoning", "Org1MSP", "medium") is True
    
    with pytest.raises(ConsentError, match="No consent policy exists for implicit cross-org access"):
        evaluate_consent(None, "clinical_reasoning", "Org2MSP", "medium")
