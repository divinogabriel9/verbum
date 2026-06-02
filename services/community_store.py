"""
SQLite persistence for parish profile: community name, logo path, Mass celebrants.

Migrates from legacy ``data/community.json`` on first open when the DB is empty.
"""

from __future__ import annotations

import json
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

_PROJECT_ROOT = Path(__file__).resolve().parents[1]
_DATA_DIR = _PROJECT_ROOT / "data"
_DB_PATH = _DATA_DIR / "app.sqlite"
_LEGACY_JSON = _DATA_DIR / "community.json"
_MAX_CELEBRANTS = 32

_SETTING_COMMUNITY_NAME = "community_name"
_SETTING_LOGO_PATH = "logo_path"
_DEFAULT_COMMUNITY_NAME = "GWANGJU FILIPINO CATHOLIC COMMUNITY"


def _connect() -> sqlite3.Connection:
    _DATA_DIR.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(_DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS community_settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        )
        """
    )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS mass_celebrants (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL COLLATE NOCASE,
            sort_order INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL,
            UNIQUE(name)
        )
        """
    )
    conn.commit()
    return conn


def _normalize_names(raw: Any) -> list[str]:
    if not isinstance(raw, list):
        return []
    out: list[str] = []
    seen: set[str] = set()
    for item in raw:
        s = str(item or "").strip()
        if not s:
            continue
        key = s.lower()
        if key in seen:
            continue
        seen.add(key)
        out.append(s[:200])
        if len(out) >= _MAX_CELEBRANTS:
            break
    return out


def _migrate_legacy_json(conn: sqlite3.Connection) -> None:
    has_celebrants = conn.execute("SELECT 1 FROM mass_celebrants LIMIT 1").fetchone()
    has_name = conn.execute(
        "SELECT 1 FROM community_settings WHERE key = ?",
        (_SETTING_COMMUNITY_NAME,),
    ).fetchone()
    if has_celebrants and has_name:
        return
    if not _LEGACY_JSON.is_file():
        return
    try:
        raw = json.loads(_LEGACY_JSON.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return
    if not has_name:
        name = str(raw.get("community_name") or "").strip()
        if name:
            conn.execute(
                "INSERT OR REPLACE INTO community_settings (key, value) VALUES (?, ?)",
                (_SETTING_COMMUNITY_NAME, name),
            )
    logo = raw.get("logo_path")
    if logo is not None and str(logo).strip():
        conn.execute(
            "INSERT OR REPLACE INTO community_settings (key, value) VALUES (?, ?)",
            (_SETTING_LOGO_PATH, str(logo).strip()),
        )
    if not has_celebrants:
        names = _normalize_names(raw.get("celebrant_names"))
        now = datetime.now(timezone.utc).isoformat()
        for i, name in enumerate(names):
            conn.execute(
                """
                INSERT OR IGNORE INTO mass_celebrants (name, sort_order, created_at)
                VALUES (?, ?, ?)
                """,
                (name, i, now),
            )
    conn.commit()


def _with_db() -> sqlite3.Connection:
    conn = _connect()
    _migrate_legacy_json(conn)
    return conn


def get_setting(key: str) -> Optional[str]:
    with _with_db() as conn:
        row = conn.execute(
            "SELECT value FROM community_settings WHERE key = ?",
            (key,),
        ).fetchone()
    if not row:
        return None
    val = str(row["value"] or "").strip()
    return val or None


def set_setting(key: str, value: Optional[str]) -> None:
    with _with_db() as conn:
        if value is None or not str(value).strip():
            conn.execute("DELETE FROM community_settings WHERE key = ?", (key,))
        else:
            conn.execute(
                "INSERT OR REPLACE INTO community_settings (key, value) VALUES (?, ?)",
                (key, str(value).strip()),
            )
        conn.commit()


def list_celebrant_names() -> list[str]:
    with _with_db() as conn:
        rows = conn.execute(
            "SELECT name FROM mass_celebrants ORDER BY sort_order ASC, id ASC"
        ).fetchall()
    return [str(r["name"]) for r in rows]


def replace_celebrant_names(names: list[str]) -> list[str]:
    normalized = _normalize_names(names)
    now = datetime.now(timezone.utc).isoformat()
    with _with_db() as conn:
        conn.execute("DELETE FROM mass_celebrants")
        for i, name in enumerate(normalized):
            conn.execute(
                """
                INSERT INTO mass_celebrants (name, sort_order, created_at)
                VALUES (?, ?, ?)
                """,
                (name, i, now),
            )
        conn.commit()
    return normalized


def load_profile() -> dict[str, Any]:
    with _with_db() as conn:
        name_row = conn.execute(
            "SELECT value FROM community_settings WHERE key = ?",
            (_SETTING_COMMUNITY_NAME,),
        ).fetchone()
        logo_row = conn.execute(
            "SELECT value FROM community_settings WHERE key = ?",
            (_SETTING_LOGO_PATH,),
        ).fetchone()
        celebrant_rows = conn.execute(
            "SELECT name FROM mass_celebrants ORDER BY sort_order ASC, id ASC"
        ).fetchall()
    name = str(name_row["value"]).strip() if name_row else ""
    logo = str(logo_row["value"]).strip() if logo_row and logo_row["value"] else None
    return {
        "community_name": name or _DEFAULT_COMMUNITY_NAME,
        "logo_path": logo,
        "celebrant_names": [str(r["name"]) for r in celebrant_rows],
    }


def save_profile(
    *,
    community_name: Optional[str] = None,
    logo_path: Optional[str] = None,
    celebrant_names: Optional[list[str]] = None,
) -> dict[str, Any]:
    with _with_db() as conn:
        if community_name is not None:
            name = str(community_name).strip() or _DEFAULT_COMMUNITY_NAME
            conn.execute(
                "INSERT OR REPLACE INTO community_settings (key, value) VALUES (?, ?)",
                (_SETTING_COMMUNITY_NAME, name),
            )
        if logo_path is not None:
            if logo_path:
                conn.execute(
                    "INSERT OR REPLACE INTO community_settings (key, value) VALUES (?, ?)",
                    (_SETTING_LOGO_PATH, str(logo_path).strip()),
                )
            else:
                conn.execute(
                    "DELETE FROM community_settings WHERE key = ?",
                    (_SETTING_LOGO_PATH,),
                )
        if celebrant_names is not None:
            normalized = _normalize_names(celebrant_names)
            now = datetime.now(timezone.utc).isoformat()
            conn.execute("DELETE FROM mass_celebrants")
            for i, name in enumerate(normalized):
                conn.execute(
                    """
                    INSERT INTO mass_celebrants (name, sort_order, created_at)
                    VALUES (?, ?, ?)
                    """,
                    (name, i, now),
                )
        conn.commit()
    return load_profile()


def db_path() -> Path:
    return _DB_PATH
