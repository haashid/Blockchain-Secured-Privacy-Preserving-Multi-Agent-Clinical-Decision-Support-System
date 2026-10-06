"""Builds minimum-necessary context for agents based on their role and authorization."""

from __future__ import annotations
from typing import Any

from backend.identity.authorization import authorize_agent, AuthorizationError

def build_minimum_necessary_context(
    task: dict[str, Any],
    full_patient_context: dict[str, Any],
    agent_did: str,
    agent_role: str,
    agent_capabilities: list[str]
) -> dict[str, Any]:
    """Filter the patient context down to only what the agent is authorized to see.
    
    Prevents unrestricted patient-record access.
    """
    filtered_context = {}
    
    # Define which sections of the EHR context correspond to which resource types
    section_resource_map = {
        "history": "patient_history",
        "allergies": "patient_history",
        "procedures": "patient_history",
        "labs": "laboratory_data",
        "medications": "medications",
        "clinical_notes": "clinical_notes",
        "symptoms": "clinical_notes",
        "chief_complaint": "clinical_notes",
        "diagnoses": "clinical_notes",
    }
    
    # For each section in the patient context, determine the resource type
    # and authorize. If authorized, include it.
    for section, data in full_patient_context.items():
        resource_type = section_resource_map.get(section)
        
        if not resource_type:
            # Unknown section, drop it for security (default deny)
            continue
            
        try:
            authorize_agent(agent_did, agent_role, agent_capabilities, [resource_type])
            filtered_context[section] = data
        except AuthorizationError:
            # Drop this section
            pass
            
    # The supervisor always gets the full context
    if agent_role == "supervisor":
        return full_patient_context
        
    return filtered_context
