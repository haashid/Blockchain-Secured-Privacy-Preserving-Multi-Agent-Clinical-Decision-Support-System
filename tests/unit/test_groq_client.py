"""Unit tests for Groq client: configuration, error classification, retry logic.

These tests do NOT require live Groq credentials.
"""

import asyncio
import json
import os
import pytest
from unittest.mock import AsyncMock, MagicMock, patch


# ─── Error Classification Tests ────────────────────────────────────

def _make_http_response(status_code: int) -> MagicMock:
    """Create a mock HTTP response for Groq error constructors."""
    resp = MagicMock()
    resp.status_code = status_code
    resp.headers = {}
    return resp


class TestErrorClassification:
    """Test error classification in groq_client."""

    def test_import_client_module(self):
        """groq_client module imports cleanly."""
        from backend.agents.llm.groq_client import (
            _classify_error,
            _is_retryable,
            _is_permanent,
            RETRYABLE_ERRORS,
            PERMANENT_ERRORS,
        )

    def test_authentication_error_is_permanent(self):
        """Authentication errors are permanent (not retried)."""
        import groq
        from backend.agents.llm.groq_client import _is_permanent, _is_retryable
        exc = groq.AuthenticationError(
            message="bad key",
            response=_make_http_response(401),
            body={"error": {"message": "bad key"}},
        )
        assert _is_permanent(exc) is True
        assert _is_retryable(exc) is False

    def test_not_found_error_is_permanent(self):
        """404 errors (model not found) are permanent."""
        import groq
        from backend.agents.llm.groq_client import _is_permanent
        exc = groq.NotFoundError(
            message="not found",
            response=_make_http_response(404),
            body={"error": {"message": "not found"}},
        )
        assert _is_permanent(exc) is True

    def test_rate_limit_error_is_retryable(self):
        """Rate limit errors are retryable."""
        import groq
        from backend.agents.llm.groq_client import _is_retryable, _is_permanent
        exc = groq.RateLimitError(
            message="rate limited",
            response=_make_http_response(429),
            body={"error": {"message": "rate limited"}},
        )
        assert _is_retryable(exc) is True
        assert _is_permanent(exc) is False

    def test_internal_server_error_is_retryable(self):
        """500 errors are retryable."""
        import groq
        from backend.agents.llm.groq_client import _is_retryable
        exc = groq.InternalServerError(
            message="server error",
            response=_make_http_response(500),
            body={"error": {"message": "server error"}},
        )
        assert _is_retryable(exc) is True

    def test_json_parse_error_is_not_retryable(self):
        """JSON parse errors are not retryable."""
        from backend.agents.llm.groq_client import _is_retryable
        exc = json.JSONDecodeError("Expecting value", "", 0)
        assert _is_retryable(exc) is False

    def test_classify_error_types(self):
        """Error classification returns correct type strings."""
        import groq
        from backend.agents.llm.groq_client import _classify_error

        tests = [
            (groq.AuthenticationError(message="auth", response=_make_http_response(401), body={}), "AUTHENTICATION_FAILED"),
            (groq.PermissionDeniedError(message="perm", response=_make_http_response(403), body={}), "PERMISSION_DENIED"),
            (groq.NotFoundError(message="nf", response=_make_http_response(404), body={}), "MODEL_NOT_FOUND"),
            (groq.RateLimitError(message="rl", response=_make_http_response(429), body={}), "RATE_LIMITED"),
            (groq.InternalServerError(message="ise", response=_make_http_response(500), body={}), "INTERNAL_SERVER_ERROR"),
            (json.JSONDecodeError("bad", "", 0), "JSON_PARSE_ERROR"),
            (TimeoutError(), "TIMEOUT"),
        ]
        for exc, expected in tests:
            result = _classify_error(exc)
            assert result == expected, f"{type(exc).__name__}: expected {expected}, got {result}"


# ─── Configuration Tests ───────────────────────────────────────────

class TestGroqConfiguration:
    """Test Groq configuration validation."""

    def test_check_groq_config(self):
        """check_groq_config returns configuration status."""
        from backend.agents.llm.groq_client import check_groq_config
        config = asyncio.get_event_loop().run_until_complete(check_groq_config())
        assert "configured" in config
        assert "model" in config
        assert "fast_model" in config
        assert isinstance(config["configured"], bool)

    def test_groq_client_requires_api_key(self):
        """get_groq_client raises ValueError without API key."""
        from backend.agents.llm.groq_client import get_groq_client
        import backend.agents.llm.groq_client as mod

        # Temporarily clear the client and mock empty API key
        old_client = mod._client
        mod._client = None
        with patch.object(mod, 'settings') as mock_settings:
            mock_settings.GROQ_API_KEY = ""
            with pytest.raises(ValueError, match="GROQ_API_KEY"):
                get_groq_client()
        mod._client = old_client


# ─── Factory Routing Tests ─────────────────────────────────────────

class TestFactoryRouting:
    """Test that factory correctly routes to mock vs LLM agents."""

    def test_mock_mode_creates_mock_agent(self):
        """AI_MODE=mock creates mock agent classes."""
        from backend.agents.factory import create_agent
        agent = create_agent(role="clinical_reasoning", mode="mock")
        assert type(agent).__name__ == "MockClinicalReasoningAgent"
        assert agent.mode == "mock"

    def test_groq_mode_creates_groq_agent(self):
        """AI_MODE=groq creates Groq LLM agent classes."""
        from backend.agents.factory import create_agent
        agent = create_agent(role="clinical_reasoning", mode="groq")
        assert type(agent).__name__ == "GroqClinicalReasoningAgent"
        assert agent.mode == "groq"

    def test_llm_mode_creates_groq_agent(self):
        """AI_MODE=llm creates Groq LLM agent classes (via LLMAgent base)."""
        from backend.agents.factory import create_agent
        from backend.agents.llm.llm_base import LLMAgent
        agent = create_agent(role="clinical_reasoning", mode="llm")
        assert isinstance(agent, LLMAgent)

    def test_all_10_roles_route_in_both_modes(self):
        """All 10 agent roles can be created in both mock and groq modes."""
        from backend.agents.factory import create_agent

        all_roles = [
            "supervisor", "clinical_reasoning", "history", "laboratory",
            "medication", "risk", "evidence", "critic", "verifier", "synthesizer"
        ]

        for role in all_roles:
            mock_agent = create_agent(role=role, mode="mock")
            groq_agent = create_agent(role=role, mode="groq")
            assert mock_agent.role == role
            assert groq_agent.role == role
            assert type(mock_agent).__name__.startswith("Mock")
            assert type(groq_agent).__name__.startswith("Groq")

    def test_blockchain_mode_resolves_to_settings(self):
        """Coordination mode 'blockchain' resolves to settings.AI_MODE."""
        from backend.agents.factory import _resolve_ai_mode
        result = _resolve_ai_mode("blockchain")
        assert result in ("mock", "llm", "groq")
        assert result != "blockchain"


# ─── Output Schema Tests ───────────────────────────────────────────

class TestOutputSchemas:
    """Test that all 10 output schemas are valid Pydantic models."""

    def test_all_schemas_exist(self):
        """All 10 agent roles have output schemas."""
        from backend.agents.base import AGENT_OUTPUT_TYPES
        expected = {
            "supervisor", "clinical_reasoning", "history", "laboratory",
            "medication", "risk", "evidence", "critic", "verifier", "synthesizer"
        }
        assert set(AGENT_OUTPUT_TYPES.keys()) == expected

    def test_schema_validation_catches_bad_confidence(self):
        """Schema rejects confidence outside 0.0-1.0 range."""
        from backend.agents.base import AGENT_OUTPUT_TYPES
        from pydantic import ValidationError

        schema = AGENT_OUTPUT_TYPES["clinical_reasoning"]
        bad_output = {
            "agent_id": "test",
            "role": "clinical_reasoning",
            "summary": "test",
            "confidence": 1.5,
        }
        with pytest.raises(ValidationError):
            schema.model_validate(bad_output)


# ─── Malformed JSON Tests ──────────────────────────────────────────

class TestMalformedHandling:
    """Test that malformed LLM output is properly rejected."""

    def test_generate_json_rejects_invalid_json(self):
        """generate_json raises RuntimeError on invalid JSON after retries."""
        from backend.agents.llm.groq_client import generate_json

        async def mock_create(*args, **kwargs):
            mock_response = MagicMock()
            mock_response.choices = [MagicMock()]
            mock_response.choices[0].message.content = "This is not JSON"
            mock_response.choices[0].finish_reason = "stop"
            mock_response.model = "test-model"
            mock_response.usage = MagicMock(prompt_tokens=10, completion_tokens=10, total_tokens=20)
            return mock_response

        async def run():
            with patch("backend.agents.llm.groq_client.get_groq_client") as mock_get:
                mock_client = AsyncMock()
                mock_client.chat.completions.create = mock_create
                mock_get.return_value = mock_client
                await generate_json("system", "user", model="test", max_retries=1)

        with pytest.raises(RuntimeError, match="failed after"):
            asyncio.get_event_loop().run_until_complete(run())
