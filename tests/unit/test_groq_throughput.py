"""Stage 1: Groq throughput, rate-limit scheduling, model fallback, and resilience tests."""

import asyncio
import json
import time
from unittest.mock import AsyncMock, MagicMock, patch

import groq
import pytest

from backend.agents.llm.groq_client import (
    _classify_error,
    _extract_retry_delay,
    _is_permanent,
    _is_retryable,
    generate_json,
    GroqResult,
    LLMTelemetry,
)
from backend.core.config import get_settings

settings = get_settings()


class TestRateLimitAndErrorClassification:
    """Verify error classification and header parsing."""

    def test_classify_permanent_errors(self):
        auth_err = groq.AuthenticationError("Invalid API Key", response=MagicMock(status_code=401), body={})
        assert _classify_error(auth_err) == "AUTHENTICATION_FAILED"
        assert _is_permanent(auth_err) is True
        assert _is_retryable(auth_err) is False

        bad_req = groq.BadRequestError("Invalid JSON", response=MagicMock(status_code=400), body={})
        assert _classify_error(bad_req) == "BAD_REQUEST"
        assert _is_permanent(bad_req) is True
        assert _is_retryable(bad_req) is False

        not_found = groq.NotFoundError("Model not found", response=MagicMock(status_code=404), body={})
        assert _classify_error(not_found) == "MODEL_NOT_FOUND"
        assert _is_permanent(not_found) is True

    def test_classify_transient_errors(self):
        rate_err = groq.RateLimitError("Rate limit reached", response=MagicMock(status_code=429), body={})
        assert _classify_error(rate_err) == "RATE_LIMITED"
        assert _is_retryable(rate_err) is True
        assert _is_permanent(rate_err) is False

        server_err = groq.InternalServerError("Internal error", response=MagicMock(status_code=500), body={})
        assert _classify_error(server_err) == "INTERNAL_SERVER_ERROR"
        assert _is_retryable(server_err) is True

    def test_extract_retry_delay_from_headers(self):
        # 1. From retry-after
        headers = {"retry-after": "4.5"}
        delay = _extract_retry_delay(Exception("error"), headers)
        assert delay == 4.5

        # 2. From x-ratelimit-reset-tokens in seconds
        headers = {"x-ratelimit-reset-tokens": "1.25s"}
        delay = _extract_retry_delay(Exception("error"), headers)
        assert delay == 1.25

        # 3. From x-ratelimit-reset-tokens in ms
        headers = {"x-ratelimit-reset-tokens": "500ms"}
        delay = _extract_retry_delay(Exception("error"), headers)
        assert delay == 0.5

    def test_extract_retry_delay_from_message(self):
        err = Exception("Rate limit reached: Please try again in 2.34s")
        delay = _extract_retry_delay(err, None)
        assert delay == 2.34


class TestModelFallbackAndResilience:
    """Verify rate-limit aware scheduling and model fallback."""

    @pytest.mark.asyncio
    async def test_primary_success_no_fallback(self):
        mock_response = MagicMock()
        mock_response.choices = [MagicMock(message=MagicMock(content='{"status": "ok", "confidence": 0.9}'))]
        mock_response.usage = MagicMock(prompt_tokens=120, completion_tokens=45, total_tokens=165)

        raw_wrapper = MagicMock()
        raw_wrapper.parse.return_value = mock_response

        mock_client = AsyncMock()
        mock_client.chat.completions.with_raw_response.create = AsyncMock(return_value=raw_wrapper)

        with patch("backend.agents.llm.groq_client.get_groq_client", return_value=mock_client):
            res = await generate_json(
                system_prompt="Clinical analysis in JSON",
                user_prompt="Analyze vitals",
                model="qwen/qwen3.8-27b",
                max_retries=2,
                agent_role="clinical_reasoning",
            )
            assert res["status"] == "ok"
            assert res["confidence"] == 0.9
            assert mock_client.chat.completions.with_raw_response.create.call_count == 1
            # Primary model called
            call_kwargs = mock_client.chat.completions.with_raw_response.create.call_args.kwargs
            assert call_kwargs["model"] == "qwen/qwen3.8-27b"

    @pytest.mark.asyncio
    async def test_primary_rate_limited_then_fallback_succeeds(self):
        """When primary model fails with 429 retries, fallback model is tried and succeeds."""
        # Setup rate limit error for primary
        rate_err = groq.RateLimitError(
            "Rate limit reached for qwen/qwen3.8-27b",
            response=MagicMock(status_code=429, headers={"retry-after": "0.01"}),
            body={},
        )

        mock_response_fallback = MagicMock()
        mock_response_fallback.choices = [MagicMock(message=MagicMock(content='{"fallback": true, "confidence": 0.85}'))]
        mock_response_fallback.usage = MagicMock(prompt_tokens=150, completion_tokens=50, total_tokens=200)

        raw_wrapper_fallback = MagicMock()
        raw_wrapper_fallback.parse.return_value = mock_response_fallback

        mock_client = AsyncMock()
        # Primary fails twice (max_retries=2), then fallback succeeds
        mock_client.chat.completions.with_raw_response.create = AsyncMock(
            side_effect=[rate_err, rate_err, raw_wrapper_fallback]
        )

        with patch("backend.agents.llm.groq_client.get_groq_client", return_value=mock_client):
            with patch("asyncio.sleep", new_callable=AsyncMock):
                res = await generate_json(
                    system_prompt="Clinical JSON prompt",
                    user_prompt="Analyze patient",
                    model="qwen/qwen3.8-27b",
                    max_retries=2,
                    agent_role="laboratory",
                )
                assert res["fallback"] is True
                assert res["confidence"] == 0.85
                # Verify fallback model was called on 3rd attempt
                assert mock_client.chat.completions.with_raw_response.create.call_count == 3
                last_call = mock_client.chat.completions.with_raw_response.create.call_args_list[-1]
                assert last_call.kwargs["model"] == getattr(settings, "GROQ_MODEL_FALLBACK", "openai/gpt-oss-20b")

    @pytest.mark.asyncio
    async def test_permanent_error_fails_immediately_no_fallback(self):
        """Permanent 401 error should fail immediately without retrying or falling back."""
        auth_err = groq.AuthenticationError("Invalid API Key", response=MagicMock(status_code=401), body={})

        mock_client = AsyncMock()
        mock_client.chat.completions.with_raw_response.create = AsyncMock(side_effect=auth_err)

        with patch("backend.agents.llm.groq_client.get_groq_client", return_value=mock_client):
            with pytest.raises(RuntimeError) as exc_info:
                await generate_json(
                    system_prompt="Clinical JSON",
                    user_prompt="Test case",
                    model="qwen/qwen3.8-27b",
                    max_retries=3,
                    agent_role="risk",
                )
            assert "Permanent error" in str(exc_info.value)
            # Exactly 1 call, zero retries
            assert mock_client.chat.completions.with_raw_response.create.call_count == 1

    @pytest.mark.asyncio
    async def test_concurrency_semaphore_bounds_parallel_requests(self):
        """Verify that concurrent agent calls are bounded by the semaphore."""
        active_calls = 0
        max_active_observed = 0

        async def fake_create(**kwargs):
            nonlocal active_calls, max_active_observed
            active_calls += 1
            max_active_observed = max(max_active_observed, active_calls)
            await asyncio.sleep(0.05)
            active_calls -= 1

            mock_resp = MagicMock()
            mock_resp.choices = [MagicMock(message=MagicMock(content='{"status": "ok"}'))]
            mock_resp.usage = MagicMock(prompt_tokens=100, completion_tokens=30, total_tokens=130)
            raw = MagicMock()
            raw.parse.return_value = mock_resp
            return raw

        mock_client = AsyncMock()
        mock_client.chat.completions.with_raw_response.create = AsyncMock(side_effect=fake_create)

        with patch("backend.agents.llm.groq_client.get_groq_client", return_value=mock_client):
            # Run 6 concurrent requests
            tasks = [
                generate_json(
                    system_prompt="System JSON",
                    user_prompt=f"Task {i}",
                    model="qwen/qwen3.8-27b",
                    max_retries=1,
                    agent_role=f"agent_{i}",
                )
                for i in range(6)
            ]
            results = await asyncio.gather(*tasks)
            assert len(results) == 6
            # Concurrency limit should be respected
            limit = getattr(settings, "GROQ_MAX_CONCURRENT_REQUESTS", 3)
            assert max_active_observed <= limit
