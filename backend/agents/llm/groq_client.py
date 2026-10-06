"""Reusable async Groq client with bounded retries, error classification, and structured result metadata."""

from __future__ import annotations

import asyncio
import json
import time
from dataclasses import dataclass, field
from typing import Any

import groq
from groq import AsyncGroq

from backend.core.config import get_settings
from backend.core.logging_config import get_logger

logger = get_logger("groq_client")
settings = get_settings()

# Singleton async client
_client: AsyncGroq | None = None


# ─── Error Classification ──────────────────────────────────────────

RETRYABLE_ERRORS: tuple[type[Exception], ...] = (
    groq.RateLimitError,          # 429
    groq.InternalServerError,     # 500
    groq.APIConnectionError,      # connection failure
    groq.APITimeoutError,         # timeout
    groq.APIStatusError,          # generic status (may be transient)
)

PERMANENT_ERRORS: tuple[type[Exception], ...] = (
    groq.AuthenticationError,     # 401
    groq.PermissionDeniedError,   # 403
    groq.NotFoundError,           # 404
    groq.BadRequestError,         # 400
)


def _is_retryable(exc: Exception) -> bool:
    """Determine if an error is transient and worth retrying."""
    # Permanent errors are never retryable, even if they inherit from a retryable class
    if _is_permanent(exc):
        return False
    if isinstance(exc, RETRYABLE_ERRORS):
        return True
    if isinstance(exc, groq.APIStatusError):
        # 429, 500, 502, 503, 504 are retryable
        return exc.status_code in (429, 500, 502, 503, 504)
    return False


def _is_permanent(exc: Exception) -> bool:
    """Determine if an error is permanent and will not resolve with retries."""
    return isinstance(exc, PERMANENT_ERRORS)


def _classify_error(exc: Exception) -> str:
    """Return a human-readable error type string."""
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


# ─── Structured Result ─────────────────────────────────────────────

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


@dataclass
class GroqError:
    """Structured error from a failed Groq API call."""
    error_type: str
    message: str
    status_code: int | None = None
    retryable: bool = False
    attempts_made: int = 0


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
        _client = AsyncGroq(
            api_key=api_key,
            timeout=60.0,  # 60-second request timeout
            max_retries=0,  # We handle retries ourselves for fine-grained control
        )
        logger.info("groq_client_initialized", model=settings.GROQ_MODEL)
    return _client


async def close_groq_client() -> None:
    """Close the singleton client."""
    global _client
    if _client is not None:
        await _client.close()
        _client = None


# ─── Core API Call ──────────────────────────────────────────────────

async def generate_json(
    system_prompt: str,
    user_prompt: str,
    model: str | None = None,
    max_retries: int = 5,
    timeout_seconds: float = 60.0,
    temperature: float = 0.1,
) -> dict[str, Any]:
    """Generate a JSON response from Groq LLM with retries and structured error handling.

    Args:
        system_prompt: System message for the LLM.
        user_prompt: User message for the LLM.
        model: Model ID to use (defaults to settings.GROQ_MODEL).
        max_retries: Maximum number of retry attempts (bounded).
        timeout_seconds: Per-request timeout.
        temperature: Sampling temperature.

    Returns:
        Parsed JSON dict from the LLM response.

    Raises:
        RuntimeError: With structured error info if all retries exhausted.
    """
    model = model or settings.GROQ_MODEL
    client = get_groq_client()

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt},
    ]

    last_error: Exception | None = None
    total_start = time.monotonic()

    # Increase retries for rate limits specifically
    effective_retries = max_retries
    for attempt in range(1, effective_retries + 1):
        attempt_start = time.monotonic()
        try:
            logger.info(
                "groq_api_call",
                model=model,
                attempt=attempt,
                max_retries=max_retries,
            )

            response = await asyncio.wait_for(
                client.chat.completions.create(
                    messages=messages,
                    model=model,
                    response_format={"type": "json_object"},
                    temperature=temperature,
                ),
                timeout=timeout_seconds,
            )

            content = response.choices[0].message.content
            if not content:
                raise ValueError("Empty response content from Groq API")

            # Parse JSON
            parsed = json.loads(content)

            # Extract usage metadata (may not be available)
            usage = response.usage
            latency_ms = (time.monotonic() - attempt_start) * 1000

            result = GroqResult(
                content=content,
                model=response.model or model,
                input_tokens=getattr(usage, "prompt_tokens", 0) or 0,
                output_tokens=getattr(usage, "completion_tokens", 0) or 0,
                total_tokens=getattr(usage, "total_tokens", 0) or 0,
                latency_ms=latency_ms,
                finish_reason=response.choices[0].finish_reason or "",
                raw_json=parsed,
            )

            logger.info(
                "groq_api_success",
                model=result.model,
                input_tokens=result.input_tokens,
                output_tokens=result.output_tokens,
                latency_ms=round(result.latency_ms, 2),
                attempt=attempt,
            )

            return parsed

        except Exception as e:
            last_error = e
            attempt_ms = (time.monotonic() - attempt_start) * 1000
            error_type = _classify_error(e)
            retryable = _is_retryable(e) and not _is_permanent(e)

            logger.warning(
                "groq_api_error",
                error_type=error_type,
                error_msg=str(e)[:200],
                attempt=attempt,
                max_retries=max_retries,
                retryable=retryable,
                latency_ms=round(attempt_ms, 2),
            )

            # Do not retry permanent errors
            if _is_permanent(e):
                break

            # Retry with exponential backoff for retryable errors
            if attempt < effective_retries and retryable:
                if isinstance(e, groq.RateLimitError):
                    # More aggressive backoff for rate limits
                    wait_time = min(3 * (2 ** (attempt - 1)), 60)
                else:
                    wait_time = min(2 ** attempt, 30)
                logger.info(
                    "groq_retrying",
                    wait_time=round(wait_time, 1),
                    error_type=error_type,
                )
                await asyncio.sleep(wait_time)

    # All retries exhausted
    total_ms = (time.monotonic() - total_start) * 1000
    error_type = _classify_error(last_error) if last_error else "UNKNOWN_ERROR"

    logger.error(
        "groq_failed_all_retries",
        error_type=error_type,
        error_msg=str(last_error)[:200] if last_error else "No error recorded",
        total_attempts=effective_retries,
        total_latency_ms=round(total_ms, 2),
    )

    raise RuntimeError(
        f"Groq API failed after {effective_retries} attempts. "
        f"Error type: {error_type}. "
        f"Last error: {last_error}"
    ) from last_error


async def check_groq_config() -> dict[str, Any]:
    """Check if Groq configuration is valid without making a real API call.

    Returns:
        Dict with 'configured' (bool) and 'model' (str) and 'fast_model' (str).
    """
    api_key = settings.GROQ_API_KEY
    return {
        "configured": bool(api_key),
        "model": settings.GROQ_MODEL,
        "fast_model": settings.GROQ_FAST_MODEL,
        "api_key_status": "configured" if api_key else "not configured",
    }
