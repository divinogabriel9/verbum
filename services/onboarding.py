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


def require_profile_onboarding_complete(profile: Optional[dict[str, Any]]) -> None:
    """Raise 403 when the mandatory signup form has not been submitted."""
    if profile_onboarding_complete(profile):
        return
    raise HTTPException(
        status_code=403,
        detail="Complete the signup form before using LiturgyFlow.",
    )


def _auth_signup_provider(user_id: str) -> str:
    """Best-effort Auth provider label (google / email / …)."""
    uid = (user_id or "").strip()
    if not uid:
        return ""
    try:
        svc = get_service_client()
        res = svc.auth.admin.get_user_by_id(uid)
        user = getattr(res, "user", None) or res
        app_meta = getattr(user, "app_metadata", None)
        if app_meta is None and isinstance(user, dict):
            app_meta = user.get("app_metadata")
        if not isinstance(app_meta, dict):
            app_meta = {}
        providers = app_meta.get("providers") or []
        if isinstance(providers, list) and providers:
            return ",".join(str(p) for p in providers if p)
        provider = str(app_meta.get("provider") or "").strip()
        return provider
    except Exception:
        logger.debug("Could not resolve auth provider for %s", uid, exc_info=True)
        return ""


def maybe_alert_new_signup(
    user_id: str,
    *,
    email: str = "",
    display_name: str = "",
    profile: Optional[dict[str, Any]] = None,
) -> bool:
    """Alert operators once when a new Auth user first hits the app.

    Claim is atomic via ``signup_alerted_at`` so Google/email signups notify
    even before the mandatory onboarding form is filled.
    """
    uid = (user_id or "").strip()
    if not uid or not supabase_enabled():
        return False
    row = profile if isinstance(profile, dict) else get_profile(uid)
    if not row:
        return False
    if row.get("signup_alerted_at"):
        return False

    now = _now_iso()
    try:
        svc = get_service_client()
        claimed = (
            svc.table("profiles")
            .update({"signup_alerted_at": now, "updated_at": now})
            .eq("id", uid)
            .is_("signup_alerted_at", "null")
            .execute()
        )
        if not (claimed.data or []):
            return False
    except Exception:
        logger.warning("Could not claim signup alert for %s", uid, exc_info=True)
        return False

    provider = _auth_signup_provider(uid)
    name = (display_name or "").strip()
    if not name:
        name = " ".join(
            p
            for p in (
                (row.get("first_name") or "").strip(),
                (row.get("middle_name") or "").strip(),
                (row.get("last_name") or "").strip(),
            )
            if p
        ).strip()
    mail = (email or row.get("email") or "").strip()
    parish = ""
    try:
        from services.parish_store import get_user_parish_context

        ctx = get_user_parish_context(uid)
        parish = str((ctx or {}).get("community_name") or "").strip()
    except Exception:
        parish = ""

    try:
        from services.admin_alerts import alert_new_signup

        alert_new_signup(
            name=name or "(no name yet)",
            email=mail,
            provider=provider or "unknown",
            parish=parish,
        )
    except Exception as exc:
        logger.warning("New signup alert failed for %s: %s", uid, exc)
    return True


def maybe_alert_new_signup_bg(
    user_id: str,
    *,
    email: str = "",
    display_name: str = "",
    profile: Optional[dict[str, Any]] = None,
) -> None:
    import threading

    def _run() -> None:
        maybe_alert_new_signup(
            user_id,
            email=email,
            display_name=display_name,
            profile=profile,
        )

    try:
        threading.Thread(
            target=_run, name=f"signup-alert-{user_id[:8]}", daemon=True
        ).start()
    except Exception:
        maybe_alert_new_signup(
            user_id,
            email=email,
            display_name=display_name,
            profile=profile,
        )


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
    community_name: str = "",
    country_code: str = "",
    ministry_role: str,
    ministry_role_other: str = "",
    preferred_language: str = "",
    primary_use: str = "",
    survey_sources: Optional[list[str]] = None,
    survey_source: str = "",
    survey_source_other: str = "",
    parish_mode: str = "create",
    join_parish_id: str = "",
) -> dict[str, Any]:
    """Persist signup details + survey and mark onboarding complete."""
    from services.billing_catalog import (
        country_code_from_phone,
        normalize_country_code,
    )
    from services.parish_join import create_join_request, create_parish_for_onboarding

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
    mode = (parish_mode or "create").strip().lower()
    join_id = (join_parish_id or "").strip()
    if mode not in {"create", "join"}:
        raise HTTPException(
            status_code=400, detail="Choose Create new parish or Join existing parish."
        )
    country = normalize_country_code(country_code)
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
    if mode == "join":
        if not join_id:
            raise HTTPException(status_code=400, detail="Select a parish to join.")
    elif len(church) < 2:
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
    if not country:
        country = country_code_from_phone(phone_clean)

    status = get_onboarding_status(uid, access_token=access_token)
    if status.get("onboarding_completed"):
        return {"ok": True, "already_complete": True, **status}

    join_payload: dict[str, Any] | None = None
    from services.parish_store import get_user_parish_context

    existing_ctx = get_user_parish_context(uid, access_token=access_token)
    invite_locked = bool(
        existing_ctx
        and existing_ctx.get("community_name_locked_at")
        and (existing_ctx.get("community_name") or "").strip()
    )
    if invite_locked:
        # Platform/parish invite already attached this user — keep that parish.
        church_ctx = existing_ctx
        mode = "invite"
    else:
        church_ctx = existing_ctx or {}

    client = get_user_client(access_token)
    now = _now_iso()
    profile_patch: dict[str, Any] = {
        "first_name": first[:80],
        "middle_name": middle[:80] if middle else None,
        "last_name": last[:80],
        "phone": phone_clean,
        "ministry_role": role,
        "ministry_role_other": role_other[:60] if role_other else None,
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

    display_name = " ".join(p for p in (first, middle, last) if p).strip()
    if not invite_locked:
        if mode == "join":
            join_payload = create_join_request(
                uid,
                join_id,
                display_name=display_name,
                email=str((profile_row or {}).get("email") or ""),
            )
            church_ctx = join_payload.get("church_profile") or {}
            if church and not (church_ctx.get("community_name") or "").strip():
                church_ctx = dict(church_ctx)
                church_ctx["community_name"] = church
        else:
            created = create_parish_for_onboarding(uid, church)
            church_ctx = created.get("church_profile") or {}

    parish_id = str((church_ctx or {}).get("parish_id") or (church_ctx or {}).get("id") or "").strip()
    if parish_id and country and mode == "create":
        try:
            svc = get_service_client()
            updated = (
                svc.table("parishes")
                .update({"country_code": country, "updated_at": _now_iso()})
                .eq("id", parish_id)
                .execute()
            )
            if updated.data:
                church_ctx = dict(church_ctx or {})
                church_ctx["country_code"] = country
        except Exception as country_exc:
            logger.warning("Could not save parish country_code: %s", country_exc)

    try:
        svc = get_service_client()
        done = (
            svc.table("profiles")
            .update({"onboarding_completed_at": now, "updated_at": now})
            .eq("id", uid)
            .execute()
        )
        if done.data:
            profile_row = done.data[0]
    except Exception as exc:
        logger.exception("Could not mark onboarding complete")
        raise HTTPException(
            status_code=500, detail="Could not finish signup."
        ) from exc

    # Join path already emits alert_parish_join_request; create path needs SA approval alert.
    if mode == "create":
        try:
            from services.admin_alerts import alert_registration

            parish_label = str(
                (church_ctx or {}).get("community_name") or church or ""
            ).strip()
            role_label = role_other if role == "other" and role_other else role
            alert_registration(
                name=display_name,
                email=str((profile_row or {}).get("email") or "").strip(),
                parish=parish_label,
                role=f"{role_label} · creating parish (president)",
            )
        except Exception as exc:
            logger.warning("Registration alert failed: %s", exc)

    return {
        "ok": True,
        "already_complete": False,
        "needs_onboarding": False,
        "onboarding_completed": True,
        "parish_mode": mode,
        "profile": profile_row,
        "church_profile": church_ctx,
        "join_request": (join_payload or {}).get("join_request") if join_payload else None,
        "survey": survey_row,
    }
