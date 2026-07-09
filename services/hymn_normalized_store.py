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
            meta = {
                "id": hid,
                "section": sec,
                "title": str(row.get("title") or ""),
                "author": str(row.get("author") or ""),
                "language": str(row.get("language") or "").strip(),
                "gospel_moods": normalize_gospel_moods(row.get("gospel_moods")),
                "updated_at": now,
            }
            lyrics = str(row.get("lyrics") or "")
            try:
                client.table("hymn_songs").upsert(meta, on_conflict="id").execute()
                client.table("hymn_song_lyrics").upsert(
                    {"hymn_id": hid, "lyrics": lyrics, "updated_at": now},
                    on_conflict="hymn_id",
                ).execute()
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
