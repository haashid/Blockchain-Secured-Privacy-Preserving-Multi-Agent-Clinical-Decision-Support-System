"""Agent management service."""

from datetime import datetime, timezone
from typing import Any

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from backend.models.models import Agent, AgentIdentity, TrustScore, AuditEvent
from backend.identity.did import generate_key_pair, public_key_to_did, private_key_to_pem
from backend.identity.credentials import issue_credential
from backend.identity.sbt import issue_sbt_on_chain


async def list_agents(db: AsyncSession) -> list[Agent]:
    result = await db.execute(select(Agent).order_by(Agent.created_at.desc()))
    return list(result.scalars().all())


async def get_agent(db: AsyncSession, agent_id: str) -> Agent | None:
    result = await db.execute(select(Agent).where(Agent.id == agent_id))
    return result.scalar_one_or_none()


async def create_agent(db: AsyncSession, **kwargs) -> Agent:
    agent = Agent(**kwargs)
    db.add(agent)
    await db.flush()
    return agent


async def update_agent(db: AsyncSession, agent_id: str, **kwargs) -> Agent | None:
    agent = await get_agent(db, agent_id)
    if not agent:
        return None
    for k, v in kwargs.items():
        if v is not None and hasattr(agent, k):
            setattr(agent, k, v)
    agent.last_seen_at = datetime.now(timezone.utc)
    await db.flush()
    return agent


async def get_agent_trust_history(db: AsyncSession, agent_id: str) -> list[TrustScore]:
    result = await db.execute(
        select(TrustScore).where(TrustScore.agent_id == agent_id)
        .order_by(TrustScore.created_at.desc()).limit(50)
    )
    return list(result.scalars().all())


async def get_agent_activity(db: AsyncSession, agent_id: str) -> dict[str, Any]:
    result = await db.execute(
        select(func.count(Agent.id)).where(Agent.id == agent_id)
    )
    agent = await get_agent(db, agent_id)
    return {
        "agent_id": agent_id,
        "recent_decisions": agent.total_decisions if agent else 0,
        "recent_anomalies": agent.anomalies_detected if agent else 0,
        "last_active": agent.last_seen_at.isoformat() if agent and agent.last_seen_at else None,
    }


async def seed_agents(db: AsyncSession) -> list[Agent]:
    """Seed the database with the 10 clinical agents."""
    agents_data = [
        ("agent-supervisor-01", "Clinical Supervisor", "supervisor", "Org1MSP", ["task_classification", "agent_selection"]),
        ("agent-planner-01", "Task Planner", "planner", "Org1MSP", ["execution_planning"]),
        ("agent-router-01", "Agent Router", "router", "Org1MSP", ["task_dispatch"]),
        ("agent-clinical_reasoning-01", "Clinical Reasoning Agent", "clinical_reasoning", "Org1MSP", ["symptom_analysis", "differential_diagnosis"]),
        ("agent-history-01", "Medical History Agent", "history", "Org1MSP", ["longitudinal_analysis", "allergy_review"]),
        ("agent-laboratory-01", "Laboratory Analysis Agent", "laboratory", "Org1MSP", ["lab_analysis", "abnormality_detection"]),
        ("agent-medication-01", "Medication Safety Agent", "medication", "Org1MSP", ["interaction_check", "allergy_check"]),
        ("agent-risk-01", "Clinical Risk Agent", "risk", "Org1MSP", ["risk_assessment", "urgency_scoring"]),
        ("agent-evidence-01", "Medical Evidence Agent", "evidence", "Org1MSP", ["literature_search", "guideline_retrieval"]),
        ("agent-critic-01", "Clinical Critic Agent", "critic", "Org1MSP", ["adversarial_review", "contradiction_detection"]),
        ("agent-verifier-01", "Verification Agent", "verifier", "Org2MSP", ["integrity_check", "cross_agent_agreement"]),
        ("agent-synthesizer-01", "Clinical Synthesis Agent", "synthesizer", "Org1MSP", ["report_generation", "decision_support"]),
    ]

    existing = await db.execute(select(Agent.id))
    existing_ids = {r[0] for r in existing.all()}
    created = []

    # Generate a single issuer key for all credentials
    issuer_priv, issuer_pub = generate_key_pair()
    issuer_did = public_key_to_did(issuer_pub)
    issuer_priv_pem = private_key_to_pem(issuer_priv)

    for agent_id, display_name, role, org, caps in agents_data:
        if agent_id not in existing_ids:
            # 1. Create Base Agent
            agent = Agent(
                id=agent_id, display_name=display_name, role=role,
                organization=org, capabilities=caps, trust_score=100.0,
            )
            db.add(agent)
            
            # 2. Generate Identity (DID)
            priv_key, pub_key = generate_key_pair()
            did_str = public_key_to_did(pub_key)
            priv_pem = private_key_to_pem(priv_key)
            
            # 3. Issue Credential
            cred_jwt = issue_credential(
                issuer_did=issuer_did,
                issuer_private_key_pem=issuer_priv_pem,
                subject_did=did_str,
                capabilities=caps,
                role=role
            )
            
            # 4. Issue SBT on chain
            # Since issue_sbt_on_chain is async, we await it
            sbt_tx_id = await issue_sbt_on_chain(did_str, role, "mock_hash")
            
            # 5. Create AgentIdentity record
            identity = AgentIdentity(
                agent_id=agent_id,
                fabric_enrollment_id=f"{agent_id}-enroll",
                fabric_msp_id=org,
                fabric_organization=org,
                did=did_str,
                credential_jwt=cred_jwt,
                private_key_pem=priv_pem,
                sbt_tx_id=sbt_tx_id
            )
            db.add(identity)
            
            created.append(agent)

    await db.flush()
    return created
