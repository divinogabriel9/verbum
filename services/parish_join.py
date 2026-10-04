"""Create-or-join parish onboarding helpers."""

from __future__ import annotations

import logging
import re
from datetime import datetime, timezone
from typing import Any, Optional

from fastapi import HTTPException

from services.auth_config import supabase_enabled
from services.parish_store import (
    PARISH_MEMBER_LIMIT,
    assign_user_to_parish,
    count_active_members,
    create_parish_manual,
    get_member_for_user,
    get_parish_by_id,
    get_user_parish_context,
)

logger = logging.getLogger(__name__)


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _svc():
    from services.supabase_client import get_service_client

    return get_service_client()


def normalize_parish_name(name: str) -> str:
    text = re.sub(r"\s+", " ", (name or "").strip().lower())
    return text


def find_parish_by_exact_name(name: str) -> Optional[dict[str, Any]]:
    """Case-insensitive exact name match among named draft/pending/approved parishes."""
    needle = normalize_parish_name(name)
    if len(needle) < 2 or not supabase_enabled():
        return None
    result = (
        _svc()
        .table("parishes")
        .select(
            "id, community_name, membership_status, created_at, updated_at"
        )
        .neq("community_name", "")
        .in_("membership_status", ["draft", "pending", "approved"])
        .limit(200)
        .execute()
    )
    for row in result.data or []:
        if normalize_parish_name(str(row.get("community_name") or "")) == needle:
            return row
    return None


def search_parishes(query: str, *, limit: int = 8) -> list[dict[str, Any]]:
    q = normalize_parish_name(query)
    if len(q) < 2 or not supabase_enabled():
        return []
    lim = max(1, min(int(limit or 8), 20))
    # PostgREST ilike; fetch a wider set then rank locally.
    result = (
        _svc()
        .table("parishes")
        .select("id, community_name, membership_status, created_at")
        .neq("community_name", "")
        .in_("membership_status", ["pending", "approved"])
        .ilike("community_name", f"%{q}%")
        .order("community_name")
        .limit(40)
        .execute()
    )
    rows = list(result.data or [])
    scored: list[tuple[int, dict[str, Any]]] = []
    for row in rows:
        name = normalize_parish_name(str(row.get("community_name") or ""))
        if not name:
            continue
        if name == q:
            score = 0
        elif name.startswith(q):
            score = 1
        else:
            score = 2
        pid = str(row.get("id") or "")
        members = count_active_members(pid) if pid else 0
        scored.append(
            (
                score,
                {
                    "id": pid,
                    "community_name": (row.get("community_name") or "").strip(),
                    "membership_status": row.get("membership_status") or "pending",
                    "member_count": members,
                    "seats_remaining": max(0, PARISH_MEMBER_LIMIT - members),
                    "exact_match": name == q,
                },
            )
        )
    scored.sort(key=lambda item: (item[0], item[1]["community_name"].lower()))
    return [item for _score, item in scored[:lim]]


def _detach_user_membership(user_id: str) -> None:
    uid = (user_id or "").strip()
    if not uid:
        return
    member = get_member_for_user(uid)
    if not member:
        return
    parish_id = str(member.get("parish_id") or "")
    _svc().table("parish_members").update({"status": "removed"}).eq(
        "user_id", uid
    ).execute()
    if parish_id:
        try:
            from services.parish_store import _maybe_delete_empty_parish

            _maybe_delete_empty_parish(parish_id)
        except Exception:
            logger.debug("empty parish cleanup skipped for %s", parish_id, exc_info=True)


def cancel_pending_join_requests(user_id: str) -> None:
    uid = (user_id or "").strip()
    if not uid:
        return
    now = _now_iso()
    _svc().table("parish_join_requests").update(
        {"status": "cancelled", "updated_at": now, "resolved_at": now}
    ).eq("user_id", uid).eq("status", "pending").execute()


def create_join_request(
    user_id: str,
    parish_id: str,
    *,
    display_name: str = "",
    email: str = "",
) -> dict[str, Any]:
    uid = (user_id or "").strip()
    pid = (parish_id or "").strip()
    if not uid or not pid:
        raise HTTPException(status_code=400, detail="Parish selection is required.")
    parish = get_parish_by_id(pid)
    if not parish:
        raise HTTPException(status_code=404, detail="Parish not found.")
    status = (parish.get("membership_status") or "").strip().lower()
    if status not in {"pending", "approved"}:
        raise HTTPException(status_code=400, detail="That parish cannot be joined yet.")
    name = (parish.get("community_name") or "").strip()
    if len(name) < 2:
        raise HTTPException(status_code=400, detail="That parish has no name yet.")
    if count_active_members(pid) >= PARISH_MEMBER_LIMIT:
        raise HTTPException(
            status_code=400,
            detail=f"This parish is full ({PARISH_MEMBER_LIMIT} members).",
        )

    cancel_pending_join_requests(uid)
    _detach_user_membership(uid)

    now = _now_iso()
    inserted = (
        _svc()
        .table("parish_join_requests")
        .insert(
            {
                "parish_id": pid,
                "user_id": uid,
                "status": "pending",
                "created_at": now,
                "updated_at": now,
            }
        )
        .execute()
    )
    rows = inserted.data or []
    if not rows:
        raise HTTPException(status_code=500, detail="Could not submit join request.")
    req = rows[0]

    # Legacy church_profiles stub for UI copy while waiting.
    try:
        _svc().table("church_profiles").upsert(
            {
                "user_id": uid,
                "community_name": name,
                "membership_status": "pending",
                "updated_at": now,
            },
            on_conflict="user_id",
        ).execute()
    except Exception:
        logger.warning("church_profiles stub update failed for join request", exc_info=True)

    try:
        from services.admin_alerts import alert_parish_join_request

        prof = (
            _svc()
            .table("profiles")
            .select("email, first_name, last_name")
            .eq("id", uid)
            .limit(1)
            .execute()
        )
        p = (prof.data or [{}])[0]
        display = (display_name or "").strip() or " ".join(
            x for x in ((p.get("first_name") or "").strip(), (p.get("last_name") or "").strip()) if x
        )
        mail = (email or "").strip() or str(p.get("email") or "")
        alert_parish_join_request(
            name=display or (mail or uid),
            email=mail,
            parish=name,
        )
    except Exception as exc:
        logger.warning("Join request alert failed: %s", exc)

    return {
        "ok": True,
        "mode": "join",
        "join_request": req,
        "church_profile": {
            "parish_id": pid,
            "community_name": name,
            "membership_status": "pending",
            "parish_role": None,
            "join_request_status": "pending",
        },
    }


def create_parish_for_onboarding(user_id: str, community_name: str) -> dict[str, Any]:
    uid = (user_id or "").strip()
    name = (community_name or "").strip()
    if len(name) < 2:
        raise HTTPException(status_code=400, detail="Church/Community Name is required.")

    existing = find_parish_by_exact_name(name)
    if existing:
        raise HTTPException(
            status_code=409,
            detail=(
                f"“{(existing.get('community_name') or name).strip()}” already exists. "
                "Request to join that parish instead of creating a new one."
            ),
        )

    cancel_pending_join_requests(uid)

    # Reuse empty/unnamed draft parish the user already owns (legacy signup trigger).
    ctx = get_user_parish_context(uid)
    if ctx and (ctx.get("parish_role") or "").strip().lower() == "president":
        existing_name = (ctx.get("community_name") or "").strip()
        pid = str(ctx.get("parish_id") or ctx.get("id") or "").strip()
        if pid and (not existing_name or normalize_parish_name(existing_name) == normalize_parish_name(name)):
            now = _now_iso()
            updated = (
                _svc()
                .table("parishes")
                .update(
                    {
                        "community_name": name,
                        "membership_status": "pending",
                        "community_name_locked_at": now,
                        "updated_at": now,
                    }
                )
                .eq("id", pid)
                .execute()
            )
            parish = (updated.data or [None])[0] or get_parish_by_id(pid)
            if parish:
                from services.parish_store import _sync_legacy_church_profile

                _sync_legacy_church_profile(uid, parish)
                return {
                    "ok": True,
                    "mode": "create",
                    "church_profile": get_user_parish_context(uid) or {
                        "parish_id": pid,
                        "community_name": name,
                        "membership_status": "pending",
                        "parish_role": "president",
                    },
                }

    _detach_user_membership(uid)
    created = create_parish_manual(
        community_name=name,
        membership_status="pending",
        assign_user_id=uid,
        assign_role="president",
    )
    parish = created.get("parish") or {}
    pid = str(parish.get("id") or "")
    if pid:
        now = _now_iso()
        _svc().table("parishes").update(
            {"community_name_locked_at": now, "updated_at": now}
        ).eq("id", pid).execute()
        parish = get_parish_by_id(pid) or parish
        from services.parish_store import _sync_legacy_church_profile

        _sync_legacy_church_profile(uid, parish)

    return {
        "ok": True,
        "mode": "create",
        "church_profile": get_user_parish_context(uid)
        or {
            "parish_id": parish.get("id"),
            "community_name": parish.get("community_name") or name,
            "membership_status": parish.get("membership_status") or "pending",
            "parish_role": "president",
        },
    }


def list_pending_join_requests() -> list[dict[str, Any]]:
    if not supabase_enabled():
        return []
    result = (
        _svc()
        .table("parish_join_requests")
        .select("id, parish_id, user_id, status, created_at, updated_at")
        .eq("status", "pending")
        .order("created_at")
        .execute()
    )
    rows = list(result.data or [])
    if not rows:
        return []
    parish_ids = sorted({str(r.get("parish_id") or "") for r in rows if r.get("parish_id")})
    user_ids = sorted({str(r.get("user_id") or "") for r in rows if r.get("user_id")})
    parishes: dict[str, dict[str, Any]] = {}
    profiles: dict[str, dict[str, Any]] = {}
    if parish_ids:
        pr = (
            _svc()
            .table("parishes")
            .select("id, community_name, membership_status")
            .in_("id", parish_ids)
            .execute()
        )
        parishes = {str(p["id"]): p for p in (pr.data or []) if p.get("id")}
    if user_ids:
        ur = (
            _svc()
            .table("profiles")
            .select("id, email, first_name, last_name")
            .in_("id", user_ids)
            .execute()
        )
        profiles = {str(p["id"]): p for p in (ur.data or []) if p.get("id")}
    out: list[dict[str, Any]] = []
    for row in rows:
        pid = str(row.get("parish_id") or "")
        uid = str(row.get("user_id") or "")
        parish = parishes.get(pid) or {}
        prof = profiles.get(uid) or {}
        out.append(
            {
                **row,
                "community_name": parish.get("community_name") or "",
                "parish_membership_status": parish.get("membership_status") or "",
                "profile": prof,
            }
        )
    return out


def resolve_join_request(
    request_id: str,
    *,
    approve: bool,
    actor_user_id: str,
) -> dict[str, Any]:
    rid = (request_id or "").strip()
    actor = (actor_user_id or "").strip()
    if not rid:
        raise HTTPException(status_code=400, detail="Join request id required.")
    lookup = (
        _svc()
        .table("parish_join_requests")
        .select("*")
        .eq("id", rid)
        .limit(1)
        .execute()
    )
    rows = lookup.data or []
    if not rows:
        raise HTTPException(status_code=404, detail="Join request not found.")
    req = rows[0]
    if (req.get("status") or "").strip().lower() != "pending":
        raise HTTPException(status_code=400, detail="Join request is already resolved.")

    now = _now_iso()
    new_status = "approved" if approve else "rejected"
    uid = str(req.get("user_id") or "")
    pid = str(req.get("parish_id") or "")
    parish = get_parish_by_id(pid) if pid else None
    community = str((parish or {}).get("community_name") or "").strip()

    if approve:
        if not parish:
            raise HTTPException(status_code=404, detail="Parish not found.")
        try:
            assign_user_to_parish(uid, pid, "media")
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    updated = (
        _svc()
        .table("parish_join_requests")
        .update(
            {
                "status": new_status,
                "updated_at": now,
                "resolved_at": now,
                "resolved_by": actor or None,
            }
        )
        .eq("id", rid)
        .eq("status", "pending")
        .execute()
    )
    if not (updated.data or []):
        raise HTTPException(status_code=409, detail="Join request could not be updated.")

    # Notify the requester.
    try:
        from services.email_notifications import (
            notify_membership_approved,
            notify_membership_rejected,
            safe_send,
        )

        prof = (
            _svc()
            .table("profiles")
            .select("email, first_name")
            .eq("id", uid)
            .limit(1)
            .execute()
        )
        p = (prof.data or [{}])[0]
        dest = str(p.get("email") or "").strip().lower()
        if dest:
            if approve:
                safe_send(
                    "membership_approved",
                    notify_membership_approved,
                    email=dest,
                    first_name=str(p.get("first_name") or ""),
                    community_name=community,
                )
            else:
                safe_send(
                    "membership_rejected",
                    notify_membership_rejected,
                    email=dest,
                    first_name=str(p.get("first_name") or ""),
                    community_name=community,
                )
    except Exception:
        logger.warning("Join resolve email failed", exc_info=True)

    return {
        "ok": True,
        "status": new_status,
        "join_request": (updated.data or [req])[0],
        "community_name": community,
    }
