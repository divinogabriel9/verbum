"""Distribution activity timeline helpers."""

from __future__ import annotations

import logging
from typing import Any, Optional

from services.distribution._client import require_client, utc_now_iso

logger = logging.getLogger(__name__)


def log_activity(
    church_id: str,
    activity_type: str,
    summary: str,
    *,
    actor_user_id: Optional[str] = None,
    detail: Optional[dict[str, Any]] = None,
    occurred_at: Optional[str] = None,
) -> dict[str, Any]:
    """Insert a timeline row for a distribution church."""
    cid = (church_id or "").strip()
    if not cid:
        raise ValueError("church_id is required.")
    atype = (activity_type or "").strip()
    if not atype:
        raise ValueError("activity_type is required.")
    payload: dict[str, Any] = {
        "church_id": cid,
        "activity_type": atype,
        "summary": (summary or "").strip() or atype,
        "detail": detail or {},
        "occurred_at": occurred_at or utc_now_iso(),
    }
    actor = (actor_user_id or "").strip() or None
    if actor:
        payload["actor_user_id"] = actor

    client = require_client()
    result = client.table("distribution_activities").insert(payload).execute()
    rows = result.data or []
    if not rows:
        raise RuntimeError("Activity log did not persist.")
    return rows[0]


def list_activities(church_id: str, *, limit: int = 100) -> list[dict[str, Any]]:
    cid = (church_id or "").strip()
    if not cid:
        return []
    client = require_client()
    result = (
        client.table("distribution_activities")
        .select("*")
        .eq("church_id", cid)
        .order("occurred_at", desc=True)
        .limit(max(1, min(limit, 500)))
        .execute()
    )
    return list(result.data or [])
