"""Superadmin readings cache health, manual edits, and month scan."""

from __future__ import annotations

import calendar
import datetime as dt
import time
from typing import Any, Literal, Mapping

from services.calendar_month import fetch_calendar_month
from services.lectionary_service import get_liturgical_data
from services.lectionary_store import get_cached
from services.readings_snapshot import invalidate_readings_memory
from services.usccb_readings import (
    CACHE_KEYS,
    _CACHE_LOCK,
    _cache_entry_has_psalm,
    _cache_entry_is_complete,
    _load_cache_file,
    reading_body_is_usable,
    set_readings_cache_entry,
)

HealthStatus = str  # "healthy" | "warning" | "critical"

_EDITABLE_KEYS = frozenset(CACHE_KEYS)


def _raw_cache_entry(date: str) -> dict[str, str] | None:
    iso = date.strip()
    with _CACHE_LOCK:
        blob = _load_cache_file()
    row = blob.get(iso)
    if not isinstance(row, dict):
        return None
    return {k: str(row.get(k) or "") for k in CACHE_KEYS}


def _field_body_ok(entry: Mapping[str, str] | None, key: str) -> bool:
    return bool(entry and reading_body_is_usable(entry.get(key) or ""))


def _field_ref_ok(entry: Mapping[str, str] | None, key: str) -> bool:
    return bool(entry and (entry.get(key) or "").strip())


def _field_snapshot(entry: Mapping[str, str] | None, body_key: str, ref_key: str) -> dict[str, Any]:
    body = (entry.get(body_key) or "").strip() if entry else ""
    ref = (entry.get(ref_key) or "").strip() if entry else ""
    body_ok = reading_body_is_usable(body)
    return {
        "ok": body_ok,
        "has_ref": bool(ref),
        "ref": ref,
        "body": body,
    }


def assess_readings_health(date: str) -> dict[str, Any]:
    """Return overall status and per-column health for a Mass date."""
    iso = date.strip()
    try:
        on_date = dt.date.fromisoformat(iso)
    except ValueError:
        return {"date": iso, "status": "critical", "is_sunday": False, "fields": {}}

    is_sunday = on_date.weekday() == 6
    entry = _raw_cache_entry(iso)

    psalm_ok = bool(entry and _cache_entry_has_psalm(entry))
    fields: dict[str, Any] = {
        "first_reading": _field_snapshot(entry, "first_reading", "first_reading_ref"),
        "second_reading": _field_snapshot(entry, "second_reading", "second_reading_ref"),
        "psalm": {
            "ok": psalm_ok,
            "has_ref": _field_ref_ok(entry, "psalm_ref"),
            "ref": (entry.get("psalm_ref") or "").strip() if entry else "",
            "body": (entry.get("psalm_text") or entry.get("psalm_verses") or "").strip() if entry else "",
            "response": (entry.get("psalm_response") or "").strip() if entry else "",
            "verses": (entry.get("psalm_verses") or "").strip() if entry else "",
        },
        "gospel": _field_snapshot(entry, "gospel", "gospel_ref"),
    }
    fields["first_reading"]["ok"] = _field_body_ok(entry, "first_reading")
    fields["second_reading"]["ok"] = _field_body_ok(entry, "second_reading") if is_sunday else True
    fields["gospel"]["ok"] = _field_body_ok(entry, "gospel")

    if not entry or not any((entry.get(k) or "").strip() for k in CACHE_KEYS):
        status: HealthStatus = "critical"
    elif entry and _cache_entry_is_complete(entry):
        if is_sunday and not _field_body_ok(entry, "second_reading"):
            status = "warning"
        else:
            status = "healthy"
    elif (
        _field_body_ok(entry, "first_reading")
        or _field_body_ok(entry, "gospel")
        or psalm_ok
        or any(_field_ref_ok(entry, k) for k in ("first_reading_ref", "gospel_ref", "psalm_ref", "second_reading_ref"))
    ):
        status = "warning"
    else:
        status = "critical"

    return {
        "date": iso,
        "status": status,
        "is_sunday": is_sunday,
        "fields": fields,
        "has_cache_row": entry is not None,
    }


def get_readings_admin_detail(date: str) -> dict[str, Any]:
    entry = _raw_cache_entry(date) or {}
    health = assess_readings_health(date)
    cached_payload = get_cached(date.strip())
    return {
        "ok": True,
        "date": date.strip(),
        "health": health,
        "entry": {k: entry.get(k, "") for k in CACHE_KEYS},
        "title": (cached_payload or {}).get("title") or "",
        "season": (cached_payload or {}).get("season") or "",
    }


def patch_readings_admin_entry(date: str, updates: Mapping[str, str]) -> dict[str, Any]:
    iso = date.strip()
    if not iso:
        raise ValueError("date is required")

    filtered = {k: str(v) for k, v in updates.items() if k in _EDITABLE_KEYS}
    if not filtered:
        raise ValueError("no valid reading fields to update")

    existing = _raw_cache_entry(iso) or {k: "" for k in CACHE_KEYS}
    merged = {**existing, **filtered}
    set_readings_cache_entry(iso, merged)
    invalidate_readings_memory(iso)

    try:
        get_liturgical_data(iso, force_refresh=True)
    except Exception:
        pass

    return get_readings_admin_detail(iso)


def fetch_readings_admin_date(date: str) -> dict[str, Any]:
    """Force a live USCCB/Bible fetch for one date, bypassing cached rows."""
    iso = date.strip()
    if not iso:
        raise ValueError("date is required")
    dt.date.fromisoformat(iso)

    before = assess_readings_health(iso)
    invalidate_readings_memory(iso)

    error = ""
    fetched = False
    try:
        live = get_liturgical_data(iso, force_refresh=True)
        fetched = live is not None
    except Exception as exc:
        error = str(exc).strip() or "Live fetch failed"

    after = assess_readings_health(iso)
    detail = get_readings_admin_detail(iso)
    detail["fetch"] = {
        "ok": fetched and after["status"] != "critical",
        "fetched": fetched,
        "before": before["status"],
        "after": after["status"],
        "error": error,
    }
    return detail


def fetch_admin_calendar_month(year: int, month: int) -> dict[str, Any]:
    base = fetch_calendar_month(year, month)
    for iso, day in base.get("days", {}).items():
        health = assess_readings_health(iso)
        day["readings_health"] = health["status"]
    base["admin"] = True
    return base


def scan_month_readings(
    year: int,
    month: int,
    *,
    scope: Literal["missing", "all"] = "missing",
) -> dict[str, Any]:
    if month < 1 or month > 12:
        raise ValueError("month must be 1–12")

    days_in_month = calendar.monthrange(year, month)[1]
    scanned = 0
    improved = 0
    still_missing: list[str] = []
    details: list[dict[str, Any]] = []

    for d in range(1, days_in_month + 1):
        iso = f"{year:04d}-{month:02d}-{d:02d}"
        before = assess_readings_health(iso)
        if scope == "missing" and before["status"] == "healthy":
            continue

        scanned += 1
        before_status = before["status"]
        fetched = False
        error = ""
        try:
            invalidate_readings_memory(iso)
            live = get_liturgical_data(iso, force_refresh=True)
            fetched = live is not None
        except Exception as exc:
            error = str(exc).strip() or "Live fetch failed"
            fetched = False

        if scope == "all" and scanned < days_in_month:
            time.sleep(0.75)

        after = assess_readings_health(iso)
        after_status = after["status"]
        if after_status == "healthy" and before_status != "healthy":
            improved += 1
        elif after_status != "healthy":
            still_missing.append(iso)

        row: dict[str, Any] = {
            "date": iso,
            "before": before_status,
            "after": after_status,
            "fetched": fetched,
        }
        if error:
            row["error"] = error
        details.append(row)

    return {
        "ok": True,
        "year": year,
        "month": month,
        "scope": scope,
        "scanned": scanned,
        "improved": improved,
        "still_missing": still_missing,
        "details": details,
    }
