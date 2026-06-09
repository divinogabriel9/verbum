"""Daily limit for paid AI image generation (OpenAI / Gemini)."""

from __future__ import annotations

import hashlib
import os
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

from fastapi import HTTPException, Request

from services.api_security import AuthSession

_DATA_DIR = Path(__file__).resolve().parents[1] / "data"
_DB_PATH = _DATA_DIR / "app.sqlite"

DAILY_IMAGE_LIMIT = max(1, int(os.environ.get("IMAGE_GENERATION_DAILY_LIMIT", "1")))


def _utc_date() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


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
        return f"user:{session.user.user_id}"
    if request is not None:
        forwarded = (request.headers.get("x-forwarded-for") or "").split(",")[0].strip()
        client_host = forwarded or (request.client.host if request.client else "")
        if client_host:
            digest = hashlib.sha256(client_host.encode("utf-8")).hexdigest()[:20]
            return f"ip:{digest}"
    return "local:anonymous"


def get_quota_status(subject: str) -> dict[str, Any]:
    today = _utc_date()
    with _connect() as conn:
        row = conn.execute(
            """
            SELECT generation_count, last_generated_at
            FROM image_generation_daily
            WHERE subject_key = ? AND usage_date = ?
            """,
            (subject, today),
        ).fetchone()
    used = int(row["generation_count"]) if row else 0
    remaining = max(0, DAILY_IMAGE_LIMIT - used)
    return {
        "limit": DAILY_IMAGE_LIMIT,
        "used": used,
        "remaining": remaining,
        "resets_on": today,
        "timezone": "UTC",
        "allowed": remaining > 0,
    }


def reserve_daily_image_generation(
    subject: str,
    *,
    source: str,
) -> dict[str, Any]:
    """Reserve one daily slot before calling an image API. Raises 429 when exhausted."""
    today = _utc_date()
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
