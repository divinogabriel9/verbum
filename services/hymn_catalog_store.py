"""Shared hymn catalog persistence — Supabase when configured, local JSON fallback."""

from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

from services.auth_config import supabase_enabled
from services.hymn_normalized_store import (
    sync_catalog_to_normalized_tables,
    sync_songs_to_normalized_tables,
)
from services.runtime_config import mirror_catalog_to_local_disk

logger = logging.getLogger(__name__)

_PROJECT_ROOT = Path(__file__).resolve().parents[1]
_LIBRARY_PATH = _PROJECT_ROOT / "data" / "hymn_library.json"
_CATALOG_KEY = "global"
_SECTIONS = ("entrance", "offertory", "communion", "recessional", "meditation")

_catalog_cache: Optional[dict[str, list[dict[str, Any]]]] = None
_catalog_revision: str = ""


def catalog_sections() -> tuple[str, ...]:
    return _SECTIONS


def catalog_library_path() -> Path:
    return _LIBRARY_PATH


def invalidate_catalog_cache() -> None:
    global _catalog_cache, _catalog_revision
    _catalog_cache = None
    _catalog_revision = ""


def catalog_revision() -> str:
    """Opaque revision token for HTTP ETags (Supabase updated_at or file mtime)."""
    if _catalog_revision:
        return _catalog_revision
    if supabase_enabled():
        try:
            rev = _fetch_supabase_revision()
            if rev:
                return rev
        except Exception as exc:
            logger.warning("Could not read hymn catalog revision from Supabase: %s", exc)
    try:
        if _LIBRARY_PATH.is_file():
            return str(int(_LIBRARY_PATH.stat().st_mtime))
    except OSError:
        pass
    return "0"


def _blank_catalog() -> dict[str, list[dict[str, Any]]]:
    return {k: [] for k in _SECTIONS}


def _normalize_catalog(raw: Any) -> dict[str, list[dict[str, Any]]]:
    out = _blank_catalog()
    if not isinstance(raw, dict):
        return out
    for sec in _SECTIONS:
        rows = raw.get(sec) or []
        out[sec] = [x for x in rows if isinstance(x, dict)]
    return out


def _read_file_catalog() -> dict[str, list[dict[str, Any]]]:
    if not _LIBRARY_PATH.is_file():
        return _blank_catalog()
    try:
        raw = json.loads(_LIBRARY_PATH.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return _blank_catalog()
    return _normalize_catalog(raw)


def _write_file_catalog(data: dict[str, list[dict[str, Any]]]) -> None:
    _LIBRARY_PATH.parent.mkdir(parents=True, exist_ok=True)
    _LIBRARY_PATH.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def _service_client():
    from services.supabase_client import get_service_client

    return get_service_client()


def _fetch_supabase_revision() -> str:
    result = (
        _service_client()
        .table("platform_hymn_catalog")
        .select("updated_at")
        .eq("key", _CATALOG_KEY)
        .limit(1)
        .execute()
    )
    rows = result.data or []
    if not rows:
        return ""
    updated_at = rows[0].get("updated_at")
    return str(updated_at or "").strip()


def _load_from_supabase() -> tuple[Optional[dict[str, list[dict[str, Any]]]], str]:
    result = (
        _service_client()
        .table("platform_hymn_catalog")
        .select("catalog, updated_at")
        .eq("key", _CATALOG_KEY)
        .limit(1)
        .execute()
    )
    rows = result.data or []
    if not rows:
        return None, ""
    row = rows[0]
    catalog = _normalize_catalog(row.get("catalog"))
    revision = str(row.get("updated_at") or "").strip()
    return catalog, revision


def _seed_supabase_from_file_if_empty() -> None:
    existing = (
        _service_client()
        .table("platform_hymn_catalog")
        .select("key")
        .eq("key", _CATALOG_KEY)
        .limit(1)
        .execute()
    )
    if existing.data:
        return
    file_catalog = _read_file_catalog()
    has_rows = any(file_catalog.get(sec) for sec in _SECTIONS)
    payload: dict[str, Any] = {
        "key": _CATALOG_KEY,
        "catalog": file_catalog,
    }
    _service_client().table("platform_hymn_catalog").insert(payload).execute()
    if has_rows:
        logger.info("Seeded platform_hymn_catalog from local hymn_library.json.")


def _save_to_supabase(
    data: dict[str, list[dict[str, Any]]],
    *,
    updated_by: str | None = None,
) -> str:
    now = datetime.now(timezone.utc).isoformat()
    payload: dict[str, Any] = {
        "key": _CATALOG_KEY,
        "catalog": data,
        "updated_at": now,
    }
    uid = (updated_by or "").strip()
    if uid:
        payload["updated_by"] = uid
    result = (
        _service_client()
        .table("platform_hymn_catalog")
        .upsert(payload, on_conflict="key")
        .execute()
    )
    rows = result.data or []
    if rows and rows[0].get("updated_at"):
        return str(rows[0]["updated_at"])
    return now


def load_catalog_dict(*, force: bool = False) -> dict[str, list[dict[str, Any]]]:
    """Load the full section-grouped hymn catalog."""
    global _catalog_cache, _catalog_revision

    if not force and _catalog_cache is not None:
        if supabase_enabled():
            try:
                remote_rev = _fetch_supabase_revision()
                if remote_rev and remote_rev == _catalog_revision:
                    return _catalog_cache
            except Exception as exc:
                logger.warning("Could not verify hymn catalog revision: %s", exc)
                return _catalog_cache
        else:
            try:
                mtime = str(int(_LIBRARY_PATH.stat().st_mtime)) if _LIBRARY_PATH.is_file() else "0"
                if mtime == _catalog_revision:
                    return _catalog_cache
            except OSError:
                return _catalog_cache

    if supabase_enabled():
        try:
            _seed_supabase_from_file_if_empty()
            catalog, revision = _load_from_supabase()
            if catalog is not None:
                _catalog_cache = catalog
                _catalog_revision = revision or _fetch_supabase_revision() or ""
                if mirror_catalog_to_local_disk():
                    _write_file_catalog(catalog)
                return catalog
        except Exception as exc:
            logger.warning("Supabase hymn catalog load failed, using local file: %s", exc)

    catalog = _read_file_catalog()
    _catalog_cache = catalog
    try:
        _catalog_revision = (
            str(int(_LIBRARY_PATH.stat().st_mtime)) if _LIBRARY_PATH.is_file() else "0"
        )
    except OSError:
        _catalog_revision = "0"
    return catalog


def save_catalog_dict(
    data: dict[str, list[dict[str, Any]]],
    *,
    updated_by: str | None = None,
    sync_song_ids: set[str] | frozenset[str] | None = None,
) -> None:
    """Persist catalog — Supabase when configured, always mirror to local JSON."""
    global _catalog_cache, _catalog_revision

    normalized = _normalize_catalog(data)
    if supabase_enabled():
        try:
            _seed_supabase_from_file_if_empty()
            _catalog_revision = _save_to_supabase(normalized, updated_by=updated_by)
        except Exception as exc:
            logger.warning("Supabase hymn catalog save failed, writing local file only: %s", exc)
    if mirror_catalog_to_local_disk():
        _write_file_catalog(normalized)
    try:
        if sync_song_ids:
            sync_songs_to_normalized_tables(normalized, sync_song_ids)
        else:
            sync_catalog_to_normalized_tables(normalized)
    except Exception as exc:
        logger.warning("Normalized hymn sync failed: %s", exc)
    _catalog_cache = normalized
    if not _catalog_revision:
        try:
            _catalog_revision = (
                str(int(_LIBRARY_PATH.stat().st_mtime)) if _LIBRARY_PATH.is_file() else "0"
            )
        except OSError:
            _catalog_revision = "0"
