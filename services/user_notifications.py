"""Server-backed in-app notifications for members (e.g. song approval)."""

from __future__ import annotations

import logging
from typing import Any, Optional

from services.auth_config import supabase_enabled

logger = logging.getLogger(__name__)


def _service_client():
    from services.supabase_client import get_service_client

    return get_service_client()


def create_user_notification(
    *,
    user_id: str,
    kind: str,
    message: str,
    meta: Optional[dict[str, Any]] = None,
) -> dict[str, Any]:
    uid = (user_id or "").strip()
    msg = (message or "").strip()
    if not uid or not msg or not supabase_enabled():
        return {"ok": False, "error": "unavailable"}
    try:
        row = {
            "user_id": uid,
            "kind": (kind or "info").strip()[:40] or "info",
            "message": msg[:500],
            "meta": meta if isinstance(meta, dict) else {},
        }
        result = _service_client().table("user_notifications").insert(row).execute()
        data = (result.data or [None])[0] or {}
        return {"ok": True, "notification": _format_row(data)}
    except Exception as exc:
        logger.warning("create_user_notification failed: %s", exc)
        return {"ok": False, "error": str(exc)}


def list_unseen_user_notifications(
    user_id: str,
    *,
    limit: int = 20,
) -> list[dict[str, Any]]:
    uid = (user_id or "").strip()
    if not uid or not supabase_enabled():
        return []
    try:
        result = (
            _service_client()
            .table("user_notifications")
            .select("*")
            .eq("user_id", uid)
            .is_("seen_at", "null")
            .order("created_at", desc=True)
            .limit(max(1, min(int(limit or 20), 50)))
            .execute()
        )
        return [_format_row(row) for row in (result.data or [])]
    except Exception as exc:
        logger.warning("list_unseen_user_notifications failed: %s", exc)
        return []


def mark_user_notifications_seen(
    user_id: str,
    notification_ids: list[str],
) -> dict[str, Any]:
    uid = (user_id or "").strip()
    ids = [str(x).strip() for x in (notification_ids or []) if str(x).strip()]
    if not uid or not ids or not supabase_enabled():
        return {"ok": False, "marked": 0}
    try:
        from datetime import datetime, timezone

        now = datetime.now(timezone.utc).isoformat()
        _service_client().table("user_notifications").update({"seen_at": now}).eq(
            "user_id", uid
        ).in_("id", ids).is_("seen_at", "null").execute()
        return {"ok": True, "marked": len(ids)}
    except Exception as exc:
        logger.warning("mark_user_notifications_seen failed: %s", exc)
        return {"ok": False, "marked": 0, "error": str(exc)}


def _format_row(row: dict[str, Any]) -> dict[str, Any]:
    rid = row.get("id")
    return {
        "id": str(rid) if rid is not None else "",
        "kind": row.get("kind") or "info",
        "message": row.get("message") or "",
        "meta": row.get("meta") if isinstance(row.get("meta"), dict) else {},
        "created_at": row.get("created_at") or "",
        "seen_at": row.get("seen_at"),
    }
