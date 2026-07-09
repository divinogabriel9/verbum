"""Rate limits for hymn lyric detail enumeration."""

from __future__ import annotations

import os
import threading
import time
from typing import Optional, Tuple

from services.rate_limit import check_rate_limit_key

_DEFAULT_MAX = 60
_DEFAULT_WINDOW = 3600


def _int_env(name: str, default: int) -> int:
    try:
        return max(1, int(os.environ.get(name, "").strip() or default))
    except (TypeError, ValueError):
        return default


_MAX_FETCHES = _int_env("CATALOG_LYRIC_FETCH_MAX", _DEFAULT_MAX)
_WINDOW_S = _int_env("CATALOG_LYRIC_FETCH_WINDOW", _DEFAULT_WINDOW)

_seen_lock = threading.Lock()
_seen: dict[str, tuple[float, set[str]]] = {}


def _distinct_ids_key(user_id: str) -> str:
    return f"catalog:lyrics:distinct:{user_id}"


def _prune_seen(now: float) -> None:
    stale = [k for k, (exp, _) in _seen.items() if exp <= now]
    for k in stale:
        _seen.pop(k, None)


def check_catalog_lyric_fetch_allowed(
    user_id: Optional[str],
    hymn_id: str,
) -> Tuple[bool, int]:
    """Limit distinct hymn lyric fetches per user per hour."""
    uid = (user_id or "").strip()
    hid = (hymn_id or "").strip()
    if not uid or not hid:
        return True, 0

    allowed, retry_after = check_rate_limit_key(
        f"catalog:lyric:req:{uid}",
        "catalog_lyrics",
    )
    if not allowed:
        return False, retry_after

    now = time.time()
    with _seen_lock:
        _prune_seen(now)
        exp, ids = _seen.get(uid, (now + _WINDOW_S, set()))
        if now > exp:
            exp, ids = now + _WINDOW_S, set()
        if hid not in ids:
            if len(ids) >= _MAX_FETCHES:
                retry = max(1, int(exp - now))
                return False, retry
            ids.add(hid)
        _seen[uid] = (exp, ids)
    return True, 0
