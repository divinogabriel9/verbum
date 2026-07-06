"""Aggregate stats and recent activity for the superadmin dashboard."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from services.auth_config import auth_enabled, supabase_enabled
from services.pending_submissions import list_pending_priests, list_pending_songs
from services.redis_client import get_redis, redis_enabled
from services.supabase_client import get_service_client, list_pending_memberships


def _utc_today() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def _safe_count_supabase(table: str, *, filters: dict[str, str] | None = None) -> int | None:
    if not supabase_enabled():
        return None
    try:
        client = get_service_client()
        query = client.table(table).select("id", count="exact")
        for key, value in (filters or {}).items():
            query = query.eq(key, value)
        result = query.limit(0).execute()
        return int(result.count or 0)
    except Exception:
        return None


def _generations_today() -> int | None:
    if not supabase_enabled():
        return None
    try:
        client = get_service_client()
        start = f"{_utc_today()}T00:00:00+00:00"
        result = (
            client.table("generation_history")
            .select("id", count="exact")
            .gte("created_at", start)
            .limit(0)
            .execute()
        )
        return int(result.count or 0)
    except Exception:
        return None


def _ai_images_today() -> int | None:
    today = _utc_today()
    try:
        from services.image_generation_quota import _connect, _KEY_PREFIX

        with _connect() as conn:
            row = conn.execute(
                """
                SELECT COALESCE(SUM(generation_count), 0) AS total
                FROM image_generation_daily
                WHERE usage_date = ?
                """,
                (today,),
            ).fetchone()
        sqlite_total = int(row["total"]) if row else 0
    except Exception:
        sqlite_total = None

    redis_total = 0
    client = get_redis()
    if client is not None:
        try:
            pattern = f"{_KEY_PREFIX}*:{today}"
            for key in client.scan_iter(match=pattern, count=200):
                raw = client.get(key)
                if raw:
                    redis_total += int(raw)
        except Exception:
            pass

    if sqlite_total is None and redis_total == 0:
        return None
    return max(sqlite_total or 0, redis_total)


def _readings_cache_stats() -> dict[str, Any]:
    from services.usccb_readings import readings_cache_path

    path = readings_cache_path()
    if not path.is_file():
        return {"entries": 0, "bytes": 0, "path": str(path.name)}
    try:
        import json

        data = json.loads(path.read_text(encoding="utf-8"))
        entries = len(data) if isinstance(data, dict) else 0
        return {"entries": entries, "bytes": path.stat().st_size, "path": str(path.name)}
    except Exception:
        return {"entries": 0, "bytes": path.stat().st_size if path.is_file() else 0, "path": str(path.name)}


def _recent_signups(limit: int = 8) -> list[dict[str, Any]]:
    if not supabase_enabled():
        return []
    try:
        client = get_service_client()
        result = (
            client.table("profiles")
            .select("id, email, first_name, last_name, created_at")
            .order("created_at", desc=True)
            .limit(limit)
            .execute()
        )
        return list(result.data or [])
    except Exception:
        return []


def _recent_generations(limit: int = 8) -> list[dict[str, Any]]:
    if not supabase_enabled():
        return []
    try:
        client = get_service_client()
        result = (
            client.table("generation_history")
            .select("id, user_id, mass_date, celebrant, output_summary, created_at")
            .order("created_at", desc=True)
            .limit(limit)
            .execute()
        )
        rows = list(result.data or [])
        if not rows:
            return rows
        user_ids = [r["user_id"] for r in rows if r.get("user_id")]
        profiles = (
            client.table("profiles")
            .select("id, email")
            .in_("id", user_ids)
            .execute()
        )
        by_id = {p["id"]: p for p in (profiles.data or [])}
        out: list[dict[str, Any]] = []
        for row in rows:
            prof = by_id.get(row.get("user_id")) or {}
            out.append({**row, "user_email": prof.get("email")})
        return out
    except Exception:
        return []


def _parishes_approved_count() -> int | None:
    count = _safe_count_supabase("parishes", filters={"membership_status": "approved"})
    if count is not None:
        return count
    return _safe_count_supabase("church_profiles", filters={"membership_status": "approved"})


def _recent_audit(limit: int = 5) -> list[dict[str, Any]]:
    if not supabase_enabled():
        return []
    try:
        from services.superadmin.audit_log import list_audit_log

        data = list_audit_log(page=1, per_page=limit)
        return list(data.get("items") or [])
    except Exception:
        return []


def build_dashboard_payload() -> dict[str, Any]:
    pending_memberships = list_pending_memberships() if supabase_enabled() else []
    pending_songs = list_pending_songs()
    pending_priests = list_pending_priests()

    cards = {
        "users_total": _safe_count_supabase("profiles"),
        "parishes_approved": _parishes_approved_count(),
        "parishes_pending": len(pending_memberships),
        "generations_today": _generations_today(),
        "ai_images_today": _ai_images_today(),
        "pending_songs": len(pending_songs),
        "pending_priests": len(pending_priests),
        "supabase_ok": supabase_enabled(),
        "redis_ok": redis_enabled() and get_redis() is not None,
        "auth_enabled": auth_enabled(),
        "readings_cache": _readings_cache_stats(),
    }

    activity: list[dict[str, Any]] = []
    for row in _recent_signups(5):
        activity.append(
            {
                "type": "signup",
                "at": row.get("created_at"),
                "label": row.get("email") or row.get("id"),
                "detail": "New registration",
            }
        )
    for row in pending_memberships[:5]:
        prof = row.get("profile") or {}
        activity.append(
            {
                "type": "membership_pending",
                "at": row.get("created_at") or row.get("updated_at"),
                "label": row.get("community_name") or "—",
                "detail": prof.get("email") or row.get("user_id"),
            }
        )
    for row in _recent_generations(5):
        summary = row.get("output_summary") or {}
        activity.append(
            {
                "type": "generation",
                "at": row.get("created_at"),
                "label": summary.get("title") or row.get("mass_date"),
                "detail": row.get("user_email") or row.get("user_id"),
            }
        )
    for row in pending_songs[:3]:
        payload = row.get("payload") or {}
        activity.append(
            {
                "type": "song_submission",
                "at": row.get("created_at"),
                "label": payload.get("title") or "Song submission",
                "detail": row.get("submitted_by_email") or "",
            }
        )
    for row in _recent_audit(5):
        detail = row.get("detail") if isinstance(row.get("detail"), dict) else {}
        detail_text = detail.get("title") or detail.get("name") or detail.get("target_name") or ""
        activity.append(
            {
                "type": "audit",
                "at": row.get("created_at"),
                "label": f"{row.get('action') or 'action'} · {row.get('entity_type') or 'item'}",
                "detail": detail_text or row.get("actor_email") or "",
                "panel": "audit-log",
            }
        )

    activity.sort(key=lambda x: str(x.get("at") or ""), reverse=True)

    return {
        "ok": True,
        "cards": cards,
        "recent_activity": activity[:12],
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }
