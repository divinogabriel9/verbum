"""Per-parish hymn lyric overrides + parish-original songs."""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Optional

from services.auth_config import supabase_enabled
from services.hymn_catalog_store import catalog_sections
from services.song_catalog import make_song_id, polish_lyrics_text

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


def get_parish_song_by_id(
    parish_id: str,
    *,
    hymn_id: str,
    section: str | None = None,
) -> Optional[dict[str, Any]]:
    """Return a parish-origin song (not a global override), if present."""
    ov = get_override(parish_id, hymn_id=hymn_id, section=section)
    if not ov:
        return None
    if str(ov.get("origin") or "override").strip().lower() != "parish":
        return None
    return ov


def list_overrides_for_parish(parish_id: str) -> list[dict[str, Any]]:
    pid = (parish_id or "").strip()
    if not pid or not supabase_enabled():
        return []
    try:
        result = (
            _service_client()
            .table("parish_hymn_overrides")
            .select(
                "hymn_id, section, title, language, author, origin, global_hymn_id, "
                "submission_id, updated_at"
            )
            .eq("parish_id", pid)
            .order("updated_at", desc=True)
            .execute()
        )
        return list(result.data or [])
    except Exception as exc:
        logger.warning("parish hymn override list failed: %s", exc)
        return []


def list_parish_original_songs(parish_id: str) -> list[dict[str, Any]]:
    pid = (parish_id or "").strip()
    if not pid or not supabase_enabled():
        return []
    try:
        result = (
            _service_client()
            .table("parish_hymn_overrides")
            .select("*")
            .eq("parish_id", pid)
            .eq("origin", "parish")
            .order("updated_at", desc=True)
            .execute()
        )
        return [r for r in (result.data or []) if isinstance(r, dict)]
    except Exception as exc:
        logger.warning("parish original songs list failed: %s", exc)
        return []


def save_override(
    parish_id: str,
    *,
    hymn_id: str,
    section: str,
    lyrics: str,
    title: str = "",
    updated_by: str | None = None,
    language: str = "",
    author: str = "",
    gospel_moods: list[str] | None = None,
    origin: str = "override",
    submission_id: str | None = None,
) -> dict[str, Any]:
    pid = (parish_id or "").strip()
    hid = (hymn_id or "").strip()
    sec = (section or "").strip().lower()
    lyr = polish_lyrics_text(str(lyrics or ""))
    origin_key = (origin or "override").strip().lower()
    if origin_key not in {"override", "parish"}:
        origin_key = "override"
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
        "language": (language or "").strip()[:80],
        "author": (author or "").strip()[:240],
        "origin": origin_key,
        "updated_at": _now_iso(),
    }
    if gospel_moods is not None:
        payload["gospel_moods"] = list(gospel_moods)
    uid = (updated_by or "").strip()
    if uid:
        payload["updated_by"] = uid
    sid = (submission_id or "").strip()
    if sid:
        payload["submission_id"] = sid

    try:
        result = (
            _service_client()
            .table("parish_hymn_overrides")
            .upsert(payload, on_conflict="parish_id,hymn_id,section")
            .execute()
        )
        row = (result.data or [payload])[0]
        parish_original = origin_key == "parish"
        return {
            "ok": True,
            "parish_version": True,
            "parish_original": parish_original,
            "id": hid,
            "section": sec,
            "title": row.get("title") or title,
            "lyrics": lyr,
            "language": row.get("language") or language,
            "author": row.get("author") or author,
            "updated_at": row.get("updated_at"),
            "message": (
                "Saved to your parish song catalog."
                if parish_original
                else "Saved parish lyric version. Global catalog is unchanged."
            ),
        }
    except Exception as exc:
        logger.warning("parish hymn override save failed: %s", exc)
        return {"ok": False, "error": str(exc)[:200]}


def save_parish_original_song(
    parish_id: str,
    *,
    title: str,
    lyrics: str,
    section: str,
    language: str = "English",
    author: str = "",
    gospel_moods: list[str] | None = None,
    updated_by: str | None = None,
    hymn_id: str | None = None,
    submission_id: str | None = None,
) -> dict[str, Any]:
    """Create/update a parish-only song (not yet in the global catalog)."""
    from services.song_catalog import format_song_title_case

    pid = (parish_id or "").strip()
    clean_title = format_song_title_case(str(title or "")).strip()
    sec = (section or "").strip().lower() or "meditation"
    if sec not in _SECTIONS:
        sec = "meditation"
    if not pid:
        return {"ok": False, "error": "Join a parish to save songs to the parish catalog."}
    if not clean_title:
        return {"ok": False, "error": "Song title is required."}

    hid = (hymn_id or "").strip() or make_song_id(clean_title)
    existing = list_parish_original_songs(pid)
    used_ids = {
        str(r.get("hymn_id") or "").strip()
        for r in existing
        if str(r.get("section") or "").strip().lower() == sec
    }
    title_key = clean_title.lower()
    for row in existing:
        if str(row.get("section") or "").strip().lower() != sec:
            continue
        if str(row.get("title") or "").strip().lower() == title_key:
            hid = str(row.get("hymn_id") or hid).strip() or hid
            break
    else:
        base = hid
        n = 2
        while hid in used_ids:
            hid = f"{base}_{n}"
            n += 1

    return save_override(
        pid,
        hymn_id=hid,
        section=sec,
        lyrics=lyrics,
        title=clean_title,
        updated_by=updated_by,
        language=language,
        author=author,
        gospel_moods=gospel_moods,
        origin="parish",
        submission_id=submission_id,
    )


def mark_parish_song_promoted(
    parish_id: str,
    *,
    hymn_id: str,
    section: str,
    global_hymn_id: str,
) -> None:
    pid = (parish_id or "").strip()
    hid = (hymn_id or "").strip()
    sec = (section or "").strip().lower()
    gid = (global_hymn_id or "").strip()
    if not pid or not hid or not gid or not supabase_enabled():
        return
    try:
        _service_client().table("parish_hymn_overrides").update(
            {
                "global_hymn_id": gid,
                "updated_at": _now_iso(),
            }
        ).eq("parish_id", pid).eq("hymn_id", hid).eq("section", sec).execute()
    except Exception as exc:
        logger.warning("mark parish song promoted failed: %s", exc)


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


def merge_parish_songs_into_catalog(
    catalog: dict[str, list[dict[str, Any]]],
    parish_id: str,
) -> dict[str, list[dict[str, Any]]]:
    """Add parish-original songs into a catalog payload for that parish."""
    pid = (parish_id or "").strip()
    if not pid or not isinstance(catalog, dict):
        return catalog
    out: dict[str, list[dict[str, Any]]] = {
        sec: [dict(row) for row in (rows or []) if isinstance(row, dict)]
        for sec, rows in catalog.items()
    }
    for sec in _SECTIONS:
        out.setdefault(sec, [])

    for row in list_parish_original_songs(pid):
        sec = str(row.get("section") or "").strip().lower()
        hid = str(row.get("hymn_id") or "").strip()
        title = str(row.get("title") or "").strip()
        if sec not in _SECTIONS or not hid or not title:
            continue
        global_id = str(row.get("global_hymn_id") or "").strip()
        if global_id:
            exists = any(
                str(r.get("id") or "").strip() == global_id or str(r.get("id") or "").strip() == hid
                for r in out.get(sec) or []
            )
            if exists:
                continue
        exists = any(str(r.get("id") or "").strip() == hid for r in out.get(sec) or [])
        if exists:
            continue
        moods = row.get("gospel_moods")
        if not isinstance(moods, list):
            moods = []
        out[sec].append(
            {
                "id": hid,
                "title": title,
                "author": str(row.get("author") or "").strip(),
                "language": str(row.get("language") or "").strip(),
                "has_lyrics": bool(str(row.get("lyrics") or "").strip()),
                "gospel_moods": moods,
                "parish_only": True,
                "pending_global": not bool(global_id),
                "audio_media": None,
                "video_media": None,
                "audio_preview": None,
            }
        )
    return out


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
