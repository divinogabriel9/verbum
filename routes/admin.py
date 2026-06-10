"""Superadmin parish membership approval."""

from __future__ import annotations

from typing import Any, Optional

from fastapi import Depends, HTTPException

from services.api_security import AuthSession, optional_session
from services.auth_config import auth_enabled
from services.membership_config import is_superadmin_user
from services.supabase_client import list_pending_memberships, set_membership_status


def _require_superadmin(session: Optional[AuthSession]) -> AuthSession:
    if not auth_enabled():
        raise HTTPException(status_code=503, detail="Auth is not configured.")
    if not session:
        raise HTTPException(status_code=401, detail="Sign in required.")
    if not is_superadmin_user(session.user):
        raise HTTPException(status_code=403, detail="Superadmin access required.")
    return session


def register_admin_routes(app) -> None:
    @app.get("/api/admin/memberships/pending")
    def api_pending_memberships(
        session: Optional[AuthSession] = Depends(optional_session),
    ) -> dict[str, Any]:
        _require_superadmin(session)
        return {"ok": True, "pending": list_pending_memberships()}

    @app.post("/api/admin/memberships/{user_id}/approve")
    def api_approve_membership(
        user_id: str,
        session: Optional[AuthSession] = Depends(optional_session),
    ) -> dict[str, Any]:
        _require_superadmin(session)
        row = set_membership_status(user_id, "approved")
        return {"ok": True, "church_profile": row}

    @app.post("/api/admin/memberships/{user_id}/reject")
    def api_reject_membership(
        user_id: str,
        session: Optional[AuthSession] = Depends(optional_session),
    ) -> dict[str, Any]:
        _require_superadmin(session)
        row = set_membership_status(user_id, "rejected")
        return {"ok": True, "church_profile": row}
