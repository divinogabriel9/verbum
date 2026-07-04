"""Parish team routes (president manages media teammates)."""

from __future__ import annotations

from typing import Any, Optional

from fastapi import Depends, HTTPException
from pydantic import BaseModel, Field

from services.api_security import AuthSession, require_approved_membership, require_session
from services.auth_config import app_public_url
from services.membership_config import is_superadmin_user
from services.platform_invites import create_invite, list_invites_for_parish
from services.parish_invites import (
    consume_parish_invite,
    validate_parish_invite_token,
)
from services.parish_store import (
    PARISH_MEMBER_LIMIT,
    get_user_parish_context,
    list_active_members,
    list_team_members,
    remove_parish_member,
)
from services.user_church_context import get_church_profile_context


class ParishInviteCreateBody(BaseModel):
    email: Optional[str] = Field(None, max_length=320)
    ttl_days: int = Field(7, ge=1, le=90)


class ParishInviteAcceptBody(BaseModel):
    token: str = Field(..., min_length=8, max_length=128)


async def require_parish_president(
    session: AuthSession = Depends(require_approved_membership),
) -> AuthSession:
    if is_superadmin_user(session.user):
        return session
    ctx = get_church_profile_context() or {}
    if (ctx.get("parish_role") or "").strip().lower() != "president":
        raise HTTPException(status_code=403, detail="Parish president access required.")
    return session


def register_parish_routes(app) -> None:
    @app.get("/api/parish/team")
    def api_parish_team(
        session: AuthSession = Depends(require_parish_president),
    ) -> dict[str, Any]:
        ctx = get_church_profile_context() or {}
        parish_id = str(ctx.get("parish_id") or "")
        if not parish_id:
            raise HTTPException(status_code=404, detail="Parish not found.")
        members = list_team_members(parish_id)
        invites = list_invites_for_parish(parish_id)
        base = app_public_url() or ""
        for row in invites:
            tok = row.get("token") or ""
            row["invite_url"] = (base + "/sign-up?invite=" + tok) if tok else ""
        return {
            "ok": True,
            "parish_id": parish_id,
            "members": members,
            "invites": invites,
            "member_limit": PARISH_MEMBER_LIMIT,
            "members_count": len(members),
        }

    @app.post("/api/parish/team/invites")
    def api_parish_create_invite(
        body: ParishInviteCreateBody,
        session: AuthSession = Depends(require_parish_president),
    ) -> dict[str, Any]:
        ctx = get_church_profile_context() or {}
        parish_id = str(ctx.get("parish_id") or "")
        parish_name = (ctx.get("community_name") or "").strip()
        if not parish_id:
            raise HTTPException(status_code=404, detail="Parish not found.")
        if not parish_name:
            raise HTTPException(
                status_code=400,
                detail="Your parish must have a name before inviting teammates.",
            )
        if len(list_active_members(parish_id)) >= PARISH_MEMBER_LIMIT:
            raise HTTPException(
                status_code=409,
                detail=f"Parish already has {PARISH_MEMBER_LIMIT} members.",
            )
        try:
            row = create_invite(
                created_by_user_id=session.user.user_id,
                email=body.email,
                community_name=parish_name,
                parish_id=parish_id,
                invite_role="media",
                ttl_days=body.ttl_days,
            )
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        except RuntimeError as exc:
            raise HTTPException(status_code=503, detail=str(exc)) from exc
        tok = row.get("token") or ""
        base = app_public_url() or ""
        invite_url = (base + "/sign-up?invite=" + tok) if tok else ""
        return {"ok": True, "invite": row, "invite_url": invite_url}

    @app.post("/api/parish/team/invites/accept")
    def api_parish_accept_invite(
        body: ParishInviteAcceptBody,
        session: AuthSession = Depends(require_session),
    ) -> dict[str, Any]:
        try:
            row = consume_parish_invite(body.token.strip(), accepted_by_user_id=session.user.user_id)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        ctx = get_user_parish_context(session.user.user_id)
        return {"ok": True, "invite": row, "parish": ctx}

    @app.get("/api/parish/team/invites/validate")
    def api_parish_validate_invite(token: str = "") -> dict[str, Any]:
        row = validate_parish_invite_token(token)
        if not row:
            return {"ok": False, "error": "Invalid or expired invite."}
        from services.parish_store import get_parish_by_id

        parish = get_parish_by_id(str(row.get("parish_id") or ""))
        email = (row.get("email") or "").strip()
        return {
            "ok": True,
            "parish_name": (parish or {}).get("community_name") or "",
            "email_locked": bool(email),
            "email": email or None,
        }

    @app.delete("/api/parish/team/members/{user_id}")
    def api_parish_remove_member(
        user_id: str,
        session: AuthSession = Depends(require_parish_president),
    ) -> dict[str, Any]:
        ctx = get_church_profile_context() or {}
        parish_id = str(ctx.get("parish_id") or "")
        from services.parish_store import get_member_for_user

        target = get_member_for_user(user_id)
        if not target or str(target.get("parish_id") or "") != parish_id:
            raise HTTPException(status_code=404, detail="Team member not found on your parish.")
        try:
            remove_parish_member(user_id)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        return {"ok": True}
