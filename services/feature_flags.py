"""Platform feature flags — global defaults with optional parish overrides."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Optional

from services.auth_config import supabase_enabled
from services.supabase_client import get_service_client


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _service_client():
    return get_service_client()


def list_global_flags() -> list[dict[str, Any]]:
    if not supabase_enabled():
        return []
    result = (
        _service_client()
        .table("platform_feature_flags")
        .select("*")
        .order("key")
        .execute()
    )
    return list(result.data or [])


def resolve_flags(*, parish_id: Optional[str] = None) -> dict[str, bool]:
    flags = list_global_flags()
    resolved: dict[str, bool] = {
        str(row.get("key") or ""): bool(row.get("enabled"))
        for row in flags
        if row.get("key")
    }
    pid = (parish_id or "").strip()
    if pid and supabase_enabled():
        try:
            overrides = (
                _service_client()
                .table("parish_feature_flag_overrides")
                .select("flag_key, enabled")
                .eq("parish_id", pid)
                .execute()
            )
            for row in overrides.data or []:
                key = str(row.get("flag_key") or "")
                if key:
                    resolved[key] = bool(row.get("enabled"))
        except Exception:
            pass
    return resolved


def flags_payload(*, parish_id: Optional[str] = None) -> dict[str, Any]:
    global_rows = list_global_flags()
    pid = (parish_id or "").strip()
    overrides_by_key: dict[str, bool] = {}
    if pid and supabase_enabled():
        try:
            overrides = (
                _service_client()
                .table("parish_feature_flag_overrides")
                .select("flag_key, enabled")
                .eq("parish_id", pid)
                .execute()
            )
            overrides_by_key = {
                str(r["flag_key"]): bool(r["enabled"])
                for r in (overrides.data or [])
                if r.get("flag_key")
            }
        except Exception:
            overrides_by_key = {}

    items: list[dict[str, Any]] = []
    for row in global_rows:
        key = str(row.get("key") or "")
        if not key:
            continue
        global_enabled = bool(row.get("enabled"))
        has_override = key in overrides_by_key
        items.append(
            {
                "key": key,
                "label": row.get("label") or key,
                "description": row.get("description") or "",
                "global_enabled": global_enabled,
                "enabled": overrides_by_key.get(key, global_enabled),
                "has_parish_override": has_override,
                "parish_override": overrides_by_key.get(key) if has_override else None,
            }
        )
    return {
        "ok": True,
        "parish_id": pid or None,
        "flags": {item["key"]: item["enabled"] for item in items},
        "items": items,
    }


def list_admin_flags(*, parish_id: Optional[str] = None) -> dict[str, Any]:
    return flags_payload(parish_id=parish_id)


def set_global_flag(
    key: str,
    *,
    enabled: bool,
    acting_user_id: Optional[str] = None,
) -> dict[str, Any]:
    if not supabase_enabled():
        return {"ok": False, "error": "Supabase not configured."}
    flag_key = (key or "").strip()
    if not flag_key:
        return {"ok": False, "error": "Flag key required."}
    client = _service_client()
    result = (
        client.table("platform_feature_flags")
        .update(
            {
                "enabled": bool(enabled),
                "updated_at": _now_iso(),
                "updated_by": acting_user_id,
            }
        )
        .eq("key", flag_key)
        .execute()
    )
    if not (result.data or []):
        return {"ok": False, "error": "Unknown feature flag."}
    return {"ok": True, "key": flag_key, "enabled": bool(enabled)}


def set_parish_override(
    parish_id: str,
    key: str,
    *,
    enabled: bool,
    acting_user_id: Optional[str] = None,
) -> dict[str, Any]:
    if not supabase_enabled():
        return {"ok": False, "error": "Supabase not configured."}
    pid = (parish_id or "").strip()
    flag_key = (key or "").strip()
    if not pid or not flag_key:
        return {"ok": False, "error": "parish_id and flag key required."}
    client = _service_client()
    existing = (
        client.table("platform_feature_flags").select("key").eq("key", flag_key).limit(1).execute()
    )
    if not existing.data:
        return {"ok": False, "error": "Unknown feature flag."}
    client.table("parish_feature_flag_overrides").upsert(
        {
            "parish_id": pid,
            "flag_key": flag_key,
            "enabled": bool(enabled),
            "updated_at": _now_iso(),
            "updated_by": acting_user_id,
        },
        on_conflict="parish_id,flag_key",
    ).execute()
    return {"ok": True, "parish_id": pid, "key": flag_key, "enabled": bool(enabled)}


def clear_parish_override(
    parish_id: str,
    key: str,
) -> dict[str, Any]:
    if not supabase_enabled():
        return {"ok": False, "error": "Supabase not configured."}
    pid = (parish_id or "").strip()
    flag_key = (key or "").strip()
    if not pid or not flag_key:
        return {"ok": False, "error": "parish_id and flag key required."}
    _service_client().table("parish_feature_flag_overrides").delete().eq(
        "parish_id", pid
    ).eq("flag_key", flag_key).execute()
    return {"ok": True, "parish_id": pid, "key": flag_key, "cleared": True}
