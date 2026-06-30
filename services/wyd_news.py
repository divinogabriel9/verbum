"""Scrape official World Youth Day Seoul 2027 announcements.

The WYD site (https://wydseoul.org/en/news/notice) server-renders its
announcement board, so we can read the headlines directly instead of relying
on third-party RSS keyword matches (which almost never mention WYD).

Results are cached in-process for a short TTL so repeated home-page loads don't
re-hit the site, and the parser degrades gracefully (returns an empty list) if
the markup changes or the network is unavailable.
"""

from __future__ import annotations

import logging
import re
import threading
import time
from typing import Any, Optional
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)

NOTICE_URL = "https://wydseoul.org/en/news/notice"
SITE_ROOT = "https://wydseoul.org"
SOURCE_NAME = "WYD Seoul 2027"

_TIMEOUT = 10
_CACHE_TTL_SECONDS = 30 * 60  # announcements change rarely; 30 min is plenty.
_DATE_RE = re.compile(r"\b(\d{4}-\d{2}-\d{2})\b")

_cache_lock = threading.Lock()
_cache: dict[str, Any] = {"at": 0.0, "items": []}


def _clean(text: Optional[str]) -> str:
    return re.sub(r"\s+", " ", (text or "")).strip()


def _parse_announcements(html: str, limit: int) -> list[dict[str, Any]]:
    soup = BeautifulSoup(html, "html.parser")
    items: list[dict[str, Any]] = []
    seen_links: set[str] = set()

    for li in soup.select("li.board-item"):
        anchor = li.select_one("a.board-item__link") or li.find("a")
        title_el = li.select_one(".board-item__title-text") or li.select_one(
            ".board-item__title"
        )
        title = _clean(title_el.get_text() if title_el else "")
        if not title:
            continue

        href = (anchor.get("href") if anchor else "") or ""
        link = urljoin(SITE_ROOT, href.strip()) if href.strip() else NOTICE_URL
        if link in seen_links:
            continue
        seen_links.add(link)

        date_el = li.select_one(".board-item__date")
        date_text = _clean(date_el.get_text() if date_el else "")
        date_match = _DATE_RE.search(date_text) or _DATE_RE.search(_clean(li.get_text()))
        pub_date = date_match.group(1) if date_match else (date_text or None)

        items.append(
            {
                "title": title,
                "link": link,
                "url": link,
                "source": SOURCE_NAME,
                "summary": "",
                "summary_full": "",
                "pub_date": pub_date,
                "image_url": None,
            }
        )
        if len(items) >= max(1, limit):
            break

    return items


def fetch_wyd_announcements(
    *, limit: int = 6, use_cache: bool = True
) -> list[dict[str, Any]]:
    """Return WYD Seoul 2027 announcements (newest/pinned first).

    Falls back to an empty list on any network/parse failure so callers can use
    their own fallback source.
    """
    cap = max(1, min(int(limit), 15))

    if use_cache:
        with _cache_lock:
            fresh = (time.time() - _cache["at"]) < _CACHE_TTL_SECONDS
            cached = list(_cache["items"])
        if fresh and cached:
            return cached[:cap]

    try:
        resp = requests.get(
            NOTICE_URL,
            timeout=_TIMEOUT,
            headers={"User-Agent": "LiturgyFlow/1.0 (+local parish app)"},
        )
        resp.raise_for_status()
        items = _parse_announcements(resp.text, limit=15)
    except Exception as exc:  # network error, non-200, or markup change
        logger.warning("WYD announcement fetch failed: %s", exc)
        with _cache_lock:
            stale = list(_cache["items"])
        return stale[:cap]  # serve last-known-good if we have it, else empty

    if items:
        with _cache_lock:
            _cache["at"] = time.time()
            _cache["items"] = items

    return items[:cap]
