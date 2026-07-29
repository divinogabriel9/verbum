"""Philippines Proper calendar title overlay."""

from __future__ import annotations

import unittest

from services.calendar_month import summarize_day
from services.ph_calendar import apply_philippines_title, get_philippines_day


class PhCalendarTests(unittest.TestCase):
    def test_ph_2026_key_national_feasts(self) -> None:
        black = get_philippines_day("2026-01-09")
        assert black is not None
        self.assertIn("Black Nazarene", black["title"])
        self.assertEqual(black["rank"], "feast")

        santo = get_philippines_day("2026-01-18")
        assert santo is not None
        self.assertIn("Santo Niño", santo["title"])
        self.assertEqual(santo["rank"], "feast")

        lorenzo = get_philippines_day("2026-09-28")
        assert lorenzo is not None
        self.assertTrue(
            "Laurence Ruiz" in lorenzo["title"] or "Lorenzo" in lorenzo["title"]
        )

        calungsod = get_philippines_day("2026-10-21")
        assert calungsod is not None
        self.assertIn("Pedro Calungsod", calungsod["title"])

        ic = get_philippines_day("2026-12-08")
        assert ic is not None
        self.assertIn("Principal Patroness of the Philippines", ic["title"])
        self.assertEqual(ic["rank"], "solemnity")

    def test_ph_2026_covers_full_year(self) -> None:
        self.assertEqual(get_philippines_day("2026-02-18")["title"], "Ash Wednesday")
        self.assertIn("18th Sunday", get_philippines_day("2026-08-02")["title"])
        self.assertTrue(
            get_philippines_day("2026-05-28")["title"].startswith(
                "Our Lord Jesus Christ"
            )
        )

    def test_fixed_national_fallback_other_years(self) -> None:
        entry = get_philippines_day("2027-01-09")
        assert entry is not None
        self.assertTrue(entry.get("fixed_national"))
        self.assertIn("Black Nazarene", entry["title"])

    def test_apply_philippines_title_overlays_payload(self) -> None:
        payload = {
            "title": "Monday of the Seventeenth Week in Ordinary Time",
            "celebration": "x",
        }
        out = apply_philippines_title(payload, "2026-01-09")
        assert out is not None
        self.assertIn("Black Nazarene", out["title"])
        self.assertEqual(out["ph_calendar"]["rank"], "feast")
        self.assertTrue(out.get("title_generic"))

    def test_calendar_month_summary_uses_ph_title(self) -> None:
        day = summarize_day("2026-01-18", language="english")
        self.assertIn("Santo Niño", day.get("title") or "")
        self.assertEqual(day.get("calendar_region"), "philippines")
        self.assertEqual(day.get("language"), "english")

    def test_tagalog_calendar_skips_english_ph_overlay(self) -> None:
        day = summarize_day("2026-01-18", language="tagalog")
        self.assertEqual(day.get("language"), "tagalog")
        self.assertNotEqual(day.get("calendar_region"), "philippines")
        # Without Tagalog cache, title may be empty — must not force PH English title.
        title = day.get("title") or ""
        self.assertNotIn("Santo Niño", title)


if __name__ == "__main__":
    unittest.main()
