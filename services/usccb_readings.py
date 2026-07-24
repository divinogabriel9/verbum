"""
USCCB daily readings: scrape scripture references (and optional on-page prose),
fill missing text via Bible API, persist per-date cache in data/readings_cache.json.
"""

from __future__ import annotations

import json
import os
import re
from datetime import datetime, timezone
from pathlib import Path
from threading import Lock
from typing import Any, Callable, Mapping, Optional

from bs4 import BeautifulSoup

from services.gospel_fallback import fetch_world_english_gospel
from services.mass_text_format import reading_body_is_usable, strip_reading_verse_markers
from services.responsorial_reading import fetch_responsorial_verses
from services.usccb_client import get_usccb_soup
from services.usccb_scraper import _fetch_gospel_from_pericope

_READING_TAGS = ("h1", "h2", "h3", "h4")
_PROJECT_ROOT = Path(__file__).resolve().parents[1]
_CACHE_PATH = _PROJECT_ROOT / "readings_cache.json"
_CACHE_LOCK = Lock()
_file_cache_blob: Optional[dict[str, Any]] = None
_file_cache_mtime: float = 0.0

# Keys stored per date in readings_cache.json.
# The first group holds reading *bodies* (prose); the *_ref group holds the
# scraped scripture citations so a missing API reference (e.g. first reading)
# survives across cache hits; mass_celebration holds the scraped mass-day title.
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
)


def _norm_heading(t: str) -> str:
    return re.sub(r"\s+", " ", (t or "").strip())


def _is_footer_paragraph(text: str) -> bool:
    if not text:
        return True
    if "Copyright" in text or "Confraternity of Christian Doctrine" in text:
        return True
    if re.match(r"^Get the Daily Readings", text, re.I):
        return True
    if "USCCB" in text and len(text) < 200:
        return True
    return False


def _match_reading_one(title: str) -> bool:
    t = title.lower()
    return bool(re.match(r"reading\s*1\b", t, re.I) or title.strip() == "Reading I")


def _match_psalm(title: str) -> bool:
    return "responsorial psalm" in title.lower()


def _match_reading_two(title: str) -> bool:
    t = title.lower()
    return bool(re.match(r"reading\s*2\b", t, re.I) or title.strip() == "Reading II")


def _match_gospel(title: str) -> bool:
    t = _norm_heading(title).lower()
    return t == "gospel" or t.startswith("gospel ")


def _stop_after_reading_one(title: str) -> bool:
    return _match_psalm(title)


def _stop_after_psalm(title: str) -> bool:
    tl = title.lower()
    return _match_reading_two(title) or "alleluia" in tl or _match_gospel(title)


def _stop_after_reading_two(title: str) -> bool:
    tl = title.lower()
    return "alleluia" in tl or _match_gospel(title)


def _match_alleluia(title: str) -> bool:
    return "alleluia" in (title or "").lower()


def _stop_after_alleluia(title: str) -> bool:
    return _match_gospel(title)


def _scrape_gospel_acclamation_verse(soup: BeautifulSoup) -> str:
    """Lectionary Gospel Acclamation verse between Alleluia and Gospel headings."""
    return _gather_paragraphs_after_heading(
        soup, _match_alleluia, _stop_after_alleluia
    ).strip()


def _ordinal_numeric_suffix(n: int) -> str:
    if 11 <= (n % 100) <= 13:
        return f"{n}th"
    return f"{n}{('th', 'st', 'nd', 'rd', 'th', 'th', 'th', 'th', 'th', 'th')[n % 10]}"


_ORDINAL_WORD_TO_N: dict[str, int] = {
    "first": 1,
    "second": 2,
    "third": 3,
    "fourth": 4,
    "fifth": 5,
    "sixth": 6,
    "seventh": 7,
    "eighth": 8,
    "ninth": 9,
    "tenth": 10,
    "eleventh": 11,
    "twelfth": 12,
    "thirteenth": 13,
    "fourteenth": 14,
    "fifteenth": 15,
    "sixteenth": 16,
    "seventeenth": 17,
    "eighteenth": 18,
    "nineteenth": 19,
    "twentieth": 20,
    "twenty first": 21,
    "twenty second": 22,
    "twenty third": 23,
    "twenty fourth": 24,
    "twenty fifth": 25,
    "twenty sixth": 26,
    "twenty seventh": 27,
    "twenty eighth": 28,
    "twenty ninth": 29,
    "thirtieth": 30,
    "thirty first": 31,
    "thirty second": 32,
    "thirty third": 33,
    "thirty fourth": 34,
}


def simplify_celebration_ordinals(title: str) -> str:
    """
    Shorten spelled-out Sunday ordinals from USCCB headings, e.g.
    ``Eleventh Sunday in Ordinary Time`` → ``11th Sunday in Ordinary Time``.
    """
    t = _norm_heading(title)
    m = re.match(r"^([A-Za-z\-]+(?:\s+[A-Za-z]+)?)\s+(Sunday\b.*)$", t, re.I)
    if not m:
        return t
    word_part = re.sub(r"[-\s]+", " ", m.group(1).lower()).strip()
    n = _ORDINAL_WORD_TO_N.get(word_part)
    if not n:
        return t
    return f"{_ordinal_numeric_suffix(n)} {m.group(2)}"


def _is_reading_or_liturgy_heading(title: str) -> bool:
    t = _norm_heading(title).lower()
    if not t:
        return True
    if t in ("daily readings",):
        return True
    if t.startswith("lectionary:"):
        return True
    if t.startswith("get the daily readings"):
        return True
    if t.startswith("sequence"):
        return True
    if _match_reading_one(title) or _match_psalm(title) or _match_reading_two(title):
        return True
    if _match_gospel(title):
        return True
    if t.startswith("alleluia"):
        return True
    return False


def _is_nav_chrome_heading(title: str) -> bool:
    """Skip USCCB site chrome / accessibility headings (not the mass-day title)."""
    t = _norm_heading(title).lower()
    if t.startswith("menu:"):
        return True
    if t in ("main navigation", "dive into god's word"):
        return True
    return False


def is_usccb_nav_chrome_title(title: str) -> bool:
    """True when a scraped celebration string is site chrome, not a liturgical title."""
    return _is_nav_chrome_heading(title) or _is_reading_or_liturgy_heading(title)


def _mass_celebration_heading_from_soup(soup: BeautifulSoup) -> str:
    """Mass-day title: the heading immediately before Reading 1 on bible.usccb.org."""
    reading_one_el = None
    for h in soup.find_all(_READING_TAGS):
        if _match_reading_one(_norm_heading(h.get_text())):
            reading_one_el = h
            break

    if reading_one_el is not None:
        for h in reading_one_el.find_all_previous(_READING_TAGS):
            title = _norm_heading(h.get_text())
            if _is_reading_or_liturgy_heading(title) or _is_nav_chrome_heading(title):
                continue
            if len(title) >= 4:
                return title

    for h in soup.find_all(_READING_TAGS):
        title = _norm_heading(h.get_text())
        if _is_reading_or_liturgy_heading(title) or _is_nav_chrome_heading(title):
            continue
        if len(title) >= 4:
            return title
    return ""


def scrape_mass_celebration_from_soup(soup: BeautifulSoup) -> str:
    """USCCB mass-day heading (solemnity, feast, or Sunday), with shortened ordinals."""
    raw = _mass_celebration_heading_from_soup(soup)
    return simplify_celebration_ordinals(raw) if raw else ""


def ignore_readings_cache() -> bool:
    return os.environ.get("READINGS_IGNORE_CACHE", "").strip() in ("1", "true", "yes")


def readings_cache_path() -> Path:
    return _CACHE_PATH


def _load_cache_file() -> dict[str, Any]:
    global _file_cache_blob, _file_cache_mtime
    path = readings_cache_path()
    if not path.is_file():
        _file_cache_blob = {}
        _file_cache_mtime = 0.0
        return {}
    try:
        mtime = path.stat().st_mtime
    except OSError:
        mtime = 0.0
    if _file_cache_blob is not None and mtime == _file_cache_mtime:
        return _file_cache_blob
    try:
        with path.open(encoding="utf-8") as fh:
            data = json.load(fh)
        blob = data if isinstance(data, dict) else {}
    except (json.JSONDecodeError, OSError):
        blob = {}
    _file_cache_blob = blob
    _file_cache_mtime = mtime
    return blob


def _save_cache_file(data: dict[str, Any]) -> None:
    global _file_cache_blob, _file_cache_mtime
    path = readings_cache_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".tmp")
    with tmp.open("w", encoding="utf-8") as fh:
        json.dump(data, fh, ensure_ascii=False, indent=2)
        fh.write("\n")
    tmp.replace(path)
    try:
        _file_cache_mtime = path.stat().st_mtime
    except OSError:
        _file_cache_mtime = 0.0
    _file_cache_blob = data


def _psalm_text_is_refrain_only(psalm_text: str) -> bool:
    """True when cached psalm body is only the response refrain, not stanzas."""
    t = (psalm_text or "").strip()
    if not t:
        return True
    if "\n\n" in t and len(t) > 280:
        return False
    if len(re.findall(r"\bR\.\s", t, re.I)) >= 2:
        return False
    if len(t) > 450:
        return False
    if not re.match(r"^R\.?\s", t, re.I):
        return False
    return True


def _cache_entry_is_usable(entry: Mapping[str, str]) -> bool:
    """Reject cache rows that only store verse numbers or bare citations."""
    if reading_body_is_usable(entry.get("first_reading") or ""):
        return True
    if reading_body_is_usable(entry.get("gospel") or ""):
        return True
    if reading_body_is_usable(entry.get("psalm_text") or ""):
        return True
    if reading_body_is_usable(entry.get("second_reading") or ""):
        return True
    return False


def _cache_entry_has_psalm_refrain(entry: Mapping[str, str]) -> bool:
    """True when a responsorial-psalm refrain can be derived from the cached row."""
    return bool(
        collect_psalm_refrain_options(
            entry.get("psalm_text") or "",
            entry.get("psalm_ref") or "",
            psalm_response=entry.get("psalm_response") or "",
        )
    )


def _cache_entry_has_psalm(entry: Mapping[str, str]) -> bool:
    """True when the row carries the responsorial psalm in some usable form.

    Either the refrain (from USCCB) or the full verses (from the Bible API
    fallback) counts — so a USCCB outage can't leave the psalm empty.
    """
    if _cache_entry_has_psalm_refrain(entry):
        return True
    return reading_body_is_usable(entry.get("psalm_verses") or "")


def _cache_entry_has_core_refs(entry: Mapping[str, str]) -> bool:
    """True when first reading, psalm, and gospel citations are present.

    Older cache rows often stored prose before ``*_ref`` keys existed. Without
    this gate those days stay "complete/healthy" forever and month scans skip
    them — leaving the admin Psalm citation field empty.
    """
    return bool(
        (entry.get("first_reading_ref") or "").strip()
        and (entry.get("psalm_ref") or "").strip()
        and (entry.get("gospel_ref") or "").strip()
    )


def _cache_entry_is_complete(entry: Mapping[str, str]) -> bool:
    """
    Strict gate for serving a cached row without re-fetching.

    A row is only "complete" if it carries the three things every Mass deck
    needs: the first-reading body, the gospel body, and the responsorial-psalm
    *refrain* (USCCB), plus the core scripture citations.

    Bible-API psalm verses alone are not enough: they are a different translation
    and must not freeze the cache so the real NABRE refrain never gets scraped
    (e.g. July 26 showing WEB stanzas instead of ``Lord, I love your commands.``).
    Incomplete rows fall through to a live fetch and are repaired/merged in place.
    """
    if not reading_body_is_usable(entry.get("first_reading") or ""):
        return False
    if not reading_body_is_usable(entry.get("gospel") or ""):
        return False
    if not _cache_entry_has_psalm_refrain(entry):
        return False
    if not _cache_entry_has_core_refs(entry):
        return False
    return True


def get_readings_cache_entry(date: str) -> Optional[dict[str, str]]:
    """Return cached reading texts for YYYY-MM-DD if present."""
    with _CACHE_LOCK:
        blob = _load_cache_file()
    entry = blob.get(date.strip())
    if not isinstance(entry, dict):
        return None
    out: dict[str, str] = {}
    for key in CACHE_KEYS:
        val = entry.get(key)
        if val is not None:
            out[key] = str(val)
    if not out or not _cache_entry_is_usable(out):
        return None
    return out


def _raw_readings_cache_entry(date: str) -> Optional[dict[str, str]]:
    """Return the raw cache row even when incomplete/unusable (for merge safety)."""
    with _CACHE_LOCK:
        blob = _load_cache_file()
    entry = blob.get(date.strip())
    if not isinstance(entry, dict):
        return None
    return {k: str(entry.get(k) or "") for k in CACHE_KEYS}


def set_readings_cache_entry(date: str, entry: Mapping[str, str]) -> None:
    with _CACHE_LOCK:
        blob = _load_cache_file()
        row = {k: str(entry.get(k) or "") for k in CACHE_KEYS}
        row["updated_at"] = datetime.now(timezone.utc).isoformat()
        blob[date.strip()] = row
        _save_cache_file(blob)


def normalize_scripture_reference(reference: str) -> str:
    """
    Normalize USCCB-style citations for bible-api.com (WEB).

    Examples:
      Acts 2:14, 22–33  → Acts 2:14,22-33
      Acts 2:14a, 36-41 → Acts 2:14,36-41
      1 Peter 2:20b-25  → 1 Peter 2:20-25
    """
    ref = (reference or "").strip()
    if not ref:
        return ""

    ref = (
        ref.replace("\u2013", "-")
        .replace("\u2014", "-")
        .replace("–", "-")
        .replace("—", "-")
    )
    ref = re.sub(r"\s+", " ", ref)
    ref = re.sub(r"^Psalms\b", "Psalm", ref, flags=re.I)

    if ":" not in ref:
        return ref

    book, verses = ref.split(":", 1)
    book = book.strip()
    verses = verses.strip()
    # Liturgical verse suffixes (14a, 20b, 3b4 → 3,4)
    verses = re.sub(r"(\d+)[a-zA-Z]+\b", r"\1", verses)
    verses = re.sub(r"(\d+)[a-zA-Z](\d+)", r"\1,\2", verses)
    verses = re.sub(r"\s*,\s*", ",", verses)
    verses = re.sub(r"\s*-\s*", "-", verses)
    verses = verses.replace(" ", "")
    verses = re.sub(r",+", ",", verses)
    return f"{book}:{verses}"


def psalm_reference_for_full_text(reference: str) -> str:
    """Reduce a responsorial psalm citation to ``Psalm N`` for full-psalm API fetch."""
    from services.responsorial_reading import psalm_reference_for_full_text as _full

    return _full(reference)


def fetch_scripture_text(reference: str, *, full_psalm: bool = False) -> Optional[str]:
    ref = (reference or "").strip()
    if not ref:
        return None

    if full_psalm:
        return fetch_responsorial_verses(ref)

    api_ref = normalize_scripture_reference(ref)
    if not api_ref:
        return None
    text = fetch_world_english_gospel(api_ref)
    if text:
        return text
    compact = re.sub(r",\s*", ",", api_ref)
    if compact != api_ref:
        text = fetch_world_english_gospel(compact)
    return text


def _prose_sufficient(reference: str, text: str) -> bool:
    return reading_body_is_usable(text, reference)


def scrape_scripture_links_from_soup(soup: BeautifulSoup) -> dict[str, str]:
    """USCCB pericope URLs (NABRE) from div.address links."""
    links: dict[str, str] = {
        "first_reading": "",
        "psalm": "",
        "second_reading": "",
        "gospel": "",
    }
    section_pairs = (
        (_match_reading_one, "first_reading"),
        (_match_psalm, "psalm"),
        (_match_reading_two, "second_reading"),
        (_match_gospel, "gospel"),
    )
    for h in soup.find_all(_READING_TAGS):
        title = _norm_heading(h.get_text())
        for matcher, key in section_pairs:
            if matcher(title):
                ad = h.find_next("div", class_="address")
                if ad and ad.a and ad.a.get("href"):
                    links[key] = (ad.a["href"] or "").strip()
                break
    return links


def scrape_scripture_references_from_soup(soup: BeautifulSoup) -> dict[str, str]:
    refs: dict[str, str] = {
        "first_reading": "",
        "psalm": "",
        "second_reading": "",
        "gospel": "",
    }
    section_pairs = (
        (_match_reading_one, "first_reading"),
        (_match_psalm, "psalm"),
        (_match_reading_two, "second_reading"),
        (_match_gospel, "gospel"),
    )
    for h in soup.find_all(_READING_TAGS):
        title = _norm_heading(h.get_text())
        for matcher, key in section_pairs:
            if matcher(title):
                ad = h.find_next("div", class_="address")
                if ad:
                    refs[key] = _norm_heading(ad.get_text(" ", strip=True))
                break
    return refs


def scrape_scripture_references(usccb_url: str) -> dict[str, str]:
    """Scrape scripture references from a USCCB daily readings URL."""
    empty = {
        "first_reading": "",
        "psalm": "",
        "second_reading": "",
        "gospel": "",
    }
    soup, _http = get_usccb_soup(usccb_url)
    if soup is None:
        return empty
    return scrape_scripture_references_from_soup(soup)


def _gather_paragraphs_after_heading(
    soup: BeautifulSoup,
    heading_match: Callable[[str], bool],
    heading_stop: Callable[[str], bool],
) -> str:
    tags = list(soup.find_all([*_READING_TAGS, "p"]))
    started = False
    parts: list[str] = []
    for tag in tags:
        if tag.name in _READING_TAGS:
            title = _norm_heading(tag.get_text())
            if not started:
                if heading_match(title):
                    started = True
                continue
            if title and heading_stop(title):
                break
            continue
        if started and tag.name == "p":
            t = tag.get_text(" ", strip=True)
            if _is_footer_paragraph(t):
                break
            if t:
                parts.append(t)
    return " ".join(parts)


def _gather_responsorial_psalm_prose(
    soup: BeautifulSoup,
    heading_match: Callable[[str], bool],
    heading_stop: Callable[[str], bool],
) -> str:
    """Responsorial psalm paragraphs from USCCB, preserving stanza breaks."""
    tags = list(soup.find_all([*_READING_TAGS, "p"]))
    started = False
    parts: list[str] = []
    for tag in tags:
        if tag.name in _READING_TAGS:
            title = _norm_heading(tag.get_text())
            if not started:
                if heading_match(title):
                    started = True
                continue
            if title and heading_stop(title):
                break
            continue
        if started and tag.name == "p":
            t = tag.get_text(" ", strip=True)
            if _is_footer_paragraph(t):
                break
            if t:
                parts.append(t)
    return "\n\n".join(parts)


def _normalize_responsorial_prose(text: str) -> str:
    """Split space-joined USCCB prose into lines at each ``R.`` refrain."""
    t = (text or "").strip()
    if not t:
        return ""
    if "\n\n" in t:
        return t
    split = re.split(r"\s+(?=R\.\s)", t, flags=re.I)
    if len(split) > 1:
        return "\n\n".join(s.strip() for s in split if s.strip())
    return t


def _scraped_responsorial_body(scraped: Optional[str]) -> str:
    """Full on-page responsorial text when USCCB provides stanzas, not just the refrain."""
    raw = _normalize_responsorial_prose((scraped or "").strip())
    if not raw:
        return ""
    if len(raw) > 320:
        return raw
    if len(re.findall(r"\bR\.\s", raw, re.I)) >= 2:
        return raw
    return ""


def _extract_responsorial_refrain(text: str) -> str:
    """
    Core responsorial response only, e.g. ``Praise the Lord, Jerusalem.``

    Strips ``R.``, verse keys like ``(12)``, alternates (``or:``), and text after
    the first sentence (e.g. ``And when it is rain…``).
    """
    line = (text or "").strip()
    if not line:
        return ""
    line = line.split("\n\n")[0].split("\n")[0].strip()
    line = re.sub(r"^R\.?\s*", "", line, flags=re.I).strip()
    line = re.sub(r"^\([^)]*\)\s*", "", line).strip()
    line = re.sub(r"^\(see[^)]*\)\s*", "", line, flags=re.I).strip()
    line = re.split(r"\s+or:\s*R\.?\s*Alleluia\.\s*", line, maxsplit=1, flags=re.I)[0].strip()
    line = re.split(r"\s+or:\s*", line, maxsplit=1, flags=re.I)[0].strip()
    m = re.match(r"^(.+?[.!?])", line)
    if m:
        line = m.group(1).strip()
    else:
        line = re.split(
            r"\s+And\s+(?:when|if|the|at|in|on)\s+",
            line,
            maxsplit=1,
            flags=re.I,
        )[0].strip()
    return line.strip()


def _clean_psalm_refrain_line(text: str) -> str:
    return _extract_responsorial_refrain(text)


def _refrain_slide_body(refrain: str) -> str:
    """Projection line: ``R. {refrain}``."""
    t = _extract_responsorial_refrain(refrain)
    return f"R. {t}" if t else ""


def _first_refrain_raw_from_scraped(scraped: Optional[str]) -> str:
    text = (scraped or "").strip()
    if not text:
        return ""
    for block in re.split(r"\n\n+", text):
        s = block.strip()
        if re.match(r"^R\.?\s", s, re.I) or re.match(r"^\([^)]+\)\s*\S", s):
            return s
    for line in text.splitlines():
        s = line.strip()
        if re.match(r"^R\.?\s", s, re.I) or re.match(r"^\([^)]+\)\s*\S", s):
            return s
    prose = _normalize_responsorial_prose(text)
    if prose and re.search(r"\bR\.\s", prose, re.I):
        parts = re.split(r"\s+(?=R\.\s)", prose, flags=re.I)
        for part in parts:
            s = part.strip()
            if re.match(r"^R\.?\s", s, re.I):
                return s
    return ""


def _scrape_psalm_response(soup: BeautifulSoup) -> str:
    """Extract the responsorial refrain (R./R. (see …)) from the USCCB page when present."""
    tags = list(soup.find_all([*_READING_TAGS, "p"]))
    started = False
    for tag in tags:
        if tag.name in _READING_TAGS:
            title = _norm_heading(tag.get_text())
            if not started:
                if _match_psalm(title):
                    started = True
                continue
            if _match_reading_two(title) or _match_gospel(title) or "alleluia" in title.lower():
                break
            continue
        if started and tag.name == "p":
            t = tag.get_text(" ", strip=True)
            if _is_footer_paragraph(t):
                break
            if not t:
                continue
            if re.match(r"^R\.?\s*", t, re.I):
                return _clean_psalm_refrain_line(t)
            if re.search(r"\bresponse\s*:", t, re.I):
                return _clean_psalm_refrain_line(
                    re.sub(r"^.*response\s*:\s*", "", t, flags=re.I)
                )
            # USCCB refrain without leading R., e.g. "(1) The Lord is my shepherd…"
            if len(t) <= 240 and (
                re.match(r"^\(\d+\)", t)
                or re.match(r"^[A-Za-z].{0,200}(?:\.|\?|!)\s*$", t)
            ):
                return _clean_psalm_refrain_line(t)
    return ""


def _scrape_on_page_prose(soup: BeautifulSoup) -> dict[str, Optional[str]]:
    out: dict[str, Optional[str]] = {
        "first_reading": None,
        "psalm": None,
        "second_reading": None,
        "gospel": None,
    }
    fr = _gather_paragraphs_after_heading(soup, _match_reading_one, _stop_after_reading_one)
    out["first_reading"] = fr if fr.strip() else None

    ps = _gather_responsorial_psalm_prose(soup, _match_psalm, _stop_after_psalm)
    out["psalm"] = ps if ps.strip() else None

    s2 = _gather_paragraphs_after_heading(soup, _match_reading_two, _stop_after_reading_two)
    out["second_reading"] = s2 if s2.strip() else None

    gh = None
    for h in soup.find_all(_READING_TAGS):
        if _match_gospel(_norm_heading(h.get_text())):
            gh = h
            break
    if gh:
        gol: list[str] = []
        for p in gh.find_all_next("p", limit=60):
            t = p.get_text(" ", strip=True)
            if _is_footer_paragraph(t):
                break
            if t:
                gol.append(t)
        gtxt = " ".join(gol)
        if not gtxt.strip():
            addr = gh.find_next("div", class_="address")
            if addr and addr.a and addr.a.get("href"):
                gtxt = _fetch_gospel_from_pericope(addr.a["href"]) or ""
        out["gospel"] = gtxt.strip() if gtxt.strip() else None
    return out


def _fetch_pericope_text(href: str) -> Optional[str]:
    if not (href or "").strip():
        return None
    return _fetch_gospel_from_pericope(href.strip())


def _resolve_reading_body(
    reference: str,
    scraped: Optional[str],
    *,
    pericope_href: str = "",
) -> str:
    ref = (reference or "").strip()
    prose = (scraped or "").strip()
    if ref and _prose_sufficient(ref, prose):
        return prose

    api_text: Optional[str] = None
    if ref:
        api_text = fetch_scripture_text(ref, full_psalm=False)
        if api_text and reading_body_is_usable(api_text, ref):
            return api_text.strip()

    peri = _fetch_pericope_text(pericope_href)
    if peri and reading_body_is_usable(peri, ref):
        return peri.strip()
    if api_text:
        return api_text.strip()
    if peri:
        return peri.strip()
    if _prose_sufficient(ref, prose):
        return prose
    return ""


def _format_psalm_text(response: str, verses: str) -> str:
    v = (verses or "").strip()
    r = (response or "").strip()
    if v and re.match(r"^R\.?\s", v, re.I) and (not r or len(v) > len(r) + 60):
        return v
    v = strip_reading_verse_markers(v)
    if r:
        rline = r if re.match(r"^R\.?\s", r, re.I) else f"R. {r}"
        return f"{rline}\n\n{v}".strip() if v else rline
    return v


def _resolve_psalm(
    reference: str,
    scraped: Optional[str],
    response_line: str,
    *,
    pericope_href: str = "",
) -> tuple[str, str]:
    """Return slide text and plain refrain (response only, no psalm stanzas)."""
    del reference, pericope_href  # refrain comes from USCCB response line / scrape
    raw = (response_line or "").strip()
    if not raw:
        raw = _first_refrain_raw_from_scraped(scraped)
    if not raw and scraped:
        first = (scraped or "").split("\n\n")[0].strip()
        if re.match(r"^R\.?\s", first, re.I) or re.match(r"^\([^)]+\)", first):
            raw = first
    refrain = _extract_responsorial_refrain(raw)
    body = _refrain_slide_body(refrain)
    return body, refrain


def enrich_psalm_text_for_slides(
    psalm_text: str,
    psalm_reference: str,
    *,
    psalm_response: str = "",
) -> str:
    """Normalize any loaded psalm field to the single responsorial refrain for slides."""
    resp = (psalm_response or "").strip()
    if resp:
        refrain = _extract_responsorial_refrain(resp)
        if refrain:
            return _refrain_slide_body(refrain)

    raw_r = _first_refrain_raw_from_scraped(psalm_text)
    if raw_r:
        refrain = _extract_responsorial_refrain(raw_r)
        if refrain:
            return _refrain_slide_body(refrain)

    text = (psalm_text or "").strip()
    if text:
        for line in text.splitlines():
            s = line.strip()
            if re.match(r"^R\.?\s", s, re.I):
                refrain = _extract_responsorial_refrain(s)
                if refrain:
                    return _refrain_slide_body(refrain)
        if len(text) < 220 and "\n\n" not in text:
            refrain = _extract_responsorial_refrain(text)
            if refrain:
                return _refrain_slide_body(refrain)

    ref = (psalm_reference or "").strip()
    if ref:
        body, _ = _resolve_psalm(ref, psalm_text or None, resp)
        if body:
            return body
    return ""


def collect_psalm_refrain_options(
    psalm_text: str,
    psalm_reference: str = "",
    *,
    psalm_response: str = "",
) -> list[str]:
    """Distinct responsorial refrain lines detectable from psalm sources (not gospel sentences)."""
    seen: set[str] = set()
    options: list[str] = []

    def add_raw(raw: str) -> None:
        refrain = _extract_responsorial_refrain(raw)
        if not refrain:
            return
        key = refrain.lower()
        if key in seen:
            return
        seen.add(key)
        options.append(refrain)

    resp = (psalm_response or "").strip()
    if resp:
        add_raw(resp)

    text = _normalize_responsorial_prose((psalm_text or "").strip())
    if text:
        for block in re.split(r"\n\n+", text):
            s = block.strip()
            if re.match(r"^R\.?\s", s, re.I) or re.match(r"^\([^)]+\)", s):
                add_raw(s)
        for line in text.splitlines():
            s = line.strip()
            if re.match(r"^R\.?\s", s, re.I):
                add_raw(s)
        for part in re.split(r"\s+(?=R\.\s)", text, flags=re.I):
            s = part.strip()
            if re.match(r"^R\.?\s", s, re.I):
                add_raw(s)
        if len(text) < 220 and not options:
            add_raw(text)

    if not options:
        _, refrain = _resolve_psalm(psalm_reference, psalm_text or None, resp)
        if refrain:
            add_raw(refrain)

    return options


def resolve_psalm_slide_text(
    psalm_text: str,
    psalm_reference: str = "",
    *,
    psalm_response: str = "",
    psalm_text_override: Optional[str] = None,
    refrain_index: Optional[int] = None,
) -> str:
    """Pick the responsorial refrain line for slides (override, chosen index, or default detection)."""
    ovr = (psalm_text_override or "").strip()
    if ovr:
        if re.match(r"^R\.?\s", ovr, re.I):
            return _refrain_slide_body(_extract_responsorial_refrain(ovr))
        return _refrain_slide_body(ovr)

    options = collect_psalm_refrain_options(
        psalm_text,
        psalm_reference,
        psalm_response=psalm_response,
    )
    if options:
        idx = refrain_index if refrain_index is not None else 0
        if 0 <= idx < len(options):
            return _refrain_slide_body(options[idx])
        return _refrain_slide_body(options[0])

    return enrich_psalm_text_for_slides(
        psalm_text,
        psalm_reference,
        psalm_response=psalm_response,
    )


def _merge_fallback_refs(
    scraped_refs: Mapping[str, str],
    fallback_refs: Optional[Mapping[str, str]],
) -> dict[str, str]:
    out = dict(scraped_refs)
    if not fallback_refs:
        return out
    fb_map = {
        "first_reading": fallback_refs.get("firstReading") or fallback_refs.get("first_reading") or "",
        "psalm": fallback_refs.get("psalm") or "",
        "second_reading": fallback_refs.get("secondReading") or fallback_refs.get("second_reading") or "",
        "gospel": fallback_refs.get("gospel") or "",
    }
    for key, val in fb_map.items():
        if val and not (out.get(key) or "").strip():
            out[key] = str(val).strip()
    return out


def fetch_readings_for_date(
    date: str,
    usccb_url: str,
    *,
    fallback_refs: Optional[Mapping[str, str]] = None,
    use_cache: bool = True,
) -> dict[str, str]:
    """
    Load readings for Mass date (YYYY-MM-DD): cache → USCCB references → Bible API fill-in.

    Returns dict with keys: first_reading, psalm_text, psalm_response, second_reading, gospel.
    """
    mass_date = date.strip()
    cached_partial: Optional[dict[str, str]] = None
    # Always load any existing row for field-level merge, even on force-refresh.
    # ``use_cache`` only controls the early-return of a complete row — a failed
    # USCCB scrape must never blank out a previously good refrain/citation.
    if not ignore_readings_cache():
        cached = get_readings_cache_entry(mass_date)
        if use_cache and cached and _cache_entry_is_complete(cached):
            celebration = (cached.get("mass_celebration") or "").strip()
            if (not celebration or is_usccb_nav_chrome_title(celebration)) and usccb_url:
                soup, _http = get_usccb_soup(usccb_url.strip())
                if soup is not None:
                    celebration = scrape_mass_celebration_from_soup(soup)
                    if celebration:
                        cached = {**cached, "mass_celebration": celebration}
                        set_readings_cache_entry(mass_date, cached)
            return cached
        # Prefer a usable row; fall back to the raw row so force-refresh merges
        # cannot wipe fields when usability checks temporarily fail.
        cached_partial = cached or _raw_readings_cache_entry(mass_date)
        if cached_partial and not any(cached_partial.get(k) for k in CACHE_KEYS):
            cached_partial = None

    soup, _http = get_usccb_soup(usccb_url.strip()) if usccb_url else (None, None)
    empty_refs = {
        "first_reading": "",
        "psalm": "",
        "second_reading": "",
        "gospel": "",
    }
    scraped_refs = scrape_scripture_references_from_soup(soup) if soup is not None else dict(empty_refs)
    pericope_links = scrape_scripture_links_from_soup(soup) if soup is not None else dict(empty_refs)
    refs = _merge_fallback_refs(scraped_refs, fallback_refs)

    scraped_prose: dict[str, Optional[str]] = {
        "first_reading": None,
        "psalm": None,
        "second_reading": None,
        "gospel": None,
    }
    psalm_response = ""
    mass_celebration = ""
    gospel_acclamation = ""
    if soup is not None:
        scraped_prose = _scrape_on_page_prose(soup)
        psalm_response = _scrape_psalm_response(soup)
        mass_celebration = scrape_mass_celebration_from_soup(soup)
        gospel_acclamation = _scrape_gospel_acclamation_verse(soup)

    psalm_text, psalm_resp = _resolve_psalm(
        refs.get("psalm") or "",
        scraped_prose.get("psalm"),
        psalm_response,
        pericope_href=pericope_links.get("psalm") or "",
    )

    # Full responsorial-psalm verses from a USCCB-independent source (the Bible
    # API / local psalm cache). USCCB blocks server/datacenter IPs (503/403/
    # bot-challenge), so its refrain often can't be scraped in production; these
    # verses guarantee the psalm text is still available for display. The refrain
    # above (psalm_text) is still used for the slide when USCCB provides it.
    psalm_verses = ""
    psalm_ref = (refs.get("psalm") or "").strip()
    if psalm_ref:
        verses = fetch_responsorial_verses(psalm_ref)
        if verses and reading_body_is_usable(verses, psalm_ref):
            psalm_verses = verses.strip()

    entry = {
        "first_reading": _resolve_reading_body(
            refs.get("first_reading") or "",
            scraped_prose.get("first_reading"),
            pericope_href=pericope_links.get("first_reading") or "",
        ),
        "psalm_text": psalm_text,
        "psalm_response": psalm_resp,
        "psalm_verses": psalm_verses,
        "second_reading": _resolve_reading_body(
            refs.get("second_reading") or "",
            scraped_prose.get("second_reading"),
            pericope_href=pericope_links.get("second_reading") or "",
        ),
        "gospel": _resolve_reading_body(
            refs.get("gospel") or "",
            scraped_prose.get("gospel"),
            pericope_href=pericope_links.get("gospel") or "",
        ),
        "gospel_acclamation": gospel_acclamation,
        "mass_celebration": mass_celebration,
        # Scraped citations — let a missing API reference (e.g. first reading) survive.
        "first_reading_ref": (refs.get("first_reading") or "").strip(),
        "psalm_ref": (refs.get("psalm") or "").strip(),
        "second_reading_ref": (refs.get("second_reading") or "").strip(),
        "gospel_ref": (refs.get("gospel") or "").strip(),
    }

    # Never let a partial live fetch (e.g. a USCCB bot-challenge) blank out fields
    # that a previous fetch already cached: keep the good cached value per key.
    if cached_partial:
        for key in CACHE_KEYS:
            if not str(entry.get(key) or "").strip() and str(cached_partial.get(key) or "").strip():
                entry[key] = cached_partial[key]

    # Always persist live/merged results. ``use_cache=False`` only skips *reading*
    # a stale complete row (force-refresh / retries) — it must still write the
    # repaired refrain/citations back to readings_cache.json.
    # Never replace a non-empty row with a totally empty live failure.
    if not ignore_readings_cache():
        has_content = any(str(entry.get(k) or "").strip() for k in CACHE_KEYS)
        prior_content = bool(
            cached_partial and any(str(cached_partial.get(k) or "").strip() for k in CACHE_KEYS)
        )
        if has_content or not prior_content:
            set_readings_cache_entry(mass_date, entry)

    return entry


def fetch_all_readings_text(usccb_url: str) -> dict[str, Optional[str]]:
    """
    Legacy helper: return prose keyed as first_reading, psalm, second_reading, gospel.

    Prefer fetch_readings_for_date() for cache + API resolution.
    """
    out: dict[str, Optional[str]] = {
        "first_reading": None,
        "psalm": None,
        "second_reading": None,
        "gospel": None,
    }
    refs = scrape_scripture_references(usccb_url)
    soup, _ = get_usccb_soup(usccb_url)
    scraped: dict[str, Optional[str]] = {k: None for k in out}
    if soup:
        scraped = _scrape_on_page_prose(soup)
    out["first_reading"] = _resolve_reading_body(refs["first_reading"], scraped["first_reading"]) or None
    psalm_text, _resp = _resolve_psalm(refs["psalm"], scraped["psalm"], "")
    out["psalm"] = psalm_text or None
    s2 = _resolve_reading_body(refs["second_reading"], scraped["second_reading"])
    out["second_reading"] = s2 if s2.strip() else None
    out["gospel"] = _resolve_reading_body(refs["gospel"], scraped["gospel"]) or None
    return out
