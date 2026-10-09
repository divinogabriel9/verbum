"""Product free-tier gates for unpaid (no billing / no trial) accounts.

When Stripe billing is on and the parish is not paid or trialing, the account
is free tier:

- 4 one-time premium Mass generations (curated posters) — see free_mass_credit
- 4 monthly free Mass generations (no curated posters) — see free_mass_credit
- No standalone weekly curated-poster allowance — see image_generation_quota
- At most ``FREE_TIER_ACTIVE_PRACTICE_SHARES`` concurrent choir lyric shares
- 1 song catalog submission per UTC month
- 1 priest name submission forever (per user)
- Soft ``Made with LiturgyFlow`` footer on monthly free Mass decks only
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Optional

logger = logging.getLogger(__name__)

# Concurrent live choir practice shares for unpaid accounts.
FREE_TIER_ACTIVE_PRACTICE_SHARES = 2
FREE_TIER_SONG_SUBMISSIONS_PER_MONTH = 1
FREE_TIER_PRIEST_SUBMISSIONS_LIFETIME = 1

# Quiet footer on free monthly Mass decks (not premium tokens / paid).
FREE_TIER_MASS_FOOTER_BRAND = "Made with LiturgyFlow"

_FREE_PRACTICE_DETAIL = (
    f"Free plan allows {FREE_TIER_ACTIVE_PRACTICE_SHARES} active choir lyric shares. "
    "Expire one, or start a 14-day parish trial under Settings → Billing."
)

_FREE_SONG_DETAIL = (
    f"Free plan allows {FREE_TIER_SONG_SUBMISSIONS_PER_MONTH} song submission per month "
    "to the shared catalog. Start a trial under Settings → Billing for unlimited submissions."
)

_FREE_SONG_EDIT_EXISTING_DETAIL = (
    "Free plan can browse the song library and submit one new song per month. "
    "Existing catalog songs can't be edited. Start a trial under Settings → Billing "
    "to save parish versions or update song details."
)

_FREE_PRIEST_DETAIL = (
    f"Free plan allows {FREE_TIER_PRIEST_SUBMISSIONS_LIFETIME} priest name submission. "
    "Start a trial under Settings → Billing to submit more."
)


def is_free_tier_account(
    church_row: Optional[dict[str, Any]],
    *,
    user: Any = None,
    profile_role: Optional[str] = None,
) -> bool:
    """True when billing is on and this parish has no paid/trial access."""
    if (profile_role or "").strip() == "superadmin":
        return False
    try:
        from services.membership_config import is_superadmin_user

        if is_superadmin_user(user):
            return False
    except Exception:
        if user is not None and (getattr(user, "role", None) or "").strip() == "superadmin":
            return False
    try:
        from services.stripe_billing import billing_enabled, parish_has_paid_access

        if not billing_enabled():
            return False
        return not parish_has_paid_access(church_row)
    except Exception:
        return False


def practice_share_quota_payload(
    *,
    is_free_tier: bool,
    active_count: int = 0,
) -> dict[str, Any]:
    """Membership / API fields for choir practice share limits."""
    if not is_free_tier:
        return {
            "practice_share_active_limit": None,
            "practice_share_active_count": max(0, int(active_count or 0)),
            "practice_share_active_remaining": None,
            "can_create_practice_share": True,
        }
    limit = FREE_TIER_ACTIVE_PRACTICE_SHARES
    used = max(0, int(active_count or 0))
    remaining = max(0, limit - used)
    return {
        "practice_share_active_limit": limit,
        "practice_share_active_count": used,
        "practice_share_active_remaining": remaining,
        "can_create_practice_share": remaining > 0,
    }


def free_tier_practice_share_blocked_detail() -> str:
    return _FREE_PRACTICE_DETAIL


def free_tier_song_submit_blocked_detail() -> str:
    return _FREE_SONG_DETAIL


def free_tier_song_edit_existing_blocked_detail() -> str:
    return _FREE_SONG_EDIT_EXISTING_DETAIL


def free_tier_priest_submit_blocked_detail() -> str:
    return _FREE_PRIEST_DETAIL


def _utc_month_id(when: Optional[datetime] = None) -> str:
    return (when or datetime.now(timezone.utc)).strftime("%Y-%m")


def _month_start_iso(month_id: Optional[str] = None) -> str:
    mid = (month_id or _utc_month_id()).strip()
    return f"{mid}-01T00:00:00+00:00"


def count_user_song_submissions_this_month(user_id: str | None) -> int:
    """Catalog song submissions by this user in the current UTC month (any status)."""
    uid = str(user_id or "").strip()
    if not uid:
        return 0
    month = _utc_month_id()
    month_start = _month_start_iso(month)
    try:
        from services.auth_config import supabase_enabled

        if supabase_enabled():
            from services.supabase_client import get_service_client

            result = (
                get_service_client()
                .table("content_submissions")
                .select("id", count="exact")
                .eq("kind", "song")
                .eq("submitted_by_user_id", uid)
                .gte("created_at", month_start)
                .execute()
            )
            if getattr(result, "count", None) is not None:
                return max(0, int(result.count))
            rows = result.data or []
            return len(rows)
    except Exception:
        logger.debug("song submit month count via supabase failed", exc_info=True)

    try:
        from services.pending_submissions import _SONGS_PATH, _read_rows

        n = 0
        for row in _read_rows(_SONGS_PATH):
            if str(row.get("submitted_by_user_id") or "").strip() != uid:
                continue
            created = str(row.get("created_at") or "")
            if created.startswith(month):
                n += 1
        return n
    except Exception:
        return 0


def count_user_priest_submissions_lifetime(user_id: str | None) -> int:
    """Priest catalog submissions by this user (any status, lifetime)."""
    uid = str(user_id or "").strip()
    if not uid:
        return 0
    try:
        from services.auth_config import supabase_enabled

        if supabase_enabled():
            from services.supabase_client import get_service_client

            result = (
                get_service_client()
                .table("content_submissions")
                .select("id", count="exact")
                .eq("kind", "priest")
                .eq("submitted_by_user_id", uid)
                .execute()
            )
            if getattr(result, "count", None) is not None:
                return max(0, int(result.count))
            return len(result.data or [])
    except Exception:
        logger.debug("priest submit lifetime count via supabase failed", exc_info=True)

    try:
        from services.pending_submissions import _PRIESTS_PATH, _read_rows

        return sum(
            1
            for row in _read_rows(_PRIESTS_PATH)
            if str(row.get("submitted_by_user_id") or "").strip() == uid
        )
    except Exception:
        return 0


def content_submit_quota_payload(
    *,
    is_free_tier: bool,
    user_id: str | None = None,
) -> dict[str, Any]:
    """Membership fields for free-tier song/priest catalog submit caps."""
    if not is_free_tier:
        return {
            "free_tier_song_submit_limit": None,
            "free_tier_song_submit_used": 0,
            "free_tier_song_submit_remaining": None,
            "can_submit_song_quota_ok": True,
            "free_tier_priest_submit_limit": None,
            "free_tier_priest_submit_used": 0,
            "free_tier_priest_submit_remaining": None,
            "can_submit_priest_quota_ok": True,
        }

    song_used = count_user_song_submissions_this_month(user_id)
    priest_used = count_user_priest_submissions_lifetime(user_id)
    song_remaining = max(0, FREE_TIER_SONG_SUBMISSIONS_PER_MONTH - song_used)
    priest_remaining = max(0, FREE_TIER_PRIEST_SUBMISSIONS_LIFETIME - priest_used)
    return {
        "free_tier_song_submit_limit": FREE_TIER_SONG_SUBMISSIONS_PER_MONTH,
        "free_tier_song_submit_used": song_used,
        "free_tier_song_submit_remaining": song_remaining,
        "can_submit_song_quota_ok": song_remaining > 0,
        "free_tier_priest_submit_limit": FREE_TIER_PRIEST_SUBMISSIONS_LIFETIME,
        "free_tier_priest_submit_used": priest_used,
        "free_tier_priest_submit_remaining": priest_remaining,
        "can_submit_priest_quota_ok": priest_remaining > 0,
    }


def assert_free_tier_can_submit_song(user_id: str | None) -> None:
    """Raise ValueError when free-tier song monthly quota is exhausted."""
    used = count_user_song_submissions_this_month(user_id)
    if used >= FREE_TIER_SONG_SUBMISSIONS_PER_MONTH:
        raise ValueError(free_tier_song_submit_blocked_detail())


def assert_free_tier_can_submit_priest(user_id: str | None) -> None:
    """Raise ValueError when free-tier lifetime priest quota is exhausted."""
    used = count_user_priest_submissions_lifetime(user_id)
    if used >= FREE_TIER_PRIEST_SUBMISSIONS_LIFETIME:
        raise ValueError(free_tier_priest_submit_blocked_detail())
