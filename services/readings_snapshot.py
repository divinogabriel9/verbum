"""Fast readings payloads for dashboard cards (no song discovery)."""

from __future__ import annotations

import time
from typing import Any, Optional

from services.gospel_quote_extractor import first_sentence_slide_quote, split_slide_sentences
from services.liturgical_calendar import get_liturgical_color
from services.lectionary_service import get_liturgical_data, payload_complete
from services.lectionary_store import get_cached
from services.mass_text_format import synopsis_from_reading
from services.usccb_readings import collect_psalm_refrain_options

_MEMORY: dict[str, tuple[float, dict[str, Any]]] = {}
_MEMORY_TTL_S = 600.0
_MEMORY_INCOMPLETE_TTL_S = 15.0


def invalidate_readings_memory(date: str) -> None:
    _MEMORY.pop((date or "").strip(), None)


def _liturgical_json(lc: Optional[dict[str, Any]]) -> Optional[dict[str, Any]]:
    if not lc:
        return None
    return {
        "color_name": lc.get("color_name"),
        "hex": lc.get("hex"),
        "season": lc.get("season"),
        "rgb": list(lc.get("rgb", ())),
    }


def _build_payload(d: str, data: dict[str, Any]) -> dict[str, Any]:
    liturgical_color = get_liturgical_color(d)
    gospel_text = (data.get("gospel_text") or "").strip()
    gospel_slide_quote = (data.get("gospel_slide_quote") or "").strip()
    base_quote = gospel_slide_quote or gospel_text or ""
    sentences = split_slide_sentences(base_quote)
    fr_txt = data.get("first_reading_text") or ""
    sr_txt = data.get("second_reading_text") or ""
    raw_psalm = (data.get("psalm_text") or "").split(" or ", 1)[0].strip()
    psalm_verses = (data.get("psalm_verses") or "").strip()
    psalm_ref = str(data.get("psalm") or "").strip()
    psalm_resp = (data.get("psalm_response") or "").strip()

    return {
        "ok": True,
        "date": d,
        "title": data.get("title") or "Sunday Mass Celebration",
        "gospel_reference": data.get("gospel_reference") or "N/A",
        "season": data.get("season") or "",
        "lectionary_cycle": data.get("lectionary_cycle") or "",
        "liturgical_color": _liturgical_json(liturgical_color),
        "gospel_text_length": len(gospel_text),
        "sentences": sentences,
        "sentence_count": len(sentences),
        "quote_attribution": data.get("quote_attribution"),
        "gospel_quote": (first_sentence_slide_quote(base_quote) or "").strip(),
        "gospel_synopsis": synopsis_from_reading(gospel_text, max_chars=320) if gospel_text else "",
        "first_reading_reference": str(data.get("first_reading") or "").strip(),
        "first_reading_excerpt": synopsis_from_reading(fr_txt, max_chars=720) if fr_txt else "",
        "second_reading_reference": str(data.get("second_reading") or "").strip(),
        "second_reading_excerpt": synopsis_from_reading(sr_txt, max_chars=720) if sr_txt else "",
        "psalm_text": raw_psalm,
        "psalm_verses": psalm_verses,
        "psalm_reference": psalm_ref,
        "psalm": psalm_ref,
        "psalm_refrains": collect_psalm_refrain_options(
            raw_psalm,
            psalm_ref,
            psalm_response=psalm_resp,
        ),
        "gospel_text": gospel_text,
        "readings_complete": payload_complete(data),
    }


def readings_snapshot(date: str, *, force_refresh: bool = False) -> tuple[dict[str, Any], bool]:
    """
    Return (payload, served_from_persistent_cache).

    ``served_from_persistent_cache`` is True when SQLite already had the date
    before any network fetch (safe for longer HTTP cache headers).
    """
    d = (date or "").strip()
    if not d:
        return {"ok": False, "error": "Date required (YYYY-MM-DD)."}, False

    now = time.monotonic()
    if force_refresh:
        invalidate_readings_memory(d)
    else:
        mem = _MEMORY.get(d)
        if mem:
            age = now - mem[0]
            complete = bool(mem[1].get("readings_complete"))
            ttl = _MEMORY_TTL_S if complete else _MEMORY_INCOMPLETE_TTL_S
            if age < ttl:
                return mem[1], True

    had_persistent = get_cached(d) is not None
    data = get_liturgical_data(d, force_refresh=force_refresh)
    if not data:
        payload = {
            "ok": False,
            "error": "Unable to fetch liturgical data. Use a valid date (YYYY-MM-DD).",
            "readings_complete": False,
        }
        return payload, had_persistent

    payload = _build_payload(d, data)
    _MEMORY[d] = (now, payload)
    return payload, had_persistent or get_cached(d) is not None


def warm_readings_for_date(date: str) -> None:
    """Pre-load readings into memory/SQLite (startup or cron)."""
    try:
        readings_snapshot(date)
    except Exception:
        pass
