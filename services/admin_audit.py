"""Shared superadmin audit log writes."""

from __future__ import annotations

import logging
from typing import Any, Optional

from services.auth_config import supabase_enabled

logger = logging.getLogger(__name__)


def log_admin_action(
    *,
    actor_user_id: str | None,
    action: str,
    entity_type: str,
    entity_id: str,
    detail: dict[str, Any] | None = None,
) -> None:
    if not supabase_enabled():
        return
    try:
        from services.supabase_client import get_service_client

        get_service_client().table("admin_audit_log").insert(
            {
                "actor_user_id": actor_user_id,
                "action": action,
                "entity_type": entity_type,
                "entity_id": entity_id,
                "detail": detail or {},
            }
        ).execute()
    except Exception as exc:
        logger.warning("admin_audit_log insert failed: %s", exc)
