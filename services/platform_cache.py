"""Short-lived Redis/in-process cache for platform reads."""

from __future__ import annotations

import json
import logging
import threading
import time
from typing import Any, Callable, Optional, TypeVar

from services.redis_client import get_redis

logger = logging.getLogger(__name__)

T = TypeVar("T")

_mem_lock = threading.Lock()
_mem_cache: dict[str, tuple[float, str]] = {}


def cache_get_json(key: str) -> Optional[Any]:
    client = get_redis()
    if client is not None:
        try:
            raw = client.get(key)
            if raw:
                return json.loads(raw)
        except Exception as exc:
            logger.debug("platform_cache redis get %s: %s", key, exc)
    with _mem_lock:
        row = _mem_cache.get(key)
        if not row:
            return None
        expires_at, payload = row
        if time.monotonic() >= expires_at:
            _mem_cache.pop(key, None)
            return None
        try:
            return json.loads(payload)
        except json.JSONDecodeError:
            return None


def cache_set_json(key: str, value: Any, *, ttl_s: int) -> None:
    payload = json.dumps(value, ensure_ascii=False, separators=(",", ":"))
    client = get_redis()
    if client is not None:
        try:
            client.setex(key, max(1, int(ttl_s)), payload)
            return
        except Exception as exc:
            logger.debug("platform_cache redis set %s: %s", key, exc)
    with _mem_lock:
        _mem_cache[key] = (time.monotonic() + max(1, int(ttl_s)), payload)


def cached_call(
    key: str,
    ttl_s: int,
    loader: Callable[[], T],
) -> T:
    hit = cache_get_json(key)
    if hit is not None:
        return hit  # type: ignore[return-value]
    value = loader()
    try:
        cache_set_json(key, value, ttl_s=ttl_s)
    except (TypeError, ValueError):
        pass
    return value
