"""Per-user / per-parish Song Library recent activity (synced via Supabase)."""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Optional

from services.auth_config import supabase_enabled
from services.parish_store import get_user_parish_context
from services.supabase_client import _client_for_user, get_service_client

logger = logging.getLogger(__name__)

MAX_ENTRIES = 120
ALLOWED_KINDS = frozenset({"new", "edited", "lyrics_updated", "saved", "deleted"})


def song_history_dedupe_key(section: str, hymn_id: str, title: str) -> str:
    sec = (section or "").strip().lower()
    hid = (hymn_id or "").strip()
    if sec and hid:
        return f"{sec}\0{hid}"
    return f"{sec}\0{(title or '').strip().lower()}"


def scope_key_for_parish(parish_id: Optional[str]) -> str:
    pid = (parish_id or "").strip()
    return pid if pid else ""


def normalize_song_history_kind(kind: str) -> str:
    k = (kind or "").strip().lower()
    if k == "saved":
        return "lyrics_updated"
    if k in ALLOWED_KINDS:
        return k
    return "lyrics_updated"


def resolve_parish_id_for_user(
    user_id: str,
    *,
    access_token: Optional[str] = None,
    parish_id: Optional[str] = None,
) -> Optional[str]:
    explicit = (parish_id or "").strip()
    if explicit:
        ctx = get_user_parish_context(user_id, access_token=access_token)
        if not ctx or str(ctx.get("parish_id") or "").strip() != explicit:
            return None
        return explicit
    ctx = get_user_parish_context(user_id, access_token=access_token)
    if not ctx:
        return None
    pid = str(ctx.get("parish_id") or "").strip()
    return pid or None


def _ms_to_iso(ms: Optional[int]) -> str:
    if ms is None:
        return datetime.now(timezone.utc).isoformat()
    try:
        value = int(ms)
    except (TypeError, ValueError):
        return datetime.now(timezone.utc).isoformat()
    if value <= 0:
        return datetime.now(timezone.utc).isoformat()
    return datetime.fromtimestamp(value / 1000.0, tz=timezone.utc).isoformat()


def _iso_to_ms(value: Any) -> int:
    text = str(value or "").strip()
    if not text:
        return int(datetime.now(timezone.utc).timestamp() * 1000)
    try:
        dt = datetime.fromisoformat(text.replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return int(dt.timestamp() * 1000)
    except ValueError:
        return int(datetime.now(timezone.utc).timestamp() * 1000)


def _profile_label(row: dict[str, Any]) -> str:
    first = str(row.get("first_name") or "").strip()
    last = str(row.get("last_name") or "").strip()
    name = f"{first} {last}".strip()
    if name:
        return name
    email = str(row.get("email") or "").strip()
    if email and "@" in email:
        return email.split("@", 1)[0]
    return "Team member"


def _row_to_api(row: dict[str, Any], *, actor_labels: Optional[dict[str, str]] = None) -> dict[str, Any]:
    uid = str(row.get("user_id") or "").strip()
    payload: dict[str, Any] = {
        "t": _iso_to_ms(row.get("activity_at")),
        "title": str(row.get("title") or ""),
        "section": str(row.get("section") or ""),
        "id": str(row.get("hymn_id") or ""),
        "language": str(row.get("language") or ""),
        "kind": normalize_song_history_kind(str(row.get("kind") or "")),
    }
    if uid:
        payload["user_id"] = uid
        if actor_labels and uid in actor_labels:
            payload["actor_name"] = actor_labels[uid]
    return payload


def _normalize_entry(entry: dict[str, Any]) -> Optional[dict[str, Any]]:
    if not isinstance(entry, dict):
        return None
    title = str(entry.get("title") or "").strip()
    if not title:
        return None
    kind = normalize_song_history_kind(str(entry.get("kind") or ""))
    if kind in {"loaded", "opened"}:
        return None
    section = str(entry.get("section") or "").strip().lower()
    hymn_id = str(entry.get("id") or entry.get("hymn_id") or "").strip()
    language = str(entry.get("language") or "").strip()
    activity_ms = entry.get("t")
    dedupe = song_history_dedupe_key(section, hymn_id, title)
    return {
        "dedupe_key": dedupe,
        "section": section,
        "hymn_id": hymn_id,
        "title": title,
        "language": language,
        "kind": kind,
        "activity_at": _ms_to_iso(activity_ms if activity_ms is not None else None),
    }


def _fetch_actor_labels(user_ids: list[str]) -> dict[str, str]:
    ids = [uid for uid in {str(x or "").strip() for x in user_ids} if uid]
    if not ids or not supabase_enabled():
        return {}
    try:
        client = get_service_client()
        result = (
            client.table("profiles")
            .select("id, first_name, last_name, email")
            .in_("id", ids)
            .execute()
        )
        labels: dict[str, str] = {}
        for row in result.data or []:
            if isinstance(row, dict) and row.get("id"):
                labels[str(row["id"])] = _profile_label(row)
        return labels
    except Exception as exc:
        logger.warning("user_song_history profile lookup failed (%s)", exc)
        return {}


def list_user_song_history(
    user_id: str,
    *,
    access_token: Optional[str] = None,
    parish_id: Optional[str] = None,
    limit: int = MAX_ENTRIES,
) -> list[dict[str, Any]]:
    uid = (user_id or "").strip()
    if not uid or not supabase_enabled():
        return []
    pid = resolve_parish_id_for_user(uid, access_token=access_token, parish_id=parish_id)
    scope = scope_key_for_parish(pid)
    cap = max(1, min(int(limit or MAX_ENTRIES), MAX_ENTRIES))
    try:
        client = _client_for_user(access_token)
        result = (
            client.table("user_song_history")
            .select("user_id, section, hymn_id, title, language, kind, activity_at")
            .eq("user_id", uid)
            .eq("scope_key", scope)
            .order("activity_at", desc=True)
            .limit(cap)
            .execute()
        )
        rows = [r for r in (result.data or []) if isinstance(r, dict)]
        return [_row_to_api(row) for row in rows]
    except Exception as exc:
        logger.warning("user_song_history list failed (%s)", exc)
        return []


def list_parish_song_history(
    user_id: str,
    *,
    access_token: Optional[str] = None,
    parish_id: Optional[str] = None,
    limit: int = MAX_ENTRIES,
) -> list[dict[str, Any]]:
    uid = (user_id or "").strip()
    pid = resolve_parish_id_for_user(uid, access_token=access_token, parish_id=parish_id)
    if not uid or not pid or not supabase_enabled():
        return []
    cap = max(1, min(int(limit or MAX_ENTRIES), MAX_ENTRIES))
    try:
        client = _client_for_user(access_token)
        result = (
            client.table("user_song_history")
            .select("user_id, section, hymn_id, title, language, kind, activity_at, dedupe_key")
            .eq("parish_id", pid)
            .order("activity_at", desc=True)
            .limit(min(cap * 4, 480))
            .execute()
        )
        rows = [r for r in (result.data or []) if isinstance(r, dict)]
        seen: set[str] = set()
        picked: list[dict[str, Any]] = []
        for row in rows:
            key = str(row.get("dedupe_key") or "").strip()
            if not key:
                key = song_history_dedupe_key(
                    str(row.get("section") or ""),
                    str(row.get("hymn_id") or ""),
                    str(row.get("title") or ""),
                )
            if key in seen:
                continue
            seen.add(key)
            picked.append(row)
            if len(picked) >= cap:
                break
        actor_labels = _fetch_actor_labels([str(r.get("user_id") or "") for r in picked])
        return [_row_to_api(row, actor_labels=actor_labels) for row in picked]
    except Exception as exc:
        logger.warning("user_song_history parish list failed (%s)", exc)
        return []


def _trim_user_song_history(
    client: Any,
    user_id: str,
    scope_key: str,
    *,
    keep: int = MAX_ENTRIES,
) -> None:
    cap = max(1, min(int(keep or MAX_ENTRIES), MAX_ENTRIES))
    extras = (
        client.table("user_song_history")
        .select("id")
        .eq("user_id", user_id)
        .eq("scope_key", scope_key)
        .order("activity_at", desc=True)
        .range(cap, cap + 500)
        .execute()
    )
    ids = [str(row.get("id") or "").strip() for row in (extras.data or []) if row.get("id")]
    for row_id in ids:
        if not row_id:
            continue
        client.table("user_song_history").delete().eq("id", row_id).execute()


def sync_user_song_history(
    user_id: str,
    entries: list[dict[str, Any]],
    *,
    access_token: Optional[str] = None,
    parish_id: Optional[str] = None,
) -> dict[str, Any]:
    """Upsert recent song rows for the user within their parish scope."""
    uid = (user_id or "").strip()
    if not uid:
        return {"ok": False, "error": "user_id required", "entries": []}
    if not supabase_enabled():
        return {"ok": True, "synced": False, "entries": []}

    pid = resolve_parish_id_for_user(uid, access_token=access_token, parish_id=parish_id)
    scope = scope_key_for_parish(pid)

    normalized: list[dict[str, Any]] = []
    seen: set[str] = set()
    for raw in entries or []:
        row = _normalize_entry(raw if isinstance(raw, dict) else {})
        if not row:
            continue
        key = row["dedupe_key"]
        if key in seen:
            continue
        seen.add(key)
        normalized.append(row)
        if len(normalized) >= MAX_ENTRIES:
            break

    if not normalized:
        return {"ok": True, "synced": True, "entries": [], "count": 0, "parish_id": pid}

    try:
        client = _client_for_user(access_token)
        payload = [
            {
                "user_id": uid,
                "parish_id": pid,
                "scope_key": scope,
                "dedupe_key": row["dedupe_key"],
                "section": row["section"],
                "hymn_id": row["hymn_id"],
                "title": row["title"],
                "language": row["language"],
                "kind": row["kind"],
                "activity_at": row["activity_at"],
            }
            for row in normalized
        ]
        client.table("user_song_history").upsert(
            payload,
            on_conflict="user_id,scope_key,dedupe_key",
        ).execute()
        _trim_user_song_history(client, uid, scope)
        stored = list_user_song_history(uid, access_token=access_token, parish_id=pid)
        return {
            "ok": True,
            "synced": True,
            "entries": stored,
            "count": len(stored),
            "parish_id": pid,
        }
    except Exception as exc:
        logger.warning("user_song_history sync failed (%s)", exc)
        return {"ok": False, "synced": False, "error": str(exc), "entries": []}
