"""
Default Mass hymn picks: English + Tagalog only, 3 English + 2 Tagalog, no repeated ids.

Uses the local ``hymn_library.json`` catalog via ``section_candidates`` (no web fetch).
"""

from __future__ import annotations

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


def _first_unused(rows: list[dict[str, Any]], used: set[str], *, bucket: Optional[str] = None) -> Optional[dict[str, Any]]:
    for row in rows:
        if bucket and row.get("_bucket") != bucket:
            continue
        hid = str(row.get("id") or "").strip()
        if hid and hid not in used:
            return row
    return None


def default_song_selections_for_date(season_key: str) -> dict[str, str]:
    """
    Return ids for entrance, offertory, communion_1, communion_2, recessional.
    Pattern: 3× English (entrance, offertory, recessional) + 2× Tagalog (communion slots).
    Falls back to any EN/TL mix if pools are thin, still avoiding duplicate ids.
    """
    sk = (season_key or "ordinary_time").strip().lower().replace(" ", "_")
    sections = ("entrance", "offertory", "communion", "recessional")
    pools: dict[str, list[dict[str, Any]]] = {
        sec: _filter_en_tl(section_candidates(season_key=sk, section=sec, limit=80)) for sec in sections
    }

    used: set[str] = set()
    out: dict[str, str] = {}

    def take(sec: str, bucket: Optional[str]) -> Optional[str]:
        row = _first_unused(pools[sec], used, bucket=bucket)
        if not row:
            row = _first_unused(pools[sec], used, bucket=None)
        if not row:
            return None
        hid = str(row["id"]).strip()
        used.add(hid)
        return hid

    e = take("entrance", "en") or take("entrance", None)
    o = take("offertory", "en") or take("offertory", None)
    r = take("recessional", "en") or take("recessional", None)
    c1 = take("communion", "tl") or take("communion", "en") or take("communion", None)
    c2 = take("communion", "tl") or take("communion", "en") or take("communion", None)

    if e:
        out["entrance"] = e
    if o:
        out["offertory"] = o
    if r:
        out["recessional"] = r
    if c1:
        out["communion_1"] = c1
    if c2 and c2 != c1:
        out["communion_2"] = c2
    elif c1 and not c2:
        alt = _first_unused(pools["communion"], used, bucket=None)
        if alt:
            hid = str(alt["id"]).strip()
            if hid != c1:
                out["communion_2"] = hid
                used.add(hid)

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
    rows = _filter_en_tl(section_candidates(season_key=season_key, section=section, limit=80))
    scored: list[tuple[float, dict[str, Any]]] = []
    for idx, row in enumerate(rows):
        hid = str(row.get("id") or "").strip()
        if not hid or hid in used:
            continue
        moods = gospel_moods_for_song(row)
        match = _mood_match_score(moods, mood_key)
        has_lyrics = 1 if str(row.get("lyrics") or "").strip() else 0
        scored.append((match * 100 + has_lyrics * 10 - idx * 0.001, row))
    scored.sort(key=lambda t: t[0], reverse=True)
    picked: list[dict[str, Any]] = []
    for _, row in scored:
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

    def assign(slot: str, section: str) -> None:
        rows = _pick_mood_songs_for_section(section, mk, sk, 1, used)
        if rows:
            out[slot] = str(rows[0]["id"]).strip()

    assign("entrance", "entrance")
    assign("offertory", "offertory")
    assign("recessional", "recessional")

    communion_rows = _pick_mood_songs_for_section("communion", mk, sk, 2, used)
    if communion_rows:
        out["communion_1"] = str(communion_rows[0]["id"]).strip()
    if len(communion_rows) > 1:
        out["communion_2"] = str(communion_rows[1]["id"]).strip()

    return out


def default_song_selections_for_preview(season_key: str, preview: dict[str, Any]) -> dict[str, str]:
    """Gospel-mood-aware defaults with season-only fallback when mood picks are thin."""
    from services.gospel_mood import infer_gospel_mood_key_from_preview

    mood_key = infer_gospel_mood_key_from_preview(preview)
    picks = default_song_selections_for_gospel_mood(season_key, mood_key)
    if len(picks) >= 4:
        return picks
    fallback = default_song_selections_for_date(season_key)
    for slot, hid in fallback.items():
        picks.setdefault(slot, hid)
    return picks


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
