"""Runtime environment helpers (production vs local dev)."""

from __future__ import annotations

import os


def _clean(value: str | None) -> str:
    return (value or "").strip()


def _flag_enabled(name: str) -> bool:
    value = _clean(os.environ.get(name)).lower()
    return value in {"1", "true", "yes", "on"}


def is_production_runtime() -> bool:
    """True when deployed (Render) or explicitly marked production."""
    explicit = _clean(os.environ.get("REQUIRE_AUTH")).lower()
    if explicit in {"1", "true", "yes", "on"}:
        return True
    if explicit in {"0", "false", "no", "off"}:
        return False
    return bool(
        _clean(os.environ.get("RENDER"))
        or _clean(os.environ.get("RENDER_EXTERNAL_URL"))
        or _flag_enabled("PRODUCTION")
        or _flag_enabled("IS_PRODUCTION")
        or _clean(os.environ.get("APP_ENV")).lower() == "production"
        or _clean(os.environ.get("ENVIRONMENT")).lower() == "production"
    )


def mirror_catalog_to_local_disk() -> bool:
    """When false, Supabase catalog is not written back to data/hymn_library.json."""
    if _flag_enabled("HYMN_CATALOG_MIRROR_LOCAL"):
        return True
    if _flag_enabled("HYMN_CATALOG_SKIP_LOCAL_MIRROR"):
        return False
    return not is_production_runtime()


def song_web_fetch_enabled() -> bool:
    """Licensed hymnary scraping — off by default in production."""
    raw = _clean(os.environ.get("SONG_WEB_FETCH")).lower()
    if raw in {"0", "false", "off", "no"}:
        return False
    if raw in {"1", "true", "on", "yes"}:
        return True
    return not is_production_runtime()


def practice_unlock_secret_required() -> bool:
    return is_production_runtime()
