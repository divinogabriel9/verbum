"""Congregation display name, logo path, and Mass celebrant list (SQLite-backed)."""

from __future__ import annotations

from pathlib import Path
from typing import Any, Optional

from services import community_store

_PROJECT_ROOT = Path(__file__).resolve().parents[1]
_UPLOADS_DIR = _PROJECT_ROOT / "data" / "uploads"
LOGO_FILENAME = "community_logo.png"
LOGO_RELATIVE = f"data/uploads/{LOGO_FILENAME}"

_default_name = community_store._DEFAULT_COMMUNITY_NAME


def load_community() -> dict[str, Any]:
    return community_store.load_profile()


def update_community(
    *,
    community_name: Optional[str] = None,
    logo_path: Optional[str | Any] = None,
    celebrant_names: Optional[list[str]] = None,
) -> dict[str, Any]:
    kwargs: dict[str, Any] = {}
    if community_name is not None:
        kwargs["community_name"] = community_name
    if logo_path is not None:
        kwargs["logo_path"] = logo_path
    if celebrant_names is not None:
        kwargs["celebrant_names"] = celebrant_names
    return community_store.save_profile(**kwargs)


def get_community_name() -> str:
    name = (load_community().get("community_name") or "").strip()
    return name or _default_name


def get_celebrant_names() -> list[str]:
    return community_store.list_celebrant_names()


def get_logo_path() -> Optional[Path]:
    p = load_community().get("logo_path")
    if p and str(p).strip():
        path = Path(str(p).strip())
        if path.is_absolute():
            return path if path.is_file() else None
        cand = _PROJECT_ROOT / path
        if cand.is_file():
            return cand
    fallback = _PROJECT_ROOT / LOGO_RELATIVE
    return fallback if fallback.is_file() else None


def clear_config_cache() -> None:
    """No-op: kept for callers that refreshed an in-memory JSON cache."""
    return None


def uploads_dir() -> Path:
    return _UPLOADS_DIR


def logo_file_absolute() -> Path:
    return _UPLOADS_DIR / LOGO_FILENAME
