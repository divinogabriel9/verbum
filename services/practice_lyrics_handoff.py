"""One-time practice → Mass Builder lyrics handoffs (email to parish members)."""

from __future__ import annotations

import logging
import secrets
from datetime import datetime, timezone
from typing import Any, Optional

from services.choir_practice_shares import (
    _ensure_song_blocks,
    _lyrics_from_blocks,
    get_practice_share_by_token,
)
from services.platform_cache import cache_delete, cache_get_json, cache_set_json

logger = logging.getLogger(__name__)

_HANDOFF_TTL_S = 7 * 24 * 3600  # match practice week
_CACHE_PREFIX = "practice:lyrics_handoff:"


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _cache_key(token: str) -> str:
    return f"{_CACHE_PREFIX}{(token or '').strip()}"


def songs_for_pptx_from_snapshot(songs: list[Any]) -> list[dict[str, Any]]:
    """Flatten practice blocks (enabled, current order) into Mass override lyrics."""
    out: list[dict[str, Any]] = []
    for raw in songs or []:
        if not isinstance(raw, dict):
            continue
        item = _ensure_song_blocks(dict(raw))
        hymn_id = str(item.get("hymn_id") or "").strip()
        if not hymn_id:
            continue
        blocks = item.get("blocks") if isinstance(item.get("blocks"), list) else []
        if blocks:
            lyrics = _lyrics_from_blocks(blocks, include_disabled=False)
        else:
            lyrics = str(item.get("lyrics") or "").strip()
        if not lyrics:
            continue
        slot_key = str(item.get("slot_key") or "").strip()
        section = str(item.get("section") or "").strip().lower()
        if not section and slot_key:
            if slot_key.startswith("communion"):
                section = "communion"
            else:
                section = slot_key
        out.append(
            {
                "slot_key": slot_key,
                "slot_label": str(item.get("slot_label") or "").strip(),
                "section": section,
                "hymn_id": hymn_id,
                "title": str(item.get("title") or "Song").strip() or "Song",
                "author": str(item.get("author") or "").strip(),
                "language": str(item.get("language") or "").strip(),
                "lyrics": lyrics,
            }
        )
    return out[:24]


def create_lyrics_handoff(
    *,
    practice_token: str,
    recipient_user_id: str,
    recipient_email: str = "",
    recipient_name: str = "",
    sender_label: str = "",
) -> dict[str, Any]:
    """Snapshot current practice lyrics into a short-lived handoff for Mass Builder."""
    tok = (practice_token or "").strip()
    uid = (recipient_user_id or "").strip()
    if not tok or not uid:
        return {"ok": False, "error": "Missing practice token or recipient."}

    row = get_practice_share_by_token(tok)
    if not row:
        return {"ok": False, "error": "This practice link is invalid or has expired."}

    parish_id = str(row.get("parish_id") or "").strip()
    if not parish_id:
        return {"ok": False, "error": "This practice share is not linked to a parish."}

    snapshot = row.get("song_snapshot")
    songs_raw = snapshot if isinstance(snapshot, list) else []
    songs = songs_for_pptx_from_snapshot(songs_raw)
    if not songs:
        return {"ok": False, "error": "No practice lyrics to send."}

    handoff_id = secrets.token_urlsafe(18)
    payload = {
        "ok": True,
        "id": handoff_id,
        "parish_id": parish_id,
        "mass_date": str(row.get("mass_date") or "").strip(),
        "mass_title": str(row.get("mass_title") or "").strip(),
        "parish_name": str(row.get("parish_name") or "").strip(),
        "practice_token": tok,
        "recipient_user_id": uid,
        "recipient_email": (recipient_email or "").strip(),
        "recipient_name": (recipient_name or "").strip(),
        "sender_label": (sender_label or "").strip(),
        "created_at": _now_iso(),
        "songs": songs,
        "song_count": len(songs),
    }
    cache_set_json(_cache_key(handoff_id), payload, ttl_s=_HANDOFF_TTL_S)
    return payload


def get_lyrics_handoff(handoff_id: str) -> Optional[dict[str, Any]]:
    hid = (handoff_id or "").strip()
    if not hid or len(hid) < 12:
        return None
    data = cache_get_json(_cache_key(hid))
    if not isinstance(data, dict) or not data.get("ok"):
        return None
    return data


def public_handoff_payload(row: dict[str, Any]) -> dict[str, Any]:
    """Safe shape for authenticated Mass Builder consumers."""
    songs = row.get("songs") if isinstance(row.get("songs"), list) else []
    return {
        "ok": True,
        "id": str(row.get("id") or ""),
        "mass_date": str(row.get("mass_date") or "").strip(),
        "mass_title": str(row.get("mass_title") or "").strip(),
        "parish_name": str(row.get("parish_name") or "").strip(),
        "sender_label": str(row.get("sender_label") or "").strip(),
        "song_count": int(row.get("song_count") or len(songs)),
        "songs": [
            {
                "slot_key": str(s.get("slot_key") or ""),
                "slot_label": str(s.get("slot_label") or ""),
                "section": str(s.get("section") or ""),
                "hymn_id": str(s.get("hymn_id") or ""),
                "title": str(s.get("title") or "Song"),
                "author": str(s.get("author") or ""),
                "language": str(s.get("language") or ""),
                "lyrics": str(s.get("lyrics") or ""),
            }
            for s in songs
            if isinstance(s, dict) and str(s.get("hymn_id") or "").strip()
        ],
    }


def delete_lyrics_handoff(handoff_id: str) -> None:
    hid = (handoff_id or "").strip()
    if hid:
        cache_delete(_cache_key(hid))
