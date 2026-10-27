import httpx
import os

ZKP_SERVICE_URL = os.environ.get("ZKP_SERVICE_URL", "http://zkp:3000")

class ZKPClientError(Exception):
    pass

class ZKPClient:
    """Client for the Node.js ZKP Service."""
    
    @staticmethod
    async def get_public_key() -> str:
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(f"{ZKP_SERVICE_URL}/api/public-key")
                response.raise_for_status()
                return response.json().get("publicKey")
        except httpx.HTTPError as e:
            raise ZKPClientError(f"Failed to get public key: {str(e)}")
            
    @staticmethod
    async def issue_credential(claims: dict) -> dict:
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(f"{ZKP_SERVICE_URL}/api/issue", json=claims)
                if response.status_code != 200:
                    raise ZKPClientError(f"Issue error: {response.text}")
                return response.json()
        except httpx.HTTPError as e:
            raise ZKPClientError(f"Failed to issue credential: {str(e)}")

    @staticmethod
    async def derive_proof(signature: str, claims: dict, nonce: str, revealed_indices: list[int]) -> str:
        try:
            payload = {
                "signature": signature,
                "claims": claims,
                "nonce": nonce,
                "revealed_indices": revealed_indices
            }
            async with httpx.AsyncClient() as client:
                response = await client.post(f"{ZKP_SERVICE_URL}/api/derive-proof", json=payload)
                if response.status_code != 200:
                    raise ZKPClientError(f"Proof derivation error: {response.text}")
                return response.json().get("proof")
        except httpx.HTTPError as e:
            raise ZKPClientError(f"Failed to derive proof: {str(e)}")

    @staticmethod
    async def verify_proof(proof: str, revealed_claims: list[str], nonce: str) -> dict:
        try:
            payload = {
                "proof": proof,
                "revealed_claims": revealed_claims,
                "nonce": nonce
            }
            async with httpx.AsyncClient() as client:
                response = await client.post(f"{ZKP_SERVICE_URL}/api/verify-proof", json=payload)
                if response.status_code != 200:
                    raise ZKPClientError(f"Proof verification error: {response.text}")
                return response.json()
        except httpx.HTTPError as e:
            raise ZKPClientError(f"Failed to verify proof: {str(e)}")
