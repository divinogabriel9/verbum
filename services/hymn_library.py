"""Load hymn library with full lyrics and per-Mass-section recommendations."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Optional

_PROJECT_ROOT = Path(__file__).resolve().parents[1]
_LIBRARY_PATH = _PROJECT_ROOT / "data" / "hymn_library.json"
_WEB_CACHE_PATH = _PROJECT_ROOT / "data" / "web_hymn_cache.json"


def load_library() -> dict[str, Any]:
    if not _LIBRARY_PATH.is_file():
        return {
            "entrance": [],
            "offertory": [],
            "communion": [],
            "recessional": [],
            "meditation": [],
        }
    try:
        return json.loads(_LIBRARY_PATH.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return {
            "entrance": [],
            "offertory": [],
            "communion": [],
            "recessional": [],
            "meditation": [],
        }


def _priority(item: dict[str, Any], season_key: str) -> int:
    raw = item.get("seasons") or ["all"]
    if not isinstance(raw, list):
        raw = [raw]
    tags = {str(x).strip().lower() for x in raw}
    sk = (season_key or "").strip().lower().replace(" ", "_")
    if sk in tags:
        return 3
    if "all" in tags:
        return 2
    return 1


def recommend_sections(
    *,
    season_key: str,
    per_section: int = 5,
) -> dict[str, list[dict[str, Any]]]:
    """
    Return hymn suggestions per section (capped at ``per_section``) with id + title for UI.
    Higher priority: season match, then ``all``, then remaining.
    """
    lib = load_library()
    out: dict[str, list[dict[str, Any]]] = {}
    cap = max(3, min(per_section, 20))

    for section in ("entrance", "offertory", "communion", "recessional", "meditation"):
        items: list[dict[str, Any]] = [x for x in (lib.get(section) or []) if isinstance(x, dict)]
        scored: list[tuple[int, int, int, dict[str, Any]]] = []
        for idx, item in enumerate(items):
            hid = str(item.get("id") or "").strip()
            title = str(item.get("title") or "").strip()
            if not hid or not title:
                continue
            pr = _priority(item, season_key)
            has_lyrics = 1 if str(item.get("lyrics") or "").strip() else 0
            scored.append(
                (
                    pr,
                    has_lyrics,
                    -idx,
                    {
                        "id": hid,
                        "title": title,
                        "author": str(item.get("author") or "").strip(),
                        "source": "local",
                        "language": str(item.get("language") or "English"),
                        "has_lyrics": bool(has_lyrics),
                    },
                )
            )
        scored.sort(key=lambda t: (t[0], t[1], t[2]), reverse=True)
        seen: set[str] = set()
        picked: list[dict[str, Any]] = []
        for _pr, _hl, _ix, row in scored:
            if row["id"] in seen:
                continue
            seen.add(row["id"])
            picked.append(row)
            if len(picked) >= cap:
                break
        out[section] = picked
    return out


def section_candidates(
    *,
    season_key: str,
    section: str,
    limit: int = 40,
) -> list[dict[str, Any]]:
    """Return a larger ranked pool for one section."""
    sec = (section or "").strip().lower()
    if sec not in ("entrance", "offertory", "communion", "recessional", "meditation"):
        return []
    items: list[dict[str, Any]] = [x for x in (load_library().get(sec) or []) if isinstance(x, dict)]
    scored: list[tuple[int, int, int, dict[str, Any]]] = []
    for idx, item in enumerate(items):
        hid = str(item.get("id") or "").strip()
        title = str(item.get("title") or "").strip()
        if not hid or not title:
            continue
        pr = _priority(item, season_key)
        has_lyrics = 1 if str(item.get("lyrics") or "").strip() else 0
        scored.append(
            (
                pr,
                has_lyrics,
                -idx,
                {
                    "id": hid,
                    "title": title,
                    "author": str(item.get("author") or "").strip(),
                    "source": "local",
                    "language": str(item.get("language") or "English"),
                    "has_lyrics": bool(has_lyrics),
                },
            )
        )
    scored.sort(key=lambda t: (t[0], t[1], t[2]), reverse=True)
    out: list[dict[str, Any]] = []
    seen: set[str] = set()
    for _pr, _hl, _ix, row in scored:
        if row["id"] in seen:
            continue
        seen.add(row["id"])
        out.append(row)
        if len(out) >= max(1, limit):
            break
    return out


def web_cached_for_section(section: str, limit: int = 40) -> list[dict[str, Any]]:
    """Return cached web-discovered songs applicable to this section."""
    sec = (section or "").strip().lower()
    if sec not in ("entrance", "offertory", "communion", "recessional", "meditation"):
        return []
    if not _WEB_CACHE_PATH.is_file():
        return []
    try:
        data = json.loads(_WEB_CACHE_PATH.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return []
    out: list[dict[str, Any]] = []
    seen: set[str] = set()
    for item in data.get("items") or []:
        if not isinstance(item, dict):
            continue
        sections = item.get("sections") or []
        if not isinstance(sections, list) or sec not in [str(x).strip().lower() for x in sections]:
            continue
        hid = str(item.get("id") or "").strip()
        title = str(item.get("title") or "").strip()
        if not hid or not title or hid in seen:
            continue
        seen.add(hid)
        out.append(
            {
                "id": hid,
                "title": title,
                "source": "web",
                "language": str(item.get("language") or ""),
                "has_lyrics": bool(str(item.get("lyrics") or "").strip()),
            }
        )
        if len(out) >= max(1, limit):
            break
    return out


def get_hymn(section: str, hymn_id: str) -> Optional[dict[str, Any]]:
    hid = (hymn_id or "").strip()
    sec = (section or "").strip().lower()
    if not hid or sec not in ("entrance", "offertory", "communion", "recessional", "meditation"):
        return None
    for item in load_library().get(sec) or []:
        if isinstance(item, dict) and str(item.get("id") or "").strip() == hid:
            return item
    # Same id may be stored under another Mass section; resolve library-wide.
    for scan_sec in ("entrance", "offertory", "communion", "recessional", "meditation"):
        if scan_sec == sec:
            continue
        for item in load_library().get(scan_sec) or []:
            if isinstance(item, dict) and str(item.get("id") or "").strip() == hid:
                return item
    # Fallback: web-discovered hymns cached during preview.
    if hid.startswith("web_") and _WEB_CACHE_PATH.is_file():
        try:
            data = json.loads(_WEB_CACHE_PATH.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            return None
        for item in data.get("items") or []:
            if isinstance(item, dict) and str(item.get("id") or "").strip() == hid:
                if str(item.get("lyrics") or "").strip():
                    return item
                return None
    return None
