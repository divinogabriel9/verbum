"""Shared durable AI hero cache (date + style) in Supabase Storage.

First request for a Sunday style pays the image-API call; later requests may reuse
the same artwork silently. Product weekly quota is still charged per generate.
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Optional

from services.ai_styles import resolve_ai_image_style
from services.auth_config import supabase_enabled, supabase_service_role_key

logger = logging.getLogger(__name__)

_SHARED_PREFIX = "shared/ai-heroes"


def shared_hero_relative_path(date: str, style: str) -> str:
    iso = (date or "").strip()
    resolved = resolve_ai_image_style(style)
    return f"{_SHARED_PREFIX}/{iso}_{resolved}_hero.png"


def shared_cache_ready() -> bool:
    return bool(supabase_enabled() and (supabase_service_role_key() or "").strip())


def hero_basename(date: str, style: str) -> str:
    iso = (date or "").strip()
    resolved = resolve_ai_image_style(style)
    return f"{iso}_{resolved}_hero.png"


def try_download_shared_hero(local_path: Path, *, date: str, style: str) -> bool:
    """Download shared hero into ``local_path`` when present. Returns True on hit."""
    if not shared_cache_ready():
        return False
    remote = shared_hero_relative_path(date, style)
    try:
        from services.storage_assets import download_service_asset

        raw = download_service_asset(path=remote)
        if not raw:
            return False
        local_path.parent.mkdir(parents=True, exist_ok=True)
        local_path.write_bytes(raw)
        logger.info("AI hero cache hit (download): %s", remote)
        return True
    except Exception:
        logger.debug("AI hero cache miss or download failed: %s", remote, exc_info=True)
        return False


def try_upload_shared_hero(local_path: Path, *, date: str, style: str) -> bool:
    """Upload a freshly generated hero into the shared Sunday cache."""
    if not shared_cache_ready():
        return False
    path = Path(local_path)
    if not path.is_file():
        return False
    remote = shared_hero_relative_path(date, style)
    try:
        from services.storage_assets import upload_shared_asset

        upload_shared_asset(
            relative_path=remote,
            raw=path.read_bytes(),
            content_type="image/png",
            upsert=True,
        )
        logger.info("AI hero cache stored: %s", remote)
        return True
    except Exception:
        logger.warning("AI hero cache upload failed: %s", remote, exc_info=True)
        return False


def shared_hero_exists(*, date: str, style: str) -> bool:
    """True when the shared object exists (best-effort list/download probe)."""
    if not shared_cache_ready():
        return False
    remote = shared_hero_relative_path(date, style)
    try:
        from services.storage_assets import shared_asset_exists

        return bool(shared_asset_exists(relative_path=remote))
    except Exception:
        logger.debug("AI hero cache exists probe failed: %s", remote, exc_info=True)
        return False


def resolve_cached_hero_path(
    local_path: Path,
    *,
    date: str,
    style: str,
) -> Optional[Path]:
    """Return a local path to the cached hero, downloading from shared storage if needed."""
    if local_path.is_file():
        return local_path
    if try_download_shared_hero(local_path, date=date, style=style):
        return local_path if local_path.is_file() else None
    return None
