"""Validate and clamp user text against shared limits."""

from __future__ import annotations

from typing import Any, Iterable, Optional

from fastapi import HTTPException

from services import input_limits as L


def _fail(field: str, max_len: int, actual: int) -> None:
    raise HTTPException(
        status_code=422,
        detail=f"{field} must be at most {max_len} characters (got {actual}).",
    )


def check_length(value: str, *, field: str, max_len: int) -> str:
    text = (value or "").strip() if isinstance(value, str) else str(value or "")
    if len(text) > max_len:
        _fail(field, max_len, len(text))
    return text


def check_optional_length(value: Optional[str], *, field: str, max_len: int) -> Optional[str]:
    if value is None:
        return None
    text = str(value)
    if len(text) > max_len:
        _fail(field, max_len, len(text))
    return text


def check_string_list(
    values: Optional[Iterable[Any]],
    *,
    field: str,
    max_items: int,
    item_max_len: int,
) -> Optional[list[str]]:
    if values is None:
        return None
    items = [str(v).strip() for v in values if str(v).strip()]
    if len(items) > max_items:
        raise HTTPException(
            status_code=422,
            detail=f"{field} accepts at most {max_items} items (got {len(items)}).",
        )
    for i, item in enumerate(items):
        if len(item) > item_max_len:
            _fail(f"{field}[{i}]", item_max_len, len(item))
    return items


def check_hymn_overrides(
    overrides: Optional[dict[str, dict[str, str]]],
) -> Optional[dict[str, dict[str, str]]]:
    if not overrides:
        return overrides
    cleaned: dict[str, dict[str, str]] = {}
    for section, songs in overrides.items():
        sec = check_length(str(section), field="hymn section", max_len=L.SECTION_KEY)
        if not isinstance(songs, dict):
            continue
        cleaned[sec] = {}
        for song_id, lyrics in songs.items():
            sid = check_length(str(song_id), field="hymn song id", max_len=L.SONG_ID)
            text = str(lyrics or "")
            if len(text) > L.HYMN_OVERRIDE:
                _fail(f"hymn lyrics override ({sec}/{sid})", L.HYMN_OVERRIDE, len(text))
            cleaned[sec][sid] = text
    return cleaned


def check_hymn_layout_overrides(
    overrides: Optional[dict[str, dict[str, str]]],
) -> Optional[dict[str, dict[str, str]]]:
    """Per-song hymn slide layout overrides: { section: { song_id: 'single'|'dual' } }."""
    if not overrides:
        return overrides
    cleaned: dict[str, dict[str, str]] = {}
    for section, songs in overrides.items():
        sec = check_length(str(section), field="hymn section", max_len=L.SECTION_KEY)
        if not isinstance(songs, dict):
            continue
        block: dict[str, str] = {}
        for song_id, layout in songs.items():
            sid = check_length(str(song_id), field="hymn song id", max_len=L.SONG_ID)
            block[sid] = "dual" if str(layout) == "dual" else "single"
        if block:
            cleaned[sec] = block
    return cleaned
