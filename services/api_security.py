"""API security: auth sessions, middleware, and route protection."""

from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Annotated, Optional

from fastapi import Depends, Header, HTTPException, Request, Response
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint

from services.auth_config import auth_enabled
from services.supabase_auth import AuthUser, require_auth_user, verify_supabase_token
from services.user_church_context import clear_church_profile, set_church_profile


@dataclass(frozen=True)
class AuthSession:
    user: AuthUser
    token: str


def _extract_bearer(authorization: Optional[str]) -> Optional[str]:
    if not authorization:
        return None
    parts = authorization.split(" ", 1)
    if len(parts) != 2 or parts[0].lower() != "bearer":
        return None
    token = parts[1].strip()
    return token or None


async def optional_session(
    authorization: Annotated[Optional[str], Header()] = None,
) -> Optional[AuthSession]:
    if not auth_enabled():
        return None
    token = _extract_bearer(authorization)
    if not token:
        return None
    user = verify_supabase_token(token)
    return AuthSession(user=user, token=token)


async def require_session(
    authorization: Annotated[Optional[str], Header()] = None,
) -> Optional[AuthSession]:
    """Require Supabase session when auth is enabled; otherwise return None."""
    if not auth_enabled():
        return None
    user = await require_auth_user(authorization)
    token = _extract_bearer(authorization) or ""
    return AuthSession(user=user, token=token)


async def require_session_when_auth(
    authorization: Annotated[Optional[str], Header()] = None,
) -> Optional[AuthSession]:
    """Require a session when auth is enabled; otherwise allow anonymous use."""
    session = await optional_session(authorization)
    if auth_enabled() and not session:
        raise HTTPException(status_code=401, detail="Sign in required.")
    return session


# Mutating API routes that must not be anonymous when auth is configured.
PROTECTED_API_PREFIXES: tuple[str, ...] = (
    "/api/generate",
    "/api/regenerate-pptx",
    "/api/community",
    "/api/settings/",
    "/api/upload",
    "/api/saved-posters",
    "/api/catalog/songs",
    "/api/songs/",
    "/api/lyrics/",
    "/api/design/",
    "/generate-image",
)


def _is_protected_api(path: str, method: str) -> bool:
    if method.upper() in {"GET", "HEAD", "OPTIONS"}:
        # Read-only catalog/community remain public for liturgy browsing.
        if path.startswith("/api/catalog/songs") and method.upper() == "GET":
            return False
        if path == "/api/community" and method.upper() == "GET":
            return auth_enabled()
        if path.startswith("/api/settings/gemini-api-key") and method.upper() == "GET":
            return False
        return False
    return any(path == prefix or path.startswith(prefix) for prefix in PROTECTED_API_PREFIXES)


class UserChurchMiddleware(BaseHTTPMiddleware):
    """Load the signed-in user's church profile for this request."""

    async def dispatch(
        self, request: Request, call_next: RequestResponseEndpoint
    ) -> Response:
        clear_church_profile()
        if auth_enabled():
            token = _extract_bearer(request.headers.get("authorization"))
            if token:
                try:
                    user = verify_supabase_token(token)
                    from services.supabase_client import get_church_profile

                    profile = get_church_profile(user.user_id, access_token=token)
                    set_church_profile(profile)
                except HTTPException:
                    pass
        try:
            return await call_next(request)
        finally:
            clear_church_profile()


class AuthGuardMiddleware(BaseHTTPMiddleware):
    async def dispatch(
        self, request: Request, call_next: RequestResponseEndpoint
    ) -> Response:
        if auth_enabled() and _is_protected_api(request.url.path, request.method):
            token = _extract_bearer(request.headers.get("authorization"))
            if not token:
                return Response(
                    content='{"detail":"Sign in required."}',
                    status_code=401,
                    media_type="application/json",
                )
            try:
                verify_supabase_token(token)
            except HTTPException as exc:
                detail = exc.detail if isinstance(exc.detail, str) else str(exc.detail)
                return Response(
                    content=json.dumps({"detail": detail}),
                    status_code=exc.status_code,
                    media_type="application/json",
                )
        return await call_next(request)


# Content-Security-Policy. The app loads the Supabase JS SDK from jsDelivr and
# talks to the Supabase REST/Auth host, so those origins are allowlisted.
# 'unsafe-inline' is required for the inline <script>/<style> blocks in the
# templates; tighten with nonces if those are refactored out.
def _build_csp() -> str:
    from services.auth_config import supabase_url

    connect = ["'self'", "https://*.supabase.co", "https://*.supabase.in"]
    sb = supabase_url()
    if sb:
        connect.append(sb)
    return "; ".join(
        [
            "default-src 'self'",
            "base-uri 'self'",
            "object-src 'none'",
            "frame-ancestors 'none'",
            "form-action 'self'",
            "img-src 'self' data: blob: https:",
            "font-src 'self' https://fonts.gstatic.com data:",
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
            "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net",
            "connect-src " + " ".join(dict.fromkeys(connect)),
        ]
    )


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    def __init__(self, app) -> None:
        super().__init__(app)
        self._csp = _build_csp()

    async def dispatch(
        self, request: Request, call_next: RequestResponseEndpoint
    ) -> Response:
        response = await call_next(request)
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("X-Frame-Options", "DENY")
        response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
        response.headers.setdefault(
            "Permissions-Policy",
            "camera=(), microphone=(), geolocation=(), interest-cohort=()",
        )
        response.headers.setdefault("Content-Security-Policy", self._csp)
        response.headers.setdefault("X-Permitted-Cross-Domain-Policies", "none")
        response.headers.setdefault("Cross-Origin-Opener-Policy", "same-origin")
        if request.url.scheme == "https":
            response.headers.setdefault(
                "Strict-Transport-Security",
                "max-age=31536000; includeSubDomains",
            )
        return response


def register_security_middleware(app) -> None:
    from services.rate_limit import RateLimitMiddleware

    # Middleware runs in reverse registration order for the request path, so the
    # rate limiter (added last) executes first — rejecting floods before any
    # auth, DB, or business logic runs.
    app.add_middleware(SecurityHeadersMiddleware)
    app.add_middleware(UserChurchMiddleware)
    app.add_middleware(AuthGuardMiddleware)
    app.add_middleware(RateLimitMiddleware)
