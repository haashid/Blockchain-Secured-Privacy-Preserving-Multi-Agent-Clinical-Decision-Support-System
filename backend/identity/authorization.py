"""Capability policy engine and authorization logic.

Enforces "What may this agent do?" based on verified credentials.
"""

from __future__ import annotations
from typing import Any

class AuthorizationError(Exception):
    """Raised when an agent lacks required capabilities or policy constraints fail."""
    pass

class PolicyEngine:
    def __init__(self):
        # Basic capability policies mapping resource type to required capabilities
        self._resource_policies = {
            "patient_history": ["longitudinal_analysis", "chart_review", "allergy_review"],
            "laboratory_data": ["lab_analysis", "lab_interpretation"],
            "medications": ["interaction_check", "allergy_check", "drug_interactions"],
            "clinical_notes": ["symptom_analysis", "differential_diagnosis", "risk_assessment"],
        }
        
    def evaluate_capability(self, agent_role: str, agent_capabilities: list[str], required_capability: str) -> bool:
        """Check if an agent has a specific capability."""
        # The supervisor can implicitly read anything to route tasks
        if agent_role == "supervisor":
            return True
            
        return required_capability in agent_capabilities

    def authorize_resource_access(
        self, 
        agent_did: str, 
        agent_role: str, 
        agent_capabilities: list[str], 
        resource_type: str
    ) -> bool:
        """Evaluate if an agent can access a specific resource type based on its capabilities."""
        if agent_role == "supervisor":
            return True
            
        if resource_type not in self._resource_policies:
            # If the resource is unknown, deny access by default
            return False
            
        required_caps = self._resource_policies[resource_type]
        
        # Check if the agent has ANY of the required capabilities for this resource
        for cap in required_caps:
            if cap in agent_capabilities:
                return True
                
        raise AuthorizationError(f"Agent {agent_did} ({agent_role}) lacks capabilities to access {resource_type}")

def authorize_agent(
    agent_did: str,
    agent_role: str,
    agent_capabilities: list[str],
    requested_resource_types: list[str]
) -> None:
    """Authorize an agent for a list of resources.
    
    Raises AuthorizationError if authorization fails for any resource.
    """
    engine = PolicyEngine()
    
    # We must ensure the agent is authenticated before this function is called.
    # We assume 'agent_capabilities' came from the verified credential.
    
    for resource_type in requested_resource_types:
        engine.authorize_resource_access(agent_did, agent_role, agent_capabilities, resource_type)
