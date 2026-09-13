"""Distribution interaction (outreach) logging."""

from __future__ import annotations

import logging
from typing import Any, Optional

from services.distribution._client import require_client, utc_now_iso
from services.distribution.activities import log_activity
from services.distribution.constants import INTERACTION_TYPES

logger = logging.getLogger(__name__)


def create_interaction(
    church_id: str,
    *,
    interaction_type: str,
    summary: str = "",
    result: Optional[str] = None,
    next_action: Optional[str] = None,
    interacted_at: Optional[str] = None,
    actor_user_id: Optional[str] = None,
) -> dict[str, Any]:
    cid = (church_id or "").strip()
    if not cid:
        raise ValueError("church_id is required.")
    itype = (interaction_type or "").strip().lower()
    if itype not in INTERACTION_TYPES:
        raise ValueError(f"interaction_type must be one of: {', '.join(INTERACTION_TYPES)}")

    now = utc_now_iso()
    when = interacted_at or now
    payload: dict[str, Any] = {
        "church_id": cid,
        "interaction_type": itype,
        "summary": (summary or "").strip(),
        "result": (result or "").strip() or None,
        "next_action": (next_action or "").strip() or None,
        "interacted_at": when,
    }
    actor = (actor_user_id or "").strip() or None
    if actor:
        payload["actor_user_id"] = actor

    client = require_client()
    inserted = client.table("distribution_interactions").insert(payload).execute()
    rows = inserted.data or []
    if not rows:
        raise RuntimeError("Interaction did not persist.")
    row = rows[0]

    # Bump contact counters on the church.
    church = (
        client.table("distribution_churches")
        .select("id, contact_count")
        .eq("id", cid)
        .limit(1)
        .execute()
    )
    church_rows = church.data or []
    if church_rows:
        prev_count = int(church_rows[0].get("contact_count") or 0)
        client.table("distribution_churches").update(
            {
                "contact_count": prev_count + 1,
                "last_contacted_at": when,
            }
        ).eq("id", cid).execute()

    try:
        log_activity(
            cid,
            "interaction",
            f"Logged {itype} interaction",
            actor_user_id=actor,
            detail={
                "interaction_id": row.get("id"),
                "interaction_type": itype,
                "summary": payload["summary"],
            },
            occurred_at=when,
        )
    except Exception:
        logger.exception("Failed to log interaction activity for church %s", cid)

    return row


def list_interactions(church_id: str, *, limit: int = 100) -> list[dict[str, Any]]:
    cid = (church_id or "").strip()
    if not cid:
        return []
    client = require_client()
    result = (
        client.table("distribution_interactions")
        .select("*")
        .eq("church_id", cid)
        .order("interacted_at", desc=True)
        .limit(max(1, min(limit, 500)))
        .execute()
    )
    return list(result.data or [])
