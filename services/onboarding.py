"""Signup onboarding: profile completeness + attribution survey."""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Optional

from fastapi import HTTPException

from services.auth_config import supabase_enabled
from services.supabase_client import get_profile, get_service_client, get_user_client

logger = logging.getLogger(__name__)

MINISTRY_ROLES = frozenset(
    {
        "media_officer",
        "choir_leader",
        "secretary",
        "priest",
        "volunteer",
        "other",
    }
)

SURVEY_SOURCES = frozenset(
    {
        "parish_colleague",
        "priest_recommendation",
        "google_search",
        "facebook",
        "instagram",
        "tiktok",
        "other",
    }
)

PREFERRED_LANGUAGES = frozenset({"english", "tagalog", "korean", "other"})
PRIMARY_USES = frozenset(
    {"sunday_mass_slides", "choir_practice", "posters", "all"}
)


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _is_letters_name(value: str) -> bool:
    text = (value or "").strip()
    if not text:
        return False
    return all(ch.isalpha() or ch.isspace() or ch in "'-." for ch in text)


def profile_onboarding_complete(profile: Optional[dict[str, Any]]) -> bool:
    if not profile:
        return False
    if profile.get("onboarding_completed_at"):
        return True
    return False


def get_onboarding_status(
    user_id: str, *, access_token: Optional[str] = None
) -> dict[str, Any]:
    """Return whether the authenticated user still needs signup onboarding."""
    uid = (user_id or "").strip()
    if not uid or not supabase_enabled():
        return {
            "ok": True,
            "needs_onboarding": False,
            "onboarding_completed": True,
            "profile": None,
            "church_profile": None,
        }

    profile = get_profile(uid, access_token=access_token)
    from services.parish_store import get_user_parish_context

    church = get_user_parish_context(uid, access_token=access_token)
    completed = profile_onboarding_complete(profile)
    first_name = ((profile or {}).get("first_name") or "").strip()
    middle_name = ((profile or {}).get("middle_name") or "").strip()
    last_name = ((profile or {}).get("last_name") or "").strip()
    phone = ((profile or {}).get("phone") or "").strip()
    ministry_role = ((profile or {}).get("ministry_role") or "").strip()
    ministry_role_other = ((profile or {}).get("ministry_role_other") or "").strip()
    preferred_language = ((profile or {}).get("preferred_language") or "").strip()
    primary_use = ((profile or {}).get("primary_use") or "").strip()
    community_name = ((church or {}).get("community_name") or "").strip()

    return {
        "ok": True,
        "needs_onboarding": not completed,
        "onboarding_completed": completed,
        "profile": {
            "first_name": first_name,
            "middle_name": middle_name,
            "last_name": last_name,
            "phone": phone,
            "ministry_role": ministry_role,
            "ministry_role_other": ministry_role_other,
            "preferred_language": preferred_language,
            "primary_use": primary_use,
            "email": ((profile or {}).get("email") or "").strip(),
        },
        "church_profile": {
            "community_name": community_name,
            "parish_role": ((church or {}).get("parish_role") or "").strip(),
            "community_name_locked": bool((church or {}).get("community_name_locked_at")),
        },
    }


def _ensure_parish_named(
    user_id: str,
    community_name: str,
    *,
    access_token: str,
) -> dict[str, Any]:
    from services.parish_store import (
        create_parish_manual,
        get_user_parish_context,
        submit_parish_name_for_user,
    )
    from services.supabase_client import submit_parish_name

    name = (community_name or "").strip()
    if len(name) < 2:
        raise HTTPException(status_code=400, detail="Parish / community name is required.")

    ctx = get_user_parish_context(user_id, access_token=access_token)
    if ctx:
        existing = (ctx.get("community_name") or "").strip()
        if existing and existing.lower() == name.lower():
            return ctx
        if ctx.get("community_name_locked_at") and existing and existing.lower() != name.lower():
            # Invite / locked parish — keep locked name, still allow onboarding.
            return ctx
        if (ctx.get("parish_role") or "").strip().lower() == "president" and not ctx.get(
            "community_name_locked_at"
        ):
            try:
                return submit_parish_name_for_user(
                    user_id, name, access_token=access_token
                )
            except HTTPException:
                raise
            except Exception as exc:
                logger.warning("submit_parish_name_for_user failed: %s", exc)
        return ctx

    # No parish membership yet (legacy / broken trigger) — create pending parish.
    try:
        created = create_parish_manual(
            community_name=name,
            membership_status="pending",
            assign_user_id=user_id,
            assign_role="president",
        )
        parish = created.get("parish") or {}
        parish_id = str(parish.get("id") or "")
        if parish_id and not parish.get("community_name_locked_at"):
            now = _now_iso()
            try:
                svc = get_service_client()
                updated = (
                    svc.table("parishes")
                    .update(
                        {
                            "community_name_locked_at": now,
                            "membership_status": "pending",
                            "updated_at": now,
                        }
                    )
                    .eq("id", parish_id)
                    .execute()
                )
                if updated.data:
                    parish = updated.data[0]
                    from services.parish_store import _sync_legacy_church_profile

                    _sync_legacy_church_profile(user_id, parish)
            except Exception as lock_exc:
                logger.warning("Could not lock parish name after onboarding create: %s", lock_exc)
        return {
            "id": parish.get("id"),
            "parish_id": parish.get("id"),
            "parish_role": "president",
            "user_id": user_id,
            "community_name": parish.get("community_name") or name,
            "membership_status": parish.get("membership_status") or "pending",
            "community_name_locked_at": parish.get("community_name_locked_at"),
        }
    except Exception as exc:
        logger.exception("create_parish_manual during onboarding failed")
        try:
            return submit_parish_name(user_id, name, access_token=access_token)
        except Exception as exc2:
            raise HTTPException(
                status_code=500, detail="Could not save parish name."
            ) from exc2


def complete_onboarding(
    user_id: str,
    *,
    access_token: str,
    first_name: str,
    middle_name: str = "",
    last_name: str = "",
    phone: str = "",
    community_name: str,
    ministry_role: str,
    ministry_role_other: str = "",
    preferred_language: str = "",
    primary_use: str = "",
    survey_sources: Optional[list[str]] = None,
    survey_source: str = "",
    survey_source_other: str = "",
) -> dict[str, Any]:
    """Persist signup details + survey and mark onboarding complete."""
    uid = (user_id or "").strip()
    if not uid or not access_token:
        raise HTTPException(status_code=401, detail="Sign in required.")
    if not supabase_enabled():
        raise HTTPException(status_code=503, detail="Supabase is not configured.")

    first = (first_name or "").strip()
    middle = (middle_name or "").strip()
    last = (last_name or "").strip()
    phone_clean = (phone or "").strip()
    church = (community_name or "").strip()
    role = (ministry_role or "").strip().lower()
    role_other = (ministry_role_other or "").strip()
    language = (preferred_language or "").strip().lower()
    use = (primary_use or "").strip().lower()
    source_other = (survey_source_other or "").strip()

    sources: list[str] = []
    for raw in survey_sources or []:
        item = (raw or "").strip().lower()
        if item and item not in sources:
            sources.append(item)
    if not sources:
        legacy = (survey_source or "").strip().lower()
        if legacy:
            for part in legacy.split(","):
                item = part.strip()
                if item and item not in sources:
                    sources.append(item)

    if len(first) < 1:
        raise HTTPException(status_code=400, detail="First name is required.")
    if not _is_letters_name(first):
        raise HTTPException(status_code=400, detail="First name can only include letters.")
    if middle and not _is_letters_name(middle):
        raise HTTPException(status_code=400, detail="Middle name can only include letters.")
    if len(last) < 1:
        raise HTTPException(status_code=400, detail="Last name is required.")
    if not _is_letters_name(last):
        raise HTTPException(status_code=400, detail="Last name can only include letters.")
    digits_only = "".join(ch for ch in phone_clean if ch.isdigit())
    if len(digits_only) < 8:
        raise HTTPException(status_code=400, detail="Please enter a valid phone number.")
    if len(church) < 2:
        raise HTTPException(status_code=400, detail="Church/Community Name is required.")
    if role not in MINISTRY_ROLES:
        raise HTTPException(status_code=400, detail="Please select your parish role.")
    if role == "other" and len(role_other) < 2:
        raise HTTPException(status_code=400, detail="Please describe your role.")
    if role != "other":
        role_other = ""
    if language and language not in PREFERRED_LANGUAGES:
        language = ""
    if use and use not in PRIMARY_USES:
        use = ""
    if not sources:
        raise HTTPException(
            status_code=400, detail="Please tell us how you heard about LiturgyFlow."
        )
    for source in sources:
        if source not in SURVEY_SOURCES:
            raise HTTPException(
                status_code=400, detail="Please tell us how you heard about LiturgyFlow."
            )
    if "other" in sources and len(source_other) < 2:
        raise HTTPException(status_code=400, detail="Please specify how you heard about us.")
    if "other" not in sources:
        source_other = ""
    if phone_clean and not phone_clean.startswith("+"):
        phone_clean = "+" + phone_clean.lstrip("+")
    if phone_clean and len(phone_clean) > 32:
        phone_clean = phone_clean[:32]

    status = get_onboarding_status(uid, access_token=access_token)
    if status.get("onboarding_completed"):
        return {"ok": True, "already_complete": True, **status}

    church_ctx = _ensure_parish_named(uid, church, access_token=access_token)

    client = get_user_client(access_token)
    now = _now_iso()
    profile_patch: dict[str, Any] = {
        "first_name": first[:80],
        "middle_name": middle[:80] if middle else None,
        "last_name": last[:80],
        "phone": phone_clean,
        "ministry_role": role,
        "ministry_role_other": role_other[:60] if role_other else None,
        "onboarding_completed_at": now,
        "updated_at": now,
    }
    if language:
        profile_patch["preferred_language"] = language
    if use:
        profile_patch["primary_use"] = use
    try:
        result = (
            client.table("profiles").update(profile_patch).eq("id", uid).execute()
        )
        rows = result.data or []
        if not rows:
            # RLS / missing row — fall back to service role.
            svc = get_service_client()
            result = svc.table("profiles").update(profile_patch).eq("id", uid).execute()
            rows = result.data or []
        if not rows:
            raise HTTPException(status_code=404, detail="Profile not found.")
        profile_row = rows[0]
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("profile update during onboarding failed")
        raise HTTPException(status_code=500, detail="Could not save profile.") from exc

    survey_payload = {
        "user_id": uid,
        "source": ",".join(sources)[:200],
        "source_other": source_other[:240] if source_other else None,
    }
    try:
        # Service role: authenticated insert-only RLS; upsert needs update on conflict.
        svc = get_service_client()
        survey_res = svc.table("signup_surveys").upsert(
            survey_payload, on_conflict="user_id"
        ).execute()
        survey_row = (survey_res.data or [None])[0]
    except Exception as exc:
        logger.exception("signup survey save failed")
        raise HTTPException(
            status_code=500, detail="Could not save signup survey."
        ) from exc

    try:
        from services.admin_alerts import alert_registration

        display_name = " ".join(p for p in (first, middle, last) if p).strip()
        parish_label = str(
            (church_ctx or {}).get("community_name") or church or ""
        ).strip()
        role_label = role_other if role == "other" and role_other else role
        alert_registration(
            name=display_name,
            email=str((profile_row or {}).get("email") or "").strip(),
            parish=parish_label,
            role=role_label,
        )
    except Exception as exc:
        logger.warning("Registration alert failed: %s", exc)

    return {
        "ok": True,
        "already_complete": False,
        "needs_onboarding": False,
        "onboarding_completed": True,
        "profile": profile_row,
        "church_profile": church_ctx,
        "survey": survey_row,
    }
