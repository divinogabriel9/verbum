"""
Local cache of non-Psalm responsorial canticles (World English Bible).

Populated via scripts/build_canticle_cache.py.
"""

from __future__ import annotations

import json
import re
from functools import lru_cache
from pathlib import Path
from typing import Optional

_PROJECT_ROOT = Path(__file__).resolve().parents[1]
_CACHE_PATH = _PROJECT_ROOT / "data" / "canticle_cache.json"


def canticle_cache_path() -> Path:
    return _CACHE_PATH


def normalize_canticle_cache_key(reference: str) -> str:
    ref = (reference or "").strip()
    ref = (
        ref.replace("\u2013", "-")
        .replace("\u2014", "-")
        .replace("–", "-")
        .replace("—", "-")
    )
    ref = re.sub(r"\s+", " ", ref)
    ref = re.sub(r"^Psalms\b", "Psalm", ref, flags=re.I)
    return ref.lower()


@lru_cache(maxsize=1)
def _load_canticle_cache() -> dict[str, str]:
    path = canticle_cache_path()
    if not path.is_file():
        return {}
    try:
        with path.open(encoding="utf-8") as fh:
            blob = json.load(fh)
    except (OSError, json.JSONDecodeError):
        return {}
    canticles = blob.get("canticles") or {}
    if not isinstance(canticles, dict):
        return {}
    return {normalize_canticle_cache_key(k): str(v) for k, v in canticles.items() if v}


def get_cached_canticle_text(reference: str) -> Optional[str]:
    key = normalize_canticle_cache_key(reference)
    if not key:
        return None
    text = _load_canticle_cache().get(key, "").strip()
    return text or None


def canticle_cache_stats() -> dict[str, int | bool]:
    items = _load_canticle_cache()
    return {
        "available": canticle_cache_path().is_file(),
        "count": len(items),
    }
