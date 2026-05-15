"""
File stem helpers for Mass exports: ``{churchCode}{date}{season}.pptx`` style names.

Example: ``GFCC17May2026_6thSundayOfEaster`` (church initials + compact date + sanitized title).
"""

from __future__ import annotations

import re

# English month abbreviations (locale-independent).
_MONTH_ABBR = (
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
)

_STOP_WORDS = frozenset(
    {
        "THE",
        "OF",
        "AND",
        "OUR",
        "IN",
        "FOR",
        "A",
        "AN",
        "AT",
        "TO",
    }
)


def community_prefix(community_name: str, *, max_len: int = 8) -> str:
    """
    Build a short uppercase prefix from the parish name (initials of significant words).

    Skips very short tokens and common stop words so long official names still fit filenames.
    """
    raw = (community_name or "").strip().upper()
    if not raw:
        return "MASS"
    words = [w for w in re.split(r"[^\w]+", raw) if w and w not in _STOP_WORDS and len(w) > 1]
    if not words:
        words = [w for w in re.split(r"[^\w]+", raw) if w][:4]
    initials = "".join(w[0] for w in words if w)
    out = (initials or "MASS")[:max_len]
    return out or "MASS"


def compact_date_for_filename(date_iso: str) -> str:
    """``2026-05-17`` → ``17May2026``."""
    parts = (date_iso or "").strip().split("-")
    if len(parts) != 3:
        return "UnknownDate"
    y, m, d = parts[0], int(parts[1]), int(parts[2])
    if not (1 <= m <= 12):
        return "UnknownDate"
    return f"{int(d)}{_MONTH_ABBR[m - 1]}{y}"


def season_slug_for_filename(mass_title: str, api_season: str) -> str:
    """
    Human-readable season / day fragment safe for filenames.

    Prefers the Mass title (often includes Sunday ordinal) over the short API season label.
    """
    base = (mass_title or api_season or "SundayMass").replace(" Celebration", "").strip()
    base = re.sub(r"\s+", "", base)
    safe = re.sub(r"[^0-9A-Za-z]+", "", base)
    return (safe[:48] if safe else "SundayMass")


def mass_export_stem(community_name: str, date_iso: str, mass_title: str, api_season: str) -> str:
    """
    Full stem without extension, e.g. ``GFCC17May2026_6thSundayOfEaster``.

    Used for ``.pptx``, ``.png`` liturgical posters, and related social derivatives.
    """
    return f"{community_prefix(community_name)}{compact_date_for_filename(date_iso)}_{season_slug_for_filename(mass_title, api_season)}"
