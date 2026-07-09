"""Pending song and priest submissions awaiting superadmin approval."""

from __future__ import annotations

import json
import logging
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

from services import community_store
from services.api_security import AuthSession
from services.auth_config import supabase_enabled
from services.song_catalog import save_lyrics_song

logger = logging.getLogger(__name__)

_PROJECT_ROOT = Path(__file__).resolve().parents[1]
_SONGS_PATH = _PROJECT_ROOT / "data" / "pending_song_submissions.json"
_PRIESTS_PATH = _PROJECT_ROOT / "data" / "pending_priest_submissions.json"
_JSON_MIGRATED_FLAG = _PROJECT_ROOT / "data" / ".content_submissions_migrated"


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


def _service_client():
    from services.supabase_client import get_service_client

    return get_service_client()


def _parish_id_for_user(user_id: str) -> str | None:
    try:
        from services.parish_store import get_user_parish_context

        ctx = get_user_parish_context(user_id)
        pid = (ctx or {}).get("parish_id")
        return str(pid).strip() if pid else None
    except Exception:
        return None


def _format_db_row(row: dict[str, Any]) -> dict[str, Any]:
    rid = row.get("id")
    return {
        "id": str(rid) if rid is not None else "",
        "status": row.get("status") or "pending",
        "created_at": row.get("created_at") or "",
        "resolved_at": row.get("resolved_at"),
        "submitted_by_user_id": row.get("submitted_by_user_id"),
        "submitted_by_email": row.get("submitted_by_email") or "",
        "payload": row.get("payload") if isinstance(row.get("payload"), dict) else {},
    }


def _log_admin_action(
    *,
    actor_user_id: str | None,
    action: str,
    entity_type: str,
    entity_id: str,
    detail: dict[str, Any] | None = None,
) -> None:
    if not supabase_enabled():
        return
    try:
        _service_client().table("admin_audit_log").insert(
            {
                "actor_user_id": actor_user_id,
                "action": action,
                "entity_type": entity_type,
                "entity_id": entity_id,
                "detail": detail or {},
            }
        ).execute()
    except Exception as exc:
        logger.warning("admin_audit_log insert failed: %s", exc)


def _migrate_json_store_if_needed() -> None:
    if not supabase_enabled() or _JSON_MIGRATED_FLAG.is_file():
        return
    client = _service_client()
    inserted = 0
    for kind, path in (("song", _SONGS_PATH), ("priest", _PRIESTS_PATH)):
        for row in _read_rows(path):
            legacy_id = str(row.get("id") or "").strip()
            if not legacy_id:
                continue
            existing = (
                client.table("content_submissions")
                .select("id")
                .eq("legacy_id", legacy_id)
                .limit(1)
                .execute()
            )
            if existing.data:
                continue
            payload = row.get("payload") if isinstance(row.get("payload"), dict) else {}
            uid = row.get("submitted_by_user_id")
            parish_id = _parish_id_for_user(str(uid)) if uid else None
            client.table("content_submissions").insert(
                {
                    "kind": kind,
                    "status": row.get("status") or "pending",
                    "payload": payload,
                    "submitted_by_user_id": uid,
                    "submitted_by_email": row.get("submitted_by_email") or "",
                    "parish_id": parish_id,
                    "legacy_id": legacy_id,
                    "created_at": row.get("created_at") or _now_iso(),
                    "resolved_at": row.get("resolved_at"),
                }
            ).execute()
            inserted += 1
    _JSON_MIGRATED_FLAG.parent.mkdir(parents=True, exist_ok=True)
    _JSON_MIGRATED_FLAG.write_text(_now_iso(), encoding="utf-8")
    if inserted:
        logger.info("Migrated %s content submission row(s) from JSON to Supabase.", inserted)


def _list_pending_db(kind: str) -> list[dict[str, Any]]:
    _migrate_json_store_if_needed()
    result = (
        _service_client()
        .table("content_submissions")
        .select("*")
        .eq("kind", kind)
        .eq("status", "pending")
        .order("created_at", desc=False)
        .execute()
    )
    return [_format_db_row(row) for row in (result.data or [])]


def _insert_submission_db(
    session: AuthSession,
    *,
    kind: str,
    payload: dict[str, Any],
) -> dict[str, Any]:
    _migrate_json_store_if_needed()
    uid = session.user.user_id
    row = {
        "kind": kind,
        "status": "pending",
        "payload": payload,
        "submitted_by_user_id": uid,
        "submitted_by_email": session.user.email or "",
        "parish_id": _parish_id_for_user(uid),
    }
    result = _service_client().table("content_submissions").insert(row).execute()
    data = (result.data or [None])[0] or {}
    return _format_db_row(data)


def _resolve_submission_db(
    submission_id: str,
    status: str,
    *,
    acting_user_id: str | None = None,
) -> Optional[dict[str, Any]]:
    _migrate_json_store_if_needed()
    sid = (submission_id or "").strip()
    if not sid:
        return None
    client = _service_client()
    query = client.table("content_submissions").select("*").eq("status", "pending")
    result = query.eq("id", sid).limit(1).execute()
    rows = list(result.data or [])
    if not rows:
        legacy = query.eq("legacy_id", sid).limit(1).execute()
        rows = list(legacy.data or [])
    if not rows:
        return None
    target = rows[0]
    resolved_at = _now_iso()
    client.table("content_submissions").update(
        {
            "status": status,
            "resolved_at": resolved_at,
            "resolved_by": acting_user_id,
        }
    ).eq("id", target["id"]).execute()
    target["status"] = status
    target["resolved_at"] = resolved_at
    target["resolved_by"] = acting_user_id
    return _format_db_row(target)


def submit_pending_song(
    session: AuthSession,
    *,
    title: str,
    lyrics: str,
    sections: list[str],
    language: str = "English",
    author: str = "",
) -> dict[str, Any]:
    payload = {
        "title": title.strip(),
        "lyrics": lyrics.strip(),
        "sections": sections,
        "language": language,
        "author": author.strip(),
    }
    if supabase_enabled():
        row = _insert_submission_db(session, kind="song", payload=payload)
        return {
            "ok": True,
            "pending": True,
            "submission_id": row.get("id"),
            "message": "Song submitted for superadmin approval.",
        }
    rows = _read_rows(_SONGS_PATH)
    row = {
        "id": uuid.uuid4().hex,
        "status": "pending",
        "created_at": _now_iso(),
        "submitted_by_user_id": session.user.user_id,
        "submitted_by_email": session.user.email or "",
        "payload": payload,
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
    key = clean.lower()
    if supabase_enabled():
        for row in _list_pending_db("priest"):
            payload = row.get("payload") or {}
            if str(payload.get("name") or "").strip().lower() == key:
                return {"ok": False, "error": "This priest name is already awaiting approval."}
        inserted = _insert_submission_db(session, kind="priest", payload={"name": clean})
        return {
            "ok": True,
            "pending": True,
            "submission_id": inserted.get("id"),
            "message": "Priest submitted for superadmin approval.",
        }
    rows = _read_rows(_PRIESTS_PATH)
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
    if supabase_enabled():
        return _list_pending_db("song")
    return _pending(_read_rows(_SONGS_PATH))


def list_pending_priests() -> list[dict[str, Any]]:
    if supabase_enabled():
        return _list_pending_db("priest")
    return _pending(_read_rows(_PRIESTS_PATH))


def _set_submission_status_json(
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
    from services.parish_store import _sync_legacy_church_profile, get_parish_by_id

    names = community_store.list_celebrant_names()
    client = _service_client()
    members = (
        client.table("parish_members")
        .select("user_id, parish_id")
        .eq("status", "active")
        .execute()
    )
    seen: set[str] = set()
    for row in members.data or []:
        pid = str(row.get("parish_id") or "").strip()
        uid = str(row.get("user_id") or "").strip()
        if not pid or pid in seen:
            continue
        seen.add(pid)
        client.table("parishes").update({"celebrant_names": names}).eq("id", pid).execute()
        parish = get_parish_by_id(pid)
        if parish and uid:
            _sync_legacy_church_profile(uid, parish)


def approve_song_submission(
    submission_id: str,
    *,
    acting_user_id: str | None = None,
) -> dict[str, Any]:
    if supabase_enabled():
        row = _resolve_submission_db(
            submission_id, "approved", acting_user_id=acting_user_id
        )
    else:
        row = _set_submission_status_json(_SONGS_PATH, submission_id, "approved")
    if not row:
        return {"ok": False, "error": "Submission not found."}
    payload = row.get("payload") or {}
    result = save_lyrics_song(
        title=str(payload.get("title") or ""),
        lyrics=str(payload.get("lyrics") or ""),
        sections=list(payload.get("sections") or []),
        language=str(payload.get("language") or "English"),
        author=str(payload.get("author") or ""),
        updated_by=acting_user_id,
    )
    if not result.get("ok"):
        return result
    _log_admin_action(
        actor_user_id=acting_user_id,
        action="approve",
        entity_type="song_submission",
        entity_id=str(row.get("id") or submission_id),
        detail={"title": payload.get("title")},
    )
    return {"ok": True, "song": result, "submission": row}


def reject_song_submission(
    submission_id: str,
    *,
    acting_user_id: str | None = None,
) -> dict[str, Any]:
    if supabase_enabled():
        row = _resolve_submission_db(
            submission_id, "rejected", acting_user_id=acting_user_id
        )
    else:
        row = _set_submission_status_json(_SONGS_PATH, submission_id, "rejected")
    if not row:
        return {"ok": False, "error": "Submission not found."}
    _log_admin_action(
        actor_user_id=acting_user_id,
        action="reject",
        entity_type="song_submission",
        entity_id=str(row.get("id") or submission_id),
        detail={"title": (row.get("payload") or {}).get("title")},
    )
    return {"ok": True, "submission": row}


def approve_priest_submission(
    submission_id: str,
    *,
    acting_user_id: str | None = None,
) -> dict[str, Any]:
    if supabase_enabled():
        row = _resolve_submission_db(
            submission_id, "approved", acting_user_id=acting_user_id
        )
    else:
        row = _set_submission_status_json(_PRIESTS_PATH, submission_id, "approved")
    if not row:
        return {"ok": False, "error": "Submission not found."}
    name = str((row.get("payload") or {}).get("name") or "").strip()
    if not name:
        return {"ok": False, "error": "Submission has no priest name."}
    names = community_store.append_celebrant_name(name)
    sync_celebrants_to_supabase_profiles()
    _log_admin_action(
        actor_user_id=acting_user_id,
        action="approve",
        entity_type="priest_submission",
        entity_id=str(row.get("id") or submission_id),
        detail={"name": name},
    )
    return {"ok": True, "celebrant_names": names, "submission": row}


def reject_priest_submission(
    submission_id: str,
    *,
    acting_user_id: str | None = None,
) -> dict[str, Any]:
    if supabase_enabled():
        row = _resolve_submission_db(
            submission_id, "rejected", acting_user_id=acting_user_id
        )
    else:
        row = _set_submission_status_json(_PRIESTS_PATH, submission_id, "rejected")
    if not row:
        return {"ok": False, "error": "Submission not found."}
    _log_admin_action(
        actor_user_id=acting_user_id,
        action="reject",
        entity_type="priest_submission",
        entity_id=str(row.get("id") or submission_id),
        detail={"name": (row.get("payload") or {}).get("name")},
    )
    return {"ok": True, "submission": row}
