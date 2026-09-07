"""Public-facing contact addresses — never expose personal inboxes."""

from __future__ import annotations

import os
import re
from functools import lru_cache

# Personal / consumer domains must never appear on legal pages or /api/auth/config.
_PERSONAL_DOMAINS = frozenset(
    {
        "gmail.com",
        "googlemail.com",
        "yahoo.com",
        "yahoo.co.uk",
        "ymail.com",
        "hotmail.com",
        "outlook.com",
        "live.com",
        "msn.com",
        "icloud.com",
        "me.com",
        "mac.com",
        "aol.com",
        "protonmail.com",
        "proton.me",
        "pm.me",
        "gmx.com",
        "gmx.net",
        "mail.com",
    }
)

_EMAIL_RE = re.compile(r"^[^@\s]+@([^@\s]+\.[^@\s]+)$")

_DEFAULT_PUBLIC = "hello@liturgyflow.com"
_DEFAULT_PRIVACY = "privacy@liturgyflow.com"
_DEFAULT_SUPPORT = "support@liturgyflow.com"
_DEFAULT_DMCA = "copyright@liturgyflow.com"


def _clean(value: str | None) -> str:
    return (value or "").strip()


def is_personal_inbox(email: str) -> bool:
    """True when the address looks like a personal consumer mailbox."""
    match = _EMAIL_RE.match((email or "").strip().lower())
    if not match:
        return True
    return match.group(1) in _PERSONAL_DOMAINS


def public_safe_email(raw: str | None, *, fallback: str) -> str:
    """Return raw only if it is a non-personal address; otherwise fallback."""
    candidate = _clean(raw)
    if candidate and not is_personal_inbox(candidate):
        return candidate.lower()
    fb = _clean(fallback) or _DEFAULT_PUBLIC
    return fb.lower()


@lru_cache(maxsize=1)
def public_contact_emails() -> dict[str, str]:
    """Addresses safe to put in HTML, legal pages, and public JSON APIs."""
    privacy = public_safe_email(
        os.environ.get("PRIVACY_CONTACT_EMAIL"),
        fallback=_DEFAULT_PRIVACY,
    )
    support = public_safe_email(
        os.environ.get("SUPPORT_CONTACT_EMAIL")
        or os.environ.get("INVITE_CONTACT_EMAIL"),
        fallback=_DEFAULT_SUPPORT,
    )
    # If INVITE_CONTACT_EMAIL was a Gmail, support already fell back.
    hello = public_safe_email(
        os.environ.get("PUBLIC_CONTACT_EMAIL")
        or os.environ.get("INVITE_CONTACT_EMAIL"),
        fallback=_DEFAULT_PUBLIC,
    )
    dmca = public_safe_email(
        os.environ.get("DMCA_CONTACT_EMAIL"),
        fallback=_DEFAULT_DMCA,
    )
    return {
        "hello": hello,
        "privacy": privacy,
        "support": support,
        "dmca": dmca,
    }
