"""
Extract full prose for Mass readings from a USCCB daily readings HTML page.

Section titles follow the USCCB site (Reading 1, Responsorial Psalm, …).
"""

from __future__ import annotations

import re
from typing import Callable, Optional

from bs4 import BeautifulSoup

from services.usccb_client import get_usccb_soup
from services.usccb_scraper import _fetch_gospel_from_pericope

_READING_TAGS = ("h1", "h2", "h3", "h4")


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


def _gather_paragraphs_after_heading(
    soup: BeautifulSoup,
    heading_match: Callable[[str], bool],
    heading_stop: Callable[[str], bool],
) -> str:
    """Collect <p> text after first heading that matches heading_match until heading_stop(title)."""
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
            # started → next section heading
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


def fetch_all_readings_text(usccb_url: str) -> dict[str, Optional[str]]:
    """
    Return prose for Reading 1, Responsorial Psalm, Reading 2 (may be empty), and Gospel.

    Missing sections are None or "".
    """
    out = {
        "first_reading": None,
        "psalm": None,
        "second_reading": None,
        "gospel": None,
    }
    soup, _http = get_usccb_soup(usccb_url)
    if soup is None:
        return out

    fr = _gather_paragraphs_after_heading(soup, _match_reading_one, _stop_after_reading_one)
    out["first_reading"] = fr if fr.strip() else None

    ps = _gather_paragraphs_after_heading(soup, _match_psalm, _stop_after_psalm)
    out["psalm"] = ps if ps.strip() else None

    s2 = _gather_paragraphs_after_heading(soup, _match_reading_two, _stop_after_reading_two)
    out["second_reading"] = s2 if s2.strip() else None

    gh = None
    for h in soup.find_all(_READING_TAGS):
        if _match_gospel(_norm_heading(h.get_text())):
            gh = h
            break
    if gh:
        gol = []
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
