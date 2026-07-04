"""Invite-only signup tokens (server-side, service role)."""

from __future__ import annotations

import secrets
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

from services.auth_config import supabase_enabled
from services.supabase_client import get_service_client

_DEFAULT_TTL_DAYS = 7


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _token_row_valid(row: Optional[dict[str, Any]]) -> bool:
    if not row:
        return False
    if row.get("accepted_at"):
        return False
    expires = row.get("expires_at")
    if not expires:
        return False
    try:
        exp = datetime.fromisoformat(str(expires).replace("Z", "+00:00"))
        if exp.tzinfo is None:
            exp = exp.replace(tzinfo=timezone.utc)
    except ValueError:
        return False
    return exp > _now()


def get_invite_by_token(token: str) -> Optional[dict[str, Any]]:
    tok = (token or "").strip()
    if not tok or not supabase_enabled():
        return None
    client = get_service_client()
    result = (
        client.table("platform_invites")
        .select("*")
        .eq("token", tok)
        .limit(1)
        .execute()
    )
    rows = result.data or []
    return rows[0] if rows else None


def validate_invite_token(token: str) -> Optional[dict[str, Any]]:
    row = get_invite_by_token(token)
    if not _token_row_valid(row):
        return None
    return row


def create_invite(
    *,
    created_by_user_id: Optional[str] = None,
    email: Optional[str] = None,
    note: Optional[str] = None,
    ttl_days: int = _DEFAULT_TTL_DAYS,
) -> dict[str, Any]:
    if not supabase_enabled():
        raise RuntimeError("Supabase is required for platform invites.")
    clean_email = (email or "").strip().lower() or None
    expires_at = (_now() + timedelta(days=max(1, min(ttl_days, 90)))).isoformat()
    token = secrets.token_urlsafe(32)
    payload: dict[str, Any] = {
        "token": token,
        "email": clean_email,
        "note": (note or "").strip() or None,
        "expires_at": expires_at,
    }
    if created_by_user_id:
        payload["created_by"] = created_by_user_id
    client = get_service_client()
    result = client.table("platform_invites").insert(payload).execute()
    rows = result.data or []
    if rows:
        return rows[0]
    raise RuntimeError("Invite create did not persist.")


def list_invites(*, include_accepted: bool = False, limit: int = 50) -> list[dict[str, Any]]:
    if not supabase_enabled():
        return []
    client = get_service_client()
    query = client.table("platform_invites").select("*").order("created_at", desc=True).limit(
        max(1, min(limit, 200))
    )
    if not include_accepted:
        query = query.is_("accepted_at", "null")
    result = query.execute()
    return list(result.data or [])


def consume_invite(token: str, *, accepted_by_user_id: str) -> dict[str, Any]:
    tok = (token or "").strip()
    uid = (accepted_by_user_id or "").strip()
    if not tok or not uid:
        raise ValueError("token and accepted_by_user_id are required.")
    row = validate_invite_token(tok)
    if not row:
        raise ValueError("Invite is invalid or expired.")
    client = get_service_client()
    now = _now().isoformat()
    result = (
        client.table("platform_invites")
        .update({"accepted_at": now, "accepted_by": uid})
        .eq("token", tok)
        .is_("accepted_at", "null")
        .execute()
    )
    rows = result.data or []
    if rows:
        return rows[0]
    raise ValueError("Invite could not be consumed.")
