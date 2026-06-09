"""Fetch headlines from Vatican News and Catholic News Agency (EWTN/CNA RSS)."""

from __future__ import annotations

import html
import re
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from typing import Any, Optional

import requests

_FEED_TIMEOUT = 10
_FEED_PARSE_LIMIT = 30
_MAX_TOTAL = 6
_DEFAULT_MAX_AGE_DAYS = 3

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
_IMG_SRC_RE = re.compile(r"""<img[^>]+src=["']([^"']+)["']""", re.I)
_IMAGE_URL_RE = re.compile(r"\.(jpe?g|png|gif|webp|avif)(\?|$)", re.I)

_MRSS_NS = "http://search.yahoo.com/mrss/"
_CONTENT_NS = "http://purl.org/rss/1.0/modules/content/"


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


def _is_image_url(url: str) -> bool:
    if not url:
        return False
    return bool(_IMAGE_URL_RE.search(url.split("?", 1)[0]))


def _extract_image_url(item: ET.Element) -> Optional[str]:
    for tag in (f"{{{_MRSS_NS}}}content", f"{{{_MRSS_NS}}}thumbnail"):
        for el in item.findall(tag):
            url = (el.get("url") or "").strip()
            medium = (el.get("medium") or "").lower()
            typ = (el.get("type") or "").lower()
            if url and (medium == "image" or typ.startswith("image/") or _is_image_url(url)):
                return url

    enc = item.find("enclosure")
    if enc is not None:
        url = (enc.get("url") or "").strip()
        typ = (enc.get("type") or "").lower()
        if url and (typ.startswith("image/") or _is_image_url(url)):
            return url

    for tag in (f"{{{_CONTENT_NS}}}encoded", "description"):
        el = item.find(tag)
        raw = (el.text or "").strip() if el is not None and el.text else ""
        if raw:
            match = _IMG_SRC_RE.search(raw)
            if match:
                return html.unescape(match.group(1)).strip()

    return None


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
        summary_short = desc[:220] + ("…" if len(desc) > 220 else "") if desc else ""
        summary_full = desc[:1200] + ("…" if len(desc) > 1200 else "") if desc else ""
        pub_raw = _item_text(item, "pubDate")
        pub_dt = _parse_pub_date(pub_raw)
        image_url = _extract_image_url(item)
        items.append(
            {
                "title": title,
                "link": link or None,
                "summary": summary_short,
                "summary_full": summary_full,
                "source": source_name,
                "pub_date": pub_dt.isoformat() if pub_dt else pub_raw or None,
                "image_url": image_url,
                "_sort": pub_dt or datetime.min.replace(tzinfo=timezone.utc),
            }
        )
    return items


def _fetch_feed(url: str) -> bytes:
    resp = requests.get(
        url,
        timeout=_FEED_TIMEOUT,
        headers={"User-Agent": "LiturgyFlow/1.0 (+local parish app)"},
    )
    resp.raise_for_status()
    return resp.content


def _coerce_utc(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def _filter_by_max_age(items: list[dict[str, Any]], max_age_days: int) -> list[dict[str, Any]]:
    if max_age_days <= 0:
        return items
    cutoff = datetime.now(timezone.utc) - timedelta(days=max_age_days)
    min_dt = datetime.min.replace(tzinfo=timezone.utc)
    filtered: list[dict[str, Any]] = []
    for row in items:
        sort_dt = row.get("_sort") or min_dt
        if sort_dt == min_dt:
            continue
        if _coerce_utc(sort_dt) >= cutoff:
            filtered.append(row)
    return filtered


def fetch_catholic_headlines(
    *,
    include_vatican: bool = True,
    include_cna: bool = True,
    max_items: int = _MAX_TOTAL,
    offset: int = 0,
    max_age_days: int = _DEFAULT_MAX_AGE_DAYS,
) -> dict[str, Any]:
    """Return merged headlines (newest first), paginated by offset/limit."""
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
            rows = _parse_rss_channel(xml_bytes, meta["name"], _FEED_PARSE_LIMIT)
            merged.extend(rows)
        except Exception as exc:
            errors.append(f"{meta['name']}: {exc}")

    merged.sort(key=lambda row: row.get("_sort") or datetime.min.replace(tzinfo=timezone.utc), reverse=True)
    age_cap = max(0, int(max_age_days))
    if age_cap:
        merged = _filter_by_max_age(merged, age_cap)
    off = max(0, int(offset))
    cap = max(1, min(int(max_items), 15))
    page = merged[off : off + cap]
    out: list[dict[str, Any]] = []
    for row in page:
        item = {k: v for k, v in row.items() if k != "_sort"}
        out.append(item)

    cutoff_iso: Optional[str] = None
    if age_cap:
        cutoff_iso = (datetime.now(timezone.utc) - timedelta(days=age_cap)).isoformat()

    return {
        "ok": bool(out) or not errors,
        "items": out,
        "offset": off,
        "limit": cap,
        "has_more": off + cap < len(merged),
        "total": len(merged),
        "max_age_days": age_cap,
        "cutoff_date": cutoff_iso,
        "errors": errors,
    }
