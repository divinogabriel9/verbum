"""Verify Supabase Auth JWTs for FastAPI routes."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Annotated, Optional

import jwt
from fastapi import Depends, Header, HTTPException

from services.auth_config import auth_enabled, supabase_jwt_secret, supabase_url


@dataclass(frozen=True)
class AuthUser:
    user_id: str
    email: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    image_url: Optional[str] = None


def verify_supabase_token(token: str) -> AuthUser:
    secret = supabase_jwt_secret()
    if not secret or not supabase_url():
        raise HTTPException(status_code=503, detail="Supabase Auth is not configured.")

    try:
        payload = jwt.decode(
            token,
            secret,
            algorithms=["HS256"],
            audience="authenticated",
            options={"verify_aud": True},
        )
    except jwt.PyJWTError as exc:
        raise HTTPException(status_code=401, detail="Invalid or expired session.") from exc

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
