"""Shared Supabase client helpers for distribution."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from services.auth_config import supabase_enabled
from services.supabase_client import get_service_client


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def utc_now_iso() -> str:
    return utc_now().isoformat()


def require_client():
    if not supabase_enabled():
        raise RuntimeError("Supabase is required for the distribution system.")
    return get_service_client()


def parse_iso(value: Any) -> datetime | None:
    if not value:
        return None
    if isinstance(value, datetime):
        dt = value
    else:
        try:
            dt = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        except ValueError:
            return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt
