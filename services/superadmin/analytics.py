"""Platform usage analytics for superadmin."""

from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import Any

from services.auth_config import supabase_enabled
from services.supabase_client import get_service_client


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _day_key(dt: datetime) -> str:
    return dt.strftime("%Y-%m-%d")


def build_analytics_payload(*, days: int = 14) -> dict[str, Any]:
    if not supabase_enabled():
        return {
            "ok": True,
            "days": days,
            "generations_by_day": [],
            "signups_by_day": [],
            "top_parishes": [],
            "summary": {},
        }

    days = max(7, min(days, 90))
    client = get_service_client()
    now = _utc_now()
    start = now - timedelta(days=days - 1)
    start_iso = start.replace(hour=0, minute=0, second=0, microsecond=0).isoformat()

    gen_rows: list[dict[str, Any]] = []
    try:
        gen_result = (
            client.table("generation_history")
            .select("user_id, created_at")
            .gte("created_at", start_iso)
            .order("created_at", desc=True)
            .limit(5000)
            .execute()
        )
        gen_rows = list(gen_result.data or [])
    except Exception:
        gen_rows = []

    signup_rows: list[dict[str, Any]] = []
    try:
        signup_result = (
            client.table("profiles")
            .select("id, created_at")
            .gte("created_at", start_iso)
            .order("created_at", desc=True)
            .limit(5000)
            .execute()
        )
        signup_rows = list(signup_result.data or [])
    except Exception:
        signup_rows = []

    gen_by_day: dict[str, int] = defaultdict(int)
    for row in gen_rows:
        created = str(row.get("created_at") or "")[:10]
        if created:
            gen_by_day[created] += 1

    signups_by_day: dict[str, int] = defaultdict(int)
    for row in signup_rows:
        created = str(row.get("created_at") or "")[:10]
        if created:
            signups_by_day[created] += 1

    day_labels: list[str] = []
    cursor = start.replace(hour=0, minute=0, second=0, microsecond=0)
    for _ in range(days):
        day_labels.append(_day_key(cursor))
        cursor += timedelta(days=1)

    generations_series = [
        {"date": d, "count": gen_by_day.get(d, 0)} for d in day_labels
    ]
    signups_series = [
        {"date": d, "count": signups_by_day.get(d, 0)} for d in day_labels
    ]

    user_ids = list({str(r.get("user_id") or "") for r in gen_rows if r.get("user_id")})
    parish_by_user: dict[str, dict[str, Any]] = {}
    if user_ids:
        try:
            members = (
                client.table("parish_members")
                .select("user_id, parish_id")
                .in_("user_id", user_ids[:500])
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
                uid = str(m.get("user_id") or "")
                pid = str(m.get("parish_id") or "")
                parish = parishes_by_id.get(pid) or {}
                parish_by_user[uid] = {
                    "parish_id": pid,
                    "community_name": parish.get("community_name") or "—",
                }
        except Exception:
            parish_by_user = {}

    parish_gen_counts: dict[str, dict[str, Any]] = {}
    for row in gen_rows:
        uid = str(row.get("user_id") or "")
        info = parish_by_user.get(uid) or {}
        pid = info.get("parish_id") or "unknown"
        if pid not in parish_gen_counts:
            parish_gen_counts[pid] = {
                "parish_id": pid if pid != "unknown" else None,
                "community_name": info.get("community_name") or "Unassigned",
                "count": 0,
            }
        parish_gen_counts[pid]["count"] += 1

    top_parishes = sorted(
        parish_gen_counts.values(),
        key=lambda x: int(x.get("count") or 0),
        reverse=True,
    )[:10]

    week_start = (now - timedelta(days=6)).replace(
        hour=0, minute=0, second=0, microsecond=0
    ).isoformat()
    active_parish_ids: set[str] = set()
    for row in gen_rows:
        created = str(row.get("created_at") or "")
        if created >= week_start:
            uid = str(row.get("user_id") or "")
            pid = (parish_by_user.get(uid) or {}).get("parish_id")
            if pid:
                active_parish_ids.add(str(pid))

    total_generations = len(gen_rows)
    total_signups = len(signup_rows)
    generations_today = gen_by_day.get(_day_key(now), 0)
    signups_today = signups_by_day.get(_day_key(now), 0)

    return {
        "ok": True,
        "days": days,
        "generations_by_day": generations_series,
        "signups_by_day": signups_series,
        "top_parishes": top_parishes,
        "summary": {
            "generations_in_period": total_generations,
            "signups_in_period": total_signups,
            "generations_today": generations_today,
            "signups_today": signups_today,
            "active_parishes_7d": len(active_parish_ids),
            "period_start": day_labels[0] if day_labels else None,
            "period_end": day_labels[-1] if day_labels else None,
        },
    }
