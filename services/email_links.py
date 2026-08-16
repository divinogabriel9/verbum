"""Deep-link URLs for transactional emails (login → destination)."""

from __future__ import annotations

from urllib.parse import quote, urlencode

from services.auth_config import app_public_url


def _base() -> str:
    return (app_public_url() or "").rstrip("/")


def sign_in_redirect_url(destination_path: str, extra: dict[str, str] | None = None) -> str:
    """Build /sign-in?redirect_url=… so post-auth lands on destination.

    Optional ``extra`` query params are siblings of redirect_url (not nested
    inside it) so mobile mail apps that split ``?`` / ``&`` still keep them.
    """
    base = _base()
    dest = destination_path if destination_path.startswith("/") else f"/{destination_path}"
    params: dict[str, str] = {"redirect_url": dest}
    for key, value in (extra or {}).items():
        clean = str(value or "").strip()
        if clean:
            params[key] = clean
    qs = urlencode(params)
    if not base:
        return f"/sign-in?{qs}"
    return f"{base}/sign-in?{qs}"


def mass_builder_path(*, date: str = "", intent: str = "", handoff: str = "") -> str:
    """Relative SPA path with optional date + intent query params."""
    params: dict[str, str] = {}
    d = (date or "").strip()
    if d:
        params["date"] = d
    intent_clean = (intent or "").strip().lower()
    if intent_clean in {"generate", "practice-share", "practice-lyrics"}:
        params["intent"] = intent_clean
    hid = (handoff or "").strip()
    if hid and intent_clean == "practice-lyrics":
        params["handoff"] = hid
    qs = urlencode(params)
    return f"/mass/builder?{qs}" if qs else "/mass/builder"


def home_path(*, date: str = "", intent: str = "") -> str:
    """Home SPA path with optional date + intent (choir share lyrics)."""
    params: dict[str, str] = {}
    d = (date or "").strip()
    if d:
        params["date"] = d
    intent_clean = (intent or "").strip().lower()
    if intent_clean == "practice-share":
        params["intent"] = intent_clean
    qs = urlencode(params)
    return f"/home?{qs}" if qs else "/home"


def mass_pptx_cta_url(*, mass_date: str = "") -> str:
    return sign_in_redirect_url(mass_builder_path(date=mass_date, intent="generate"))


def practice_share_cta_url(*, mass_date: str = "") -> str:
    extra: dict[str, str] = {"intent": "practice-share"}
    d = (mass_date or "").strip()
    if d:
        extra["date"] = d
    # Keep redirect_url as a bare /home path. Intent + date travel as sibling
    # query params so iOS/Android mail clients cannot strip them from a nested URL.
    return sign_in_redirect_url("/home", extra)


def practice_lyrics_handoff_cta_url(*, mass_date: str = "", handoff: str = "") -> str:
    """Email CTA: sign-in → Mass Builder with practice lyrics handoff token."""
    extra: dict[str, str] = {"intent": "practice-lyrics"}
    d = (mass_date or "").strip()
    if d:
        extra["date"] = d
    hid = (handoff or "").strip()
    if hid:
        extra["handoff"] = hid
    # Bare /mass/builder path; intent/date/handoff as siblings for mail clients.
    return sign_in_redirect_url("/mass/builder", extra)


def home_cta_url() -> str:
    return sign_in_redirect_url("/home")


def invite_signup_url(token: str) -> str:
    base = _base()
    tok = (token or "").strip()
    if not tok:
        return base or "/"
    path = f"/sign-up?invite={quote(tok, safe='')}"
    return f"{base}{path}" if base else path


def absolute_or_path(path: str) -> str:
    base = _base()
    p = path if path.startswith("/") else f"/{path}"
    return f"{base}{p}" if base else p
