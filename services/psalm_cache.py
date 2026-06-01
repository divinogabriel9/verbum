"""
Local cache of Psalm texts (World English Bible) for fast, offline Responsorial Psalm lookup.

Populated via scripts/build_psalm_cache.py from bible-api.com.
"""

from __future__ import annotations

import json
import re
from functools import lru_cache
from pathlib import Path
from typing import Optional

_PROJECT_ROOT = Path(__file__).resolve().parents[1]
_CACHE_PATH = _PROJECT_ROOT / "data" / "psalm_cache.json"

_PSALM_NUM_RE = re.compile(r"^(?:Psalm|Psalms)\s+(\d+)\b", re.I)


def psalm_cache_path() -> Path:
    return _CACHE_PATH


def psalm_number_from_reference(reference: str) -> Optional[int]:
    ref = (reference or "").strip()
    if not ref:
        return None
    m = _PSALM_NUM_RE.match(ref)
    if not m:
        return None
    num = int(m.group(1))
    return num if 1 <= num <= 150 else None


@lru_cache(maxsize=1)
def _load_psalm_cache() -> dict[str, str]:
    path = psalm_cache_path()
    if not path.is_file():
        return {}
    try:
        with path.open(encoding="utf-8") as fh:
            blob = json.load(fh)
    except (OSError, json.JSONDecodeError):
        return {}
    psalms = blob.get("psalms") or {}
    if not isinstance(psalms, dict):
        return {}
    return {str(k): str(v) for k, v in psalms.items() if v}


def get_cached_psalm_text(reference: str) -> Optional[str]:
    """Return full Psalm text from local cache when reference is Psalm N."""
    num = psalm_number_from_reference(reference)
    if num is None:
        return None
    text = _load_psalm_cache().get(str(num), "").strip()
    return text or None


def psalm_cache_stats() -> dict[str, int | bool]:
    psalms = _load_psalm_cache()
    return {
        "available": psalm_cache_path().is_file(),
        "count": len(psalms),
    }
