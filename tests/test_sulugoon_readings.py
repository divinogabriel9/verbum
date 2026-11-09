"""Sulugoon Cebuano readings parser / language wiring."""

from __future__ import annotations

from pathlib import Path

from services.lectionary_service import fetch_cebuano_liturgical_data
from services.mass_language import readings_language_for
from services.sulugoon_readings import parse_sulugoon_html

_FIXTURE = Path(__file__).resolve().parent / "fixtures" / "sulugoon_2026-11-08.html"


def test_parse_sulugoon_html_fixture_is_cebuano_not_english():
    html = _FIXTURE.read_text(encoding="utf-8")
    entry = parse_sulugoon_html(
        html,
        source_url="https://sulugoon.com/readings/2026/11/08/",
    )
    assert "Ginoo" in entry["psalm_response"] or "Ginoo" in entry["psalm_text"]
    assert "Si Jesus" in entry["gospel"] or "Gingharian" in entry["gospel"]
    assert "Glory to God" not in entry["gospel"]
    assert "The Lord" not in entry["first_reading"]
    assert entry["first_reading_ref"]
    assert entry["gospel_ref"]
    assert len(entry["gospel"]) >= 40
    assert len(entry["first_reading"]) >= 20


def test_fetch_cebuano_uses_cache_without_network(monkeypatch):
    html = _FIXTURE.read_text(encoding="utf-8")
    entry = parse_sulugoon_html(html, source_url="https://example.test/ceb/")

    monkeypatch.setattr(
        "services.sulugoon_readings.fetch_cebuano_readings_for_date",
        lambda date, **_kwargs: entry,
    )
    payload = fetch_cebuano_liturgical_data("2026-11-08")
    assert payload["readings_language"] == "cebuano"
    assert readings_language_for("cebuano") == "cebuano"
    gospel = payload.get("gospel_text") or payload.get("gospel") or ""
    assert "Si Jesus" in gospel or "Gingharian" in gospel
    assert "A reading from" not in gospel
