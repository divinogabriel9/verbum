"""Daily limit for paid AI image generation (OpenAI / Gemini)."""

from __future__ import annotations

import hashlib
import os
import sqlite3
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Optional

from fastapi import HTTPException, Request

from services.api_security import AuthSession
from services.redis_client import get_redis

_DATA_DIR = Path(__file__).resolve().parents[1] / "data"
_DB_PATH = _DATA_DIR / "app.sqlite"
_KEY_PREFIX = "verbum:quota:image:"

DAILY_IMAGE_LIMIT = max(1, int(os.environ.get("IMAGE_GENERATION_DAILY_LIMIT", "1")))


def _utc_date() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def _utc_day_end_timestamp() -> int:
    today = datetime.now(timezone.utc).date()
    tomorrow = today + timedelta(days=1)
    end = datetime(tomorrow.year, tomorrow.month, tomorrow.day, tzinfo=timezone.utc)
    return int(end.timestamp())


def _quota_key(subject: str, usage_date: str) -> str:
    return f"{_KEY_PREFIX}{subject}:{usage_date}"


def _quota_status_from_used(used: int, today: str) -> dict[str, Any]:
    remaining = max(0, DAILY_IMAGE_LIMIT - used)
    return {
        "limit": DAILY_IMAGE_LIMIT,
        "used": used,
        "remaining": remaining,
        "resets_on": today,
        "timezone": "UTC",
        "allowed": remaining > 0,
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


def _get_quota_status_sqlite(subject: str, today: str) -> dict[str, Any]:
    with _connect() as conn:
        row = conn.execute(
            """
            SELECT generation_count
            FROM image_generation_daily
            WHERE subject_key = ? AND usage_date = ?
            """,
            (subject, today),
        ).fetchone()
    used = int(row["generation_count"]) if row else 0
    return _quota_status_from_used(used, today)


def _get_quota_status_redis(subject: str, today: str) -> dict[str, Any]:
    client = get_redis()
    if client is None:
        return _get_quota_status_sqlite(subject, today)
    raw = client.get(_quota_key(subject, today))
    used = int(raw) if raw else 0
    return _quota_status_from_used(used, today)


def get_quota_status(subject: str) -> dict[str, Any]:
    today = _utc_date()
    return _get_quota_status_redis(subject, today)


def quota_status_payload(
    session: Optional[AuthSession],
    request: Optional[Request] = None,
) -> dict[str, Any]:
    subject = resolve_subject(session, request)
    status = get_quota_status(subject)
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
    }


def _reserve_quota_sqlite(subject: str, *, source: str, today: str) -> dict[str, Any]:
    now = datetime.now(timezone.utc).isoformat()

    with _connect() as conn:
        conn.execute("BEGIN IMMEDIATE")
        row = conn.execute(
            """
            SELECT generation_count
            FROM image_generation_daily
            WHERE subject_key = ? AND usage_date = ?
            """,
            (subject, today),
        ).fetchone()
        used = int(row["generation_count"]) if row else 0
        if used >= DAILY_IMAGE_LIMIT:
            conn.execute("ROLLBACK")
            raise HTTPException(
                status_code=429,
                detail=(
                    f"Daily AI image limit reached ({DAILY_IMAGE_LIMIT} per day, UTC). "
                    "Try again tomorrow or disable AI poster to use the liturgical template."
                ),
            )
        if row:
            conn.execute(
                """
                UPDATE image_generation_daily
                SET generation_count = generation_count + 1,
                    last_generated_at = ?,
                    last_source = ?
                WHERE subject_key = ? AND usage_date = ?
                """,
                (now, source, subject, today),
            )
        else:
            conn.execute(
                """
                INSERT INTO image_generation_daily
                    (subject_key, usage_date, generation_count, last_generated_at, last_source)
                VALUES (?, ?, 1, ?, ?)
                """,
                (subject, today, now, source),
            )
        conn.commit()

    return get_quota_status(subject)


def _reserve_quota_redis(subject: str, *, source: str, today: str) -> dict[str, Any]:
    client = get_redis()
    if client is None:
        return _reserve_quota_sqlite(subject, source=source, today=today)

    key = _quota_key(subject, today)
    try:
        count = int(client.incr(key))
        if count == 1:
            client.expireat(key, _utc_day_end_timestamp())
        if count > DAILY_IMAGE_LIMIT:
            client.decr(key)
            raise HTTPException(
                status_code=429,
                detail=(
                    f"Daily AI image limit reached ({DAILY_IMAGE_LIMIT} per day, UTC). "
                    "Try again tomorrow or disable AI poster to use the liturgical template."
                ),
            )
        # Optional metadata for debugging (short TTL, non-critical).
        meta_key = f"{key}:meta"
        client.hset(meta_key, mapping={"last_source": source, "last_at": datetime.now(timezone.utc).isoformat()})
        client.expireat(meta_key, _utc_day_end_timestamp())
    except HTTPException:
        raise
    except Exception:
        return _reserve_quota_sqlite(subject, source=source, today=today)

    return _quota_status_from_used(count, today)


def reserve_daily_image_generation(
    subject: str,
    *,
    source: str,
) -> dict[str, Any]:
    """Reserve one daily slot before calling an image API. Raises 429 when exhausted."""
    today = _utc_date()
    return _reserve_quota_redis(subject, source=source, today=today)
