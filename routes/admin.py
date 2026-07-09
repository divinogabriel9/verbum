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
from services.superadmin.audit_log import list_audit_log
from services.superadmin.generations import list_generations
from services.superadmin.health import build_health_payload
from services.superadmin.parishes import get_parish_detail, list_parishes
from services.superadmin.users import delete_user, list_users, set_user_parish_role
from services.superadmin.readings_admin import (
    fetch_admin_calendar_month,
    fetch_readings_admin_date,
    get_readings_admin_detail,
    patch_readings_admin_entry,
    scan_month_readings,
)
from services.superadmin.readings_cache import cache_stats, clear_cache
from services.superadmin.image_quota import list_parish_image_quota, list_parish_image_quota_paginated
from services.auth_config import app_public_url
from services.platform_invites import create_invite, list_invites
from services.platform_announcements import get_admin_announcement, save_announcement
from services.superadmin.merge_parishes import merge_parishes
from services.superadmin.storage_browser import list_storage_browser
from services.superadmin.analytics import build_analytics_payload
from services.superadmin.approvals_inbox import build_approvals_inbox
from services.feature_flags import (
    clear_parish_override,
    list_admin_flags,
    set_global_flag,
    set_parish_override,
)
from services.admin_audit import log_admin_action


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
    community_name: Optional[str] = Field(None, max_length=120)
    parish_id: Optional[str] = Field(None, max_length=64)
    invite_role: Literal["president", "media"] = "president"
    ttl_days: int = Field(7, ge=1, le=90)


class AdminParishRoleBody(BaseModel):
    role: str = Field(..., min_length=4, max_length=16)
    parish_id: Optional[str] = Field(None, max_length=64)


class PlatformAnnouncementBody(BaseModel):
    message: str = Field("", max_length=2000)
    severity: str = Field("info", max_length=16)
    link_url: Optional[str] = Field(None, max_length=500)
    link_label: Optional[str] = Field(None, max_length=120)
    active: bool = False
    starts_at: Optional[str] = Field(None, max_length=40)
    ends_at: Optional[str] = Field(None, max_length=40)


class MergeParishesBody(BaseModel):
    source_id: str = Field(..., min_length=8, max_length=64)
    target_id: str = Field(..., min_length=8, max_length=64)


class FeatureFlagBody(BaseModel):
    enabled: bool


class ParishFeatureFlagBody(BaseModel):
    enabled: bool


def register_admin_routes(app) -> None:
    @app.get("/api/admin/dashboard")
    def api_admin_dashboard(
        _session: AuthSession = Depends(require_superadmin),
    ) -> dict[str, Any]:
        return build_dashboard_payload()

    @app.get("/api/admin/image-quota")
    def api_admin_image_quota(
        q: str = Query(""),
        page: int = Query(0, ge=0),
        per_page: int = Query(25, ge=1, le=100),
        limit: int = Query(0, ge=0, le=200),
        _session: AuthSession = Depends(require_superadmin),
    ) -> dict[str, Any]:
        if page >= 1:
            return list_parish_image_quota_paginated(q=q, page=page, per_page=per_page)
        cap = limit if limit >= 1 else 100
        return list_parish_image_quota(q=q, limit=cap)

    @app.get("/api/admin/platform/announcement")
    def api_admin_get_announcement(
        _session: AuthSession = Depends(require_superadmin),
    ) -> dict[str, Any]:
        return get_admin_announcement()

    @app.put("/api/admin/platform/announcement")
    def api_admin_save_announcement(
        body: PlatformAnnouncementBody,
        session: AuthSession = Depends(require_superadmin),
    ) -> dict[str, Any]:
        result = save_announcement(
            message=body.message,
            severity=body.severity,
            link_url=body.link_url,
            link_label=body.link_label,
            active=body.active,
            starts_at=body.starts_at,
            ends_at=body.ends_at,
            acting_user_id=session.user.user_id,
        )
        if not result.get("ok"):
            raise HTTPException(status_code=400, detail=result.get("error") or "Save failed.")
        ann = result.get("announcement") or {}
        log_admin_action(
            actor_user_id=session.user.user_id,
            action="update",
            entity_type="platform_announcement",
            entity_id=str(ann.get("id") or "announcement"),
            detail={"active": ann.get("active"), "severity": ann.get("severity")},
        )
        return result

    @app.get("/api/admin/analytics")
    def api_admin_analytics(
        days: int = Query(14, ge=7, le=90),
        _session: AuthSession = Depends(require_superadmin),
    ) -> dict[str, Any]:
        return build_analytics_payload(days=days)

    @app.get("/api/admin/feature-flags")
    def api_admin_feature_flags(
        parish_id: str = Query(""),
        _session: AuthSession = Depends(require_superadmin),
    ) -> dict[str, Any]:
        return list_admin_flags(parish_id=parish_id or None)

    @app.put("/api/admin/feature-flags/{flag_key}")
    def api_admin_set_feature_flag(
        flag_key: str,
        body: FeatureFlagBody,
        session: AuthSession = Depends(require_superadmin),
    ) -> dict[str, Any]:
        result = set_global_flag(
            flag_key, enabled=body.enabled, acting_user_id=session.user.user_id
        )
        if not result.get("ok"):
            raise HTTPException(status_code=400, detail=result.get("error") or "Update failed.")
        log_admin_action(
            actor_user_id=session.user.user_id,
            action="update",
            entity_type="feature_flag",
            entity_id=flag_key,
            detail={"enabled": body.enabled, "scope": "global"},
        )
        return result

    @app.put("/api/admin/feature-flags/{flag_key}/parishes/{parish_id}")
    def api_admin_set_parish_feature_flag(
        flag_key: str,
        parish_id: str,
        body: ParishFeatureFlagBody,
        session: AuthSession = Depends(require_superadmin),
    ) -> dict[str, Any]:
        result = set_parish_override(
            parish_id,
            flag_key,
            enabled=body.enabled,
            acting_user_id=session.user.user_id,
        )
        if not result.get("ok"):
            raise HTTPException(status_code=400, detail=result.get("error") or "Update failed.")
        log_admin_action(
            actor_user_id=session.user.user_id,
            action="update",
            entity_type="feature_flag",
            entity_id=flag_key,
            detail={"enabled": body.enabled, "scope": "parish", "parish_id": parish_id},
        )
        return result

    @app.delete("/api/admin/feature-flags/{flag_key}/parishes/{parish_id}")
    def api_admin_clear_parish_feature_flag(
        flag_key: str,
        parish_id: str,
        session: AuthSession = Depends(require_superadmin),
    ) -> dict[str, Any]:
        result = clear_parish_override(parish_id, flag_key)
        if not result.get("ok"):
            raise HTTPException(status_code=400, detail=result.get("error") or "Clear failed.")
        log_admin_action(
            actor_user_id=session.user.user_id,
            action="clear_override",
            entity_type="feature_flag",
            entity_id=flag_key,
            detail={"parish_id": parish_id},
        )
        return result

    @app.get("/api/admin/storage")
    def api_admin_storage_browser(
        prefix: str = Query(""),
        page: int = Query(1, ge=1),
        per_page: int = Query(50, ge=1, le=100),
        _session: AuthSession = Depends(require_superadmin),
    ) -> dict[str, Any]:
        return list_storage_browser(prefix=prefix, page=page, per_page=per_page)

    @app.post("/api/admin/parishes/merge")
    def api_admin_merge_parishes(
        body: MergeParishesBody,
        session: AuthSession = Depends(require_superadmin),
    ) -> dict[str, Any]:
        result = merge_parishes(
            body.source_id,
            body.target_id,
            acting_user_id=session.user.user_id,
        )
        if not result.get("ok"):
            raise HTTPException(status_code=400, detail=result.get("error") or "Merge failed.")
        return result

    @app.get("/api/admin/parishes")
    def api_admin_parishes(
        page: int = Query(1, ge=1),
        per_page: int = Query(25, ge=1, le=100),
        q: str = Query(""),
        _session: AuthSession = Depends(require_superadmin),
    ) -> dict[str, Any]:
        return list_parishes(page=page, per_page=per_page, q=q)

    @app.get("/api/admin/parishes/options")
    def api_admin_parish_options(
        approved_only: bool = Query(False),
        q: str = Query(""),
        _session: AuthSession = Depends(require_superadmin),
    ) -> dict[str, Any]:
        from services.superadmin.parishes import list_parish_options

        return {
            "ok": True,
            "items": list_parish_options(approved_only=approved_only, q=q),
        }

    @app.get("/api/admin/parishes/{parish_id}")
    def api_admin_parish_detail(
        parish_id: str,
        _session: AuthSession = Depends(require_superadmin),
    ) -> dict[str, Any]:
        result = get_parish_detail(parish_id)
        if not result.get("ok"):
            raise HTTPException(status_code=404, detail=result.get("error") or "Not found.")
        return result

    @app.get("/api/admin/audit-log")
    def api_admin_audit_log(
        page: int = Query(1, ge=1),
        per_page: int = Query(25, ge=1, le=100),
        q: str = Query(""),
        action: str = Query(""),
        entity_type: str = Query(""),
        _session: AuthSession = Depends(require_superadmin),
    ) -> dict[str, Any]:
        return list_audit_log(
            page=page,
            per_page=per_page,
            q=q,
            action=action,
            entity_type=entity_type,
        )

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
        session: AuthSession = Depends(require_superadmin),
    ) -> dict[str, Any]:
        try:
            return set_user_parish_role(
                user_id,
                body.role,
                parish_id=body.parish_id,
                acting_user_id=session.user.user_id,
            )
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

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

    @app.post("/api/admin/practice-shares/purge-expired")
    def api_admin_purge_expired_practice_shares(
        _session: AuthSession = Depends(require_superadmin),
    ) -> dict[str, Any]:
        from services.auth_config import supabase_enabled
        from services.supabase_client import get_service_client

        if not supabase_enabled():
            return {"ok": True, "deleted": 0, "message": "Supabase not configured."}
        try:
            result = get_service_client().rpc("purge_expired_practice_shares").execute()
            deleted = int((result.data if result.data is not None else 0) or 0)
        except Exception as exc:
            raise HTTPException(status_code=500, detail=str(exc)) from exc
        return {"ok": True, "deleted": deleted}

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
        parish_id = (body.parish_id or "").strip() or None
        community_name = (body.community_name or "").strip()
        if not parish_id and not community_name:
            raise HTTPException(
                status_code=400,
                detail="Provide parish_id for an existing parish or community_name for a new parish.",
            )
        try:
            row = create_invite(
                created_by_user_id=session.user.user_id,
                email=body.email,
                note=body.note,
                community_name=community_name or None,
                parish_id=parish_id,
                invite_role=body.invite_role,
                ttl_days=body.ttl_days,
            )
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        except RuntimeError as exc:
            raise HTTPException(status_code=503, detail=str(exc)) from exc
        tok = row.get("token") or ""
        base = app_public_url() or ""
        invite_url = (base + "/sign-up?invite=" + tok) if tok else ""
        log_admin_action(
            actor_user_id=session.user.user_id,
            action="create",
            entity_type="platform_invite",
            entity_id=str(row.get("id") or tok),
            detail={
                "email": row.get("email"),
                "community_name": row.get("community_name"),
                "parish_id": row.get("parish_id"),
                "invite_role": row.get("invite_role"),
            },
        )
        return {"ok": True, "invite": row, "invite_url": invite_url}

    @app.get("/api/admin/approvals/inbox")
    def api_admin_approvals_inbox(
        _session: AuthSession = Depends(require_superadmin),
    ) -> dict[str, Any]:
        return build_approvals_inbox()

    @app.get("/api/admin/memberships/pending")
    def api_pending_memberships(
        _session: AuthSession = Depends(require_superadmin),
    ) -> dict[str, Any]:
        return {"ok": True, "pending": list_pending_memberships()}

    @app.post("/api/admin/memberships/{user_id}/approve")
    def api_approve_membership(
        user_id: str,
        session: AuthSession = Depends(require_superadmin),
    ) -> dict[str, Any]:
        row = set_membership_status(user_id, "approved")
        log_admin_action(
            actor_user_id=session.user.user_id,
            action="approve",
            entity_type="parish_membership",
            entity_id=user_id,
            detail={"community_name": row.get("community_name"), "status": "approved"},
        )
        return {"ok": True, "church_profile": row}

    @app.post("/api/admin/memberships/{user_id}/reject")
    def api_reject_membership(
        user_id: str,
        session: AuthSession = Depends(require_superadmin),
    ) -> dict[str, Any]:
        row = set_membership_status(user_id, "rejected")
        log_admin_action(
            actor_user_id=session.user.user_id,
            action="reject",
            entity_type="parish_membership",
            entity_id=user_id,
            detail={"community_name": row.get("community_name"), "status": "rejected"},
        )
        return {"ok": True, "church_profile": row}

    @app.get("/api/admin/submissions/songs/pending")
    def api_pending_song_submissions(
        _session: AuthSession = Depends(require_superadmin),
    ) -> dict[str, Any]:
        return {"ok": True, "pending": list_pending_songs()}

    @app.post("/api/admin/submissions/songs/{submission_id}/approve")
    def api_approve_song_submission(
        submission_id: str,
        session: AuthSession = Depends(require_superadmin),
    ) -> dict[str, Any]:
        result = approve_song_submission(
            submission_id, acting_user_id=session.user.user_id
        )
        if not result.get("ok"):
            raise HTTPException(status_code=400, detail=result.get("error") or "Approve failed.")
        return result

    @app.post("/api/admin/submissions/songs/{submission_id}/reject")
    def api_reject_song_submission(
        submission_id: str,
        session: AuthSession = Depends(require_superadmin),
    ) -> dict[str, Any]:
        result = reject_song_submission(
            submission_id, acting_user_id=session.user.user_id
        )
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
        session: AuthSession = Depends(require_superadmin),
    ) -> dict[str, Any]:
        result = approve_priest_submission(
            submission_id, acting_user_id=session.user.user_id
        )
        if not result.get("ok"):
            raise HTTPException(status_code=400, detail=result.get("error") or "Approve failed.")
        return result

    @app.post("/api/admin/submissions/priests/{submission_id}/reject")
    def api_reject_priest_submission(
        submission_id: str,
        session: AuthSession = Depends(require_superadmin),
    ) -> dict[str, Any]:
        result = reject_priest_submission(
            submission_id, acting_user_id=session.user.user_id
        )
        if not result.get("ok"):
            raise HTTPException(status_code=400, detail=result.get("error") or "Reject failed.")
        return result
