"""API security: auth sessions, middleware, and route protection."""

from __future__ import annotations

import hashlib
import json
import time
from dataclasses import dataclass
from typing import Any, Optional

from fastapi import HTTPException, Request, Response
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint

from services.auth_config import auth_enabled, auth_misconfigured
from services.supabase_auth import AuthUser, verify_supabase_token
from services.user_church_context import clear_church_profile, set_church_profile


@dataclass(frozen=True)
class AuthSession:
    user: AuthUser
    token: str


_AUTH_CONTEXT_TTL_S = 90.0
_auth_context_cache: dict[str, tuple[float, AuthSession, Optional[dict[str, Any]]]] = {}


def _auth_cache_key(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _get_cached_auth_context(
    token: str,
) -> Optional[tuple[AuthSession, Optional[dict[str, Any]]]]:
    row = _auth_context_cache.get(_auth_cache_key(token))
    if not row:
        return None
    expires_at, session, church_profile = row
    if time.monotonic() >= expires_at:
        _auth_context_cache.pop(_auth_cache_key(token), None)
        return None
    return session, church_profile


def _store_auth_context(
    token: str,
    session: AuthSession,
    church_profile: Optional[dict[str, Any]],
) -> None:
    _auth_context_cache[_auth_cache_key(token)] = (
        time.monotonic() + _AUTH_CONTEXT_TTL_S,
        session,
        church_profile,
    )


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
    if auth_misconfigured():
        raise HTTPException(status_code=503, detail="Auth is required but not configured.")
    session = await optional_session(request)
    if auth_enabled() and not session:
        raise HTTPException(status_code=401, detail="Sign in required.")
    return session


async def require_approved_membership(request: Request) -> Optional[AuthSession]:
    """Require approved parish membership (or superadmin) when auth is enabled."""
    from starlette.concurrency import run_in_threadpool

    from services.membership_config import membership_allows_full_access
    from services.supabase_client import get_church_profile, get_profile
    from services.user_church_context import get_church_profile_context, set_church_profile

    if auth_misconfigured():
        raise HTTPException(status_code=503, detail="Auth is required but not configured.")
    session = await require_session_when_auth(request)
    if not auth_enabled():
        return session
    if not session:
        raise HTTPException(status_code=401, detail="Sign in required.")

    church = get_church_profile_context()
    profile_role = session.user.role
    # Middleware may skip Supabase on lightweight GETs; load membership here if needed.
    if church is None:
        try:
            profile_row = await run_in_threadpool(
                get_profile, session.user.user_id, access_token=session.token
            ) or {}
            profile_role = (profile_row.get("role") or session.user.role or "member").strip().lower()
            church = await run_in_threadpool(
                get_church_profile, session.user.user_id, access_token=session.token
            )
            if church is not None:
                set_church_profile(church)
            if profile_role in {"member", "superadmin"} and profile_role != session.user.role:
                enriched = AuthUser(
                    user_id=session.user.user_id,
                    email=session.user.email,
                    first_name=session.user.first_name,
                    last_name=session.user.last_name,
                    image_url=session.user.image_url,
                    role=profile_role,
                )
                session = AuthSession(user=enriched, token=session.token)
                request.state.auth_session = session
            _store_auth_context(session.token, session, church)
        except Exception:
            church = get_church_profile_context()

    if membership_allows_full_access(
        church, user=session.user, profile_role=profile_role
    ):
        return session
    status = ((church or {}).get("membership_status") or "draft").strip().lower()
    if status == "pending":
        raise HTTPException(
            status_code=403,
            detail="Parish membership is pending approval.",
        )
    if status == "rejected":
        raise HTTPException(
            status_code=403,
            detail="Parish membership was not approved.",
        )
    raise HTTPException(status_code=403, detail="Approved parish membership is required.")


async def require_superadmin(request: Request) -> Optional[AuthSession]:
    """Only superadmin emails may use protected parish/Mass features when auth is on."""
    from services.membership_config import is_superadmin_user

    if auth_misconfigured():
        raise HTTPException(status_code=503, detail="Auth is required but not configured.")
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
    "/api/parish/",
    "/api/settings/",
    "/api/upload",
    "/api/saved-posters",
    "/api/saved-media",
    "/api/catalog/songs",
    "/api/songs/",
    "/api/lyrics/",
    "/api/submissions/",
    "/api/practice/share",
    "/api/preview",
    "/api/ppt-preview/refresh",
    "/api/design/",
    "/generate-image",
)


def _is_protected_api(path: str, method: str) -> bool:
    auth_active = auth_enabled() or auth_misconfigured()
    if method.upper() in {"GET", "HEAD", "OPTIONS"}:
        if path.startswith("/api/files/") and auth_active:
            return True
        if path.startswith("/api/catalog/songs") and auth_active:
            return True
        if path.startswith("/api/readings/") and auth_active:
            return True
        if path == "/api/community" and auth_active:
            return True
        return False
    return any(path == prefix or path.startswith(prefix) for prefix in PROTECTED_API_PREFIXES)


def _is_lightweight_auth_get(path: str, method: str) -> bool:
    """Read-only routes that only need a valid JWT, not Supabase profile round-trips."""
    if method.upper() not in {"GET", "HEAD"}:
        return False
    if path.startswith("/api/catalog/songs"):
        return True
    if path.startswith("/api/readings/"):
        return True
    if path == "/api/calendar/month":
        return True
    return False


class UserChurchMiddleware(BaseHTTPMiddleware):
    """Verify JWT once, load church profile, and attach session to the request."""

    async def dispatch(
        self, request: Request, call_next: RequestResponseEndpoint
    ) -> Response:
        from starlette.concurrency import run_in_threadpool

        clear_church_profile()
        request.state.auth_session = None
        if auth_enabled():
            token = _extract_bearer(request.headers.get("authorization"))
            if token:
                lightweight = _is_lightweight_auth_get(request.url.path, request.method)
                cached = _get_cached_auth_context(token)
                if cached:
                    session, church_profile = cached
                    request.state.auth_session = session
                    if church_profile is not None:
                        set_church_profile(church_profile)
                else:
                    try:
                        user = verify_supabase_token(token)
                        if lightweight:
                            # JWT only — membership is resolved in Depends when needed.
                            session = AuthSession(user=user, token=token)
                            request.state.auth_session = session
                        else:
                            from services.supabase_client import get_church_profile, get_profile

                            try:
                                profile_row = await run_in_threadpool(
                                    get_profile, user.user_id, access_token=token
                                ) or {}
                            except Exception:
                                profile_row = {}
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
                            try:
                                church_profile = await run_in_threadpool(
                                    get_church_profile, user.user_id, access_token=token
                                )
                            except Exception:
                                church_profile = None
                            set_church_profile(church_profile)
                            _store_auth_context(token, session, church_profile)
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
        if _is_protected_api(request.url.path, request.method):
            if auth_misconfigured():
                return Response(
                    content=json.dumps({"detail": "Auth is required but not configured."}),
                    status_code=503,
                    media_type="application/json",
                )
            if not auth_enabled():
                return await call_next(request)
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
            "worker-src 'self' blob:",
            "connect-src " + " ".join(dict.fromkeys(connect)),
            "media-src " + " ".join(dict.fromkeys(media)),
        ]
    )


class StaticCacheMiddleware(BaseHTTPMiddleware):
    async def dispatch(
        self, request: Request, call_next: RequestResponseEndpoint
    ) -> Response:
        response = await call_next(request)
        if request.url.path.startswith("/static/"):
            response.headers.setdefault(
                "Cache-Control",
                "public, max-age=31536000, immutable",
            )
        return response


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
    app.add_middleware(StaticCacheMiddleware)
    app.add_middleware(SecurityHeadersMiddleware)
    app.add_middleware(AuthGuardMiddleware)
    app.add_middleware(UserChurchMiddleware)
    app.add_middleware(RateLimitMiddleware)
