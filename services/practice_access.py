"""Practice share access control — PIN hashing, unlock cookies, abuse limits."""

from __future__ import annotations

import hashlib
import hmac
import logging
import os
import secrets
import time
from datetime import datetime, timezone
from typing import Any, Optional, Tuple

from starlette.requests import Request
from starlette.responses import Response

from services.rate_limit import check_rate_limit_key

from services.runtime_config import practice_unlock_secret_required

logger = logging.getLogger(__name__)

_PIN_PREFIX = "v1:"
_COOKIE_PREFIX = "vf_pu_"
_PIN_PBKDF2_ROUNDS = 40_000


def ensure_practice_secret_configured() -> None:
    """Fail fast on startup when production lacks a dedicated unlock secret."""
    _signing_secret()


def _signing_secret() -> bytes:
    raw = os.environ.get("PRACTICE_UNLOCK_SECRET", "").strip()
    if not raw and practice_unlock_secret_required():
        raise RuntimeError(
            "PRACTICE_UNLOCK_SECRET is required in production. "
            "Set it in Render environment variables."
        )
    if not raw:
        raw = (
            os.environ.get("SUPABASE_JWT_SECRET", "").strip()
            or os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "").strip()
        )
    if not raw:
        raw = "verbum-dev-practice-unlock-insecure"
        logger.warning("Practice unlock cookies use a dev-only secret; set PRACTICE_UNLOCK_SECRET in production.")
    return raw.encode("utf-8")


def hash_pin(pin: str) -> str:
    salt = secrets.token_hex(8)
    digest = hashlib.pbkdf2_hmac(
        "sha256",
        pin.encode("utf-8"),
        salt.encode("utf-8"),
        _PIN_PBKDF2_ROUNDS,
    )
    return f"{_PIN_PREFIX}{salt}:{digest.hex()}"


def verify_pin(stored: Optional[str], supplied: str) -> bool:
    if not stored:
        return False
    digits = "".join(ch for ch in str(supplied or "") if ch.isdigit())
    if len(digits) != 6:
        return False
    stored_s = str(stored)
    if stored_s.startswith(_PIN_PREFIX):
        try:
            _, rest = stored_s.split(_PIN_PREFIX, 1)
            salt, expected = rest.split(":", 1)
        except ValueError:
            return False
        digest = hashlib.pbkdf2_hmac(
            "sha256",
            digits.encode("utf-8"),
            salt.encode("utf-8"),
            _PIN_PBKDF2_ROUNDS,
        )
        return hmac.compare_digest(digest.hex(), expected)
    return hmac.compare_digest(digits, stored_s)


def pin_required(stored: Optional[str]) -> bool:
    return bool((stored or "").strip())


def _cookie_name(token: str) -> str:
    digest = hashlib.sha256(token.encode("utf-8")).hexdigest()[:16]
    return f"{_COOKIE_PREFIX}{digest}"


def _cookie_secure(request: Request) -> bool:
    if os.environ.get("PRACTICE_COOKIE_SECURE", "").strip() == "0":
        return False
    if request.url.scheme == "https":
        return True
    forwarded = (request.headers.get("x-forwarded-proto") or "").split(",")[0].strip().lower()
    return forwarded == "https"


def client_ip(request: Request) -> str:
    forwarded = (request.headers.get("x-forwarded-for") or "").split(",")[0].strip()
    if forwarded:
        return forwarded
    client = request.client
    return client.host if client else "unknown"


def normalize_device_id(raw: Optional[str]) -> str:
    """Stable client device id (UUID-ish). Empty if missing/invalid."""
    clean = "".join(ch for ch in str(raw or "").strip() if ch.isalnum() or ch in "-_")
    if len(clean) < 16 or len(clean) > 80:
        return ""
    return clean


def hash_device_id(raw: Optional[str]) -> str:
    device = normalize_device_id(raw)
    if not device:
        return ""
    return hashlib.sha256(device.encode("utf-8")).hexdigest()[:32]


def practice_device_id_from_request(request: Request) -> str:
    header = (
        request.headers.get("x-practice-device-id")
        or request.headers.get("x-device-id")
        or ""
    )
    query = (request.query_params.get("device_id") or "").strip()
    return normalize_device_id(header) or normalize_device_id(query)


def is_unlocked(request: Request, token: str, share_expires_at: Any) -> bool:
    """Return True when this browser has a valid unlock cookie for the token."""
    tok = (token or "").strip()
    if not tok:
        return False
    raw = request.cookies.get(_cookie_name(tok))
    if not raw:
        return False
    try:
        payload, sig = raw.rsplit("|", 1)
        cookie_token, exp_s = payload.split("|", 1)
        exp = int(exp_s)
    except ValueError:
        return False
    if cookie_token != tok:
        return False
    expected_sig = hmac.new(_signing_secret(), payload.encode("utf-8"), "sha256").hexdigest()
    if not hmac.compare_digest(sig, expected_sig):
        return False
    now = int(time.time())
    if exp <= now:
        return False
    share_exp = _parse_expires(share_expires_at)
    if share_exp and share_exp.timestamp() <= now:
        return False
    return True


def issue_unlock_cookie(request: Request, response: Response, token: str, share_expires_at: Any) -> None:
    tok = (token or "").strip()
    share_exp = _parse_expires(share_expires_at)
    exp = int(share_exp.timestamp()) if share_exp else int(time.time()) + 3600
    payload = f"{tok}|{exp}"
    sig = hmac.new(_signing_secret(), payload.encode("utf-8"), "sha256").hexdigest()
    max_age = max(60, exp - int(time.time()))
    response.set_cookie(
        _cookie_name(tok),
        f"{payload}|{sig}",
        max_age=max_age,
        httponly=True,
        secure=_cookie_secure(request),
        samesite="lax",
        path="/",
    )


def issue_lead_token(
    token: str,
    share_expires_at: Any,
    *,
    device_id: Optional[str] = None,
) -> str:
    """Signed leader token — opens practice in edit mode without PIN.

    Bound to the creator device id so a leaked lead URL cannot be used on
    another browser/device.
    """
    tok = (token or "").strip()
    device_hash = hash_device_id(device_id)
    if not device_hash:
        raise ValueError("A device id is required to issue a leader link.")
    share_exp = _parse_expires(share_expires_at)
    exp = int(share_exp.timestamp()) if share_exp else int(time.time()) + 3600
    payload = f"lead|{tok}|{exp}|{device_hash}"
    sig = hmac.new(_signing_secret(), payload.encode("utf-8"), "sha256").hexdigest()
    return f"{payload}|{sig}"


def verify_lead_token(
    token: str,
    lead_token: str,
    share_expires_at: Any = None,
    *,
    device_id: Optional[str] = None,
) -> bool:
    raw = (lead_token or "").strip()
    tok = (token or "").strip()
    if not raw or not tok:
        return False
    parts = raw.split("|")
    # New format: lead|token|exp|device_hash|sig
    if len(parts) != 5:
        return False
    kind, cookie_token, exp_s, device_hash, sig = parts
    try:
        exp = int(exp_s)
    except ValueError:
        return False
    if kind != "lead" or cookie_token != tok:
        return False
    expected_device = hash_device_id(device_id)
    if not expected_device or not hmac.compare_digest(device_hash, expected_device):
        return False
    payload = f"lead|{tok}|{exp}|{device_hash}"
    expected = hmac.new(_signing_secret(), payload.encode("utf-8"), "sha256").hexdigest()
    if not hmac.compare_digest(sig, expected):
        return False
    now = int(time.time())
    if exp <= now:
        return False
    share_exp = _parse_expires(share_expires_at)
    if share_exp and share_exp.timestamp() <= now:
        return False
    return True


def _parse_expires(expires: Any) -> Optional[datetime]:
    if not expires:
        return None
    try:
        exp = datetime.fromisoformat(str(expires).replace("Z", "+00:00"))
        if exp.tzinfo is None:
            exp = exp.replace(tzinfo=timezone.utc)
        return exp
    except ValueError:
        return None


def check_practice_fetch_allowed(request: Request, token: str) -> Tuple[bool, int]:
    """Per-IP fetch budget for public practice lyrics API."""
    ip = client_ip(request)
    return check_rate_limit_key(f"practice:ip:{ip}", "practice")


def check_practice_page_allowed(request: Request) -> Tuple[bool, int]:
    ip = client_ip(request)
    return check_rate_limit_key(f"practice:page:{ip}", "practice_page")


def check_pin_unlock_allowed(request: Request, token: str) -> Tuple[bool, int]:
    ip = client_ip(request)
    tok = (token or "").strip()[:24]
    return check_rate_limit_key(f"practice:pin:{ip}:{tok}", "practice_pin")


def check_practice_token_allowed(token: str) -> Tuple[bool, int]:
    """Global per-share scrape budget (all clients combined)."""
    tok = (token or "").strip()[:24]
    return check_rate_limit_key(f"practice:token:{tok}", "practice_token")


def check_practice_share_create_allowed(request: Request, actor_key: str) -> Tuple[bool, int]:
    ip = client_ip(request)
    actor = (actor_key or "anon").strip()[:48]
    return check_rate_limit_key(f"practice:create:{actor}:{ip}", "practice_create")


def check_practice_lead_allowed(request: Request, token: str, device_id: Optional[str] = None) -> Tuple[bool, int]:
    """Leader API budget scoped to device + share token (leaked URL cannot burn unlimited quota anonymously)."""
    tok = (token or "").strip()[:24]
    device_hash = hash_device_id(device_id) or "nodevice"
    ip = client_ip(request)
    return check_rate_limit_key(f"practice:lead:{device_hash}:{tok}:{ip}", "practice_lead")


def check_practice_lead_song_allowed(request: Request, token: str, device_id: Optional[str] = None) -> Tuple[bool, int]:
    """Tighter budget for catalog lyric resolves (main theft vector)."""
    tok = (token or "").strip()[:24]
    device_hash = hash_device_id(device_id) or "nodevice"
    ip = client_ip(request)
    return check_rate_limit_key(f"practice:lead-song:{device_hash}:{tok}:{ip}", "practice_lead_song")


def practice_no_store_headers() -> dict[str, str]:
    return {
        "Cache-Control": "no-store, private",
        "Pragma": "no-cache",
    }
