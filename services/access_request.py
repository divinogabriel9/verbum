"""Landing access-request form — stores for review and emails admin + requester."""

from __future__ import annotations

import json
import logging
import os
import re
import time
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any

from fastapi import HTTPException
from starlette.requests import Request

from services.email_notifications import (
    notify_access_request_admin,
    notify_access_request_user,
    safe_send,
)
from services.rate_limit import check_rate_limit_key
from services.redis_client import get_redis

logger = logging.getLogger(__name__)

_DEFAULT_REVIEW_TO = "divinogabriel76@gmail.com"
_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
_PROJECT_ROOT = Path(__file__).resolve().parents[1]
_STORE_PATH = _PROJECT_ROOT / "data" / "access_requests.json"
_REDIS_LIST_KEY = "verbum:access_requests"
_REDIS_MAX = 500


@dataclass
class AccessRequest:
    name: str
    email: str
    parish: str
    message: str
    created_at: float
    client_ip: str = ""


def review_inbox() -> str:
    return (
        os.environ.get("ACCESS_REQUEST_TO", "").strip()
        or os.environ.get("INVITE_CONTACT_EMAIL", "").strip()
        or _DEFAULT_REVIEW_TO
    )


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


def enforce_access_request_limits(request: Request) -> None:
    ip = _client_ip(request)
    for key, tier in (
        (f"access:burst:{ip}", "demo_burst"),
        (f"access:day:{ip}", "demo_generate"),
    ):
        allowed, retry_after = check_rate_limit_key(key, tier)
        if not allowed:
            raise HTTPException(
                status_code=429,
                detail="Too many requests. Please try again later.",
                headers={"Retry-After": str(max(1, retry_after))},
            )


def _clean(value: str, *, max_len: int) -> str:
    return " ".join(str(value or "").split()).strip()[:max_len]


def validate_access_request(
    *,
    name: str,
    email: str,
    parish: str,
    message: str,
    request: Request,
) -> AccessRequest:
    clean_name = _clean(name, max_len=120)
    clean_email = _clean(email, max_len=320).lower()
    clean_parish = _clean(parish, max_len=240)
    clean_message = _clean(message, max_len=1000)
    if len(clean_name) < 2:
        raise HTTPException(status_code=400, detail="Please enter your name.")
    if not _EMAIL_RE.match(clean_email):
        raise HTTPException(status_code=400, detail="Please enter a valid email.")
    if len(clean_parish) < 2:
        raise HTTPException(status_code=400, detail="Please enter your parish or church name.")
    return AccessRequest(
        name=clean_name,
        email=clean_email,
        parish=clean_parish,
        message=clean_message,
        created_at=time.time(),
        client_ip=_client_ip(request),
    )


def _persist_local(row: AccessRequest) -> None:
    _STORE_PATH.parent.mkdir(parents=True, exist_ok=True)
    rows: list[dict[str, Any]] = []
    if _STORE_PATH.is_file():
        try:
            raw = json.loads(_STORE_PATH.read_text(encoding="utf-8"))
            if isinstance(raw, list):
                rows = [r for r in raw if isinstance(r, dict)]
        except (OSError, json.JSONDecodeError):
            rows = []
    rows.append(asdict(row))
    rows = rows[-_REDIS_MAX:]
    _STORE_PATH.write_text(json.dumps(rows, ensure_ascii=False, indent=2), encoding="utf-8")


def _persist_redis(row: AccessRequest) -> None:
    client = get_redis()
    if client is None:
        return
    try:
        client.lpush(_REDIS_LIST_KEY, json.dumps(asdict(row), ensure_ascii=False))
        client.ltrim(_REDIS_LIST_KEY, 0, _REDIS_MAX - 1)
    except Exception as exc:
        logger.warning("Redis access-request store failed: %s", exc)


def submit_access_request(row: AccessRequest) -> dict[str, Any]:
    """Persist + notify admin and requester. Always succeeds for the visitor if storage works."""
    try:
        _persist_local(row)
    except Exception as exc:
        logger.warning("Local access-request store failed: %s", exc)
    _persist_redis(row)

    to_addr = review_inbox()
    admin = safe_send(
        "access_request_admin",
        notify_access_request_admin,
        name=row.name,
        email=row.email,
        parish=row.parish,
        message=row.message,
        client_ip=row.client_ip,
        to_addr=to_addr,
    )
    user = safe_send(
        "access_request_user",
        notify_access_request_user,
        name=row.name,
        email=row.email,
        parish=row.parish,
    )
    emailed = bool(admin.ok or user.ok)
    if not emailed:
        logger.warning(
            "Access request stored but email not sent (configure BREVO_API_KEY or SMTP_*). "
            "to=%s name=%s email=%s parish=%s",
            to_addr,
            row.name,
            row.email,
            row.parish,
        )
        print(
            f"[access-request] {row.name} <{row.email}> parish={row.parish!r} "
            f"msg={row.message!r} emailed=0",
            flush=True,
        )
    else:
        print(
            f"[access-request] {row.name} <{row.email}> parish={row.parish!r} "
            f"emailed=1 admin={int(admin.ok)} user={int(user.ok)}",
            flush=True,
        )
    return {
        "ok": True,
        "emailed": emailed,
        "emailed_admin": admin.ok,
        "emailed_user": user.ok,
    }
