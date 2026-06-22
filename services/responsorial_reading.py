"""
Responsorial reading resolution: Psalms and non-Psalm canticles.

Psalms use full-psalm lookup; canticles use the lectionary verse range.
"""

from __future__ import annotations

import re
from typing import Optional

from services.canticle_cache import get_cached_canticle_text
from services.gospel_fallback import fetch_world_english_gospel
from services.mass_text_format import reading_body_is_usable
from services.psalm_cache import get_cached_psalm_text

_PSALM_RE = re.compile(r"^(?:Psalms?|Pss?)\.?\s+(\d+)\b", re.I)
_SCRIPTURE_REF_RE = re.compile(
    r"^(?:\d+\s+)?[A-Za-z][A-Za-z\s]+?\s+\d+\s*:",
    re.I,
)

# USCCB Daniel canticle citations → bible-api.com (WEB) when direct fetch fails.
_CANTICLE_API_ALIASES: dict[str, str] = {
    "daniel 3:52-57": "Song of Azariah 1:1-15",
    "daniel 3:52-56": "Song of Azariah 1:1-15",
    "daniel 3:52-53": "Song of Azariah 1:1-5",
    "daniel 3:52-55": "Song of Azariah 1:1-10",
}


def is_psalm_reference(reference: str) -> bool:
    return bool(_PSALM_RE.match((reference or "").strip()))


def is_canticle_reference(reference: str) -> bool:
    ref = (reference or "").strip()
    if not ref or is_psalm_reference(ref):
        return False
    return bool(_SCRIPTURE_REF_RE.match(ref) or ":" in ref)


def responsorial_section_title(reference: str) -> str:
    if is_canticle_reference(reference):
        return "Responsorial Canticle"
    return "Responsorial Psalm"


def _normalize_cache_key(reference: str) -> str:
    ref = (reference or "").strip()
    ref = (
        ref.replace("\u2013", "-")
        .replace("\u2014", "-")
        .replace("–", "-")
        .replace("—", "-")
    )
    ref = re.sub(r"\s+", " ", ref)
    ref = re.sub(r"^Psalms\b", "Psalm", ref, flags=re.I)
    return ref.lower()


def psalm_reference_for_full_text(reference: str) -> str:
    """Reduce a Psalm citation to ``Psalm N`` for full-psalm lookup."""
    from services.usccb_readings import normalize_scripture_reference

    ref = (reference or "").strip()
    m = _PSALM_RE.match(ref)
    if m:
        return f"Psalm {m.group(1)}"
    return normalize_scripture_reference(ref)


def responsorial_api_reference(reference: str) -> str:
    """API citation: full psalm for Psalms, verse range for canticles."""
    from services.usccb_readings import normalize_scripture_reference

    ref = (reference or "").strip()
    if is_psalm_reference(ref):
        return psalm_reference_for_full_text(ref)
    key = _normalize_cache_key(ref)
    alias = _CANTICLE_API_ALIASES.get(key)
    if alias:
        return alias
    return normalize_scripture_reference(ref)


def fetch_responsorial_verses(reference: str) -> Optional[str]:
    """
    Fetch responsorial body text (Psalm or canticle) from local cache, then API.

  For Psalm citations with verses (e.g. ``Psalm 103:1-2, 3-4``), tries the
    lectionary verse range before falling back to the full psalm.
    """
    ref = (reference or "").strip()
    if not ref:
        return None

    from services.usccb_readings import normalize_scripture_reference

    if is_psalm_reference(ref) and ":" in ref:
        ranged_ref = normalize_scripture_reference(ref)
        if ranged_ref:
            text = fetch_world_english_gospel(ranged_ref)
            if text and reading_body_is_usable(text, ref):
                return text.strip()
            compact = re.sub(r",\s*", ",", ranged_ref)
            if compact != ranged_ref:
                text = fetch_world_english_gospel(compact)
                if text and reading_body_is_usable(text, ref):
                    return text.strip()

    if is_psalm_reference(ref):
        cached = get_cached_psalm_text(ref)
        if cached and reading_body_is_usable(cached, ref):
            return cached
    else:
        cached = get_cached_canticle_text(ref)
        if cached and reading_body_is_usable(cached, ref):
            return cached

    api_ref = responsorial_api_reference(ref)
    if not api_ref:
        return None

    text = fetch_world_english_gospel(api_ref)
    if text and reading_body_is_usable(text, ref):
        return text.strip()

    compact = re.sub(r",\s*", ",", api_ref)
    if compact != api_ref:
        text = fetch_world_english_gospel(compact)
        if text and reading_body_is_usable(text, ref):
            return text.strip()

    return None
