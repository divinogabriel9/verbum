"""Find a Gospel-matched background image via the Openverse API (no API key).

Used by the home "Today's Gospel" card to show a photo background that loosely
matches the day's Gospel. Openverse returns Creative Commons images, so the
caller is responsible for showing attribution (creator + license).
"""

from __future__ import annotations

import re
import time
from io import BytesIO
from typing import Any, Optional

import requests

from services.gospel_visual_prompt import build_visual_scene_line
from services.readings_snapshot import readings_snapshot

_OPENVERSE_URL = "https://api.openverse.org/v1/images/"
_TIMEOUT = 8
_USER_AGENT = "LiturgyFlow/1.0 (+local parish app)"

_MEMORY: dict[str, tuple[float, dict[str, Any]]] = {}
_MEMORY_TTL_S = 12 * 60 * 60.0

_STOPWORDS = frozenset(
    {
        "the", "a", "an", "and", "or", "of", "in", "for", "to", "with", "that",
        "when", "where", "on", "by", "as", "at", "his", "her", "them", "they",
        "you", "your", "this", "from", "into", "who", "whom", "had", "has",
        "was", "were", "are", "is", "be", "their", "but", "not", "all", "him",
        "she", "he", "it", "its",
    }
)

# Bias every query toward sacred imagery so results read as religious art.
_QUERY_BIAS = "sacred art"


def build_gospel_image_query(
    title: str, gospel_reference: str, gospel_text: str
) -> str:
    """Condense the Gospel into a short keyword query for image search."""
    scene = build_visual_scene_line(title or "", gospel_reference or "", gospel_text or "")
    words = re.findall(r"[A-Za-z]+", scene.lower())
    keywords: list[str] = []
    for word in words:
        if len(word) < 3 or word in _STOPWORDS:
            continue
        if word not in keywords:
            keywords.append(word)
        if len(keywords) >= 6:
            break
    if not keywords:
        clean_title = (title or "").replace(" Celebration", "").strip()
        keywords = re.findall(r"[A-Za-z]+", clean_title.lower())[:4] or ["jesus", "gospel"]
    return " ".join(keywords + [_QUERY_BIAS]).strip()


def _detect_text_mode(image_url: str, thumbnail: str) -> str:
    """Sample the image brightness to choose readable text: 'dark' (bright bg) or 'light' (dark bg)."""
    url = (thumbnail or image_url or "").strip()
    if not url:
        return "light"
    try:
        from PIL import Image

        resp = requests.get(
            url,
            timeout=_TIMEOUT,
            headers={"User-Agent": _USER_AGENT},
        )
        resp.raise_for_status()
        im = Image.open(BytesIO(resp.content)).convert("L").resize((32, 32))
        pixels = list(im.getdata())
        if not pixels:
            return "light"
        avg = sum(pixels) / len(pixels)
        return "dark" if avg >= 140 else "light"
    except Exception:
        return "light"


def _format_license(code: Optional[str]) -> str:
    c = (code or "").strip().lower()
    if not c:
        return ""
    if c in ("pdm", "cc0"):
        return c.upper()
    return "CC " + c.upper()


def _pick_result(
    items: list[dict[str, Any]], date: str = ""
) -> Optional[dict[str, Any]]:
    """Pick a usable image, rotating the choice by ``date`` for daily variety.

    Selection is deterministic per date (so the same day always resolves to the
    same image) but differs across days, so consecutive days get a fresh image
    even when the Gospel keywords overlap.
    """
    valid = [item for item in items if (item.get("url") or "").strip()]
    if not valid:
        return None
    seed = sum(ord(c) for c in (date or "")) if date else 0
    return valid[seed % len(valid)]


def _request_openverse(params: dict[str, Any]) -> list[dict[str, Any]]:
    resp = requests.get(
        _OPENVERSE_URL,
        params=params,
        timeout=_TIMEOUT,
        headers={"User-Agent": _USER_AGENT, "Accept": "application/json"},
    )
    resp.raise_for_status()
    data = resp.json()
    results = data.get("results") if isinstance(data, dict) else None
    return results if isinstance(results, list) else []


def _fetch_openverse(
    query: str, fallback_query: str, date: str = ""
) -> Optional[dict[str, Any]]:
    """Try the verse query (wide, then any), then a broad fallback query.

    A larger ``page_size`` widens the candidate pool so the per-date rotation in
    ``_pick_result`` has room to surface a different image each day.
    """
    attempts = [
        {"q": query, "aspect_ratio": "wide", "page_size": 30, "mature": "false"},
        {"q": query, "page_size": 30, "mature": "false"},
    ]
    if fallback_query and fallback_query != query:
        attempts.append({"q": fallback_query, "aspect_ratio": "wide", "page_size": 30, "mature": "false"})
        attempts.append({"q": fallback_query, "page_size": 30, "mature": "false"})

    for params in attempts:
        picked = _pick_result(_request_openverse(params), date)
        if picked:
            return picked
    return None


def fetch_gospel_background(date: str) -> dict[str, Any]:
    """Return a background image payload for the Gospel on ``date`` (YYYY-MM-DD)."""
    d = (date or "").strip()
    if not d:
        return {"ok": False, "error": "Date required (YYYY-MM-DD)."}

    now = time.monotonic()
    cached = _MEMORY.get(d)
    if cached and now - cached[0] < _MEMORY_TTL_S:
        return cached[1]

    readings, _ = readings_snapshot(d)
    if not readings.get("ok"):
        return {"ok": False, "error": readings.get("error") or "Readings unavailable."}

    query = build_gospel_image_query(
        readings.get("title") or "",
        readings.get("gospel_reference") or "",
        readings.get("gospel_text") or "",
    )

    try:
        item = _fetch_openverse(query, f"Jesus Christ {_QUERY_BIAS}", d)
    except Exception as exc:  # network / parse failures degrade gracefully
        return {"ok": False, "error": f"Image search failed: {exc}", "query": query}

    if not item:
        payload: dict[str, Any] = {"ok": False, "error": "No matching image found.", "query": query}
        _MEMORY[d] = (now, payload)
        return payload

    image_url = (item.get("url") or "").strip()
    thumbnail = (item.get("thumbnail") or "").strip()
    payload = {
        "ok": True,
        "image_url": image_url,
        "thumbnail": thumbnail,
        "source_url": (item.get("foreign_landing_url") or "").strip(),
        "creator": (item.get("creator") or "").strip(),
        "license": _format_license(item.get("license")),
        "license_url": (item.get("license_url") or "").strip(),
        "text_mode": _detect_text_mode(image_url, thumbnail),
        "query": query,
    }
    _MEMORY[d] = (now, payload)
    return payload
