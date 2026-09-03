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
_PARISH_RENAME_PATH = _PROJECT_ROOT / "data" / "pending_parish_rename_submissions.json"
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
        "parish_id": str(row.get("parish_id") or "") if row.get("parish_id") else "",
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
    gospel_moods: list[str] | None = None,
    parish_hymn_id: str | None = None,
    parish_section: str | None = None,
) -> dict[str, Any]:
    from services.song_catalog import find_catalog_matches_by_title, format_song_title_case

    clean_title = format_song_title_case(str(title or "")).strip()
    clean_lyrics = str(lyrics or "").strip()
    if not clean_title or not clean_lyrics:
        return {"ok": False, "error": "Song title and lyrics are required."}

    catalog_matches = find_catalog_matches_by_title(clean_title)
    exact_catalog = [m for m in catalog_matches if m.get("match") == "exact"]
    pending_matches: list[dict[str, Any]] = []
    title_key = clean_title.lower()
    for row in list_pending_songs():
        payload = row.get("payload") if isinstance(row.get("payload"), dict) else {}
        pending_title = str(payload.get("title") or "").strip()
        if pending_title.lower() == title_key:
            pending_matches.append(
                {
                    "id": row.get("id"),
                    "title": pending_title,
                    "match": "pending",
                    "submitted_by_email": row.get("submitted_by_email") or "",
                }
            )

    # Exact global match should be handled by parish override path, not pending submission.
    if exact_catalog:
        names = [m.get("title") for m in exact_catalog if m.get("title")]
        label = names[0] if names else clean_title
        return {
            "ok": False,
            "duplicate": True,
            "error": (
                f"“{label}” already exists in the catalog. "
                "Open it from the Song Library and save a parish version."
            ),
            "matches": exact_catalog + [
                m for m in catalog_matches if m.get("match") != "exact"
            ],
        }

    if pending_matches:
        # Allow re-save to parish catalog while an identical title is already pending.
        # Reuse the existing pending submission id when possible.
        existing_pending_id = str(pending_matches[0].get("id") or "").strip() or None
    else:
        existing_pending_id = None

    payload = {
        "title": clean_title,
        "lyrics": clean_lyrics,
        "sections": sections,
        "language": language,
        "author": author.strip(),
        "gospel_moods": list(gospel_moods or []),
        "possible_matches": catalog_matches,
        "parish_hymn_id": (parish_hymn_id or "").strip() or None,
        "parish_section": (parish_section or "").strip().lower() or None,
    }
    if supabase_enabled():
        if existing_pending_id:
            row = {"id": existing_pending_id, "payload": payload}
            try:
                _service_client().table("content_submissions").update(
                    {"payload": payload}
                ).eq("id", existing_pending_id).execute()
            except Exception:
                pass
        else:
            row = _insert_submission_db(session, kind="song", payload=payload)
        return {
            "ok": True,
            "pending": True,
            "submission_id": row.get("id"),
            "possible_matches": catalog_matches,
            "message": (
                "Saved to your parish catalog and submitted for superadmin approval "
                "before it appears in the global catalog."
                + (
                    f" Note: {len(catalog_matches)} similar title(s) already in the catalog."
                    if catalog_matches
                    else ""
                )
            ),
        }
    rows = _read_rows(_SONGS_PATH)
    if existing_pending_id:
        for item in rows:
            if str(item.get("id") or "") == existing_pending_id:
                item["payload"] = payload
                row = item
                break
        else:
            row = {
                "id": existing_pending_id,
                "status": "pending",
                "created_at": _now_iso(),
                "submitted_by_user_id": session.user.user_id,
                "submitted_by_email": session.user.email or "",
                "payload": payload,
            }
            rows.append(row)
    else:
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
        "possible_matches": catalog_matches,
        "message": (
            "Saved to your parish catalog and submitted for superadmin approval "
            "before it appears in the global catalog."
        ),
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


def list_pending_parish_renames() -> list[dict[str, Any]]:
    if supabase_enabled():
        return _list_pending_db("parish_name")
    return _pending(_read_rows(_PARISH_RENAME_PATH))


def submit_pending_parish_rename(session: AuthSession, *, community_name: str) -> dict[str, Any]:
    clean = (community_name or "").strip()
    if len(clean) < 2:
        return {"ok": False, "error": "Parish name must be at least 2 characters."}

    from services.membership_config import is_superadmin_user
    from services.parish_store import get_parish_by_id, get_user_parish_context

    if is_superadmin_user(session.user):
        return {"ok": False, "error": "Superadmins can rename parishes directly in Superadmin → Parishes."}

    ctx = get_user_parish_context(session.user.user_id, access_token=session.token)
    if not ctx:
        return {"ok": False, "error": "Parish membership not found."}
    if (ctx.get("parish_role") or "").strip().lower() != "president":
        return {"ok": False, "error": "Only the parish president can request a name change."}
    if (ctx.get("membership_status") or "").strip().lower() != "approved":
        return {"ok": False, "error": "Parish membership must be approved before requesting a rename."}

    parish_id = str(ctx.get("parish_id") or "").strip()
    current = (ctx.get("community_name") or "").strip()
    if not parish_id:
        return {"ok": False, "error": "Parish not found."}
    if clean.lower() == current.lower():
        return {"ok": False, "error": "That is already the current parish name."}

    for row in list_pending_parish_renames():
        payload = row.get("payload") if isinstance(row.get("payload"), dict) else {}
        pending_pid = str(row.get("parish_id") or payload.get("parish_id") or "").strip()
        if pending_pid == parish_id:
            return {"ok": False, "error": "A parish name change is already awaiting approval."}

    parish = get_parish_by_id(parish_id) or {}
    payload = {
        "parish_id": parish_id,
        "previous_name": current or (parish.get("community_name") or ""),
        "community_name": clean,
    }
    if supabase_enabled():
        # Ensure parish_id is on the submission row for inbox filtering.
        inserted = _insert_submission_db(session, kind="parish_name", payload=payload)
        try:
            _service_client().table("content_submissions").update(
                {"parish_id": parish_id}
            ).eq("id", inserted.get("id")).execute()
        except Exception:
            pass
        return {
            "ok": True,
            "pending": True,
            "submission_id": inserted.get("id"),
            "message": "Parish name change submitted for superadmin approval.",
        }

    rows = _read_rows(_PARISH_RENAME_PATH)
    row = {
        "id": uuid.uuid4().hex,
        "status": "pending",
        "created_at": _now_iso(),
        "submitted_by_user_id": session.user.user_id,
        "submitted_by_email": session.user.email or "",
        "parish_id": parish_id,
        "payload": payload,
    }
    rows.append(row)
    _write_rows(_PARISH_RENAME_PATH, rows)
    return {
        "ok": True,
        "pending": True,
        "submission_id": row["id"],
        "message": "Parish name change submitted for superadmin approval.",
    }


def approve_parish_rename_submission(
    submission_id: str,
    *,
    acting_user_id: str | None = None,
) -> dict[str, Any]:
    from services.parish_store import admin_rename_parish

    if supabase_enabled():
        row = _resolve_submission_db(
            submission_id, "approved", acting_user_id=acting_user_id
        )
    else:
        row = _set_submission_status_json(_PARISH_RENAME_PATH, submission_id, "approved")
    if not row:
        return {"ok": False, "error": "Submission not found."}
    payload = row.get("payload") if isinstance(row.get("payload"), dict) else {}
    parish_id = str(payload.get("parish_id") or row.get("parish_id") or "").strip()
    new_name = str(payload.get("community_name") or "").strip()
    if not parish_id or not new_name:
        return {"ok": False, "error": "Submission is missing parish id or name."}
    try:
        parish = admin_rename_parish(parish_id, new_name)
    except Exception as exc:
        return {"ok": False, "error": str(exc) or "Rename failed."}
    _log_admin_action(
        actor_user_id=acting_user_id,
        action="approve",
        entity_type="parish_name_submission",
        entity_id=str(row.get("id") or submission_id),
        detail={
            "parish_id": parish_id,
            "previous_name": payload.get("previous_name"),
            "community_name": new_name,
        },
    )
    return {"ok": True, "parish": parish, "submission": row}


def reject_parish_rename_submission(
    submission_id: str,
    *,
    acting_user_id: str | None = None,
) -> dict[str, Any]:
    if supabase_enabled():
        row = _resolve_submission_db(
            submission_id, "rejected", acting_user_id=acting_user_id
        )
    else:
        row = _set_submission_status_json(_PARISH_RENAME_PATH, submission_id, "rejected")
    if not row:
        return {"ok": False, "error": "Submission not found."}
    payload = row.get("payload") if isinstance(row.get("payload"), dict) else {}
    _log_admin_action(
        actor_user_id=acting_user_id,
        action="reject",
        entity_type="parish_name_submission",
        entity_id=str(row.get("id") or submission_id),
        detail={
            "parish_id": payload.get("parish_id"),
            "community_name": payload.get("community_name"),
        },
    )
    return {"ok": True, "submission": row}


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
        gospel_moods=list(payload.get("gospel_moods") or []) or None,
        updated_by=acting_user_id,
    )
    if not result.get("ok"):
        return result

    # Link parish-original song to the new global id (keeps parish copy usable).
    parish_id = str(row.get("parish_id") or "").strip()
    parish_hymn_id = str(payload.get("parish_hymn_id") or "").strip()
    parish_section = str(
        payload.get("parish_section")
        or (list(payload.get("sections") or [])[:1] or ["meditation"])[0]
        or "meditation"
    ).strip().lower()
    global_id = str(result.get("id") or "").strip()
    if parish_id and parish_hymn_id and global_id:
        try:
            from services.parish_hymn_overrides import mark_parish_song_promoted

            mark_parish_song_promoted(
                parish_id,
                hymn_id=parish_hymn_id,
                section=parish_section,
                global_hymn_id=global_id,
            )
        except Exception:
            logger.warning("Could not mark parish song as promoted", exc_info=True)

    # Only after SA approval does the song appear in Global recent history.
    if acting_user_id and global_id:
        try:
            from services.user_song_history import sync_user_song_history

            sync_user_song_history(
                acting_user_id,
                [
                    {
                        "title": str(result.get("title") or payload.get("title") or ""),
                        "section": parish_section,
                        "id": global_id,
                        "language": str(payload.get("language") or ""),
                        "kind": "new",
                    }
                ],
                is_superadmin=True,
            )
        except Exception:
            logger.warning("Could not sync approved song into global history", exc_info=True)

    _log_admin_action(
        actor_user_id=acting_user_id,
        action="approve",
        entity_type="song_submission",
        entity_id=str(row.get("id") or submission_id),
        detail={"title": payload.get("title"), "global_id": global_id},
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
