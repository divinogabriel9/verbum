"""Verify Supabase Auth JWTs for FastAPI routes."""

from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache
from typing import Annotated, Any, Optional

import jwt
from fastapi import Depends, Header, HTTPException
from jwt import PyJWKClient
from jwt.exceptions import PyJWKClientConnectionError, PyJWTError

from services.auth_config import (
    auth_enabled,
    supabase_client_key,
    supabase_jwt_secret,
    supabase_url,
)

_DECODE_OPTIONS = {
    "verify_aud": True,
    "verify_exp": True,
    "verify_signature": True,
    "require": ["exp", "sub"],
}


@dataclass(frozen=True)
class AuthUser:
    user_id: str
    email: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    image_url: Optional[str] = None
    role: str = "member"


@lru_cache(maxsize=4)
def _jwks_client_for(url: str) -> PyJWKClient:
    return PyJWKClient(
        f"{url.rstrip('/')}/auth/v1/.well-known/jwks.json",
        cache_keys=True,
        lifespan=600,
    )


def _decode_hs256(token: str, secret: str) -> dict[str, Any]:
    return jwt.decode(
        token,
        secret,
        algorithms=["HS256"],
        audience="authenticated",
        leeway=10,
        options=_DECODE_OPTIONS,
    )


def _decode_asymmetric(token: str, alg: str) -> dict[str, Any]:
    base = supabase_url()
    if not base:
        raise HTTPException(status_code=503, detail="Supabase Auth is not configured.")
    signing_key = _jwks_client_for(base).get_signing_key_from_jwt(token)
    return jwt.decode(
        token,
        signing_key.key,
        algorithms=[alg],
        audience="authenticated",
        leeway=10,
        options=_DECODE_OPTIONS,
    )


def _verify_via_auth_server(token: str) -> dict[str, Any]:
    """Ask Supabase Auth to validate the token (works for ES256 + HS256)."""
    import requests

    base = supabase_url()
    api_key = supabase_client_key()
    if not base or not api_key:
        raise HTTPException(status_code=503, detail="Supabase Auth is not configured.")

    try:
        resp = requests.get(
            f"{base}/auth/v1/user",
            headers={
                "Authorization": f"Bearer {token}",
                "apikey": api_key,
            },
            timeout=10,
        )
    except requests.RequestException as exc:
        raise HTTPException(
            status_code=503,
            detail="Could not reach Supabase Auth to verify session.",
        ) from exc

    if resp.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid or expired session.")

    user = resp.json()
    uid = str(user.get("id") or "").strip()
    if not uid:
        raise HTTPException(status_code=401, detail="Invalid session subject.")

    meta = user.get("user_metadata") or {}
    if not isinstance(meta, dict):
        meta = {}

    return {
        "sub": uid,
        "email": user.get("email"),
        "user_metadata": meta,
    }


def verify_supabase_token(token: str) -> AuthUser:
    if not supabase_url():
        raise HTTPException(status_code=503, detail="Supabase Auth is not configured.")

    raw = (token or "").strip()
    if not raw:
        raise HTTPException(status_code=401, detail="Sign in required.")

    try:
        header = jwt.get_unverified_header(raw)
    except PyJWTError as exc:
        raise HTTPException(status_code=401, detail="Invalid or expired session.") from exc

    alg = str(header.get("alg") or "HS256")

    payload: dict[str, Any]
    try:
        if alg == "HS256":
            secret = supabase_jwt_secret()
            if not secret:
                payload = _verify_via_auth_server(raw)
            else:
                try:
                    payload = _decode_hs256(raw, secret)
                except PyJWTError:
                    payload = _verify_via_auth_server(raw)
        else:
            # Modern Supabase projects sign user access tokens with ES256 (JWKS).
            try:
                payload = _decode_asymmetric(raw, alg)
            except (PyJWTError, PyJWKClientConnectionError, OSError):
                payload = _verify_via_auth_server(raw)
    except HTTPException:
        raise

    user_id = str(payload.get("sub") or "").strip()
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid session subject.")

    meta = payload.get("user_metadata") or payload.get("app_metadata") or {}
    if not isinstance(meta, dict):
        meta = {}

    return AuthUser(
        user_id=user_id,
        email=(payload.get("email") or None),
        first_name=(meta.get("first_name") or meta.get("given_name") or None),
        last_name=(meta.get("last_name") or meta.get("family_name") or None),
        image_url=(meta.get("avatar_url") or meta.get("picture") or None),
    )


def _extract_bearer(authorization: Optional[str]) -> Optional[str]:
    if not authorization:
        return None
    parts = authorization.split(" ", 1)
    if len(parts) != 2 or parts[0].lower() != "bearer":
        return None
    token = parts[1].strip()
    return token or None


async def optional_auth_user(
    authorization: Annotated[Optional[str], Header()] = None,
) -> Optional[AuthUser]:
    if not auth_enabled():
        return None
    token = _extract_bearer(authorization)
    if not token:
        return None
    return verify_supabase_token(token)


async def require_auth_user(
    authorization: Annotated[Optional[str], Header()] = None,
) -> AuthUser:
    if not auth_enabled():
        raise HTTPException(
            status_code=503,
            detail="Supabase Auth is not configured on this server.",
        )
    token = _extract_bearer(authorization)
    if not token:
        raise HTTPException(status_code=401, detail="Sign in required.")
    return verify_supabase_token(token)
