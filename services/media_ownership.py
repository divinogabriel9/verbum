"""Track which authenticated user owns generated media under outputs/."""

from __future__ import annotations

import json
import logging
import threading
import time
from pathlib import Path
from typing import Optional

from fastapi import HTTPException

from services.auth_config import auth_enabled
from services.membership_config import is_superadmin_user
from services.redis_client import get_redis

logger = logging.getLogger(__name__)

_PROJECT_ROOT = Path(__file__).resolve().parents[1]
_REGISTRY_PATH = _PROJECT_ROOT / "data" / "media_ownership.json"
_REDIS_PREFIX = "verbum:media_owner:"
_OWNER_TTL_S = 7 * 24 * 3600
# RLock: register_owned_files holds the lock while calling _load_local_registry.
# A plain Lock deadlocked there and left /api/generate hanging after the PPTX
# was already written (Mass Builder UI stuck at ~63%).
_lock = threading.RLock()
_local_registry: dict[str, str] = {}
_local_loaded = False


def _normalize_relative_path(relative_path: str) -> str:
    rel = (relative_path or "").strip().replace("\\", "/").lstrip("/")
    if not rel or ".." in rel.split("/"):
        raise HTTPException(status_code=400, detail="Invalid file path.")
    return rel


def _load_local_registry() -> dict[str, str]:
    global _local_registry, _local_loaded
    if _local_loaded:
        return _local_registry
    with _lock:
        if _local_loaded:
            return _local_registry
        if not _REGISTRY_PATH.is_file():
            _local_registry = {}
        else:
            try:
                raw = json.loads(_REGISTRY_PATH.read_text(encoding="utf-8"))
                _local_registry = {
                    str(k): str(v)
                    for k, v in (raw or {}).items()
                    if k and v
                }
            except (OSError, json.JSONDecodeError):
                _local_registry = {}
        _local_loaded = True
        return _local_registry


def _save_local_registry(data: dict[str, str]) -> None:
    global _local_registry, _local_loaded
    _REGISTRY_PATH.parent.mkdir(parents=True, exist_ok=True)
    _REGISTRY_PATH.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    _local_registry = dict(data)
    _local_loaded = True


def _redis_owner_key(relative_path: str) -> str:
    return f"{_REDIS_PREFIX}{relative_path}"


def register_owned_files(user_id: str, relative_paths: list[str]) -> None:
    uid = (user_id or "").strip()
    if not uid:
        return
    paths = [_normalize_relative_path(p) for p in relative_paths if (p or "").strip()]
    if not paths:
        return

    client = get_redis()
    if client is not None:
        try:
            pipe = client.pipeline()
            for rel in paths:
                pipe.setex(_redis_owner_key(rel), _OWNER_TTL_S, uid)
            pipe.execute()
            return
        except Exception as exc:
            logger.warning("Redis media ownership register failed: %s", exc)

    # Load outside the write section when possible; RLock still guards races.
    _load_local_registry()
    with _lock:
        reg = dict(_local_registry)
        for rel in paths:
            reg[rel] = uid
        _save_local_registry(reg)


def _lookup_owner(relative_path: str) -> Optional[str]:
    rel = _normalize_relative_path(relative_path)
    client = get_redis()
    if client is not None:
        try:
            owner = client.get(_redis_owner_key(rel))
            if owner:
                return str(owner)
        except Exception:
            pass
    return _load_local_registry().get(rel)


def assert_media_access(
    relative_path: str,
    *,
    user_id: Optional[str],
    is_superadmin: bool = False,
) -> None:
    """Raise 403/404 when auth is on and the user does not own this outputs file."""
    if not auth_enabled():
        return
    rel = _normalize_relative_path(relative_path)
    owner = _lookup_owner(rel)
    if not owner:
        raise HTTPException(status_code=404, detail="File not found.")
    if is_superadmin:
        return
    uid = (user_id or "").strip()
    if not uid or uid != owner:
        raise HTTPException(status_code=403, detail="You do not have access to this file.")


def session_may_access_media(relative_path: str, session) -> None:
    from services.api_security import AuthSession

    if not auth_enabled():
        return
    if not session or not isinstance(session, AuthSession):
        raise HTTPException(status_code=401, detail="Sign in required.")
    assert_media_access(
        relative_path,
        user_id=session.user.user_id,
        is_superadmin=is_superadmin_user(session.user),
    )
