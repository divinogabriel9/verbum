"""Unit tests for Mass habit scoring (no DB)."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from services.mass_habits import compute_smart_defaults, snapshot_from_generate


def _row(habits: dict, *, days_ago: int = 1) -> dict:
    created = datetime.now(timezone.utc) - timedelta(days=days_ago)
    return {
        "created_at": created.isoformat(),
        "output_summary": {"habits": habits},
    }


def test_snapshot_normalizes_choices():
    snap = snapshot_from_generate(
        songs={"entrance": "e1", "communion_1": "c1"},
        creed_choice="APOSTLES",
        our_father_choice="Tagalog",
        hymn_lyrics_layout="SINGLE",
        include_church_logo=True,
        lotw_poster="lotw3",
        celebrant="Fr. Jose",
        season="Ordinary Time",
        gospel_mood="Mercy",
    )
    assert snap["creed_choice"] == "apostles"
    assert snap["our_father_choice"] == "tagalog"
    assert snap["hymn_lyrics_layout"] == "single"
    assert snap["include_church_logo"] is True
    assert snap["lotw_poster"] == "lotw3"
    assert snap["songs"]["entrance"] == "e1"
    assert snap["season"] == "ordinary_time"
    assert snap["gospel_mood"] == "mercy"


def test_compute_prefers_repeated_user_habits():
    base = snapshot_from_generate(
        songs={"entrance": "holy-god", "communion_1": "one-bread"},
        creed_choice="nicene",
        our_father_choice="tagalog",
        hymn_lyrics_layout="dual",
        include_church_logo=True,
        include_church_name=True,
        lotw_poster="lotw2",
        lote_poster="lote2",
        celebrant="Fr. Ana",
        season="ordinary_time",
        gospel_mood="reverent",
    )
    rows = [_row(base, days_ago=i) for i in (1, 3, 7, 10)]
    out = compute_smart_defaults(
        user_rows=rows,
        parish_rows=[],
        season="ordinary_time",
        gospel_mood="reverent",
        seasonal_songs={"entrance": "seasonal-fallback"},
    )
    assert out["has_habits"] is True
    sug = out["suggestions"]
    assert sug["creed_choice"] == "nicene"
    assert sug["our_father_choice"] == "tagalog"
    assert sug["include_church_logo"] is True
    assert sug["songs"]["entrance"] == "holy-god"
    assert out["confidence"]["songs"]["entrance"]["source"] == "user"


def test_user_habits_outrank_parish():
    user_habit = snapshot_from_generate(
        creed_choice="apostles",
        our_father_choice="english",
        season="lent",
    )
    parish_habit = snapshot_from_generate(
        creed_choice="nicene",
        our_father_choice="tagalog",
        season="lent",
    )
    user_rows = [_row(user_habit, days_ago=i) for i in (1, 2, 4)]
    parish_rows = [_row(parish_habit, days_ago=i) for i in (1, 2, 3, 5)]
    out = compute_smart_defaults(
        user_rows=user_rows,
        parish_rows=parish_rows,
        season="lent",
    )
    assert out["suggestions"]["creed_choice"] == "apostles"
    assert out["confidence"]["creed_choice"]["source"] == "user"


def test_insufficient_samples_yields_no_enum_habit():
    habit = snapshot_from_generate(creed_choice="apostles", season="easter")
    out = compute_smart_defaults(
        user_rows=[_row(habit, days_ago=1)],
        parish_rows=[],
        season="easter",
        seasonal_songs={"entrance": "easter-song"},
    )
    assert "creed_choice" not in out["suggestions"]
    assert out["suggestions"]["songs"]["entrance"] == "easter-song"
    assert out["confidence"]["songs"]["entrance"]["source"] == "seasonal"
