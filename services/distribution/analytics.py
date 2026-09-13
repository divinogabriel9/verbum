"""Distribution dashboard and funnel analytics."""

from __future__ import annotations

import logging
from collections import Counter
from datetime import timedelta
from typing import Any

from services.distribution._client import parse_iso, require_client, utc_now
from services.distribution.churches import get_church_liturgyflow_activity, list_follow_ups
from services.distribution.constants import PIPELINE_LABELS, PIPELINE_STATUSES, STAGE_ORDER

logger = logging.getLogger(__name__)


def _week_start(now=None):
    now = now or utc_now()
    start = now - timedelta(days=now.weekday())
    return start.replace(hour=0, minute=0, second=0, microsecond=0)


def dashboard_metrics() -> dict[str, Any]:
    client = require_client()
    churches = (
        client.table("distribution_churches")
        .select("*")
        .limit(5000)
        .execute()
    )
    rows = list(churches.data or [])

    by_stage: dict[str, int] = {s: 0 for s in PIPELINE_STATUSES}
    for r in rows:
        st = str(r.get("pipeline_status") or "discovered")
        by_stage[st] = by_stage.get(st, 0) + 1

    week_start = _week_start()
    week_iso = week_start.isoformat()

    weekly_new = 0
    weekly_contacted = 0
    weekly_trials = 0
    weekly_paid = 0
    for r in rows:
        created = parse_iso(r.get("created_at"))
        if created and created >= week_start:
            weekly_new += 1
        stage_at = parse_iso(r.get("stage_entered_at"))
        status = str(r.get("pipeline_status") or "")
        if stage_at and stage_at >= week_start:
            if status == "contacted":
                weekly_contacted += 1
            elif status == "trial":
                weekly_trials += 1
            elif status == "paid":
                weekly_paid += 1

    # Conversion rates along the funnel
    conversions: dict[str, Any] = {}
    for i, stage in enumerate(STAGE_ORDER[:-1]):
        nxt = STAGE_ORDER[i + 1]
        # Churches that reached next or later
        reached_here = sum(
            by_stage.get(s, 0) for s in STAGE_ORDER[STAGE_ORDER.index(stage) :]
        )
        reached_next = sum(
            by_stage.get(s, 0) for s in STAGE_ORDER[STAGE_ORDER.index(nxt) :]
        )
        rate = (reached_next / reached_here) if reached_here else 0.0
        conversions[f"{stage}_to_{nxt}"] = round(rate * 100, 1)

    follow = list_follow_ups(today=True, overdue=True)
    attention = churches_needing_attention(churches=rows)

    return {
        "ok": True,
        "totals": {
            "churches": len(rows),
            "by_pipeline_status": by_stage,
        },
        "weekly": {
            "new": weekly_new,
            "contacted": weekly_contacted,
            "trials": weekly_trials,
            "paid": weekly_paid,
            "week_start": week_iso,
        },
        "conversion_rates": conversions,
        "follow_ups": follow.get("counts") or {},
        "needing_attention": {
            "count": len(attention),
            "items": attention[:20],
        },
    }


def funnel_analytics() -> dict[str, Any]:
    client = require_client()
    result = (
        client.table("distribution_churches")
        .select("pipeline_status")
        .limit(5000)
        .execute()
    )
    rows = list(result.data or [])
    counts: dict[str, int] = {s: 0 for s in PIPELINE_STATUSES}
    for r in rows:
        st = str(r.get("pipeline_status") or "discovered")
        counts[st] = counts.get(st, 0) + 1

    stages: list[dict[str, Any]] = []
    for i, stage in enumerate(STAGE_ORDER):
        count = counts.get(stage, 0)
        cumulative = sum(counts.get(s, 0) for s in STAGE_ORDER[i:])
        conv_from_prev = None
        if i > 0:
            prev_cum = sum(counts.get(s, 0) for s in STAGE_ORDER[i - 1 :])
            conv_from_prev = (
                round((cumulative / prev_cum) * 100, 1) if prev_cum else 0.0
            )
        stages.append(
            {
                "status": stage,
                "label": PIPELINE_LABELS.get(stage, stage),
                "count": count,
                "cumulative": cumulative,
                "conversion_from_previous_pct": conv_from_prev,
            }
        )
    return {"ok": True, "stages": stages, "total": len(rows)}


def opportunity_by_geo() -> dict[str, Any]:
    client = require_client()
    result = (
        client.table("distribution_churches")
        .select("country, city, pipeline_status, priority")
        .limit(5000)
        .execute()
    )
    rows = list(result.data or [])
    by_country: dict[str, Any] = {}
    for r in rows:
        country = (r.get("country") or "Unknown").strip() or "Unknown"
        city = (r.get("city") or "Unknown").strip() or "Unknown"
        bucket = by_country.setdefault(
            country,
            {"country": country, "total": 0, "cities": {}, "by_status": Counter()},
        )
        bucket["total"] += 1
        bucket["by_status"][str(r.get("pipeline_status") or "discovered")] += 1
        city_bucket = bucket["cities"].setdefault(
            city, {"city": city, "total": 0, "by_status": Counter()}
        )
        city_bucket["total"] += 1
        city_bucket["by_status"][str(r.get("pipeline_status") or "discovered")] += 1

    countries = []
    for country, data in sorted(by_country.items(), key=lambda x: -x[1]["total"]):
        cities = [
            {
                "city": c["city"],
                "total": c["total"],
                "by_status": dict(c["by_status"]),
            }
            for c in sorted(data["cities"].values(), key=lambda x: -x["total"])
        ]
        countries.append(
            {
                "country": country,
                "total": data["total"],
                "by_status": dict(data["by_status"]),
                "cities": cities,
            }
        )
    return {"ok": True, "countries": countries}


def churches_needing_attention(
    *,
    churches: list[dict[str, Any]] | None = None,
) -> list[dict[str, Any]]:
    client = require_client()
    if churches is None:
        result = (
            client.table("distribution_churches").select("*").limit(5000).execute()
        )
        churches = list(result.data or [])

    now = utc_now()
    items: list[dict[str, Any]] = []

    # Prefetch last activity timestamps
    church_ids = [str(c["id"]) for c in churches if c.get("id")]
    last_activity: dict[str, Any] = {}
    if church_ids:
        try:
            # Fetch recent activities and keep max per church
            acts = (
                client.table("distribution_activities")
                .select("church_id, occurred_at")
                .in_("church_id", church_ids[:1000])
                .order("occurred_at", desc=True)
                .limit(3000)
                .execute()
            )
            for a in acts.data or []:
                cid = str(a.get("church_id") or "")
                if cid and cid not in last_activity:
                    last_activity[cid] = a.get("occurred_at")
        except Exception:
            logger.exception("Failed to load activities for attention list")

    for church in churches:
        cid = str(church.get("id") or "")
        reasons: list[str] = []
        status = str(church.get("pipeline_status") or "")

        trial_exp = parse_iso(church.get("trial_expires_at"))
        if trial_exp and status == "trial":
            days_left = (trial_exp - now).total_seconds() / 86400
            if 0 <= days_left <= 7:
                reasons.append("trial_ending_soon")

        follow_at = parse_iso(church.get("next_follow_up_at"))
        if follow_at and follow_at < now:
            reasons.append("follow_up_overdue")

        if str(church.get("demo_status") or "").strip().lower() in {
            "requested",
            "pending",
            "scheduled",
        }:
            reasons.append("demo_requested")

        last_at = parse_iso(last_activity.get(cid) or church.get("last_contacted_at") or church.get("updated_at"))
        if last_at and (now - last_at) >= timedelta(days=8):
            if status not in {"paid", "referral"}:
                reasons.append("no_activity_8d")

        if status == "activated" and church.get("parish_id"):
            try:
                usage = get_church_liturgyflow_activity(church)
                last_gen = parse_iso(usage.get("last_generation_at"))
                stage_at = parse_iso(church.get("stage_entered_at")) or now
                inactive_since = last_gen or stage_at
                if (now - inactive_since) >= timedelta(days=14):
                    reasons.append("activated_inactive_14d")
            except Exception:
                logger.debug("usage check failed for %s", cid)

        if reasons:
            items.append(
                {
                    "church": {
                        "id": cid,
                        "parish_name": church.get("parish_name"),
                        "city": church.get("city"),
                        "country": church.get("country"),
                        "pipeline_status": status,
                        "priority": church.get("priority"),
                        "next_follow_up_at": church.get("next_follow_up_at"),
                        "trial_expires_at": church.get("trial_expires_at"),
                    },
                    "reasons": reasons,
                }
            )

    priority_rank = {"high": 0, "medium": 1, "low": 2}
    items.sort(
        key=lambda x: (
            priority_rank.get(str(x["church"].get("priority") or "medium"), 1),
            -len(x["reasons"]),
        )
    )
    return items
