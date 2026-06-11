"""Supabase Auth routes."""

from __future__ import annotations

from typing import Any, Optional

from fastapi import Depends, HTTPException, Request
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates

from services.api_security import AuthSession, optional_session
from services.auth_config import auth_enabled, public_auth_config, supabase_enabled
from services.membership_config import membership_payload
from services.supabase_client import get_profile
from services.user_church_context import get_church_profile_context


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
                payload["church_profile"] = church
                profile_role = (profile_row or {}).get("role") if profile_row else user.role
                payload["membership"] = membership_payload(
                    church, user=user, profile_role=profile_role
                )
            except Exception as exc:
                payload["supabase_error"] = str(exc)

        return payload

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
            {
                "title": "Sign in · Verbum",
                "subtitle": "Sign in to your Verbum account",
                "mode": "sign-in",
            },
        )

    @app.get("/sign-up", response_class=HTMLResponse)
    def sign_up_page(request: Request) -> Any:
        if not auth_enabled():
            raise HTTPException(
                status_code=503,
                detail="Set SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY (or SUPABASE_ANON_KEY), and SUPABASE_JWT_SECRET to enable sign-up.",
            )
        return templates.TemplateResponse(
            request,
            "auth.html",
            {
                "title": "Sign up · Verbum",
                "subtitle": "Create your Verbum account",
                "mode": "sign-up",
            },
        )
