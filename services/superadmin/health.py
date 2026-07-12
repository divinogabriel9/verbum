"""System health and environment hints for superadmin."""

from __future__ import annotations

import os
import time
from typing import Any, Callable, Optional

from services.app_version import get_version_info
from services.auth_config import auth_enabled, public_auth_config, supabase_enabled
from services.redis_client import get_redis, redis_enabled
from services.superadmin.dashboard import _readings_cache_stats


if False:  # TYPE_CHECKING
    from services.api_security import AuthSession


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

    version = get_version_info()
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
        "version": version.get("version"),
        "app_version": version.get("app_version"),
        "git_commit": version.get("git_commit"),
        "git_commit_short": version.get("git_commit_short"),
        "git_branch": version.get("git_branch"),
        "version_source": version.get("source"),
    }


def _probe_supabase() -> dict[str, Any]:
    if not supabase_enabled():
        return {"ok": False, "skipped": True}
    from services.supabase_client import get_service_client

    client = get_service_client()
    client.table("profiles").select("id").limit(1).execute()
    return {"ok": True}


def _probe_redis() -> dict[str, Any]:
    if not redis_enabled():
        return {"ok": False, "skipped": True}
    client = get_redis()
    if client is None or not client.ping():
        raise RuntimeError("Redis ping failed")
    return {"ok": True}


def _probe_auth_me(session: Any) -> dict[str, Any]:
    if not supabase_enabled():
        return {"ok": True, "skipped": True}
    from services.supabase_client import get_profile

    row = get_profile(session.user.user_id, access_token=session.token)
    if not row:
        raise RuntimeError("Profile not found")
    return {"ok": True}


def _probe_image_quota(session: Any) -> dict[str, Any]:
    from services.image_generation_quota import quota_status_payload

    payload = quota_status_payload(session, None)
    if payload.get("limit") is None and payload.get("remaining") is None:
        raise RuntimeError("Quota payload empty")
    return {"ok": True}


def _run_probe(
    *,
    label: str,
    method: str,
    fn: Callable[[], Any],
    skip_ok: bool = False,
) -> dict[str, Any]:
    started = time.perf_counter()
    ok = False
    status = 0
    note: Optional[str] = None
    skipped = False
    try:
        result = fn()
        if isinstance(result, dict) and result.get("skipped"):
            skipped = True
            ok = skip_ok
            status = 200 if skip_ok else 0
            note = "not configured"
        else:
            ok = True
            status = 200
            if isinstance(result, dict) and result.get("ok") is False:
                ok = False
                status = 503
                note = str(result.get("error") or "unavailable")[:80]
    except Exception as exc:
        ok = False
        status = 500
        note = (str(exc) or type(exc).__name__)[:80]
    elapsed_ms = round((time.perf_counter() - started) * 1000, 1)
    return {
        "label": label,
        "method": method,
        "ok": ok,
        "status": status,
        "ms": elapsed_ms,
        "note": note,
        "skipped": skipped,
    }


def build_api_probes(*, session: Optional[Any] = None) -> dict[str, Any]:
    """On-demand route probes — status and latency only (no response bodies)."""
    from services.feature_flags import list_global_flags
    from services.superadmin.approvals_inbox import build_approvals_inbox
    from services.superadmin.dashboard import build_dashboard_payload
    from services.superadmin.readings_cache import cache_stats

    probes: list[dict[str, Any]] = [
        _run_probe(label="GET /health", method="GET", fn=lambda: {"status": "ok"}),
        _run_probe(
            label="GET /api/auth/config",
            method="GET",
            fn=lambda: public_auth_config() or {},
        ),
        _run_probe(
            label="Supabase DB",
            method="—",
            fn=_probe_supabase,
            skip_ok=True,
        ),
        _run_probe(
            label="Redis",
            method="—",
            fn=_probe_redis,
            skip_ok=True,
        ),
    ]

    if session is not None:
        probes.append(
            _run_probe(
                label="GET /api/auth/me",
                method="GET",
                fn=lambda: _probe_auth_me(session),
                skip_ok=True,
            )
        )
        probes.append(
            _run_probe(
                label="GET /api/image-quota",
                method="GET",
                fn=lambda: _probe_image_quota(session),
            )
        )

    probes.extend(
        [
            _run_probe(
                label="GET /api/admin/approvals/inbox",
                method="GET",
                fn=build_approvals_inbox,
            ),
            _run_probe(
                label="GET /api/admin/dashboard",
                method="GET",
                fn=build_dashboard_payload,
            ),
            _run_probe(
                label="GET /api/admin/feature-flags",
                method="GET",
                fn=list_global_flags,
            ),
            _run_probe(
                label="GET /api/admin/readings-cache/stats",
                method="GET",
                fn=cache_stats,
            ),
        ]
    )

    tested = [p for p in probes if not p.get("skipped")]
    passed = sum(1 for p in tested if p.get("ok"))
    return {
        "ok": passed == len(tested) if tested else True,
        "probes": probes,
        "summary": {
            "total": len(probes),
            "tested": len(tested),
            "passed": passed,
            "failed": len(tested) - passed,
        },
        "ran_at": time.time(),
    }
