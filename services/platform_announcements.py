"""Platform-wide announcement banner for the home screen."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Optional

from services.auth_config import supabase_enabled
from services.platform_cache import cached_call
from services.supabase_client import get_service_client

_VALID_SEVERITIES = frozenset({"info", "warn", "success"})


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _is_live(row: dict[str, Any], *, now: datetime | None = None) -> bool:
    if not row.get("active"):
        return False
    ts = now or _now()
    starts = row.get("starts_at")
    ends = row.get("ends_at")
    if starts:
        try:
            if datetime.fromisoformat(str(starts).replace("Z", "+00:00")) > ts:
                return False
        except ValueError:
            pass
    if ends:
        try:
            if datetime.fromisoformat(str(ends).replace("Z", "+00:00")) < ts:
                return False
        except ValueError:
            pass
    return True


def _shape(row: dict[str, Any] | None) -> dict[str, Any] | None:
    if not row:
        return None
    return {
        "id": row.get("id"),
        "message": row.get("message") or "",
        "severity": row.get("severity") or "info",
        "link_url": row.get("link_url") or "",
        "link_label": row.get("link_label") or "",
        "active": bool(row.get("active")),
        "starts_at": row.get("starts_at"),
        "ends_at": row.get("ends_at"),
        "updated_at": row.get("updated_at"),
    }


def get_active_announcement() -> dict[str, Any]:
    if not supabase_enabled():
        return {"ok": True, "announcement": None}

    def _load() -> dict[str, Any]:
        client = get_service_client()
        result = (
            client.table("platform_announcements")
            .select("*")
            .eq("active", True)
            .order("updated_at", desc=True)
            .limit(5)
            .execute()
        )
        now = _now()
        for row in result.data or []:
            if _is_live(row, now=now):
                return {"ok": True, "announcement": _shape(row)}
        return {"ok": True, "announcement": None}

    return cached_call("verbum:announcement:active", 120, _load)


def get_admin_announcement() -> dict[str, Any]:
    if not supabase_enabled():
        return {"ok": True, "announcement": None}
    client = get_service_client()
    result = (
        client.table("platform_announcements")
        .select("*")
        .order("updated_at", desc=True)
        .limit(1)
        .execute()
    )
    rows = result.data or []
    return {"ok": True, "announcement": _shape(rows[0]) if rows else None}


def save_announcement(
    *,
    message: str,
    severity: str = "info",
    link_url: Optional[str] = None,
    link_label: Optional[str] = None,
    active: bool = False,
    starts_at: Optional[str] = None,
    ends_at: Optional[str] = None,
    acting_user_id: Optional[str] = None,
) -> dict[str, Any]:
    if not supabase_enabled():
        return {"ok": False, "error": "Supabase not configured."}

    text = (message or "").strip()
    if active and not text:
        return {"ok": False, "error": "Message is required when the banner is active."}

    sev = (severity or "info").strip().lower()
    if sev not in _VALID_SEVERITIES:
        return {"ok": False, "error": "Severity must be info, warn, or success."}

    now = _now().isoformat()
    payload: dict[str, Any] = {
        "message": text,
        "severity": sev,
        "link_url": (link_url or "").strip() or None,
        "link_label": (link_label or "").strip() or None,
        "active": bool(active),
        "starts_at": starts_at or None,
        "ends_at": ends_at or None,
        "updated_at": now,
        "updated_by": acting_user_id,
    }

    client = get_service_client()
    if active:
        client.table("platform_announcements").update({"active": False}).eq(
            "active", True
        ).execute()

    existing = get_admin_announcement().get("announcement")
    if existing and existing.get("id"):
        result = (
            client.table("platform_announcements")
            .update(payload)
            .eq("id", existing["id"])
            .execute()
        )
        row = (result.data or [None])[0]
    else:
        payload["created_at"] = now
        payload["created_by"] = acting_user_id
        result = client.table("platform_announcements").insert(payload).execute()
        row = (result.data or [None])[0]

    latest = _shape(row) if row else get_admin_announcement().get("announcement")
    return {"ok": True, "announcement": latest}
