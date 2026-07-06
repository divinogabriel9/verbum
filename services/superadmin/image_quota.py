"""Per-parish AI image quota usage for superadmin."""

from __future__ import annotations

from typing import Any

from services.auth_config import supabase_enabled
from services.image_generation_quota import (
    DAILY_IMAGE_LIMIT,
    _KEY_PREFIX,
    _utc_date,
    _connect,
    get_quota_status,
)
from services.redis_client import get_redis
from services.supabase_client import get_service_client


def _usage_map_for_date(today: str) -> dict[str, int]:
    usage: dict[str, int] = {}

    try:
        with _connect() as conn:
            rows = conn.execute(
                """
                SELECT subject_key, generation_count
                FROM image_generation_daily
                WHERE usage_date = ? AND subject_key LIKE 'parish:%'
                """,
                (today,),
            ).fetchall()
        for row in rows:
            key = str(row["subject_key"] or "")
            if key:
                usage[key] = max(usage.get(key, 0), int(row["generation_count"] or 0))
    except Exception:
        pass

    client = get_redis()
    if client is not None:
        try:
            pattern = f"{_KEY_PREFIX}parish:*:{today}"
            for key in client.scan_iter(match=pattern, count=200):
                raw = client.get(key)
                if not raw:
                    continue
                subject = str(key)
                prefix = _KEY_PREFIX
                suffix = f":{today}"
                if subject.startswith(prefix) and subject.endswith(suffix):
                    subject_key = subject[len(prefix) : -len(suffix)]
                    usage[subject_key] = max(usage.get(subject_key, 0), int(raw))
        except Exception:
            pass

    return usage


def _parish_rows(limit: int = 500) -> list[dict[str, Any]]:
    if not supabase_enabled():
        return []
    try:
        client = get_service_client()
        result = (
            client.table("parishes")
            .select("id, community_name, membership_status")
            .order("community_name")
            .limit(max(1, min(limit, 500)))
            .execute()
        )
        return list(result.data or [])
    except Exception:
        return []


def list_parish_image_quota(*, q: str = "", limit: int = 100) -> dict[str, Any]:
    today = _utc_date()
    usage = _usage_map_for_date(today)
    query = (q or "").strip().lower()
    parishes = _parish_rows(limit=500)

    items: list[dict[str, Any]] = []
    seen_ids: set[str] = set()

    for row in parishes:
        pid = str(row.get("id") or "").strip()
        if not pid:
            continue
        name = (row.get("community_name") or "").strip() or "—"
        if query and query not in name.lower():
            continue
        subject = f"parish:{pid}"
        used = int(usage.pop(subject, 0))
        status = get_quota_status(subject)
        items.append(
            {
                "parish_id": pid,
                "community_name": name,
                "membership_status": row.get("membership_status") or "draft",
                "subject": subject,
                "used": used,
                "remaining": int(status.get("remaining") or 0),
                "limit": int(status.get("limit") or DAILY_IMAGE_LIMIT),
                "allowed": bool(status.get("allowed")),
            }
        )
        seen_ids.add(pid)

    for subject, used in usage.items():
        if not subject.startswith("parish:"):
            continue
        pid = subject.split(":", 1)[1]
        if pid in seen_ids:
            continue
        status = get_quota_status(subject)
        label = f"Parish {pid[:8]}…"
        if query and query not in label.lower() and query not in pid.lower():
            continue
        items.append(
            {
                "parish_id": pid,
                "community_name": label,
                "membership_status": "unknown",
                "subject": subject,
                "used": int(used),
                "remaining": int(status.get("remaining") or 0),
                "limit": int(status.get("limit") or DAILY_IMAGE_LIMIT),
                "allowed": bool(status.get("allowed")),
            }
        )

    items.sort(key=lambda x: (-int(x.get("used") or 0), str(x.get("community_name") or "")))

    total_used = sum(int(x.get("used") or 0) for x in items)
    total = len(items)
    return {
        "ok": True,
        "date": today,
        "timezone": "UTC",
        "limit_per_parish": DAILY_IMAGE_LIMIT,
        "total_used": total_used,
        "parish_count": total,
        "total": total,
        "items": items[: max(1, min(limit, 200))],
    }


def list_parish_image_quota_paginated(
    *,
    q: str = "",
    page: int = 1,
    per_page: int = 25,
) -> dict[str, Any]:
    full = list_parish_image_quota(q=q, limit=500)
    items = full.get("items") or []
    page = max(1, page)
    per_page = max(1, min(per_page, 100))
    offset = (page - 1) * per_page
    page_items = items[offset : offset + per_page]
    return {
        **full,
        "items": page_items,
        "total": len(items),
        "page": page,
        "per_page": per_page,
    }
