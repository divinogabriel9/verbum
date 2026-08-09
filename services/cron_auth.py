"""Shared auth for internal cron / job endpoints."""

from __future__ import annotations

import hmac
import os
from typing import Optional

from fastapi import HTTPException


def cron_secret() -> str:
    return (
        os.environ.get("CRON_SECRET", "").strip()
        or os.environ.get("EMAIL_CRON_SECRET", "").strip()
    )


def cron_secret_configured() -> bool:
    return bool(cron_secret())


def require_cron_auth(
    authorization: Optional[str] = None,
    x_cron_secret: Optional[str] = None,
) -> None:
    expected = cron_secret()
    if not expected:
        raise HTTPException(
            status_code=503,
            detail="Set CRON_SECRET (or EMAIL_CRON_SECRET) to enable internal jobs.",
        )
    provided = (x_cron_secret or "").strip()
    if not provided and authorization:
        auth = authorization.strip()
        if auth.lower().startswith("bearer "):
            provided = auth[7:].strip()
        else:
            provided = auth
    if not provided or not hmac.compare_digest(provided, expected):
        raise HTTPException(status_code=401, detail="Invalid cron secret.")
