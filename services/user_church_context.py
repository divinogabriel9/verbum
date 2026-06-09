"""Per-request church profile from Supabase (scoped to the signed-in user)."""

from __future__ import annotations

from contextvars import ContextVar
from typing import Any, Optional

_church_profile: ContextVar[Optional[dict[str, Any]]] = ContextVar(
    "church_profile", default=None
)


def set_church_profile(profile: Optional[dict[str, Any]]) -> None:
    _church_profile.set(profile)


def get_church_profile_context() -> Optional[dict[str, Any]]:
    return _church_profile.get()


def clear_church_profile() -> None:
    _church_profile.set(None)
