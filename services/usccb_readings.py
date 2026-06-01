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

# Keys stored per date in readings_cache.json
CACHE_KEYS = (
    "first_reading",
    "psalm_text",
    "psalm_response",
    "second_reading",
    "gospel",
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


def ignore_readings_cache() -> bool:
    return os.environ.get("READINGS_IGNORE_CACHE", "").strip() in ("1", "true", "yes")


def readings_cache_path() -> Path:
    return _CACHE_PATH


def _load_cache_file() -> dict[str, Any]:
    path = readings_cache_path()
    if not path.is_file():
        return {}
    try:
        with path.open(encoding="utf-8") as fh:
            data = json.load(fh)
        return data if isinstance(data, dict) else {}
    except (json.JSONDecodeError, OSError):
        return {}


def _save_cache_file(data: dict[str, Any]) -> None:
    path = readings_cache_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".tmp")
    with tmp.open("w", encoding="utf-8") as fh:
        json.dump(data, fh, ensure_ascii=False, indent=2)
        fh.write("\n")
    tmp.replace(path)


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
    psalm = (entry.get("psalm_text") or "").strip()
    if psalm and not _psalm_text_is_refrain_only(psalm) and reading_body_is_usable(psalm):
        return True
    if reading_body_is_usable(entry.get("second_reading") or ""):
        return True
    return False


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


def _clean_psalm_refrain_line(text: str) -> str:
    line = (text or "").strip()
    if not line:
        return ""
    if re.match(r"^R\.?\s*", line, re.I):
        line = re.sub(r"^R\.?\s*", "", line, flags=re.I).strip()
        line = re.sub(r"^\(see[^)]*\)\s*", "", line, flags=re.I).strip()
    # USCCB often appends an alternate refrain after "or: R. Alleluia."
    line = re.split(r"\s+or:\s*R\.\s*Alleluia\.\s*", line, maxsplit=1, flags=re.I)[0].strip()
    line = re.split(r"\s+or:\s*", line, maxsplit=1, flags=re.I)[0].strip()
    return line


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
    ref = (reference or "").strip()
    resp = _clean_psalm_refrain_line(response_line)
    if not resp and scraped:
        for line in re.split(r"\n\n|\n", scraped or ""):
            s = line.strip()
            if re.match(r"^R\.?\s", s, re.I) or re.match(r"^\(\d+\)", s):
                resp = _clean_psalm_refrain_line(s)
                if resp:
                    break

    scraped_full = _scraped_responsorial_body(scraped)
    if scraped_full and reading_body_is_usable(ref, scraped_full):
        if not resp:
            for line in scraped_full.split("\n\n"):
                s = line.strip()
                if re.match(r"^R\.?\s", s, re.I):
                    resp = _clean_psalm_refrain_line(s)
                    break
        return scraped_full, resp

    verses = ""
    if ref:
        if ":" in ref:
            ranged = fetch_scripture_text(ref, full_psalm=False)
            if ranged and reading_body_is_usable(ranged, ref):
                verses = ranged.strip()
        if not verses:
            api_psalm = fetch_scripture_text(ref, full_psalm=True)
            if api_psalm and reading_body_is_usable(api_psalm, ref):
                verses = api_psalm.strip()
    if not verses:
        peri = _fetch_pericope_text(pericope_href)
        if peri and reading_body_is_usable(peri, ref):
            verses = peri.strip()
    if not verses:
        fallback = _normalize_responsorial_prose((scraped or "").strip())
        if fallback and reading_body_is_usable(ref, fallback):
            verses = fallback

    body = _format_psalm_text(resp, verses)
    return body, resp


def enrich_psalm_text_for_slides(
    psalm_text: str,
    psalm_reference: str,
    *,
    psalm_response: str = "",
) -> str:
    """Re-fetch when slides only have the refrain; keeps full responsorial when possible."""
    body = (psalm_text or "").strip()
    ref = (psalm_reference or "").strip()
    if not ref:
        return body
    if body and not _psalm_text_is_refrain_only(body):
        return body
    resolved, _ = _resolve_psalm(ref, None, (psalm_response or body).strip())
    return (resolved or body).strip()


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
    if use_cache and not ignore_readings_cache():
        cached = get_readings_cache_entry(mass_date)
        if cached and any(cached.get(k) for k in CACHE_KEYS):
            return cached

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
    if soup is not None:
        scraped_prose = _scrape_on_page_prose(soup)
        psalm_response = _scrape_psalm_response(soup)

    psalm_text, psalm_resp = _resolve_psalm(
        refs.get("psalm") or "",
        scraped_prose.get("psalm"),
        psalm_response,
        pericope_href=pericope_links.get("psalm") or "",
    )

    entry = {
        "first_reading": _resolve_reading_body(
            refs.get("first_reading") or "",
            scraped_prose.get("first_reading"),
            pericope_href=pericope_links.get("first_reading") or "",
        ),
        "psalm_text": psalm_text,
        "psalm_response": psalm_resp,
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
    }

    if use_cache:
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
