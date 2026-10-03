"""Weekly poster-generation allowance (free tier) vs unlimited for paid parishes.

Shared Sunday hero cache may avoid a paid image-API call, but free-tier product
quota is still reserved so the weekly allowance is experienced fairly.
Subscribed (paid) parishes are unlimited.
"""

from __future__ import annotations

import hashlib
import logging
import os
import sqlite3
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Optional

from fastapi import HTTPException, Request

from services.api_security import AuthSession
from services.redis_client import get_redis

logger = logging.getLogger(__name__)

_DATA_DIR = Path(__file__).resolve().parents[1] / "data"
_DB_PATH = _DATA_DIR / "app.sqlite"
_KEY_PREFIX = "verbum:quota:image:"

# Free tier: 4 curated poster uses per ISO week (UTC). Paid = unlimited.
FREE_WEEKLY_IMAGE_LIMIT = max(
    1,
    int(os.environ.get("IMAGE_GENERATION_WEEKLY_LIMIT", "4")),
)
# Backward-compatible aliases for admin / health probes (free-tier cap).
WEEKLY_IMAGE_LIMIT = FREE_WEEKLY_IMAGE_LIMIT
DAILY_IMAGE_LIMIT = FREE_WEEKLY_IMAGE_LIMIT

_FREE_LIMIT_DETAIL = (
    f"You've reached this week's free poster allowance "
    f"({FREE_WEEKLY_IMAGE_LIMIT} per week). "
    "Subscribe for unlimited beautifully curated posters, or try again next week."
)


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _utc_date() -> str:
    """Legacy helper — returns the current ISO week id (kept for callers)."""
    return _utc_week_id()


def _utc_week_id(when: Optional[datetime] = None) -> str:
    d = (when or _utc_now()).date()
    iso = d.isocalendar()
    return f"{iso.year}-W{iso.week:02d}"


def _utc_week_end_timestamp(when: Optional[datetime] = None) -> int:
    """Unix time for the start of the next ISO week (Monday 00:00 UTC)."""
    d = (when or _utc_now()).date()
    iso = d.isocalendar()
    # ISO weekday: Monday=1 … Sunday=7
    days_until_next_monday = 8 - iso.weekday
    next_monday = d + timedelta(days=days_until_next_monday)
    end = datetime(next_monday.year, next_monday.month, next_monday.day, tzinfo=timezone.utc)
    return int(end.timestamp())


def _week_resets_on_label(when: Optional[datetime] = None) -> str:
    """ISO date of the Monday that ends the current week window."""
    ts = _utc_week_end_timestamp(when)
    return datetime.fromtimestamp(ts, tz=timezone.utc).strftime("%Y-%m-%d")


def _quota_key(subject: str, usage_period: str) -> str:
    return f"{_KEY_PREFIX}{subject}:{usage_period}"


def session_has_unlimited_image_quota(session: Optional[AuthSession]) -> bool:
    """Paid subscribers (and superadmins) are not metered. Free tier is."""
    user = getattr(session, "user", None) if session else None
    if user is not None:
        try:
            from services.membership_config import is_superadmin_user

            if is_superadmin_user(user):
                return True
        except Exception:
            pass
    try:
        from services.stripe_billing import billing_enabled, parish_has_paid_access
        from services.user_church_context import get_church_profile_context

        if not billing_enabled():
            # Billing off (local/dev): no product metering.
            return True
        ctx = get_church_profile_context()
        if parish_has_paid_access(ctx):
            return True
    except Exception:
        logger.debug("unlimited image quota check failed", exc_info=True)
    return False


def _quota_status_from_used(
    used: int,
    period: str,
    *,
    unlimited: bool = False,
) -> dict[str, Any]:
    if unlimited:
        return {
            "limit": None,
            "used": used,
            "remaining": None,
            "resets_on": _week_resets_on_label(),
            "period": period,
            "period_label": "week",
            "timezone": "UTC",
            "allowed": True,
            "unlimited": True,
        }
    remaining = max(0, FREE_WEEKLY_IMAGE_LIMIT - used)
    return {
        "limit": FREE_WEEKLY_IMAGE_LIMIT,
        "used": used,
        "remaining": remaining,
        "resets_on": _week_resets_on_label(),
        "period": period,
        "period_label": "week",
        "timezone": "UTC",
        "allowed": remaining > 0,
        "unlimited": False,
    }


def _connect() -> sqlite3.Connection:
    _DATA_DIR.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(_DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS image_generation_daily (
            subject_key TEXT NOT NULL,
            usage_date TEXT NOT NULL,
            generation_count INTEGER NOT NULL DEFAULT 0,
            last_generated_at TEXT,
            last_source TEXT,
            PRIMARY KEY (subject_key, usage_date)
        )
        """
    )
    conn.commit()
    return conn


def resolve_subject(
    session: Optional[AuthSession],
    request: Optional[Request] = None,
) -> str:
    if session and session.user.user_id:
        try:
            from services.user_church_context import get_church_profile_context

            ctx = get_church_profile_context()
            parish_id = (ctx or {}).get("parish_id")
            if parish_id:
                return f"parish:{parish_id}"
        except Exception:
            pass
        return f"user:{session.user.user_id}"
    if request is not None:
        forwarded = (request.headers.get("x-forwarded-for") or "").split(",")[0].strip()
        client_host = forwarded or (request.client.host if request.client else "")
        if client_host:
            digest = hashlib.sha256(client_host.encode("utf-8")).hexdigest()[:20]
            return f"ip:{digest}"
    return "local:anonymous"


def _get_quota_status_sqlite(
    subject: str,
    period: str,
    *,
    unlimited: bool = False,
) -> dict[str, Any]:
    with _connect() as conn:
        row = conn.execute(
            """
            SELECT generation_count
            FROM image_generation_daily
            WHERE subject_key = ? AND usage_date = ?
            """,
            (subject, period),
        ).fetchone()
    used = int(row["generation_count"]) if row else 0
    return _quota_status_from_used(used, period, unlimited=unlimited)


def _get_quota_status_redis(
    subject: str,
    period: str,
    *,
    unlimited: bool = False,
) -> dict[str, Any]:
    client = get_redis()
    if client is None:
        return _get_quota_status_sqlite(subject, period, unlimited=unlimited)
    raw = client.get(_quota_key(subject, period))
    used = int(raw) if raw else 0
    return _quota_status_from_used(used, period, unlimited=unlimited)


def get_quota_status(subject: str, *, unlimited: bool = False) -> dict[str, Any]:
    period = _utc_week_id()
    return _get_quota_status_redis(subject, period, unlimited=unlimited)


def quota_status_payload(
    session: Optional[AuthSession],
    request: Optional[Request] = None,
) -> dict[str, Any]:
    subject = resolve_subject(session, request)
    unlimited = session_has_unlimited_image_quota(session)
    status = get_quota_status(subject, unlimited=unlimited)
    scope = "anonymous"
    parish_id: str | None = None
    if subject.startswith("parish:"):
        scope = "parish"
        parish_id = subject.split(":", 1)[1] or None
    elif subject.startswith("user:"):
        scope = "user"
    elif subject.startswith("ip:"):
        scope = "ip"
    return {
        **status,
        "subject": subject,
        "scope": scope,
        "parish_id": parish_id,
        "shared": scope == "parish",
        "cache_reuse_free": False,
    }


def _reserve_quota_sqlite(
    subject: str,
    *,
    source: str,
    period: str,
    unlimited: bool = False,
) -> dict[str, Any]:
    now = _utc_now().isoformat()

    with _connect() as conn:
        conn.execute("BEGIN IMMEDIATE")
        row = conn.execute(
            """
            SELECT generation_count
            FROM image_generation_daily
            WHERE subject_key = ? AND usage_date = ?
            """,
            (subject, period),
        ).fetchone()
        used = int(row["generation_count"]) if row else 0
        if not unlimited and used >= FREE_WEEKLY_IMAGE_LIMIT:
            conn.execute("ROLLBACK")
            raise HTTPException(status_code=429, detail=_FREE_LIMIT_DETAIL)
        if row:
            conn.execute(
                """
                UPDATE image_generation_daily
                SET generation_count = generation_count + 1,
                    last_generated_at = ?,
                    last_source = ?
                WHERE subject_key = ? AND usage_date = ?
                """,
                (now, source, subject, period),
            )
        else:
            conn.execute(
                """
                INSERT INTO image_generation_daily
                    (subject_key, usage_date, generation_count, last_generated_at, last_source)
                VALUES (?, ?, 1, ?, ?)
                """,
                (subject, period, now, source),
            )
        conn.commit()

    return get_quota_status(subject, unlimited=unlimited)


def _reserve_quota_redis(
    subject: str,
    *,
    source: str,
    period: str,
    unlimited: bool = False,
) -> dict[str, Any]:
    client = get_redis()
    if client is None:
        return _reserve_quota_sqlite(
            subject, source=source, period=period, unlimited=unlimited
        )

    key = _quota_key(subject, period)
    try:
        count = int(client.incr(key))
        if count == 1:
            client.expireat(key, _utc_week_end_timestamp())
        if not unlimited and count > FREE_WEEKLY_IMAGE_LIMIT:
            client.decr(key)
            raise HTTPException(status_code=429, detail=_FREE_LIMIT_DETAIL)
        meta_key = f"{key}:meta"
        client.hset(
            meta_key,
            mapping={
                "last_source": source,
                "last_at": _utc_now().isoformat(),
            },
        )
        client.expireat(meta_key, _utc_week_end_timestamp())
    except HTTPException:
        raise
    except Exception:
        return _reserve_quota_sqlite(
            subject, source=source, period=period, unlimited=unlimited
        )

    return _quota_status_from_used(count, period, unlimited=unlimited)


def reserve_daily_image_generation(
    subject: str,
    *,
    source: str,
    unlimited: bool = False,
) -> dict[str, Any]:
    """Reserve one weekly slot before applying a curated poster. Raises 429 when free tier is exhausted.

    Name kept for callers; period is ISO week UTC. Paid / unlimited subjects are
    still counted for admin stats but never blocked.
    """
    period = _utc_week_id()
    return _reserve_quota_redis(
        subject, source=source, period=period, unlimited=unlimited
    )
