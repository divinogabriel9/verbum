"""Song catalog helpers for section-based hymn library storage."""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any, Optional

_PROJECT_ROOT = Path(__file__).resolve().parents[1]
_LIBRARY_PATH = _PROJECT_ROOT / "data" / "hymn_library.json"
_SECTIONS = ("entrance", "offertory", "communion", "recessional", "meditation")
_PART_MAP = {
    "entrance": "entrance",
    "offertory": "offertory",
    "communion": "communion",
    "recessional": "recessional",
    "meditation": "meditation",
}


def _blank_library() -> dict[str, list[dict[str, Any]]]:
    return {k: [] for k in _SECTIONS}


def load_catalog() -> dict[str, list[dict[str, Any]]]:
    if not _LIBRARY_PATH.is_file():
        return _blank_library()
    try:
        raw = json.loads(_LIBRARY_PATH.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return _blank_library()
    out = _blank_library()
    for sec in _SECTIONS:
        rows = raw.get(sec) or []
        out[sec] = [x for x in rows if isinstance(x, dict)]
    return out


def save_catalog(data: dict[str, list[dict[str, Any]]]) -> None:
    _LIBRARY_PATH.parent.mkdir(parents=True, exist_ok=True)
    _LIBRARY_PATH.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def make_song_id(title: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "_", (title or "").strip().lower()).strip("_")
    if not slug:
        slug = "song"
    return slug[:72]


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
        item["lyrics"] = lyr
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
) -> dict[str, Any]:
    """Upsert a full lyric text into one or more local hymn catalog sections."""
    clean_title = str(title or "").strip()
    clean_lyrics = str(lyrics or "").strip()
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

    save_catalog(data)
    first_id = ""
    for sec in wanted:
        for row in data.get(sec) or []:
            if str(row.get("title") or "").strip().lower() == clean_title.lower():
                first_id = str(row.get("id") or "")
                break
        if first_id:
            break
    return {
        "ok": True,
        "title": clean_title,
        "id": first_id,
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


def catalog_for_api() -> dict[str, list[dict[str, Any]]]:
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
            rows.append(
                {
                    "id": hid,
                    "title": title,
                    "author": str(item.get("author") or "").strip(),
                    "language": str(item.get("language") or "English"),
                    "has_lyrics": bool(str(item.get("lyrics") or "").strip()),
                }
            )
        out[sec] = rows
    return out


def update_catalog_song(
    *,
    section: str,
    hymn_id: str,
    title: Optional[str] = None,
    author: Optional[str] = None,
    lyrics: Optional[str] = None,
    language: Optional[str] = None,
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
            nt = str(title).strip()
            if nt:
                item["title"] = nt
        if author is not None:
            item["author"] = str(author).strip()
        if lyrics is not None:
            item["lyrics"] = str(lyrics)
        if language is not None and str(language).strip():
            item["language"] = str(language).strip()
        save_catalog(data)
        return {"ok": True}
    return {"ok": False, "error": "Song not found."}


def delete_catalog_song(*, section: str, hymn_id: str) -> dict[str, Any]:
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
    save_catalog(data)
    return {"ok": True}

