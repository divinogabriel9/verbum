"""Pending superadmin approval items for inbox / notifications."""

from __future__ import annotations

from typing import Any

from services.auth_config import supabase_enabled
from services.pending_submissions import (
    list_pending_parish_renames,
    list_pending_priests,
    list_pending_songs,
)
from services.supabase_client import list_pending_memberships


def _kind_label(kind: str) -> str:
    return {
        "membership": "Parish membership",
        "songs": "Song submission",
        "song": "Song submission",
        "priests": "Priest name",
        "priest": "Priest name",
        "parish_names": "Parish rename",
        "parish_name": "Parish rename",
    }.get(kind, "Approval")


def build_approvals_inbox() -> dict[str, Any]:
    items: list[dict[str, Any]] = []

    if supabase_enabled():
        try:
            pending_memberships = list_pending_memberships()
        except Exception:
            # Transient Supabase/httpx failures must not 500 the whole inbox.
            pending_memberships = []
        for row in pending_memberships:
            uid = str(row.get("user_id") or "").strip()
            if not uid:
                continue
            prof = row.get("profile") or {}
            items.append(
                {
                    "id": f"membership:{uid}",
                    "kind": "membership",
                    "entity_id": uid,
                    "title": (row.get("community_name") or "Parish").strip() or "Parish",
                    "subtitle": (prof.get("email") or uid).strip(),
                    "detail": "New parish registration awaiting approval",
                    "created_at": row.get("created_at") or row.get("updated_at") or "",
                    "panel": "membership",
                    "kind_label": _kind_label("membership"),
                }
            )

    for row in list_pending_songs():
        rid = str(row.get("id") or "").strip()
        if not rid:
            continue
        payload = row.get("payload") if isinstance(row.get("payload"), dict) else {}
        matches = payload.get("possible_matches") if isinstance(payload.get("possible_matches"), list) else []
        detail = "Song catalog submission"
        if matches:
            detail = f"Similar titles already in catalog ({len(matches)}) — review before approve"
        items.append(
            {
                "id": f"song:{rid}",
                "kind": "songs",
                "entity_id": rid,
                "title": (payload.get("title") or "Song submission").strip(),
                "subtitle": (row.get("submitted_by_email") or row.get("submitted_by_user_id") or "").strip(),
                "detail": detail,
                "lyrics": str(payload.get("lyrics") or "").strip(),
                "language": str(payload.get("language") or "").strip(),
                "author": str(payload.get("author") or "").strip(),
                "sections": payload.get("sections") if isinstance(payload.get("sections"), list) else [],
                "possible_matches": matches,
                "created_at": row.get("created_at") or "",
                "panel": "membership",
                "kind_label": _kind_label("songs"),
            }
        )

    for row in list_pending_priests():
        rid = str(row.get("id") or "").strip()
        if not rid:
            continue
        payload = row.get("payload") if isinstance(row.get("payload"), dict) else {}
        items.append(
            {
                "id": f"priest:{rid}",
                "kind": "priests",
                "entity_id": rid,
                "title": (payload.get("name") or payload.get("celebrant_name") or "Priest name").strip(),
                "subtitle": (row.get("submitted_by_email") or row.get("submitted_by_user_id") or "").strip(),
                "detail": "Celebrant name submission",
                "created_at": row.get("created_at") or "",
                "panel": "membership",
                "kind_label": _kind_label("priests"),
            }
        )

    for row in list_pending_parish_renames():
        rid = str(row.get("id") or "").strip()
        if not rid:
            continue
        payload = row.get("payload") if isinstance(row.get("payload"), dict) else {}
        previous = str(payload.get("previous_name") or "").strip()
        proposed = str(payload.get("community_name") or "").strip()
        detail = "Parish name change request"
        if previous and proposed:
            detail = f"Rename “{previous}” → “{proposed}”"
        items.append(
            {
                "id": f"parish_name:{rid}",
                "kind": "parish_names",
                "entity_id": rid,
                "title": proposed or "Parish rename",
                "subtitle": (row.get("submitted_by_email") or row.get("submitted_by_user_id") or "").strip(),
                "detail": detail,
                "previous_name": previous,
                "community_name": proposed,
                "created_at": row.get("created_at") or "",
                "panel": "membership",
                "kind_label": _kind_label("parish_names"),
            }
        )

    items.sort(key=lambda x: str(x.get("created_at") or ""), reverse=True)
    return {
        "ok": True,
        "items": items,
        "pending_count": len(items),
        "counts": {
            "membership": sum(1 for i in items if i.get("kind") == "membership"),
            "songs": sum(1 for i in items if i.get("kind") == "songs"),
            "priests": sum(1 for i in items if i.get("kind") == "priests"),
            "parish_names": sum(1 for i in items if i.get("kind") == "parish_names"),
            "total": len(items),
        },
    }
