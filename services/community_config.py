"""Congregation display name and optional logo path (Phase 3 — church logo system)."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Optional

_PROJECT_ROOT = Path(__file__).resolve().parents[1]
_CONFIG_PATH = _PROJECT_ROOT / "data" / "community.json"
_UPLOADS_DIR = _PROJECT_ROOT / "data" / "uploads"
LOGO_FILENAME = "community_logo.png"
# Path stored in community.json (relative to project root)
LOGO_RELATIVE = f"data/uploads/{LOGO_FILENAME}"

_default: dict[str, Any] = {
    "community_name": "GWANGJU FILIPINO CATHOLIC COMMUNITY",
    "logo_path": None,
}
_cache: Optional[dict[str, Any]] = None


def load_community() -> dict[str, Any]:
    global _cache
    if _cache is not None:
        return _cache
    if not _CONFIG_PATH.is_file():
        _cache = dict(_default)
        return _cache
    try:
        raw = json.loads(_CONFIG_PATH.read_text(encoding="utf-8"))
        merged = {**_default, **{k: v for k, v in raw.items() if k in ("community_name", "logo_path")}}
        _cache = merged
        return _cache
    except (json.JSONDecodeError, OSError):
        _cache = dict(_default)
        return _cache


def update_community(*, community_name: Optional[str] = None, logo_path: Optional[str | Any] = None) -> dict[str, Any]:
    """Write `data/community.json`. Pass ``logo_path`` as a string path or ``None`` to clear."""
    global _cache
    base = dict(_default)
    if _CONFIG_PATH.is_file():
        try:
            raw = json.loads(_CONFIG_PATH.read_text(encoding="utf-8"))
            base.update({k: v for k, v in raw.items() if k in ("community_name", "logo_path")})
        except (json.JSONDecodeError, OSError):
            pass
    if community_name is not None:
        base["community_name"] = str(community_name).strip() or _default["community_name"]
    if logo_path is not None:
        base["logo_path"] = logo_path
    _CONFIG_PATH.parent.mkdir(parents=True, exist_ok=True)
    _CONFIG_PATH.write_text(json.dumps(base, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    _cache = None
    return load_community()


def get_community_name() -> str:
    name = (load_community().get("community_name") or "").strip()
    return name or str(_default["community_name"])


def get_logo_path() -> Optional[Path]:
    p = load_community().get("logo_path")
    if p and str(p).strip():
        path = Path(str(p).strip())
        if path.is_absolute():
            return path if path.is_file() else None
        cand = _PROJECT_ROOT / path
        if cand.is_file():
            return cand
    # Uploaded default location even if community.json was reset
    fallback = _PROJECT_ROOT / LOGO_RELATIVE
    return fallback if fallback.is_file() else None


def clear_config_cache() -> None:
    global _cache
    _cache = None


def uploads_dir() -> Path:
    return _UPLOADS_DIR


def logo_file_absolute() -> Path:
    return _UPLOADS_DIR / LOGO_FILENAME
