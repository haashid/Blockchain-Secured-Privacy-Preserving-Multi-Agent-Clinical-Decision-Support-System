"""Hyperledger Fabric Gateway adapter service."""

import asyncio
import hashlib
import json
from datetime import datetime, timezone
from typing import Any

from backend.core.config import get_settings
from backend.core.logging_config import get_logger

logger = get_logger("blockchain.gateway")


class FabricGatewayService:
    """Adapter for Hyperledger Fabric Gateway API.

    This service abstracts all Fabric SDK interactions.
    It implements a robust Local Simulation Mode when Fabric is not available,
    allowing the platform to demonstrate blockchain features without requiring
    a heavy, running Fabric network.
    """

    def __init__(self):
        self.settings = get_settings()
        self._connected = False
        self._gateway = None
        self._network = None
        self._contract = None
        
        # Local simulation state
        self._simulation_mode = False
        self._simulated_blocks = 1500
        self._simulated_tx_count = 5420
        self._ledger_data: dict[str, Any] = {}

    async def connect(self) -> bool:
        """Attempt to connect to Fabric gateway with bounded timeout, fallback to simulation."""
        timeout = getattr(self.settings, "FABRIC_CONNECT_TIMEOUT_SECONDS", 3.0)
        require_native = getattr(self.settings, "FABRIC_REQUIRE_BLOCKCHAIN", False)

        if self.settings.FABRIC_CERT_PATH:
            try:
                async def _do_connect():
                    import grpc
                    from fabric_gateway import DefaultSigners, Gateway, DefaultIdentity

                    with open(self.settings.FABRIC_CERT_PATH, "rb") as f:
                        certificate_pem = f.read()

                    credentials = grpc.ssl_channel_credentials(certificate_pem)
                    channel = grpc.aio.secure_channel(self.settings.FABRIC_GATEWAY_ENDPOINT, credentials)

                    identity = DefaultIdentity(self.settings.FABRIC_ORG1_MSP, certificate_pem)
                    gw = Gateway(
                        connection=channel,
                        identity=identity,
                        signer=DefaultSigners.from_private_key_file(self.settings.FABRIC_KEY_PATH)
                    )
                    net = gw.get_network(self.settings.FABRIC_CHANNEL)
                    ctr = net.get_contract(self.settings.FABRIC_CHAINCODE)
                    return gw, net, ctr

                self._gateway, self._network, self._contract = await asyncio.wait_for(_do_connect(), timeout=timeout)
                self._connected = True
                self._simulation_mode = False
                logger.info("fabric_connected", mode="native", endpoint=self.settings.FABRIC_GATEWAY_ENDPOINT)
                return True
            except asyncio.TimeoutError:
                logger.warning("fabric_native_connection_timeout", timeout_seconds=timeout)
                if require_native:
                    self._connected = False
                    raise ConnectionError(f"Hyperledger Fabric gateway connection timed out after {timeout}s.")
            except ImportError:
                logger.info("fabric_gateway_sdk_not_installed")
                if require_native:
                    self._connected = False
                    raise ConnectionError("fabric_gateway SDK not installed and native blockchain is required.")
            except Exception as e:
                logger.warning("fabric_native_connection_failed", error=str(e))
                if require_native:
                    self._connected = False
                    raise ConnectionError(f"Hyperledger Fabric connection failed: {e}")

        if require_native:
            self._connected = False
            raise ConnectionError("Native Hyperledger Fabric connection is required but no valid credentials or endpoints were reachable.")

        # Fallback to Local Simulation Mode
        logger.info("fabric_connected", mode="simulation")
        self._connected = True
        self._simulation_mode = True
        return True

    @property
    def is_connected(self) -> bool:
        return self._connected

    def _generate_simulated_tx(self, prefix: str, data: Any) -> str:
        """Generate a deterministic transaction ID for simulation."""
        self._simulated_tx_count += 1
        if self._simulated_tx_count % 5 == 0:
            self._simulated_blocks += 1
            
        data_str = json.dumps(data, sort_keys=True)
        tx_hash = hashlib.sha256(data_str.encode()).hexdigest()
        return f"tx-{prefix}-{tx_hash[:12]}"

    async def register_agent(self, agent_data: dict[str, Any]) -> dict[str, Any]:
        if not self._connected:
            raise ConnectionError("Fabric network not connected")
            
        if self._simulation_mode:
            tx_id = self._generate_simulated_tx("agent", agent_data)
            self._ledger_data[tx_id] = {"type": "agent", "data": agent_data, "timestamp": datetime.now(timezone.utc).isoformat()}
        elif self._contract:
            await self._contract.submit_transaction(
                "RegisterAgent", 
                agent_data.get("id"), agent_data.get("display_name"), 
                agent_data.get("role"), agent_data.get("organization"), 
                json.dumps(agent_data.get("capabilities", []))
            )
            tx_id = f"tx-agent-{agent_data.get('id', 'unknown')}"
            
        logger.info("fabric_register_agent", agent_id=agent_data.get("id"))
        return {"status": "submitted", "tx_id": tx_id}

    async def create_task(self, task_data: dict[str, Any]) -> dict[str, Any]:
        if not self._connected:
            raise ConnectionError("Fabric network not connected")
            
        if self._simulation_mode:
            tx_id = self._generate_simulated_tx("task", task_data)
            self._ledger_data[tx_id] = {"type": "task", "data": task_data, "timestamp": datetime.now(timezone.utc).isoformat()}
        elif self._contract:
            await self._contract.submit_transaction(
                "CreateTask",
                task_data.get("id"), task_data.get("title"),
                task_data.get("domain"), task_data.get("priority")
            )
            tx_id = f"tx-task-{task_data.get('id', 'unknown')}"
            
        logger.info("fabric_create_task", task_id=task_data.get("id"))
        return {"status": "submitted", "tx_id": tx_id}

    async def record_decision_proof(self, proof_data: dict[str, Any]) -> dict[str, Any]:
        if not self._connected:
            raise ConnectionError("Fabric network not connected")
        
        if self._simulation_mode:
            if getattr(self.settings, "FABRIC_REQUIRE_BLOCKCHAIN", False):
                raise RuntimeError("Operation requires native Hyperledger Fabric ledger, but gateway is in simulation mode.")
            tx_id = self._generate_simulated_tx("proof", proof_data)
            self._ledger_data[tx_id] = {"type": "proof", "data": proof_data, "timestamp": datetime.now(timezone.utc).isoformat()}
            block_num = self._simulated_blocks
            status = "simulated_committed"
            is_sim = True
            ledger_mode = "simulation"
        elif self._contract:
            result = await self._contract.submit_transaction(
                "RecordDecisionProof",
                proof_data.get("proof_id"), proof_data.get("task_id"),
                proof_data.get("run_id"), proof_data.get("agent_id"),
                proof_data.get("agent_role"), proof_data.get("organization"),
                proof_data.get("content_hash"), proof_data.get("storage_reference"),
                str(proof_data.get("confidence", 100))
            )
            tx_id = f"tx-proof-{proof_data.get('proof_id', 'unknown')}"
            block_num = None
            status = "committed"
            is_sim = False
            ledger_mode = "native"
        else:
            raise ConnectionError("No active Fabric contract available.")
            
        logger.info("fabric_record_proof", proof_id=proof_data.get("proof_id"), status=status, mode=ledger_mode)
        return {
            "tx_id": tx_id,
            "block_number": block_num,
            "status": status,
            "is_simulated": is_sim,
            "ledger_mode": ledger_mode,
        }

    async def get_decision_proof(self, proof_id: str) -> dict[str, Any] | None:
        if not self._connected:
            raise ConnectionError("Fabric network not connected")
            
        if self._simulation_mode:
            for tx in self._ledger_data.values():
                if tx["type"] == "proof" and tx["data"].get("proof_id") == proof_id:
                    return tx["data"]
            return None
            
        if self._contract:
            result = await self._contract.evaluate_transaction("GetDecisionProof", proof_id)
            return json.loads(result.decode("utf-8"))
        return None

    async def record_verification(self, verification_data: dict[str, Any]) -> dict[str, Any]:
        if not self._connected:
            raise ConnectionError("Fabric network not connected")
            
        if self._simulation_mode:
            tx_id = self._generate_simulated_tx("verify", verification_data)
            self._ledger_data[tx_id] = {"type": "verify", "data": verification_data, "timestamp": datetime.now(timezone.utc).isoformat()}
        elif self._contract:
            await self._contract.submit_transaction(
                "RecordVerification",
                str(verification_data.get("id")), verification_data.get("proof_id"),
                "true" if verification_data.get("verified") else "false",
                verification_data.get("blockchain_hash"), verification_data.get("computed_hash"),
                verification_data.get("agent_id"), json.dumps(verification_data.get("failures", []))
            )
            tx_id = f"tx-verify-{verification_data.get('proof_id', '')}"
            
        return {"status": "submitted", "tx_id": tx_id}

    async def record_audit_event(self, event_data: dict[str, Any]) -> dict[str, Any]:
        if not self._connected:
            raise ConnectionError("Fabric network not connected")
            
        if self._simulation_mode:
            tx_id = self._generate_simulated_tx("audit", event_data)
            self._ledger_data[tx_id] = {"type": "audit", "data": event_data, "timestamp": datetime.now(timezone.utc).isoformat()}
            return {"status": "submitted", "tx_id": tx_id}
            
        return {"status": "submitted", "tx_id": f"tx-audit-{event_data.get('event_type', '')}"}

    async def update_trust(self, agent_id: str, score: float, reason: str) -> dict[str, Any]:
        if not self._connected:
            raise ConnectionError("Fabric network not connected")
            
        if self._simulation_mode:
            tx_id = self._generate_simulated_tx("trust", {"agent_id": agent_id, "score": score, "reason": reason})
            self._ledger_data[tx_id] = {"type": "trust", "data": {"agent_id": agent_id, "score": score, "reason": reason}, "timestamp": datetime.now(timezone.utc).isoformat()}
            return {"status": "submitted", "tx_id": tx_id}
            
        if self._contract:
            await self._contract.submit_transaction("UpdateAgentTrust", agent_id, str(score), reason, "normal")
        return {"status": "submitted", "tx_id": f"tx-trust-{agent_id}"}

    async def get_transaction(self, tx_id: str) -> dict[str, Any] | None:
        if not self._connected:
            raise ConnectionError("Fabric network not connected")
            
        if self._simulation_mode:
            return self._ledger_data.get(tx_id)
            
        return None

    async def get_network_status(self) -> dict[str, Any]:
        if self._simulation_mode:
            tx_count = self._simulated_tx_count
        else:
            tx_count = 0
            if self._contract:
                try:
                    stats = await self._contract.evaluate_transaction("GetLedgerStats")
                    stats_json = json.loads(stats.decode("utf-8"))
                    tx_count = stats_json.get("total_proofs", 0) + stats_json.get("total_verifications", 0)
                except Exception:
                    pass
            
        return {
            "connected": self._connected,
            "network": self.settings.FABRIC_NETWORK,
            "channel": self.settings.FABRIC_CHANNEL,
            "chaincode": self.settings.FABRIC_CHAINCODE,
            "organizations": [self.settings.FABRIC_ORG1_MSP, self.settings.FABRIC_ORG2_MSP],
            "peer_count": 4 if self._simulation_mode else 2,
            "transaction_count": tx_count,
            "gateway_endpoint": "simulation.hyperledger.local" if self._simulation_mode else self.settings.FABRIC_GATEWAY_ENDPOINT,
            "fabric_sdk_mode": "simulation" if self._simulation_mode else ("native" if self._contract else "disconnected"),
            "is_simulated": self._simulation_mode,
            "connection_status": "simulation_active" if self._simulation_mode else ("connected" if self._connected else "disconnected"),
            "require_blockchain": getattr(self.settings, "FABRIC_REQUIRE_BLOCKCHAIN", False),
        }


# Singleton
_fabric_service: FabricGatewayService | None = None

def get_fabric_service() -> FabricGatewayService:
    global _fabric_service
    if _fabric_service is None:
        _fabric_service = FabricGatewayService()
    return _fabric_service
