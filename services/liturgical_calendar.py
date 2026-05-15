"""
Liturgical season colors (Roman Rite, calendar day — not hour of prayer).

Used for posters and slides. Seasons follow common US calendar practice;
Christmas Time ends with the Baptism of the Lord; Lent through Holy Saturday;
Easter (white) from Easter Sunday through the day before Pentecost; Pentecost
Sunday is red.
"""

from __future__ import annotations

import datetime as _dt
from typing import TypedDict, Union

from core.liturgical_calendar import first_sunday_of_advent

DateInput = Union[_dt.date, str]


class LiturgicalColor(TypedDict):
    """Color payload for UI, print, and python-pptx (RGB 0–255)."""

    season: str
    """Machine key: advent | christmas | lent | easter | ordinary_time | pentecost."""

    color_name: str
    """Human label matching the liturgical color."""

    hex: str
    """SRGB hex for web/posters."""

    rgb: tuple[int, int, int]
    """RGB tuple for python-pptx or other renderers."""


def _parse_date(date: DateInput) -> _dt.date:
    if isinstance(date, _dt.date):
        return date
    s = str(date).strip()
    return _dt.datetime.strptime(s, "%Y-%m-%d").date()


def _easter_sunday(year: int) -> _dt.date:
    """Western Easter (Gregorian calendar), Anonymous Gregorian algorithm."""
    a = year % 19
    b = year // 100
    c = year % 100
    d = b // 4
    e = b % 4
    f = (b + 8) // 25
    g = (b - f + 1) // 3
    h = (19 * a + b - d - g + 15) % 30
    i = c // 4
    k = c % 4
    ell = (32 + 2 * e + 2 * i - h - k) % 7
    m = (a + 11 * h + 22 * ell) // 451
    month = (h + ell - 7 * m + 114) // 31
    day = ((h + ell - 7 * m + 114) % 31) + 1
    return _dt.date(year, month, day)


def _epiphany_sunday(year: int) -> _dt.date:
    """US norm: Epiphany of the Lord on the Sunday from Jan 2 through Jan 8."""
    for dom in range(2, 9):
        d = _dt.date(year, 1, dom)
        if d.weekday() == 6:
            return d
    return _dt.date(year, 1, 6)


def _baptism_of_the_lord(year: int) -> _dt.date:
    """End of Christmas Time (inclusive) for color purposes."""
    ep = _epiphany_sunday(year)
    if ep.day >= 7:
        return ep + _dt.timedelta(days=1)
    return ep + _dt.timedelta(days=7)


def _ash_wednesday(year: int) -> _dt.date:
    return _easter_sunday(year) - _dt.timedelta(days=46)


def _pentecost_sunday(year: int) -> _dt.date:
    return _easter_sunday(year) + _dt.timedelta(days=49)


def _advent_start(year: int) -> _dt.date:
    return first_sunday_of_advent(year)


def _in_christmas_season(d: _dt.date) -> bool:
    """Dec 25 through Baptism of the Lord (January), same liturgical Christmas."""
    if d.month == 12 and d.day >= 25:
        return True
    if d.month == 1:
        return d <= _baptism_of_the_lord(d.year)
    return False


def _palette(name: str) -> tuple[str, tuple[int, int, int]]:
    if name == "purple":
        return ("#5C3D8C", (92, 61, 140))
    if name == "white":
        return ("#F2F0E8", (242, 240, 232))
    if name == "green":
        return ("#2D6A3E", (45, 106, 62))
    if name == "red":
        return ("#B22222", (178, 34, 34))
    return ("#808080", (128, 128, 128))


def get_liturgical_color(date: DateInput) -> LiturgicalColor:
    """
    Return the liturgical color for the given civil date.

    Mapping (simplified Roman Rite calendar day):
        Advent          → Purple
        Christmas       → White
        Lent            → Purple
        Easter          → White
        Ordinary Time   → Green
        Pentecost       → Red
    """
    d = _parse_date(date)
    y = d.year

    pentecost = _pentecost_sunday(y)
    easter = _easter_sunday(y)
    ash = _ash_wednesday(y)
    holy_saturday = easter - _dt.timedelta(days=1)

    if d == pentecost:
        hx, rgb = _palette("red")
        return LiturgicalColor(
            season="pentecost",
            color_name="Red",
            hex=hx,
            rgb=rgb,
        )

    if easter <= d < pentecost:
        hx, rgb = _palette("white")
        return LiturgicalColor(
            season="easter",
            color_name="White",
            hex=hx,
            rgb=rgb,
        )

    if ash <= d <= holy_saturday:
        hx, rgb = _palette("purple")
        return LiturgicalColor(
            season="lent",
            color_name="Purple",
            hex=hx,
            rgb=rgb,
        )

    if _in_christmas_season(d):
        hx, rgb = _palette("white")
        return LiturgicalColor(
            season="christmas",
            color_name="White",
            hex=hx,
            rgb=rgb,
        )

    advent_start = _advent_start(y)
    if advent_start <= d <= _dt.date(y, 12, 24):
        hx, rgb = _palette("purple")
        return LiturgicalColor(
            season="advent",
            color_name="Purple",
            hex=hx,
            rgb=rgb,
        )

    hx, rgb = _palette("green")
    return LiturgicalColor(
        season="ordinary_time",
        color_name="Green",
        hex=hx,
        rgb=rgb,
    )
