"""Paginated parish list for superadmin (shared parishes model)."""

from __future__ import annotations

from typing import Any

from services.auth_config import supabase_enabled
from services.parish_store import PARISH_MEMBER_LIMIT
from services.supabase_client import get_service_client


def list_parishes(*, page: int = 1, per_page: int = 25, q: str = "") -> dict[str, Any]:
    if not supabase_enabled():
        return {"ok": True, "items": [], "total": 0, "page": page, "per_page": per_page}

    page = max(1, page)
    per_page = max(1, min(per_page, 100))
    offset = (page - 1) * per_page
    query_text = (q or "").strip().lower()

    client = get_service_client()

    parish_rows: list[dict[str, Any]] = []
    total = 0

    try:
        query = (
            client.table("parishes")
            .select(
                "id, community_name, membership_status, logo_path, created_at, updated_at",
                count="exact",
            )
            .order("updated_at", desc=True)
        )
        if query_text:
            query = query.ilike("community_name", f"%{query_text}%")
        result = query.range(offset, offset + per_page - 1).execute()
        parish_rows = list(result.data or [])
        total = int(result.count or len(parish_rows))
    except Exception:
        parish_rows = []
        total = 0

    if not parish_rows:
        return _list_legacy_church_profiles(page=page, per_page=per_page, q=query_text, offset=offset)

    parish_ids = [r["id"] for r in parish_rows if r.get("id")]
    members_by_parish: dict[str, list[dict[str, Any]]] = {pid: [] for pid in parish_ids}
    if parish_ids:
        members_result = (
            client.table("parish_members")
            .select("parish_id, user_id, role, status")
            .in_("parish_id", parish_ids)
            .eq("status", "active")
            .execute()
        )
        for member in members_result.data or []:
            pid = member.get("parish_id")
            if pid in members_by_parish:
                members_by_parish[pid].append(member)

    president_by_parish: dict[str, str] = {}
    if parish_ids:
        presidents_result = (
            client.table("parish_members")
            .select("parish_id, user_id")
            .in_("parish_id", parish_ids)
            .eq("role", "president")
            .eq("status", "active")
            .execute()
        )
        for row in presidents_result.data or []:
            president_by_parish[row["parish_id"]] = row["user_id"]

    president_ids = list(president_by_parish.values())

    profiles_by_id: dict[str, dict[str, Any]] = {}
    if president_ids:
        prof_result = (
            client.table("profiles")
            .select("id, email, first_name, last_name, role")
            .in_("id", president_ids)
            .execute()
        )
        profiles_by_id = {p["id"]: p for p in (prof_result.data or [])}

    items: list[dict[str, Any]] = []
    for row in parish_rows:
        pid = row.get("id")
        members = members_by_parish.get(pid) or []
        president_uid = president_by_parish.get(pid)
        prof = profiles_by_id.get(president_uid) or {}
        members_count = len(members)
        items.append(
            {
                **row,
                "user_id": president_uid,
                "owner_email": prof.get("email"),
                "owner_name": " ".join(
                    x for x in [prof.get("first_name"), prof.get("last_name")] if x
                ).strip()
                or None,
                "owner_role": prof.get("role"),
                "members_count": members_count,
                "members_limit": PARISH_MEMBER_LIMIT,
                "members_label": f"{members_count}/{PARISH_MEMBER_LIMIT}",
            }
        )

    return {"ok": True, "items": items, "total": total, "page": page, "per_page": per_page}


def _list_legacy_church_profiles(
    *, page: int, per_page: int, q: str, offset: int
) -> dict[str, Any]:
    client = get_service_client()
    query = (
        client.table("church_profiles")
        .select(
            "id, user_id, community_name, membership_status, logo_path, created_at, updated_at",
            count="exact",
        )
        .order("updated_at", desc=True)
    )
    if q:
        query = query.ilike("community_name", f"%{q}%")

    result = query.range(offset, offset + per_page - 1).execute()
    rows = list(result.data or [])
    total = int(result.count or len(rows))

    user_ids = [r["user_id"] for r in rows if r.get("user_id")]
    profiles_by_id: dict[str, dict[str, Any]] = {}
    if user_ids:
        prof_result = (
            client.table("profiles")
            .select("id, email, first_name, last_name, role")
            .in_("id", user_ids)
            .execute()
        )
        profiles_by_id = {p["id"]: p for p in (prof_result.data or [])}

    items: list[dict[str, Any]] = []
    for row in rows:
        prof = profiles_by_id.get(row.get("user_id")) or {}
        items.append(
            {
                **row,
                "owner_email": prof.get("email"),
                "owner_name": " ".join(
                    x for x in [prof.get("first_name"), prof.get("last_name")] if x
                ).strip()
                or None,
                "owner_role": prof.get("role"),
                "members_count": 1,
                "members_limit": PARISH_MEMBER_LIMIT,
                "members_label": f"1/{PARISH_MEMBER_LIMIT}",
            }
        )

    return {"ok": True, "items": items, "total": total, "page": page, "per_page": per_page}


def get_parish_detail(parish_id: str) -> dict[str, Any]:
    """Full parish snapshot for superadmin detail drawer."""
    if not supabase_enabled():
        return {"ok": False, "error": "Supabase not configured."}

    pid = (parish_id or "").strip()
    if not pid:
        return {"ok": False, "error": "Parish id required."}

    client = get_service_client()
    parish_result = (
        client.table("parishes").select("*").eq("id", pid).limit(1).execute()
    )
    parish_rows = list(parish_result.data or [])
    if not parish_rows:
        return {"ok": False, "error": "Parish not found."}
    parish = parish_rows[0]

    members_result = (
        client.table("parish_members")
        .select("id, user_id, role, status, created_at")
        .eq("parish_id", pid)
        .eq("status", "active")
        .order("role")
        .execute()
    )
    members = list(members_result.data or [])
    user_ids = [m["user_id"] for m in members if m.get("user_id")]

    profiles_by_id: dict[str, dict[str, Any]] = {}
    if user_ids:
        prof_result = (
            client.table("profiles")
            .select("id, email, first_name, last_name, role")
            .in_("id", user_ids)
            .execute()
        )
        profiles_by_id = {p["id"]: p for p in (prof_result.data or [])}

    member_items: list[dict[str, Any]] = []
    for member in members:
        uid = member.get("user_id")
        prof = profiles_by_id.get(uid) or {}
        member_items.append(
            {
                **member,
                "email": prof.get("email") or "",
                "name": " ".join(
                    x for x in [prof.get("first_name"), prof.get("last_name")] if x
                ).strip()
                or None,
                "platform_role": prof.get("role") or "member",
            }
        )

    from services.image_generation_quota import DAILY_IMAGE_LIMIT, _utc_date, get_quota_status

    subject = f"parish:{pid}"
    quota_status = get_quota_status(subject)
    quota = {
        "subject": subject,
        "date": _utc_date(),
        "used": int(quota_status.get("used") or 0),
        "remaining": int(quota_status.get("remaining") or 0),
        "limit": int(quota_status.get("limit") or DAILY_IMAGE_LIMIT),
        "allowed": bool(quota_status.get("allowed")),
    }

    recent_generations: list[dict[str, Any]] = []
    if user_ids:
        gen_result = (
            client.table("generation_history")
            .select("id, user_id, mass_date, celebrant, output_summary, created_at")
            .in_("user_id", user_ids)
            .order("created_at", desc=True)
            .limit(10)
            .execute()
        )
        for row in gen_result.data or []:
            uid = row.get("user_id")
            prof = profiles_by_id.get(uid) or {}
            summary = row.get("output_summary") if isinstance(row.get("output_summary"), dict) else {}
            recent_generations.append(
                {
                    "id": row.get("id"),
                    "mass_date": row.get("mass_date"),
                    "celebrant": row.get("celebrant"),
                    "title": summary.get("title"),
                    "slide_count": summary.get("slide_count"),
                    "created_at": row.get("created_at"),
                    "user_email": prof.get("email") or "",
                }
            )

    celebrants = parish.get("celebrant_names") or []
    if not isinstance(celebrants, list):
        celebrants = []

    president_uid = None
    for member in member_items:
        if str(member.get("role") or "") == "president":
            president_uid = member.get("user_id")
            break

    return {
        "ok": True,
        "parish": {
            "id": pid,
            "community_name": parish.get("community_name") or "",
            "membership_status": parish.get("membership_status") or "draft",
            "logo_path": parish.get("logo_path"),
            "celebrant_names": celebrants,
            "created_at": parish.get("created_at"),
            "updated_at": parish.get("updated_at"),
            "members_count": len(member_items),
            "members_limit": PARISH_MEMBER_LIMIT,
            "president_user_id": president_uid,
        },
        "members": member_items,
        "quota": quota,
        "recent_generations": recent_generations,
    }


def list_parish_options(*, limit: int = 200) -> list[dict[str, Any]]:
    if not supabase_enabled():
        return []
    client = get_service_client()
    try:
        result = (
            client.table("parishes")
            .select("id, community_name, membership_status")
            .order("community_name")
            .limit(max(1, min(limit, 500)))
            .execute()
        )
        return [
            {
                "id": r.get("id"),
                "community_name": r.get("community_name") or "",
                "membership_status": r.get("membership_status") or "draft",
            }
            for r in (result.data or [])
        ]
    except Exception:
        return []
