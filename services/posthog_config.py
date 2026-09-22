"""PostHog product analytics configuration (client + server).

Client key is safe to expose (same as PostHog project API key). Capture only
runs in the browser after Analytics cookie consent. Server capture is optional
and best-effort — never blocks product flows.
"""

from __future__ import annotations

import os
from functools import lru_cache
from typing import Any


def _clean(value: str | None) -> str:
    return (value or "").strip()


def _truthy(value: str | None, *, default: bool = False) -> bool:
    raw = _clean(value).lower()
    if not raw:
        return default
    return raw in {"1", "true", "yes", "on"}


@lru_cache(maxsize=1)
def posthog_project_api_key() -> str:
    """Public project API key (phc_…). Prefer POSTHOG_PROJECT_API_KEY."""
    return (
        _clean(os.environ.get("POSTHOG_PROJECT_API_KEY"))
        or _clean(os.environ.get("POSTHOG_API_KEY"))
        or _clean(os.environ.get("POSTHOG_KEY"))
    )


@lru_cache(maxsize=1)
def posthog_host() -> str:
    return (
        _clean(os.environ.get("POSTHOG_HOST"))
        or _clean(os.environ.get("POSTHOG_API_HOST"))
        or "https://us.i.posthog.com"
    )


def posthog_enabled() -> bool:
    """Enabled when a project key is set, unless POSTHOG_ENABLED=0."""
    if not posthog_project_api_key():
        return False
    if _clean(os.environ.get("POSTHOG_ENABLED")).lower() in {"0", "false", "no", "off"}:
        return False
    return True


def public_client_config() -> dict[str, Any] | None:
    """Browser-safe config for templates. None when PostHog is off."""
    if not posthog_enabled():
        return None
    key = posthog_project_api_key()
    if not key:
        return None
    return {
        "enabled": True,
        "key": key,
        "host": posthog_host(),
        # Session replay off by default — parish tools should opt in explicitly.
        "session_recording": _truthy(os.environ.get("POSTHOG_SESSION_RECORDING")),
    }
