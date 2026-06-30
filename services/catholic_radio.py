"""Combined Catholic live-radio catalog.

Merges the scraped EWTN stations with a curated list of additional Catholic
networks. Stations that expose a browser-playable HTTPS stream get a
``stream_url`` (and optionally ``hls_url``); the rest fall back to opening
their official "Listen Live" page (``page_url``) in the client.
"""

from __future__ import annotations

from typing import Any

from services.ewtn_radio import fetch_ewtn_radio_stations

_GENERIC_ART = "https://www.ewtn.com/img/od/live-generic-radio.jpg"
_DEFAULT_PALETTE: dict[str, list[int]] = {
    "a": [138, 173, 92],
    "b": [116, 148, 74],
    "c": [100, 128, 63],
}

# Curated additional stations. ``stream_url`` MUST be HTTPS to play in-browser
# (the app is served over HTTPS, so http:// streams are blocked as mixed
# content). Stations with an empty stream + hls open ``page_url`` instead.
_EXTRA_STATIONS: list[dict[str, str]] = [
    {
        "id": "guadalupe",
        "name": "Guadalupe Radio Network",
        "stream_url": "https://ssl-2.stream.miriamtech.net/grn/secal.mp3",
        "page_url": "https://www.grnonline.com/",
    },
    {
        "id": "relevant",
        "name": "Relevant Radio",
        "stream_url": "https://relevantradio-ice.streamguys.us/relevantradio.mp3",
        "page_url": "https://relevantradio.com/listen/",
    },
    {
        "id": "vaticannews",
        "name": "Vatican News Radio",
        "stream_url": "",
        "page_url": "https://www.vaticannews.va/en/epg.html",
    },
    {
        "id": "radiomaria",
        "name": "Radio Maria Global Network",
        "stream_url": "",
        "page_url": "https://www.radiomaria.us/listen-live/",
    },
    {
        "id": "avemaria",
        "name": "Ave Maria Radio",
        "stream_url": "",
        "page_url": "https://www.avemariaradio.net/listen-ave",
    },
    {
        "id": "shalomworld",
        "name": "Shalom World Radio",
        "stream_url": "",
        "page_url": "https://watch.shalomworld.org/",
    },
    {
        "id": "notredame",
        "name": "Radio Notre Dame",
        "stream_url": "",
        "page_url": "https://radionotredame.net/",
    },
    {
        "id": "catholicanswers",
        "name": "Catholic Answers Live Radio",
        "stream_url": "",
        "page_url": "https://www.catholic.com/radio",
    },
]


def _normalize_extra(entry: dict[str, str]) -> dict[str, Any]:
    return {
        "id": entry["id"],
        "slug": entry.get("slug", entry["id"]),
        "name": entry["name"],
        "stream_url": entry.get("stream_url", ""),
        "hls_url": entry.get("hls_url", ""),
        "image_url": entry.get("image_url") or _GENERIC_ART,
        "palette": dict(_DEFAULT_PALETTE),
        "page_url": entry.get("page_url", ""),
        "page_only": not (entry.get("stream_url") or entry.get("hls_url")),
    }


def radio_catalog() -> dict[str, Any]:
    """EWTN stations followed by the curated extra Catholic networks."""
    try:
        ewtn = fetch_ewtn_radio_stations()
    except Exception:
        ewtn = []
    extras = [_normalize_extra(e) for e in _EXTRA_STATIONS]
    return {"ok": True, "stations": list(ewtn) + extras, "source": "verbum-catholic-radio"}
