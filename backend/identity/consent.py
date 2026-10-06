"""Patient consent policies and Emergency Breakglass mechanics."""

from __future__ import annotations
from typing import Any

class ConsentError(Exception):
    """Raised when access is denied due to patient consent policies."""
    pass

class ConsentPolicy:
    def __init__(self, patient_id: str, allowed_roles: list[str], allowed_organizations: list[str]):
        self.patient_id = patient_id
        self.allowed_roles = allowed_roles
        self.allowed_organizations = allowed_organizations

def evaluate_consent(
    policy: dict[str, Any] | ConsentPolicy | None,
    agent_role: str,
    agent_org: str,
    urgency: str
) -> bool:
    """Evaluate whether an agent is allowed to access the patient's record based on consent.
    
    Implements Emergency Breakglass if urgency == "critical".
    """
    # 1. Emergency Breakglass Mechanism
    if urgency == "critical":
        # Overrides consent
        return True
        
    # 2. If no policy exists, we assume implicit consent for the hospital network
    # In a real system, no policy might mean default deny. For this prototype, we default to Org1MSP.
    if policy is None:
        if agent_org == "Org1MSP":
            return True
        raise ConsentError(f"Agent from {agent_org} denied: No consent policy exists for implicit cross-org access.")
        
    if isinstance(policy, dict):
        allowed_roles = policy.get("allowed_roles", [])
        allowed_organizations = policy.get("allowed_organizations", [])
    else:
        allowed_roles = policy.allowed_roles
        allowed_organizations = policy.allowed_organizations
        
    if "*" not in allowed_organizations and agent_org not in allowed_organizations:
        raise ConsentError(f"Agent organization {agent_org} is not authorized by patient consent.")
        
    if "*" not in allowed_roles and agent_role not in allowed_roles:
        raise ConsentError(f"Agent role {agent_role} is not authorized by patient consent.")
        
    return True
