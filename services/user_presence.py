"""User presence heartbeats — last seen, online status, and location hints."""

from __future__ import annotations

import logging
import re
import time
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

from services.auth_config import supabase_enabled
from services.redis_client import get_redis, redis_enabled

logger = logging.getLogger(__name__)

ONLINE_WINDOW_S = 5 * 60
HEARTBEAT_MIN_INTERVAL_S = 60
_MEMORY_THROTTLE: dict[str, float] = {}
_MEMORY_THROTTLE_MAX = 5000

# Country → default song language for Mass Builder targeting.
COUNTRY_LANGUAGE_HINTS: dict[str, str] = {
    "PH": "Tagalog",
    "KR": "Korean",
    "MY": "Malay",
    "SG": "English",
    "US": "English",
    "GB": "English",
    "AU": "English",
    "CA": "English",
    "IE": "English",
    "NZ": "English",
    "IT": "Latin",
    "VA": "Latin",
    "MX": "Spanish",
    "ES": "Spanish",
    "FR": "French",
    "DE": "German",
    "ID": "Indonesian",
    "VN": "Vietnamese",
    "TH": "Thai",
    "JP": "Japanese",
    "CN": "Chinese",
    "HK": "Chinese",
    "TW": "Chinese",
    "BR": "Portuguese",
    "PT": "Portuguese",
}

_COUNTRY_RE = re.compile(r"^[A-Za-z]{2}$")
_TZ_RE = re.compile(r"^[A-Za-z0-9_+\-/]{1,64}$")
_LANG_RE = re.compile(r"^[A-Za-z][A-Za-z \-]{0,39}$")


def language_hint_for_country(country: str | None) -> str | None:
    code = (country or "").strip().upper()
    if not code:
        return None
    return COUNTRY_LANGUAGE_HINTS.get(code)


def is_online(last_seen_at: Any, *, now: Optional[datetime] = None) -> bool:
    if not last_seen_at:
        return False
    try:
        if isinstance(last_seen_at, str):
            raw = last_seen_at.replace("Z", "+00:00")
            dt = datetime.fromisoformat(raw)
        elif isinstance(last_seen_at, datetime):
            dt = last_seen_at
        else:
            return False
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        ref = now or datetime.now(timezone.utc)
        return (ref - dt) <= timedelta(seconds=ONLINE_WINDOW_S)
    except Exception:
        return False


def _normalize_country(value: str | None) -> str | None:
    code = (value or "").strip().upper()
    if not code or not _COUNTRY_RE.match(code):
        return None
    return code


def _normalize_region(value: str | None) -> str | None:
    text = (value or "").strip()
    if not text:
        return None
    return text[:80]


def _normalize_timezone(value: str | None) -> str | None:
    text = (value or "").strip()
    if not text or not _TZ_RE.match(text):
        return None
    return text[:64]


def _normalize_language(value: str | None) -> str | None:
    text = (value or "").strip()
    if not text or not _LANG_RE.match(text):
        return None
    return text[:40]


def country_from_request_headers(headers: Any) -> Optional[str]:
    """Best-effort country from CDN / proxy headers (no IP geolocation lookup)."""
    if headers is None:
        return None
    getters = (
        "cf-ipcountry",
        "CF-IPCountry",
        "x-vercel-ip-country",
        "X-Vercel-IP-Country",
        "cloudfront-viewer-country",
        "CloudFront-Viewer-Country",
        "x-country-code",
        "X-Country-Code",
    )
    for key in getters:
        try:
            raw = headers.get(key)
        except Exception:
            raw = None
        code = _normalize_country(str(raw) if raw is not None else None)
        if code and code not in {"XX", "T1"}:
            return code
    return None


def region_from_request_headers(headers: Any) -> Optional[str]:
    if headers is None:
        return None
    for key in (
        "cf-region",
        "CF-Region",
        "x-vercel-ip-country-region",
        "X-Vercel-IP-Country-Region",
        "cloudfront-viewer-country-region",
    ):
        try:
            raw = headers.get(key)
        except Exception:
            raw = None
        region = _normalize_region(str(raw) if raw is not None else None)
        if region:
            return region
    return None


def _throttle_allows(user_id: str) -> bool:
    uid = (user_id or "").strip()
    if not uid:
        return False
    now = time.time()
    key = f"presence:hb:{uid}"
    if redis_enabled():
        try:
            client = get_redis()
            if client is not None:
                # SET NX EX — only allow if key was absent
                ok = client.set(key, "1", nx=True, ex=HEARTBEAT_MIN_INTERVAL_S)
                return bool(ok)
        except Exception as exc:
            logger.debug("presence redis throttle failed: %s", exc)

    last = _MEMORY_THROTTLE.get(uid)
    if last is not None and (now - last) < HEARTBEAT_MIN_INTERVAL_S:
        return False
    if len(_MEMORY_THROTTLE) >= _MEMORY_THROTTLE_MAX:
        # Drop oldest half to bound memory.
        oldest = sorted(_MEMORY_THROTTLE.items(), key=lambda kv: kv[1])[: _MEMORY_THROTTLE_MAX // 2]
        for drop_uid, _ in oldest:
            _MEMORY_THROTTLE.pop(drop_uid, None)
    _MEMORY_THROTTLE[uid] = now
    return True


def record_heartbeat(
    user_id: str,
    *,
    country: str | None = None,
    region: str | None = None,
    timezone_name: str | None = None,
    preferred_language: str | None = None,
    force: bool = False,
) -> dict[str, Any]:
    """Update profiles.last_seen_* (throttled). Returns presence snapshot."""
    uid = (user_id or "").strip()
    if not uid:
        return {"ok": False, "error": "user_id required"}
    if not supabase_enabled():
        return {"ok": True, "skipped": True, "reason": "supabase_disabled"}

    if not force and not _throttle_allows(uid):
        return {"ok": True, "throttled": True}

    now = datetime.now(timezone.utc)
    now_iso = now.isoformat()
    patch: dict[str, Any] = {"last_seen_at": now_iso}

    country_n = _normalize_country(country)
    if country_n:
        patch["last_seen_country"] = country_n
    region_n = _normalize_region(region)
    if region_n:
        patch["last_seen_region"] = region_n
    tz_n = _normalize_timezone(timezone_name)
    if tz_n:
        patch["last_seen_timezone"] = tz_n
    lang_n = _normalize_language(preferred_language)
    if lang_n:
        patch["preferred_language"] = lang_n

    try:
        from services.supabase_client import get_service_client

        client = get_service_client()
        prior = (
            client.table("profiles")
            .select("email, first_name, last_name, last_seen_at")
            .eq("id", uid)
            .limit(1)
            .execute()
        )
        prior_row = (prior.data or [None])[0] or {}
        client.table("profiles").update(patch).eq("id", uid).execute()
    except Exception as exc:
        logger.warning("presence heartbeat failed for %s: %s", uid, exc)
        return {"ok": False, "error": str(exc)[:120]}

    try:
        previous_seen = prior_row.get("last_seen_at")
        should_alert = True
        if previous_seen:
            try:
                prev_dt = datetime.fromisoformat(str(previous_seen).replace("Z", "+00:00"))
                if prev_dt.tzinfo is None:
                    prev_dt = prev_dt.replace(tzinfo=timezone.utc)
                # Treat a fresh heartbeat after being gone 45+ minutes as a login/session resume.
                should_alert = (now - prev_dt).total_seconds() >= 45 * 60
            except Exception:
                should_alert = True
        if should_alert:
            from services.admin_alerts import alert_user_login_bg

            parish_name = ""
            try:
                from services.parish_store import get_user_parish_context

                ctx = get_user_parish_context(uid)
                parish_name = str((ctx or {}).get("community_name") or "").strip()
            except Exception:
                parish_name = ""
            first = str(prior_row.get("first_name") or "").strip()
            last = str(prior_row.get("last_name") or "").strip()
            alert_user_login_bg(
                user_id=uid,
                email=str(prior_row.get("email") or "").strip(),
                name=" ".join(p for p in (first, last) if p).strip(),
                parish=parish_name,
                country=country_n or "",
            )
    except Exception as exc:
        logger.warning("login alert failed for %s: %s", uid, exc)

    return {
        "ok": True,
        "online": True,
        "last_seen_at": now_iso,
        "last_seen_country": country_n,
        "last_seen_region": region_n,
        "last_seen_timezone": tz_n,
        "preferred_language": lang_n,
        "language_hint": language_hint_for_country(country_n),
    }


def enrich_user_presence(row: dict[str, Any]) -> dict[str, Any]:
    """Attach derived online + language_hint fields for admin list rows."""
    country = (row.get("last_seen_country") or "").strip().upper() or None
    preferred = (row.get("preferred_language") or "").strip() or None
    hint = preferred or language_hint_for_country(country)
    last_seen = row.get("last_seen_at")
    return {
        **row,
        "online": is_online(last_seen),
        "language_hint": hint,
        "location_label": _location_label(
            country=country,
            region=(row.get("last_seen_region") or "").strip() or None,
            timezone_name=(row.get("last_seen_timezone") or "").strip() or None,
        ),
    }


def _location_label(
    *,
    country: str | None,
    region: str | None,
    timezone_name: str | None,
) -> str:
    parts: list[str] = []
    if region:
        parts.append(region)
    if country:
        parts.append(country)
    if not parts and timezone_name:
        parts.append(timezone_name)
    return " · ".join(parts) if parts else ""
