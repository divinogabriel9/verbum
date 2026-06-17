"""Superadmin approvals: parish membership, songs, and priests."""

from __future__ import annotations

from typing import Any

from fastapi import Depends, HTTPException

from services.api_security import AuthSession, require_superadmin
from services.pending_submissions import (
    approve_priest_submission,
    approve_song_submission,
    list_pending_priests,
    list_pending_songs,
    reject_priest_submission,
    reject_song_submission,
)
from services.supabase_client import list_pending_memberships, set_membership_status


def register_admin_routes(app) -> None:
    @app.get("/api/admin/memberships/pending")
    def api_pending_memberships(
        _session: AuthSession = Depends(require_superadmin),
    ) -> dict[str, Any]:
        return {"ok": True, "pending": list_pending_memberships()}

    @app.post("/api/admin/memberships/{user_id}/approve")
    def api_approve_membership(
        user_id: str,
        _session: AuthSession = Depends(require_superadmin),
    ) -> dict[str, Any]:
        row = set_membership_status(user_id, "approved")
        return {"ok": True, "church_profile": row}

    @app.post("/api/admin/memberships/{user_id}/reject")
    def api_reject_membership(
        user_id: str,
        _session: AuthSession = Depends(require_superadmin),
    ) -> dict[str, Any]:
        row = set_membership_status(user_id, "rejected")
        return {"ok": True, "church_profile": row}

    @app.get("/api/admin/submissions/songs/pending")
    def api_pending_song_submissions(
        _session: AuthSession = Depends(require_superadmin),
    ) -> dict[str, Any]:
        return {"ok": True, "pending": list_pending_songs()}

    @app.post("/api/admin/submissions/songs/{submission_id}/approve")
    def api_approve_song_submission(
        submission_id: str,
        _session: AuthSession = Depends(require_superadmin),
    ) -> dict[str, Any]:
        result = approve_song_submission(submission_id)
        if not result.get("ok"):
            raise HTTPException(status_code=400, detail=result.get("error") or "Approve failed.")
        return result

    @app.post("/api/admin/submissions/songs/{submission_id}/reject")
    def api_reject_song_submission(
        submission_id: str,
        _session: AuthSession = Depends(require_superadmin),
    ) -> dict[str, Any]:
        result = reject_song_submission(submission_id)
        if not result.get("ok"):
            raise HTTPException(status_code=400, detail=result.get("error") or "Reject failed.")
        return result

    @app.get("/api/admin/submissions/priests/pending")
    def api_pending_priest_submissions(
        _session: AuthSession = Depends(require_superadmin),
    ) -> dict[str, Any]:
        return {"ok": True, "pending": list_pending_priests()}

    @app.post("/api/admin/submissions/priests/{submission_id}/approve")
    def api_approve_priest_submission(
        submission_id: str,
        _session: AuthSession = Depends(require_superadmin),
    ) -> dict[str, Any]:
        result = approve_priest_submission(submission_id)
        if not result.get("ok"):
            raise HTTPException(status_code=400, detail=result.get("error") or "Approve failed.")
        return result

    @app.post("/api/admin/submissions/priests/{submission_id}/reject")
    def api_reject_priest_submission(
        submission_id: str,
        _session: AuthSession = Depends(require_superadmin),
    ) -> dict[str, Any]:
        result = reject_priest_submission(submission_id)
        if not result.get("ok"):
            raise HTTPException(status_code=400, detail=result.get("error") or "Reject failed.")
        return result
