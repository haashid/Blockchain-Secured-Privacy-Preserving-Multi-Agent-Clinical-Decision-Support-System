"""Anomaly detection service."""

from typing import Any

from backend.core.logging_config import get_logger

logger = get_logger("anomaly")


def detect_anomalies(
    agent_outputs: dict[str, dict],
    verifications: list[dict],
    agent_trust_scores: dict[str, float] | None = None,
) -> list[dict[str, Any]]:
    """Run all anomaly detection checks and return list of anomalies."""
    anomalies = []

    # 1. Hash mismatch detection
    for v in verifications:
        if not v.get("verified"):
            anomalies.append({
                "type": "hash_mismatch",
                "agent": v.get("agent_id", "unknown"),
                "severity": "high",
                "description": "Stored output hash does not match blockchain hash — possible tampering",
            })

    # 2. Invalid output schema
    for role, output in agent_outputs.items():
        if not output or not isinstance(output, dict):
            anomalies.append({
                "type": "invalid_output_schema",
                "agent": role,
                "severity": "high",
                "description": f"Agent {role} produced empty or invalid output",
            })

    # 3. Impossible confidence values + overconfidence (independent checks)
    for role, output in agent_outputs.items():
        conf = output.get("confidence")
        if conf is not None:
            if conf < 0 or conf > 1:
                anomalies.append({
                    "type": "impossible_confidence",
                    "agent": role,
                    "severity": "medium",
                    "description": f"Agent {role} reported impossible confidence: {conf}",
                })
            if conf > 0.98:
                anomalies.append({
                    "type": "overconfidence",
                    "agent": role,
                    "severity": "low",
                    "description": f"Agent {role} reported unusually high confidence: {conf}",
                })

    # 4. Contradictions between agents
    conditions = set()
    for role, output in agent_outputs.items():
        for c in output.get("possible_conditions", []):
            conditions.add(c.get("condition", ""))
    if len(conditions) > 3:
        anomalies.append({
            "type": "contradictory_conditions",
            "agent": "system",
            "severity": "medium",
            "description": f"Agents proposed {len(conditions)} different conditions — high divergence",
        })

    # 5. Low trust scores
    if agent_trust_scores:
        for agent_id, score in agent_trust_scores.items():
            if score < 40:
                anomalies.append({
                    "type": "low_trust_score",
                    "agent": agent_id,
                    "severity": "high",
                    "description": f"Agent {agent_id} has low trust score: {score}",
                })

    return anomalies


def classify_anomaly(anomaly: dict) -> str:
    """Classify anomaly for the detection mechanism spec."""
    classifications = {
        "hash_mismatch": "integrity_violation",
        "unauthorized_identity": "unauthorized",
        "duplicate_identity": "fraudulent",
        "invalid_output_schema": "inconsistent",
        "contradictory_conditions": "inconsistent",
        "impossible_confidence": "anomalous",
        "overconfidence": "anomalous",
        "low_trust_score": "suspicious",
    }
    return classifications.get(anomaly.get("type", ""), "unknown")
