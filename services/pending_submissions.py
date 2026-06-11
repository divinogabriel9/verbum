"""Pending song and priest submissions awaiting superadmin approval."""

from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

from services import community_store
from services.api_security import AuthSession
from services.auth_config import supabase_enabled
from services.song_catalog import save_lyrics_song

_PROJECT_ROOT = Path(__file__).resolve().parents[1]
_SONGS_PATH = _PROJECT_ROOT / "data" / "pending_song_submissions.json"
_PRIESTS_PATH = _PROJECT_ROOT / "data" / "pending_priest_submissions.json"


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _read_rows(path: Path) -> list[dict[str, Any]]:
    if not path.is_file():
        return []
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return []
    return [x for x in raw if isinstance(x, dict)]


def _write_rows(path: Path, rows: list[dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(rows, ensure_ascii=False, indent=2), encoding="utf-8")


def _pending(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [r for r in rows if (r.get("status") or "pending") == "pending"]


def submit_pending_song(
    session: AuthSession,
    *,
    title: str,
    lyrics: str,
    sections: list[str],
    language: str = "English",
    author: str = "",
) -> dict[str, Any]:
    rows = _read_rows(_SONGS_PATH)
    row = {
        "id": uuid.uuid4().hex,
        "status": "pending",
        "created_at": _now_iso(),
        "submitted_by_user_id": session.user.user_id,
        "submitted_by_email": session.user.email or "",
        "payload": {
            "title": title.strip(),
            "lyrics": lyrics.strip(),
            "sections": sections,
            "language": language,
            "author": author.strip(),
        },
    }
    rows.append(row)
    _write_rows(_SONGS_PATH, rows)
    return {
        "ok": True,
        "pending": True,
        "submission_id": row["id"],
        "message": "Song submitted for superadmin approval.",
    }


def submit_pending_priest(session: AuthSession, *, name: str) -> dict[str, Any]:
    clean = (name or "").strip()
    if not clean:
        return {"ok": False, "error": "Priest name is required."}
    rows = _read_rows(_PRIESTS_PATH)
    key = clean.lower()
    for row in rows:
        if (row.get("status") or "pending") != "pending":
            continue
        payload = row.get("payload") or {}
        if str(payload.get("name") or "").strip().lower() == key:
            return {"ok": False, "error": "This priest name is already awaiting approval."}
    row = {
        "id": uuid.uuid4().hex,
        "status": "pending",
        "created_at": _now_iso(),
        "submitted_by_user_id": session.user.user_id,
        "submitted_by_email": session.user.email or "",
        "payload": {"name": clean},
    }
    rows.append(row)
    _write_rows(_PRIESTS_PATH, rows)
    return {
        "ok": True,
        "pending": True,
        "submission_id": row["id"],
        "message": "Priest submitted for superadmin approval.",
    }


def list_pending_songs() -> list[dict[str, Any]]:
    return _pending(_read_rows(_SONGS_PATH))


def list_pending_priests() -> list[dict[str, Any]]:
    return _pending(_read_rows(_PRIESTS_PATH))


def _set_submission_status(
    path: Path,
    submission_id: str,
    status: str,
) -> Optional[dict[str, Any]]:
    sid = (submission_id or "").strip()
    if not sid:
        return None
    rows = _read_rows(path)
    target = None
    for row in rows:
        if str(row.get("id") or "") == sid:
            row["status"] = status
            row["resolved_at"] = _now_iso()
            target = row
            break
    if not target:
        return None
    _write_rows(path, rows)
    return target


def sync_celebrants_to_supabase_profiles() -> None:
    if not supabase_enabled():
        return
    from services.supabase_client import get_service_client

    names = community_store.list_celebrant_names()
    client = get_service_client()
    result = client.table("church_profiles").select("user_id, celebrant_names").execute()
    for row in result.data or []:
        uid = row.get("user_id")
        if not uid:
            continue
        current = row.get("celebrant_names") or []
        if not isinstance(current, list):
            current = []
        merged = community_store._normalize_names(list(current) + names)
        client.table("church_profiles").update({"celebrant_names": merged}).eq(
            "user_id", uid
        ).execute()


def approve_song_submission(submission_id: str) -> dict[str, Any]:
    row = _set_submission_status(_SONGS_PATH, submission_id, "approved")
    if not row:
        return {"ok": False, "error": "Submission not found."}
    payload = row.get("payload") or {}
    result = save_lyrics_song(
        title=str(payload.get("title") or ""),
        lyrics=str(payload.get("lyrics") or ""),
        sections=list(payload.get("sections") or []),
        language=str(payload.get("language") or "English"),
        author=str(payload.get("author") or ""),
    )
    if not result.get("ok"):
        return result
    return {"ok": True, "song": result, "submission": row}


def reject_song_submission(submission_id: str) -> dict[str, Any]:
    row = _set_submission_status(_SONGS_PATH, submission_id, "rejected")
    if not row:
        return {"ok": False, "error": "Submission not found."}
    return {"ok": True, "submission": row}


def approve_priest_submission(submission_id: str) -> dict[str, Any]:
    row = _set_submission_status(_PRIESTS_PATH, submission_id, "approved")
    if not row:
        return {"ok": False, "error": "Submission not found."}
    name = str((row.get("payload") or {}).get("name") or "").strip()
    if not name:
        return {"ok": False, "error": "Submission has no priest name."}
    names = community_store.append_celebrant_name(name)
    sync_celebrants_to_supabase_profiles()
    return {"ok": True, "celebrant_names": names, "submission": row}


def reject_priest_submission(submission_id: str) -> dict[str, Any]:
    row = _set_submission_status(_PRIESTS_PATH, submission_id, "rejected")
    if not row:
        return {"ok": False, "error": "Submission not found."}
    return {"ok": True, "submission": row}
