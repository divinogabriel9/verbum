"""Paginated generation history for superadmin (grouped by user)."""

from __future__ import annotations

from typing import Any

from services.auth_config import supabase_enabled
from services.supabase_client import get_service_client


def _display_name(prof: dict[str, Any]) -> str:
    name = " ".join(
        part
        for part in [
            (prof.get("first_name") or "").strip(),
            (prof.get("last_name") or "").strip(),
        ]
        if part
    ).strip()
    return name or (prof.get("email") or "").strip() or ""


def _enrich_profiles_and_parishes(
    client: Any, user_ids: list[str]
) -> tuple[dict[str, dict[str, Any]], dict[str, str]]:
    profiles_by_id: dict[str, dict[str, Any]] = {}
    parish_by_user: dict[str, str] = {}
    if not user_ids:
        return profiles_by_id, parish_by_user

    prof_result = (
        client.table("profiles")
        .select("id, email, first_name, last_name")
        .in_("id", user_ids)
        .execute()
    )
    profiles_by_id = {p["id"]: p for p in (prof_result.data or [])}

    try:
        church_result = (
            client.table("church_profiles")
            .select("user_id, community_name")
            .in_("user_id", user_ids)
            .execute()
        )
        for c in church_result.data or []:
            uid = c.get("user_id")
            name = (c.get("community_name") or "").strip()
            if uid and name and uid not in parish_by_user:
                parish_by_user[uid] = name
    except Exception:
        pass

    try:
        members = (
            client.table("parish_members")
            .select("user_id, parish_id")
            .in_("user_id", user_ids)
            .eq("status", "active")
            .execute()
        )
        parish_ids = list(
            {str(m["parish_id"]) for m in (members.data or []) if m.get("parish_id")}
        )
        parishes_by_id: dict[str, dict[str, Any]] = {}
        if parish_ids:
            parish_result = (
                client.table("parishes")
                .select("id, community_name")
                .in_("id", parish_ids)
                .execute()
            )
            parishes_by_id = {p["id"]: p for p in (parish_result.data or [])}
        for m in members.data or []:
            uid = m.get("user_id")
            parish = parishes_by_id.get(m.get("parish_id")) or {}
            name = (parish.get("community_name") or "").strip()
            if uid and name and uid not in parish_by_user:
                parish_by_user[uid] = name
    except Exception:
        pass

    return profiles_by_id, parish_by_user


def _find_user_ids_for_query(client: Any, query_text: str) -> list[str]:
    """Match profiles by email / name for generation search."""
    q = (query_text or "").strip()
    if not q:
        return []
    try:
        result = (
            client.table("profiles")
            .select("id")
            .or_(
                f"email.ilike.%{q}%,first_name.ilike.%{q}%,last_name.ilike.%{q}%"
            )
            .limit(100)
            .execute()
        )
        return [str(p["id"]) for p in (result.data or []) if p.get("id")]
    except Exception:
        return []


def list_generations(*, page: int = 1, per_page: int = 10, q: str = "") -> dict[str, Any]:
    """Return generation runs paginated by user (newest users first).

    ``total`` / ``per_page`` are user counts so the accordion list isn't buried
    when one account has hundreds of recent runs.
    """
    if not supabase_enabled():
        return {
            "ok": True,
            "items": [],
            "total": 0,
            "page": page,
            "per_page": per_page,
            "group_by": "user",
        }

    page = max(1, page)
    per_page = max(1, min(per_page, 50))
    query_text = (q or "").strip()
    runs_per_user = 30
    scan_limit = 2500

    client = get_service_client()
    matched_user_ids = _find_user_ids_for_query(client, query_text) if query_text else []

    query = (
        client.table("generation_history")
        .select("id, user_id, mass_date, celebrant, output_summary, created_at, parish_id")
        .order("created_at", desc=True)
        .limit(scan_limit)
    )
    if matched_user_ids:
        query = query.in_("user_id", matched_user_ids)
    elif query_text:
        # No profile hit — fall back to celebrant / mass date text match.
        query = query.or_(
            f"celebrant.ilike.%{query_text}%,mass_date.ilike.%{query_text}%"
        )

    result = query.execute()
    rows = list(result.data or [])

    groups: dict[str, list[dict[str, Any]]] = {}
    order: list[str] = []
    for row in rows:
        uid = str(row.get("user_id") or "").strip() or "unknown"
        if uid not in groups:
            groups[uid] = []
            order.append(uid)
        if len(groups[uid]) < runs_per_user:
            groups[uid].append(row)

    total_users = len(order)
    offset = (page - 1) * per_page
    page_user_ids = order[offset : offset + per_page]

    profiles_by_id, parish_by_user = _enrich_profiles_and_parishes(
        client, [uid for uid in page_user_ids if uid != "unknown"]
    )

    items: list[dict[str, Any]] = []
    for uid in page_user_ids:
        prof = profiles_by_id.get(uid) or {}
        for row in groups.get(uid) or []:
            summary = row.get("output_summary") or {}
            items.append(
                {
                    **row,
                    "user_name": _display_name(prof),
                    "user_email": prof.get("email") or "",
                    "parish_name": parish_by_user.get(uid) or "",
                    "title": summary.get("title"),
                    "slide_count": summary.get("slide_count"),
                }
            )

    return {
        "ok": True,
        "items": items,
        "total": total_users,
        "page": page,
        "per_page": per_page,
        "group_by": "user",
    }
