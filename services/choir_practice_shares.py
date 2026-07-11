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
from services.song_catalog import format_song_title_case, polish_lyrics_text

logger = logging.getLogger(__name__)

_PROJECT_ROOT = Path(__file__).resolve().parents[1]
_LOCAL_PATH = _PROJECT_ROOT / "data" / "choir_practice_shares.json"
_DEFAULT_TTL_HOURS = 1
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


_STRUCTURE_LABEL_RE = (
    r"^\s*[\[(]?\s*(pre[- ]?chorus|post[- ]?chorus|pre[- ]?verse|post[- ]?verse|"
    r"middle[- ]?8|refrain|verse|chorus|stanza|bridge|response|coda|intro|vamp|"
    r"outro|interlude|instrumental|ending|finale|hook|breakdown|spoken|solo|"
    r"ad[- ]?lib|tag|turnaround|chant)(\s*[\w\d.-]*)?\s*[\])]?\s*[:.)-]?\s*$"
)
_STRUCTURE_INLINE_RE = (
    r"^\s*(pre[- ]?chorus|post[- ]?chorus|pre[- ]?verse|post[- ]?verse|"
    r"middle[- ]?8|refrain|verse|chorus|stanza|bridge|response|coda|intro|vamp|"
    r"outro|interlude|instrumental|ending|finale|hook|breakdown|spoken|solo|"
    r"ad[- ]?lib|tag|turnaround|chant)\s*:\s*(.*)$"
)


def _normalize_structure_kind(raw: str) -> str:
    kind = (raw or "").strip().lower().replace("_", "-").replace(" ", "-")
    while "--" in kind:
        kind = kind.replace("--", "-")
    aliases = {
        "refrain": "chorus",
        "prechorus": "pre-chorus",
        "postchorus": "post-chorus",
        "middle8": "bridge",
        "middle-8": "bridge",
        "adlib": "ad-lib",
    }
    return aliases.get(kind, kind) or "verse"


def _blocks_from_lyrics(lyrics: str) -> list[dict[str, Any]]:
    """Split plain lyrics into editable practice blocks (practice-only, not catalog)."""
    import re

    text = polish_lyrics_text(lyrics or "").replace("\r\n", "\n").replace("\r", "\n").strip()
    if not text:
        return []
    label_re = re.compile(_STRUCTURE_LABEL_RE, re.I)
    inline_re = re.compile(_STRUCTURE_INLINE_RE, re.I)
    # Ensure blank line before structure headers so chunking works.
    lines = text.split("\n")
    normalized: list[str] = []
    for line in lines:
        stripped = line.strip()
        if stripped and normalized and normalized[-1] != "" and label_re.match(stripped):
            normalized.append("")
        normalized.append(line.rstrip())
    text = "\n".join(normalized).strip()
    chunks = re.split(r"\n\s*\n+", text)
    blocks: list[dict[str, Any]] = []
    for i, part in enumerate(chunks):
        part_lines = [ln.strip() for ln in part.split("\n") if ln.strip()]
        if not part_lines:
            continue
        first = part_lines[0]
        kind = "verse"
        label = "Verse"
        body_lines = part_lines
        m = label_re.match(first)
        if m:
            kind = _normalize_structure_kind(m.group(1) or "")
            label = re.sub(r"^\[|\]$", "", first).strip()
            label = re.sub(r"[:.)\-]+\s*$", "", label).strip() or kind.title()
            body_lines = part_lines[1:]
        else:
            inline = inline_re.match(first)
            if inline:
                kind = _normalize_structure_kind(inline.group(1) or "")
                label = (inline.group(1) or kind).strip()
                remainder = (inline.group(2) or "").strip()
                body_lines = ([remainder] if remainder else []) + part_lines[1:]
        body_lines = [ln for ln in body_lines if not label_re.match(ln)]
        body = "\n".join(body_lines).strip()
        if not body:
            continue
        blocks.append(
            {
                "id": f"b{i}-{uuid.uuid4().hex[:8]}",
                "kind": kind[:32],
                "label": label[:80],
                "body": body[:_MAX_LYRICS_LEN],
                "enabled": True,
            }
        )
    if not blocks and text:
        blocks.append(
            {
                "id": f"b0-{uuid.uuid4().hex[:8]}",
                "kind": "verse",
                "label": "Lyrics",
                "body": text[:_MAX_LYRICS_LEN],
                "enabled": True,
            }
        )
    return blocks[:48]


def _ensure_song_blocks(song: dict[str, Any]) -> dict[str, Any]:
    item = dict(song)
    blocks = item.get("blocks")
    if isinstance(blocks, list) and blocks:
        item["blocks"] = _normalize_practice_blocks(blocks)
        item["lyrics"] = _lyrics_from_blocks(item["blocks"], include_disabled=True)
        return item
    lyrics = str(item.get("lyrics") or "")
    item["blocks"] = _blocks_from_lyrics(lyrics)
    if item["blocks"]:
        item["lyrics"] = _lyrics_from_blocks(item["blocks"], include_disabled=True)
    return item


def _normalize_songs(songs: list[dict[str, Any]]) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    seen: set[str] = set()
    for raw in songs[:_MAX_SONGS]:
        if not isinstance(raw, dict):
            continue
        hymn_id = str(raw.get("hymn_id") or raw.get("id") or "").strip()
        title = format_song_title_case(str(raw.get("title") or "").strip())
        lyrics = polish_lyrics_text(str(raw.get("lyrics") or ""))
        if not hymn_id or not title or not lyrics:
            continue
        if len(lyrics) > _MAX_LYRICS_LEN:
            lyrics = lyrics[:_MAX_LYRICS_LEN]
        dedupe = hymn_id + "|" + str(raw.get("slot_key") or "")
        if dedupe in seen:
            continue
        seen.add(dedupe)
        song = {
            "slot_key": str(raw.get("slot_key") or "").strip(),
            "slot_label": str(raw.get("slot_label") or "").strip() or "Song",
            "section": str(raw.get("section") or "").strip().lower(),
            "hymn_id": hymn_id,
            "title": title,
            "author": str(raw.get("author") or "").strip(),
            "language": str(raw.get("language") or "").strip(),
            "lyrics": lyrics,
        }
        if isinstance(raw.get("blocks"), list) and raw.get("blocks"):
            song["blocks"] = raw["blocks"]
        out.append(_ensure_song_blocks(song))
    return out


def _enrich_songs_from_catalog(songs: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Fill missing lyrics from the local catalog when the client only sent ids."""
    from services.song_catalog import load_catalog

    catalog = load_catalog()
    by_id: dict[str, tuple[str, dict[str, Any]]] = {}
    for sec, rows in (catalog or {}).items():
        if not isinstance(rows, list):
            continue
        for row in rows:
            if not isinstance(row, dict):
                continue
            hid = str(row.get("id") or "").strip()
            if hid and hid not in by_id:
                by_id[hid] = (str(sec), row)

    out: list[dict[str, Any]] = []
    for raw in songs:
        item = dict(raw)
        lyrics = str(item.get("lyrics") or "").strip()
        hymn_id = str(item.get("hymn_id") or "").strip()
        if not lyrics and hymn_id:
            hit = by_id.get(hymn_id)
            if hit:
                sec, row = hit
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
        item["lyrics"] = polish_lyrics_text(lyrics)
        out.append(item)
    return out


def _lyrics_from_blocks(blocks: list[Any], *, include_disabled: bool) -> str:
    parts: list[str] = []
    for raw in blocks:
        if not isinstance(raw, dict):
            continue
        if not include_disabled and not raw.get("enabled", True):
            continue
        label = str(raw.get("label") or raw.get("kind") or "Verse").strip()
        body = str(raw.get("body") or "").strip()
        if not body and not include_disabled:
            continue
        parts.append(f"{label}\n{body}".strip())
    return "\n\n".join(parts).strip()


def _snapshot_revision(songs: list[Any]) -> str:
    import hashlib

    try:
        payload = json.dumps(songs, ensure_ascii=False, sort_keys=True, default=str)
    except (TypeError, ValueError):
        payload = str(songs)
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()[:16]


def _shape_public(row: dict[str, Any], *, access_granted: bool, can_edit: bool = False) -> dict[str, Any]:
    snapshot = row.get("song_snapshot")
    songs = snapshot if isinstance(snapshot, list) else []
    mass_date = row.get("mass_date")
    needs_pin = pin_required(row.get("optional_pin"))
    public_songs: list[dict[str, Any]] = []
    if access_granted or not needs_pin:
        for song in songs:
            if not isinstance(song, dict):
                continue
            item = _ensure_song_blocks(dict(song))
            blocks = item.get("blocks")
            if isinstance(blocks, list) and blocks:
                if can_edit:
                    item["blocks"] = blocks
                    item["lyrics"] = _lyrics_from_blocks(blocks, include_disabled=True)
                else:
                    visible = [b for b in blocks if isinstance(b, dict) and b.get("enabled", True)]
                    item["blocks"] = visible
                    item["lyrics"] = _lyrics_from_blocks(visible, include_disabled=False)
            public_songs.append(item)
    return {
        "ok": True,
        "requires_pin": needs_pin and not access_granted,
        "can_edit": bool(can_edit and access_granted),
        "revision": _snapshot_revision(songs),
        "mass_date": str(mass_date) if mass_date else "",
        "mass_title": str(row.get("mass_title") or "").strip(),
        "parish_name": str(row.get("parish_name") or "").strip(),
        "celebrant": str(row.get("celebrant") or "").strip(),
        "expires_at": row.get("expires_at"),
        "songs": public_songs,
    }


def _service_client():
    from services.supabase_client import get_service_client

    return get_service_client()


def _compute_expires_at(*, ttl_hours: int = _DEFAULT_TTL_HOURS) -> datetime:
    """Expire a fixed number of hours after generation (not Mass date)."""
    hours = max(1, min(int(ttl_hours), 24))
    return _now() + timedelta(hours=hours)


def create_practice_share(
    *,
    created_by_user_id: Optional[str],
    parish_id: Optional[str],
    mass_date: str,
    mass_title: str = "",
    parish_name: str = "",
    celebrant: str = "",
    songs: list[dict[str, Any]],
    ttl_days: int = 0,
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
    # ttl_days is ignored — practice links always expire 1 hour after generation.
    _ = ttl_days
    expires_at = _compute_expires_at(ttl_hours=_DEFAULT_TTL_HOURS).isoformat()
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
    can_edit: bool = False,
) -> dict[str, Any]:
    row = get_practice_share_by_token(token)
    if not row:
        return {"ok": False, "error": "This practice link is invalid or has expired."}
    stored_pin = row.get("optional_pin")
    access_granted = not pin_required(stored_pin) or unlocked or can_edit
    shaped = _shape_public(row, access_granted=access_granted, can_edit=can_edit)
    if shaped.get("requires_pin"):
        shaped["error"] = "PIN required."
    return shaped


def _normalize_practice_blocks(blocks: Any) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    if not isinstance(blocks, list):
        return out
    for i, raw in enumerate(blocks[:48]):
        if not isinstance(raw, dict):
            continue
        body = str(raw.get("body") or "").strip()
        if len(body) > _MAX_LYRICS_LEN:
            body = body[:_MAX_LYRICS_LEN]
        kind = str(raw.get("kind") or "verse").strip().lower() or "verse"
        if kind == "refrain":
            kind = "chorus"
        label = str(raw.get("label") or kind.title()).strip()[:80] or kind.title()
        out.append(
            {
                "id": str(raw.get("id") or f"b{i}"),
                "kind": kind[:32],
                "label": label,
                "body": body,
                "enabled": bool(raw.get("enabled", True)),
            }
        )
    return out


def update_practice_share_lyrics(
    token: str,
    *,
    songs_update: list[dict[str, Any]],
) -> dict[str, Any]:
    """Update practice-only lyric blocks on a share. Does not touch the hymn catalog."""
    row = get_practice_share_by_token(token)
    if not row:
        return {"ok": False, "error": "This practice link is invalid or has expired."}
    snapshot = row.get("song_snapshot")
    if not isinstance(snapshot, list):
        return {"ok": False, "error": "No songs on this practice link."}

    by_key: dict[str, dict[str, Any]] = {}
    for raw in songs_update:
        if not isinstance(raw, dict):
            continue
        key = str(raw.get("hymn_id") or "").strip()
        slot = str(raw.get("slot_key") or "").strip()
        dedupe = key + "|" + slot
        blocks = _normalize_practice_blocks(raw.get("blocks"))
        if not blocks:
            continue
        by_key[dedupe] = {
            "blocks": blocks,
            "lyrics": _lyrics_from_blocks(blocks, include_disabled=True),
        }

    if not by_key:
        return {"ok": False, "error": "No lyric blocks to save."}

    new_snapshot: list[dict[str, Any]] = []
    for song in snapshot:
        if not isinstance(song, dict):
            continue
        item = dict(song)
        dedupe = str(item.get("hymn_id") or "").strip() + "|" + str(item.get("slot_key") or "").strip()
        patch = by_key.get(dedupe)
        if patch:
            item["blocks"] = patch["blocks"]
            item["lyrics"] = patch["lyrics"]
        new_snapshot.append(item)

    tok = (token or "").strip()
    if supabase_enabled():
        try:
            _service_client().table("choir_practice_shares").update(
                {"song_snapshot": new_snapshot}
            ).eq("token", tok).execute()
        except Exception as exc:
            if not _supabase_unavailable(exc):
                raise
            logger.warning("choir_practice_shares lyrics update failed; using local store (%s)", exc)
            rows = _read_local_rows()
            for item in rows:
                if str(item.get("token") or "") == tok:
                    item["song_snapshot"] = new_snapshot
            _write_local_rows(rows)
        else:
            rows = _read_local_rows()
            changed = False
            for item in rows:
                if str(item.get("token") or "") == tok:
                    item["song_snapshot"] = new_snapshot
                    changed = True
            if changed:
                _write_local_rows(rows)
    else:
        rows = _read_local_rows()
        for item in rows:
            if str(item.get("token") or "") == tok:
                item["song_snapshot"] = new_snapshot
        _write_local_rows(rows)

    row = dict(row)
    row["song_snapshot"] = new_snapshot
    return _shape_public(row, access_granted=True, can_edit=True)


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
