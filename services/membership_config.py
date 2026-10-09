"""Parish membership and superadmin configuration."""

from __future__ import annotations

import os
from functools import lru_cache
from typing import Any, Optional

from services.auth_config import auth_enabled
from services.supabase_auth import AuthUser


def _clean(value: str | None) -> str:
    return (value or "").strip()


@lru_cache(maxsize=1)
def superadmin_emails() -> frozenset[str]:
    raw = _clean(os.environ.get("SUPERADMIN_EMAILS"))
    if not raw:
        return frozenset()
    return frozenset(e.lower() for e in raw.split(",") if e.strip())


def is_superadmin_user(user: Optional[AuthUser]) -> bool:
    if not user:
        return False
    return (user.role or "").strip() == "superadmin"


ACCOUNT_KIND_PARISH = "parish"
ACCOUNT_KIND_THEME_DESIGNER = "theme_designer"


def profile_account_kind(profile: Optional[dict[str, Any]]) -> str:
    kind = str((profile or {}).get("account_kind") or ACCOUNT_KIND_PARISH).strip().lower()
    if kind == ACCOUNT_KIND_THEME_DESIGNER:
        return ACCOUNT_KIND_THEME_DESIGNER
    return ACCOUNT_KIND_PARISH


def is_theme_designer_profile(profile: Optional[dict[str, Any]]) -> bool:
    return profile_account_kind(profile) == ACCOUNT_KIND_THEME_DESIGNER


def membership_allows_full_access(
    church_row: Optional[dict[str, Any]],
    *,
    user: Optional[AuthUser] = None,
    profile_role: Optional[str] = None,
) -> bool:
    if is_superadmin_user(user):
        return True
    if (profile_role or "").strip() == "superadmin":
        return True
    if not church_row:
        return False

    # Stripe pay-to-unlock (per parish). When billing is off, fall back to
    # manual membership_status approval.
    try:
        from services.stripe_billing import billing_enabled, parish_has_paid_access

        if billing_enabled():
            return parish_has_paid_access(church_row)
    except Exception:
        pass

    status = (church_row.get("membership_status") or "draft").strip().lower()
    return status == "approved"


def parish_name_is_locked(church_row: Optional[dict[str, Any]]) -> bool:
    if not church_row:
        return False
    return bool(church_row.get("community_name_locked_at"))


def logo_is_locked(church_row: Optional[dict[str, Any]]) -> bool:
    if not church_row:
        return False
    return bool(church_row.get("logo_locked_at"))


def can_edit_logo(church_row: Optional[dict[str, Any]]) -> bool:
    if not church_row or logo_is_locked(church_row):
        return False
    if not parish_name_is_locked(church_row):
        return True
    status = (church_row.get("membership_status") or "draft").strip().lower()
    has_logo = bool((church_row.get("logo_path") or "").strip())
    return status == "approved" and not has_logo


def membership_payload(
    church_row: Optional[dict[str, Any]],
    *,
    user: Optional[AuthUser] = None,
    profile_role: Optional[str] = None,
    profile: Optional[dict[str, Any]] = None,
) -> dict[str, Any]:
    row = church_row or {}
    status = (row.get("membership_status") or "draft").strip().lower()
    locked = parish_name_is_locked(row)
    logo_locked = logo_is_locked(row)
    superadmin = is_superadmin_user(user) or (profile_role or "").strip() == "superadmin"
    role = (user.role if user else None) or profile_role or "member"
    parish_role = (row.get("parish_role") or "").strip().lower() or None
    auth_on = auth_enabled()
    signed_in = user is not None
    account_kind = profile_account_kind(profile)
    is_designer = account_kind == ACCOUNT_KIND_THEME_DESIGNER and not superadmin
    full_access = membership_allows_full_access(row, user=user, profile_role=profile_role)
    can_use_full_app = (full_access or not auth_on) and not is_designer
    # Songs/priests for the global catalog: approved parish members only (not pending/draft).
    can_submit = signed_in and auth_on and not superadmin and full_access and not is_designer
    can_request_parish_rename = (
        signed_in
        and auth_on
        and not superadmin
        and not is_designer
        and parish_role == "president"
        and status == "approved"
        and locked
    )
    billing: dict[str, Any] = {}
    try:
        from services.stripe_billing import billing_payload

        billing = billing_payload(row)
    except Exception:
        billing = {"billing_enabled": False}

    from services.free_mass_credit import free_mass_status_for_user

    free_mass = free_mass_status_for_user(
        user.user_id if user else None,
        profile=profile,
        has_full_access=can_use_full_app or superadmin,
        billing_on=bool(billing.get("billing_enabled")),
    )
    can_generate_mass = bool(
        (not is_designer)
        and (can_use_full_app or superadmin or free_mass.get("can_generate_mass"))
    )

    theme_seller_status: Optional[str] = None
    theme_seller_id: Optional[str] = None
    if is_designer and user and user.user_id:
        try:
            from services.theme_marketplace import get_seller_for_user

            seller = get_seller_for_user(user.user_id)
            if seller:
                theme_seller_status = str(seller.get("status") or "").strip().lower() or None
                theme_seller_id = str(seller.get("id") or "").strip() or None
        except Exception:
            pass

    return {
        "membership_status": status,
        "community_name_locked": locked,
        "logo_locked": logo_locked,
        "can_edit_parish_name": (
            not is_designer and not locked and status in {"draft", ""} and signed_in
        ),
        "can_request_parish_rename": can_request_parish_rename,
        "can_edit_logo": signed_in and not is_designer and can_edit_logo(row),
        "can_edit_church_profile": can_use_full_app,
        "can_use_full_app": can_use_full_app,
        "can_generate_mass": can_generate_mass,
        "can_submit_song": can_submit,
        "can_submit_priest": can_submit,
        "is_superadmin": superadmin,
        "role": (role or "member").strip().lower(),
        "parish_role": parish_role,
        "parish_id": None if is_designer else (row.get("parish_id") or row.get("id")),
        "user_id": user.user_id if user else None,
        "billing": billing,
        "account_kind": account_kind,
        "is_theme_designer": is_designer,
        "theme_seller_status": theme_seller_status,
        "theme_seller_id": theme_seller_id,
        "can_manage_theme_studio": is_designer and theme_seller_status == "approved",
        "default_route": "/themes" if is_designer else "/home",
        "premium_mass_limit": free_mass.get("premium_mass_limit", 0),
        "premium_mass_remaining": free_mass.get("premium_mass_remaining", 0),
        "premium_mass_used": bool(free_mass.get("premium_mass_used")),
        "free_tier_mass_limit": free_mass.get("free_tier_mass_limit", 0),
        "free_tier_mass_remaining": free_mass.get("free_tier_mass_remaining", 0),
        "free_tier_mass_used": bool(free_mass.get("free_tier_mass_used")),
        "next_generation_tier": free_mass.get("next_generation_tier") or "none",
        "can_use_premium_posters": bool(free_mass.get("can_use_premium_posters")),
        # Alias: free_mass_* = one-time premium tokens (legacy UI keys).
        "free_mass_limit": free_mass.get("free_mass_limit", 0),
        "free_mass_remaining": free_mass.get("free_mass_remaining", 0),
        "free_mass_used": bool(free_mass.get("free_mass_used")),
    }
