"""Superadmin hymn catalog status and Supabase publish helpers."""

from __future__ import annotations

import json
import queue
import threading
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Literal

from services.auth_config import supabase_enabled
from services.hymn_catalog_store import (
    catalog_library_path,
    catalog_revision,
    catalog_sections,
    invalidate_catalog_cache,
    load_catalog_dict,
)
from services.song_catalog import save_catalog

SyncPrefer = Literal["active", "local"]


def _catalog_counts(catalog: dict[str, list[dict[str, Any]]]) -> dict[str, Any]:
    sections: dict[str, dict[str, int]] = {}
    total = 0
    with_lyrics = 0
    for sec in catalog_sections():
        rows = catalog.get(sec) or []
        section_total = len(rows)
        section_lyrics = sum(
            1 for row in rows if str((row or {}).get("lyrics") or "").strip()
        )
        sections[sec] = {"total": section_total, "with_lyrics": section_lyrics}
        total += section_total
        with_lyrics += section_lyrics
    return {
        "total": total,
        "with_lyrics": with_lyrics,
        "without_lyrics": max(0, total - with_lyrics),
        "sections": sections,
    }


def _local_file_meta() -> dict[str, Any]:
    path = catalog_library_path()
    if not path.is_file():
        return {"exists": False, "path": str(path)}
    try:
        stat = path.stat()
        return {
            "exists": True,
            "path": str(path),
            "mtime": datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc).isoformat(),
            "bytes": stat.st_size,
        }
    except OSError:
        return {"exists": True, "path": str(path)}


def _supabase_catalog_meta() -> dict[str, Any]:
    if not supabase_enabled():
        return {"configured": False}
    try:
        from services.supabase_client import get_service_client

        result = (
            get_service_client()
            .table("platform_hymn_catalog")
            .select("updated_at, updated_by")
            .eq("key", "global")
            .limit(1)
            .execute()
        )
        rows = result.data or []
        if not rows:
            return {"configured": True, "seeded": False}
        row = rows[0]
        return {
            "configured": True,
            "seeded": True,
            "updated_at": row.get("updated_at"),
            "updated_by": row.get("updated_by"),
        }
    except Exception as exc:
        return {"configured": True, "error": str(exc)[:120]}


def build_hymn_catalog_status() -> dict[str, Any]:
    catalog = load_catalog_dict(force=True)
    counts = _catalog_counts(catalog)
    supabase = _supabase_catalog_meta()
    return {
        "ok": True,
        "supabase": supabase,
        "source": "supabase" if supabase.get("seeded") else "local_file",
        "revision": catalog_revision(),
        "local_file": _local_file_meta(),
        "counts": {
            "total": counts["total"],
            "with_lyrics": counts["with_lyrics"],
            "without_lyrics": counts["without_lyrics"],
        },
        "sections": counts["sections"],
    }


def _load_local_file_catalog() -> dict[str, list[dict[str, Any]]]:
    path = catalog_library_path()
    if not path.is_file():
        return {sec: [] for sec in catalog_sections()}
    raw = json.loads(path.read_text(encoding="utf-8"))
    out = {sec: [] for sec in catalog_sections()}
    if isinstance(raw, dict):
        for sec in catalog_sections():
            rows = raw.get(sec) or []
            out[sec] = [x for x in rows if isinstance(x, dict)]
    return out


def sync_hymn_catalog_to_supabase(
    *,
    updated_by: str | None = None,
    prefer: SyncPrefer = "active",
) -> dict[str, Any]:
    """Publish hymn catalog to Supabase (platform_hymn_catalog + normalized lyrics tables)."""
    if not supabase_enabled():
        return {
            "ok": False,
            "error": "Supabase is not configured. Set SUPABASE_URL and service keys in environment.",
        }

    if prefer == "local":
        catalog = _load_local_file_catalog()
        source_label = "local_file"
    else:
        invalidate_catalog_cache()
        catalog = load_catalog_dict(force=True)
        source_label = "active_catalog"

    counts = _catalog_counts(catalog)
    if counts["total"] == 0:
        return {
            "ok": False,
            "error": "Catalog is empty — add songs in Song Library before syncing.",
        }

    try:
        save_catalog(catalog, updated_by=updated_by)
    except Exception as exc:
        return {"ok": False, "error": str(exc)[:200]}

    supabase = _supabase_catalog_meta()
    return {
        "ok": True,
        "source": source_label,
        "revision": catalog_revision(),
        "supabase": supabase,
        "counts": {
            "total": counts["total"],
            "with_lyrics": counts["with_lyrics"],
            "without_lyrics": counts["without_lyrics"],
        },
        "sections": counts["sections"],
        "synced_at": datetime.now(timezone.utc).isoformat(),
    }


def list_song_preview_rows(
    *,
    query: str = "",
    section: str = "",
    status: str = "all",
    limit: int = 80,
    offset: int = 0,
) -> dict[str, Any]:
    from services.mass_text_format import parse_structured_lyric_sections_typed
    from services.song_catalog import (
        normalize_audio_preview_ref,
        normalize_song_media_ref,
    )

    catalog = load_catalog_dict()
    needle = str(query or "").strip().lower()
    want_sec = str(section or "").strip().lower()
    want_status = str(status or "all").strip().lower()
    rows: list[dict[str, Any]] = []
    for sec in catalog_sections():
        if want_sec and want_sec != "all" and sec != want_sec:
            continue
        for item in catalog.get(sec) or []:
            if not isinstance(item, dict):
                continue
            hid = str(item.get("id") or "").strip()
            title = str(item.get("title") or "").strip()
            if not hid or not title:
                continue
            audio = normalize_song_media_ref(item.get("audio_media"))
            preview = normalize_audio_preview_ref(item.get("audio_preview"))
            youtube_url = ""
            if preview:
                youtube_url = str(preview.get("youtube_url") or "")
            if not youtube_url and audio and str(audio.get("source") or "") == "youtube":
                youtube_url = str(audio.get("youtube_url") or "")
            lyrics = str(item.get("lyrics") or "")
            has_chorus = any(
                kind in {"chorus", "refrain"}
                for kind, _body in parse_structured_lyric_sections_typed(lyrics)
            )
            ready = bool(preview and preview.get("basename"))
            if want_status == "ready" and not ready:
                continue
            if want_status == "missing" and ready:
                continue
            if needle:
                blob = " ".join([title, str(item.get("author") or ""), hid, youtube_url]).lower()
                if needle not in blob:
                    continue
            rows.append(
                {
                    "section": sec,
                    "id": hid,
                    "title": title,
                    "author": str(item.get("author") or "").strip(),
                    "language": str(item.get("language") or "").strip(),
                    "has_lyrics": bool(lyrics.strip()),
                    "has_chorus": has_chorus,
                    "youtube_url": youtube_url,
                    "audio_preview": preview,
                    "ready": ready,
                }
            )
    total = len(rows)
    start = max(0, int(offset or 0))
    cap = max(1, min(200, int(limit or 80)))
    return {
        "ok": True,
        "total": total,
        "offset": start,
        "limit": cap,
        "songs": rows[start : start + cap],
    }


def generate_song_audio_preview(
    *,
    section: str,
    hymn_id: str,
    youtube_url: str = "",
    duration_sec: int = 10,
    start_sec: float | None = None,
    updated_by: str | None = None,
    progress_cb: Any = None,
) -> dict[str, Any]:
    from services.community_config import uploads_dir
    from services.private_files import upload_file_url
    from services.song_catalog import (
        normalize_audio_preview_ref,
        normalize_song_media_ref,
        parse_youtube_video_id,
        update_catalog_song,
    )
    from services.song_preview_clip import (
        build_preview_clip,
        clamp_preview_duration,
        end_preview_job,
        try_begin_preview_job,
    )

    catalog = load_catalog_dict()
    sec = str(section or "").strip().lower()
    hid = str(hymn_id or "").strip()
    row = None
    for item in catalog.get(sec) or []:
        if isinstance(item, dict) and str(item.get("id") or "").strip() == hid:
            row = item
            break
    if row is None:
        return {"ok": False, "error": "Song not found."}

    existing_audio = normalize_song_media_ref(row.get("audio_media"))
    existing_preview = normalize_audio_preview_ref(row.get("audio_preview"))
    url = str(youtube_url or "").strip()
    if not url and existing_audio:
        url = str(existing_audio.get("youtube_url") or "")
    if not url and existing_preview:
        url = str(existing_preview.get("youtube_url") or "")
    video_id = parse_youtube_video_id(url)
    if not video_id:
        return {"ok": False, "error": "Paste a YouTube URL for this song first."}

    duration = clamp_preview_duration(duration_sec)
    safe_id = "".join(ch if ch.isalnum() or ch in "-_" else "-" for ch in hid)[:48]
    dest_dir = uploads_dir() / "saved_media" / "music"
    dest_dir.mkdir(parents=True, exist_ok=True)
    dest = dest_dir / f"preview_{sec}_{safe_id}_{duration}.mp3"
    if not try_begin_preview_job():
        return {"ok": False, "error": "A preview fetch is already running. Wait for it to finish."}
    try:
        meta = build_preview_clip(
            youtube_url=url,
            lyrics=str(row.get("lyrics") or ""),
            language=str(row.get("language") or ""),
            duration_sec=duration,
            start_sec=start_sec,
            dest_path=dest,
            progress_cb=progress_cb,
        )
    except Exception as exc:
        return {"ok": False, "error": str(exc)[:240]}
    finally:
        end_preview_job()

    preview = {
        "basename": dest.name,
        "display_name": f"{duration}s preview",
        "duration_sec": meta["duration_sec"],
        "start_sec": meta["start_sec"],
        "source": "preview",
        "method": meta.get("method") or "",
        "youtube_id": meta.get("youtube_id") or video_id,
        "youtube_url": meta.get("youtube_url") or url,
    }
    saved = update_catalog_song(
        section=sec,
        hymn_id=hid,
        audio_preview=preview,
        updated_by=updated_by,
    )
    if not saved.get("ok"):
        return {"ok": False, "error": saved.get("error") or "Could not save preview."}
    return {
        "ok": True,
        "audio_preview": normalize_audio_preview_ref(saved.get("audio_preview") or preview),
        "audio_media": saved.get("audio_media"),
        "url": upload_file_url(f"saved_media/music/{dest.name}"),
        "method": meta.get("method"),
        "lyric_source": meta.get("lyric_source") or meta.get("method"),
        "start_sec": meta.get("start_sec"),
        "duration_sec": meta.get("duration_sec"),
    }


def clear_song_audio_preview(
    *,
    section: str,
    hymn_id: str,
    updated_by: str | None = None,
) -> dict[str, Any]:
    from services.song_catalog import update_catalog_song

    saved = update_catalog_song(
        section=section,
        hymn_id=hymn_id,
        audio_preview=None,
        updated_by=updated_by,
    )
    if not saved.get("ok"):
        return {"ok": False, "error": saved.get("error") or "Could not clear preview."}
    return {"ok": True}


_PREVIEW_JOBS: dict[str, dict[str, Any]] = {}
_PREVIEW_JOB_QUEUE: queue.Queue[str] = queue.Queue()
_PREVIEW_JOBS_LOCK = threading.Lock()
_PREVIEW_WORKER_STARTED = False


def _preview_job_public(job: dict[str, Any]) -> dict[str, Any]:
    return {
        "ok": True,
        "job_id": job.get("id") or "",
        "status": job.get("status") or "queued",
        "percent": int(job.get("percent") or 0),
        "stage": job.get("stage") or "",
        "section": job.get("section") or "",
        "id": job.get("hymn_id") or "",
        "title": job.get("title") or "",
        "error": job.get("error") or "",
        "audio_preview": job.get("audio_preview"),
        "duration_sec": job.get("duration_sec"),
        "method": job.get("method") or "",
    }


def _update_preview_job(job_id: str, **fields: Any) -> None:
    with _PREVIEW_JOBS_LOCK:
        job = _PREVIEW_JOBS.get(job_id)
        if not job:
            return
        job.update(fields)
        job["updated_at"] = time.time()


def _preview_job_worker() -> None:
    while True:
        job_id = _PREVIEW_JOB_QUEUE.get()
        try:
            with _PREVIEW_JOBS_LOCK:
                job = _PREVIEW_JOBS.get(job_id)
            if not job or job.get("status") not in {"queued", "running"}:
                continue
            _update_preview_job(job_id, status="running", percent=2, stage="starting")

            def on_progress(pct: int, stage: str) -> None:
                _update_preview_job(job_id, percent=pct, stage=stage, status="running")

            result = generate_song_audio_preview(
                section=str(job.get("section") or ""),
                hymn_id=str(job.get("hymn_id") or ""),
                youtube_url=str(job.get("youtube_url") or ""),
                duration_sec=int(job.get("duration_sec") or 10),
                start_sec=job.get("start_sec"),
                updated_by=job.get("updated_by"),
                progress_cb=on_progress,
            )
            if result.get("ok"):
                _update_preview_job(
                    job_id,
                    status="done",
                    percent=100,
                    stage="done",
                    error="",
                    audio_preview=result.get("audio_preview"),
                    duration_sec=result.get("duration_sec"),
                    method=result.get("method") or "",
                )
            else:
                _update_preview_job(
                    job_id,
                    status="error",
                    stage="error",
                    error=str(result.get("error") or "Preview fetch failed."),
                )
        except Exception as exc:
            _update_preview_job(job_id, status="error", stage="error", error=str(exc)[:240])
        finally:
            _PREVIEW_JOB_QUEUE.task_done()


def _ensure_preview_worker() -> None:
    global _PREVIEW_WORKER_STARTED
    with _PREVIEW_JOBS_LOCK:
        if _PREVIEW_WORKER_STARTED:
            return
        _PREVIEW_WORKER_STARTED = True
    threading.Thread(target=_preview_job_worker, name="song-preview-fetch", daemon=True).start()


def enqueue_song_audio_preview(
    *,
    section: str,
    hymn_id: str,
    youtube_url: str = "",
    duration_sec: int = 10,
    start_sec: float | None = None,
    updated_by: str | None = None,
) -> dict[str, Any]:
    catalog = load_catalog_dict()
    sec = str(section or "").strip().lower()
    hid = str(hymn_id or "").strip()
    row = None
    for item in catalog.get(sec) or []:
        if isinstance(item, dict) and str(item.get("id") or "").strip() == hid:
            row = item
            break
    if row is None:
        return {"ok": False, "error": "Song not found."}

    from services.song_catalog import normalize_audio_preview_ref, normalize_song_media_ref, parse_youtube_video_id

    existing_audio = normalize_song_media_ref(row.get("audio_media"))
    existing_preview = normalize_audio_preview_ref(row.get("audio_preview"))
    url = str(youtube_url or "").strip()
    if not url and existing_audio:
        url = str(existing_audio.get("youtube_url") or "")
    if not url and existing_preview:
        url = str(existing_preview.get("youtube_url") or "")
    if not parse_youtube_video_id(url):
        return {"ok": False, "error": "Paste a YouTube URL for this song first."}

    key = sec + ":" + hid
    with _PREVIEW_JOBS_LOCK:
        for job in _PREVIEW_JOBS.values():
            if str(job.get("key") or "") != key:
                continue
            if job.get("status") in {"queued", "running"}:
                return _preview_job_public(job)
        job_id = uuid.uuid4().hex[:12]
        job = {
            "id": job_id,
            "key": key,
            "section": sec,
            "hymn_id": hid,
            "title": str(row.get("title") or "").strip(),
            "youtube_url": url,
            "duration_sec": duration_sec,
            "start_sec": start_sec,
            "updated_by": updated_by,
            "status": "queued",
            "percent": 0,
            "stage": "queued",
            "error": "",
            "audio_preview": normalize_audio_preview_ref(row.get("audio_preview")),
            "created_at": time.time(),
            "updated_at": time.time(),
        }
        _PREVIEW_JOBS[job_id] = job
    _ensure_preview_worker()
    _PREVIEW_JOB_QUEUE.put(job_id)
    return _preview_job_public(job)


def get_song_preview_job(job_id: str) -> dict[str, Any]:
    with _PREVIEW_JOBS_LOCK:
        job = _PREVIEW_JOBS.get(str(job_id or "").strip())
        if not job:
            return {"ok": False, "error": "Job not found."}
        return _preview_job_public(job)


def list_song_preview_jobs() -> dict[str, Any]:
    with _PREVIEW_JOBS_LOCK:
        jobs = [_preview_job_public(job) for job in _PREVIEW_JOBS.values()]
    active = [j for j in jobs if j.get("status") in {"queued", "running"}]
    running = next((j for j in active if j.get("status") == "running"), None) or (
        active[0] if active else None
    )
    return {
        "ok": True,
        "active": running,
        "queued": len(active),
        "jobs": jobs[-20:],
    }
