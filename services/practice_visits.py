"""Track choir practice link opens (unique visitors + active-now).

Privacy: store hashed IP / device id only. Never return raw IPs to clients.
Dedupes poll spam by upserting last_seen_at per (token, visitor_key).
"""

from __future__ import annotations

import hashlib
import logging
import time
from datetime import datetime, timezone
from typing import Any, Optional

from starlette.requests import Request

from services.auth_config import supabase_enabled
from services.practice_access import client_ip, practice_device_id_from_request

logger = logging.getLogger(__name__)

_ACTIVE_WINDOW_S = 120
_SESSION_GAP_S = 45 * 60
_UA_MAX = 240
_LOCAL_VISITS: dict[str, dict[str, Any]] = {}
# token -> visitor_key -> visit_day(YYYY-MM-DD) -> row
_LOCAL_VISIT_DAYS: dict[str, dict[str, dict[str, dict[str, Any]]]] = {}


def _service_client():
    from services.supabase_client import get_service_client

    return get_service_client()


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _now_iso() -> str:
    return _now().isoformat()


def _hash_value(raw: str) -> str:
    clean = (raw or "").strip()
    if not clean:
        return ""
    return hashlib.sha256(clean.encode("utf-8")).hexdigest()[:40]


def _visitor_key(*, device_id: str, ip: str) -> str:
    device = (device_id or "").strip()
    if device:
        return "d:" + _hash_value(device)
    ip_clean = (ip or "").strip()
    if ip_clean and ip_clean != "unknown":
        return "i:" + _hash_value(ip_clean)
    return ""


def _trim_ua(raw: str) -> str:
    return (raw or "").strip()[:_UA_MAX]


def _parse_iso(raw: Any) -> Optional[datetime]:
    text = str(raw or "").strip()
    if not text:
        return None
    try:
        if text.endswith("Z"):
            text = text[:-1] + "+00:00"
        dt = datetime.fromisoformat(text)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except ValueError:
        return None


def _seconds_since(iso_raw: Any) -> float:
    dt = _parse_iso(iso_raw)
    if not dt:
        return 1e12
    return max(0.0, (_now() - dt).total_seconds())


def _local_bucket(token: str) -> dict[str, dict[str, Any]]:
    tok = (token or "").strip()
    if tok not in _LOCAL_VISITS:
        _LOCAL_VISITS[tok] = {}
    return _LOCAL_VISITS[tok]


def _utc_day_key(dt: Optional[datetime] = None) -> str:
    stamp = dt or _now()
    return stamp.astimezone(timezone.utc).strftime("%Y-%m-%d")


def _record_visit_day_local(
    token: str,
    visitor: str,
    *,
    day: str,
    now_iso: str,
) -> None:
    tok = (token or "").strip()
    if not tok or not visitor or not day:
        return
    by_visitor = _LOCAL_VISIT_DAYS.setdefault(tok, {})
    by_day = by_visitor.setdefault(visitor, {})
    prev = by_day.get(day)
    if prev:
        prev["hit_count"] = int(prev.get("hit_count") or 1) + 1
        prev["last_seen_at"] = now_iso
        return
    by_day[day] = {
        "visit_day": day,
        "share_token": tok,
        "visitor_key": visitor,
        "hit_count": 1,
        "first_seen_at": now_iso,
        "last_seen_at": now_iso,
    }


def _record_visit_day(
    token: str,
    visitor: str,
    *,
    day: str,
    now_iso: str,
) -> None:
    """Upsert today's UTC presence row for SA online-by-date log."""
    tok = (token or "").strip()
    if not tok or not visitor or not day:
        return

    if supabase_enabled():
        try:
            client = _service_client()
            existing = (
                client.table("choir_practice_visit_days")
                .select("id,hit_count")
                .eq("visit_day", day)
                .eq("share_token", tok)
                .eq("visitor_key", visitor)
                .limit(1)
                .execute()
            )
            rows = existing.data or []
            if rows and isinstance(rows[0], dict):
                row = rows[0]
                client.table("choir_practice_visit_days").update(
                    {
                        "last_seen_at": now_iso,
                        "hit_count": int(row.get("hit_count") or 1) + 1,
                    }
                ).eq("id", row["id"]).execute()
                return
            client.table("choir_practice_visit_days").insert(
                {
                    "visit_day": day,
                    "share_token": tok,
                    "visitor_key": visitor,
                    "hit_count": 1,
                    "first_seen_at": now_iso,
                    "last_seen_at": now_iso,
                }
            ).execute()
            return
        except Exception as exc:
            msg = str(exc)
            if "choir_practice_visit_days" in msg or "PGRST205" in msg:
                logger.warning("choir_practice_visit_days unavailable; using local (%s)", exc)
            else:
                logger.warning("choir_practice_visit_days upsert failed; using local (%s)", exc)

    _record_visit_day_local(tok, visitor, day=day, now_iso=now_iso)


def get_practice_online_by_day(*, days: int = 14) -> list[dict[str, Any]]:
    """Platform online log by UTC date. Omits days with zero activity."""
    from collections import defaultdict
    from datetime import timedelta

    window = max(1, min(int(days or 14), 90))
    now = _now()
    start = (now - timedelta(days=window - 1)).astimezone(timezone.utc)
    start_day = start.strftime("%Y-%m-%d")
    end_day = _utc_day_key(now)

    rows: list[dict[str, Any]] = []
    if supabase_enabled():
        try:
            result = (
                _service_client()
                .table("choir_practice_visit_days")
                .select("visit_day,share_token,visitor_key,hit_count")
                .gte("visit_day", start_day)
                .lte("visit_day", end_day)
                .limit(8000)
                .execute()
            )
            rows = [r for r in (result.data or []) if isinstance(r, dict)]
        except Exception as exc:
            logger.warning("choir_practice_visit_days log failed (%s)", exc)
            rows = []

    if not rows:
        for tok, by_visitor in _LOCAL_VISIT_DAYS.items():
            for visitor, by_day in by_visitor.items():
                for day, row in by_day.items():
                    if start_day <= day <= end_day:
                        rows.append(
                            {
                                "visit_day": day,
                                "share_token": tok,
                                "visitor_key": visitor,
                                "hit_count": int(row.get("hit_count") or 1),
                            }
                        )

    unique: dict[str, set[str]] = defaultdict(set)
    hits: dict[str, int] = defaultdict(int)
    shares: dict[str, set[str]] = defaultdict(set)
    for row in rows:
        day = str(row.get("visit_day") or "")[:10]
        if not day:
            continue
        visitor = str(row.get("visitor_key") or "").strip()
        tok = str(row.get("share_token") or "").strip()
        if visitor:
            unique[day].add(visitor)
        if tok:
            shares[day].add(tok)
        hits[day] += int(row.get("hit_count") or 0)

    out: list[dict[str, Any]] = []
    for day in sorted(unique.keys(), reverse=True):
        count = len(unique[day])
        if count < 1:
            continue
        out.append(
            {
                "date": day,
                "unique_visitors": count,
                "hits": int(hits.get(day) or 0),
                "shares": len(shares.get(day) or ()),
            }
        )
    return out


def record_practice_visit(request: Request, token: str) -> dict[str, Any]:
    """Upsert a visit for this browser. Safe to call on every poll."""
    tok = (token or "").strip()
    if not tok:
        return {"ok": False, "error": "token required"}

    device_id = practice_device_id_from_request(request)
    ip = client_ip(request)
    visitor = _visitor_key(device_id=device_id, ip=ip)
    if not visitor:
        return {"ok": False, "error": "no visitor identity"}

    device_hash = _hash_value(device_id) if device_id else None
    ip_hash = _hash_value(ip) if ip and ip != "unknown" else None
    ua = _trim_ua(request.headers.get("user-agent") or "")
    now_iso = _now_iso()
    day = _utc_day_key()

    if supabase_enabled():
        try:
            client = _service_client()
            existing = (
                client.table("choir_practice_visits")
                .select("id,hit_count,last_seen_at,first_seen_at")
                .eq("share_token", tok)
                .eq("visitor_key", visitor)
                .limit(1)
                .execute()
            )
            rows = existing.data or []
            if rows and isinstance(rows[0], dict):
                row = rows[0]
                hit = int(row.get("hit_count") or 1) + 1
                client.table("choir_practice_visits").update(
                    {
                        "last_seen_at": now_iso,
                        "hit_count": hit,
                        "user_agent": ua or str(row.get("user_agent") or ""),
                        "device_id_hash": device_hash or row.get("device_id_hash"),
                        "ip_hash": ip_hash or row.get("ip_hash"),
                    }
                ).eq("id", row["id"]).execute()
                _record_visit_day(tok, visitor, day=day, now_iso=now_iso)
                return {
                    "ok": True,
                    "is_new": False,
                    "is_returning_session": _seconds_since(row.get("last_seen_at")) >= _SESSION_GAP_S,
                }

            client.table("choir_practice_visits").insert(
                {
                    "share_token": tok,
                    "visitor_key": visitor,
                    "device_id_hash": device_hash,
                    "ip_hash": ip_hash,
                    "user_agent": ua,
                    "hit_count": 1,
                    "first_seen_at": now_iso,
                    "last_seen_at": now_iso,
                }
            ).execute()
            _record_visit_day(tok, visitor, day=day, now_iso=now_iso)
            return {"ok": True, "is_new": True, "is_returning_session": False}
        except Exception as exc:
            msg = str(exc)
            if "choir_practice_visits" in msg or "PGRST205" in msg:
                logger.warning("choir_practice_visits unavailable; using local store (%s)", exc)
            else:
                logger.warning("choir_practice_visits upsert failed; using local store (%s)", exc)

    bucket = _local_bucket(tok)
    prev = bucket.get(visitor)
    if prev:
        prev["hit_count"] = int(prev.get("hit_count") or 1) + 1
        gap = _seconds_since(prev.get("last_seen_at"))
        prev["last_seen_at"] = now_iso
        prev["user_agent"] = ua or prev.get("user_agent") or ""
        if device_hash:
            prev["device_id_hash"] = device_hash
        if ip_hash:
            prev["ip_hash"] = ip_hash
        _record_visit_day(tok, visitor, day=day, now_iso=now_iso)
        return {"ok": True, "is_new": False, "is_returning_session": gap >= _SESSION_GAP_S}

    bucket[visitor] = {
        "visitor_key": visitor,
        "device_id_hash": device_hash,
        "ip_hash": ip_hash,
        "user_agent": ua,
        "hit_count": 1,
        "first_seen_at": now_iso,
        "last_seen_at": now_iso,
    }
    _record_visit_day(tok, visitor, day=day, now_iso=now_iso)
    return {"ok": True, "is_new": True, "is_returning_session": False}


def _shape_visitor_row(row: dict[str, Any], *, now_ts: float) -> dict[str, Any]:
    last = _parse_iso(row.get("last_seen_at"))
    first = _parse_iso(row.get("first_seen_at"))
    last_ts = last.timestamp() if last else 0.0
    active = (now_ts - last_ts) <= _ACTIVE_WINDOW_S if last_ts else False
    ua = str(row.get("user_agent") or "").strip()
    return {
        "visitor_key": str(row.get("visitor_key") or "")[:12],
        "first_seen_at": row.get("first_seen_at"),
        "last_seen_at": row.get("last_seen_at"),
        "hit_count": int(row.get("hit_count") or 0),
        "is_active": active,
        "user_agent": ua[:120],
        "has_device": bool(row.get("device_id_hash")),
    }


def count_practice_active_now(token: str) -> int:
    """How many distinct visitors were seen in the active window."""
    tok = (token or "").strip()
    if not tok:
        return 0
    now_ts = time.time()
    cutoff = now_ts - _ACTIVE_WINDOW_S

    if supabase_enabled():
        try:
            result = (
                _service_client()
                .table("choir_practice_visits")
                .select("last_seen_at")
                .eq("share_token", tok)
                .gte("last_seen_at", datetime.fromtimestamp(cutoff, tz=timezone.utc).isoformat())
                .limit(500)
                .execute()
            )
            return len([r for r in (result.data or []) if isinstance(r, dict)])
        except Exception as exc:
            logger.warning("choir_practice_visits active count failed (%s)", exc)

    active = 0
    for row in _local_bucket(tok).values():
        last = _parse_iso(row.get("last_seen_at"))
        if last and last.timestamp() >= cutoff:
            active += 1
    return active


def get_practice_visit_stats(token: str) -> dict[str, Any]:
    """Aggregate stats for a share token (no raw IPs)."""
    tok = (token or "").strip()
    if not tok:
        return {"ok": False, "error": "token required"}

    rows: list[dict[str, Any]] = []
    if supabase_enabled():
        try:
            result = (
                _service_client()
                .table("choir_practice_visits")
                .select(
                    "visitor_key,device_id_hash,ip_hash,user_agent,hit_count,"
                    "first_seen_at,last_seen_at"
                )
                .eq("share_token", tok)
                .order("last_seen_at", desc=True)
                .limit(500)
                .execute()
            )
            rows = [r for r in (result.data or []) if isinstance(r, dict)]
        except Exception as exc:
            logger.warning("choir_practice_visits stats failed; using local store (%s)", exc)
            rows = []

    if not rows:
        rows = list(_local_bucket(tok).values())

    now_ts = time.time()
    visitors = [_shape_visitor_row(r, now_ts=now_ts) for r in rows]
    active = sum(1 for v in visitors if v.get("is_active"))
    return {
        "ok": True,
        "token": tok,
        "unique_visitors": len(visitors),
        "active_now": active,
        "active_window_seconds": _ACTIVE_WINDOW_S,
        "visitors": visitors[:50],
    }


def get_practice_visit_stats_batch(tokens: list[str]) -> dict[str, dict[str, Any]]:
    """Map token → {unique_visitors, active_now} for history lists."""
    out: dict[str, dict[str, Any]] = {}
    clean = [str(t or "").strip() for t in tokens if str(t or "").strip()]
    if not clean:
        return out

    now_ts = time.time()
    if supabase_enabled():
        try:
            result = (
                _service_client()
                .table("choir_practice_visits")
                .select("share_token,last_seen_at")
                .in_("share_token", clean[:80])
                .limit(4000)
                .execute()
            )
            buckets: dict[str, list[dict[str, Any]]] = {t: [] for t in clean}
            for row in result.data or []:
                if not isinstance(row, dict):
                    continue
                tok = str(row.get("share_token") or "").strip()
                if tok in buckets:
                    buckets[tok].append(row)
            for tok, rows in buckets.items():
                active = 0
                for r in rows:
                    last = _parse_iso(r.get("last_seen_at"))
                    if last and (now_ts - last.timestamp()) <= _ACTIVE_WINDOW_S:
                        active += 1
                out[tok] = {"unique_visitors": len(rows), "active_now": active}
            return out
        except Exception as exc:
            logger.warning("choir_practice_visits batch stats failed (%s)", exc)

    for tok in clean:
        rows = list(_local_bucket(tok).values())
        active = 0
        for r in rows:
            last = _parse_iso(r.get("last_seen_at"))
            if last and (now_ts - last.timestamp()) <= _ACTIVE_WINDOW_S:
                active += 1
        out[tok] = {"unique_visitors": len(rows), "active_now": active}
    return out
