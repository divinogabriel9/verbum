"""Paginated superadmin audit log."""

from __future__ import annotations

from typing import Any

from services.auth_config import supabase_enabled
from services.supabase_client import get_service_client


def list_audit_log(
    *,
    page: int = 1,
    per_page: int = 25,
    q: str = "",
    action: str = "",
    entity_type: str = "",
) -> dict[str, Any]:
    if not supabase_enabled():
        return {"ok": True, "items": [], "total": 0, "page": page, "per_page": per_page}

    page = max(1, page)
    per_page = max(1, min(per_page, 100))
    offset = (page - 1) * per_page
    query_text = (q or "").strip()
    action_filter = (action or "").strip()
    entity_filter = (entity_type or "").strip()

    client = get_service_client()
    query = (
        client.table("admin_audit_log")
        .select("*", count="exact")
        .order("created_at", desc=True)
    )
    if action_filter:
        query = query.eq("action", action_filter)
    if entity_filter:
        query = query.eq("entity_type", entity_filter)
    if query_text:
        safe = query_text.replace(",", " ")
        query = query.or_(
            f"entity_id.ilike.%{safe}%,action.ilike.%{safe}%,entity_type.ilike.%{safe}%"
        )

    result = query.range(offset, offset + per_page - 1).execute()
    rows = list(result.data or [])
    total = int(result.count or len(rows))

    actor_ids = [r["actor_user_id"] for r in rows if r.get("actor_user_id")]
    profiles_by_id: dict[str, dict[str, Any]] = {}
    if actor_ids:
        prof_result = (
            client.table("profiles")
            .select("id, email, first_name, last_name")
            .in_("id", actor_ids)
            .execute()
        )
        profiles_by_id = {p["id"]: p for p in (prof_result.data or [])}

    items: list[dict[str, Any]] = []
    for row in rows:
        actor_id = row.get("actor_user_id")
        prof = profiles_by_id.get(actor_id) or {}
        detail = row.get("detail") if isinstance(row.get("detail"), dict) else {}
        actor_name = " ".join(
            x for x in [prof.get("first_name"), prof.get("last_name")] if x
        ).strip()
        items.append(
            {
                "id": row.get("id"),
                "action": row.get("action") or "",
                "entity_type": row.get("entity_type") or "",
                "entity_id": row.get("entity_id") or "",
                "detail": detail,
                "created_at": row.get("created_at") or "",
                "actor_user_id": actor_id,
                "actor_email": prof.get("email") or "",
                "actor_name": actor_name or None,
            }
        )

    return {"ok": True, "items": items, "total": total, "page": page, "per_page": per_page}
