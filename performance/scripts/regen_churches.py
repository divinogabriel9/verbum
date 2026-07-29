#!/usr/bin/env python3
"""Regenerate performance/data/churches.json from hymn library (deterministic seed)."""

from __future__ import annotations

import json
import random
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SONGS_PATH = ROOT / "performance" / "data" / "songs.json"
OUT_PATH = ROOT / "performance" / "data" / "churches.json"
HYMN_PATH = ROOT / "data" / "hymn_library.json"


def main() -> None:
    random.seed(42)
    hymn = json.loads(HYMN_PATH.read_text())
    songs: dict[str, list[dict]] = {}
    for sec, rows in hymn.items():
        if not isinstance(rows, list):
            continue
        songs[sec] = [
            {
                "id": r.get("id"),
                "title": r.get("title"),
                "language": r.get("language") or "English",
            }
            for r in rows
            if isinstance(r, dict) and r.get("id")
        ]
    SONGS_PATH.parent.mkdir(parents=True, exist_ok=True)
    SONGS_PATH.write_text(json.dumps(songs, indent=2) + "\n")

    countries = [
        ("Philippines", "PH", "Asia/Manila", ["english", "tagalog"]),
        ("South Korea", "KR", "Asia/Seoul", ["english", "korean"]),
        ("Malaysia", "MY", "Asia/Kuala_Lumpur", ["english", "malay"]),
        ("United States", "US", "America/Chicago", ["english"]),
        ("Canada", "CA", "America/Toronto", ["english"]),
        ("Australia", "AU", "Australia/Sydney", ["english"]),
        ("Singapore", "SG", "Asia/Singapore", ["english"]),
        ("Indonesia", "ID", "Asia/Jakarta", ["english"]),
        ("India", "IN", "Asia/Kolkata", ["english"]),
        ("Ireland", "IE", "Europe/Dublin", ["english"]),
    ]
    name_a = [
        "Holy",
        "St.",
        "Our Lady of",
        "Sacred",
        "Divine",
        "Blessed",
        "Immaculate",
        "Good Shepherd",
        "Corpus Christi",
        "Christ the King",
    ]
    name_b = [
        "Family",
        "Rosary",
        "Heart",
        "Cross",
        "Mercy",
        "Hope",
        "Peace",
        "Grace",
        "Light",
        "Redeemer",
        "Assumption",
        "Guadalupe",
        "Lourdes",
        "Fatima",
        "Therese",
        "Joseph",
        "Mary",
        "Peter",
        "Paul",
        "Anthony",
    ]
    cities = [
        "Manila",
        "Cebu",
        "Davao",
        "Seoul",
        "Busan",
        "Kuala Lumpur",
        "Penang",
        "Chicago",
        "Houston",
        "Toronto",
        "Sydney",
        "Melbourne",
        "Singapore",
        "Jakarta",
        "Mumbai",
        "Dublin",
        "Quezon City",
        "Iloilo",
        "Cagayan de Oro",
        "Bacolod",
    ]
    themes = ["liturgical_color", "classic_white"]
    divider_styles = ["divider1", "divider2"]
    lotw = ["lotw1", "lotw2", "lotw3", "lotw4"]
    lote = ["lote1", "lote2", "lote3", "lote4"]
    ai_styles = ["cinematic", "stained_glass", "oil_painting", "watercolor", "iconographic"]
    ai_backends = ["openai", "gemini"]
    mass_types = [
        "Sunday Mass",
        "Anticipated Mass",
        "Weekday Mass",
        "Solemnity",
        "Feast Day",
        "Vigil Mass",
        "Wedding Mass",
        "Funeral Mass",
    ]
    seasons = ["Ordinary Time", "Advent", "Christmas", "Lent", "Easter", "Pentecost"]
    priest_first = ["Fr.", "Rev.", "Msgr."]
    priest_names = [
        "Gabriel",
        "Antonio",
        "Miguel",
        "Juan",
        "Pedro",
        "James",
        "Thomas",
        "Andrew",
        "Francis",
        "Joseph",
        "Paul",
        "Mark",
        "Luke",
        "David",
        "Daniel",
        "Matthew",
        "Stephen",
        "Philip",
        "Carlos",
        "Rafael",
        "Emmanuel",
        "Benedict",
        "Xavier",
        "Vincent",
    ]
    priest_last = [
        "Santos",
        "Reyes",
        "Cruz",
        "Garcia",
        "Lopez",
        "Torres",
        "Mendoza",
        "Navarro",
        "Kim",
        "Park",
        "Lee",
        "Tan",
        "Lim",
        "Chong",
        "Okafor",
        "Murphy",
        "Kelly",
        "Nguyen",
        "Silva",
        "Fernandez",
    ]
    roles = ["media_officer", "choir_leader", "secretary", "priest"]

    def pick_song(sec: str):
        pool = songs.get(sec) or []
        return random.choice(pool)["id"] if pool else None

    churches = []
    for i in range(1, 321):
        country, cc, tz, langs = random.choice(countries)
        lang = random.choice(langs)
        month = random.randint(1, 12)
        day = random.choice([5, 6, 12, 13, 19, 20, 26, 27])
        if month == 2 and day > 28:
            day = 22
        mass_date = f"2026-{month:02d}-{day:02d}"
        celebrants = [
            f"{random.choice(priest_first)} {random.choice(priest_names)} {random.choice(priest_last)}"
            for _ in range(random.randint(1, 3))
        ]
        churches.append(
            {
                "id": f"church_{i:04d}",
                "name": f"{random.choice(name_a)} {random.choice(name_b)} Parish",
                "country": country,
                "country_code": cc,
                "city": random.choice(cities),
                "timezone": tz,
                "language": lang,
                "mass_language": "tagalog" if lang == "tagalog" else "english",
                "our_father_choice": (
                    "tagalog"
                    if lang == "tagalog"
                    else "malay"
                    if lang == "malay"
                    else "korean"
                    if lang == "korean"
                    else "english"
                ),
                "theme": random.choice(themes),
                "divider_style": random.choice(divider_styles),
                "lotw_poster": random.choice(lotw),
                "lote_poster": random.choice(lote),
                "ai_poster_style": random.choice(ai_styles),
                "ai_poster_backend": random.choice(ai_backends),
                "celebrants": celebrants,
                "mass_type": random.choice(mass_types),
                "liturgical_season": random.choice(seasons),
                "preferred_role": random.choice(roles),
                "mass_date": mass_date,
                "creed_choice": random.choice(["nicene", "apostles"]),
                "songs": {
                    "entrance": pick_song("entrance"),
                    "offertory": pick_song("offertory"),
                    "communion_1": pick_song("communion"),
                    "communion_2": pick_song("communion"),
                    "recessional": pick_song("recessional"),
                    "meditation": pick_song("meditation") if random.random() < 0.35 else None,
                },
                "include_church_logo": random.random() < 0.4,
                "include_church_name": random.random() < 0.7,
                "include_gospel_art": random.random() < 0.8,
            }
        )

    OUT_PATH.write_text(json.dumps(churches, indent=2) + "\n")
    print(f"Wrote {len(churches)} churches → {OUT_PATH}")
    print(f"Wrote song catalog → {SONGS_PATH}")


if __name__ == "__main__":
    main()
