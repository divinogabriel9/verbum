"""Best-effort server-side PostHog capture.

Never raises into callers. No-ops when PostHog is disabled or the SDK is missing.
"""

from __future__ import annotations

import logging
from typing import Any, Optional

logger = logging.getLogger(__name__)

_client = None
_client_failed = False


def _get_client():
    global _client, _client_failed
    if _client_failed:
        return None
    if _client is not None:
        return _client
    try:
        from services.posthog_config import posthog_enabled, posthog_host, posthog_project_api_key
    except Exception:
        _client_failed = True
        return None
    if not posthog_enabled():
        _client_failed = True
        return None
    key = posthog_project_api_key()
    if not key:
        _client_failed = True
        return None
    try:
        import posthog

        posthog.api_key = key
        posthog.host = posthog_host()
        # Don't block request threads on network; flush on shutdown if needed.
        posthog.sync_mode = False
        _client = posthog
        return _client
    except Exception:
        logger.debug("PostHog Python SDK unavailable", exc_info=True)
        _client_failed = True
        return None


def capture(
    event: str,
    *,
    distinct_id: Optional[str] = None,
    properties: Optional[dict[str, Any]] = None,
) -> bool:
    """Capture a server event. Returns True if handed to the SDK."""
    name = (event or "").strip()
    if not name:
        return False
    client = _get_client()
    if client is None:
        return False
    uid = (distinct_id or "").strip() or "server"
    props = dict(properties or {})
    props.setdefault("$lib", "liturgyflow-server")
    try:
        client.capture(uid, name, props)
        return True
    except Exception:
        logger.debug("PostHog capture failed for %s", name, exc_info=True)
        return False


def capture_mass_generated(
    *,
    user_id: str,
    mass_date: str,
    parish_id: Optional[str] = None,
    slide_count: Optional[int] = None,
) -> bool:
    props: dict[str, Any] = {"mass_date": mass_date}
    if parish_id:
        props["parish_id"] = parish_id
    if slide_count is not None:
        props["slide_count"] = slide_count
    return capture(
        "mass_deck_generated",
        distinct_id=user_id,
        properties=props,
    )
