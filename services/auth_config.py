"""Supabase Auth environment configuration."""

from __future__ import annotations

import os
from functools import lru_cache


def _clean(value: str | None) -> str:
    return (value or "").strip()


def _normalize_supabase_url(raw: str) -> str:
    url = raw.rstrip("/")
    if url.endswith("/rest/v1"):
        url = url[: -len("/rest/v1")]
    return url


def supabase_url() -> str:
    raw = _clean(os.environ.get("SUPABASE_URL"))
    return _normalize_supabase_url(raw) if raw else ""


def supabase_anon_key() -> str:
    """Legacy JWT anon key (eyJ…). Prefer ``supabase_publishable_key()`` when set."""
    return _clean(os.environ.get("SUPABASE_ANON_KEY"))


def supabase_publishable_key() -> str:
    """Browser-safe key — new ``sb_publishable_…`` or legacy anon JWT."""
    return _clean(os.environ.get("SUPABASE_PUBLISHABLE_KEY")) or supabase_anon_key()


def supabase_client_key() -> str:
    """Key used by supabase-js in the browser."""
    return supabase_publishable_key()


def supabase_service_role_key() -> str:
    return _clean(os.environ.get("SUPABASE_SERVICE_ROLE_KEY"))


def supabase_jwt_secret() -> str:
    """JWT secret from Supabase Dashboard → Project Settings → API → JWT Secret."""
    return _clean(os.environ.get("SUPABASE_JWT_SECRET"))


def app_public_url() -> str:
    """Public app URL for email confirm redirects (no trailing slash)."""
    raw = _clean(os.environ.get("APP_PUBLIC_URL")) or _clean(
        os.environ.get("RENDER_EXTERNAL_URL")
    )
    return raw.rstrip("/") if raw else ""


def auth_enabled() -> bool:
    return bool(supabase_url() and supabase_client_key() and supabase_jwt_secret())


def _flag_enabled(name: str) -> bool:
    value = _clean(os.environ.get(name)).lower()
    return value in {"1", "true", "yes", "on"}


def auth_required() -> bool:
    """Whether this runtime should fail closed when auth is misconfigured."""
    explicit = _clean(os.environ.get("REQUIRE_AUTH")).lower()
    if explicit in {"1", "true", "yes", "on"}:
        return True
    if explicit in {"0", "false", "no", "off"}:
        return False
    return bool(
        _clean(os.environ.get("RENDER"))
        or _clean(os.environ.get("RENDER_EXTERNAL_URL"))
        or _flag_enabled("PRODUCTION")
        or _flag_enabled("IS_PRODUCTION")
        or _clean(os.environ.get("APP_ENV")).lower() == "production"
        or _clean(os.environ.get("ENVIRONMENT")).lower() == "production"
    )


def auth_misconfigured() -> bool:
    return auth_required() and not auth_enabled()


def supabase_enabled() -> bool:
    return bool(
        supabase_url() and (supabase_client_key() or supabase_service_role_key())
    )


def invite_only_signup() -> bool:
    """When true, /sign-up requires a valid ?invite= token."""
    explicit = _clean(os.environ.get("INVITE_ONLY_SIGNUP")).lower()
    if explicit in {"1", "true", "yes", "on"}:
        return True
    if explicit in {"0", "false", "no", "off"}:
        return False
    return auth_required()


def invite_contact_email() -> str:
    """Shown on landing/sign-in when users need an administrator."""
    direct = _clean(os.environ.get("INVITE_CONTACT_EMAIL"))
    if direct:
        return direct
    from services.membership_config import superadmin_emails

    emails = superadmin_emails()
    if emails:
        return sorted(emails)[0]
    return ""


@lru_cache(maxsize=1)
def public_auth_config() -> dict[str, str | bool]:
    from services.app_version import get_version_info

    base = app_public_url()
    contact = invite_contact_email()
    version = get_version_info()
    return {
        "auth_enabled": auth_enabled(),
        "supabase_enabled": supabase_enabled(),
        "supabase_url": supabase_url(),
        "supabase_anon_key": supabase_client_key(),
        "supabase_publishable_key": supabase_client_key(),
        "app_public_url": base,
        "email_confirm_redirect_url": (base + "/sign-in") if base else "",
        "sign_in_url": "/sign-in",
        "sign_up_url": "/sign-up",
        "after_sign_in_url": "/home",
        "after_sign_up_url": "/home",
        "invite_only_signup": invite_only_signup(),
        "invite_contact_email": contact,
        "app_version": str(version.get("version") or "dev"),
        "git_commit": str(version.get("git_commit") or ""),
        "git_commit_short": str(version.get("git_commit_short") or ""),
        "git_branch": str(version.get("git_branch") or ""),
    }
