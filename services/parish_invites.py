"""Parish team invite tokens (media teammates join an existing parish)."""

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


def get_parish_invite_by_token(token: str) -> Optional[dict[str, Any]]:
    tok = (token or "").strip()
    if not tok or not supabase_enabled():
        return None
    client = get_service_client()
    result = (
        client.table("parish_invites")
        .select("*")
        .eq("token", tok)
        .limit(1)
        .execute()
    )
    rows = result.data or []
    return rows[0] if rows else None


def validate_parish_invite_token(token: str) -> Optional[dict[str, Any]]:
    row = get_parish_invite_by_token(token)
    if not _token_row_valid(row):
        return None
    return row


def create_parish_invite(
    *,
    parish_id: str,
    invited_by_user_id: str,
    email: Optional[str] = None,
    ttl_days: int = _DEFAULT_TTL_DAYS,
) -> dict[str, Any]:
    if not supabase_enabled():
        raise RuntimeError("Supabase is required for parish invites.")
    pid = (parish_id or "").strip()
    if not pid:
        raise ValueError("parish_id is required.")
    clean_email = (email or "").strip().lower() or None
    expires_at = (_now() + timedelta(days=max(1, min(ttl_days, 90)))).isoformat()
    token = secrets.token_urlsafe(32)
    payload: dict[str, Any] = {
        "parish_id": pid,
        "token": token,
        "email": clean_email,
        "role": "media",
        "invited_by": invited_by_user_id,
        "expires_at": expires_at,
    }
    client = get_service_client()
    result = client.table("parish_invites").insert(payload).execute()
    rows = result.data or []
    if rows:
        return rows[0]
    raise RuntimeError("Parish invite create did not persist.")


def list_parish_invites(parish_id: str, *, include_accepted: bool = False) -> list[dict[str, Any]]:
    pid = (parish_id or "").strip()
    if not pid or not supabase_enabled():
        return []
    client = get_service_client()
    query = (
        client.table("parish_invites")
        .select("*")
        .eq("parish_id", pid)
        .order("created_at", desc=True)
        .limit(50)
    )
    if not include_accepted:
        query = query.is_("accepted_at", "null")
    result = query.execute()
    return list(result.data or [])


def consume_parish_invite(token: str, *, accepted_by_user_id: str) -> dict[str, Any]:
    tok = (token or "").strip()
    uid = (accepted_by_user_id or "").strip()
    if not tok or not uid:
        raise ValueError("token and accepted_by_user_id are required.")
    row = validate_parish_invite_token(tok)
    if not row:
        raise ValueError("Invite is invalid or expired.")
    locked_email = (row.get("email") or "").strip().lower()
    if locked_email:
        prof = (
            get_service_client()
            .table("profiles")
            .select("email")
            .eq("id", uid)
            .limit(1)
            .execute()
        )
        prof_rows = prof.data or []
        user_email = ((prof_rows[0].get("email") if prof_rows else "") or "").strip().lower()
        if user_email != locked_email:
            raise ValueError(f"This invite is locked to {locked_email}.")

    from services.parish_store import assign_user_to_parish

    assign_user_to_parish(uid, str(row["parish_id"]), "media")

    client = get_service_client()
    now = _now().isoformat()
    result = (
        client.table("parish_invites")
        .update({"accepted_at": now, "accepted_by": uid})
        .eq("token", tok)
        .is_("accepted_at", "null")
        .execute()
    )
    rows = result.data or []
    if rows:
        return rows[0]
    raise ValueError("Invite could not be consumed.")
