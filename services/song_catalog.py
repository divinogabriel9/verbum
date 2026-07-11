"""Song catalog helpers for section-based hymn library storage."""

from __future__ import annotations

import json
import re
import time
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
    """Uppercase the first alphabetic character; leave the rest unchanged."""
    if not token:
        return token
    for i, ch in enumerate(token):
        if ch.isalpha():
            return token[:i] + ch.upper() + token[i + 1 :]
    return token


def format_lyrics_first_letters(lyrics: str) -> str:
    """
    Premiumize lyric text for practice/display: uppercase the first letter of
    every word on every line. Preserves newlines, indent, and non-letter casing.
    """
    text = str(lyrics or "").replace("\r\n", "\n").replace("\r", "\n")
    if not text.strip():
        return text.strip()
    out_lines: list[str] = []
    for line in text.split("\n"):
        if not line.strip():
            out_lines.append("")
            continue
        lead_len = len(line) - len(line.lstrip(" \t"))
        lead = line[:lead_len]
        body = line[lead_len:]
        parts = body.split(" ")
        out_lines.append(lead + " ".join(_capitalize_first_alpha(p) for p in parts))
    return "\n".join(out_lines).strip()


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
        item["lyrics"] = format_lyrics_first_letters(lyr)
        if source_link:
            item["text_link"] = source_link
        changed = True
        break
    if changed:
        save_catalog(data)
    return changed


def save_lyrics_song(
    *,
    title: str,
    lyrics: str,
    sections: list[str],
    language: str = "English",
    author: str = "",
    gospel_moods: list[str] | None = None,
    updated_by: str | None = None,
) -> dict[str, Any]:
    """Upsert a full lyric text into one or more local hymn catalog sections."""
    clean_title = format_song_title_case(str(title or ""))
    clean_lyrics = format_lyrics_first_letters(str(lyrics or ""))
    if not clean_title or not clean_lyrics:
        return {"ok": False, "error": "Song title and lyrics are required."}

    wanted = []
    for raw in sections or []:
        sec = str(raw or "").strip().lower()
        if sec in _SECTIONS and sec not in wanted:
            wanted.append(sec)
    if not wanted:
        wanted = ["meditation"]

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
                "seasons": ["all"],
            }
            rows.append(target)
            created.append(sec)
        else:
            updated.append(sec)

        target["lyrics"] = clean_lyrics
        target["source"] = "lyrics_dashboard"
        auth = str(author or "").strip()
        if auth:
            target["author"] = auth
        lang = str(language or "").strip()
        if lang:
            target["language"] = lang
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
            item["lyrics"] = format_lyrics_first_letters(str(lyrics))
        if language is not None and str(language).strip():
            item["language"] = str(language).strip()
        if gospel_moods is not None:
            moods = normalize_gospel_moods(gospel_moods)
            if moods:
                item["gospel_moods"] = moods
            elif "gospel_moods" in item:
                del item["gospel_moods"]
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

