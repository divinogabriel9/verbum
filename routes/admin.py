"""Superadmin routes: approvals, dashboard, operations, and system tools."""

from __future__ import annotations

from typing import Any, Literal, Optional

from fastapi import Depends, HTTPException, Query
from pydantic import BaseModel, Field

from services.api_security import AuthSession, require_superadmin
from services.pending_submissions import (
    approve_priest_submission,
    approve_song_submission,
    list_pending_priests,
    list_pending_songs,
    reject_priest_submission,
    reject_song_submission,
)
from services.supabase_client import bootstrap_superadmin_roles_from_env, list_pending_memberships, set_membership_status
from services.superadmin.dashboard import build_dashboard_payload
from services.superadmin.generations import list_generations
from services.superadmin.health import build_health_payload
from services.superadmin.parishes import list_parishes
from services.superadmin.users import delete_user, list_users, set_user_parish_role
from services.superadmin.readings_admin import (
    fetch_admin_calendar_month,
    fetch_readings_admin_date,
    get_readings_admin_detail,
    patch_readings_admin_entry,
    scan_month_readings,
)
from services.superadmin.readings_cache import cache_stats, clear_cache
from services.auth_config import app_public_url
from services.platform_invites import create_invite, list_invites


class ReadingsCacheClearBody(BaseModel):
    date: Optional[str] = Field(None, max_length=10)


class ReadingsAdminPatchBody(BaseModel):
    first_reading: Optional[str] = None
    first_reading_ref: Optional[str] = None
    second_reading: Optional[str] = None
    second_reading_ref: Optional[str] = None
    psalm_text: Optional[str] = None
    psalm_response: Optional[str] = None
    psalm_verses: Optional[str] = None
    psalm_ref: Optional[str] = None
    gospel: Optional[str] = None
    gospel_ref: Optional[str] = None
    gospel_acclamation: Optional[str] = None
    mass_celebration: Optional[str] = None


class ReadingsScanMonthBody(BaseModel):
    year: int = Field(..., ge=2000, le=2100)
    month: int = Field(..., ge=1, le=12)
    scope: Literal["missing", "all"] = "missing"


class ReadingsFetchDateBody(BaseModel):
    date: str = Field(..., min_length=10, max_length=10)


class CreateInviteBody(BaseModel):
    email: Optional[str] = Field(None, max_length=320)
    note: Optional[str] = Field(None, max_length=240)
    community_name: str = Field(..., min_length=1, max_length=120)
    ttl_days: int = Field(7, ge=1, le=90)


class AdminParishRoleBody(BaseModel):
    role: str = Field(..., min_length=4, max_length=16)
    parish_id: Optional[str] = Field(None, max_length=64)


def register_admin_routes(app) -> None:
    @app.get("/api/admin/dashboard")
    def api_admin_dashboard(
        _session: AuthSession = Depends(require_superadmin),
    ) -> dict[str, Any]:
        return build_dashboard_payload()

    @app.get("/api/admin/parishes")
    def api_admin_parishes(
        page: int = Query(1, ge=1),
        per_page: int = Query(25, ge=1, le=100),
        q: str = Query(""),
        _session: AuthSession = Depends(require_superadmin),
    ) -> dict[str, Any]:
        return list_parishes(page=page, per_page=per_page, q=q)

    @app.get("/api/admin/users")
    def api_admin_users(
        page: int = Query(1, ge=1),
        per_page: int = Query(25, ge=1, le=100),
        q: str = Query(""),
        session: AuthSession = Depends(require_superadmin),
    ) -> dict[str, Any]:
        return list_users(
            page=page,
            per_page=per_page,
            q=q,
            viewer_user_id=session.user.user_id,
        )

    @app.delete("/api/admin/users/{user_id}")
    def api_admin_delete_user(
        user_id: str,
        session: AuthSession = Depends(require_superadmin),
    ) -> dict[str, Any]:
        try:
            return delete_user(user_id, acting_user_id=session.user.user_id)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        except RuntimeError as exc:
            raise HTTPException(status_code=503, detail=str(exc)) from exc

    @app.patch("/api/admin/users/{user_id}/parish-role")
    def api_admin_set_parish_role(
        user_id: str,
        body: AdminParishRoleBody,
        _session: AuthSession = Depends(require_superadmin),
    ) -> dict[str, Any]:
        try:
            return set_user_parish_role(
                user_id,
                body.role,
                parish_id=body.parish_id,
            )
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @app.get("/api/admin/parishes/options")
    def api_admin_parish_options(
        _session: AuthSession = Depends(require_superadmin),
    ) -> dict[str, Any]:
        from services.superadmin.parishes import list_parish_options

        return {"ok": True, "items": list_parish_options()}

    @app.get("/api/admin/generations")
    def api_admin_generations(
        page: int = Query(1, ge=1),
        per_page: int = Query(25, ge=1, le=100),
        q: str = Query(""),
        _session: AuthSession = Depends(require_superadmin),
    ) -> dict[str, Any]:
        return list_generations(page=page, per_page=per_page, q=q)

    @app.get("/api/admin/health")
    def api_admin_health(
        _session: AuthSession = Depends(require_superadmin),
    ) -> dict[str, Any]:
        return build_health_payload()

    @app.get("/api/admin/readings-cache/stats")
    def api_admin_readings_cache_stats(
        _session: AuthSession = Depends(require_superadmin),
    ) -> dict[str, Any]:
        return cache_stats()

    @app.post("/api/admin/readings-cache/clear")
    def api_admin_readings_cache_clear(
        body: ReadingsCacheClearBody,
        _session: AuthSession = Depends(require_superadmin),
    ) -> dict[str, Any]:
        try:
            return clear_cache(date=body.date)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @app.get("/api/admin/calendar/month")
    def api_admin_calendar_month(
        year: int = Query(..., ge=2000, le=2100),
        month: int = Query(..., ge=1, le=12),
        _session: AuthSession = Depends(require_superadmin),
    ) -> dict[str, Any]:
        try:
            return fetch_admin_calendar_month(year, month)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @app.post("/api/admin/readings-cache/scan-month")
    def api_admin_readings_cache_scan_month(
        body: ReadingsScanMonthBody,
        _session: AuthSession = Depends(require_superadmin),
    ) -> dict[str, Any]:
        try:
            return scan_month_readings(body.year, body.month, scope=body.scope)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @app.post("/api/admin/readings-cache/fetch-date")
    def api_admin_readings_cache_fetch_date(
        body: ReadingsFetchDateBody,
        _session: AuthSession = Depends(require_superadmin),
    ) -> dict[str, Any]:
        try:
            return fetch_readings_admin_date(body.date)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @app.get("/api/admin/readings-cache/{date}")
    def api_admin_readings_cache_date(
        date: str,
        _session: AuthSession = Depends(require_superadmin),
    ) -> dict[str, Any]:
        return get_readings_admin_detail(date)

    @app.patch("/api/admin/readings-cache/{date}")
    def api_admin_readings_cache_patch(
        date: str,
        body: ReadingsAdminPatchBody,
        _session: AuthSession = Depends(require_superadmin),
    ) -> dict[str, Any]:
        updates = {k: v for k, v in body.model_dump().items() if v is not None}
        try:
            return patch_readings_admin_entry(date, updates)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @app.post("/api/admin/bootstrap-superadmins")
    def api_admin_bootstrap_superadmins(
        _session: AuthSession = Depends(require_superadmin),
    ) -> dict[str, Any]:
        count = bootstrap_superadmin_roles_from_env()
        return {"ok": True, "promoted": count}

    @app.get("/api/admin/invites")
    def api_admin_list_invites(
        include_accepted: bool = Query(False),
        _session: AuthSession = Depends(require_superadmin),
    ) -> dict[str, Any]:
        items = list_invites(include_accepted=include_accepted)
        base = app_public_url() or ""
        for row in items:
            tok = row.get("token") or ""
            row["invite_url"] = (base + "/sign-up?invite=" + tok) if base and tok else (
                "/sign-up?invite=" + tok
            )
        return {"ok": True, "invites": items}

    @app.post("/api/admin/invites")
    def api_admin_create_invite(
        body: CreateInviteBody,
        session: AuthSession = Depends(require_superadmin),
    ) -> dict[str, Any]:
        try:
            row = create_invite(
                created_by_user_id=session.user.user_id,
                email=body.email,
                note=body.note,
                community_name=body.community_name.strip(),
                ttl_days=body.ttl_days,
                invite_role="president",
            )
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        except RuntimeError as exc:
            raise HTTPException(status_code=503, detail=str(exc)) from exc
        tok = row.get("token") or ""
        base = app_public_url() or ""
        invite_url = (base + "/sign-up?invite=" + tok) if tok else ""
        return {"ok": True, "invite": row, "invite_url": invite_url}

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
