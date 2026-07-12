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
    full_access = membership_allows_full_access(row, user=user, profile_role=profile_role)
    can_use_full_app = full_access or not auth_on
    can_submit = signed_in and auth_on and not superadmin and not full_access
    return {
        "membership_status": status,
        "community_name_locked": locked,
        "logo_locked": logo_locked,
        "can_edit_parish_name": not locked and status in {"draft", ""} and signed_in,
        "can_edit_logo": signed_in and can_edit_logo(row),
        "can_edit_church_profile": can_use_full_app,
        "can_use_full_app": can_use_full_app,
        "can_submit_song": can_submit,
        "can_submit_priest": can_submit,
        "is_superadmin": superadmin,
        "role": (role or "member").strip().lower(),
        "parish_role": parish_role,
        "parish_id": row.get("parish_id"),
        "user_id": user.user_id if user else None,
    }
