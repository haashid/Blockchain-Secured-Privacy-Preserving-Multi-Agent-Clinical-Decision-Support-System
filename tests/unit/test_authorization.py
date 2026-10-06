import pytest
from backend.identity.authorization import authorize_agent, AuthorizationError, PolicyEngine
from backend.identity.context_builders import build_minimum_necessary_context

def test_policy_engine_authorization():
    engine = PolicyEngine()
    
    # Lab agent should access labs
    assert engine.authorize_resource_access("did:1", "laboratory", ["lab_analysis"], "laboratory_data") is True
    
    # Lab agent should NOT access clinical notes if lacking capabilities
    with pytest.raises(AuthorizationError):
        engine.authorize_resource_access("did:1", "laboratory", ["lab_analysis"], "clinical_notes")
        
    # Supervisor accesses everything
    assert engine.authorize_resource_access("did:2", "supervisor", [], "patient_history") is True

def test_build_minimum_necessary_context():
    full_patient_context = {
        "history": {"data": "patient history"},
        "labs": {"data": "lab results"},
        "symptoms": {"data": "symptoms"},
        "unmapped_secret_section": {"data": "secret"}
    }
    
    # 1. Lab agent with only lab capability
    lab_context = build_minimum_necessary_context(
        task={},
        full_patient_context=full_patient_context,
        agent_did="did:lab",
        agent_role="laboratory",
        agent_capabilities=["lab_analysis"]
    )
    
    assert "labs" in lab_context
    assert "history" not in lab_context
    assert "symptoms" not in lab_context
    assert "unmapped_secret_section" not in lab_context
    
    # 2. Reasoning agent with clinical notes capability
    reasoning_context = build_minimum_necessary_context(
        task={},
        full_patient_context=full_patient_context,
        agent_did="did:reasoning",
        agent_role="clinical_reasoning",
        agent_capabilities=["symptom_analysis"]
    )
    
    assert "symptoms" in reasoning_context
    assert "labs" not in reasoning_context
    assert "history" not in reasoning_context
    
    # 3. Supervisor gets full mapped context, but unmapped is still dropped?
    # Wait, the code says:
    # if agent_role == "supervisor": return full_patient_context
    # So supervisor gets EVERYTHING.
    supervisor_context = build_minimum_necessary_context(
        task={},
        full_patient_context=full_patient_context,
        agent_did="did:super",
        agent_role="supervisor",
        agent_capabilities=["task_classification"]
    )
    
    assert "unmapped_secret_section" in supervisor_context
    assert "history" in supervisor_context
