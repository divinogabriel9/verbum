"""
Tagalog daily Mass readings from Awit at Papuri (awitatpapuri.com).

Scrapes the day's post (Unang Pagbasa, Salmo, Ikalawang Pagbasa, Aleluya,
Mabuting Balita) into keys compatible with the English USCCB readings cache.

Content is copyrighted by Awit at Papuri Communications — intended for parish
liturgical projection, not site republication.
"""

from __future__ import annotations

import json
import logging
import re
from datetime import datetime, timezone
from pathlib import Path
from threading import Lock
from typing import Any, Optional
from urllib.parse import urlparse

import requests
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)

_PROJECT_ROOT = Path(__file__).resolve().parents[1]
_CACHE_PATH = _PROJECT_ROOT / "data" / "readings_cache_tagalog.json"
_CACHE_LOCK = Lock()
_file_cache_blob: Optional[dict[str, Any]] = None
_file_cache_mtime: float = 0.0

_BASE = "https://www.awitatpapuri.com"
_BROWSER_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9,fil;q=0.8,tl;q=0.7",
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

_SECTION_START = re.compile(
    r"^\s*("
    r"UNANG\s+PAGBASA|"
    r"IKALAWANG\s+PAGBASA|"
    r"SALMONG\s+TUGUNAN|"
    r"MABUTING\s+BALITA|"
    r"PANALANGIN\s+NG\s+BAYAN|"
    # Alleluia heading, but not the sung verse (“Aleluya! Aleluya! …”).
    r"ALELUYA(?!\s*[!.])"
    r")\b",
    re.I,
)
_REF_AFTER_HEADING = re.compile(
    r"^(?:UNANG\s+PAGBASA|IKALAWANG\s+PAGBASA|SALMONG\s+TUGUNAN|MABUTING\s+BALITA|ALELUYA)\s+(.+)$",
    re.I,
)
_CLOSING_LINES = frozenset(
    {
        "ang salita ng diyos.",
        "ang salita ng diyos",
        "ang mabuting balita ng panginoon.",
        "ang mabuting balita ng panginoon",
        "salamat sa diyos.",
        "salamat sa diyos",
    }
)
_SKIP_PARA = re.compile(
    r"(?i)^(podcast:|subscribe to|pages:|tuesday of|wednesday of|thursday of|"
    r"friday of|saturday of|sunday of|monday of|permanent link|basahin at pakinggan|"
    r"http://|https://)"
)
_INTRO_LINE = re.compile(
    r"(?i)^(pagbasa mula|ang mabuting balita ng panginoon ayon)"
)


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
        logger.exception("Failed reading Tagalog readings cache")
        return {}


def _save_cache_file(blob: dict[str, Any]) -> None:
    global _file_cache_blob, _file_cache_mtime
    path = _CACHE_PATH
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(blob, ensure_ascii=False, indent=2), encoding="utf-8")
    _file_cache_blob = blob
    _file_cache_mtime = path.stat().st_mtime


def get_tagalog_cache_entry(date: str) -> Optional[dict[str, str]]:
    mass_date = _normalize_date(date)
    if not mass_date:
        return None
    with _CACHE_LOCK:
        blob = _load_cache_file()
        row = blob.get(mass_date)
        if not isinstance(row, dict):
            return None
        out = _empty_entry()
        for key in CACHE_KEYS:
            out[key] = str(row.get(key) or "")
        return out


def set_tagalog_cache_entry(date: str, entry: dict[str, str]) -> None:
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
    return len(gospel) >= 40 and (len(first) >= 20 or bool((entry.get("first_reading_ref") or "").strip()))


def _http_get(url: str) -> Optional[str]:
    try:
        resp = requests.get(url, headers=_BROWSER_HEADERS, timeout=28)
        if resp.status_code != 200 or not resp.text:
            logger.warning("Awit at Papuri HTTP %s for %s", resp.status_code, url)
            return None
        lower = resp.text.lower()
        if "cf-challenge" in lower or "checking your browser" in lower:
            logger.warning("Awit at Papuri bot-check for %s", url)
            return None
        return resp.text
    except Exception:
        logger.exception("Awit at Papuri fetch failed for %s", url)
        return None


def resolve_awit_post_url(date: str) -> Optional[str]:
    """Find the day's permalink from ``/YYYY/MM/DD/`` archive."""
    mass_date = _normalize_date(date)
    try:
        y, m, d = mass_date.split("-")
    except ValueError:
        return None
    day_url = f"{_BASE}/{y}/{m}/{d}/"
    html = _http_get(day_url)
    if not html:
        return None
    soup = BeautifulSoup(html, "html.parser")
    prefix = f"/{y}/{m}/{d}/"
    candidates: list[str] = []
    for a in soup.select("a[href]"):
        href = (a.get("href") or "").strip()
        if not href:
            continue
        if href.startswith("/"):
            href = f"{_BASE}{href}"
        parsed = urlparse(href)
        if "awitatpapuri.com" not in (parsed.netloc or "").lower():
            continue
        path = parsed.path or ""
        if prefix not in path:
            continue
        # Require a slug after the day path (not the bare day index).
        rest = path.split(prefix, 1)[-1].strip("/")
        if not rest or "/" in rest:
            continue
        candidates.append(f"{_BASE}{path if path.startswith('/') else '/' + path}")
    # Prefer unique order: keep first occurrence of each URL.
    seen: set[str] = set()
    ordered: list[str] = []
    for u in candidates:
        if u not in seen:
            seen.add(u)
            ordered.append(u)
    if not ordered:
        return None
    # Prefer Tagalog weekday slugs when multiple posts share the day.
    prefer = ("linggo", "lunes", "martes", "miyerkules", "huwebes", "biyernes", "sabado")
    for u in ordered:
        slug = urlparse(u).path.rstrip("/").split("/")[-1].lower()
        if any(slug.startswith(p) for p in prefer):
            return u
    return ordered[0]


def _norm_text(text: str) -> str:
    t = re.sub(r"\s+", " ", (text or "").replace("\xa0", " ")).strip()
    return t


def _section_key(label: str) -> Optional[str]:
    u = re.sub(r"\s+", " ", (label or "").strip().upper())
    if u.startswith("UNANG PAGBASA"):
        return "first"
    if u.startswith("IKALAWANG PAGBASA"):
        return "second"
    if u.startswith("SALMONG TUGUNAN"):
        return "psalm"
    if u.startswith("ALELUYA"):
        return "alleluia"
    if u.startswith("MABUTING BALITA"):
        return "gospel"
    if u.startswith("PANALANGIN"):
        return "end"
    return None


def _extract_ref(heading_line: str) -> str:
    m = _REF_AFTER_HEADING.match(_norm_text(heading_line))
    if not m:
        return ""
    return _norm_text(m.group(1))


def _is_closing(text: str) -> bool:
    return _norm_text(text).lower() in _CLOSING_LINES


def _paragraphs_from_soup(soup: BeautifulSoup) -> list[str]:
    content = soup.select_one(".entry-content") or soup.select_one("article .entry-content")
    if content is None:
        content = soup.select_one("article") or soup
    out: list[str] = []
    for el in content.find_all(["p", "h1", "h2", "h3", "h4"]):
        # Prefer direct text; keep <br> as space via stripped_strings.
        t = _norm_text(" ".join(el.stripped_strings))
        if t:
            out.append(t)
    return out


def _guess_celebration(paras: list[str]) -> str:
    for p in paras[:12]:
        if _SECTION_START.match(p):
            break
        if _SKIP_PARA.match(p):
            continue
        if len(p) < 12 or len(p) > 160:
            continue
        # Tagalog liturgical titles often contain Linggo/Panahon/Paggunita/Kapistahan.
        low = p.lower()
        if any(
            k in low
            for k in (
                "linggo",
                "panahon",
                "paggunita",
                "kapistahan",
                "pista",
                "miyerkules",
                "martes",
                "lunes",
                "huwebes",
                "biyernes",
                "sabado",
            )
        ):
            return p
    return ""


def parse_awit_html(html: str, *, source_url: str = "") -> dict[str, str]:
    """Parse a day's Awit at Papuri post HTML into cache-shaped fields."""
    entry = _empty_entry()
    entry["source_url"] = source_url
    soup = BeautifulSoup(html, "html.parser")
    paras = _paragraphs_from_soup(soup)
    entry["mass_celebration"] = _guess_celebration(paras)

    current: Optional[str] = None
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

    for p in paras:
        if _SKIP_PARA.match(p):
            continue
        m = _SECTION_START.match(p)
        if m:
            key = _section_key(m.group(1))
            if key == "end":
                break
            if key:
                current = key
                ref = _extract_ref(p)
                if ref and key in refs and not refs[key]:
                    refs[key] = ref
                continue
        if current is None:
            continue
        if _is_closing(p):
            continue
        if _INTRO_LINE.match(p):
            # Keep intro lines out of scripture body (optional rubrics).
            continue
        # If the first body line looks like a bare citation and heading had none.
        if not refs.get(current or "", "") and re.match(
            r"^(?:[1-3]\s+)?[A-Za-zÁÉÍÓÚÑáéíóúñ][A-Za-zÁÉÍÓÚÑáéíóúñ\.\- ]{1,40}\s+\d",
            p,
        ):
            refs[current] = p
            continue
        bodies[current].append(p)

    def join_body(parts: list[str]) -> str:
        return "\n\n".join(parts).strip()

    entry["first_reading_ref"] = refs["first"]
    entry["first_reading"] = join_body(bodies["first"])
    entry["second_reading_ref"] = refs["second"]
    entry["second_reading"] = join_body(bodies["second"])
    entry["psalm_ref"] = refs["psalm"]
    psalm_parts = bodies["psalm"]
    if psalm_parts:
        entry["psalm_response"] = psalm_parts[0]
        entry["psalm_text"] = psalm_parts[0]
        if len(psalm_parts) > 1:
            # Full psalm including refrain repeats — fine for preview/PPT refrain pick.
            entry["psalm_verses"] = "\n\n".join(psalm_parts)
        else:
            entry["psalm_verses"] = psalm_parts[0]
    entry["gospel_ref"] = refs["gospel"]
    entry["gospel"] = join_body(bodies["gospel"])
    alleluia_body = join_body(bodies["alleluia"])
    # Prefer the sung verse body; fall back to citation after ALELUYA heading.
    entry["gospel_acclamation"] = alleluia_body or refs["alleluia"]
    return entry


def fetch_tagalog_readings_for_date(
    date: str,
    *,
    use_cache: bool = True,
    force_refresh: bool = False,
) -> dict[str, str]:
    """
    Return Tagalog reading bodies/refs for ``YYYY-MM-DD``.

    Cache lives in ``data/readings_cache_tagalog.json`` (separate from English).
    """
    mass_date = _normalize_date(date)
    empty = _empty_entry()
    if not mass_date:
        return empty

    if use_cache and not force_refresh:
        cached = get_tagalog_cache_entry(mass_date)
        if cached and _entry_usable(cached):
            return cached

    post_url = resolve_awit_post_url(mass_date)
    if not post_url:
        logger.warning("No Awit at Papuri post URL for %s", mass_date)
        cached = get_tagalog_cache_entry(mass_date)
        return cached or empty

    html = _http_get(post_url)
    if not html:
        cached = get_tagalog_cache_entry(mass_date)
        return cached or empty

    entry = parse_awit_html(html, source_url=post_url)
    if _entry_usable(entry):
        set_tagalog_cache_entry(mass_date, entry)
        return entry

    # Keep a previous good cache if scrape was partial.
    cached = get_tagalog_cache_entry(mass_date)
    if cached and _entry_usable(cached):
        return cached
    if any(str(entry.get(k) or "").strip() for k in CACHE_KEYS):
        set_tagalog_cache_entry(mass_date, entry)
    return entry
