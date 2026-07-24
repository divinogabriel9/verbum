"""Deep-link URLs for transactional emails (login → destination)."""

from __future__ import annotations

from urllib.parse import quote, urlencode

from services.auth_config import app_public_url


def _base() -> str:
    return (app_public_url() or "").rstrip("/")


def sign_in_redirect_url(destination_path: str) -> str:
    """Build /sign-in?redirect_url=… so post-auth lands on destination."""
    base = _base()
    dest = destination_path if destination_path.startswith("/") else f"/{destination_path}"
    encoded = quote(dest, safe="")
    if not base:
        return f"/sign-in?redirect_url={encoded}"
    return f"{base}/sign-in?redirect_url={encoded}"


def mass_builder_path(*, date: str = "", intent: str = "") -> str:
    """Relative SPA path with optional date + intent query params."""
    params: dict[str, str] = {}
    d = (date or "").strip()
    if d:
        params["date"] = d
    intent_clean = (intent or "").strip().lower()
    if intent_clean in {"generate", "practice-share"}:
        params["intent"] = intent_clean
    qs = urlencode(params)
    return f"/mass/builder?{qs}" if qs else "/mass/builder"


def mass_pptx_cta_url(*, mass_date: str = "") -> str:
    return sign_in_redirect_url(mass_builder_path(date=mass_date, intent="generate"))


def practice_share_cta_url(*, mass_date: str = "") -> str:
    return sign_in_redirect_url(mass_builder_path(date=mass_date, intent="practice-share"))


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
