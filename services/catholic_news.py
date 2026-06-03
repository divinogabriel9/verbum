"""Fetch headlines from Vatican News and Catholic News Agency (EWTN/CNA RSS)."""

from __future__ import annotations

import html
import re
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from typing import Any, Optional

import requests

_FEED_TIMEOUT = 10
_MAX_PER_FEED = 2
_MAX_TOTAL = 3

FEEDS: dict[str, dict[str, str]] = {
    "vatican": {
        "url": "https://www.vaticannews.va/en.rss.xml",
        "name": "Vatican News",
    },
    "cna": {
        "url": "https://www.ewtnnews.com/rss",
        "name": "Catholic News Agency",
    },
}

_TAG_RE = re.compile(r"<[^>]+>")
_WS_RE = re.compile(r"\s+")


def _strip_html(text: str) -> str:
    if not text:
        return ""
    unescaped = html.unescape(text)
    plain = _TAG_RE.sub(" ", unescaped)
    return _WS_RE.sub(" ", plain).strip()


def _parse_pub_date(raw: Optional[str]) -> Optional[datetime]:
    if not raw or not str(raw).strip():
        return None
    try:
        dt = parsedate_to_datetime(str(raw).strip())
        if dt.tzinfo is None:
            return dt.replace(tzinfo=timezone.utc)
        return dt
    except (TypeError, ValueError, OverflowError):
        return None


def _item_text(parent: ET.Element, tag: str) -> str:
    el = parent.find(tag)
    if el is None or el.text is None:
        return ""
    return (el.text or "").strip()


def _parse_rss_channel(xml_bytes: bytes, source_name: str, limit: int) -> list[dict[str, Any]]:
    root = ET.fromstring(xml_bytes)
    channel = root.find("channel")
    if channel is None:
        return []
    items: list[dict[str, Any]] = []
    for item in channel.findall("item"):
        if len(items) >= limit:
            break
        title = _strip_html(_item_text(item, "title"))
        link = _item_text(item, "link")
        if not title:
            continue
        desc = _strip_html(_item_text(item, "description"))
        summary = desc[:220] + ("…" if len(desc) > 220 else "") if desc else ""
        pub_raw = _item_text(item, "pubDate")
        pub_dt = _parse_pub_date(pub_raw)
        items.append(
            {
                "title": title,
                "link": link or None,
                "summary": summary,
                "source": source_name,
                "pub_date": pub_dt.isoformat() if pub_dt else pub_raw or None,
                "_sort": pub_dt or datetime.min.replace(tzinfo=timezone.utc),
            }
        )
    return items


def _fetch_feed(url: str) -> bytes:
    resp = requests.get(
        url,
        timeout=_FEED_TIMEOUT,
        headers={"User-Agent": "Verbum-ChurchMedia/1.0 (+local parish app)"},
    )
    resp.raise_for_status()
    return resp.content


def fetch_catholic_headlines(
    *,
    include_vatican: bool = True,
    include_cna: bool = True,
    max_items: int = _MAX_TOTAL,
) -> dict[str, Any]:
    """Return merged headlines (newest first), up to ``max_items``."""
    enabled: list[tuple[str, dict[str, str]]] = []
    if include_vatican and "vatican" in FEEDS:
        enabled.append(("vatican", FEEDS["vatican"]))
    if include_cna and "cna" in FEEDS:
        enabled.append(("cna", FEEDS["cna"]))

    merged: list[dict[str, Any]] = []
    errors: list[str] = []

    for _key, meta in enabled:
        try:
            xml_bytes = _fetch_feed(meta["url"])
            rows = _parse_rss_channel(xml_bytes, meta["name"], _MAX_PER_FEED)
            merged.extend(rows)
        except Exception as exc:
            errors.append(f"{meta['name']}: {exc}")

    merged.sort(key=lambda row: row.get("_sort") or datetime.min.replace(tzinfo=timezone.utc), reverse=True)
    cap = max(1, min(int(max_items), 6))
    out: list[dict[str, Any]] = []
    for row in merged[:cap]:
        item = {k: v for k, v in row.items() if k != "_sort"}
        out.append(item)

    return {
        "ok": bool(out) or not errors,
        "items": out,
        "errors": errors,
    }
