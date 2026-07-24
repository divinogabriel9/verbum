"""Supabase client helpers (service role for admin, user JWT for RLS)."""

from __future__ import annotations

from datetime import datetime, timezone
from functools import lru_cache
from typing import Any, Optional

import httpx
from fastapi import HTTPException

from services.auth_config import (
    supabase_client_key,
    supabase_enabled,
    supabase_service_role_key,
    supabase_url,
)

# postgrest-py defaults to http2=True; on macOS that can wedge with
# httpx.ReadError Errno 35 (EAGAIN) and block FastAPI's thread pool.
_HTTP_TIMEOUT = httpx.Timeout(30.0, connect=10.0)
_STORAGE_TIMEOUT_S = 60


def _require_supabase() -> None:
    if not supabase_enabled():
        raise RuntimeError("Supabase is not configured.")


def _httpx_client() -> httpx.Client:
    return httpx.Client(
        timeout=_HTTP_TIMEOUT,
        follow_redirects=True,
        http2=False,
    )


def _client_options(**kwargs: Any):
    from supabase import ClientOptions

    return ClientOptions(
        httpx_client=_httpx_client(),
        postgrest_client_timeout=_HTTP_TIMEOUT,
        storage_client_timeout=_STORAGE_TIMEOUT_S,
        **kwargs,
    )


@lru_cache(maxsize=1)
def get_service_client():
    """Admin client — bypasses RLS. Server-side only."""
    _require_supabase()
    from supabase import create_client

    key = supabase_service_role_key()
    if not key:
        raise RuntimeError("SUPABASE_SERVICE_ROLE_KEY is required for server-side operations.")
    return create_client(supabase_url(), key, options=_client_options())


def get_user_client(access_token: str):
    """User-scoped client — enforces Supabase RLS."""
    _require_supabase()
    from supabase import create_client

    token = (access_token or "").strip()
    if not token:
        raise ValueError("Access token is required for user-scoped Supabase access.")

    anon = supabase_client_key()
    if not anon:
        raise RuntimeError("SUPABASE_PUBLISHABLE_KEY or SUPABASE_ANON_KEY is not configured.")

    return create_client(
        supabase_url(),
        anon,
        options=_client_options(headers={"Authorization": f"Bearer {token}"}),
    )


def _client_for_user(access_token: Optional[str]):
    if access_token:
        return get_user_client(access_token)
    return get_service_client()


def get_profile(user_id: str, *, access_token: Optional[str] = None) -> Optional[dict[str, Any]]:
    uid = (user_id or "").strip()
    if not uid:
        return None
    client = _client_for_user(access_token)
    result = client.table("profiles").select("*").eq("id", uid).limit(1).execute()
    rows = result.data or []
    return rows[0] if rows else None


def get_profile_by_id(user_id: str) -> Optional[dict[str, Any]]:
    """Service-role profile lookup (for transactional emails)."""
    uid = (user_id or "").strip()
    if not uid or not supabase_enabled():
        return None
    try:
        client = get_service_client()
        result = (
            client.table("profiles")
            .select("id, email, first_name, last_name")
            .eq("id", uid)
            .limit(1)
            .execute()
        )
        rows = result.data or []
        return rows[0] if rows else None
    except Exception:
        return None


def update_profile_avatar(
    user_id: str,
    avatar_path: str,
    *,
    access_token: Optional[str] = None,
) -> dict[str, Any]:
    """Persist the user's profile photo storage path (or absolute URL)."""
    uid = (user_id or "").strip()
    path = (avatar_path or "").strip()
    if not uid:
        raise HTTPException(status_code=400, detail="User id is required.")
    if not path:
        raise HTTPException(status_code=400, detail="Avatar path is required.")
    client = _client_for_user(access_token)
    result = (
        client.table("profiles")
        .update({"avatar_url": path, "updated_at": datetime.now(timezone.utc).isoformat()})
        .eq("id", uid)
        .execute()
    )
    rows = result.data or []
    if not rows:
        raise HTTPException(status_code=404, detail="Profile not found.")
    return rows[0]


def get_church_profile(
    user_id: str, *, access_token: Optional[str] = None
) -> Optional[dict[str, Any]]:
    uid = (user_id or "").strip()
    if not uid:
        return None
    from services.parish_store import get_user_parish_context

    ctx = get_user_parish_context(uid, access_token=access_token)
    if ctx:
        return ctx
    client = _client_for_user(access_token)
    result = (
        client.table("church_profiles").select("*").eq("user_id", uid).limit(1).execute()
    )
    rows = result.data or []
    return rows[0] if rows else None


def _parish_is_locked(existing: dict[str, Any]) -> bool:
    return bool(existing.get("community_name_locked_at"))


def _logo_is_locked(existing: dict[str, Any]) -> bool:
    return bool(existing.get("logo_locked_at"))


def submit_parish_name(
    user_id: str,
    community_name: str,
    *,
    access_token: Optional[str] = None,
) -> dict[str, Any]:
    from services.parish_store import get_user_parish_context, submit_parish_name_for_user

    uid = (user_id or "").strip()
    name = (community_name or "").strip()
    if not uid or not name:
        raise ValueError("Parish name is required.")
    if not access_token:
        raise ValueError("Access token is required.")

    if get_user_parish_context(uid, access_token=access_token):
        return submit_parish_name_for_user(uid, name, access_token=access_token)

    existing = get_church_profile(uid, access_token=access_token) or {}
    if _parish_is_locked(existing):
        raise HTTPException(
            status_code=409,
            detail="Parish name is already set and cannot be changed.",
        )

    now = datetime.now(timezone.utc).isoformat()
    payload: dict[str, Any] = {
        "user_id": uid,
        "community_name": name,
        "celebrant_names": existing.get("celebrant_names") or [],
        "membership_status": "pending",
        "community_name_locked_at": now,
    }
    if existing.get("logo_path"):
        payload["logo_path"] = existing.get("logo_path")
        payload["logo_locked_at"] = now

    client = _client_for_user(access_token)
    result = client.table("church_profiles").upsert(payload, on_conflict="user_id").execute()
    rows = result.data or []
    if rows:
        return rows[0]
    saved = get_church_profile(uid, access_token=access_token)
    if not saved:
        raise RuntimeError("Parish name save did not persist.")
    return saved


def lock_church_logo(
    user_id: str,
    *,
    access_token: Optional[str] = None,
) -> dict[str, Any]:
    """Lock logo after a one-time upload post-approval."""
    from services.parish_store import get_user_parish_context, lock_parish_logo_for_user

    uid = (user_id or "").strip()
    if not uid or not access_token:
        raise ValueError("user_id and access token are required.")

    if get_user_parish_context(uid, access_token=access_token):
        return lock_parish_logo_for_user(uid, access_token=access_token)

    existing = get_church_profile(uid, access_token=access_token) or {}
    if _logo_is_locked(existing):
        return existing
    if not (existing.get("logo_path") or "").strip():
        raise HTTPException(status_code=400, detail="Upload a logo before locking.")

    now = datetime.now(timezone.utc).isoformat()
    payload: dict[str, Any] = {
        "user_id": uid,
        "logo_locked_at": now,
    }
    client = _client_for_user(access_token)
    result = client.table("church_profiles").update(payload).eq("user_id", uid).execute()
    rows = result.data or []
    if rows:
        return rows[0]
    saved = get_church_profile(uid, access_token=access_token)
    if not saved:
        raise RuntimeError("Logo lock did not persist.")
    return saved


def upsert_church_profile(
    user_id: str,
    *,
    community_name: Optional[str] = None,
    logo_path: Optional[str] = None,
    celebrant_names: Optional[list[str]] = None,
    access_token: Optional[str] = None,
    allow_name_change: bool = False,
) -> dict[str, Any]:
    from services.parish_store import get_user_parish_context, upsert_parish_for_user

    uid = (user_id or "").strip()
    if not uid:
        raise ValueError("user_id is required.")

    if get_user_parish_context(uid, access_token=access_token):
        return upsert_parish_for_user(
            uid,
            community_name=community_name,
            logo_path=logo_path,
            celebrant_names=celebrant_names,
            access_token=access_token,
            allow_name_change=allow_name_change,
        )

    existing = get_church_profile(uid, access_token=access_token) or {}
    payload: dict[str, Any] = {
        "user_id": uid,
        "community_name": existing.get("community_name") or "",
        "celebrant_names": existing.get("celebrant_names") or [],
    }
    if existing.get("logo_path"):
        payload["logo_path"] = existing.get("logo_path")
    if existing.get("membership_status"):
        payload["membership_status"] = existing.get("membership_status")
    if existing.get("community_name_locked_at"):
        payload["community_name_locked_at"] = existing.get("community_name_locked_at")
    if existing.get("logo_locked_at"):
        payload["logo_locked_at"] = existing.get("logo_locked_at")

    if community_name is not None:
        if _parish_is_locked(existing) and not allow_name_change:
            if (community_name or "").strip() != (existing.get("community_name") or "").strip():
                raise HTTPException(
                    status_code=409,
                    detail="Parish name is locked and cannot be changed.",
                )
        elif not _parish_is_locked(existing):
            payload["community_name"] = community_name

    if logo_path is not None:
        if _logo_is_locked(existing):
            if (logo_path or "").strip() != (existing.get("logo_path") or "").strip():
                raise HTTPException(
                    status_code=409,
                    detail="Parish logo is locked and cannot be changed.",
                )
        else:
            payload["logo_path"] = logo_path
    if celebrant_names is not None:
        payload["celebrant_names"] = celebrant_names

    client = _client_for_user(access_token)
    if not access_token:
        raise ValueError("Access token is required to save church profile.")

    result = client.table("church_profiles").upsert(payload, on_conflict="user_id").execute()
    rows = result.data or []
    if rows:
        return rows[0]
    saved = get_church_profile(uid, access_token=access_token)
    if not saved:
        raise RuntimeError("Church profile save did not persist. Check Supabase RLS policies.")
    return saved


def list_pending_memberships() -> list[dict[str, Any]]:
    from services.parish_store import list_pending_parish_memberships

    pending = list_pending_parish_memberships()
    if pending:
        return pending

    client = get_service_client()
    result = (
        client.table("church_profiles")
        .select("user_id, community_name, membership_status, created_at, updated_at")
        .eq("membership_status", "pending")
        .order("created_at")
        .execute()
    )
    rows = result.data or []
    if not rows:
        return []

    user_ids = [r["user_id"] for r in rows if r.get("user_id")]
    profiles_result = (
        client.table("profiles")
        .select("id, email, first_name, last_name")
        .in_("id", user_ids)
        .execute()
    )
    by_id = {p["id"]: p for p in (profiles_result.data or [])}
    out: list[dict[str, Any]] = []
    for row in rows:
        prof = by_id.get(row.get("user_id")) or {}
        out.append({**row, "profile": prof})
    return out


def set_membership_status(user_id: str, status: str) -> dict[str, Any]:
    from services.parish_store import get_member_for_user, set_parish_membership_status

    uid = (user_id or "").strip()
    if not uid:
        raise ValueError("user_id is required.")
    status = (status or "").strip().lower()
    if status not in {"approved", "rejected"}:
        raise ValueError("status must be approved or rejected.")

    if get_member_for_user(uid):
        parish = set_parish_membership_status(uid, status)
        return parish

    client = get_service_client()
    result = (
        client.table("church_profiles")
        .update({"membership_status": status})
        .eq("user_id", uid)
        .execute()
    )
    rows = result.data or []
    if rows:
        return rows[0]
    lookup = client.table("church_profiles").select("*").eq("user_id", uid).limit(1).execute()
    if lookup.data:
        return lookup.data[0]
    raise RuntimeError("Membership update did not persist.")


def record_generation(
    user_id: str,
    *,
    mass_date: str,
    celebrant: Optional[str] = None,
    output_summary: Optional[dict[str, Any]] = None,
    access_token: Optional[str] = None,
) -> None:
    uid = (user_id or "").strip()
    if not uid:
        return
    client = _client_for_user(access_token)
    client.table("generation_history").insert(
        {
            "user_id": uid,
            "mass_date": mass_date,
            "celebrant": celebrant,
            "output_summary": output_summary or {},
        }
    ).execute()


def bootstrap_superadmin_roles_from_env() -> int:
    """Promote SUPERADMIN_EMAILS to profiles.role=superadmin (service role only)."""
    from services.membership_config import superadmin_emails

    emails = superadmin_emails()
    if not emails or not supabase_enabled():
        return 0
    try:
        client = get_service_client()
    except RuntimeError:
        return 0

    updated = 0
    for email in emails:
        result = (
            client.table("profiles")
            .update({"role": "superadmin"})
            .eq("email", email)
            .neq("role", "superadmin")
            .execute()
        )
        updated += len(result.data or [])
    return updated
