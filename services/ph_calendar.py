"""
Philippines Proper day titles for the Mass calendar UI.

Full-year curated tables live in ``data/philippines_calendar_YYYY.json``
(aligned with the public Philippines liturgical calendar). Distinctive
national feasts are also available by fixed civil date for other years.
"""

from __future__ import annotations

import json
import logging
from functools import lru_cache
from pathlib import Path
from typing import Any, Optional

logger = logging.getLogger(__name__)

_ROOT = Path(__file__).resolve().parents[1]
_DATA = _ROOT / "data"

# Rank strength for optional precedence (higher wins over weekdays).
_RANK_WEIGHT = {
    "solemnity": 90,
    "triduum": 88,
    "feast": 70,
    "sunday": 60,
    "season": 50,
    "commemoration": 40,
    "memorial": 30,
}

# Distinctive Philippines-only / elevated national observances (any year).
# Movable PH feasts (Santo Niño, Eternal High Priest, Ascension-on-Sunday) need
# a year table or later rule engine — they are not listed here.
_NATIONAL_FIXED: dict[str, dict[str, str]] = {
    "01-09": {
        "title": "The Translation of the Black Nazarene",
        "rank": "feast",
    },
    "02-06": {
        "title": "Saints Pedro Bautista, Paul Miki and their Companions, Martyrs",
        "rank": "memorial",
    },
    "09-28": {
        "title": "Saints Laurence Ruiz and his Companions, Martyrs",
        "rank": "feast",
    },
    "10-21": {
        "title": "Saint Pedro Calungsod, Catechist and Martyr",
        "rank": "feast",
    },
    "12-08": {
        "title": (
            "The Immaculate Conception of the Blessed Virgin Mary, "
            "Principal Patroness of the Philippines"
        ),
        "rank": "solemnity",
    },
}


@lru_cache(maxsize=8)
def _load_year_calendar(year: int) -> dict[str, dict[str, Any]]:
    path = _DATA / f"philippines_calendar_{year}.json"
    if not path.is_file():
        return {}
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        logger.warning("Could not load PH calendar %s: %s", path, exc)
        return {}
    days = payload.get("days") if isinstance(payload, dict) else None
    if not isinstance(days, dict):
        return {}
    out: dict[str, dict[str, Any]] = {}
    for iso, row in days.items():
        if not isinstance(row, dict):
            continue
        title = str(row.get("title") or "").strip()
        if not title:
            continue
        out[str(iso)] = {
            "title": title,
            "rank": str(row.get("rank") or "memorial").strip().lower() or "memorial",
            "source_title": str(row.get("source_title") or title).strip(),
        }
    return out


def get_philippines_day(iso_date: str) -> Optional[dict[str, Any]]:
    """Return PH Proper entry for ``YYYY-MM-DD``, or None."""
    iso = (iso_date or "").strip()
    if len(iso) < 10:
        return None
    year_s, mmdd = iso[:4], iso[5:10]
    try:
        year = int(year_s)
    except ValueError:
        return None

    year_days = _load_year_calendar(year)
    if iso in year_days:
        entry = dict(year_days[iso])
        entry["calendar"] = "philippines"
        entry["date"] = iso
        return entry

    fixed = _NATIONAL_FIXED.get(mmdd)
    if not fixed:
        return None
    return {
        "title": fixed["title"],
        "rank": fixed["rank"],
        "source_title": fixed["title"],
        "calendar": "philippines",
        "date": iso,
        "fixed_national": True,
    }


def rank_weight(rank: str) -> int:
    return _RANK_WEIGHT.get((rank or "").strip().lower(), 0)


def apply_philippines_title(
    payload: Optional[dict[str, Any]],
    iso_date: str,
    *,
    prefer_philippines: bool = True,
) -> Optional[dict[str, Any]]:
    """
    Overlay Philippines Proper title onto a liturgical payload.

    When a curated year table exists, its titles replace the generic US title.
    For other years, only elevated national fixed feasts overlay.
    """
    if not payload or not prefer_philippines:
        return payload
    entry = get_philippines_day(iso_date)
    if not entry:
        return payload

    out = dict(payload)
    existing = str(out.get("title") or out.get("celebration") or "").strip()
    ph_title = str(entry["title"]).strip()
    if not ph_title:
        return payload

    year_table = not entry.get("fixed_national")
    if not year_table:
        # Fixed national overlay: only replace weak/generic titles, or always
        # replace when the PH feast is solemnity/feast.
        if rank_weight(str(entry.get("rank") or "")) < 70 and existing and not _title_looks_generic(existing):
            return payload

    if existing and existing != ph_title:
        out["title_generic"] = existing
    out["title"] = ph_title
    out["celebration"] = ph_title
    out["ph_calendar"] = {
        "title": ph_title,
        "rank": entry.get("rank"),
        "calendar": "philippines",
    }
    return out


def _title_looks_generic(title: str) -> bool:
    t = (title or "").strip().lower()
    if not t:
        return True
    if t.endswith(" celebration"):
        return True
    if "ordinary time" in t and "sunday" in t:
        return True
    if t.startswith(("monday of", "tuesday of", "wednesday of", "thursday of", "friday of", "saturday of")):
        return True
    return False
