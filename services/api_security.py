"""API security: auth sessions, middleware, and route protection."""

from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Optional

from fastapi import HTTPException, Request, Response
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint

from services.auth_config import auth_enabled
from services.supabase_auth import AuthUser, verify_supabase_token
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


async def optional_session(request: Request) -> Optional[AuthSession]:
    if not auth_enabled():
        return None
    return getattr(request.state, "auth_session", None)


async def require_session(request: Request) -> Optional[AuthSession]:
    """Require Supabase session when auth is enabled; otherwise return None."""
    if not auth_enabled():
        return None
    session = await optional_session(request)
    if not session:
        raise HTTPException(status_code=401, detail="Sign in required.")
    return session


async def require_session_when_auth(request: Request) -> Optional[AuthSession]:
    """Require a session when auth is enabled; otherwise allow anonymous use."""
    session = await optional_session(request)
    if auth_enabled() and not session:
        raise HTTPException(status_code=401, detail="Sign in required.")
    return session


async def require_approved_membership(request: Request) -> Optional[AuthSession]:
    """Require superadmin (full app access) when auth is enabled."""
    return await require_superadmin(request)


async def require_superadmin(request: Request) -> Optional[AuthSession]:
    """Only superadmin emails may use protected parish/Mass features when auth is on."""
    from services.membership_config import is_superadmin_user

    session = await require_session_when_auth(request)
    if not auth_enabled():
        return session
    if not session or not is_superadmin_user(session.user):
        raise HTTPException(status_code=403, detail="Superadmin access required.")
    return session


# Mutating API routes that must not be anonymous when auth is configured.
PROTECTED_API_PREFIXES: tuple[str, ...] = (
    "/api/generate",
    "/api/regenerate-pptx",
    "/api/community",
    "/api/admin/",
    "/api/settings/",
    "/api/upload",
    "/api/saved-posters",
    "/api/catalog/songs",
    "/api/songs/",
    "/api/lyrics/",
    "/api/submissions/",
    "/api/design/",
    "/generate-image",
)


def _is_protected_api(path: str, method: str) -> bool:
    if method.upper() in {"GET", "HEAD", "OPTIONS"}:
        if path.startswith("/api/catalog/songs") and auth_enabled():
            return True
        if path == "/api/community" and auth_enabled():
            return True
        if path.startswith("/api/settings/gemini-api-key") and method.upper() == "GET":
            return False
        return False
    return any(path == prefix or path.startswith(prefix) for prefix in PROTECTED_API_PREFIXES)


class UserChurchMiddleware(BaseHTTPMiddleware):
    """Verify JWT once, load church profile, and attach session to the request."""

    async def dispatch(
        self, request: Request, call_next: RequestResponseEndpoint
    ) -> Response:
        clear_church_profile()
        request.state.auth_session = None
        if auth_enabled():
            token = _extract_bearer(request.headers.get("authorization"))
            if token:
                try:
                    user = verify_supabase_token(token)
                    from services.supabase_client import get_church_profile, get_profile

                    profile_row = get_profile(user.user_id, access_token=token) or {}
                    role = (profile_row.get("role") or "member").strip().lower()
                    if role not in {"member", "superadmin"}:
                        role = "member"
                    user = AuthUser(
                        user_id=user.user_id,
                        email=user.email,
                        first_name=user.first_name,
                        last_name=user.last_name,
                        image_url=user.image_url,
                        role=role,
                    )
                    session = AuthSession(user=user, token=token)
                    request.state.auth_session = session
                    church_profile = get_church_profile(user.user_id, access_token=token)
                    set_church_profile(church_profile)
                except HTTPException:
                    pass
        try:
            return await call_next(request)
        finally:
            clear_church_profile()
            request.state.auth_session = None


class AuthGuardMiddleware(BaseHTTPMiddleware):
    async def dispatch(
        self, request: Request, call_next: RequestResponseEndpoint
    ) -> Response:
        if auth_enabled() and _is_protected_api(request.url.path, request.method):
            if not getattr(request.state, "auth_session", None):
                token = _extract_bearer(request.headers.get("authorization"))
                detail = (
                    "Invalid or expired session."
                    if token
                    else "Sign in required."
                )
                return Response(
                    content=json.dumps({"detail": detail}),
                    status_code=401,
                    media_type="application/json",
                )
        return await call_next(request)


# Content-Security-Policy. The app loads the Supabase JS SDK from jsDelivr and
# talks to the Supabase REST/Auth host, so those origins are allowlisted.
# 'unsafe-inline' is required for the inline <script>/<style> blocks in the
# templates; tighten with nonces if those are refactored out.
def _build_csp() -> str:
    from services.auth_config import supabase_url

    connect = [
        "'self'",
        "https://*.supabase.co",
        "https://*.supabase.in",
        # EWTN live radio (HLS manifests + segments via hls.js)
        "https://ewtn-sgrewind.streamguys1.com",
        "https://ewtn-ice.streamguys1.com",
    ]
    sb = supabase_url()
    if sb:
        connect.append(sb)
    media = [
        "'self'",
        "blob:",
        "https://ewtn-sgrewind.streamguys1.com",
        "https://ewtn-ice.streamguys1.com",
    ]
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
            "media-src " + " ".join(dict.fromkeys(media)),
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

    # Middleware runs in reverse registration order on the request path.
    # RateLimit (outermost) → UserChurch (verify JWT + load profile) → AuthGuard
    # → SecurityHeaders → route handlers.
    app.add_middleware(SecurityHeadersMiddleware)
    app.add_middleware(AuthGuardMiddleware)
    app.add_middleware(UserChurchMiddleware)
    app.add_middleware(RateLimitMiddleware)
