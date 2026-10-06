"""Trust scoring service."""

import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.models.models import Agent, TrustScore, AuditEvent


def calculate_risk_level(score: float) -> str:
    if score >= 80:
        return "trusted"
    elif score >= 60:
        return "normal"
    elif score >= 40:
        return "warning"
    elif score >= 20:
        return "suspicious"
    else:
        return "critical"


def clamp_score(score: float) -> float:
    return max(0.0, min(100.0, score))


async def update_trust_score(
    db: AsyncSession,
    agent_id: str,
    delta: float,
    reason: str,
) -> TrustScore | None:
    """Update an agent's trust score and create audit event."""
    result = await db.execute(select(Agent).where(Agent.id == agent_id))
    agent = result.scalar_one_or_none()
    if not agent:
        return None

    previous_score = agent.trust_score
    new_score = clamp_score(previous_score + delta)
    agent.trust_score = new_score
    risk_level = calculate_risk_level(new_score)

    # Create audit event
    audit = AuditEvent(
        event_type="trust.score_changed",
        agent_id=agent_id,
        organization=agent.organization,
        status=risk_level,
        details={
            "previous_score": previous_score,
            "new_score": new_score,
            "delta": delta,
            "reason": reason,
            "risk_level": risk_level,
        },
    )
    db.add(audit)
    await db.flush()

    # Create trust score record
    trust = TrustScore(
        id=uuid.uuid4(),
        agent_id=agent_id,
        previous_score=previous_score,
        new_score=new_score,
        delta=delta,
        reason=reason,
        risk_level=risk_level,
        audit_event_id=audit.id,
    )
    db.add(trust)
    await db.flush()

    return trust


# Deduction/reward constants
DEDUCTIONS = {
    "invalid_hash": -40,
    "tampered_output": -50,
    "unauthorized_transaction": -30,
    "repeated_malformed_output": -10,
    "contradiction_with_evidence": -5,
    "repeated_timeout": -2,
}

REWARDS = {
    "valid_verified_decision": +1,
    "consistency_with_peers": +2,
    "successful_verification": +1,
}
