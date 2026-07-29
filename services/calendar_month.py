"""Lightweight liturgical summaries for the month calendar UI."""

from __future__ import annotations

import calendar
import datetime as dt
from typing import Any, Optional

from services.awit_at_papuri_readings import get_tagalog_cache_entry
from services.lectionary_service import get_liturgical_data
from services.lectionary_store import get_cached
from services.liturgical_calendar import get_liturgical_color
from services.mass_language import normalize_mass_language
from services.ph_calendar import apply_philippines_title, get_philippines_day
from services.usccb_readings import _extract_responsorial_refrain, get_readings_cache_entry


def _truncate(text: str, max_len: int = 52) -> str:
    t = " ".join((text or "").split())
    if len(t) <= max_len:
        return t
    return t[: max_len - 1].rstrip() + "…"


def _liturgical_color_dict(iso: str) -> dict[str, Any]:
    lc = get_liturgical_color(iso)
    return {
        "color_name": lc.get("color_name"),
        "hex": lc.get("hex"),
        "season": lc.get("season"),
    }


def _summarize_from_payload(data: dict[str, Any], readings: Optional[dict[str, str]]) -> dict[str, Any]:
    gospel_ref = str(data.get("gospel_reference") or "").strip()
    first_ref = str(data.get("first_reading") or "").strip()
    second_ref = str(data.get("second_reading") or "").strip()
    psalm_ref = str(data.get("psalm") or "").strip()

    psalm_refrain = ""
    if readings:
        psalm_refrain = _extract_responsorial_refrain(readings.get("psalm_response") or "")
        if not psalm_refrain:
            psalm_refrain = _extract_responsorial_refrain(readings.get("psalm_text") or "")
    if not psalm_refrain:
        psalm_refrain = _extract_responsorial_refrain(str(data.get("psalm_response") or ""))
    if not psalm_refrain:
        raw_psalm = str(data.get("psalm_text") or "").split(" or ", 1)[0].strip()
        psalm_refrain = _extract_responsorial_refrain(raw_psalm)

    gospel_quote = _truncate(
        (data.get("gospel_slide_quote") or data.get("gospel_text") or ""),
        56,
    )

    return {
        "gospel_reference": gospel_ref,
        "gospel_quote_short": gospel_quote,
        "psalm_refrain": _truncate(psalm_refrain, 48),
        "first_reading_reference": first_ref,
        "second_reading_reference": second_ref,
        "psalm_reference": psalm_ref,
        "title": str(data.get("title") or "").strip(),
        "season": str(data.get("season") or "").strip(),
        "loaded": bool(gospel_ref),
    }


def _summarize_from_tagalog_cache(entry: dict[str, str]) -> dict[str, Any]:
    gospel_ref = str(entry.get("gospel_ref") or "").strip()
    psalm_refrain = _extract_responsorial_refrain(entry.get("psalm_response") or "")
    if not psalm_refrain:
        psalm_refrain = _extract_responsorial_refrain(entry.get("psalm_text") or "")
    gospel_quote = _truncate(entry.get("gospel") or "", 56)
    title = str(entry.get("mass_celebration") or "").strip()
    return {
        "gospel_reference": gospel_ref,
        "gospel_quote_short": gospel_quote,
        "psalm_refrain": _truncate(psalm_refrain, 48),
        "first_reading_reference": str(entry.get("first_reading_ref") or "").strip(),
        "second_reading_reference": str(entry.get("second_reading_ref") or "").strip(),
        "psalm_reference": str(entry.get("psalm_ref") or "").strip(),
        "title": title,
        "loaded": bool(gospel_ref or (entry.get("gospel") or "").strip()),
    }


def _apply_english_ph_title(out: dict[str, Any], iso: str) -> None:
    ph = get_philippines_day(iso)
    if not ph:
        return
    patched = apply_philippines_title({"title": out.get("title") or ""}, iso) or {}
    if patched.get("title"):
        out["title"] = patched["title"]
    out["ph_rank"] = ph.get("rank")
    out["calendar_region"] = "philippines"


def summarize_day(iso: str, *, language: str = "english") -> dict[str, Any]:
    """Build a calendar cell summary from local caches (no network)."""
    lang = normalize_mass_language(language)
    try:
        on_date = dt.date.fromisoformat(iso.strip())
    except ValueError:
        return {"date": iso, "loaded": False, "is_sunday": False, "language": lang}

    liturgical = _liturgical_color_dict(iso)

    out: dict[str, Any] = {
        "date": iso,
        "is_sunday": on_date.weekday() == 6,
        "language": lang,
        "liturgical_color": liturgical,
        "gospel_reference": "",
        "gospel_quote_short": "",
        "psalm_refrain": "",
        "first_reading_reference": "",
        "second_reading_reference": "",
        "psalm_reference": "",
        "title": "",
        "season": str(liturgical.get("season") or ""),
        "loaded": False,
        "has_cache": False,
    }

    if lang == "tagalog":
        tagalog = get_tagalog_cache_entry(iso)
        out["has_cache"] = bool(tagalog)
        if tagalog:
            out.update(_summarize_from_tagalog_cache(tagalog))
        # Keep Tagalog celebration names; do not overlay English PH Proper titles.
        return out

    readings = get_readings_cache_entry(iso)
    cached = get_cached(iso)
    out["has_cache"] = bool(readings or cached)

    if cached:
        out.update(_summarize_from_payload(cached, readings))
        if cached.get("season"):
            out["season"] = cached.get("season")

    _apply_english_ph_title(out, iso)
    return out


def fetch_calendar_month(
    year: int,
    month: int,
    *,
    language: str = "english",
) -> dict[str, Any]:
    """
    Summaries for every day in ``month`` (1–12).

    ``language=tagalog`` uses Awit at Papuri cache titles/snippets.
    ``language=english`` uses USCCB/lectionary cache + Philippines Proper titles.
    """
    if month < 1 or month > 12:
        raise ValueError("month must be 1–12")

    lang = normalize_mass_language(language)
    days_in_month = calendar.monthrange(year, month)[1]
    days: dict[str, dict[str, Any]] = {}
    sundays_missing: list[str] = []

    for d in range(1, days_in_month + 1):
        iso = f"{year:04d}-{month:02d}-{d:02d}"
        summary = summarize_day(iso, language=lang)
        days[iso] = summary
        if summary.get("is_sunday") and not summary.get("loaded"):
            sundays_missing.append(iso)

    for iso in sundays_missing:
        live = get_liturgical_data(iso, use_cache=True, language=lang)
        if not live:
            continue
        if lang == "tagalog":
            readings = get_tagalog_cache_entry(iso)
            # Map tagalog entry-shaped fields if summarize already did; live payload is lectionary-shaped.
            patch = _summarize_from_payload(live, None)
        else:
            readings = get_readings_cache_entry(iso)
            patch = _summarize_from_payload(live, readings)
        days[iso].update(patch)
        if live.get("season"):
            days[iso]["season"] = live.get("season")
        days[iso]["has_cache"] = True
        days[iso]["language"] = lang
        if lang == "english":
            _apply_english_ph_title(days[iso], iso)

    return {"year": year, "month": month, "language": lang, "days": days}
