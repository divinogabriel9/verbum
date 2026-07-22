"""Guest landing demo generate — rate limits and short-lived download tokens."""

from __future__ import annotations

import base64
import hashlib
import hmac
import logging
import os
import time
from datetime import date, timedelta
from pathlib import Path
from typing import Optional, Tuple

from fastapi import HTTPException
from starlette.requests import Request

from services.rate_limit import check_rate_limit_key

logger = logging.getLogger(__name__)

DEMO_WATERMARK = "Liturgyflow.com"
DEMO_DOWNLOAD_TTL_S = 30 * 60  # 30 minutes
_ALLOWED_OUR_FATHER = frozenset({"english", "malay", "tagalog"})
_ALLOWED_THEME_IDS = frozenset({"theme1", "theme2", "theme3"})


def _signing_secret() -> bytes:
    raw = (
        os.environ.get("DEMO_DOWNLOAD_SECRET", "").strip()
        or os.environ.get("PRACTICE_UNLOCK_SECRET", "").strip()
        or os.environ.get("SUPABASE_JWT_SECRET", "").strip()
        or os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "").strip()
        or "verbum-dev-demo-download-insecure"
    )
    if raw == "verbum-dev-demo-download-insecure":
        logger.warning(
            "Demo download tokens use a dev-only secret; set DEMO_DOWNLOAD_SECRET in production."
        )
    return raw.encode("utf-8")


def _client_ip(request: Request) -> str:
    if os.environ.get("RENDER") or os.environ.get("RENDER_EXTERNAL_URL"):
        client = request.client
        if client and client.host:
            return client.host
    forwarded = (request.headers.get("x-forwarded-for") or "").split(",")[0].strip()
    if forwarded:
        return forwarded
    client = request.client
    return client.host if client else "unknown"


def enforce_demo_rate_limits(request: Request) -> None:
    """Raise 429 when this IP (or global pool) is over quota."""
    ip = _client_ip(request)
    for key, tier in (
        (f"demo:burst:{ip}", "demo_burst"),
        (f"demo:day:{ip}", "demo_generate"),
        ("demo:global", "demo_global"),
    ):
        allowed, retry_after = check_rate_limit_key(key, tier)
        if not allowed:
            raise HTTPException(
                status_code=429,
                detail={
                    "message": (
                        "Free daily generate used. Contact our admin to sign up for unlimited Mass decks."
                        if tier == "demo_generate"
                        else "Too many free generates. Try again later, or contact our admin to sign up."
                    ),
                    "retry_after": retry_after,
                    "tier": tier,
                },
                headers={"Retry-After": str(max(1, retry_after))},
            )


def upcoming_sunday(today: Optional[date] = None) -> date:
    d = today or date.today()
    # weekday(): Mon=0 … Sun=6 → days until Sunday
    add = (6 - d.weekday()) % 7
    return d + timedelta(days=add)


def validate_demo_date(raw: str) -> str:
    """Accept only dates within ±7 days of the upcoming Sunday."""
    try:
        d = date.fromisoformat(str(raw or "").strip())
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid Mass date.") from exc
    target = upcoming_sunday()
    if abs((d - target).days) > 7:
        raise HTTPException(
            status_code=400,
            detail="Demo generate is limited to this coming Sunday.",
        )
    return d.isoformat()


def validate_our_father(choice: str) -> str:
    c = str(choice or "english").strip().lower()
    if c not in _ALLOWED_OUR_FATHER:
        return "english"
    return c


def validate_theme_id(theme: Optional[dict]) -> Optional[dict]:
    if not theme or not isinstance(theme, dict):
        return None
    tid = str(theme.get("id") or "").strip().lower()
    if tid not in _ALLOWED_THEME_IDS:
        theme = dict(theme)
        theme["id"] = "theme1"
    return theme


def mint_demo_download_token(filename: str, *, ttl_s: int = DEMO_DOWNLOAD_TTL_S) -> str:
    """Return a URL-safe token: base64(exp|name|sig)."""
    name = Path(str(filename or "")).name
    if not name.lower().endswith(".pptx") or ".." in name or "/" in name:
        raise HTTPException(status_code=400, detail="Invalid demo file.")
    exp = int(time.time()) + max(60, int(ttl_s))
    payload = f"{exp}|{name}"
    sig = hmac.new(_signing_secret(), payload.encode("utf-8"), hashlib.sha256).hexdigest()[:32]
    raw = f"{payload}|{sig}".encode("utf-8")
    return base64.urlsafe_b64encode(raw).decode("ascii").rstrip("=")


def resolve_demo_download_token(token: str) -> str:
    """Validate token and return the pptx basename."""
    raw = (token or "").strip()
    if not raw:
        raise HTTPException(status_code=400, detail="Missing download token.")
    pad = "=" * (-len(raw) % 4)
    try:
        decoded = base64.urlsafe_b64decode(raw + pad).decode("utf-8")
        exp_s, name, sig = decoded.split("|", 2)
        exp = int(exp_s)
    except (ValueError, UnicodeDecodeError) as exc:
        raise HTTPException(status_code=400, detail="Invalid download token.") from exc
    name = Path(name).name
    if not name.lower().endswith(".pptx") or ".." in name:
        raise HTTPException(status_code=400, detail="Invalid download token.")
    if exp < int(time.time()):
        raise HTTPException(status_code=410, detail="Download link expired. Generate again.")
    payload = f"{exp}|{name}"
    expected = hmac.new(
        _signing_secret(), payload.encode("utf-8"), hashlib.sha256
    ).hexdigest()[:32]
    if not hmac.compare_digest(expected, sig):
        raise HTTPException(status_code=403, detail="Invalid download token.")
    return name


def demo_download_url(filename: str) -> str:
    token = mint_demo_download_token(filename)
    return f"/api/demo-download/{token}"


def remaining_hint_after_consume() -> dict[str, int]:
    """UI hint after a successful generate (quota already consumed)."""
    return {"remaining_today": 0, "download_ttl_seconds": DEMO_DOWNLOAD_TTL_S}
