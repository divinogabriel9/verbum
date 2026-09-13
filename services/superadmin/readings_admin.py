"""Superadmin readings cache health, manual edits, and month scan."""

from __future__ import annotations

import calendar
import datetime as dt
import time
from typing import Any, Literal, Mapping

from services.calendar_month import fetch_calendar_month
from services.lectionary_service import get_liturgical_data
from services.lectionary_store import get_cached, upsert
from services.mass_language import normalize_mass_language
from services.readings_snapshot import invalidate_readings_memory
from services.usccb_readings import (
    CACHE_KEYS,
    _CACHE_LOCK,
    _cache_entry_has_core_refs,
    _cache_entry_has_psalm,
    _cache_entry_has_psalm_refrain,
    _cache_entry_is_complete,
    _load_cache_file,
    reading_body_is_usable,
    repair_eaten_r_refrain,
    set_readings_cache_entry,
)

HealthStatus = str  # "healthy" | "warning" | "critical"

_EDITABLE_KEYS = frozenset(CACHE_KEYS)

# JSON cache keys → Mass Builder / SQLite lectionary payload keys.
_CACHE_TO_LECTIONARY = (
    ("first_reading", "first_reading_text"),
    ("first_reading_ref", "first_reading"),
    ("second_reading", "second_reading_text"),
    ("second_reading_ref", "second_reading"),
    ("psalm_text", "psalm_text"),
    ("psalm_response", "psalm_response"),
    ("psalm_verses", "psalm_verses"),
    ("psalm_ref", "psalm"),
    ("gospel", "gospel_text"),
    ("gospel_ref", "gospel_reference"),
    ("gospel_acclamation", "gospel_acclamation"),
)


def _invalidate_preview_layers(date: str) -> None:
    invalidate_readings_memory(date)
    try:
        from pipeline import invalidate_preview_cache

        invalidate_preview_cache(date)
    except Exception:
        pass


def _apply_cache_edits_to_lectionary(iso: str, entry: Mapping[str, str]) -> None:
    """Write calendar edits onto the SQLite payload Mass Builder reads."""
    cached = get_cached(iso)
    if not cached:
        return
    updated = dict(cached)
    for cache_key, lec_key in _CACHE_TO_LECTIONARY:
        updated[lec_key] = str(entry.get(cache_key) or "")
    for psalm_key in ("psalm_text", "psalm_response"):
        updated[psalm_key] = repair_eaten_r_refrain(str(updated.get(psalm_key) or ""))
    gospel_text = str(updated.get("gospel_text") or "").strip()
    if gospel_text:
        from services.gospel_quote_extractor import extract_gospel_slide_quote

        updated["gospel_slide_quote"] = (
            extract_gospel_slide_quote(gospel_text, max_chars=300) or ""
        )
    celebration = str(entry.get("mass_celebration") or "").strip()
    if celebration:
        updated["celebration"] = celebration
        updated["title"] = celebration
    upsert(iso, updated)


def _raw_cache_entry(date: str) -> dict[str, str] | None:
    iso = date.strip()
    with _CACHE_LOCK:
        blob = _load_cache_file()
    row = blob.get(iso)
    if not isinstance(row, dict):
        return None
    return {k: str(row.get(k) or "") for k in CACHE_KEYS}


def _heal_missing_refs_from_lectionary(date: str, entry: dict[str, str]) -> dict[str, str]:
    """Copy scripture citations from the lectionary payload when the JSON cache lacks them.

    Legacy rows often have full prose but empty ``*_ref`` fields. The lectionary
    SQLite row usually already has the citations from the catholic-readings API.
    """
    cached = get_cached(date.strip())
    if not cached:
        return entry
    mapping = (
        ("psalm_ref", "psalm"),
        ("first_reading_ref", "first_reading"),
        ("second_reading_ref", "second_reading"),
        ("gospel_ref", "gospel_reference"),
    )
    updates: dict[str, str] = {}
    for cache_key, lec_key in mapping:
        if (entry.get(cache_key) or "").strip():
            continue
        val = str(cached.get(lec_key) or "").strip().rstrip(".")
        if val:
            updates[cache_key] = val
    if not updates:
        return entry
    merged = {**entry, **updates}
    set_readings_cache_entry(date.strip(), merged)
    invalidate_readings_memory(date.strip())
    return merged


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


def _cache_entry_for_language(iso: str, language: str) -> dict[str, str] | None:
    lang = normalize_mass_language(language)
    if lang == "tagalog":
        from services.awit_at_papuri_readings import get_tagalog_cache_entry

        return get_tagalog_cache_entry(iso)
    return _raw_cache_entry(iso)


def assess_readings_health(date: str, language: str = "english") -> dict[str, Any]:
    """Return overall status and per-column health for a Mass date."""
    iso = date.strip()
    try:
        on_date = dt.date.fromisoformat(iso)
    except ValueError:
        return {"date": iso, "status": "critical", "is_sunday": False, "fields": {}}

    is_sunday = on_date.weekday() == 6
    lang = normalize_mass_language(language)
    entry = _cache_entry_for_language(iso, lang)
    if lang != "tagalog" and entry and not _cache_entry_has_core_refs(entry):
        entry = _heal_missing_refs_from_lectionary(iso, entry)

    psalm_body_ok = bool(entry and _cache_entry_has_psalm(entry))
    psalm_refrain_ok = bool(entry and _cache_entry_has_psalm_refrain(entry))
    psalm_ref_ok = _field_ref_ok(entry, "psalm_ref")
    # Citation + USCCB refrain required — verses alone used to mark Sundays
    # healthy while the slide showed the wrong (WEB) psalm text.
    psalm_ok = psalm_refrain_ok and psalm_ref_ok
    fields: dict[str, Any] = {
        "first_reading": _field_snapshot(entry, "first_reading", "first_reading_ref"),
        "second_reading": _field_snapshot(entry, "second_reading", "second_reading_ref"),
        "psalm": {
            "ok": psalm_ok,
            "has_ref": psalm_ref_ok,
            "ref": (entry.get("psalm_ref") or "").strip() if entry else "",
            "body": (entry.get("psalm_text") or entry.get("psalm_verses") or "").strip() if entry else "",
            "response": (entry.get("psalm_response") or "").strip() if entry else "",
            "verses": (entry.get("psalm_verses") or "").strip() if entry else "",
        },
        "gospel": _field_snapshot(entry, "gospel", "gospel_ref"),
    }
    fields["first_reading"]["ok"] = _field_body_ok(entry, "first_reading") and _field_ref_ok(
        entry, "first_reading_ref"
    )
    fields["second_reading"]["ok"] = (
        (_field_body_ok(entry, "second_reading") and _field_ref_ok(entry, "second_reading_ref"))
        if is_sunday
        else True
    )
    fields["gospel"]["ok"] = _field_body_ok(entry, "gospel") and _field_ref_ok(entry, "gospel_ref")

    if not entry or not any((entry.get(k) or "").strip() for k in CACHE_KEYS):
        status: HealthStatus = "critical"
    elif entry and _cache_entry_is_complete(entry):
        if is_sunday and not (
            _field_body_ok(entry, "second_reading") and _field_ref_ok(entry, "second_reading_ref")
        ):
            status = "warning"
        else:
            status = "healthy"
    elif (
        _field_body_ok(entry, "first_reading")
        or _field_body_ok(entry, "gospel")
        or psalm_body_ok
        or any(_field_ref_ok(entry, k) for k in ("first_reading_ref", "gospel_ref", "psalm_ref", "second_reading_ref"))
        or (entry and not _cache_entry_has_core_refs(entry))
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


def get_readings_admin_detail(date: str, language: str = "english") -> dict[str, Any]:
    iso = date.strip()
    lang = normalize_mass_language(language)
    entry = _cache_entry_for_language(iso, lang) or {}
    if lang != "tagalog" and entry and not _cache_entry_has_core_refs(entry):
        entry = _heal_missing_refs_from_lectionary(iso, entry)
    for psalm_key in ("psalm_text", "psalm_response"):
        if entry.get(psalm_key):
            entry[psalm_key] = repair_eaten_r_refrain(str(entry.get(psalm_key) or ""))
    health = assess_readings_health(iso, language=lang)
    cached_payload = get_cached(iso) if lang != "tagalog" else None
    title = (cached_payload or {}).get("title") or ""
    season = (cached_payload or {}).get("season") or ""
    if lang == "tagalog":
        title = str(entry.get("mass_celebration") or "").strip() or title
        if not season:
            from services.liturgical_calendar import get_liturgical_color

            color = get_liturgical_color(iso)
            season = str((color or {}).get("season_label") or (color or {}).get("season") or "")
    return {
        "ok": True,
        "date": iso,
        "language": lang,
        "health": health,
        "entry": {k: entry.get(k, "") for k in CACHE_KEYS},
        "title": title,
        "season": season,
    }


def patch_readings_admin_entry(
    date: str,
    updates: Mapping[str, str],
    language: str = "english",
) -> dict[str, Any]:
    iso = date.strip()
    if not iso:
        raise ValueError("date is required")

    lang = normalize_mass_language(language)
    filtered = {k: str(v) for k, v in updates.items() if k in _EDITABLE_KEYS}
    if not filtered:
        raise ValueError("no valid reading fields to update")

    if lang == "tagalog":
        from services.awit_at_papuri_readings import (
            CACHE_KEYS as TAGALOG_CACHE_KEYS,
            get_tagalog_cache_entry,
            set_tagalog_cache_entry,
        )

        existing = get_tagalog_cache_entry(iso) or {k: "" for k in TAGALOG_CACHE_KEYS}
    else:
        existing = _raw_cache_entry(iso) or {k: "" for k in CACHE_KEYS}
    changed = False
    for key, value in filtered.items():
        if str(existing.get(key) or "") != value:
            changed = True
            break

    if not changed:
        detail = get_readings_admin_detail(iso, language=lang)
        detail["unchanged"] = True
        return detail

    merged = {**existing, **filtered}
    for psalm_key in ("psalm_text", "psalm_response"):
        if merged.get(psalm_key):
            merged[psalm_key] = repair_eaten_r_refrain(str(merged.get(psalm_key) or ""))
    if lang == "tagalog":
        set_tagalog_cache_entry(iso, merged)
    else:
        set_readings_cache_entry(iso, merged)
        _apply_cache_edits_to_lectionary(iso, merged)
    _invalidate_preview_layers(iso)
    # Do not force a live USCCB refresh here — that belongs to "Fetch from USCCB".
    # Writing the cache + reassessing health is enough for Save.

    detail = get_readings_admin_detail(iso, language=lang)
    detail["unchanged"] = False
    return detail


def fetch_readings_admin_date(date: str, language: str = "english") -> dict[str, Any]:
    """Force a live fetch for one date, bypassing cached rows.

    English uses USCCB/Bible. Tagalog uses Awit at Papuri.
    """
    iso = date.strip()
    if not iso:
        raise ValueError("date is required")
    dt.date.fromisoformat(iso)
    lang = normalize_mass_language(language)

    before = assess_readings_health(iso, language=lang)
    _invalidate_preview_layers(iso)

    error = ""
    fetched = False
    try:
        live = get_liturgical_data(iso, force_refresh=True, language=lang)
        fetched = live is not None
    except Exception as exc:
        error = str(exc).strip() or "Live fetch failed"

    after = assess_readings_health(iso, language=lang)
    detail = get_readings_admin_detail(iso, language=lang)
    detail["fetch"] = {
        "ok": fetched and after["status"] != "critical",
        "fetched": fetched,
        "before": before["status"],
        "after": after["status"],
        "error": error,
        "source": "awit_at_papuri" if lang == "tagalog" else "usccb",
    }
    return detail


def fetch_admin_calendar_month(
    year: int,
    month: int,
    *,
    language: str = "english",
) -> dict[str, Any]:
    base = fetch_calendar_month(year, month, language=language)
    for iso, day in base.get("days", {}).items():
        health = assess_readings_health(iso, language=language)
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
            _invalidate_preview_layers(iso)
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
