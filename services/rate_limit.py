"""In-process sliding-window rate limiting to blunt abuse and DoS.

Dependency-free and suitable for a single app instance (Render free/standard,
one Docker container). For horizontally scaled deployments, back this with a
shared store (Redis) instead — see ``_Bucket`` for the swap point.

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
from collections import deque
from typing import Deque, Dict, Tuple

from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import Response


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
}

# Hard ceiling on any single request body, in bytes (default 12 MB).
MAX_BODY_BYTES = _int_env("MAX_REQUEST_BODY_BYTES", 12 * 1024 * 1024)

_EXPENSIVE_PREFIXES = (
    "/api/generate",
    "/api/regenerate-pptx",
    "/generate-image",
    "/api/upload",
    "/api/saved-posters",
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


def _tier_for(path: str, method: str) -> str:
    for prefix in _EXEMPT_PREFIXES:
        if path.startswith(prefix):
            return ""  # exempt
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
            # Cheap, collision-resistant enough for bucketing; no verification
            # here (the auth guard handles that). Use a short slice of the token.
            return "tok:" + token[-24:]

    forwarded = (request.headers.get("x-forwarded-for") or "").split(",")[0].strip()
    if forwarded:
        return "ip:" + forwarded
    client = request.client
    return "ip:" + (client.host if client else "unknown")


class _Bucket:
    """Sliding-window request log per (key, tier)."""

    __slots__ = ("hits",)

    def __init__(self) -> None:
        self.hits: Deque[float] = deque()


class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app) -> None:
        super().__init__(app)
        self._buckets: Dict[Tuple[str, str], _Bucket] = {}
        self._lock = threading.Lock()
        self._last_sweep = time.monotonic()
        self._enabled = (os.environ.get("RATE_LIMIT_ENABLED", "1").strip() != "0")

    def _sweep(self, now: float) -> None:
        # Drop empty/idle buckets occasionally to bound memory.
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

    def _check(self, key: str, tier: str, now: float) -> Tuple[bool, int]:
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

        now = time.monotonic()
        allowed, retry_after = self._check(_client_key(request), tier, now)
        if not allowed:
            return Response(
                content='{"detail":"Too many requests. Please slow down."}',
                status_code=429,
                media_type="application/json",
                headers={"Retry-After": str(retry_after)},
            )
        return await call_next(request)
