"""Choir practice share links — frozen song lyrics for non-users."""

from __future__ import annotations

import json
import logging
import secrets
import uuid
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Optional

from services.auth_config import supabase_enabled
from services.practice_access import hash_pin, pin_required, verify_pin
from services.song_catalog import find_catalog_row_by_id

logger = logging.getLogger(__name__)

_PROJECT_ROOT = Path(__file__).resolve().parents[1]
_LOCAL_PATH = _PROJECT_ROOT / "data" / "choir_practice_shares.json"
_DEFAULT_TTL_DAYS = 5
_MAX_SONGS = 24
_MAX_LYRICS_LEN = 12000


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _now_iso() -> str:
    return _now().isoformat()


def _read_local_rows() -> list[dict[str, Any]]:
    if not _LOCAL_PATH.is_file():
        return []
    try:
        raw = json.loads(_LOCAL_PATH.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return []
    return [x for x in raw if isinstance(x, dict)]


def _write_local_rows(rows: list[dict[str, Any]]) -> None:
    _LOCAL_PATH.parent.mkdir(parents=True, exist_ok=True)
    _LOCAL_PATH.write_text(json.dumps(rows, ensure_ascii=False, indent=2), encoding="utf-8")


def _parse_expires(expires: Any) -> Optional[datetime]:
    if not expires:
        return None
    try:
        exp = datetime.fromisoformat(str(expires).replace("Z", "+00:00"))
        if exp.tzinfo is None:
            exp = exp.replace(tzinfo=timezone.utc)
        return exp
    except ValueError:
        return None


def _row_live(row: Optional[dict[str, Any]]) -> bool:
    if not row:
        return False
    if row.get("revoked_at"):
        return False
    exp = _parse_expires(row.get("expires_at"))
    if not exp:
        return False
    return exp > _now()


def _normalize_pin(pin: Optional[str]) -> str:
    clean = (pin or "").strip()
    digits = "".join(ch for ch in clean if ch.isdigit())
    if len(digits) != 6:
        raise ValueError("A 6-digit PIN is required for practice shares.")
    return digits


def _normalize_songs(songs: list[dict[str, Any]]) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    seen: set[str] = set()
    for raw in songs[:_MAX_SONGS]:
        if not isinstance(raw, dict):
            continue
        hymn_id = str(raw.get("hymn_id") or raw.get("id") or "").strip()
        title = str(raw.get("title") or "").strip()
        lyrics = str(raw.get("lyrics") or "").strip()
        if not hymn_id or not title or not lyrics:
            continue
        if len(lyrics) > _MAX_LYRICS_LEN:
            lyrics = lyrics[:_MAX_LYRICS_LEN]
        dedupe = hymn_id + "|" + str(raw.get("slot_key") or "")
        if dedupe in seen:
            continue
        seen.add(dedupe)
        out.append(
            {
                "slot_key": str(raw.get("slot_key") or "").strip(),
                "slot_label": str(raw.get("slot_label") or "").strip() or "Song",
                "section": str(raw.get("section") or "").strip().lower(),
                "hymn_id": hymn_id,
                "title": title,
                "author": str(raw.get("author") or "").strip(),
                "language": str(raw.get("language") or "").strip(),
                "lyrics": lyrics,
            }
        )
    return out


def _enrich_songs_from_catalog(songs: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Fill missing lyrics from the local catalog when the client only sent ids."""
    out: list[dict[str, Any]] = []
    for raw in songs:
        item = dict(raw)
        lyrics = str(item.get("lyrics") or "").strip()
        hymn_id = str(item.get("hymn_id") or "").strip()
        if not lyrics and hymn_id:
            sec, row = find_catalog_row_by_id(hymn_id)
            if row:
                lyrics = str(row.get("lyrics") or "").strip()
                if not item.get("title"):
                    item["title"] = str(row.get("title") or "").strip()
                if not item.get("author"):
                    item["author"] = str(row.get("author") or "").strip()
                if not item.get("language"):
                    item["language"] = str(row.get("language") or "").strip()
                if not item.get("section") and sec:
                    item["section"] = sec
        if not lyrics:
            continue
        item["lyrics"] = lyrics
        out.append(item)
    return out


def _shape_public(row: dict[str, Any], *, access_granted: bool) -> dict[str, Any]:
    snapshot = row.get("song_snapshot")
    songs = snapshot if isinstance(snapshot, list) else []
    mass_date = row.get("mass_date")
    needs_pin = pin_required(row.get("optional_pin"))
    return {
        "ok": True,
        "requires_pin": needs_pin and not access_granted,
        "mass_date": str(mass_date) if mass_date else "",
        "mass_title": str(row.get("mass_title") or "").strip(),
        "parish_name": str(row.get("parish_name") or "").strip(),
        "celebrant": str(row.get("celebrant") or "").strip(),
        "expires_at": row.get("expires_at"),
        "songs": songs if access_granted or not needs_pin else [],
    }


def _service_client():
    from services.supabase_client import get_service_client

    return get_service_client()


def create_practice_share(
    *,
    created_by_user_id: Optional[str],
    parish_id: Optional[str],
    mass_date: str,
    mass_title: str = "",
    parish_name: str = "",
    celebrant: str = "",
    songs: list[dict[str, Any]],
    ttl_days: int = _DEFAULT_TTL_DAYS,
    optional_pin: Optional[str] = None,
) -> dict[str, Any]:
    date_str = (mass_date or "").strip()
    try:
        parsed_date = date.fromisoformat(date_str)
    except ValueError as exc:
        raise ValueError("mass_date must be YYYY-MM-DD.") from exc

    normalized = _normalize_songs(_enrich_songs_from_catalog(songs))
    if not normalized:
        raise ValueError("At least one song with lyrics is required.")

    pin = _normalize_pin(optional_pin)
    pin_stored = hash_pin(pin)
    token = secrets.token_urlsafe(24)
    expires_at = (_now() + timedelta(days=max(1, min(int(ttl_days), 14)))).isoformat()
    payload = {
        "token": token,
        "parish_id": (parish_id or "").strip() or None,
        "created_by": (created_by_user_id or "").strip() or None,
        "mass_date": parsed_date.isoformat(),
        "mass_title": (mass_title or "").strip(),
        "parish_name": (parish_name or "").strip(),
        "celebrant": (celebrant or "").strip(),
        "song_snapshot": normalized,
        "optional_pin": pin_stored,
        "expires_at": expires_at,
    }

    if supabase_enabled():
        try:
            result = _service_client().table("choir_practice_shares").insert(payload).execute()
            rows = result.data or []
            if rows:
                row = rows[0]
            else:
                raise RuntimeError("Practice share create did not persist.")
        except Exception as exc:
            if not _supabase_unavailable(exc):
                raise
            logger.warning("choir_practice_shares insert failed; using local store (%s)", exc)
            row = None
        if row is None:
            row = {
                "id": uuid.uuid4().hex,
                "created_at": _now_iso(),
                "revoked_at": None,
                **payload,
            }
            rows = _read_local_rows()
            rows.append(row)
            _write_local_rows(rows)
    else:
        row = {
            "id": uuid.uuid4().hex,
            "created_at": _now_iso(),
            "revoked_at": None,
            **payload,
        }
        rows = _read_local_rows()
        rows.append(row)
        _write_local_rows(rows)

    return {
        "ok": True,
        "token": row.get("token") or token,
        "expires_at": row.get("expires_at") or expires_at,
        "song_count": len(normalized),
    }


def _local_row_by_token(tok: str) -> Optional[dict[str, Any]]:
    return next((r for r in _read_local_rows() if str(r.get("token") or "") == tok), None)


def _supabase_unavailable(exc: BaseException) -> bool:
    msg = str(exc)
    return "choir_practice_shares" in msg or "PGRST205" in msg


def get_practice_share_by_token(token: str) -> Optional[dict[str, Any]]:
    tok = (token or "").strip()
    if not tok:
        return None
    row: Optional[dict[str, Any]] = None
    if supabase_enabled():
        try:
            result = (
                _service_client()
                .table("choir_practice_shares")
                .select("*")
                .eq("token", tok)
                .limit(1)
                .execute()
            )
            rows = result.data or []
            row = rows[0] if rows else None
        except Exception as exc:
            if not _supabase_unavailable(exc):
                raise
            logger.warning("choir_practice_shares table unavailable; using local store (%s)", exc)
    if not row:
        row = _local_row_by_token(tok)
    if not _row_live(row):
        return None
    return row


def fetch_practice_share(
    token: str,
    *,
    unlocked: bool = False,
) -> dict[str, Any]:
    row = get_practice_share_by_token(token)
    if not row:
        return {"ok": False, "error": "This practice link is invalid or has expired."}
    stored_pin = row.get("optional_pin")
    access_granted = not pin_required(stored_pin) or unlocked
    shaped = _shape_public(row, access_granted=access_granted)
    if shaped.get("requires_pin"):
        shaped["error"] = "PIN required."
    return shaped


def verify_practice_share_pin(token: str, pin: str) -> dict[str, Any]:
    row = get_practice_share_by_token(token)
    if not row:
        return {"ok": False, "error": "This practice link is invalid or has expired."}
    stored_pin = row.get("optional_pin")
    if not pin_required(stored_pin):
        return fetch_practice_share(token, unlocked=True)
    if not verify_pin(stored_pin, pin):
        return {"ok": False, "error": "Incorrect PIN.", "requires_pin": True}
    return fetch_practice_share(token, unlocked=True)


def revoke_practice_share(token: str, *, actor_user_id: Optional[str] = None) -> dict[str, Any]:
    tok = (token or "").strip()
    if not tok:
        return {"ok": False, "error": "token is required."}
    row = get_practice_share_by_token(token)
    if not row:
        return {"ok": False, "error": "Share not found or already expired."}
    now = _now_iso()
    if supabase_enabled():
        _service_client().table("choir_practice_shares").update({"revoked_at": now}).eq("token", tok).execute()
    else:
        rows = _read_local_rows()
        for item in rows:
            if str(item.get("token") or "") == tok:
                item["revoked_at"] = now
        _write_local_rows(rows)
    logger.info("Practice share revoked token=%s actor=%s", tok[:8], actor_user_id or "")
    return {"ok": True}
