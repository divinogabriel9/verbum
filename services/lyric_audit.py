"""Audit log for hymn lyric reads (compliance / abuse detection)."""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Optional

from services.auth_config import supabase_enabled

logger = logging.getLogger(__name__)


def _service_client():
    from services.supabase_client import get_service_client

    return get_service_client()


def log_lyric_read(
    *,
    user_id: Optional[str],
    hymn_id: str,
    section: str = "",
    source: str = "catalog_api",
) -> None:
    uid = (user_id or "").strip()
    hid = (hymn_id or "").strip()
    if not uid or not hid:
        return
    if not supabase_enabled():
        logger.debug("lyric_read user=%s hymn=%s section=%s source=%s", uid, hid, section, source)
        return
    try:
        _service_client().table("lyric_read_audit").insert(
            {
                "user_id": uid,
                "hymn_id": hid,
                "section": (section or "").strip() or None,
                "source": (source or "catalog_api").strip() or "catalog_api",
                "read_at": datetime.now(timezone.utc).isoformat(),
            }
        ).execute()
    except Exception as exc:
        logger.warning("lyric_read_audit insert failed: %s", exc)
