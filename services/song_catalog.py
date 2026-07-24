"""Song catalog helpers for section-based hymn library storage."""

from __future__ import annotations

import json
import re
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Optional

from services.gospel_mood import gospel_moods_for_song, normalize_gospel_moods
from services.hymn_catalog_store import (
    catalog_library_path,
    catalog_revision,
    catalog_sections,
    invalidate_catalog_cache,
    load_catalog_dict,
    save_catalog_dict,
)
from services.hymn_library import invalidate_library_cache

_PROJECT_ROOT = Path(__file__).resolve().parents[1]
_LIBRARY_PATH = catalog_library_path()
_SECTIONS = catalog_sections()
_PART_MAP = {
    "entrance": "entrance",
    "offertory": "offertory",
    "communion": "communion",
    "recessional": "recessional",
    "meditation": "meditation",
}

_catalog_api_cache: dict[bool, tuple[float, dict[str, list[dict[str, Any]]]]] = {}
_CATALOG_API_TTL_S = 120.0
_catalog_lite_bytes: Optional[bytes] = None
_catalog_lite_etag: str = ""
_catalog_lite_mtime: float = 0.0


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _stamp_song_timestamps(row: dict[str, Any], *, is_new: bool) -> None:
    """Set added_at (create) and updated_at (always) on a catalog song row."""
    now = _now_iso()
    if is_new or not str(row.get("added_at") or "").strip():
        row["added_at"] = now
    row["updated_at"] = now


def _invalidate_catalog_api_cache() -> None:
    global _catalog_lite_bytes, _catalog_lite_etag, _catalog_lite_mtime
    _catalog_api_cache.clear()
    _catalog_lite_bytes = None
    _catalog_lite_etag = ""
    _catalog_lite_mtime = 0.0


def _explicit_gospel_moods(item: dict[str, Any]) -> list[str]:
    return normalize_gospel_moods(item.get("gospel_moods"))


def _blank_library() -> dict[str, list[dict[str, Any]]]:
    return {k: [] for k in _SECTIONS}


def load_catalog() -> dict[str, list[dict[str, Any]]]:
    return load_catalog_dict()


def save_catalog(
    data: dict[str, list[dict[str, Any]]],
    *,
    updated_by: str | None = None,
    sync_song_ids: set[str] | frozenset[str] | None = None,
) -> None:
    save_catalog_dict(data, updated_by=updated_by, sync_song_ids=sync_song_ids)
    invalidate_library_cache()
    invalidate_catalog_cache()
    _invalidate_catalog_api_cache()


def make_song_id(title: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "_", (title or "").strip().lower()).strip("_")
    if not slug:
        slug = "song"
    return slug[:72]


def format_song_title_case(title: str) -> str:
    text = " ".join(str(title or "").split())
    if not text:
        return ""
    return " ".join(part.capitalize() for part in text.split(" "))


def _capitalize_first_alpha(token: str) -> str:
    """Uppercase the first alphabetic character of an already-lowercased token."""
    if not token:
        return token
    for i, ch in enumerate(token):
        if ch.isalpha():
            return token[:i] + ch.upper() + token[i + 1 :]
    return token


def format_lyrics_first_letters(lyrics: str) -> str:
    """
    Premiumize lyric text in two steps so nothing is left out:
      1) lowercase the entire text
      2) uppercase the first letter of every word on every line
    Preserves newlines and leading indent.
    """
    text = str(lyrics or "").replace("\r\n", "\n").replace("\r", "\n")
    if not text.strip():
        return text.strip()
    # Step 1 — lowercase everything first.
    text = text.lower()
    out_lines: list[str] = []
    for line in text.split("\n"):
        if not line.strip():
            out_lines.append("")
            continue
        lead_len = len(line) - len(line.lstrip(" \t"))
        lead = line[:lead_len]
        body = line[lead_len:]
        # Step 2 — uppercase the first letter of each word.
        parts = body.split(" ")
        out_lines.append(lead + " ".join(_capitalize_first_alpha(p) for p in parts))
    return "\n".join(out_lines).strip()


_CHORUS_HEADER_RE = re.compile(
    r"^([\[(]?\s*)chorus(\s*[\w\d.-]*)?(\s*[\])]?\s*[:.)-]?)\s*$",
    re.IGNORECASE,
)


def normalize_lyric_section_headers(lyrics: str) -> str:
    """Keep Verse 1/2/3; collapse Chorus 1/2/3 (and Refrain N) to plain Chorus/Refrain."""
    text = str(lyrics or "").replace("\r\n", "\n").replace("\r", "\n")
    if not text.strip():
        return text.strip()
    out: list[str] = []
    for line in text.split("\n"):
        stripped = line.strip()
        m = _CHORUS_HEADER_RE.match(stripped)
        if m:
            # Preserve bracket style if present: [Chorus] / (Chorus) / Chorus
            open_b = (m.group(1) or "").strip()
            close_b = (m.group(3) or "").strip()
            if open_b.startswith("[") or close_b.startswith("]"):
                out.append("[Chorus]")
            elif open_b.startswith("(") or close_b.startswith(")"):
                out.append("(Chorus)")
            else:
                out.append("Chorus")
            continue
        out.append(line.rstrip())
    return "\n".join(out).replace("\n\n\n", "\n\n").strip()


def polish_lyrics_text(lyrics: str) -> str:
    """Section breaks + header cleanup + first-letter capitalization for saved lyrics."""
    from services.mass_text_format import ensure_lyric_section_breaks

    spaced = ensure_lyric_section_breaks(lyrics)
    return format_lyrics_first_letters(normalize_lyric_section_headers(spaced))


def reformat_all_catalog_lyrics(*, updated_by: str | None = None) -> dict[str, Any]:
    """
    Scan every catalog song and rewrite lyrics with polished casing / chorus headers.
    Persists via save_catalog (local + Supabase when configured).
    """
    data = load_catalog()
    changed_ids: set[str] = set()
    scanned = 0
    updated = 0
    skipped_empty = 0
    per_section: dict[str, int] = {}

    for sec in _SECTIONS:
        rows = data.get(sec) or []
        local = 0
        for item in rows:
            if not isinstance(item, dict):
                continue
            hid = str(item.get("id") or "").strip()
            raw = str(item.get("lyrics") or "")
            if not raw.strip():
                skipped_empty += 1
                continue
            scanned += 1
            polished = polish_lyrics_text(raw)
            if polished == raw.replace("\r\n", "\n").replace("\r", "\n").strip():
                continue
            item["lyrics"] = polished
            updated += 1
            local += 1
            if hid:
                changed_ids.add(hid)
        if local:
            per_section[sec] = local

    if changed_ids:
        # updated_by must be a UUID when set (Supabase column); omit for batch jobs.
        save_catalog(data, updated_by=updated_by, sync_song_ids=changed_ids)

    return {
        "ok": True,
        "scanned": scanned,
        "updated": updated,
        "skipped_empty": skipped_empty,
        "per_section": per_section,
        "song_ids": sorted(changed_ids),
    }


def import_titles(grouped_titles: dict[str, list[str]]) -> dict[str, Any]:
    """Upsert section-grouped song titles into the local hymn catalog."""
    data = load_catalog()
    added = 0
    existing = 0
    per_section: dict[str, int] = {}
    for sec, titles in grouped_titles.items():
        section = str(sec).strip().lower()
        if section not in _SECTIONS:
            continue
        rows = data[section]
        by_title = {str(r.get("title") or "").strip().lower(): r for r in rows}
        by_id = {str(r.get("id") or "").strip(): r for r in rows}
        local_added = 0
        for t in titles or []:
            title = str(t).strip()
            if not title:
                continue
            ttl = title.lower()
            if ttl in by_title:
                existing += 1
                continue
            hid_base = make_song_id(title)
            hid = hid_base
            n = 2
            while hid in by_id:
                hid = f"{hid_base}_{n}"
                n += 1
            row = {
                "id": hid,
                "title": title,
                "author": "",
                "language": "English",
                "seasons": ["all"],
                "lyrics": "",
            }
            rows.append(row)
            by_title[ttl] = row
            by_id[hid] = row
            added += 1
            local_added += 1
        per_section[section] = local_added
    save_catalog(data)
    return {"added": added, "existing": existing, "per_section": per_section}


def import_song_rows(rows: list[dict[str, Any]]) -> dict[str, Any]:
    """
    Import rows in the shape:
      {"title": str, "language": str, "mass_part": [str, ...]}
    Ignore duplicates by title (global, case-insensitive).
    """
    data = load_catalog()
    all_titles = set()
    for sec in _SECTIONS:
        for item in data.get(sec, []):
            all_titles.add(str(item.get("title") or "").strip().lower())

    added = 0
    existing = 0
    per_section: dict[str, int] = {k: 0 for k in _SECTIONS}

    # id index for uniqueness
    by_id = set()
    for sec in _SECTIONS:
        for item in data.get(sec, []):
            by_id.add(str(item.get("id") or "").strip())

    for raw in rows or []:
        if not isinstance(raw, dict):
            continue
        title = str(raw.get("title") or "").strip()
        if not title:
            continue
        ttl = title.lower()
        if ttl in all_titles:
            existing += 1
            continue
        language = str(raw.get("language") or "English").strip() or "English"
        parts = raw.get("mass_part") or []
        if not isinstance(parts, list):
            parts = [parts]
        sections: list[str] = []
        for p in parts:
            key = str(p or "").strip().lower()
            sec = _PART_MAP.get(key)
            if sec and sec not in sections:
                sections.append(sec)
        if not sections:
            continue

        hid_base = make_song_id(title)
        hid = hid_base
        n = 2
        while hid in by_id:
            hid = f"{hid_base}_{n}"
            n += 1
        by_id.add(hid)

        row = {
            "id": hid,
            "title": title,
            "author": "",
            "language": language,
            "seasons": ["all"],
            "lyrics": "",
        }
        for sec in sections:
            data[sec].append(dict(row))
            per_section[sec] += 1
        all_titles.add(ttl)
        added += 1

    save_catalog(data)
    return {"added": added, "existing": existing, "per_section": per_section}


def update_lyrics(section: str, hymn_id: str, lyrics: str, source_link: str = "") -> bool:
    """Store fetched lyrics for a section/id pair."""
    sec = (section or "").strip().lower()
    hid = (hymn_id or "").strip()
    lyr = (lyrics or "").strip()
    if sec not in _SECTIONS or not hid or not lyr:
        return False
    data = load_catalog()
    changed = False
    for item in data.get(sec) or []:
        if str(item.get("id") or "").strip() != hid:
            continue
        item["lyrics"] = polish_lyrics_text(lyr)
        if source_link:
            item["text_link"] = source_link
        changed = True
        break
    if changed:
        save_catalog(data)
    return changed


def _normalize_catalog_seasons(raw: list[str] | None) -> list[str]:
    allowed = {
        "all",
        "ordinary_time",
        "advent",
        "christmas",
        "lent",
        "easter",
        "pentecost",
    }
    aliases = {"ordinary": "ordinary_time", "ot": "ordinary_time"}
    out: list[str] = []
    for item in raw or []:
        key = re.sub(r"[\s-]+", "_", str(item or "").strip().lower())
        key = aliases.get(key, key)
        if key == "ordinary":
            key = "ordinary_time"
        if key in allowed and key not in out:
            out.append(key)
    return out or ["all"]


def save_lyrics_song(
    *,
    title: str,
    lyrics: str,
    sections: list[str],
    language: str = "English",
    author: str = "",
    gospel_moods: list[str] | None = None,
    seasons: list[str] | None = None,
    updated_by: str | None = None,
) -> dict[str, Any]:
    """Upsert a full lyric text into one or more local hymn catalog sections."""
    clean_title = format_song_title_case(str(title or ""))
    clean_lyrics = polish_lyrics_text(str(lyrics or ""))
    if not clean_title or not clean_lyrics:
        return {"ok": False, "error": "Song title and lyrics are required."}

    wanted = []
    for raw in sections or []:
        sec = str(raw or "").strip().lower()
        if sec in _SECTIONS and sec not in wanted:
            wanted.append(sec)
    if not wanted:
        wanted = ["meditation"]

    season_tags = _normalize_catalog_seasons(seasons) if seasons is not None else None

    data = load_catalog()
    hid_base = make_song_id(clean_title)
    updated: list[str] = []
    created: list[str] = []
    canonical_ids: set[str] = set()

    for sec in wanted:
        rows = data[sec]
        target = None
        for row in rows:
            row_title = str(row.get("title") or "").strip().lower()
            row_id = str(row.get("id") or "").strip()
            if row_title == clean_title.lower() or row_id == hid_base:
                target = row
                break

        if target is None:
            existing_ids = {str(row.get("id") or "").strip() for row in rows}
            hid = hid_base
            n = 2
            while hid in existing_ids:
                hid = f"{hid_base}_{n}"
                n += 1
            target = {
                "id": hid,
                "title": clean_title,
                "author": "",
                "language": str(language or "English").strip() or "English",
                "seasons": season_tags if season_tags is not None else ["all"],
            }
            rows.append(target)
            created.append(sec)
        else:
            updated.append(sec)

        target["lyrics"] = clean_lyrics
        target["source"] = "lyrics_dashboard"
        _stamp_song_timestamps(target, is_new=(sec in created))
        auth = str(author or "").strip()
        if auth:
            target["author"] = auth
        lang = str(language or "").strip()
        if lang:
            target["language"] = lang
        if season_tags is not None:
            target["seasons"] = season_tags
        if gospel_moods is not None:
            moods = normalize_gospel_moods(gospel_moods)
            if moods:
                target["gospel_moods"] = moods
            elif "gospel_moods" in target:
                del target["gospel_moods"]
        row_id = str(target.get("id") or "").strip()
        if row_id:
            canonical_ids.add(row_id)

    title_key = clean_title.lower()
    for sec in _SECTIONS:
        if sec in wanted:
            continue
        kept: list[dict[str, Any]] = []
        for row in data.get(sec) or []:
            if not isinstance(row, dict):
                continue
            row_title = str(row.get("title") or "").strip().lower()
            row_id = str(row.get("id") or "").strip()
            if row_title == title_key or row_id in canonical_ids or row_id == hid_base:
                continue
            kept.append(row)
        data[sec] = kept

    save_catalog(data, updated_by=updated_by, sync_song_ids=canonical_ids)
    first_id = ""
    primary_section = wanted[0] if wanted else ""
    for sec in wanted:
        for row in data.get(sec) or []:
            if str(row.get("title") or "").strip().lower() == clean_title.lower():
                first_id = str(row.get("id") or "")
                primary_section = sec
                break
        if first_id:
            break
    return {
        "ok": True,
        "title": clean_title,
        "id": first_id,
        "section": primary_section,
        "sections": wanted,
        "created": created,
        "updated": updated,
    }


def find_catalog_row_by_id(hymn_id: str) -> tuple[Optional[str], Optional[dict[str, Any]]]:
    """Return (section, row) for the first catalog entry with this id, or (None, None)."""
    hid = str(hymn_id or "").strip()
    if not hid:
        return None, None
    data = load_catalog()
    for sec in _SECTIONS:
        for row in data.get(sec) or []:
            if not isinstance(row, dict):
                continue
            if str(row.get("id") or "").strip() == hid:
                return sec, row
    return None, None


def find_catalog_matches_by_title(title: str, *, limit: int = 8) -> list[dict[str, Any]]:
    """Find global catalog songs whose title matches (exact, then fuzzy contains)."""
    clean = format_song_title_case(str(title or "")).strip()
    if not clean:
        return []
    key = clean.lower()
    slug = make_song_id(clean)
    data = load_catalog()
    exact: list[dict[str, Any]] = []
    fuzzy: list[dict[str, Any]] = []
    seen: set[str] = set()
    for sec in _SECTIONS:
        for row in data.get(sec) or []:
            if not isinstance(row, dict):
                continue
            hid = str(row.get("id") or "").strip()
            row_title = str(row.get("title") or "").strip()
            if not hid or not row_title:
                continue
            dedupe = f"{sec}:{hid}"
            if dedupe in seen:
                continue
            row_key = row_title.lower()
            match_type = None
            if row_key == key or hid == slug:
                match_type = "exact"
            elif key in row_key or row_key in key:
                match_type = "similar"
            if not match_type:
                continue
            seen.add(dedupe)
            item = {
                "id": hid,
                "title": row_title,
                "section": sec,
                "match": match_type,
                "has_lyrics": bool(str(row.get("lyrics") or "").strip()),
            }
            if match_type == "exact":
                exact.append(item)
            else:
                fuzzy.append(item)
    return (exact + fuzzy)[: max(1, limit)]


def catalog_for_api(*, include_inferred_moods: bool = False) -> dict[str, list[dict[str, Any]]]:
    now = time.monotonic()
    cached = _catalog_api_cache.get(include_inferred_moods)
    if cached and now - cached[0] < _CATALOG_API_TTL_S:
        return cached[1]

    data = load_catalog()
    out: dict[str, list[dict[str, Any]]] = {}
    for sec in _SECTIONS:
        rows: list[dict[str, Any]] = []
        for item in data.get(sec) or []:
            if not isinstance(item, dict):
                continue
            hid = str(item.get("id") or "").strip()
            title = str(item.get("title") or "").strip()
            if not hid or not title:
                continue
            moods = (
                gospel_moods_for_song(item)
                if include_inferred_moods
                else _explicit_gospel_moods(item)
            )
            rows.append(
                {
                    "id": hid,
                    "title": title,
                    "author": str(item.get("author") or "").strip(),
                    "language": str(item.get("language") or "").strip(),
                    "has_lyrics": bool(str(item.get("lyrics") or "").strip()),
                    "gospel_moods": moods,
                }
            )
        out[sec] = rows
    _catalog_api_cache[include_inferred_moods] = (now, out)
    return out


def catalog_lite_response() -> tuple[bytes, str]:
    """Pre-serialized lite catalog JSON + weak ETag (by catalog revision)."""
    global _catalog_lite_bytes, _catalog_lite_etag, _catalog_lite_mtime
    revision = catalog_revision()
    revision_key = hash(revision)
    if _catalog_lite_bytes is not None and revision_key == _catalog_lite_mtime:
        return _catalog_lite_bytes, _catalog_lite_etag
    payload = {"ok": True, "catalog": catalog_for_api(include_inferred_moods=True)}
    body = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    # v2: lite catalog includes inferred gospel_moods (was empty before → first-song picks)
    etag = f'W/"cat-lite-v2-{revision_key}-{len(body)}"'
    _catalog_lite_bytes = body
    _catalog_lite_etag = etag
    _catalog_lite_mtime = revision_key
    return body, etag


def update_catalog_song(
    *,
    section: str,
    hymn_id: str,
    title: Optional[str] = None,
    author: Optional[str] = None,
    lyrics: Optional[str] = None,
    language: Optional[str] = None,
    gospel_moods: Optional[list[str]] = None,
    updated_by: str | None = None,
) -> dict[str, Any]:
    sec = (section or "").strip().lower()
    hid = (hymn_id or "").strip()
    if sec not in _SECTIONS or not hid:
        return {"ok": False, "error": "Invalid section or id."}
    data = load_catalog()
    for item in data.get(sec) or []:
        if str(item.get("id") or "").strip() != hid:
            continue
        if title is not None:
            nt = format_song_title_case(str(title))
            if nt:
                item["title"] = nt
        if author is not None:
            item["author"] = str(author).strip()
        if lyrics is not None:
            item["lyrics"] = polish_lyrics_text(str(lyrics))
        if language is not None and str(language).strip():
            item["language"] = str(language).strip()
        if gospel_moods is not None:
            moods = normalize_gospel_moods(gospel_moods)
            if moods:
                item["gospel_moods"] = moods
            elif "gospel_moods" in item:
                del item["gospel_moods"]
        _stamp_song_timestamps(item, is_new=False)
        save_catalog(data, updated_by=updated_by)
        return {"ok": True}
    return {"ok": False, "error": "Song not found."}


def delete_catalog_song(
    *,
    section: str,
    hymn_id: str,
    updated_by: str | None = None,
) -> dict[str, Any]:
    sec = (section or "").strip().lower()
    hid = (hymn_id or "").strip()
    if sec not in _SECTIONS or not hid:
        return {"ok": False, "error": "Invalid section or id."}
    data = load_catalog()
    rows = data.get(sec) or []
    new_rows = [r for r in rows if str(r.get("id") or "").strip() != hid]
    if len(new_rows) == len(rows):
        return {"ok": False, "error": "Song not found."}
    data[sec] = new_rows
    save_catalog(data, updated_by=updated_by)
    return {"ok": True}


def import_verbum_songs_from_txt(
    text: str,
    *,
    save: bool = False,
    on_duplicate: str = "overwrite",
    updated_by: str | None = None,
) -> dict[str, Any]:
    """Parse Verbum .txt song catalog; optionally upsert each song into the library.

    ``on_duplicate``: ``overwrite`` (default) updates matching title/id;
    ``skip`` leaves existing catalog rows unchanged.
    """
    from services.verbum_song_txt import parse_verbum_song_txt

    dup_mode = str(on_duplicate or "overwrite").strip().lower()
    if dup_mode not in {"overwrite", "skip"}:
        dup_mode = "overwrite"

    parsed = parse_verbum_song_txt(text)
    if not parsed.get("ok"):
        return {
            "ok": False,
            "error": (parsed.get("errors") or ["Could not parse Verbum song .txt."])[0],
            "errors": parsed.get("errors") or [],
            "songs": [],
            "saved": 0,
            "created": 0,
            "updated": 0,
            "skipped": 0,
            "duplicates": 0,
            "failed": [],
        }

    data = load_catalog()
    songs = list(parsed.get("songs") or [])

    def _find_existing(title: str, hid: str) -> tuple[str, dict[str, Any]] | None:
        title_key = title.strip().lower()
        for sec in _SECTIONS:
            for row in data.get(sec) or []:
                if not isinstance(row, dict):
                    continue
                row_title = str(row.get("title") or "").strip().lower()
                row_id = str(row.get("id") or "").strip()
                if (title_key and row_title == title_key) or (hid and row_id == hid):
                    return sec, row
        return None

    annotated: list[dict[str, Any]] = []
    duplicate_titles: list[str] = []
    for song in songs:
        clean_title = format_song_title_case(str(song.get("title") or ""))
        hid_base = make_song_id(clean_title) if clean_title else ""
        hit = _find_existing(clean_title, hid_base) if clean_title else None
        row = dict(song)
        row["title"] = clean_title or str(song.get("title") or "")
        if hit:
            exist_sec, exist_row = hit
            row["exists"] = True
            row["existing_section"] = exist_sec
            row["existing_id"] = str(exist_row.get("id") or "")
            duplicate_titles.append(row["title"])
        else:
            row["exists"] = False
            row["existing_section"] = ""
            row["existing_id"] = ""
        annotated.append(row)

    out: dict[str, Any] = {
        "ok": True,
        "format": "verbum",
        "count": len(annotated),
        "songs": annotated,
        "errors": list(parsed.get("errors") or []),
        "duplicates": len(duplicate_titles),
        "duplicate_titles": duplicate_titles[:40],
        "on_duplicate": dup_mode,
        "saved": 0,
        "created": 0,
        "updated": 0,
        "skipped": 0,
        "failed": [],
        "results": [],
    }
    if not save:
        return out

    created = 0
    updated = 0
    skipped = 0
    results: list[dict[str, Any]] = []
    failed: list[dict[str, Any]] = []
    sync_ids: set[str] = set()

    for song in annotated:
        clean_title = format_song_title_case(str(song.get("title") or ""))
        clean_lyrics = polish_lyrics_text(str(song.get("lyrics") or ""))
        if not clean_title or not clean_lyrics:
            failed.append(
                {
                    "title": song.get("title"),
                    "error": "Song title and lyrics are required.",
                }
            )
            continue

        section = str(song.get("section") or "meditation").strip().lower()
        if section not in _SECTIONS:
            section = "meditation"
        language = str(song.get("language") or "Tagalog").strip() or "Tagalog"
        author = str(song.get("author") or "").strip()
        moods = normalize_gospel_moods(song.get("gospel_moods"))
        season_tags = _normalize_catalog_seasons(list(song.get("seasons") or ["all"]))

        hid_base = make_song_id(clean_title)
        hit = _find_existing(clean_title, hid_base)

        if hit and dup_mode == "skip":
            exist_sec, exist_row = hit
            skipped += 1
            results.append(
                {
                    "title": clean_title,
                    "id": str(exist_row.get("id") or ""),
                    "section": exist_sec,
                    "created": False,
                    "updated": False,
                    "skipped": True,
                }
            )
            continue

        rows = data[section]
        target = None
        if hit:
            exist_sec, exist_row = hit
            if exist_sec == section:
                target = exist_row
            else:
                # Move: drop from old section, reuse id in new section.
                old_id = str(exist_row.get("id") or "").strip()
                data[exist_sec] = [
                    r
                    for r in (data.get(exist_sec) or [])
                    if not isinstance(r, dict)
                    or str(r.get("id") or "").strip() != old_id
                ]
                target = dict(exist_row)
                rows.append(target)

        is_new = target is None
        if target is None:
            existing_ids = {str(row.get("id") or "").strip() for row in rows}
            hid = hid_base
            n = 2
            while hid in existing_ids:
                hid = f"{hid_base}_{n}"
                n += 1
            target = {
                "id": hid,
                "title": clean_title,
                "author": author,
                "language": language,
                "seasons": season_tags,
            }
            rows.append(target)
            created += 1
        else:
            updated += 1

        target["title"] = clean_title
        target["lyrics"] = clean_lyrics
        target["source"] = "verbum_txt_import"
        _stamp_song_timestamps(target, is_new=is_new)
        if author:
            target["author"] = author
        target["language"] = language
        target["seasons"] = season_tags
        if moods:
            target["gospel_moods"] = moods
        elif "gospel_moods" in target:
            del target["gospel_moods"]

        title_key = clean_title.lower()
        row_id = str(target.get("id") or "").strip()
        if row_id:
            sync_ids.add(row_id)
        for sec in _SECTIONS:
            if sec == section:
                continue
            data[sec] = [
                r
                for r in (data.get(sec) or [])
                if not isinstance(r, dict)
                or (
                    str(r.get("title") or "").strip().lower() != title_key
                    and str(r.get("id") or "").strip() not in {row_id, hid_base}
                )
            ]

        results.append(
            {
                "title": clean_title,
                "id": row_id,
                "section": section,
                "created": is_new,
                "updated": not is_new,
                "skipped": False,
            }
        )

    if sync_ids:
        save_catalog(data, updated_by=updated_by, sync_song_ids=sync_ids)

    out["saved"] = created + updated
    out["created"] = created
    out["updated"] = updated
    out["skipped"] = skipped
    out["failed"] = failed
    out["results"] = results
    if failed and not results and not skipped:
        out["ok"] = False
        out["error"] = "No songs could be saved."
    return out


def _parse_iso_dt(raw: Any) -> datetime | None:
    text = str(raw or "").strip()
    if not text:
        return None
    try:
        if text.endswith("Z"):
            text = text[:-1] + "+00:00"
        dt = datetime.fromisoformat(text)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc)
    except ValueError:
        return None


def _activity_row(sec: str, row: dict[str, Any], *, kind: str, when: datetime) -> dict[str, Any]:
    return {
        "id": str(row.get("id") or "").strip(),
        "title": str(row.get("title") or "").strip(),
        "author": str(row.get("author") or "").strip(),
        "section": sec,
        "language": str(row.get("language") or "").strip(),
        "gospel_moods": gospel_moods_for_song(row),
        "kind": kind,
        "at": when.isoformat(),
        "date": when.date().isoformat(),
    }


def _backfill_missing_activity_timestamps(data: dict[str, list[dict[str, Any]]]) -> bool:
    """Stamp unstamped dashboard/import songs using catalog file mtime (once)."""
    path = catalog_library_path()
    try:
        stamp = datetime.fromtimestamp(path.stat().st_mtime, tz=timezone.utc).isoformat()
    except OSError:
        stamp = _now_iso()
    changed = False
    for sec in _SECTIONS:
        for row in data.get(sec) or []:
            if not isinstance(row, dict):
                continue
            if str(row.get("added_at") or "").strip() or str(row.get("updated_at") or "").strip():
                continue
            src = str(row.get("source") or "").strip()
            if src != "verbum_txt_import":
                continue
            row["added_at"] = stamp
            row["updated_at"] = stamp
            changed = True
    return changed


def catalog_whats_new(*, now: datetime | None = None) -> dict[str, Any]:
    """
    Songs added this calendar month + songs updated in the last 7 days (grouped by date).
    """
    data = load_catalog()
    if _backfill_missing_activity_timestamps(data):
        save_catalog(data)

    clock = now or datetime.now(timezone.utc)
    month_start = clock.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    week_start = (clock - timedelta(days=7)).replace(hour=0, minute=0, second=0, microsecond=0)

    month_added: list[dict[str, Any]] = []
    week_updated: list[dict[str, Any]] = []
    seen_month: set[str] = set()
    seen_week: set[str] = set()

    for sec in _SECTIONS:
        for row in data.get(sec) or []:
            if not isinstance(row, dict):
                continue
            hid = str(row.get("id") or "").strip()
            title = str(row.get("title") or "").strip()
            if not hid and not title:
                continue
            key = hid or title.lower()
            added = _parse_iso_dt(row.get("added_at"))
            updated = _parse_iso_dt(row.get("updated_at")) or added
            if added and added >= month_start and key not in seen_month:
                seen_month.add(key)
                month_added.append(_activity_row(sec, row, kind="added", when=added))
            if updated and updated >= week_start and key not in seen_week:
                seen_week.add(key)
                # Prefer "updated" unless it was added in the same window and never re-saved
                kind = "updated"
                if added and updated and abs((updated - added).total_seconds()) < 2:
                    kind = "added"
                week_updated.append(_activity_row(sec, row, kind=kind, when=updated))

    # Enrich / override from Supabase hymn_songs.updated_at when available.
    try:
        from services.auth_config import supabase_enabled
        from services.supabase_client import get_service_client

        if supabase_enabled():
            client = get_service_client()
            res = (
                client.table("hymn_songs")
                .select("id, section, title, author, language, gospel_moods, updated_at")
                .gte("updated_at", week_start.isoformat())
                .order("updated_at", desc=True)
                .limit(200)
                .execute()
            )
            for remote in res.data or []:
                if not isinstance(remote, dict):
                    continue
                when = _parse_iso_dt(remote.get("updated_at"))
                if not when:
                    continue
                hid = str(remote.get("id") or "").strip()
                sec = str(remote.get("section") or "meditation").strip().lower() or "meditation"
                key = hid or str(remote.get("title") or "").strip().lower()
                if not key:
                    continue
                row = {
                    "id": hid,
                    "title": remote.get("title") or "",
                    "author": remote.get("author") or "",
                    "language": remote.get("language") or "",
                    "gospel_moods": remote.get("gospel_moods") or [],
                }
                if when >= month_start and key not in seen_month:
                    seen_month.add(key)
                    month_added.append(_activity_row(sec, row, kind="added", when=when))
                if when >= week_start and key not in seen_week:
                    seen_week.add(key)
                    week_updated.append(_activity_row(sec, row, kind="updated", when=when))
    except Exception:
        pass

    month_added.sort(key=lambda r: str(r.get("at") or ""), reverse=True)
    week_updated.sort(key=lambda r: str(r.get("at") or ""), reverse=True)

    by_date: dict[str, list[dict[str, Any]]] = {}
    for row in week_updated:
        day = str(row.get("date") or "")
        by_date.setdefault(day, []).append(row)
    week_by_date = [
        {"date": day, "songs": by_date[day]}
        for day in sorted(by_date.keys(), reverse=True)
    ]

    return {
        "ok": True,
        "month_label": clock.strftime("%B %Y"),
        "month_added": month_added,
        "week_updated": week_updated,
        "week_by_date": week_by_date,
        "counts": {
            "month_added": len(month_added),
            "week_updated": len(week_updated),
        },
    }

