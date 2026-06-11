"""Fetch EWTN live radio stream metadata from ewtn.com/live/radio."""

from __future__ import annotations

import json
import re
import time
from typing import Any

import requests

_TIMEOUT = 12
_BASE = "https://www.ewtn.com/live/radio"
_CACHE_TTL_SEC = 3600
_DEFAULT_ART = "https://www.ewtn.com/img/od/live-generic-radio.jpg"

_STATIONS: list[tuple[str, str, str]] = [
    ("us", "radio-english", "United States"),
    ("extra", "radio-extra", "Radio Extra"),
    ("gbie", "radio-gbie", "Great Britain - Ireland"),
    ("philippines", "radio-philippines", "Philippines"),
    ("catolica", "radio-catolica-mundial", "Radio Católica Mundial"),
]

_FALLBACK_STREAMS: dict[str, str] = {
    "us": "https://ewtn-ice.streamguys1.com/english-aac",
    "extra": "https://ewtn-ice.streamguys1.com/classics-aac",
    "gbie": "https://ewtn-ice.streamguys1.com/sky-aac",
    "philippines": "https://ewtn-ice.streamguys1.com/philippines-aac",
    "catolica": "https://ewtn-ice.streamguys1.com/spanish-aac",
}

# HLS feeds (browser-friendly; raw Icecast AAC fails in Chrome/Firefox).
_HLS_BASE = "https://ewtn-sgrewind.streamguys1.com/sgrewind"
_HLS_PATHS: dict[str, str] = {
    "us": "english",
    "extra": "classics",
    "gbie": "sky",
    "philippines": "philippines",
    "catolica": "spanish",
}


def _hls_url(station_id: str) -> str:
    path = _HLS_PATHS.get(station_id, "english")
    return f"{_HLS_BASE}/{path}/chunks.m3u8"

_cache: tuple[float, list[dict[str, Any]]] | None = None


def _extract_broadcast(html: str) -> dict[str, Any]:
    for match in re.finditer(
        r'<script[^>]*type=["\']application/ld\+json["\'][^>]*>(.*?)</script>',
        html,
        re.I | re.S,
    ):
        try:
            data = json.loads(match.group(1).strip())
        except json.JSONDecodeError:
            continue
        if isinstance(data, dict) and data.get("@type") == "BroadcastEvent":
            return data
    stream = re.search(r"(https://ewtn-ice\.streamguys1\.com/[a-z0-9-]+)", html)
    out: dict[str, Any] = {"image": _DEFAULT_ART}
    if stream:
        out["url"] = stream.group(1)
    return out


def _fetch_station(station_id: str, slug: str, name: str) -> dict[str, Any]:
    page_url = f"{_BASE}/{slug}"
    meta: dict[str, Any] = {}
    try:
        res = requests.get(
            page_url,
            timeout=_TIMEOUT,
            headers={"User-Agent": "VerbumChurchMedia/1.0"},
        )
        res.raise_for_status()
        meta = _extract_broadcast(res.text)
    except Exception:
        meta = {}

    stream_url = str(meta.get("url") or _FALLBACK_STREAMS.get(station_id, ""))
    if "ewtn.com/live/radio" in stream_url:
        stream_url = _FALLBACK_STREAMS.get(station_id, stream_url)

    return {
        "id": station_id,
        "slug": slug,
        "name": name,
        "stream_url": stream_url,
        "hls_url": _hls_url(station_id),
        "image_url": str(meta.get("image") or _DEFAULT_ART),
        "page_url": page_url,
    }


def fetch_ewtn_radio_stations(*, force_refresh: bool = False) -> list[dict[str, Any]]:
    global _cache
    now = time.time()
    if not force_refresh and _cache and now - _cache[0] < _CACHE_TTL_SEC:
        return _cache[1]

    stations = [_fetch_station(sid, slug, name) for sid, slug, name in _STATIONS]
    _cache = (now, stations)
    return stations


def ewtn_radio_catalog() -> dict[str, Any]:
    stations = fetch_ewtn_radio_stations()
    return {"ok": True, "stations": stations, "source": _BASE}
