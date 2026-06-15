"""Shared Redis client (Render Key Value / Valkey). Optional — unset REDIS_URL for local dev."""

from __future__ import annotations

import logging
import os
from typing import Any, Optional

logger = logging.getLogger(__name__)

_client: Any = None
_init_failed = False


def redis_url() -> str:
    return os.environ.get("REDIS_URL", "").strip()


def redis_enabled() -> bool:
    return bool(redis_url())


def get_redis() -> Optional[Any]:
    """Return a shared Redis client, or None when unavailable."""
    global _client, _init_failed

    if not redis_enabled():
        return None
    if _init_failed:
        return None
    if _client is not None:
        return _client

    try:
        import redis

        _client = redis.Redis.from_url(
            redis_url(),
            decode_responses=True,
            socket_connect_timeout=2.0,
            socket_timeout=2.0,
            health_check_interval=30,
        )
        _client.ping()
        return _client
    except Exception as exc:
        _init_failed = True
        logger.warning("Redis unavailable (%s); using in-process fallbacks.", exc)
        return None


def close_redis() -> None:
    """Release the connection pool (tests / graceful shutdown)."""
    global _client, _init_failed
    if _client is not None:
        try:
            _client.close()
        except Exception:
            pass
    _client = None
    _init_failed = False
