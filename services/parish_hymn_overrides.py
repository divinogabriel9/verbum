"""Per-parish hymn lyric overrides — short versions over the global catalog."""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Optional

from services.auth_config import supabase_enabled
from services.hymn_catalog_store import catalog_sections
from services.song_catalog import polish_lyrics_text

logger = logging.getLogger(__name__)

_SECTIONS = set(catalog_sections())


def _service_client():
    from services.supabase_client import get_service_client

    return get_service_client()


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def get_override(
    parish_id: str,
    *,
    hymn_id: str,
    section: str | None = None,
) -> Optional[dict[str, Any]]:
    pid = (parish_id or "").strip()
    hid = (hymn_id or "").strip()
    if not pid or not hid or not supabase_enabled():
        return None
    try:
        query = (
            _service_client()
            .table("parish_hymn_overrides")
            .select("*")
            .eq("parish_id", pid)
            .eq("hymn_id", hid)
        )
        sec = (section or "").strip().lower()
        if sec in _SECTIONS:
            query = query.eq("section", sec)
        result = query.limit(1).execute()
        rows = result.data or []
        return rows[0] if rows else None
    except Exception as exc:
        logger.warning("parish hymn override read failed: %s", exc)
        return None


def list_overrides_for_parish(parish_id: str) -> list[dict[str, Any]]:
    pid = (parish_id or "").strip()
    if not pid or not supabase_enabled():
        return []
    try:
        result = (
            _service_client()
            .table("parish_hymn_overrides")
            .select("hymn_id, section, title, updated_at")
            .eq("parish_id", pid)
            .order("updated_at", desc=True)
            .execute()
        )
        return list(result.data or [])
    except Exception as exc:
        logger.warning("parish hymn override list failed: %s", exc)
        return []


def save_override(
    parish_id: str,
    *,
    hymn_id: str,
    section: str,
    lyrics: str,
    title: str = "",
    updated_by: str | None = None,
) -> dict[str, Any]:
    pid = (parish_id or "").strip()
    hid = (hymn_id or "").strip()
    sec = (section or "").strip().lower()
    lyr = polish_lyrics_text(str(lyrics or ""))
    if not pid:
        return {"ok": False, "error": "Parish is required."}
    if not hid:
        return {"ok": False, "error": "Song id is required."}
    if sec not in _SECTIONS:
        return {"ok": False, "error": "Invalid Mass section."}
    if not lyr.strip():
        return {"ok": False, "error": "Lyrics are required."}
    if not supabase_enabled():
        return {"ok": False, "error": "Supabase is not configured."}

    payload: dict[str, Any] = {
        "parish_id": pid,
        "hymn_id": hid,
        "section": sec,
        "lyrics": lyr,
        "title": (title or "").strip()[:240],
        "updated_at": _now_iso(),
    }
    uid = (updated_by or "").strip()
    if uid:
        payload["updated_by"] = uid

    try:
        result = (
            _service_client()
            .table("parish_hymn_overrides")
            .upsert(payload, on_conflict="parish_id,hymn_id,section")
            .execute()
        )
        row = (result.data or [payload])[0]
        return {
            "ok": True,
            "parish_version": True,
            "id": hid,
            "section": sec,
            "title": row.get("title") or title,
            "lyrics": lyr,
            "updated_at": row.get("updated_at"),
            "message": "Saved parish lyric version. Global catalog is unchanged.",
        }
    except Exception as exc:
        logger.warning("parish hymn override save failed: %s", exc)
        return {"ok": False, "error": str(exc)[:200]}


def clear_override(
    parish_id: str,
    *,
    hymn_id: str,
    section: str | None = None,
) -> dict[str, Any]:
    """Remove parish override so the parish falls back to the global catalog."""
    pid = (parish_id or "").strip()
    hid = (hymn_id or "").strip()
    if not pid or not hid:
        return {"ok": False, "error": "parish_id and hymn_id are required."}
    if not supabase_enabled():
        return {"ok": False, "error": "Supabase is not configured."}
    try:
        query = (
            _service_client()
            .table("parish_hymn_overrides")
            .delete()
            .eq("parish_id", pid)
            .eq("hymn_id", hid)
        )
        sec = (section or "").strip().lower()
        if sec in _SECTIONS:
            query = query.eq("section", sec)
        query.execute()
        return {
            "ok": True,
            "synced": True,
            "id": hid,
            "section": sec or None,
            "message": "Parish lyrics reset to the global catalog (superadmin source of truth).",
        }
    except Exception as exc:
        logger.warning("parish hymn override clear failed: %s", exc)
        return {"ok": False, "error": str(exc)[:200]}


def merge_parish_lyric_overrides(
    parish_id: str,
    song_selections: Optional[dict[str, Any]] = None,
    existing: Optional[dict[str, Any]] = None,
) -> dict[str, dict[str, str]]:
    """Fill hymn lyric overrides from parish short versions; client values win."""
    out: dict[str, dict[str, str]] = {}
    if isinstance(existing, dict):
        for sec, block in existing.items():
            if not isinstance(block, dict):
                continue
            sec_key = str(sec or "").strip().lower()
            if not sec_key:
                continue
            cleaned: dict[str, str] = {}
            for hid, lyrics in block.items():
                text = str(lyrics or "").strip()
                if hid and text:
                    cleaned[str(hid)] = text
            if cleaned:
                out[sec_key] = cleaned

    pid = (parish_id or "").strip()
    if not pid or not isinstance(song_selections, dict):
        return out

    for sec, hymn_id in song_selections.items():
        sec_key = str(sec or "").strip().lower()
        hid = str(hymn_id or "").strip()
        if not sec_key or not hid:
            continue
        block = out.setdefault(sec_key, {})
        if block.get(hid):
            continue
        ov = get_override(pid, hymn_id=hid, section=sec_key) or get_override(pid, hymn_id=hid)
        text = str((ov or {}).get("lyrics") or "").strip()
        if text:
            block[hid] = text
        if not block:
            out.pop(sec_key, None)
    return out
