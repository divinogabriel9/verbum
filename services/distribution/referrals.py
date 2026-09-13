"""Distribution referral codes and church-to-church referrals."""

from __future__ import annotations

import logging
import secrets
import string
from typing import Any, Optional

from services.distribution._client import require_client
from services.distribution.activities import log_activity
from services.distribution.constants import REFERRAL_STATUSES

logger = logging.getLogger(__name__)

_CODE_ALPHABET = string.ascii_uppercase + string.digits


def _generate_code(length: int = 8) -> str:
    return "".join(secrets.choice(_CODE_ALPHABET) for _ in range(length))


def ensure_referral_code(church: dict[str, Any] | str) -> dict[str, Any]:
    """Ensure a church has a referral_code; return the church row."""
    client = require_client()
    if isinstance(church, str):
        cid = church.strip()
        result = (
            client.table("distribution_churches").select("*").eq("id", cid).limit(1).execute()
        )
        rows = result.data or []
        if not rows:
            raise ValueError("Church not found.")
        church = rows[0]
    else:
        cid = str(church.get("id") or "").strip()
        if not cid:
            raise ValueError("church id is required.")

    existing = (church.get("referral_code") or "").strip()
    if existing:
        return church

    for _ in range(12):
        code = _generate_code(8)
        try:
            updated = (
                client.table("distribution_churches")
                .update({"referral_code": code})
                .eq("id", cid)
                .is_("referral_code", "null")
                .execute()
            )
            rows = updated.data or []
            if rows:
                return rows[0]
            # Race: re-fetch
            refetch = (
                client.table("distribution_churches")
                .select("*")
                .eq("id", cid)
                .limit(1)
                .execute()
            )
            again = (refetch.data or [None])[0]
            if again and (again.get("referral_code") or "").strip():
                return again
            # Code collided — try another
            client.table("distribution_churches").update({"referral_code": code}).eq(
                "id", cid
            ).execute()
            refetch2 = (
                client.table("distribution_churches")
                .select("*")
                .eq("id", cid)
                .limit(1)
                .execute()
            )
            return (refetch2.data or [church])[0]
        except Exception:
            logger.debug("referral code collision, retrying")
            continue
    raise RuntimeError("Could not allocate referral code.")


def list_referrals(
    *,
    referring_church_id: Optional[str] = None,
    referred_church_id: Optional[str] = None,
    status: Optional[str] = None,
    limit: int = 100,
) -> list[dict[str, Any]]:
    client = require_client()
    query = (
        client.table("distribution_referrals")
        .select("*")
        .order("created_at", desc=True)
        .limit(max(1, min(limit, 200)))
    )
    if referring_church_id:
        query = query.eq("referring_church_id", str(referring_church_id).strip())
    if referred_church_id:
        query = query.eq("referred_church_id", str(referred_church_id).strip())
    if status:
        query = query.eq("status", str(status).strip().lower())
    result = query.execute()
    return list(result.data or [])


def create_referral(
    *,
    referring_church_id: str,
    referred_church_id: Optional[str] = None,
    referred_payload: Optional[dict[str, Any]] = None,
    actor_user_id: Optional[str] = None,
    status: str = "pending",
) -> dict[str, Any]:
    from services.distribution.churches import create_church

    ref_id = (referring_church_id or "").strip()
    if not ref_id:
        raise ValueError("referring_church_id is required.")

    referring = ensure_referral_code(ref_id)
    code = str(referring.get("referral_code") or "")

    target_id = (referred_church_id or "").strip() or None
    if not target_id:
        if not referred_payload:
            raise ValueError("referred_church_id or referred church payload is required.")
        payload = dict(referred_payload)
        payload.setdefault("referral_source", f"referral:{code}")
        created = create_church(payload, actor_user_id=actor_user_id)
        target_id = str(created["id"])

    if target_id == ref_id:
        raise ValueError("A church cannot refer itself.")

    st = (status or "pending").strip().lower()
    if st not in REFERRAL_STATUSES:
        raise ValueError(f"Invalid referral status: {status}")

    client = require_client()
    row = {
        "referring_church_id": ref_id,
        "referred_church_id": target_id,
        "referral_code": code,
        "status": st,
    }
    result = client.table("distribution_referrals").insert(row).execute()
    rows = result.data or []
    if not rows:
        raise RuntimeError("Referral did not persist.")
    referral = rows[0]

    try:
        log_activity(
            ref_id,
            "referral_created",
            f"Referral created ({code})",
            actor_user_id=actor_user_id,
            detail={"referral_id": referral.get("id"), "referred_church_id": target_id},
        )
        log_activity(
            target_id,
            "referred",
            f"Referred by code {code}",
            actor_user_id=actor_user_id,
            detail={"referral_id": referral.get("id"), "referring_church_id": ref_id},
        )
    except Exception:
        logger.exception("Failed to log referral activity")

    return referral


def update_referral_status(
    referral_id: str,
    status: str,
    *,
    reward_note: Optional[str] = None,
) -> dict[str, Any]:
    rid = (referral_id or "").strip()
    st = (status or "").strip().lower()
    if not rid:
        raise ValueError("referral_id is required.")
    if st not in REFERRAL_STATUSES:
        raise ValueError(f"Invalid referral status: {status}")
    patch: dict[str, Any] = {"status": st}
    if reward_note is not None:
        patch["reward_note"] = (reward_note or "").strip() or None
    client = require_client()
    result = client.table("distribution_referrals").update(patch).eq("id", rid).execute()
    rows = result.data or []
    if not rows:
        raise ValueError("Referral not found.")
    return rows[0]
