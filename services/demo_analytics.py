"""Landing-page demo generate analytics (identity + funnel).

Persists best-effort visitor signals for superadmin review:
IP, country (CDN headers), device/phone brand (User-Agent), and generation details.
Never raises into the generate path.
"""

from __future__ import annotations

import json
import logging
import os
import re
import time
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

from starlette.requests import Request

from services.redis_client import get_redis

logger = logging.getLogger(__name__)

_PROJECT_ROOT = Path(__file__).resolve().parents[1]
_STORE_PATH = _PROJECT_ROOT / "data" / "demo_generations.json"
_REDIS_LIST_KEY = "verbum:demo_generations"
_REDIS_MAX = 1000
_UA_MAX = 400

# Order matters: more specific brands before generic Android / iOS.
_PHONE_BRAND_PATTERNS: tuple[tuple[str, re.Pattern[str]], ...] = (
    ("Apple", re.compile(r"iPhone|iPad|iPod", re.I)),
    ("Samsung", re.compile(r"Samsung|SM-[A-Z0-9]+|Galaxy", re.I)),
    ("Google", re.compile(r"Pixel\b", re.I)),
    ("Xiaomi", re.compile(r"Xiaomi|Redmi|POCO|Mi\s?\d", re.I)),
    ("Huawei", re.compile(r"Huawei|Honor|HUAWEI", re.I)),
    ("OPPO", re.compile(r"\bOPPO\b|CPH\d{4}|Realme", re.I)),
    ("vivo", re.compile(r"\bvivo\b|V\d{4}[A-Z]?", re.I)),
    ("OnePlus", re.compile(r"OnePlus|ONEPLUS", re.I)),
    ("Motorola", re.compile(r"Motorola|moto\s?[a-z]?\d", re.I)),
    ("Nokia", re.compile(r"Nokia", re.I)),
    ("Sony", re.compile(r"Sony|Xperia", re.I)),
    ("LG", re.compile(r"\bLG[- ]?[A-Z]?\d|LM-[A-Z]\d", re.I)),
    ("ASUS", re.compile(r"ASUS|ZenFone", re.I)),
    ("Nothing", re.compile(r"Nothing\s?(Phone|A\d+)", re.I)),
    ("Tecno", re.compile(r"Tecno|Infinix|Itel", re.I)),
)


@dataclass
class DemoGenerationEvent:
    created_at: float
    client_ip: str
    country: str
    region: str
    device_brand: str
    device_class: str  # phone | tablet | desktop | bot | unknown
    os_name: str
    user_agent: str
    mass_date: str
    mass_language: str
    celebrant: str
    slide_count: int
    include_leaflet: bool
    ai_poster_used: bool
    export_stem: str
    accept_language: str = ""


def _client_ip(request: Request) -> str:
    if os.environ.get("RENDER") or os.environ.get("RENDER_EXTERNAL_URL"):
        client = request.client
        if client and client.host:
            return client.host
    forwarded = (request.headers.get("x-forwarded-for") or "").split(",")[0].strip()
    if forwarded:
        return forwarded
    client = request.client
    return client.host if client else "unknown"


def _trim(value: Any, *, max_len: int) -> str:
    return " ".join(str(value or "").split()).strip()[:max_len]


def parse_device_from_ua(user_agent: str) -> dict[str, str]:
    """Best-effort phone brand / device class / OS from User-Agent."""
    ua = _trim(user_agent, max_len=_UA_MAX)
    if not ua:
        return {"device_brand": "Unknown", "device_class": "unknown", "os_name": "Unknown"}

    lower = ua.lower()
    if "bot" in lower or "crawler" in lower or "spider" in lower or "curl/" in lower:
        return {"device_brand": "Bot", "device_class": "bot", "os_name": "Unknown"}

    brand = "Unknown"
    for name, pattern in _PHONE_BRAND_PATTERNS:
        if pattern.search(ua):
            brand = name
            break

    if "ipad" in lower or ("android" in lower and "mobile" not in lower and "tablet" in lower):
        device_class = "tablet"
    elif "iphone" in lower or "ipod" in lower or ("android" in lower and "mobile" in lower):
        device_class = "phone"
    elif "android" in lower and brand != "Unknown":
        device_class = "phone"
    elif "macintosh" in lower or "windows" in lower or "linux" in lower or "cros" in lower:
        device_class = "desktop"
        if brand == "Unknown":
            if "macintosh" in lower:
                brand = "Apple"
            elif "cros" in lower:
                brand = "Google"
            elif "windows" in lower:
                brand = "Microsoft"
            else:
                brand = "Desktop"
    else:
        device_class = "unknown"

    if "iphone" in lower or "ipad" in lower or "ipod" in lower:
        os_name = "iOS"
    elif "android" in lower:
        os_name = "Android"
    elif "mac os" in lower or "macintosh" in lower:
        os_name = "macOS"
    elif "windows" in lower:
        os_name = "Windows"
    elif "cros" in lower:
        os_name = "ChromeOS"
    elif "linux" in lower:
        os_name = "Linux"
    else:
        os_name = "Unknown"

    if brand == "Unknown" and device_class == "phone":
        brand = "Android" if os_name == "Android" else "Mobile"

    return {
        "device_brand": brand,
        "device_class": device_class,
        "os_name": os_name,
    }


def identity_from_request(request: Request) -> dict[str, str]:
    """Extract IP / country / device signals from the HTTP request."""
    from services.user_presence import country_from_request_headers, region_from_request_headers

    ua = _trim(request.headers.get("user-agent") or "", max_len=_UA_MAX)
    device = parse_device_from_ua(ua)
    country = country_from_request_headers(request.headers) or ""
    region = region_from_request_headers(request.headers) or ""
    return {
        "client_ip": _client_ip(request),
        "country": country,
        "region": region,
        "user_agent": ua,
        "accept_language": _trim(request.headers.get("accept-language") or "", max_len=80),
        **device,
    }


def _iso_from_ts(ts: float) -> str:
    return datetime.fromtimestamp(float(ts), tz=timezone.utc).isoformat()


def _persist_local(row: dict[str, Any]) -> None:
    _STORE_PATH.parent.mkdir(parents=True, exist_ok=True)
    rows: list[dict[str, Any]] = []
    if _STORE_PATH.is_file():
        try:
            raw = json.loads(_STORE_PATH.read_text(encoding="utf-8"))
            if isinstance(raw, list):
                rows = [r for r in raw if isinstance(r, dict)]
        except (OSError, json.JSONDecodeError):
            rows = []
    rows.append(row)
    rows = rows[-_REDIS_MAX:]
    _STORE_PATH.write_text(json.dumps(rows, ensure_ascii=False, indent=2), encoding="utf-8")


def _persist_redis(row: dict[str, Any]) -> None:
    client = get_redis()
    if client is None:
        return
    try:
        client.lpush(_REDIS_LIST_KEY, json.dumps(row, ensure_ascii=False))
        client.ltrim(_REDIS_LIST_KEY, 0, _REDIS_MAX - 1)
    except Exception as exc:
        logger.warning("Redis demo analytics store failed: %s", exc)


def _persist_supabase(row: dict[str, Any]) -> None:
    try:
        from services.auth_config import supabase_enabled
        from services.supabase_client import get_service_client
    except Exception:
        return
    if not supabase_enabled():
        return
    try:
        client = get_service_client()
        client.table("demo_generations").insert(
            {
                "created_at": row.get("created_at_iso") or _iso_from_ts(row["created_at"]),
                "client_ip": row.get("client_ip") or "",
                "country": row.get("country") or "",
                "region": row.get("region") or "",
                "device_brand": row.get("device_brand") or "",
                "device_class": row.get("device_class") or "",
                "os_name": row.get("os_name") or "",
                "user_agent": row.get("user_agent") or "",
                "accept_language": row.get("accept_language") or "",
                "mass_date": row.get("mass_date") or "",
                "mass_language": row.get("mass_language") or "",
                "celebrant": row.get("celebrant") or "",
                "slide_count": int(row.get("slide_count") or 0),
                "include_leaflet": bool(row.get("include_leaflet")),
                "ai_poster_used": bool(row.get("ai_poster_used")),
                "export_stem": row.get("export_stem") or "",
            }
        ).execute()
    except Exception as exc:
        msg = str(exc)
        if "demo_generations" in msg or "PGRST205" in msg:
            logger.warning("demo_generations table unavailable; using Redis/local only (%s)", exc)
        else:
            logger.warning("demo_generations insert failed: %s", exc)


def _capture_posthog(row: dict[str, Any]) -> None:
    try:
        from services.posthog_analytics import capture

        distinct = f"demo:{row.get('client_ip') or 'unknown'}"
        capture(
            "demo_deck_generated",
            distinct_id=distinct,
            properties={
                "mass_date": row.get("mass_date"),
                "mass_language": row.get("mass_language"),
                "slide_count": row.get("slide_count"),
                "include_leaflet": row.get("include_leaflet"),
                "ai_poster_used": row.get("ai_poster_used"),
                "country": row.get("country") or None,
                "region": row.get("region") or None,
                "device_brand": row.get("device_brand"),
                "device_class": row.get("device_class"),
                "os_name": row.get("os_name"),
                # IP is useful for abuse review in PostHog; treat as sensitive.
                "client_ip": row.get("client_ip"),
                "$ip": row.get("client_ip") or None,
            },
        )
    except Exception:
        logger.debug("PostHog demo capture skipped", exc_info=True)


def _alert_telegram(row: dict[str, Any]) -> None:
    try:
        from services.admin_alerts import alert_demo_generation

        alert_demo_generation(
            client_ip=str(row.get("client_ip") or ""),
            country=str(row.get("country") or ""),
            device_brand=str(row.get("device_brand") or ""),
            mass_date=str(row.get("mass_date") or ""),
            mass_language=str(row.get("mass_language") or ""),
        )
    except Exception as exc:
        logger.warning("Demo generation telegram alert failed: %s", exc)


def record_demo_generation(
    request: Request,
    *,
    mass_date: str,
    mass_language: str,
    celebrant: str,
    slide_count: int,
    include_leaflet: bool = False,
    ai_poster_used: bool = False,
    export_stem: str = "",
) -> Optional[dict[str, Any]]:
    """Record a successful landing demo generate. Best-effort; never raises."""
    try:
        identity = identity_from_request(request)
        event = DemoGenerationEvent(
            created_at=time.time(),
            client_ip=identity["client_ip"],
            country=identity["country"],
            region=identity["region"],
            device_brand=identity["device_brand"],
            device_class=identity["device_class"],
            os_name=identity["os_name"],
            user_agent=identity["user_agent"],
            accept_language=identity["accept_language"],
            mass_date=_trim(mass_date, max_len=16),
            mass_language=_trim(mass_language, max_len=16),
            celebrant=_trim(celebrant, max_len=120),
            slide_count=max(0, int(slide_count or 0)),
            include_leaflet=bool(include_leaflet),
            ai_poster_used=bool(ai_poster_used),
            export_stem=_trim(export_stem, max_len=160),
        )
        row = asdict(event)
        row["created_at_iso"] = _iso_from_ts(event.created_at)
        try:
            _persist_local(row)
        except Exception as exc:
            logger.warning("Local demo analytics store failed: %s", exc)
        _persist_redis(row)
        _persist_supabase(row)
        _capture_posthog(row)
        _alert_telegram(row)
        print(
            f"[demo-analytics] ip={event.client_ip!r} country={event.country or '—'!r} "
            f"brand={event.device_brand!r} class={event.device_class!r} "
            f"date={event.mass_date!r} lang={event.mass_language!r}",
            flush=True,
        )
        return row
    except Exception:
        logger.exception("record_demo_generation failed")
        return None


def _rows_from_redis(*, limit: int) -> list[dict[str, Any]]:
    client = get_redis()
    if client is None:
        return []
    try:
        raw_rows = client.lrange(_REDIS_LIST_KEY, 0, max(0, limit - 1)) or []
    except Exception as exc:
        logger.warning("Redis demo analytics read failed: %s", exc)
        return []
    out: list[dict[str, Any]] = []
    for raw in raw_rows:
        try:
            if isinstance(raw, bytes):
                raw = raw.decode("utf-8")
            item = json.loads(raw)
            if isinstance(item, dict):
                out.append(item)
        except (TypeError, json.JSONDecodeError):
            continue
    return out


def _rows_from_local(*, limit: int) -> list[dict[str, Any]]:
    if not _STORE_PATH.is_file():
        return []
    try:
        raw = json.loads(_STORE_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return []
    if not isinstance(raw, list):
        return []
    rows = [r for r in raw if isinstance(r, dict)]
    rows.sort(key=lambda r: float(r.get("created_at") or 0), reverse=True)
    return rows[:limit]


def _rows_from_supabase(*, days: int, limit: int) -> list[dict[str, Any]]:
    try:
        from services.auth_config import supabase_enabled
        from services.supabase_client import get_service_client
    except Exception:
        return []
    if not supabase_enabled():
        return []
    try:
        client = get_service_client()
        start = datetime.now(timezone.utc).timestamp() - (max(1, days) * 86400)
        start_iso = _iso_from_ts(start)
        result = (
            client.table("demo_generations")
            .select(
                "created_at,client_ip,country,region,device_brand,device_class,"
                "os_name,mass_date,mass_language,celebrant,slide_count,"
                "include_leaflet,ai_poster_used,export_stem,user_agent,accept_language"
            )
            .gte("created_at", start_iso)
            .order("created_at", desc=True)
            .limit(limit)
            .execute()
        )
        rows: list[dict[str, Any]] = []
        for item in result.data or []:
            if not isinstance(item, dict):
                continue
            created = str(item.get("created_at") or "")
            try:
                ts = datetime.fromisoformat(created.replace("Z", "+00:00")).timestamp()
            except ValueError:
                ts = 0.0
            rows.append(
                {
                    "created_at": ts,
                    "created_at_iso": created,
                    "client_ip": item.get("client_ip") or "",
                    "country": item.get("country") or "",
                    "region": item.get("region") or "",
                    "device_brand": item.get("device_brand") or "",
                    "device_class": item.get("device_class") or "",
                    "os_name": item.get("os_name") or "",
                    "user_agent": item.get("user_agent") or "",
                    "accept_language": item.get("accept_language") or "",
                    "mass_date": item.get("mass_date") or "",
                    "mass_language": item.get("mass_language") or "",
                    "celebrant": item.get("celebrant") or "",
                    "slide_count": int(item.get("slide_count") or 0),
                    "include_leaflet": bool(item.get("include_leaflet")),
                    "ai_poster_used": bool(item.get("ai_poster_used")),
                    "export_stem": item.get("export_stem") or "",
                }
            )
        return rows
    except Exception as exc:
        logger.warning("demo_generations query failed: %s", exc)
        return []


def _shape_public_row(row: dict[str, Any]) -> dict[str, Any]:
    created_iso = row.get("created_at_iso")
    if not created_iso and row.get("created_at"):
        try:
            created_iso = _iso_from_ts(float(row["created_at"]))
        except (TypeError, ValueError):
            created_iso = ""
    return {
        "created_at": created_iso,
        "client_ip": str(row.get("client_ip") or ""),
        "country": str(row.get("country") or ""),
        "region": str(row.get("region") or ""),
        "device_brand": str(row.get("device_brand") or ""),
        "device_class": str(row.get("device_class") or ""),
        "os_name": str(row.get("os_name") or ""),
        "mass_date": str(row.get("mass_date") or ""),
        "mass_language": str(row.get("mass_language") or ""),
        "celebrant": str(row.get("celebrant") or ""),
        "slide_count": int(row.get("slide_count") or 0),
        "include_leaflet": bool(row.get("include_leaflet")),
        "ai_poster_used": bool(row.get("ai_poster_used")),
    }


def list_demo_generations(*, days: int = 14, limit: int = 100) -> dict[str, Any]:
    """Recent demo generates for superadmin analytics."""
    days = max(1, min(int(days or 14), 90))
    limit = max(10, min(int(limit or 100), 500))
    cutoff = time.time() - (days * 86400)

    rows = _rows_from_supabase(days=days, limit=limit)
    if not rows:
        rows = _rows_from_redis(limit=limit) or _rows_from_local(limit=limit)
        rows = [r for r in rows if float(r.get("created_at") or 0) >= cutoff]

    rows.sort(key=lambda r: float(r.get("created_at") or 0), reverse=True)
    recent = [_shape_public_row(r) for r in rows[:limit]]

    by_day: dict[str, int] = {}
    by_country: dict[str, int] = {}
    by_brand: dict[str, int] = {}
    for row in recent:
        day = str(row.get("created_at") or "")[:10]
        if day:
            by_day[day] = by_day.get(day, 0) + 1
        country = (row.get("country") or "").strip().upper() or "—"
        by_country[country] = by_country.get(country, 0) + 1
        brand = (row.get("device_brand") or "").strip() or "Unknown"
        by_brand[brand] = by_brand.get(brand, 0) + 1

    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    return {
        "recent": recent,
        "by_day": [{"date": d, "count": c} for d, c in sorted(by_day.items())],
        "by_country": sorted(
            [{"country": k, "count": v} for k, v in by_country.items()],
            key=lambda x: int(x["count"]),
            reverse=True,
        )[:15],
        "by_brand": sorted(
            [{"brand": k, "count": v} for k, v in by_brand.items()],
            key=lambda x: int(x["count"]),
            reverse=True,
        )[:15],
        "summary": {
            "demo_generations_in_period": len(recent),
            "demo_generations_today": by_day.get(today, 0),
        },
    }
