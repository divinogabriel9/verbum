"""Normalized hymn metadata + lyrics tables (split from monolithic JSONB catalog)."""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Optional

from services.auth_config import supabase_enabled
from services.gospel_mood import normalize_gospel_moods

logger = logging.getLogger(__name__)


def _service_client():
    from services.supabase_client import get_service_client

    return get_service_client()


def _upsert_normalized_song_row(
    client: Any,
    *,
    section: str,
    row: dict[str, Any],
    now: str,
) -> None:
    hid = str(row.get("id") or "").strip()
    if not hid:
        return
    meta = {
        "id": hid,
        "section": section,
        "title": str(row.get("title") or ""),
        "author": str(row.get("author") or ""),
        "language": str(row.get("language") or "").strip(),
        "gospel_moods": normalize_gospel_moods(row.get("gospel_moods")),
        "updated_at": now,
    }
    lyrics = str(row.get("lyrics") or "")
    client.table("hymn_songs").upsert(meta, on_conflict="id").execute()
    client.table("hymn_song_lyrics").upsert(
        {"hymn_id": hid, "lyrics": lyrics, "updated_at": now},
        on_conflict="hymn_id",
    ).execute()


def sync_songs_to_normalized_tables(
    catalog: dict[str, list[dict[str, Any]]],
    song_ids: set[str] | frozenset[str],
) -> None:
    """Upsert only the given hymn ids into hymn_songs + hymn_song_lyrics."""
    if not supabase_enabled() or not song_ids:
        return
    wanted = {str(sid or "").strip() for sid in song_ids if str(sid or "").strip()}
    if not wanted:
        return
    now = datetime.now(timezone.utc).isoformat()
    client = _service_client()
    for section, rows in catalog.items():
        sec = str(section or "").strip().lower()
        if not sec or not isinstance(rows, list):
            continue
        for row in rows:
            if not isinstance(row, dict):
                continue
            hid = str(row.get("id") or "").strip()
            if hid not in wanted:
                continue
            try:
                _upsert_normalized_song_row(client, section=sec, row=row, now=now)
            except Exception as exc:
                logger.warning("hymn normalized sync failed for %s: %s", hid, exc)


def sync_catalog_to_normalized_tables(
    catalog: dict[str, list[dict[str, Any]]],
) -> None:
    """Upsert hymn_songs + hymn_song_lyrics from the section-grouped catalog dict."""
    if not supabase_enabled():
        return
    now = datetime.now(timezone.utc).isoformat()
    client = _service_client()
    for section, rows in catalog.items():
        sec = str(section or "").strip().lower()
        if not sec or not isinstance(rows, list):
            continue
        for row in rows:
            if not isinstance(row, dict):
                continue
            hid = str(row.get("id") or "").strip()
            if not hid:
                continue
            try:
                _upsert_normalized_song_row(client, section=sec, row=row, now=now)
            except Exception as exc:
                logger.warning("hymn normalized sync failed for %s: %s", hid, exc)


def fetch_lyrics_from_normalized(hymn_id: str) -> Optional[str]:
    hid = (hymn_id or "").strip()
    if not hid or not supabase_enabled():
        return None
    try:
        result = (
            _service_client()
            .table("hymn_song_lyrics")
            .select("lyrics")
            .eq("hymn_id", hid)
            .limit(1)
            .execute()
        )
        rows = result.data or []
        if not rows:
            return None
        return str(rows[0].get("lyrics") or "")
    except Exception as exc:
        logger.debug("fetch_lyrics_from_normalized %s: %s", hid, exc)
        return None


def fetch_song_from_normalized(hymn_id: str) -> Optional[dict[str, Any]]:
    """Load one song from hymn_songs + hymn_song_lyrics (production fallback)."""
    hid = (hymn_id or "").strip()
    if not hid or not supabase_enabled():
        return None
    try:
        client = _service_client()
        meta_res = (
            client.table("hymn_songs")
            .select("id, section, title, author, language, gospel_moods")
            .eq("id", hid)
            .limit(1)
            .execute()
        )
        meta_rows = meta_res.data or []
        if not meta_rows:
            return None
        meta = meta_rows[0] if isinstance(meta_rows[0], dict) else {}
        lyrics = fetch_lyrics_from_normalized(hid) or ""
        return {
            "id": str(meta.get("id") or hid),
            "section": str(meta.get("section") or "").strip().lower(),
            "title": str(meta.get("title") or ""),
            "author": str(meta.get("author") or ""),
            "language": str(meta.get("language") or "").strip(),
            "lyrics": lyrics,
            "gospel_moods": meta.get("gospel_moods") or [],
        }
    except Exception as exc:
        logger.debug("fetch_song_from_normalized %s: %s", hid, exc)
        return None
