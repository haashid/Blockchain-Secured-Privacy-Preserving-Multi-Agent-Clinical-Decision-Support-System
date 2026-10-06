"""Structured logging configuration."""

import logging
import sys
from typing import Any

import structlog


def redact_sensitiveProcessor(
    logger: Any, method_name: str, event_dict: dict[str, Any]
) -> dict[str, Any]:
    """Redact sensitive fields from log output."""
    SENSITIVE_KEYS = {"password", "secret", "api_key", "token", "private_key", "encryption_key"}
    for key in list(event_dict.keys()):
        if key.lower() in SENSITIVE_KEYS:
            event_dict[key] = "***REDACTED***"
        if isinstance(event_dict[key], dict):
            for subkey in list(event_dict[key].keys()):
                if subkey.lower() in SENSITIVE_KEYS:
                    event_dict[key][subkey] = "***REDACTED***"
    return event_dict


def setup_logging(log_level: str = "INFO") -> None:
    """Configure structured logging with structlog."""
    structlog.configure(
        processors=[
            structlog.contextvars.merge_contextvars,
            structlog.processors.add_log_level,
            structlog.processors.StackInfoRenderer(),
            structlog.dev.set_exc_info,
            structlog.processors.TimeStamper(fmt="iso"),
            redact_sensitiveProcessor,
            structlog.processors.JSONRenderer(),
        ],
        wrapper_class=structlog.make_filtering_bound_logger(
            getattr(logging, log_level.upper(), logging.INFO)
        ),
        context_class=dict,
        logger_factory=structlog.PrintLoggerFactory(file=sys.stdout),
        cache_logger_on_first_use=True,
    )


def get_logger(name: str | None = None) -> structlog.stdlib.BoundLogger:
    """Get a structured logger."""
    return structlog.get_logger(name)
