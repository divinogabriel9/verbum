"""Distribution invite links wrapping platform_invites."""

from __future__ import annotations

import logging
import re
from datetime import timedelta
from typing import Any, Optional

from services.distribution._client import parse_iso, require_client, utc_now, utc_now_iso
from services.distribution.activities import log_activity
from services.distribution.constants import PIPELINE_LABELS
from services.email_links import invite_signup_url
from services.platform_invites import create_invite

logger = logging.getLogger(__name__)


def _slugify(name: str) -> str:
    base = re.sub(r"[^a-z0-9]+", "-", (name or "").strip().lower()).strip("-")
    return base or "church"


def _unique_slug(client, base: str) -> str:
    slug = base[:80]
    attempt = slug
    n = 2
    while True:
        existing = (
            client.table("distribution_invites")
            .select("id")
            .eq("slug", attempt)
            .limit(1)
            .execute()
        )
        if not (existing.data or []):
            return attempt
        attempt = f"{slug}-{n}"[:90]
        n += 1
        if n > 100:
            raise RuntimeError("Could not allocate unique invite slug.")


def create_distribution_invite(
    church_id: str,
    actor_user_id: Optional[str] = None,
    *,
    ttl_days: int = 14,
) -> dict[str, Any]:
    cid = (church_id or "").strip()
    if not cid:
        raise ValueError("church_id is required.")
    client = require_client()
    church_res = (
        client.table("distribution_churches").select("*").eq("id", cid).limit(1).execute()
    )
    churches = church_res.data or []
    if not churches:
        raise ValueError("Church not found.")
    church = churches[0]
    parish_name = (church.get("parish_name") or "").strip() or "Church"
    email = (church.get("email") or "").strip().lower() or None

    platform = create_invite(
        created_by_user_id=actor_user_id,
        email=email,
        note=f"Distribution invite for {parish_name}",
        community_name=parish_name,
        parish_id=str(church.get("parish_id") or "").strip() or None,
        invite_role="president",
        ttl_days=max(1, min(int(ttl_days or 14), 90)),
    )
    token = str(platform.get("token") or "")
    if not token:
        raise RuntimeError("Platform invite missing token.")

    slug = _unique_slug(client, _slugify(parish_name))
    expires_at = platform.get("expires_at") or (utc_now() + timedelta(days=ttl_days)).isoformat()
    payload: dict[str, Any] = {
        "church_id": cid,
        "platform_invite_id": platform.get("id"),
        "slug": slug,
        "token": token,
        "status": "pending",
        "expires_at": expires_at,
    }
    if actor_user_id:
        payload["created_by"] = actor_user_id

    result = client.table("distribution_invites").insert(payload).execute()
    rows = result.data or []
    if not rows:
        raise RuntimeError("Distribution invite did not persist.")
    invite = rows[0]
    invite_url = invite_signup_url(token)
    join_path = f"/join/{slug}"

    try:
        log_activity(
            cid,
            "invite_created",
            f"Invite created ({slug})",
            actor_user_id=actor_user_id,
            detail={"invite_id": invite.get("id"), "slug": slug},
        )
    except Exception:
        logger.exception("Failed to log invite activity")

    return {
        "invite": invite,
        "platform_invite": platform,
        "invite_url": invite_url,
        "join_path": join_path,
        "join_url": join_path,
    }


def list_invites(
    *,
    church_id: Optional[str] = None,
    include_accepted: bool = True,
    limit: int = 100,
) -> list[dict[str, Any]]:
    client = require_client()
    query = (
        client.table("distribution_invites")
        .select("*, distribution_churches(parish_name, city, country, email)")
        .order("created_at", desc=True)
        .limit(max(1, min(limit, 200)))
    )
    if church_id:
        query = query.eq("church_id", str(church_id).strip())
    if not include_accepted:
        query = query.eq("status", "pending")
    result = query.execute()
    rows = list(result.data or [])
    for row in rows:
        token = row.get("token") or ""
        row["invite_url"] = invite_signup_url(token) if token else None
        row["join_path"] = f"/join/{row.get('slug')}" if row.get("slug") else None
    return rows


def get_invite_by_slug(slug: str) -> Optional[dict[str, Any]]:
    clean = (slug or "").strip().lower()
    if not clean:
        return None
    client = require_client()
    result = (
        client.table("distribution_invites")
        .select("*")
        .eq("slug", clean)
        .limit(1)
        .execute()
    )
    rows = result.data or []
    return rows[0] if rows else None


def get_pending_invite_by_slug(slug: str) -> Optional[dict[str, Any]]:
    row = get_invite_by_slug(slug)
    if not row:
        return None
    if str(row.get("status") or "") != "pending":
        return None
    expires = parse_iso(row.get("expires_at"))
    if expires and expires < utc_now():
        try:
            require_client().table("distribution_invites").update(
                {"status": "expired"}
            ).eq("id", row["id"]).execute()
        except Exception:
            pass
        return None
    return row


def revoke_invite(invite_id: str, actor_user_id: Optional[str] = None) -> dict[str, Any]:
    iid = (invite_id or "").strip()
    if not iid:
        raise ValueError("invite_id is required.")
    client = require_client()
    result = (
        client.table("distribution_invites")
        .update({"status": "revoked"})
        .eq("id", iid)
        .execute()
    )
    rows = result.data or []
    if not rows:
        raise ValueError("Invite not found.")
    invite = rows[0]
    try:
        log_activity(
            str(invite.get("church_id")),
            "invite_revoked",
            "Invite revoked",
            actor_user_id=actor_user_id,
            detail={"invite_id": iid},
        )
    except Exception:
        logger.exception("Failed to log invite revoke")
    return invite


def mark_invite_accepted(
    token: str,
    user_id: str,
    parish_id: Optional[str] = None,
) -> Optional[dict[str, Any]]:
    """Mark distribution invite accepted and link church → parish when known."""
    tok = (token or "").strip()
    uid = (user_id or "").strip()
    if not tok or not uid:
        return None
    client = require_client()
    result = (
        client.table("distribution_invites")
        .select("*")
        .eq("token", tok)
        .limit(1)
        .execute()
    )
    rows = result.data or []
    if not rows:
        return None
    invite = rows[0]
    if str(invite.get("status") or "") == "accepted":
        return invite

    now = utc_now_iso()
    patch: dict[str, Any] = {
        "status": "accepted",
        "accepted_at": now,
        "accepted_by": uid,
        "use_count": int(invite.get("use_count") or 0) + 1,
    }
    updated = (
        client.table("distribution_invites").update(patch).eq("id", invite["id"]).execute()
    )
    invite = (updated.data or [invite])[0]

    church_id = str(invite.get("church_id") or "").strip()
    if not church_id:
        return invite

    church_res = (
        client.table("distribution_churches").select("*").eq("id", church_id).limit(1).execute()
    )
    churches = church_res.data or []
    if not churches:
        return invite
    church = churches[0]
    old_status = str(church.get("pipeline_status") or "discovered")

    church_patch: dict[str, Any] = {}
    pid = (parish_id or "").strip() or None
    if pid and not church.get("parish_id"):
        church_patch["parish_id"] = pid

    # Move toward trial/activated once they signed up.
    if old_status in {"discovered", "contacted", "interested", "demo"}:
        church_patch["pipeline_status"] = "trial"
        church_patch["stage_entered_at"] = now
        if not church.get("trial_start_at"):
            church_patch["trial_start_at"] = now
            church_patch["trial_expires_at"] = (utc_now() + timedelta(days=14)).isoformat()
    elif old_status == "trial" and pid:
        church_patch["pipeline_status"] = "activated"
        church_patch["stage_entered_at"] = now

    if church_patch:
        client.table("distribution_churches").update(church_patch).eq("id", church_id).execute()

    new_status = church_patch.get("pipeline_status") or old_status
    try:
        summary = "Invite accepted — account linked"
        if new_status != old_status:
            summary = (
                f"Invite accepted — moved from "
                f"{PIPELINE_LABELS.get(old_status, old_status)} → "
                f"{PIPELINE_LABELS.get(new_status, new_status)}"
            )
        log_activity(
            church_id,
            "invite_accepted",
            summary,
            actor_user_id=uid,
            detail={
                "invite_id": invite.get("id"),
                "parish_id": pid,
                "from": old_status,
                "to": new_status,
            },
        )
    except Exception:
        logger.exception("Failed to log invite accepted")

    return invite


def on_platform_invite_accepted(
    token: str,
    user_id: str,
    parish_id: Optional[str] = None,
) -> Optional[dict[str, Any]]:
    """Soft-hook entry point used from platform_invites.consume_invite."""
    return mark_invite_accepted(token, user_id, parish_id=parish_id)
