"""
HTTP helpers for bible.usccb.org — browser-like headers, retries, in-process cache.

Many environments see HTTP 403 on minimal requests; these headers mimic a normal browser visit.
"""

from __future__ import annotations

import time
from threading import Lock
from typing import Optional, Tuple

import requests
from bs4 import BeautifulSoup

USCCB_BROWSER_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
    ),
    "Accept": (
        "text/html,application/xhtml+xml,application/xml;q=0.9,"
        "image/avif,image/webp,*/*;q=0.8"
    ),
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate",
    "DNT": "1",
    "Connection": "keep-alive",
    "Upgrade-Insecure-Requests": "1",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "cross-site",
    "Sec-Fetch-User": "?1",
    "Referer": "https://bible.usccb.org/readings/calendar",
    "Cache-Control": "max-age=0",
}

_MAX_TRIES = 4
_BACKOFF_SEC = 0.55

_CACHE_LOCK = Lock()
_ENTRY: dict[str, Tuple[Optional[BeautifulSoup], Optional[int]]] = {}

# Alias for legacy imports from usccb_scraper
_DEFAULT_HEADERS = USCCB_BROWSER_HEADERS


def clear_usccb_cache() -> None:
    with _CACHE_LOCK:
        _ENTRY.clear()


def get_usccb_soup(url: str) -> Tuple[Optional[BeautifulSoup], Optional[int]]:
    """
    Fetch and parse HTML; one network round-trip per distinct URL per process.

    Returns (soup_or_none, last_http_status_if_failed).
    Successful fetch: (BeautifulSoup(...), None).
    Failure: (None, status_or_None).
    """
    url = (url or "").strip()
    if not url:
        return None, None

    with _CACHE_LOCK:
        if url in _ENTRY:
            soup, stat = _ENTRY[url]
            return soup, None if soup is not None else stat

    soup: Optional[BeautifulSoup] = None
    last_status: Optional[int] = None

    for attempt in range(_MAX_TRIES):
        try:
            resp = requests.get(url, headers=USCCB_BROWSER_HEADERS, timeout=25)
            last_status = resp.status_code
            if resp.status_code == 200 and (resp.text or "").strip():
                soup = BeautifulSoup(resp.text, "html.parser")
                break
        except requests.RequestException:
            pass
        if attempt < _MAX_TRIES - 1:
            time.sleep(_BACKOFF_SEC * (2**attempt))

    with _CACHE_LOCK:
        stat_store = None if soup is not None else last_status
        _ENTRY[url] = (soup, stat_store)

    return soup, None if soup is not None else last_status
