"""Sliding-window rate limiting to blunt abuse and DoS.

Uses Redis (Render Key Value) when ``REDIS_URL`` is set; otherwise an in-process
deque per instance. For horizontally scaled deployments, configure Redis so limits
are shared across all app instances.

Limits are tiered by route cost:
  * ``auth``        — token/identity probing (cheap to us, but abused for enumeration)
  * ``expensive``   — AI generation, PPTX builds, uploads (CPU / paid API cost)
  * ``api``         — general JSON API
  * ``default``     — everything else (pages, static)

Each tier is "N requests per WINDOW seconds" keyed by client identity
(authenticated user id when available, otherwise client IP).
"""

from __future__ import annotations

import os
import threading
import time
import uuid
from collections import deque
from typing import Deque, Dict, Optional, Tuple

from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import Response

from services.redis_client import get_redis

_KEY_PREFIX = "verbum:rl:"

_RATE_LIMIT_LUA = """
local key = KEYS[1]
local now = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])
local member = ARGV[4]

redis.call('ZREMRANGEBYSCORE', key, '-inf', now - window)
local count = redis.call('ZCARD', key)
if count >= limit then
  local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
  if oldest[2] then
    return {0, math.ceil(oldest[2] + window - now)}
  end
  return {0, math.ceil(window)}
end
redis.call('ZADD', key, now, member)
redis.call('EXPIRE', key, math.ceil(window) + 1)
return {1, 0}
"""


def _int_env(name: str, default: int) -> int:
    try:
        return max(1, int(os.environ.get(name, "").strip() or default))
    except (TypeError, ValueError):
        return default


# Tier limits: (max_requests, window_seconds). Override via env.
_TIERS: Dict[str, Tuple[int, int]] = {
    "auth": (_int_env("RATE_LIMIT_AUTH_MAX", 30), _int_env("RATE_LIMIT_AUTH_WINDOW", 60)),
    "expensive": (
        _int_env("RATE_LIMIT_EXPENSIVE_MAX", 20),
        _int_env("RATE_LIMIT_EXPENSIVE_WINDOW", 60),
    ),
    "api": (_int_env("RATE_LIMIT_API_MAX", 120), _int_env("RATE_LIMIT_API_WINDOW", 60)),
    "default": (
        _int_env("RATE_LIMIT_DEFAULT_MAX", 300),
        _int_env("RATE_LIMIT_DEFAULT_WINDOW", 60),
    ),
    "practice": (
        _int_env("RATE_LIMIT_PRACTICE_MAX", 40),
        _int_env("RATE_LIMIT_PRACTICE_WINDOW", 60),
    ),
    "practice_page": (
        _int_env("RATE_LIMIT_PRACTICE_PAGE_MAX", 60),
        _int_env("RATE_LIMIT_PRACTICE_PAGE_WINDOW", 60),
    ),
    "practice_pin": (
        _int_env("RATE_LIMIT_PRACTICE_PIN_MAX", 8),
        _int_env("RATE_LIMIT_PRACTICE_PIN_WINDOW", 900),
    ),
    "practice_token": (
        _int_env("RATE_LIMIT_PRACTICE_TOKEN_MAX", 240),
        _int_env("RATE_LIMIT_PRACTICE_TOKEN_WINDOW", 3600),
    ),
    "practice_create": (
        _int_env("RATE_LIMIT_PRACTICE_CREATE_MAX", 12),
        _int_env("RATE_LIMIT_PRACTICE_CREATE_WINDOW", 3600),
    ),
    "catalog_lyrics": (
        _int_env("CATALOG_LYRIC_FETCH_MAX", 60),
        _int_env("CATALOG_LYRIC_FETCH_WINDOW", 3600),
    ),
}

# Hard ceiling on any single request body, in bytes (default 12 MB).
MAX_BODY_BYTES = _int_env("MAX_REQUEST_BODY_BYTES", 12 * 1024 * 1024)

_EXPENSIVE_PREFIXES = (
    "/api/generate",
    "/api/regenerate-pptx",
    "/api/preview",
    "/api/ppt-preview/refresh",
    "/api/design/analyze-template",
    "/generate-image",
    "/api/upload",
    "/api/saved-posters",
    "/api/saved-media",
    "/api/design/import-pptx",
)

_AUTH_PREFIXES = (
    "/api/auth",
    "/sign-in",
    "/sign-up",
)

# Paths that should never be rate limited (health checks, static assets).
_EXEMPT_PREFIXES = (
    "/health",
    "/static/",
    "/favicon",
)


_PRACTICE_PREFIXES = (
    "/api/practice/",
    "/practice/",
)


def _tier_for(path: str, method: str) -> str:
    for prefix in _EXEMPT_PREFIXES:
        if path.startswith(prefix):
            return ""  # exempt
    if any(path == p or path.startswith(p) for p in _PRACTICE_PREFIXES):
        if path.startswith("/practice/"):
            return "practice_page"
        return "practice"
    if any(path == p or path.startswith(p) for p in _AUTH_PREFIXES):
        return "auth"
    if method.upper() not in {"GET", "HEAD", "OPTIONS"} and any(
        path == p or path.startswith(p) for p in _EXPENSIVE_PREFIXES
    ):
        return "expensive"
    if path.startswith("/api/"):
        return "api"
    return "default"


def _client_key(request: Request) -> str:
    # Prefer the authenticated subject so a single bad actor cannot exhaust a
    # shared NAT IP's budget for everyone behind it.
    auth = request.headers.get("authorization") or ""
    if auth.lower().startswith("bearer "):
        token = auth[7:].strip()
        if token:
            return "tok:" + token[-24:]

    if os.environ.get("RENDER") or os.environ.get("RENDER_EXTERNAL_URL"):
        client = request.client
        if client and client.host:
            return "ip:" + client.host

    forwarded = (request.headers.get("x-forwarded-for") or "").split(",")[0].strip()
    if forwarded:
        return "ip:" + forwarded
    client = request.client
    return "ip:" + (client.host if client else "unknown")


def _redis_key(tier: str, client_key: str) -> str:
    return f"{_KEY_PREFIX}{tier}:{client_key}"


class _Bucket:
    """Sliding-window request log per (key, tier) — single-instance fallback."""

    __slots__ = ("hits",)

    def __init__(self) -> None:
        self.hits: Deque[float] = deque()


class _InMemoryRateLimiter:
    def __init__(self) -> None:
        self._buckets: Dict[Tuple[str, str], _Bucket] = {}
        self._lock = threading.Lock()
        self._last_sweep = time.monotonic()

    def _sweep(self, now: float) -> None:
        if now - self._last_sweep < 120:
            return
        self._last_sweep = now
        stale: list[Tuple[str, str]] = []
        for key, bucket in self._buckets.items():
            window = _TIERS[key[1]][1]
            while bucket.hits and bucket.hits[0] <= now - window:
                bucket.hits.popleft()
            if not bucket.hits:
                stale.append(key)
        for key in stale:
            self._buckets.pop(key, None)

    def check(self, key: str, tier: str, now: float) -> Tuple[bool, int]:
        max_req, window = _TIERS[tier]
        bucket_key = (key, tier)
        with self._lock:
            bucket = self._buckets.get(bucket_key)
            if bucket is None:
                bucket = _Bucket()
                self._buckets[bucket_key] = bucket
            cutoff = now - window
            hits = bucket.hits
            while hits and hits[0] <= cutoff:
                hits.popleft()
            if len(hits) >= max_req:
                retry_after = int(hits[0] + window - now) + 1
                return False, max(1, retry_after)
            hits.append(now)
            self._sweep(now)
            return True, 0


class _RedisRateLimiter:
    def __init__(self) -> None:
        self._script = None
        self._fallback = _InMemoryRateLimiter()

    def _eval(self, key: str, tier: str, now: float) -> Optional[Tuple[bool, int]]:
        client = get_redis()
        if client is None:
            return None
        max_req, window = _TIERS[tier]
        if self._script is None:
            self._script = client.register_script(_RATE_LIMIT_LUA)
        member = f"{now}:{uuid.uuid4().hex[:8]}"
        allowed, retry_after = self._script(
            keys=[_redis_key(tier, key)],
            args=[now, window, max_req, member],
        )
        return bool(int(allowed)), max(1, int(retry_after))

    def check(self, key: str, tier: str, now: float) -> Tuple[bool, int]:
        try:
            result = self._eval(key, tier, now)
            if result is not None:
                return result
        except Exception:
            pass
        return self._fallback.check(key, tier, time.monotonic())


_memory_limiter = _InMemoryRateLimiter()
_redis_limiter = _RedisRateLimiter()


def _check_rate_limit(key: str, tier: str) -> Tuple[bool, int]:
    if get_redis() is not None:
        return _redis_limiter.check(key, tier, time.time())
    return _memory_limiter.check(key, tier, time.monotonic())


def check_rate_limit_key(key: str, tier: str) -> Tuple[bool, int]:
    """Check a custom bucket key against a named tier (for route-specific limits)."""
    if tier not in _TIERS:
        tier = "api"
    return _check_rate_limit(key, tier)


class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app) -> None:
        super().__init__(app)
        self._enabled = (os.environ.get("RATE_LIMIT_ENABLED", "1").strip() != "0")

    async def dispatch(
        self, request: Request, call_next: RequestResponseEndpoint
    ) -> Response:
        if not self._enabled:
            return await call_next(request)

        # Reject oversized bodies before they are buffered/processed.
        content_length = request.headers.get("content-length")
        if content_length:
            try:
                if int(content_length) > MAX_BODY_BYTES:
                    return Response(
                        content='{"detail":"Request body too large."}',
                        status_code=413,
                        media_type="application/json",
                    )
            except ValueError:
                pass

        tier = _tier_for(request.url.path, request.method)
        if not tier:
            return await call_next(request)

        allowed, retry_after = _check_rate_limit(_client_key(request), tier)
        if not allowed:
            return Response(
                content='{"detail":"Too many requests. Please slow down."}',
                status_code=429,
                media_type="application/json",
                headers={"Retry-After": str(retry_after)},
            )
        return await call_next(request)
