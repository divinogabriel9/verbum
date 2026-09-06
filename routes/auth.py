"""Supabase Auth routes."""

from __future__ import annotations

from typing import Any, Optional

from fastapi import Depends, HTTPException, Request
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel, Field

from services.api_security import AuthSession, _store_auth_context, optional_session, require_session
from services.auth_config import (
    app_public_url,
    auth_enabled,
    invite_contact_email,
    invite_only_signup,
    public_auth_config,
    supabase_enabled,
)
from services.membership_config import membership_payload
from services.platform_invites import consume_invite, validate_invite_token
from services.supabase_auth import AuthUser
from services.supabase_client import get_church_profile, get_profile
from services.user_church_context import get_church_profile_context, set_church_profile


class InviteConsumeBody(BaseModel):
    token: str = Field(..., min_length=8, max_length=128)


class PresenceHeartbeatBody(BaseModel):
    timezone: Optional[str] = Field(None, max_length=64)
    preferred_language: Optional[str] = Field(None, max_length=40)
    region: Optional[str] = Field(None, max_length=80)


class OnboardingCompleteBody(BaseModel):
    first_name: str = Field(..., min_length=1, max_length=80)
    middle_name: str = Field("", max_length=80)
    last_name: str = Field(..., min_length=1, max_length=80)
    phone: str = Field(..., min_length=8, max_length=32)
    community_name: str = Field(..., min_length=2, max_length=120)
    ministry_role: str = Field(..., min_length=2, max_length=40)
    ministry_role_other: str = Field("", max_length=60)
    preferred_language: str = Field("", max_length=40)
    primary_use: str = Field("", max_length=40)
    survey_sources: list[str] = Field(default_factory=list)
    survey_source: str = Field("", max_length=200)
    survey_source_other: str = Field("", max_length=240)


def _auth_page_context(
    *,
    mode: str,
    title: str,
    subtitle: str,
    invite_token: str = "",
    invite_valid: bool = False,
    invite_email: Optional[str] = None,
    invite_community_name: Optional[str] = None,
) -> dict[str, Any]:
    from services.app_version import get_version_info

    contact = invite_contact_email()
    version = get_version_info()
    return {
        "title": title,
        "subtitle": subtitle,
        "mode": mode,
        "invite_only": invite_only_signup(),
        "invite_valid": invite_valid,
        "invite_token": invite_token,
        "invite_email": invite_email or "",
        "invite_community_name": invite_community_name or "",
        "invite_contact_email": contact,
        "app_version": str(version.get("version") or "dev"),
        "git_commit": str(version.get("git_commit") or ""),
        "git_commit_short": str(version.get("git_commit_short") or ""),
        "git_branch": str(version.get("git_branch") or ""),
        "built_at": str(version.get("built_at") or ""),
        "built_at_display": str(version.get("built_at_display") or ""),
    }


def register_auth_routes(app, templates: Jinja2Templates) -> None:
    @app.get("/api/auth/config")
    def api_auth_config() -> dict[str, Any]:
        return public_auth_config()

    @app.get("/api/auth/me")
    def api_auth_me(
        session: Optional[AuthSession] = Depends(optional_session),
    ) -> dict[str, Any]:
        if not auth_enabled():
            return {"authenticated": False, "auth_enabled": False}
        if not session:
            return {"authenticated": False, "auth_enabled": True}

        user = session.user
        payload: dict[str, Any] = {
            "authenticated": True,
            "auth_enabled": True,
            "user_id": user.user_id,
            "email": user.email,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "image_url": user.image_url,
            "role": user.role,
        }

        if supabase_enabled():
            try:
                profile_row = get_profile(user.user_id, access_token=session.token)
                payload["profile"] = profile_row
                church = get_church_profile_context()
                if church is None:
                    church = get_church_profile(user.user_id, access_token=session.token)
                    if church is not None:
                        set_church_profile(church)
                payload["church_profile"] = church
                profile_role = (profile_row or {}).get("role") if profile_row else user.role
                if profile_role and str(profile_role).strip().lower() == "superadmin":
                    enriched = AuthUser(
                        user_id=user.user_id,
                        email=user.email,
                        first_name=user.first_name,
                        last_name=user.last_name,
                        image_url=user.image_url,
                        role="superadmin",
                    )
                    _store_auth_context(
                        session.token,
                        AuthSession(user=enriched, token=session.token),
                        church,
                    )
                elif church is not None:
                    _store_auth_context(session.token, session, church)
                payload["membership"] = membership_payload(
                    church, user=user, profile_role=profile_role
                )

                # Prefer stored avatar path (signed) over OAuth metadata image.
                avatar_raw = str((profile_row or {}).get("avatar_url") or "").strip()
                avatar_url: Optional[str] = None
                if avatar_raw.startswith("http://") or avatar_raw.startswith("https://"):
                    avatar_url = avatar_raw
                elif avatar_raw and not avatar_raw.startswith("/"):
                    try:
                        from services.storage_assets import signed_asset_url

                        avatar_url = signed_asset_url(
                            access_token=session.token, path=avatar_raw
                        )
                    except Exception:
                        avatar_url = None
                if not avatar_url:
                    avatar_url = user.image_url
                payload["avatar_url"] = avatar_url
                payload["image_url"] = avatar_url or user.image_url
                from services.onboarding import profile_onboarding_complete

                payload["onboarding_completed"] = profile_onboarding_complete(
                    profile_row
                )
                payload["needs_onboarding"] = not payload["onboarding_completed"]
            except Exception as exc:
                payload["supabase_error"] = str(exc)

        return payload

    @app.get("/api/auth/onboarding")
    def api_auth_onboarding_status(
        session: AuthSession = Depends(require_session),
    ) -> dict[str, Any]:
        from services.onboarding import get_onboarding_status

        return get_onboarding_status(
            session.user.user_id, access_token=session.token
        )

    @app.post("/api/auth/onboarding/complete")
    def api_auth_onboarding_complete(
        body: OnboardingCompleteBody,
        session: AuthSession = Depends(require_session),
    ) -> dict[str, Any]:
        from services.onboarding import complete_onboarding
        from services.user_church_context import set_church_profile

        result = complete_onboarding(
            session.user.user_id,
            access_token=session.token,
            first_name=body.first_name,
            middle_name=body.middle_name,
            last_name=body.last_name,
            phone=body.phone,
            community_name=body.community_name,
            ministry_role=body.ministry_role,
            ministry_role_other=body.ministry_role_other,
            preferred_language=body.preferred_language,
            primary_use=body.primary_use,
            survey_sources=body.survey_sources,
            survey_source=body.survey_source,
            survey_source_other=body.survey_source_other,
        )
        church = result.get("church_profile")
        if isinstance(church, dict):
            set_church_profile(church)
        return result

    @app.post("/api/auth/heartbeat")
    def api_auth_heartbeat(
        request: Request,
        body: PresenceHeartbeatBody,
        session: AuthSession = Depends(require_session),
    ) -> dict[str, Any]:
        from services.user_presence import (
            country_from_request_headers,
            record_heartbeat,
            region_from_request_headers,
        )

        country = country_from_request_headers(request.headers)
        region = (body.region or "").strip() or region_from_request_headers(request.headers)
        return record_heartbeat(
            session.user.user_id,
            country=country,
            region=region,
            timezone_name=body.timezone,
            preferred_language=body.preferred_language,
        )

    @app.get("/api/auth/invite/validate")
    def api_validate_invite(token: str = "") -> dict[str, Any]:
        if not invite_only_signup():
            return {"ok": True, "invite_required": False}
        row = validate_invite_token(token)
        if not row:
            return {"ok": False, "invite_required": True, "error": "Invalid or expired invite."}
        email = (row.get("email") or "").strip()
        community_name = (row.get("community_name") or "").strip()
        invite_role = (row.get("invite_role") or "president").strip().lower()
        parish_id = str(row.get("parish_id") or "").strip()
        return {
            "ok": True,
            "invite_required": True,
            "email_locked": bool(email),
            "email": email or None,
            "community_name": community_name or None,
            "invite_role": invite_role,
            "parish_id": parish_id or None,
            "existing_parish": bool(parish_id),
        }

    @app.post("/api/auth/invite/consume")
    def api_consume_invite(
        body: InviteConsumeBody,
        session: AuthSession = Depends(require_session),
    ) -> dict[str, Any]:
        if not invite_only_signup():
            return {"ok": True, "skipped": True}
        try:
            row = consume_invite(
                body.token.strip(),
                accepted_by_user_id=session.user.user_id,
                access_token=session.token,
            )
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        return {"ok": True, "invite": row}

    @app.get("/sign-in", response_class=HTMLResponse)
    def sign_in_page(request: Request) -> Any:
        if not auth_enabled():
            raise HTTPException(
                status_code=503,
                detail="Set SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY (or SUPABASE_ANON_KEY), and SUPABASE_JWT_SECRET to enable sign-in.",
            )
        return templates.TemplateResponse(
            request,
            "auth.html",
            _auth_page_context(
                mode="sign-in",
                title="Sign in · LiturgyFlow",
                subtitle="Sign in to your LiturgyFlow account",
            ),
        )

    @app.get("/sign-up", response_class=HTMLResponse)
    def sign_up_page(request: Request) -> Any:
        if not auth_enabled():
            raise HTTPException(
                status_code=503,
                detail="Set SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY (or SUPABASE_ANON_KEY), and SUPABASE_JWT_SECRET to enable sign-up.",
            )
        token = (request.query_params.get("invite") or "").strip()
        invite_valid = False
        invite_email: Optional[str] = None
        invite_community_name: Optional[str] = None
        if invite_only_signup():
            if token:
                row = validate_invite_token(token)
                if row:
                    invite_valid = True
                    invite_email = (row.get("email") or "").strip() or None
                    invite_community_name = (row.get("community_name") or "").strip() or None
        else:
            invite_valid = True

        return templates.TemplateResponse(
            request,
            "auth.html",
            _auth_page_context(
                mode="sign-up",
                title="Create account · LiturgyFlow",
                subtitle="Complete your LiturgyFlow account",
                invite_token=token if invite_valid and token else "",
                invite_valid=invite_valid,
                invite_email=invite_email,
                invite_community_name=invite_community_name,
            ),
        )
