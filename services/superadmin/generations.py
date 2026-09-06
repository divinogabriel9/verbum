"""Paginated generation history for superadmin."""

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


def list_generations(*, page: int = 1, per_page: int = 25, q: str = "") -> dict[str, Any]:
    if not supabase_enabled():
        return {"ok": True, "items": [], "total": 0, "page": page, "per_page": per_page}

    page = max(1, page)
    per_page = max(1, min(per_page, 100))
    offset = (page - 1) * per_page
    query_text = (q or "").strip().lower()

    client = get_service_client()
    query = (
        client.table("generation_history")
        .select("id, user_id, mass_date, celebrant, output_summary, created_at", count="exact")
        .order("created_at", desc=True)
    )
    if query_text:
        query = query.or_(f"celebrant.ilike.%{query_text}%,mass_date.ilike.%{query_text}%")

    result = query.range(offset, offset + per_page - 1).execute()
    rows = list(result.data or [])
    total = int(result.count or len(rows))

    user_ids = [r["user_id"] for r in rows if r.get("user_id")]
    profiles_by_id: dict[str, dict[str, Any]] = {}
    church_by_user: dict[str, dict[str, Any]] = {}
    parish_by_user: dict[str, str] = {}
    if user_ids:
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
            church_by_user = {c["user_id"]: c for c in (church_result.data or [])}
        except Exception:
            church_by_user = {}
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
            parish_by_user = {}

    items: list[dict[str, Any]] = []
    for row in rows:
        uid = row.get("user_id")
        prof = profiles_by_id.get(uid) or {}
        church = church_by_user.get(uid) or {}
        summary = row.get("output_summary") or {}
        items.append(
            {
                **row,
                "user_name": _display_name(prof),
                "user_email": prof.get("email") or "",
                "parish_name": church.get("community_name") or parish_by_user.get(uid) or "",
                "title": summary.get("title"),
                "slide_count": summary.get("slide_count"),
            }
        )

    return {"ok": True, "items": items, "total": total, "page": page, "per_page": per_page}
