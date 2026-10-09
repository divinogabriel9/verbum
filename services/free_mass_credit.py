"""Mass generation credits for unsigned (non-subscribed) users.

Two tracks when Stripe billing is on and the parish is not paid/trialing:

1. **Premium (one-time)** — ``PREMIUM_MASS_LIMIT`` generations with curated
   weekly AI divider posters.
2. **Free tier (monthly)** — ``FREE_TIER_MONTHLY_MASS_LIMIT`` generations per
   UTC month **without** curated AI divider posters.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Literal, Optional

logger = logging.getLogger(__name__)

PREMIUM_MASS_LIMIT = 4
FREE_TIER_MONTHLY_MASS_LIMIT = 4

# Backward-compatible aliases (older call sites / UI).
FREE_MASS_LIMIT = PREMIUM_MASS_LIMIT

GenerationTier = Literal["paid", "premium", "free", "none"]


def _clean(value: Any) -> str:
    return str(value or "").strip()


def _utc_month_id(when: Optional[datetime] = None) -> str:
    return (when or datetime.now(timezone.utc)).strftime("%Y-%m")


def premium_mass_used_count(profile: Optional[dict[str, Any]]) -> int:
    if not profile:
        return 0
    try:
        used = int(profile.get("complimentary_mass_used_count") or 0)
    except (TypeError, ValueError):
        used = 0
    # Legacy single-use timestamp (pre–token counter).
    if used <= 0 and profile.get("complimentary_mass_used_at"):
        used = 1
    return max(0, used)


def premium_mass_remaining_from_profile(profile: Optional[dict[str, Any]]) -> int:
    return max(0, PREMIUM_MASS_LIMIT - premium_mass_used_count(profile))


def free_tier_mass_used_count(profile: Optional[dict[str, Any]]) -> int:
    if not profile:
        return 0
    month = _clean(profile.get("free_tier_mass_month"))
    if month != _utc_month_id():
        return 0
    try:
        return max(0, int(profile.get("free_tier_mass_used_count") or 0))
    except (TypeError, ValueError):
        return 0


def free_tier_mass_remaining_from_profile(profile: Optional[dict[str, Any]]) -> int:
    return max(0, FREE_TIER_MONTHLY_MASS_LIMIT - free_tier_mass_used_count(profile))


# ---- legacy wrappers ----
def free_mass_used_count(profile: Optional[dict[str, Any]]) -> int:
    return premium_mass_used_count(profile)


def free_mass_remaining_from_profile(profile: Optional[dict[str, Any]]) -> int:
    return premium_mass_remaining_from_profile(profile)


def _load_profile(user_id: str) -> dict[str, Any]:
    try:
        from services.supabase_client import get_profile, supabase_enabled

        if not supabase_enabled():
            return {}
        return get_profile(user_id) or {}
    except Exception:
        logger.exception("mass credit profile lookup failed for %s", user_id)
        return {}


def free_mass_status_for_user(
    user_id: str | None,
    *,
    profile: Optional[dict[str, Any]] = None,
    has_full_access: bool = False,
    billing_on: bool = False,
) -> dict[str, Any]:
    """Membership / UI payload for generation credits."""
    empty = {
        "premium_mass_limit": PREMIUM_MASS_LIMIT,
        "premium_mass_remaining": 0,
        "premium_mass_used": False,
        "premium_mass_used_count": 0,
        "free_tier_mass_limit": FREE_TIER_MONTHLY_MASS_LIMIT,
        "free_tier_mass_remaining": 0,
        "free_tier_mass_used": False,
        "free_tier_mass_used_count": 0,
        "free_tier_mass_month": _utc_month_id(),
        "next_generation_tier": "none",
        "can_generate_mass": False,
        "can_use_premium_posters": False,
        # Backward-compatible aliases (= premium one-time).
        "free_mass_limit": PREMIUM_MASS_LIMIT,
        "free_mass_remaining": 0,
        "free_mass_used": False,
        "free_mass_used_count": 0,
    }
    if has_full_access:
        empty["can_generate_mass"] = True
        empty["can_use_premium_posters"] = True
        empty["next_generation_tier"] = "paid"
        return empty
    if not billing_on:
        return empty

    uid = _clean(user_id)
    if not uid:
        return empty
    row = profile if isinstance(profile, dict) else None
    if row is None:
        row = _load_profile(uid)

    premium_used = premium_mass_used_count(row)
    premium_remaining = max(0, PREMIUM_MASS_LIMIT - premium_used)
    free_used = free_tier_mass_used_count(row)
    free_remaining = max(0, FREE_TIER_MONTHLY_MASS_LIMIT - free_used)

    if premium_remaining > 0:
        next_tier: GenerationTier = "premium"
    elif free_remaining > 0:
        next_tier = "free"
    else:
        next_tier = "none"

    return {
        "premium_mass_limit": PREMIUM_MASS_LIMIT,
        "premium_mass_remaining": premium_remaining,
        "premium_mass_used": premium_remaining <= 0,
        "premium_mass_used_count": premium_used,
        "free_tier_mass_limit": FREE_TIER_MONTHLY_MASS_LIMIT,
        "free_tier_mass_remaining": free_remaining,
        "free_tier_mass_used": free_remaining <= 0,
        "free_tier_mass_used_count": free_used,
        "free_tier_mass_month": _utc_month_id(),
        "next_generation_tier": next_tier,
        "can_generate_mass": next_tier != "none",
        "can_use_premium_posters": premium_remaining > 0,
        "free_mass_limit": PREMIUM_MASS_LIMIT,
        "free_mass_remaining": premium_remaining,
        "free_mass_used": premium_remaining <= 0,
        "free_mass_used_count": premium_used,
    }


def resolve_generation_tier(
    user_id: str | None,
    *,
    profile: Optional[dict[str, Any]] = None,
    has_full_access: bool = False,
    billing_on: bool = False,
) -> GenerationTier:
    status = free_mass_status_for_user(
        user_id,
        profile=profile,
        has_full_access=has_full_access,
        billing_on=billing_on,
    )
    tier = str(status.get("next_generation_tier") or "none")
    if tier in {"paid", "premium", "free", "none"}:
        return tier  # type: ignore[return-value]
    return "none"


def user_has_free_mass_credit(user_id: str | None) -> bool:
    """True if the user may generate without a paid subscription."""
    uid = _clean(user_id)
    if not uid:
        return False
    try:
        from services.supabase_client import supabase_enabled

        if not supabase_enabled():
            return False
        status = free_mass_status_for_user(uid, billing_on=True, has_full_access=False)
        return bool(status.get("can_generate_mass"))
    except Exception:
        logger.exception("user_has_free_mass_credit failed for %s", uid)
        return False


def consume_premium_mass_credit(user_id: str | None) -> bool:
    """Spend one one-time premium Mass token (with curated posters)."""
    uid = _clean(user_id)
    if not uid:
        return False
    try:
        from services.supabase_client import get_service_client, supabase_enabled

        if not supabase_enabled():
            return False
        client = get_service_client()
        result = (
            client.table("profiles")
            .select("complimentary_mass_used_count, complimentary_mass_used_at")
            .eq("id", uid)
            .limit(1)
            .execute()
        )
        rows = result.data or []
        if not rows:
            return False
        used = premium_mass_used_count(rows[0])
        if used >= PREMIUM_MASS_LIMIT:
            return False
        now = datetime.now(timezone.utc).isoformat()
        next_used = used + 1
        patch: dict[str, Any] = {
            "complimentary_mass_used_count": next_used,
            "updated_at": now,
        }
        if next_used == 1 and not rows[0].get("complimentary_mass_used_at"):
            patch["complimentary_mass_used_at"] = now
        client.table("profiles").update(patch).eq("id", uid).execute()
        return True
    except Exception:
        logger.exception("consume_premium_mass_credit failed for %s", uid)
        return False


def consume_free_tier_mass_credit(user_id: str | None) -> bool:
    """Spend one monthly free-tier Mass token (no curated posters)."""
    uid = _clean(user_id)
    if not uid:
        return False
    try:
        from services.supabase_client import get_service_client, supabase_enabled

        if not supabase_enabled():
            return False
        client = get_service_client()
        result = (
            client.table("profiles")
            .select("free_tier_mass_month, free_tier_mass_used_count")
            .eq("id", uid)
            .limit(1)
            .execute()
        )
        rows = result.data or []
        if not rows:
            return False
        month = _utc_month_id()
        row = rows[0]
        stored_month = _clean(row.get("free_tier_mass_month"))
        used = 0 if stored_month != month else free_tier_mass_used_count(
            {"free_tier_mass_month": month, "free_tier_mass_used_count": row.get("free_tier_mass_used_count")}
        )
        if used >= FREE_TIER_MONTHLY_MASS_LIMIT:
            return False
        now = datetime.now(timezone.utc).isoformat()
        client.table("profiles").update(
            {
                "free_tier_mass_month": month,
                "free_tier_mass_used_count": used + 1,
                "updated_at": now,
            }
        ).eq("id", uid).execute()
        return True
    except Exception:
        logger.exception("consume_free_tier_mass_credit failed for %s", uid)
        return False


def consume_generation_credit(user_id: str | None, tier: GenerationTier) -> bool:
    if tier == "premium":
        return consume_premium_mass_credit(user_id)
    if tier == "free":
        return consume_free_tier_mass_credit(user_id)
    return False


# Legacy name used by older generate paths.
def consume_free_mass_credit(user_id: str | None) -> bool:
    return consume_premium_mass_credit(user_id)
