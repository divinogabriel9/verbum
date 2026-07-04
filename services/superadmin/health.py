"""System health and environment hints for superadmin."""

from __future__ import annotations

import os
from typing import Any

from services.auth_config import auth_enabled, supabase_enabled
from services.redis_client import get_redis, redis_enabled
from services.superadmin.dashboard import _readings_cache_stats


def _env_configured(key: str) -> bool:
    return bool((os.environ.get(key) or "").strip())


def build_health_payload() -> dict[str, Any]:
    supabase_ok = False
    if supabase_enabled():
        try:
            from services.supabase_client import get_service_client

            client = get_service_client()
            client.table("profiles").select("id").limit(1).execute()
            supabase_ok = True
        except Exception:
            supabase_ok = False

    redis_ok = False
    if redis_enabled():
        try:
            client = get_redis()
            redis_ok = client is not None and bool(client.ping())
        except Exception:
            redis_ok = False

    return {
        "ok": True,
        "checks": {
            "supabase": {"configured": supabase_enabled(), "ok": supabase_ok},
            "redis": {"configured": redis_enabled(), "ok": redis_ok},
            "auth": {"enabled": auth_enabled()},
        },
        "env": {
            "SUPABASE_URL": _env_configured("SUPABASE_URL"),
            "SUPABASE_PUBLISHABLE_KEY": _env_configured("SUPABASE_PUBLISHABLE_KEY")
            or _env_configured("SUPABASE_ANON_KEY"),
            "SUPABASE_JWT_SECRET": _env_configured("SUPABASE_JWT_SECRET"),
            "SUPABASE_SERVICE_ROLE_KEY": _env_configured("SUPABASE_SERVICE_ROLE_KEY"),
            "REDIS_URL": _env_configured("REDIS_URL"),
            "OPENAI_API_KEY": _env_configured("OPENAI_API_KEY"),
            "GEMINI_API_KEY": _env_configured("GEMINI_API_KEY"),
            "SUPERADMIN_EMAILS": _env_configured("SUPERADMIN_EMAILS"),
            "IMAGE_GENERATION_DAILY_LIMIT": (os.environ.get("IMAGE_GENERATION_DAILY_LIMIT") or "1").strip(),
        },
        "readings_cache": _readings_cache_stats(),
        "app_version": (os.environ.get("APP_VERSION") or "").strip() or None,
    }
