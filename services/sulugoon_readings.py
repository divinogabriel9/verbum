"""
Cebuano (Bisaya) daily Mass readings from Sulugoon (sulugoon.com).

Scrapes the day's page (Unang Pagbasa / Salmo Responsoryo / Ikaduhang Pagbasa /
Ebanghelyo) into keys compatible with the English USCCB / Tagalog Awit caches.

Content is copyrighted by Sulugoon / 3DB7 — intended for parish liturgical
projection, not site republication.
"""

from __future__ import annotations

import json
import logging
import re
from datetime import datetime, timezone
from pathlib import Path
from threading import Lock
from typing import Any, Optional
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)

_PROJECT_ROOT = Path(__file__).resolve().parents[1]
_CACHE_PATH = _PROJECT_ROOT / "data" / "readings_cache_cebuano.json"
_CACHE_LOCK = Lock()
_file_cache_blob: Optional[dict[str, Any]] = None
_file_cache_mtime: float = 0.0

_BASE = "https://sulugoon.com"
_BROWSER_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "ceb,en-US,en;q=0.9,fil;q=0.8",
    "Referer": f"{_BASE}/",
}

CACHE_KEYS = (
    "first_reading",
    "psalm_text",
    "psalm_response",
    "psalm_verses",
    "second_reading",
    "gospel",
    "gospel_acclamation",
    "mass_celebration",
    "first_reading_ref",
    "psalm_ref",
    "second_reading_ref",
    "gospel_ref",
    "source_url",
)

# Prefer Day Mass when a date offers multiple schedules (Vigil / Dawn / Night).
_SCHEDULE_PREFERENCE = (
    "day",
    "dawn",
    "novena",
    "simbang",
    "night",
    "vigil",
)

_SECTION_TYPE_MAP = {
    "1st-reading": "first",
    "first-reading": "first",
    "first": "first",
    "2nd-reading": "second",
    "second-reading": "second",
    "second": "second",
    "psalm": "psalm",
    "gospel": "gospel",
    "acclamation": "alleluia",
    "gospel-acclamation": "alleluia",
    "alleluia": "alleluia",
    "aleluya": "alleluia",
}


def _normalize_date(date: str) -> str:
    return (date or "").strip()[:10]


def _empty_entry() -> dict[str, str]:
    return {k: "" for k in CACHE_KEYS}


def _load_cache_file() -> dict[str, Any]:
    global _file_cache_blob, _file_cache_mtime
    path = _CACHE_PATH
    if not path.is_file():
        return {}
    try:
        mtime = path.stat().st_mtime
        if _file_cache_blob is not None and mtime == _file_cache_mtime:
            return _file_cache_blob
        blob = json.loads(path.read_text(encoding="utf-8"))
        if not isinstance(blob, dict):
            blob = {}
        _file_cache_blob = blob
        _file_cache_mtime = mtime
        return blob
    except Exception:
        logger.exception("Failed reading Cebuano readings cache")
        return {}


def _save_cache_file(blob: dict[str, Any]) -> None:
    global _file_cache_blob, _file_cache_mtime
    path = _CACHE_PATH
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(blob, ensure_ascii=False, indent=2), encoding="utf-8")
    _file_cache_blob = blob
    _file_cache_mtime = path.stat().st_mtime


def _row_to_entry(row: dict[str, Any]) -> dict[str, str]:
    out = _empty_entry()
    for key in CACHE_KEYS:
        out[key] = str(row.get(key) or "")
    return out


def get_cebuano_cache_entry(date: str) -> Optional[dict[str, str]]:
    mass_date = _normalize_date(date)
    if not mass_date:
        return None
    with _CACHE_LOCK:
        blob = _load_cache_file()
        row = blob.get(mass_date)
        if not isinstance(row, dict):
            return None
        return _row_to_entry(row)


def get_cebuano_cache_month(year: int, month: int) -> dict[str, dict[str, str]]:
    """All cached Cebuano rows for one calendar month (single file read)."""
    prefix = f"{year:04d}-{month:02d}-"
    with _CACHE_LOCK:
        blob = _load_cache_file()
    out: dict[str, dict[str, str]] = {}
    for key, row in blob.items():
        if isinstance(key, str) and key.startswith(prefix) and isinstance(row, dict):
            out[key] = _row_to_entry(row)
    return out


def set_cebuano_cache_entry(date: str, entry: dict[str, str]) -> None:
    mass_date = _normalize_date(date)
    if not mass_date:
        return
    with _CACHE_LOCK:
        blob = _load_cache_file()
        row = {k: str(entry.get(k) or "") for k in CACHE_KEYS}
        row["cached_at"] = datetime.now(timezone.utc).isoformat()
        blob[mass_date] = row
        _save_cache_file(blob)


def _entry_usable(entry: dict[str, str]) -> bool:
    gospel = (entry.get("gospel") or "").strip()
    first = (entry.get("first_reading") or "").strip()
    return len(gospel) >= 40 and (
        len(first) >= 20 or bool((entry.get("first_reading_ref") or "").strip())
    )


def _http_get(url: str) -> Optional[str]:
    try:
        resp = requests.get(url, headers=_BROWSER_HEADERS, timeout=28)
        if resp.status_code != 200 or not resp.text:
            logger.warning("Sulugoon HTTP %s for %s", resp.status_code, url)
            return None
        lower = resp.text.lower()
        if "cf-challenge" in lower or "checking your browser" in lower:
            logger.warning("Sulugoon bot-check for %s", url)
            return None
        return resp.text
    except Exception:
        logger.exception("Sulugoon fetch failed for %s", url)
        return None


def _norm_text(text: str) -> str:
    return re.sub(r"\s+", " ", (text or "").replace("\xa0", " ")).strip()


def _day_base_url(mass_date: str) -> Optional[str]:
    try:
        y, m, d = mass_date.split("-")
    except ValueError:
        return None
    return f"{_BASE}/readings/{y}/{m}/{d}/"


def _schedule_links(soup: BeautifulSoup, mass_date: str) -> list[str]:
    """Collect schedule variant URLs for a multi-Mass day (Day / Vigil / Dawn)."""
    try:
        y, m, d = mass_date.split("-")
    except ValueError:
        return []
    prefix = f"/readings/{y}/{m}/{d}/"
    out: list[str] = []
    seen: set[str] = set()
    for a in soup.select("a[href]"):
        href = (a.get("href") or "").strip()
        if not href:
            continue
        abs_url = urljoin(_BASE + "/", href)
        parsed = urlparse(abs_url)
        if "sulugoon.com" not in (parsed.netloc or "").lower():
            continue
        path = (parsed.path or "").rstrip("/") + "/"
        if not path.startswith(prefix):
            continue
        rest = path[len(prefix) :].strip("/")
        if not rest or "/" in rest:
            continue
        if abs_url not in seen:
            seen.add(abs_url)
            out.append(abs_url if abs_url.endswith("/") else abs_url + "/")
    return out


def _pick_schedule_url(candidates: list[str]) -> Optional[str]:
    if not candidates:
        return None

    def score(url: str) -> tuple[int, str]:
        slug = urlparse(url).path.rstrip("/").split("/")[-1].lower()
        for i, key in enumerate(_SCHEDULE_PREFERENCE):
            if key in slug:
                return (i, slug)
        return (len(_SCHEDULE_PREFERENCE), slug)

    return sorted(candidates, key=score)[0]


def resolve_sulugoon_url(date: str) -> Optional[str]:
    """
    Resolve the best Sulugoon page for ``YYYY-MM-DD``.

    Prefer the day index when it already has readings; otherwise follow the
    Day / Dawn / Vigil schedule links.
    """
    mass_date = _normalize_date(date)
    base = _day_base_url(mass_date)
    if not base:
        return None
    html = _http_get(base)
    if not html:
        return None
    soup = BeautifulSoup(html, "html.parser")
    if soup.select(".reading-section[data-section-type]"):
        return base
    schedule = _pick_schedule_url(_schedule_links(soup, mass_date))
    return schedule or base


def _join_paragraphs(parts: list[str]) -> str:
    return "\n\n".join(p for p in parts if p).strip()


def _extract_section(section) -> tuple[str, str, list[str], list[str]]:
    """Return (kind, citation, responses, body_paragraphs) for one reading block."""
    raw_type = (section.get("data-section-type") or "").strip().lower()
    kind = _SECTION_TYPE_MAP.get(raw_type, "")
    cite_el = section.select_one(".reading-citation")
    citation = _norm_text(cite_el.get_text(" ", strip=True) if cite_el else "")
    responses = [
        _norm_text(el.get_text(" ", strip=True))
        for el in section.select(".psalm-response")
        if _norm_text(el.get_text(" ", strip=True))
    ]
    bodies = [
        _norm_text(el.get_text(" ", strip=True))
        for el in section.select(".reading-text-paragraph")
        if _norm_text(el.get_text(" ", strip=True))
    ]
    return kind, citation, responses, bodies


def _pick_psalm_response(responses: list[str]) -> str:
    """Prefer the real refrain over a lone ``Aleluya.`` alternate."""
    for r in responses:
        low = r.lower().rstrip(".")
        if low and low not in {"aleluya", "alleluia", "or"}:
            return r
    return responses[0] if responses else ""


def parse_sulugoon_html(html: str, *, source_url: str = "") -> dict[str, str]:
    """Parse a Sulugoon day page into cache-shaped fields."""
    entry = _empty_entry()
    entry["source_url"] = source_url
    soup = BeautifulSoup(html or "", "html.parser")

    h1 = soup.select_one("h1")
    if h1:
        entry["mass_celebration"] = _norm_text(h1.get_text(" ", strip=True))

    bodies: dict[str, list[str]] = {
        "first": [],
        "second": [],
        "psalm": [],
        "alleluia": [],
        "gospel": [],
    }
    refs: dict[str, str] = {
        "first": "",
        "second": "",
        "psalm": "",
        "gospel": "",
        "alleluia": "",
    }
    psalm_responses: list[str] = []

    for section in soup.select(".reading-section[data-section-type]"):
        kind, citation, responses, paras = _extract_section(section)
        if not kind:
            continue
        if citation and not refs.get(kind):
            refs[kind] = citation
        if kind == "psalm":
            psalm_responses.extend(responses)
            bodies["psalm"].extend(paras)
            # Keep refrain lines interleaved for psalm_verses preview.
            continue
        bodies[kind].extend(paras)
        if kind == "alleluia" and responses and not bodies["alleluia"]:
            bodies["alleluia"].extend(responses)

    entry["first_reading_ref"] = refs["first"]
    entry["first_reading"] = _join_paragraphs(bodies["first"])
    entry["second_reading_ref"] = refs["second"]
    entry["second_reading"] = _join_paragraphs(bodies["second"])
    entry["psalm_ref"] = refs["psalm"]
    response = _pick_psalm_response(psalm_responses)
    entry["psalm_response"] = response
    entry["psalm_text"] = response or (_join_paragraphs(bodies["psalm"][:1]) if bodies["psalm"] else "")
    verse_parts: list[str] = []
    if response:
        verse_parts.append(response)
    verse_parts.extend(bodies["psalm"])
    # Deduplicate adjacent identical refrain repeats for storage size, keep first.
    deduped: list[str] = []
    for part in verse_parts:
        if not deduped or deduped[-1] != part:
            deduped.append(part)
    entry["psalm_verses"] = _join_paragraphs(deduped) if deduped else entry["psalm_text"]
    entry["gospel_ref"] = refs["gospel"]
    entry["gospel"] = _join_paragraphs(bodies["gospel"])
    alleluia = _join_paragraphs(bodies["alleluia"]) or refs["alleluia"]
    entry["gospel_acclamation"] = alleluia
    return entry


def fetch_cebuano_readings_for_date(
    date: str,
    *,
    use_cache: bool = True,
    force_refresh: bool = False,
) -> dict[str, str]:
    """
    Return Cebuano reading bodies/refs for ``YYYY-MM-DD``.

    Cache lives in ``data/readings_cache_cebuano.json`` (separate from English /
    Tagalog).
    """
    mass_date = _normalize_date(date)
    empty = _empty_entry()
    if not mass_date:
        return empty

    if use_cache and not force_refresh:
        cached = get_cebuano_cache_entry(mass_date)
        if cached and _entry_usable(cached):
            return cached

    page_url = resolve_sulugoon_url(mass_date)
    if not page_url:
        logger.warning("No Sulugoon page URL for %s", mass_date)
        cached = get_cebuano_cache_entry(mass_date)
        return cached or empty

    html = _http_get(page_url)
    if not html:
        cached = get_cebuano_cache_entry(mass_date)
        return cached or empty

    # Day index sometimes is only a schedule picker — follow the preferred Mass.
    soup = BeautifulSoup(html, "html.parser")
    if not soup.select(".reading-section[data-section-type]"):
        schedule = _pick_schedule_url(_schedule_links(soup, mass_date))
        if schedule and schedule != page_url:
            page_url = schedule
            html = _http_get(page_url) or ""
            if not html:
                cached = get_cebuano_cache_entry(mass_date)
                return cached or empty

    entry = parse_sulugoon_html(html, source_url=page_url)
    if _entry_usable(entry):
        set_cebuano_cache_entry(mass_date, entry)
        return entry

    cached = get_cebuano_cache_entry(mass_date)
    if cached and _entry_usable(cached):
        return cached
    if any(str(entry.get(k) or "").strip() for k in CACHE_KEYS):
        set_cebuano_cache_entry(mass_date, entry)
    return entry
