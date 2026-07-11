"""
Default Mass hymn picks ranked by Gospel mood (never first-in-section order).

Uses the local ``hymn_library.json`` catalog via ``section_candidates`` (no web fetch).
"""

from __future__ import annotations

import random
from typing import Any, Optional

from services.gospel_mood import GOSPEL_MOOD_KEYS, gospel_moods_for_song
from services.hymn_library import section_candidates

_GOSPEL_MOOD_RELATED: dict[str, tuple[str, ...]] = {
    "triumphant": ("reverent",),
    "solemn": ("reverent", "mercy"),
    "mercy": ("solemn", "reverent"),
    "journey": ("reverent", "mercy"),
    "reverent": ("solemn", "journey"),
}

_SLOT_SECTIONS: tuple[tuple[str, str], ...] = (
    ("entrance", "entrance"),
    ("offertory", "offertory"),
    ("recessional", "recessional"),
)


def _lang_bucket(lang: str) -> Optional[str]:
    s = (lang or "").strip().lower()
    if not s:
        return "en"
    if any(x in s for x in ("tagalog", "filipino", "pilipino")) or s in {"tl", "tgl", "fil"}:
        return "tl"
    if "english" in s or s in {"en", "eng"}:
        return "en"
    if any(
        x in s
        for x in (
            "korean",
            "latin",
            "spanish",
            "french",
            "italian",
            "german",
            "chinese",
            "japanese",
        )
    ):
        return None
    # Heuristic: default ambiguous titles to English for parish use
    return "en"


def _filter_en_tl(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for row in rows:
        b = _lang_bucket(str(row.get("language") or ""))
        if b is None:
            continue
        row = dict(row)
        row["_bucket"] = b
        out.append(row)
    return out


def _mood_match_score(song_moods: list[str], mood_key: str) -> int:
    if mood_key in song_moods:
        return 3
    related = _GOSPEL_MOOD_RELATED.get(mood_key, ())
    if any(m in song_moods for m in related):
        return 2
    return 1


def _pick_mood_songs_for_section(
    section: str,
    mood_key: str,
    season_key: str,
    count: int,
    used: set[str],
) -> list[dict[str, Any]]:
    """Pick hymns by gospel-mood match. Never prefers catalog order alone."""
    rows = _filter_en_tl(section_candidates(season_key=season_key, section=section, limit=80))
    scored: list[tuple[int, float, dict[str, Any]]] = []
    for row in rows:
        hid = str(row.get("id") or "").strip()
        if not hid or hid in used:
            continue
        moods = gospel_moods_for_song(row)
        match = _mood_match_score(moods, mood_key)
        has_lyrics = 1 if row.get("has_lyrics") or str(row.get("lyrics") or "").strip() else 0
        # Random jitter breaks catalog-order ties so we never land on "first song".
        jitter = random.random() * 0.5
        scored.append((match, has_lyrics + jitter, row))

    if not scored:
        return []

    # Prefer exact (3) then related (2); only use weak (1) if nothing better exists.
    best_match = max(t[0] for t in scored)
    min_match = 2 if best_match >= 2 else 1
    pool = [t for t in scored if t[0] >= min_match]
    pool.sort(key=lambda t: (t[0], t[1]), reverse=True)

    # Shuffle within the top match band so preload varies and isn't section[0].
    top_match = pool[0][0]
    top_band = [t for t in pool if t[0] == top_match]
    rest = [t for t in pool if t[0] != top_match]
    random.shuffle(top_band)
    ordered = top_band + rest

    picked: list[dict[str, Any]] = []
    for _match, _score, row in ordered:
        hid = str(row.get("id") or "").strip()
        if not hid or hid in used:
            continue
        picked.append(row)
        used.add(hid)
        if len(picked) >= count:
            break
    return picked


def default_song_selections_for_gospel_mood(season_key: str, mood_key: str) -> dict[str, str]:
    """
    Return ids for entrance, offertory, communion_1, communion_2, recessional
    ranked by how well each hymn's gospel_moods match the Sunday Gospel mood.
    """
    sk = (season_key or "ordinary_time").strip().lower().replace(" ", "_")
    mk = (mood_key or "reverent").strip().lower()
    if mk not in GOSPEL_MOOD_KEYS:
        mk = "reverent"

    used: set[str] = set()
    out: dict[str, str] = {}

    for slot, section in _SLOT_SECTIONS:
        rows = _pick_mood_songs_for_section(section, mk, sk, 1, used)
        if rows:
            out[slot] = str(rows[0]["id"]).strip()

    communion_rows = _pick_mood_songs_for_section("communion", mk, sk, 2, used)
    if communion_rows:
        out["communion_1"] = str(communion_rows[0]["id"]).strip()
    if len(communion_rows) > 1:
        out["communion_2"] = str(communion_rows[1]["id"]).strip()

    return out


def default_song_selections_for_preview(season_key: str, preview: dict[str, Any]) -> dict[str, str]:
    """Gospel-mood defaults only — never falls back to first-in-section catalog order."""
    from services.gospel_mood import infer_gospel_mood_key_from_preview

    mood_key = infer_gospel_mood_key_from_preview(preview)
    return default_song_selections_for_gospel_mood(season_key, mood_key)


def default_song_selections_for_date(season_key: str, mood_key: str = "reverent") -> dict[str, str]:
    """
    Season defaults for generation when no user picks exist.

    Historically this returned the first EN/TL hymn per section. That caused Music
    Ministry to preload catalog-head songs. It now always uses gospel-mood ranking.
    """
    return default_song_selections_for_gospel_mood(season_key, mood_key or "reverent")


def filter_songs_rows_en_tl_only(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Drop non English/Tagalog rows (for preview lists when enforcing bilingual catalog)."""
    clean: list[dict[str, Any]] = []
    for row in rows:
        if _lang_bucket(str(row.get("language") or "")) is None:
            continue
        r = dict(row)
        r.pop("_bucket", None)
        clean.append(r)
    return clean
