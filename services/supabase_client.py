"""Supabase client helpers (service role for admin, user JWT for RLS)."""

from __future__ import annotations

from functools import lru_cache
from typing import Any, Optional

from services.auth_config import (
    supabase_client_key,
    supabase_enabled,
    supabase_service_role_key,
    supabase_url,
)


def _require_supabase() -> None:
    if not supabase_enabled():
        raise RuntimeError("Supabase is not configured.")


@lru_cache(maxsize=1)
def get_service_client():
    """Admin client — bypasses RLS. Server-side only."""
    _require_supabase()
    from supabase import create_client

    key = supabase_service_role_key()
    if not key:
        raise RuntimeError("SUPABASE_SERVICE_ROLE_KEY is required for server-side operations.")
    return create_client(supabase_url(), key)


def get_user_client(access_token: str):
    """User-scoped client — enforces Supabase RLS."""
    _require_supabase()
    from supabase import ClientOptions, create_client

    token = (access_token or "").strip()
    if not token:
        raise ValueError("Access token is required for user-scoped Supabase access.")

    anon = supabase_client_key()
    if not anon:
        raise RuntimeError("SUPABASE_PUBLISHABLE_KEY or SUPABASE_ANON_KEY is not configured.")

    return create_client(
        supabase_url(),
        anon,
        options=ClientOptions(headers={"Authorization": f"Bearer {token}"}),
    )


def _client_for_user(access_token: Optional[str]):
    if access_token:
        return get_user_client(access_token)
    return get_service_client()


def get_profile(user_id: str, *, access_token: Optional[str] = None) -> Optional[dict[str, Any]]:
    uid = (user_id or "").strip()
    if not uid:
        return None
    client = _client_for_user(access_token)
    result = client.table("profiles").select("*").eq("id", uid).limit(1).execute()
    rows = result.data or []
    return rows[0] if rows else None


def get_church_profile(
    user_id: str, *, access_token: Optional[str] = None
) -> Optional[dict[str, Any]]:
    uid = (user_id or "").strip()
    if not uid:
        return None
    client = _client_for_user(access_token)
    result = (
        client.table("church_profiles").select("*").eq("user_id", uid).limit(1).execute()
    )
    rows = result.data or []
    return rows[0] if rows else None


def upsert_church_profile(
    user_id: str,
    *,
    community_name: Optional[str] = None,
    logo_path: Optional[str] = None,
    celebrant_names: Optional[list[str]] = None,
    access_token: Optional[str] = None,
) -> dict[str, Any]:
    uid = (user_id or "").strip()
    if not uid:
        raise ValueError("user_id is required.")

    payload: dict[str, Any] = {"user_id": uid}
    if community_name is not None:
        payload["community_name"] = community_name
    if logo_path is not None:
        payload["logo_path"] = logo_path
    if celebrant_names is not None:
        payload["celebrant_names"] = celebrant_names

    client = _client_for_user(access_token)
    result = client.table("church_profiles").upsert(payload, on_conflict="user_id").execute()
    rows = result.data or []
    if rows:
        return rows[0]
    saved = get_church_profile(uid, access_token=access_token)
    return saved or payload


def record_generation(
    user_id: str,
    *,
    mass_date: str,
    celebrant: Optional[str] = None,
    output_summary: Optional[dict[str, Any]] = None,
    access_token: Optional[str] = None,
) -> None:
    uid = (user_id or "").strip()
    if not uid:
        return
    client = _client_for_user(access_token)
    client.table("generation_history").insert(
        {
            "user_id": uid,
            "mass_date": mass_date,
            "celebrant": celebrant,
            "output_summary": output_summary or {},
        }
    ).execute()
