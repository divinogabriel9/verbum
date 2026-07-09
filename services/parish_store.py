"""Shared parish model: parishes + parish_members (president + up to 4 media)."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Optional

from fastapi import HTTPException

from services.auth_config import supabase_enabled


def _client_for_user(access_token: Optional[str]):
    from services.supabase_client import get_service_client, get_user_client

    if access_token:
        return get_user_client(access_token)
    return get_service_client()


def _service_client():
    from services.supabase_client import get_service_client

    return get_service_client()

PARISH_MEMBER_LIMIT = 5


def _shape_church_context(
    parish: dict[str, Any],
    *,
    user_id: str,
    parish_role: str,
    member_id: Optional[str] = None,
) -> dict[str, Any]:
    """Return a church_profile-compatible dict for existing app code."""
    return {
        "id": parish.get("id"),
        "parish_id": parish.get("id"),
        "parish_role": (parish_role or "president").strip().lower(),
        "member_id": member_id,
        "user_id": user_id,
        "community_name": parish.get("community_name") or "",
        "logo_path": parish.get("logo_path"),
        "celebrant_names": parish.get("celebrant_names") or [],
        "membership_status": parish.get("membership_status") or "draft",
        "community_name_locked_at": parish.get("community_name_locked_at"),
        "logo_locked_at": parish.get("logo_locked_at"),
        "created_at": parish.get("created_at"),
        "updated_at": parish.get("updated_at"),
    }


def get_member_for_user(
    user_id: str, *, access_token: Optional[str] = None
) -> Optional[dict[str, Any]]:
    uid = (user_id or "").strip()
    if not uid or not supabase_enabled():
        return None
    try:
        client = _client_for_user(access_token)
        result = (
            client.table("parish_members")
            .select("id, parish_id, user_id, role, status, created_at, updated_at")
            .eq("user_id", uid)
            .eq("status", "active")
            .limit(1)
            .execute()
        )
        rows = result.data or []
        return rows[0] if rows else None
    except Exception:
        return None


def get_parish_by_id(
    parish_id: str, *, access_token: Optional[str] = None
) -> Optional[dict[str, Any]]:
    pid = (parish_id or "").strip()
    if not pid or not supabase_enabled():
        return None
    try:
        client = _client_for_user(access_token)
        result = client.table("parishes").select("*").eq("id", pid).limit(1).execute()
        rows = result.data or []
        return rows[0] if rows else None
    except Exception:
        return None


def get_user_parish_context(
    user_id: str, *, access_token: Optional[str] = None
) -> Optional[dict[str, Any]]:
    member = get_member_for_user(user_id, access_token=access_token)
    if not member:
        return None
    parish = get_parish_by_id(member.get("parish_id") or "", access_token=access_token)
    if not parish:
        return None
    return _shape_church_context(
        parish,
        user_id=user_id,
        parish_role=str(member.get("role") or "president"),
        member_id=member.get("id"),
    )


def count_active_members(parish_id: str) -> int:
    pid = (parish_id or "").strip()
    if not pid or not supabase_enabled():
        return 0
    client = _service_client()
    result = (
        client.table("parish_members")
        .select("id", count="exact")
        .eq("parish_id", pid)
        .eq("status", "active")
        .limit(0)
        .execute()
    )
    return int(result.count or 0)


def list_active_members(parish_id: str) -> list[dict[str, Any]]:
    pid = (parish_id or "").strip()
    if not pid or not supabase_enabled():
        return []
    client = _service_client()
    result = (
        client.table("parish_members")
        .select("id, parish_id, user_id, role, status, created_at, updated_at")
        .eq("parish_id", pid)
        .eq("status", "active")
        .order("created_at")
        .execute()
    )
    return list(result.data or [])


def get_president_user_id(parish_id: str) -> Optional[str]:
    pid = (parish_id or "").strip()
    if not pid or not supabase_enabled():
        return None
    client = _service_client()
    result = (
        client.table("parish_members")
        .select("user_id")
        .eq("parish_id", pid)
        .eq("role", "president")
        .eq("status", "active")
        .limit(1)
        .execute()
    )
    rows = result.data or []
    if not rows:
        return None
    return str(rows[0].get("user_id") or "") or None


def _parish_is_locked(parish: dict[str, Any]) -> bool:
    return bool(parish.get("community_name_locked_at"))


def _logo_is_locked(parish: dict[str, Any]) -> bool:
    return bool(parish.get("logo_locked_at"))


def submit_parish_name_for_user(
    user_id: str,
    community_name: str,
    *,
    access_token: Optional[str] = None,
) -> dict[str, Any]:
    uid = (user_id or "").strip()
    name = (community_name or "").strip()
    if not uid or not name:
        raise ValueError("Parish name is required.")
    if not access_token:
        raise ValueError("Access token is required.")

    ctx = get_user_parish_context(uid, access_token=access_token)
    if not ctx:
        raise HTTPException(status_code=404, detail="Parish membership not found.")
    if (ctx.get("parish_role") or "") != "president":
        raise HTTPException(status_code=403, detail="Only the parish president can set the parish name.")
    if _parish_is_locked(ctx):
        raise HTTPException(
            status_code=409,
            detail="Parish name is already set and cannot be changed.",
        )

    parish_id = str(ctx.get("parish_id") or "")
    now = datetime.now(timezone.utc).isoformat()
    payload: dict[str, Any] = {
        "community_name": name,
        "membership_status": "pending",
        "community_name_locked_at": now,
    }
    if ctx.get("logo_path"):
        payload["logo_locked_at"] = now

    client = _client_for_user(access_token)
    result = client.table("parishes").update(payload).eq("id", parish_id).execute()
    rows = result.data or []
    parish = rows[0] if rows else get_parish_by_id(parish_id, access_token=access_token)
    if not parish:
        raise RuntimeError("Parish name save did not persist.")

    _sync_legacy_church_profile(uid, parish)
    return _shape_church_context(
        parish,
        user_id=uid,
        parish_role=str(ctx.get("parish_role") or "president"),
        member_id=ctx.get("member_id"),
    )


def lock_parish_logo_for_user(
    user_id: str,
    *,
    access_token: Optional[str] = None,
) -> dict[str, Any]:
    uid = (user_id or "").strip()
    if not uid or not access_token:
        raise ValueError("user_id and access token are required.")

    ctx = get_user_parish_context(uid, access_token=access_token)
    if not ctx:
        raise HTTPException(status_code=404, detail="Parish membership not found.")
    if _logo_is_locked(ctx):
        return ctx
    if not (ctx.get("logo_path") or "").strip():
        raise HTTPException(status_code=400, detail="Upload a logo before locking.")

    parish_id = str(ctx.get("parish_id") or "")
    now = datetime.now(timezone.utc).isoformat()
    client = _client_for_user(access_token)
    result = (
        client.table("parishes")
        .update({"logo_locked_at": now})
        .eq("id", parish_id)
        .execute()
    )
    rows = result.data or []
    parish = rows[0] if rows else get_parish_by_id(parish_id, access_token=access_token)
    if not parish:
        raise RuntimeError("Logo lock did not persist.")
    _sync_legacy_church_profile(uid, parish)
    return _shape_church_context(
        parish,
        user_id=uid,
        parish_role=str(ctx.get("parish_role") or "president"),
        member_id=ctx.get("member_id"),
    )


def upsert_parish_for_user(
    user_id: str,
    *,
    community_name: Optional[str] = None,
    logo_path: Optional[str] = None,
    celebrant_names: Optional[list[str]] = None,
    access_token: Optional[str] = None,
    allow_name_change: bool = False,
) -> dict[str, Any]:
    uid = (user_id or "").strip()
    if not uid:
        raise ValueError("user_id is required.")
    if not access_token:
        raise ValueError("Access token is required to save church profile.")

    ctx = get_user_parish_context(uid, access_token=access_token)
    if not ctx:
        raise HTTPException(status_code=404, detail="Parish membership not found.")

    parish_id = str(ctx.get("parish_id") or "")
    existing = get_parish_by_id(parish_id, access_token=access_token) or {}
    payload: dict[str, Any] = {}

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

    if not payload:
        return ctx

    client = _client_for_user(access_token)
    result = client.table("parishes").update(payload).eq("id", parish_id).execute()
    rows = result.data or []
    parish = rows[0] if rows else get_parish_by_id(parish_id, access_token=access_token)
    if not parish:
        raise RuntimeError("Parish save did not persist.")
    _sync_legacy_church_profile(uid, parish)
    return _shape_church_context(
        parish,
        user_id=uid,
        parish_role=str(ctx.get("parish_role") or "president"),
        member_id=ctx.get("member_id"),
    )


def _sync_legacy_church_profile(user_id: str, parish: dict[str, Any]) -> None:
    """Keep church_profiles in sync for legacy queries during transition."""
    if not supabase_enabled():
        return
    uid = (user_id or "").strip()
    if not uid:
        return
    payload: dict[str, Any] = {
        "user_id": uid,
        "community_name": parish.get("community_name") or "",
        "celebrant_names": parish.get("celebrant_names") or [],
        "membership_status": parish.get("membership_status") or "draft",
    }
    if parish.get("logo_path"):
        payload["logo_path"] = parish.get("logo_path")
    if parish.get("community_name_locked_at"):
        payload["community_name_locked_at"] = parish.get("community_name_locked_at")
    if parish.get("logo_locked_at"):
        payload["logo_locked_at"] = parish.get("logo_locked_at")
    try:
        client = _service_client()
        client.table("church_profiles").upsert(payload, on_conflict="user_id").execute()
    except Exception:
        pass


def _maybe_delete_empty_parish(parish_id: str) -> None:
    pid = (parish_id or "").strip()
    if not pid:
        return
    if count_active_members(pid) > 0:
        return
    try:
        _service_client().table("parishes").delete().eq("id", pid).execute()
    except Exception:
        pass


def _demote_parish_president(parish_id: str, *, except_user_id: Optional[str] = None) -> None:
    pid = (parish_id or "").strip()
    if not pid:
        return
    client = _service_client()
    query = (
        client.table("parish_members")
        .update({"role": "media"})
        .eq("parish_id", pid)
        .eq("role", "president")
        .eq("status", "active")
    )
    if except_user_id:
        query = query.neq("user_id", except_user_id)
    query.execute()


def list_team_members(parish_id: str) -> list[dict[str, Any]]:
    members = list_active_members(parish_id)
    if not members:
        return []
    user_ids = [m["user_id"] for m in members if m.get("user_id")]
    profiles_by_id: dict[str, dict[str, Any]] = {}
    if user_ids:
        prof_result = (
            _service_client()
            .table("profiles")
            .select("id, email, first_name, last_name, role")
            .in_("id", user_ids)
            .execute()
        )
        profiles_by_id = {p["id"]: p for p in (prof_result.data or [])}
    out: list[dict[str, Any]] = []
    for member in members:
        prof = profiles_by_id.get(member.get("user_id")) or {}
        out.append(
            {
                **member,
                "email": prof.get("email"),
                "first_name": prof.get("first_name"),
                "last_name": prof.get("last_name"),
                "platform_role": prof.get("role"),
            }
        )
    return out


def set_member_role(user_id: str, role: str, *, parish_id: Optional[str] = None) -> dict[str, Any]:
    uid = (user_id or "").strip()
    role = (role or "").strip().lower()
    if role not in {"president", "media"}:
        raise ValueError("role must be president or media.")

    member = get_member_for_user(uid)
    if not member:
        raise ValueError("User is not an active parish member.")
    pid = (parish_id or member.get("parish_id") or "").strip()
    if str(member.get("parish_id") or "") != pid:
        raise ValueError("User is not a member of this parish.")

    if role == "president":
        _demote_parish_president(pid, except_user_id=uid)

    client = _service_client()
    result = (
        client.table("parish_members")
        .update({"role": role})
        .eq("user_id", uid)
        .eq("status", "active")
        .execute()
    )
    rows = result.data or []
    if not rows:
        lookup = (
            client.table("parish_members")
            .select("*")
            .eq("user_id", uid)
            .eq("status", "active")
            .limit(1)
            .execute()
        )
        if not lookup.data:
            raise RuntimeError("Role update did not persist.")
        rows = lookup.data

    parish = get_parish_by_id(pid)
    if parish:
        _sync_legacy_church_profile(uid, parish)
    return rows[0]


def assign_user_to_parish(user_id: str, parish_id: str, role: str) -> dict[str, Any]:
    uid = (user_id or "").strip()
    pid = (parish_id or "").strip()
    role = (role or "media").strip().lower()
    if not uid or not pid:
        raise ValueError("user_id and parish_id are required.")
    if role not in {"president", "media"}:
        raise ValueError("role must be president or media.")

    if count_active_members(pid) >= PARISH_MEMBER_LIMIT:
        existing = get_member_for_user(uid)
        if not existing or str(existing.get("parish_id") or "") != pid:
            raise ValueError(f"Parish already has {PARISH_MEMBER_LIMIT} active members.")

    parish = get_parish_by_id(pid)
    if not parish:
        raise ValueError("Parish not found.")

    old_member = get_member_for_user(uid)
    old_parish_id = str(old_member.get("parish_id") or "") if old_member else ""

    client = _service_client()
    if old_member and old_parish_id == pid:
        return set_member_role(uid, role, parish_id=pid)

    if old_member:
        client.table("parish_members").update({"status": "removed"}).eq("user_id", uid).execute()
        _maybe_delete_empty_parish(old_parish_id)

    if role == "president":
        _demote_parish_president(pid, except_user_id=uid)

    payload = {
        "user_id": uid,
        "parish_id": pid,
        "role": role,
        "status": "active",
    }
    result = client.table("parish_members").upsert(payload, on_conflict="user_id").execute()
    rows = result.data or []
    if not rows:
        saved = get_member_for_user(uid)
        if not saved or str(saved.get("parish_id") or "") != pid:
            raise RuntimeError("Parish assignment did not persist.")
        rows = [saved]

    _sync_legacy_church_profile(uid, parish)
    return rows[0]


def remove_parish_member(user_id: str) -> None:
    uid = (user_id or "").strip()
    if not uid:
        raise ValueError("user_id is required.")
    member = get_member_for_user(uid)
    if not member:
        raise ValueError("User is not an active parish member.")
    if (member.get("role") or "").strip().lower() == "president":
        raise ValueError("Cannot remove the parish president. Promote another president first.")

    parish_id = str(member.get("parish_id") or "")
    client = _service_client()
    client.table("parish_members").update({"status": "removed"}).eq("user_id", uid).execute()
    _maybe_delete_empty_parish(parish_id)


def list_pending_parish_memberships() -> list[dict[str, Any]]:
    if not supabase_enabled():
        return []
    client = _service_client()
    result = (
        client.table("parishes")
        .select("id, community_name, membership_status, created_at, updated_at")
        .eq("membership_status", "pending")
        .order("created_at")
        .execute()
    )
    rows = list(result.data or [])
    if not rows:
        return []

    parish_ids = [r["id"] for r in rows if r.get("id")]
    members_result = (
        client.table("parish_members")
        .select("parish_id, user_id, role")
        .in_("parish_id", parish_ids)
        .eq("role", "president")
        .eq("status", "active")
        .execute()
    )
    president_by_parish = {m["parish_id"]: m for m in (members_result.data or [])}
    user_ids = [m["user_id"] for m in (members_result.data or []) if m.get("user_id")]
    profiles_by_id: dict[str, dict[str, Any]] = {}
    if user_ids:
        profiles_result = (
            client.table("profiles")
            .select("id, email, first_name, last_name")
            .in_("id", user_ids)
            .execute()
        )
        profiles_by_id = {p["id"]: p for p in (profiles_result.data or [])}

    out: list[dict[str, Any]] = []
    for row in rows:
        president = president_by_parish.get(row.get("id")) or {}
        user_id = president.get("user_id")
        prof = profiles_by_id.get(user_id) or {}
        out.append(
            {
                **row,
                "user_id": user_id,
                "profile": prof,
            }
        )
    return out


def set_parish_membership_status(user_id: str, status: str) -> dict[str, Any]:
    uid = (user_id or "").strip()
    if not uid:
        raise ValueError("user_id is required.")
    status = (status or "").strip().lower()
    if status not in {"approved", "rejected"}:
        raise ValueError("status must be approved or rejected.")

    member = get_member_for_user(uid)
    if not member:
        raise ValueError("Parish membership not found for user.")
    parish_id = str(member.get("parish_id") or "")
    if not parish_id:
        raise ValueError("Parish not found for user.")

    client = _service_client()
    result = (
        client.table("parishes")
        .update({"membership_status": status})
        .eq("id", parish_id)
        .execute()
    )
    rows = result.data or []
    parish = rows[0] if rows else get_parish_by_id(parish_id)
    if not parish:
        raise RuntimeError("Membership update did not persist.")

    for active in list_active_members(parish_id):
        active_uid = str(active.get("user_id") or "")
        if active_uid:
            _sync_legacy_church_profile(active_uid, parish)
    return parish
