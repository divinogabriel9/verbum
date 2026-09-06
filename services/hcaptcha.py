"""hCaptcha siteverify helper.

For Supabase Auth (sign-in / sign-up), keep the hCaptcha *secret* in the
Supabase dashboard and pass ``captchaToken`` from the browser — Supabase
verifies the token. Do not siteverify the same token here first; tokens are
single-use.

Use this module for app-owned forms (contact, access request, etc.) or an
explicit ``POST /api/auth/captcha/verify`` check when Supabase CAPTCHA is off.
"""

from __future__ import annotations

import logging
import os
from typing import Any

import requests
from fastapi import Request

from services.auth_config import hcaptcha_secret_key, hcaptcha_site_key

logger = logging.getLogger(__name__)

_SITEVERIFY_URL = "https://api.hcaptcha.com/siteverify"
_TIMEOUT_S = 5


def client_ip(request: Request) -> str:
    if os.environ.get("RENDER") or os.environ.get("RENDER_EXTERNAL_URL"):
        client = request.client
        if client and client.host:
            return client.host
    forwarded = (request.headers.get("x-forwarded-for") or "").split(",")[0].strip()
    if forwarded:
        return forwarded
    client = request.client
    return client.host if client else "unknown"


def verify_token(token: str, ip: str = "") -> tuple[bool, list[str]]:
    """Verify an hCaptcha response token.

    Returns ``(True, [])`` on success, otherwise ``(False, error_codes)``.
    """
    secret = hcaptcha_secret_key()
    response = (token or "").strip()
    if not secret:
        return False, ["missing-input-secret"]
    if not response:
        return False, ["missing-input-response"]

    data: dict[str, str] = {
        "secret": secret,
        "response": response,
    }
    remote_ip = (ip or "").strip()
    if remote_ip and remote_ip != "unknown":
        data["remoteip"] = remote_ip
    sitekey = hcaptcha_site_key()
    if sitekey:
        data["sitekey"] = sitekey

    try:
        raw: dict[str, Any] = requests.post(
            _SITEVERIFY_URL,
            data=data,
            timeout=_TIMEOUT_S,
        ).json()
    except Exception as exc:
        logger.warning("hCaptcha siteverify request failed: %s", exc)
        return False, ["siteverify-request-failed"]

    if raw.get("success"):
        return True, []
    codes = raw.get("error-codes") or []
    if not isinstance(codes, list):
        codes = [str(codes)]
    return False, [str(c) for c in codes]
