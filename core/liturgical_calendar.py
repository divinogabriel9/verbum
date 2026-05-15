"""Roman Rite Sunday lectionary cycle (Years A / B / C) from the civil date.

The cycle advances at the First Sunday of Advent. Anchor: Advent 2022 → Year A.
"""

from __future__ import annotations

import datetime


def first_sunday_of_advent(calendar_year: int) -> datetime.date:
    """First Sunday of Advent falls on a Sunday from Nov 27 through Dec 3 (inclusive)."""
    for month, day in (
        (11, 27),
        (11, 28),
        (11, 29),
        (11, 30),
        (12, 1),
        (12, 2),
        (12, 3),
    ):
        d = datetime.date(calendar_year, month, day)
        if d.weekday() == 6:  # Sunday
            return d
    raise ValueError(f"No Advent Sunday found for calendar year {calendar_year}")


def sunday_lectionary_cycle(on_date: datetime.date) -> str:
    """Return 'A', 'B', or 'C' for the Sunday Lectionary cycle containing on_date."""
    y = on_date.year
    advent_this_year = first_sunday_of_advent(y)
    if on_date >= advent_this_year:
        start_year = y
    else:
        start_year = y - 1
    idx = (start_year - 2022) % 3
    return ("A", "B", "C")[idx]
