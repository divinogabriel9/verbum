"""Distribution campaign CRUD and church association."""

from __future__ import annotations

import logging
from collections import Counter
from typing import Any, Optional

from services.distribution._client import require_client, utc_now_iso
from services.distribution.constants import CAMPAIGN_STATUSES, PIPELINE_STATUSES

logger = logging.getLogger(__name__)

_CAMPAIGN_FIELDS = frozenset(
    {
        "name",
        "description",
        "country",
        "city",
        "diocese",
        "language",
        "target_church_type",
        "start_date",
        "end_date",
        "status",
    }
)


def _clean_campaign(payload: dict[str, Any]) -> dict[str, Any]:
    out: dict[str, Any] = {}
    for key, value in (payload or {}).items():
        if key not in _CAMPAIGN_FIELDS:
            continue
        if key == "status" and value is not None:
            status = str(value).strip().lower()
            if status not in CAMPAIGN_STATUSES:
                raise ValueError(f"Invalid campaign status: {value}")
            out[key] = status
            continue
        if isinstance(value, str):
            cleaned = value.strip()
            out[key] = cleaned if cleaned else None
        else:
            out[key] = value
    return out


def list_campaigns(*, status: Optional[str] = None, limit: int = 100) -> list[dict[str, Any]]:
    client = require_client()
    query = client.table("distribution_campaigns").select("*").order(
        "created_at", desc=True
    ).limit(max(1, min(limit, 200)))
    if status:
        query = query.eq("status", str(status).strip().lower())
    result = query.execute()
    campaigns = list(result.data or [])
    if not campaigns:
        return []
    ids = [str(c["id"]) for c in campaigns if c.get("id")]
    links = (
        client.table("distribution_campaign_churches")
        .select("campaign_id, church_id")
        .in_("campaign_id", ids)
        .execute()
    )
    counts: Counter[str] = Counter()
    for link in links.data or []:
        counts[str(link.get("campaign_id"))] += 1
    for c in campaigns:
        c["church_count"] = counts.get(str(c.get("id")), 0)
    return campaigns


def get_campaign(campaign_id: str) -> dict[str, Any]:
    cid = (campaign_id or "").strip()
    if not cid:
        raise ValueError("campaign_id is required.")
    client = require_client()
    result = (
        client.table("distribution_campaigns").select("*").eq("id", cid).limit(1).execute()
    )
    rows = result.data or []
    if not rows:
        raise ValueError("Campaign not found.")
    campaign = rows[0]
    links = (
        client.table("distribution_campaign_churches")
        .select("church_id, added_at")
        .eq("campaign_id", cid)
        .execute()
    )
    church_ids = [str(r["church_id"]) for r in (links.data or []) if r.get("church_id")]
    churches: list[dict[str, Any]] = []
    if church_ids:
        ch = (
            client.table("distribution_churches")
            .select("*")
            .in_("id", church_ids)
            .execute()
        )
        churches = list(ch.data or [])
    campaign["churches"] = churches
    campaign["church_count"] = len(churches)
    campaign["stats"] = campaign_stats(cid, churches=churches)
    return campaign


def create_campaign(
    payload: dict[str, Any],
    *,
    created_by: Optional[str] = None,
) -> dict[str, Any]:
    data = _clean_campaign(payload or {})
    name = (data.get("name") or "").strip()
    if not name:
        raise ValueError("name is required.")
    data["name"] = name
    if "status" not in data:
        data["status"] = "active"
    if created_by:
        data["created_by"] = created_by
    client = require_client()
    result = client.table("distribution_campaigns").insert(data).execute()
    rows = result.data or []
    if not rows:
        raise RuntimeError("Campaign create did not persist.")
    return rows[0]


def update_campaign(campaign_id: str, payload: dict[str, Any]) -> dict[str, Any]:
    cid = (campaign_id or "").strip()
    if not cid:
        raise ValueError("campaign_id is required.")
    data = _clean_campaign(payload or {})
    if not data:
        return get_campaign(cid)
    client = require_client()
    result = client.table("distribution_campaigns").update(data).eq("id", cid).execute()
    rows = result.data or []
    if not rows:
        raise RuntimeError("Campaign update did not persist.")
    return rows[0]


def associate_churches(campaign_id: str, church_ids: list[str]) -> dict[str, Any]:
    cid = (campaign_id or "").strip()
    if not cid:
        raise ValueError("campaign_id is required.")
    ids = [str(x).strip() for x in (church_ids or []) if str(x).strip()]
    if not ids:
        raise ValueError("church_ids is required.")
    get_campaign(cid)  # validate exists
    client = require_client()
    rows = [{"campaign_id": cid, "church_id": hid} for hid in ids]
    # Upsert-ish: insert one-by-one ignoring duplicates
    added = 0
    for row in rows:
        try:
            client.table("distribution_campaign_churches").insert(row).execute()
            added += 1
        except Exception:
            logger.debug("campaign church already linked: %s", row)
    return {"ok": True, "campaign_id": cid, "added": added, "requested": len(ids)}


def disassociate_church(campaign_id: str, church_id: str) -> dict[str, Any]:
    cid = (campaign_id or "").strip()
    hid = (church_id or "").strip()
    if not cid or not hid:
        raise ValueError("campaign_id and church_id are required.")
    client = require_client()
    client.table("distribution_campaign_churches").delete().eq("campaign_id", cid).eq(
        "church_id", hid
    ).execute()
    return {"ok": True, "campaign_id": cid, "church_id": hid}


def campaign_stats(
    campaign_id: str,
    *,
    churches: Optional[list[dict[str, Any]]] = None,
) -> dict[str, Any]:
    if churches is None:
        campaign = get_campaign(campaign_id)
        churches = list(campaign.get("churches") or [])
    by_stage: dict[str, int] = {s: 0 for s in PIPELINE_STATUSES}
    for ch in churches or []:
        status = str(ch.get("pipeline_status") or "discovered")
        if status in by_stage:
            by_stage[status] += 1
        else:
            by_stage[status] = by_stage.get(status, 0) + 1
    return {
        "total": len(churches or []),
        "by_pipeline_status": by_stage,
        "updated_at": utc_now_iso(),
    }
