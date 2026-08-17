"""Resolve the five Mass Divider copy fields from liturgical + wizard data."""

from __future__ import annotations

from typing import Any, Mapping, Optional

from services.mass_divider.types import HEADING_DEFAULT, MassDividerFields


def _clean(value: Any, *, fallback: str = "") -> str:
    text = str(value or "").strip()
    return text or fallback


def sunday_title_display(mass_title: str, season: str = "") -> str:
    title = _clean(mass_title) or _clean(season, fallback="Sunday Mass")
    title = title.replace(" Celebration", "").strip() or "Sunday Mass"
    return title


def resolve_mass_divider_fields(
    *,
    gospel_quote: str,
    gospel_reference: str,
    celebrant: str,
    date: str,
    lectionary_cycle: str,
    mass_title: str,
    season: str = "",
    co_celebrant: str = "",
    heading: Optional[str] = None,
) -> MassDividerFields:
    cycle = _clean(lectionary_cycle, fallback="—").upper()
    if cycle.startswith("YEAR "):
        cycle = cycle[5:].strip() or "—"
    return MassDividerFields(
        gospel_quote=_clean(gospel_quote),
        gospel_reference=_clean(gospel_reference, fallback="Gospel"),
        celebrant=_clean(celebrant, fallback="—"),
        co_celebrant=_clean(co_celebrant),
        year_cycle=cycle,
        mass_date=_clean(date),
        sunday_title=sunday_title_display(mass_title, season),
        heading=_clean(heading, fallback=HEADING_DEFAULT).upper(),
        season=_clean(season),
    )


def fields_from_liturgical_payload(
    data: Mapping[str, Any],
    *,
    date: str,
    celebrant: str,
    gospel_quote: str,
    co_celebrant: str = "",
    heading: Optional[str] = None,
) -> MassDividerFields:
    return resolve_mass_divider_fields(
        gospel_quote=gospel_quote,
        gospel_reference=str(data.get("gospel_reference") or ""),
        celebrant=celebrant,
        date=date,
        lectionary_cycle=str(data.get("lectionary_cycle") or ""),
        mass_title=str(data.get("title") or ""),
        season=str(data.get("season") or ""),
        co_celebrant=co_celebrant,
        heading=heading,
    )
