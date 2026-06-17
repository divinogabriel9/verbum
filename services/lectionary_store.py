"""
SQLite persistence for fetched lectionary rows (one row per Mass date).

Set LECTIONARY_IGNORE_CACHE=1 to force live fetch while still updating the cache.
"""

from __future__ import annotations

import json
import os
import sqlite3
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

_PROJECT_ROOT = Path(__file__).resolve().parents[1]
_DATA_DIR = _PROJECT_ROOT / "data"
_DB_PATH = _DATA_DIR / "lectionary.sqlite"

_MEMORY_CACHE: dict[str, tuple[float, dict[str, Any]]] = {}
_MEMORY_TTL_S = 300.0


def _connect() -> sqlite3.Connection:
    _DATA_DIR.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(_DB_PATH)
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS readings (
            mass_date TEXT PRIMARY KEY,
            payload TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
        """
    )
    conn.commit()
    return conn


def ignore_cache() -> bool:
    return os.environ.get("LECTIONARY_IGNORE_CACHE", "").strip() in ("1", "true", "yes")


def get_cached(mass_date: str) -> Optional[dict[str, Any]]:
    """Return deserialized payload if present."""
    now = time.monotonic()
    mem = _MEMORY_CACHE.get(mass_date)
    if mem and now - mem[0] < _MEMORY_TTL_S:
        return mem[1]

    with _connect() as conn:
        row = conn.execute(
            "SELECT payload FROM readings WHERE mass_date = ?",
            (mass_date,),
        ).fetchone()
    if not row:
        return None
    payload = json.loads(row[0])
    _MEMORY_CACHE[mass_date] = (now, payload)
    return payload


def upsert(mass_date: str, payload: dict[str, Any]) -> None:
    _MEMORY_CACHE.pop(mass_date, None)
    now = datetime.now(timezone.utc).isoformat()
    blob = json.dumps(payload, ensure_ascii=False)
    with _connect() as conn:
        conn.execute(
            """
            INSERT INTO readings (mass_date, payload, updated_at)
            VALUES (?, ?, ?)
            ON CONFLICT(mass_date) DO UPDATE SET
                payload = excluded.payload,
                updated_at = excluded.updated_at
            """,
            (mass_date, blob, now),
        )
        conn.commit()


def db_path() -> Path:
    return _DB_PATH
