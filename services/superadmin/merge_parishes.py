"""Merge duplicate parish records (superadmin)."""

from __future__ import annotations

import logging
from typing import Any, Optional

from services.auth_config import supabase_enabled
from services.parish_store import (
    PARISH_MEMBER_LIMIT,
    get_parish_by_id,
    list_active_members,
    _sync_legacy_church_profile,
)
from services.supabase_client import get_service_client

logger = logging.getLogger(__name__)


def _log_merge(
    *,
    actor_user_id: Optional[str],
    source_id: str,
    target_id: str,
    detail: dict[str, Any],
) -> None:
    if not supabase_enabled():
        return
    try:
        get_service_client().table("admin_audit_log").insert(
            {
                "actor_user_id": actor_user_id,
                "action": "merge",
                "entity_type": "parish",
                "entity_id": source_id,
                "detail": {"target_id": target_id, **detail},
            }
        ).execute()
    except Exception as exc:
        logger.warning("admin_audit_log merge insert failed: %s", exc)


def merge_parishes(
    source_id: str,
    target_id: str,
    *,
    acting_user_id: Optional[str] = None,
) -> dict[str, Any]:
    if not supabase_enabled():
        return {"ok": False, "error": "Supabase not configured."}

    src = (source_id or "").strip()
    tgt = (target_id or "").strip()
    if not src or not tgt:
        return {"ok": False, "error": "Source and target parish ids are required."}
    if src == tgt:
        return {"ok": False, "error": "Source and target must be different parishes."}

    source = get_parish_by_id(src)
    target = get_parish_by_id(tgt)
    if not source:
        return {"ok": False, "error": "Source parish not found."}
    if not target:
        return {"ok": False, "error": "Target parish not found."}

    client = get_service_client()
    source_members = list_active_members(src)
    target_members = list_active_members(tgt)
    target_user_ids = {str(m.get("user_id") or "") for m in target_members}
    target_has_president = any(
        str(m.get("role") or "") == "president" for m in target_members
    )
    target_count = len(target_members)

    moved = 0
    skipped = 0
    for member in source_members:
        uid = str(member.get("user_id") or "")
        mid = member.get("id")
        if not uid or not mid:
            continue
        if uid in target_user_ids:
            client.table("parish_members").update({"status": "removed"}).eq(
                "id", mid
            ).execute()
            skipped += 1
            continue
        if target_count >= PARISH_MEMBER_LIMIT:
            return {
                "ok": False,
                "error": f"Target parish already has {PARISH_MEMBER_LIMIT} members.",
            }
        role = str(member.get("role") or "media")
        if role == "president" and target_has_president:
            role = "media"
        client.table("parish_members").update(
            {"parish_id": tgt, "role": role}
        ).eq("id", mid).execute()
        target_user_ids.add(uid)
        target_count += 1
        moved += 1
        if role == "president":
            target_has_president = True
        refreshed = get_parish_by_id(tgt)
        if refreshed:
            _sync_legacy_church_profile(uid, refreshed)

    src_celebrants = source.get("celebrant_names") or []
    tgt_celebrants = target.get("celebrant_names") or []
    if not isinstance(src_celebrants, list):
        src_celebrants = []
    if not isinstance(tgt_celebrants, list):
        tgt_celebrants = []
    seen_lower: set[str] = set()
    merged: list[str] = []
    for name in [*tgt_celebrants, *src_celebrants]:
        clean = str(name or "").strip()
        if not clean:
            continue
        key = clean.lower()
        if key in seen_lower:
            continue
        seen_lower.add(key)
        merged.append(clean)

    updates: dict[str, Any] = {"celebrant_names": merged}
    if not (target.get("logo_path") or "").strip() and (source.get("logo_path") or "").strip():
        updates["logo_path"] = source.get("logo_path")
    if (target.get("membership_status") or "") != "approved" and (
        source.get("membership_status") or ""
    ) == "approved":
        updates["membership_status"] = "approved"

    client.table("parishes").update(updates).eq("id", tgt).execute()

    for table in ("content_submissions", "platform_invites", "parish_invites"):
        try:
            client.table(table).update({"parish_id": tgt}).eq("parish_id", src).execute()
        except Exception:
            logger.warning("Could not repoint %s rows during parish merge.", table)

    client.table("parishes").delete().eq("id", src).execute()

    detail = {
        "source_name": source.get("community_name") or "",
        "target_name": target.get("community_name") or "",
        "moved_members": moved,
        "skipped_duplicates": skipped,
    }
    _log_merge(
        actor_user_id=acting_user_id,
        source_id=src,
        target_id=tgt,
        detail=detail,
    )

    return {
        "ok": True,
        "target_id": tgt,
        "source_id": src,
        **detail,
    }
