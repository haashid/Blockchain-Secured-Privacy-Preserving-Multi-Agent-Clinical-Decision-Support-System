"""Reusable async Groq client with rate-limit aware scheduling, model fallback, and telemetry."""

from __future__ import annotations

import asyncio
import inspect
import json
import random
import re
import time
from dataclasses import dataclass, field
from typing import Any

import groq
from groq import AsyncGroq

from backend.core.config import get_settings
from backend.core.logging_config import get_logger

logger = get_logger("groq_client")
settings = get_settings()

# Singleton async client and semaphore
_client: AsyncGroq | None = None
_semaphore: asyncio.Semaphore | None = None


# ─── Telemetry & Result Structures ─────────────────────────────────

@dataclass
class GroqResult:
    """Structured result from a Groq API call."""
    content: str
    model: str
    input_tokens: int = 0
    output_tokens: int = 0
    total_tokens: int = 0
    latency_ms: float = 0.0
    finish_reason: str = ""
    raw_json: dict[str, Any] | None = None
    fallback_used: bool = False
    attempts_made: int = 1


@dataclass
class LLMTelemetry:
    """Safe telemetry recording for an LLM request (no prompt/clinical data)."""
    agent_role: str
    model_identifier: str
    start_time: float
    end_time: float = 0.0
    duration_ms: float = 0.0
    input_tokens: int = 0
    output_tokens: int = 0
    total_tokens: int = 0
    retry_attempt: int = 1
    status: str = "pending"  # success, rate_limited, timeout, failed
    error_category: str | None = None
    fallback_used: bool = False


# ─── Error Classification ──────────────────────────────────────────

RETRYABLE_ERRORS: tuple[type[Exception], ...] = (
    groq.RateLimitError,          # 429
    groq.InternalServerError,     # 500
    groq.APIConnectionError,      # connection failure
    groq.APITimeoutError,         # timeout
    groq.APIStatusError,          # generic status
)

PERMANENT_ERRORS: tuple[type[Exception], ...] = (
    groq.AuthenticationError,     # 401
    groq.PermissionDeniedError,   # 403
    groq.NotFoundError,           # 404
    groq.BadRequestError,         # 400
)


def _is_retryable(exc: Exception) -> bool:
    """Determine if an error is transient and worth retrying."""
    if _is_permanent(exc):
        return False
    if isinstance(exc, RETRYABLE_ERRORS):
        return True
    if isinstance(exc, groq.APIStatusError):
        return exc.status_code in (429, 500, 502, 503, 504)
    return False


def _is_permanent(exc: Exception) -> bool:
    """Determine if an error is permanent and must fail fast."""
    return isinstance(exc, PERMANENT_ERRORS)


def _classify_error(exc: Exception) -> str:
    """Return a standardized error category string."""
    if isinstance(exc, groq.AuthenticationError):
        return "AUTHENTICATION_FAILED"
    if isinstance(exc, groq.PermissionDeniedError):
        return "PERMISSION_DENIED"
    if isinstance(exc, groq.NotFoundError):
        return "MODEL_NOT_FOUND"
    if isinstance(exc, groq.BadRequestError):
        return "BAD_REQUEST"
    if isinstance(exc, groq.RateLimitError):
        return "RATE_LIMITED"
    if isinstance(exc, groq.InternalServerError):
        return "INTERNAL_SERVER_ERROR"
    if isinstance(exc, groq.APITimeoutError):
        return "TIMEOUT"
    if isinstance(exc, groq.APIConnectionError):
        return "CONNECTION_FAILED"
    if isinstance(exc, groq.APIStatusError):
        return f"HTTP_{exc.status_code}"
    if isinstance(exc, json.JSONDecodeError):
        return "JSON_PARSE_ERROR"
    if isinstance(exc, TimeoutError):
        return "TIMEOUT"
    return "UNKNOWN_ERROR"


def _extract_retry_delay(exc: Exception, headers: dict[str, Any] | None = None) -> float | None:
    """Parse exact retry delay from Retry-After, rate limit reset headers, or error message."""
    # 1. Check response headers if present
    if headers:
        if "retry-after" in headers:
            try:
                return float(headers["retry-after"])
            except (ValueError, TypeError):
                pass
        if "x-ratelimit-reset-tokens" in headers:
            val = str(headers["x-ratelimit-reset-tokens"]).strip()
            m = re.match(r"^([\d\.]+)(s|ms|m)?$", val)
            if m:
                num = float(m.group(1))
                unit = m.group(2) or "s"
                if unit == "ms":
                    return num / 1000.0
                elif unit == "m":
                    return num * 60.0
                return num

    # 2. Extract from error message if available (e.g. "try again in 1.22s")
    msg = str(exc)
    m = re.search(r"try again in ([\d\.]+)s", msg)
    if m:
        try:
            return float(m.group(1))
        except ValueError:
            pass

    return None


# ─── Client Lifecycle ──────────────────────────────────────────────

def get_groq_client() -> AsyncGroq:
    """Get or create the singleton AsyncGroq client."""
    global _client
    if _client is None:
        api_key = settings.GROQ_API_KEY
        if not api_key:
            raise ValueError(
                "GROQ_API_KEY is not configured. Set it in .env or environment variables."
            )
        timeout = getattr(settings, "GROQ_REQUEST_TIMEOUT_SECONDS", 30.0)
        _client = AsyncGroq(
            api_key=api_key,
            timeout=timeout,
            max_retries=0,  # Controlled via scheduler
        )
        logger.info(
            "groq_client_initialized",
            primary_model=getattr(settings, "GROQ_MODEL_PRIMARY", settings.GROQ_MODEL),
            fallback_model=getattr(settings, "GROQ_MODEL_FALLBACK", "openai/gpt-oss-20b"),
            concurrency=getattr(settings, "GROQ_MAX_CONCURRENT_REQUESTS", 3),
        )
    return _client


def _get_semaphore() -> asyncio.Semaphore:
    """Get or create the concurrency-bounding semaphore."""
    global _semaphore
    if _semaphore is None:
        limit = getattr(settings, "GROQ_MAX_CONCURRENT_REQUESTS", 3)
        _semaphore = asyncio.Semaphore(limit)
    return _semaphore


async def close_groq_client() -> None:
    """Close the singleton client."""
    global _client, _semaphore
    if _client is not None:
        await _client.close()
        _client = None
    _semaphore = None


# ─── Core Rate-Limit Aware API Call ────────────────────────────────

async def generate_json(
    system_prompt: str,
    user_prompt: str,
    model: str | None = None,
    max_retries: int | None = None,
    timeout_seconds: float | None = None,
    temperature: float = 0.1,
    max_tokens: int | None = None,
    agent_role: str = "general",
) -> dict[str, Any]:
    """Generate a validated JSON response from Groq with rate-limit aware scheduling and fallback.

    Args:
        system_prompt: System message for the LLM.
        user_prompt: User message for the LLM.
        model: Model identifier override (defaults to GROQ_MODEL_PRIMARY).
        max_retries: Maximum attempts per model.
        timeout_seconds: Per-request timeout.
        temperature: Sampling temperature.
        max_tokens: Output token boundary for token efficiency.
        agent_role: Specialist agent role identifier for safe telemetry.

    Returns:
        Parsed JSON dictionary.
    """
    primary_model = model or getattr(settings, "GROQ_MODEL_PRIMARY", settings.GROQ_MODEL)
    fallback_model = getattr(settings, "GROQ_MODEL_FALLBACK", "openai/gpt-oss-20b")

    if max_retries is None:
        max_retries = getattr(settings, "GROQ_MAX_RETRIES", 3)
    if timeout_seconds is None:
        timeout_seconds = getattr(settings, "GROQ_REQUEST_TIMEOUT_SECONDS", 30.0)

    client = get_groq_client()
    semaphore = _get_semaphore()

    # Ensure "json" keyword is present in system prompt to satisfy Groq JSON mode
    if "json" not in system_prompt.lower():
        system_prompt = system_prompt + "\n\nRespond with valid JSON format."

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt},
    ]

    models_to_try = [primary_model]
    if fallback_model and fallback_model != primary_model:
        models_to_try.append(fallback_model)

    overall_start = time.monotonic()
    last_error: Exception | None = None

    for model_idx, active_model in enumerate(models_to_try):
        is_fallback = model_idx > 0
        attempts_for_this_model = max_retries if not is_fallback else 1

        for attempt in range(1, attempts_for_this_model + 1):
            telemetry = LLMTelemetry(
                agent_role=agent_role,
                model_identifier=active_model,
                start_time=time.monotonic(),
                retry_attempt=attempt,
                fallback_used=is_fallback,
            )

            try:
                # Bounded concurrency: wait for permit
                async with semaphore:
                    # Enforce per-agent max_tokens if supplied
                    create_kwargs: dict[str, Any] = {
                        "messages": messages,
                        "model": active_model,
                        "response_format": {"type": "json_object"},
                        "temperature": temperature,
                    }
                    if max_tokens:
                        create_kwargs["max_tokens"] = max_tokens

                    # Support both with_raw_response and direct create (e.g. in unit tests)
                    use_raw = False
                    if hasattr(client.chat.completions, "with_raw_response"):
                        raw_attr = getattr(client.chat.completions, "with_raw_response", None)
                        create_fn = getattr(client.chat.completions, "create", None)
                        raw_create = getattr(raw_attr, "create", None) if raw_attr else None
                        import types
                        if isinstance(create_fn, types.FunctionType):
                            use_raw = False
                        elif raw_create is not None:
                            use_raw = True

                    if use_raw:
                        raw_resp = await asyncio.wait_for(
                            client.chat.completions.with_raw_response.create(**create_kwargs),
                            timeout=timeout_seconds,
                        )
                        if hasattr(raw_resp, "parse"):
                            res = raw_resp.parse()
                            response = await res if asyncio.iscoroutine(res) else res
                        else:
                            response = raw_resp
                    else:
                        response = await asyncio.wait_for(
                            client.chat.completions.create(**create_kwargs),
                            timeout=timeout_seconds,
                        )

                content = response.choices[0].message.content
                if not content:
                    raise ValueError("Empty response content received from Groq API")

                parsed = json.loads(content)

                usage = response.usage
                telemetry.end_time = time.monotonic()
                telemetry.duration_ms = (telemetry.end_time - telemetry.start_time) * 1000
                telemetry.input_tokens = getattr(usage, "prompt_tokens", 0) or 0
                telemetry.output_tokens = getattr(usage, "completion_tokens", 0) or 0
                telemetry.total_tokens = getattr(usage, "total_tokens", 0) or 0
                telemetry.status = "success"

                # Log safe metrics only
                logger.info(
                    "groq_request_success",
                    role=telemetry.agent_role,
                    model=telemetry.model_identifier,
                    duration_ms=round(telemetry.duration_ms, 2),
                    input_tokens=telemetry.input_tokens,
                    output_tokens=telemetry.output_tokens,
                    attempt=telemetry.retry_attempt,
                    fallback=telemetry.fallback_used,
                )

                return parsed

            except Exception as e:
                last_error = e
                telemetry.end_time = time.monotonic()
                telemetry.duration_ms = (telemetry.end_time - telemetry.start_time) * 1000
                error_type = _classify_error(e)
                telemetry.error_category = error_type

                is_perm = _is_permanent(e)
                retryable = _is_retryable(e) and not is_perm

                if error_type == "RATE_LIMITED":
                    telemetry.status = "rate_limited"
                elif error_type == "TIMEOUT":
                    telemetry.status = "timeout"
                else:
                    telemetry.status = "failed"

                logger.warning(
                    "groq_request_error",
                    role=telemetry.agent_role,
                    model=telemetry.model_identifier,
                    error_type=error_type,
                    attempt=attempt,
                    retryable=retryable,
                    duration_ms=round(telemetry.duration_ms, 2),
                    fallback=is_fallback,
                )

                # Permanent errors fail immediately without retrying or fallback
                if is_perm:
                    raise RuntimeError(
                        f"Permanent error in Groq call for {agent_role} using {active_model}: {e}"
                    ) from e

                # If this model has attempts remaining, compute smart delay
                if attempt < attempts_for_this_model and retryable:
                    headers = getattr(e, "response", None) and getattr(e.response, "headers", None)
                    reset_delay = _extract_retry_delay(e, headers)

                    if reset_delay is not None:
                        # Use exact header reset delay + jitter
                        wait_time = min(reset_delay + random.uniform(0.1, 0.4), 20.0)
                    else:
                        # Bounded exponential backoff with jitter
                        wait_time = min(1.5 * (2 ** (attempt - 1)) + random.uniform(0.1, 0.5), 15.0)

                    logger.info(
                        "groq_scheduled_retry",
                        role=agent_role,
                        model=active_model,
                        attempt=attempt,
                        wait_time_sec=round(wait_time, 2),
                        cause=error_type,
                    )
                    await asyncio.sleep(wait_time)
                    continue

                # If attempts exhausted for this model, break out to try fallback
                break

        # Log transition to fallback model if available
        if not is_fallback and len(models_to_try) > 1:
            logger.warning(
                "groq_activating_model_fallback",
                role=agent_role,
                from_model=primary_model,
                to_model=fallback_model,
                primary_error=str(last_error)[:120],
            )

    # Both primary and fallback models exhausted
    total_latency_ms = (time.monotonic() - overall_start) * 1000
    error_type = _classify_error(last_error) if last_error else "UNKNOWN_ERROR"

    logger.error(
        "groq_all_models_exhausted",
        role=agent_role,
        models_attempted=models_to_try,
        last_error_type=error_type,
        total_latency_ms=round(total_latency_ms, 2),
    )

    raise RuntimeError(
        f"Groq API call for {agent_role} failed after exhausting all configured models ({models_to_try}). "
        f"Error type: {error_type}. Last error: {last_error}"
    ) from last_error


async def check_groq_config() -> dict[str, Any]:
    """Check Groq configuration status and return safe parameters."""
    api_key = settings.GROQ_API_KEY
    primary = getattr(settings, "GROQ_MODEL_PRIMARY", settings.GROQ_MODEL)
    fallback = getattr(settings, "GROQ_MODEL_FALLBACK", "openai/gpt-oss-20b")
    return {
        "configured": bool(api_key),
        "model": primary,
        "fast_model": fallback,
        "primary_model": primary,
        "fallback_model": fallback,
        "max_concurrent": getattr(settings, "GROQ_MAX_CONCURRENT_REQUESTS", 3),
        "max_retries": getattr(settings, "GROQ_MAX_RETRIES", 3),
        "api_key_status": "configured" if api_key else "not configured",
    }
