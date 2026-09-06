"""Landing contact form — stores for review and emails superadmins + requester."""

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
    notify_contact_admin,
    notify_contact_user,
    safe_send,
)
from services.rate_limit import check_rate_limit_key
from services.redis_client import get_redis

logger = logging.getLogger(__name__)

_DEFAULT_REVIEW_TO = "divinogabriel76@gmail.com"
_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
_URL_RE = re.compile(r"https?://", re.IGNORECASE)
_PROJECT_ROOT = Path(__file__).resolve().parents[1]
_STORE_PATH = _PROJECT_ROOT / "data" / "contact_messages.json"
_REDIS_LIST_KEY = "verbum:contact_messages"
_REDIS_MAX = 500
_MIN_DWELL_S = 2.5
_MAX_FORM_AGE_S = 6 * 3600
_MAX_LINKS = 4

CONTACT_TOPICS: dict[str, str] = {
    "question": "Question about LiturgyFlow",
    "access": "I want access / an invite",
    "demo": "Something went wrong with the demo",
    "parish": "Parish or partnership",
    "other": "Something else",
}


@dataclass
class ContactMessage:
    name: str
    email: str
    topic: str
    topic_label: str
    message: str
    created_at: float
    client_ip: str = ""


def contact_inbox() -> list[str]:
    """Deliver contact mail to SUPERADMIN_EMAILS (the operator inbox)."""
    from services.membership_config import superadmin_emails

    emails = sorted(superadmin_emails())
    if emails:
        return emails
    fallback = (
        os.environ.get("ACCESS_REQUEST_TO", "").strip()
        or os.environ.get("INVITE_CONTACT_EMAIL", "").strip()
        or _DEFAULT_REVIEW_TO
    )
    return [fallback.lower()] if fallback else []


def _format_retry_after(seconds: int) -> str:
    secs = max(1, int(seconds))
    if secs < 60:
        return f"{secs} second{'s' if secs != 1 else ''}"
    minutes = (secs + 59) // 60
    if minutes < 60:
        return f"{minutes} minute{'s' if minutes != 1 else ''}"
    hours = (minutes + 59) // 60
    return f"{hours} hour{'s' if hours != 1 else ''}"


def is_honeypot(website: str) -> bool:
    return bool(_clean(website, max_len=200))


def enforce_contact_limits(*, request: Request, email: str) -> None:
    ip = _client_ip(request)
    email_key = (email or "").strip().lower() or "unknown"
    for key, tier in (
        (f"contact:burst:{ip}", "contact_burst"),
        (f"contact:day:{ip}", "contact_day"),
        (f"contact:email:{email_key}", "contact_email"),
        ("contact:global", "contact_global"),
    ):
        allowed, retry_after = check_rate_limit_key(key, tier)
        if not allowed:
            wait = _format_retry_after(retry_after)
            raise HTTPException(
                status_code=429,
                detail=f"Too many messages. Please try again in {wait}.",
                headers={"Retry-After": str(max(1, retry_after))},
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


def _clean(value: str, *, max_len: int) -> str:
    return " ".join(str(value or "").split()).strip()[:max_len]


def validate_contact(
    *,
    name: str,
    email: str,
    topic: str,
    message: str,
    request: Request,
    started_at: float = 0,
) -> ContactMessage:
    clean_name = _clean(name, max_len=120)
    clean_email = _clean(email, max_len=320).lower()
    clean_topic = _clean(topic, max_len=40).lower()
    clean_message = _clean(message, max_len=2000)
    if len(clean_name) < 2:
        raise HTTPException(status_code=400, detail="Please enter your name.")
    if not _EMAIL_RE.match(clean_email):
        raise HTTPException(status_code=400, detail="Please enter a valid email.")
    if clean_topic not in CONTACT_TOPICS:
        raise HTTPException(status_code=400, detail="Please choose what this is about.")
    if len(clean_message) < 8:
        raise HTTPException(status_code=400, detail="Please write a short message.")
    if len(_URL_RE.findall(clean_message)) > _MAX_LINKS:
        raise HTTPException(status_code=400, detail="Please remove extra links from your message.")
    elapsed = time.time() - float(started_at or 0)
    if elapsed < _MIN_DWELL_S or elapsed > _MAX_FORM_AGE_S:
        raise HTTPException(status_code=400, detail="Please try sending your message again.")
    return ContactMessage(
        name=clean_name,
        email=clean_email,
        topic=clean_topic,
        topic_label=CONTACT_TOPICS[clean_topic],
        message=clean_message,
        created_at=time.time(),
        client_ip=_client_ip(request),
    )


def _persist_local(row: ContactMessage) -> None:
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


def _persist_redis(row: ContactMessage) -> None:
    client = get_redis()
    if client is None:
        return
    try:
        client.lpush(_REDIS_LIST_KEY, json.dumps(asdict(row), ensure_ascii=False))
        client.ltrim(_REDIS_LIST_KEY, 0, _REDIS_MAX - 1)
    except Exception as exc:
        logger.warning("Redis contact store failed: %s", exc)


def submit_contact(row: ContactMessage) -> dict[str, Any]:
    """Persist + notify superadmins and requester. Succeeds for the visitor if storage works."""
    try:
        _persist_local(row)
    except Exception as exc:
        logger.warning("Local contact store failed: %s", exc)
    _persist_redis(row)

    recipients = contact_inbox()
    admin_ok = False
    for to_addr in recipients:
        result = safe_send(
            "contact_admin",
            notify_contact_admin,
            name=row.name,
            email=row.email,
            topic_label=row.topic_label,
            message=row.message,
            client_ip=row.client_ip,
            to_addr=to_addr,
        )
        admin_ok = admin_ok or result.ok

    user = safe_send(
        "contact_user",
        notify_contact_user,
        name=row.name,
        email=row.email,
        topic_label=row.topic_label,
    )
    try:
        from services.admin_alerts import alert_contact_message

        alert_contact_message(
            name=row.name,
            email=row.email,
            topic=row.topic_label,
        )
    except Exception as exc:
        logger.warning("Contact telegram alert failed: %s", exc)
    if not admin_ok:
        logger.warning(
            "Contact stored but admin email failed. to=%s name=%s email=%s topic=%s",
            recipients,
            row.name,
            row.email,
            row.topic,
        )
        raise HTTPException(
            status_code=502,
            detail="Could not send your message right now. Please try again in a moment.",
        )
    print(
        f"[contact] {row.name} <{row.email}> topic={row.topic!r} "
        f"emailed=1 admin=1 user={int(user.ok)} to={recipients}",
        flush=True,
    )
    return {
        "ok": True,
        "emailed": True,
        "emailed_admin": True,
        "emailed_user": user.ok,
    }
