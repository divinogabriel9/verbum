"""Readings cache admin helpers."""

from __future__ import annotations

from typing import Any

from services.superadmin.dashboard import _readings_cache_stats
from services.usccb_readings import _load_cache_file, _save_cache_file, readings_cache_path


def cache_stats() -> dict[str, Any]:
    return {"ok": True, **_readings_cache_stats()}


def clear_cache(*, date: str | None = None) -> dict[str, Any]:
    if date:
        iso = date.strip()
        if not iso:
            raise ValueError("date is required when provided")
        data = _load_cache_file()
        if iso in data:
            del data[iso]
            _save_cache_file(data)
        return {"ok": True, "cleared": iso, "remaining": len(data)}

    path = readings_cache_path()
    if path.is_file():
        path.unlink()
    return {"ok": True, "cleared": "all", "remaining": 0}
