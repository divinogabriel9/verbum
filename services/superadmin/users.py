"""Paginated user list for superadmin."""

from __future__ import annotations

from typing import Any, Optional

from services.auth_config import supabase_enabled
from services.supabase_client import get_service_client


def list_users(
    *,
    page: int = 1,
    per_page: int = 25,
    q: str = "",
    viewer_user_id: str = "",
) -> dict[str, Any]:
    if not supabase_enabled():
        return {"ok": True, "items": [], "total": 0, "page": page, "per_page": per_page}

    page = max(1, page)
    per_page = max(1, min(per_page, 100))
    offset = (page - 1) * per_page
    query_text = (q or "").strip().lower()

    client = get_service_client()
    query = (
        client.table("profiles")
        .select("id, email, first_name, last_name, role, created_at, updated_at", count="exact")
        .order("created_at", desc=True)
    )
    if query_text:
        query = query.or_(f"email.ilike.%{query_text}%,first_name.ilike.%{query_text}%,last_name.ilike.%{query_text}%")

    result = query.range(offset, offset + per_page - 1).execute()
    rows = list(result.data or [])
    total = int(result.count or len(rows))

    user_ids = [r["id"] for r in rows if r.get("id")]
    member_by_user: dict[str, dict[str, Any]] = {}
    parish_by_id: dict[str, dict[str, Any]] = {}
    church_by_user: dict[str, dict[str, Any]] = {}

    if user_ids:
        try:
            member_result = (
                client.table("parish_members")
                .select("user_id, parish_id, role, status")
                .in_("user_id", user_ids)
                .eq("status", "active")
                .execute()
            )
            member_by_user = {m["user_id"]: m for m in (member_result.data or [])}
            parish_ids = [m["parish_id"] for m in (member_result.data or []) if m.get("parish_id")]
            if parish_ids:
                parish_result = (
                    client.table("parishes")
                    .select("id, community_name, membership_status")
                    .in_("id", parish_ids)
                    .execute()
                )
                parish_by_id = {p["id"]: p for p in (parish_result.data or [])}
        except Exception:
            member_by_user = {}

        if not member_by_user:
            church_result = (
                client.table("church_profiles")
                .select("user_id, community_name, membership_status")
                .in_("user_id", user_ids)
                .execute()
            )
            church_by_user = {c["user_id"]: c for c in (church_result.data or [])}

    items: list[dict[str, Any]] = []
    for row in rows:
        uid = row.get("id")
        member = member_by_user.get(uid) or {}
        parish = parish_by_id.get(member.get("parish_id")) if member else None
        church = church_by_user.get(uid) or {}
        parish_name = (parish or {}).get("community_name") or church.get("community_name") or ""
        membership_status = (
            (parish or {}).get("membership_status")
            or church.get("membership_status")
            or "draft"
        )
        parish_role = (member.get("role") or "").strip().lower() or None
        parish_id = str(member.get("parish_id") or "") if member else ""
        platform_role = (row.get("role") or "member").strip().lower()
        uid_str = str(uid or "")
        can_delete = (
            uid_str
            and uid_str != (viewer_user_id or "").strip()
            and platform_role != "superadmin"
        )
        items.append(
            {
                **row,
                "parish_id": parish_id or None,
                "parish_name": parish_name,
                "membership_status": membership_status,
                "parish_role": parish_role,
                "can_delete": can_delete,
                "can_set_parish_role": platform_role != "superadmin",
            }
        )

    return {"ok": True, "items": items, "total": total, "page": page, "per_page": per_page}


def delete_user(user_id: str, *, acting_user_id: str) -> dict[str, Any]:
    uid = (user_id or "").strip()
    actor = (acting_user_id or "").strip()
    if not uid:
        raise ValueError("user_id is required.")
    if uid == actor:
        raise ValueError("You cannot delete your own account.")
    if not supabase_enabled():
        raise RuntimeError("Supabase is not configured.")

    client = get_service_client()
    prof_result = client.table("profiles").select("id, email, role").eq("id", uid).limit(1).execute()
    rows = prof_result.data or []
    if not rows:
        raise ValueError("User not found.")
    profile = rows[0]
    if (profile.get("role") or "").strip().lower() == "superadmin":
        raise ValueError("Superadmin accounts cannot be deleted from the app.")

    parish_ids: set[str] = set()
    try:
        member_result = (
            client.table("parish_members")
            .select("parish_id")
            .eq("user_id", uid)
            .execute()
        )
        parish_ids = {str(m["parish_id"]) for m in (member_result.data or []) if m.get("parish_id")}
    except Exception:
        parish_ids = set()

    try:
        client.auth.admin.delete_user(uid)
    except Exception as exc:
        raise RuntimeError(f"Could not delete user: {exc}") from exc

    for parish_id in parish_ids:
        try:
            count_result = (
                client.table("parish_members")
                .select("id", count="exact")
                .eq("parish_id", parish_id)
                .eq("status", "active")
                .limit(0)
                .execute()
            )
            if int(count_result.count or 0) == 0:
                client.table("parishes").delete().eq("id", parish_id).execute()
        except Exception:
            pass

    return {"ok": True, "deleted_user_id": uid, "email": profile.get("email")}


def set_user_parish_role(
    user_id: str,
    role: str,
    *,
    parish_id: Optional[str] = None,
) -> dict[str, Any]:
    from services.parish_store import assign_user_to_parish, get_member_for_user, set_member_role

    uid = (user_id or "").strip()
    role = (role or "").strip().lower()
    if role not in {"president", "media"}:
        raise ValueError("role must be president or media.")

    pid = (parish_id or "").strip()
    if pid:
        member = assign_user_to_parish(uid, pid, role)
        return {"ok": True, "member": member, "parish_id": pid, "role": role}

    existing = get_member_for_user(uid)
    if not existing:
        raise ValueError("User has no parish. Provide parish_id to assign one.")
    member = set_member_role(uid, role)
    return {
        "ok": True,
        "member": member,
        "parish_id": member.get("parish_id"),
        "role": role,
    }
