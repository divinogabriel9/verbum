"""Distribution CRM admin API + HTML shell routes."""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any, Optional

from fastapi import Body, Depends, HTTPException, Query, Request
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel, Field

from services.api_security import AuthSession, require_superadmin
from services.distribution import analytics as dist_analytics
from services.distribution import campaigns as dist_campaigns
from services.distribution import churches as dist_churches
from services.distribution import interactions as dist_interactions
from services.distribution import invites as dist_invites
from services.distribution import referrals as dist_referrals
from services.distribution.activities import list_activities
from services.email_links import invite_signup_url

logger = logging.getLogger(__name__)

_TEMPLATES = Jinja2Templates(
    directory=str(Path(__file__).resolve().parent.parent / "templates")
)


def _http_err(exc: Exception) -> HTTPException:
    if isinstance(exc, ValueError):
        return HTTPException(status_code=400, detail=str(exc))
    if isinstance(exc, RuntimeError):
        msg = str(exc)
        if "Supabase" in msg:
            return HTTPException(status_code=503, detail=msg)
        return HTTPException(status_code=500, detail=msg)
    logger.exception("Distribution API error")
    return HTTPException(status_code=500, detail="Internal distribution error.")


# ---------------------------------------------------------------------------
# Request bodies
# ---------------------------------------------------------------------------


class ChurchCreateBody(BaseModel):
    parish_name: str = Field(..., min_length=1, max_length=200)
    diocese: Optional[str] = Field(None, max_length=200)
    country: Optional[str] = Field(None, max_length=120)
    state_province: Optional[str] = Field(None, max_length=120)
    city: Optional[str] = Field(None, max_length=120)
    address: Optional[str] = Field(None, max_length=400)
    website: Optional[str] = Field(None, max_length=400)
    contact_person: Optional[str] = Field(None, max_length=200)
    contact_role: Optional[str] = Field(None, max_length=120)
    email: Optional[str] = Field(None, max_length=320)
    phone: Optional[str] = Field(None, max_length=80)
    messaging_platform: Optional[str] = Field(None, max_length=80)
    language: Optional[str] = Field(None, max_length=80)
    mass_language: Optional[str] = Field(None, max_length=80)
    has_english_mass: Optional[bool] = None
    has_filipino_community: Optional[bool] = None
    has_media_ministry: Optional[bool] = None
    current_presentation_method: Optional[str] = Field(None, max_length=200)
    current_software: Optional[str] = Field(None, max_length=200)
    pipeline_status: Optional[str] = Field(None, max_length=40)
    priority: Optional[str] = Field(None, max_length=20)
    assigned_to: Optional[str] = Field(None, max_length=64)
    notes: Optional[str] = Field(None, max_length=4000)
    referral_source: Optional[str] = Field(None, max_length=200)
    demo_status: Optional[str] = Field(None, max_length=80)
    subscription_status: Optional[str] = Field(None, max_length=80)
    parish_id: Optional[str] = Field(None, max_length=64)


class ChurchUpdateBody(BaseModel):
    parish_name: Optional[str] = Field(None, max_length=200)
    diocese: Optional[str] = Field(None, max_length=200)
    country: Optional[str] = Field(None, max_length=120)
    state_province: Optional[str] = Field(None, max_length=120)
    city: Optional[str] = Field(None, max_length=120)
    address: Optional[str] = Field(None, max_length=400)
    website: Optional[str] = Field(None, max_length=400)
    contact_person: Optional[str] = Field(None, max_length=200)
    contact_role: Optional[str] = Field(None, max_length=120)
    email: Optional[str] = Field(None, max_length=320)
    phone: Optional[str] = Field(None, max_length=80)
    messaging_platform: Optional[str] = Field(None, max_length=80)
    language: Optional[str] = Field(None, max_length=80)
    mass_language: Optional[str] = Field(None, max_length=80)
    has_english_mass: Optional[bool] = None
    has_filipino_community: Optional[bool] = None
    has_media_ministry: Optional[bool] = None
    current_presentation_method: Optional[str] = Field(None, max_length=200)
    current_software: Optional[str] = Field(None, max_length=200)
    pipeline_status: Optional[str] = Field(None, max_length=40)
    priority: Optional[str] = Field(None, max_length=20)
    assigned_to: Optional[str] = Field(None, max_length=64)
    notes: Optional[str] = Field(None, max_length=4000)
    referral_source: Optional[str] = Field(None, max_length=200)
    demo_status: Optional[str] = Field(None, max_length=80)
    subscription_status: Optional[str] = Field(None, max_length=80)
    parish_id: Optional[str] = Field(None, max_length=64)
    trial_start_at: Optional[str] = Field(None, max_length=40)
    trial_expires_at: Optional[str] = Field(None, max_length=40)
    next_follow_up_at: Optional[str] = Field(None, max_length=40)
    next_follow_up_note: Optional[str] = Field(None, max_length=1000)


class StatusBody(BaseModel):
    status: str = Field(..., min_length=2, max_length=40)


class InteractionBody(BaseModel):
    interaction_type: str = Field(..., min_length=2, max_length=40)
    summary: str = Field("", max_length=2000)
    result: Optional[str] = Field(None, max_length=1000)
    next_action: Optional[str] = Field(None, max_length=1000)
    interacted_at: Optional[str] = Field(None, max_length=40)


class FollowUpCompleteBody(BaseModel):
    note: Optional[str] = Field(None, max_length=2000)


class FollowUpRescheduleBody(BaseModel):
    at: str = Field(..., min_length=8, max_length=40)
    note: Optional[str] = Field(None, max_length=2000)


class CampaignBody(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=4000)
    country: Optional[str] = Field(None, max_length=120)
    city: Optional[str] = Field(None, max_length=120)
    diocese: Optional[str] = Field(None, max_length=200)
    language: Optional[str] = Field(None, max_length=80)
    target_church_type: Optional[str] = Field(None, max_length=120)
    start_date: Optional[str] = Field(None, max_length=20)
    end_date: Optional[str] = Field(None, max_length=20)
    status: Optional[str] = Field(None, max_length=40)


class CampaignUpdateBody(BaseModel):
    name: Optional[str] = Field(None, max_length=200)
    description: Optional[str] = Field(None, max_length=4000)
    country: Optional[str] = Field(None, max_length=120)
    city: Optional[str] = Field(None, max_length=120)
    diocese: Optional[str] = Field(None, max_length=200)
    language: Optional[str] = Field(None, max_length=80)
    target_church_type: Optional[str] = Field(None, max_length=120)
    start_date: Optional[str] = Field(None, max_length=20)
    end_date: Optional[str] = Field(None, max_length=20)
    status: Optional[str] = Field(None, max_length=40)


class CampaignChurchesBody(BaseModel):
    church_ids: list[str] = Field(..., min_length=1)


class InviteCreateBody(BaseModel):
    ttl_days: int = Field(14, ge=1, le=90)


class ReferralCreateBody(BaseModel):
    referring_church_id: str = Field(..., min_length=8, max_length=64)
    referred_church_id: Optional[str] = Field(None, max_length=64)
    referred: Optional[ChurchCreateBody] = None
    status: Optional[str] = Field("pending", max_length=40)


class ImportRowsBody(BaseModel):
    rows: list[dict[str, Any]] = Field(..., min_length=1)


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


def register_distribution_routes(app) -> None:
    prefix = "/api/admin/distribution"

    @app.get("/admin/distribution", response_class=HTMLResponse)
    @app.get("/admin/distribution/{rest:path}", response_class=HTMLResponse)
    def admin_distribution_page(request: Request, rest: str = "") -> Any:
        return _TEMPLATES.TemplateResponse(
            request,
            "distribution.html",
            {"title": "LiturgyFlow Distribution", "path": rest or ""},
        )

    @app.get("/join/{slug}")
    def join_by_slug(slug: str) -> RedirectResponse:
        try:
            invite = dist_invites.get_pending_invite_by_slug(slug)
        except RuntimeError as exc:
            raise _http_err(exc) from exc
        if not invite:
            raise HTTPException(status_code=404, detail="Invite not found or expired.")
        token = str(invite.get("token") or "")
        return RedirectResponse(url=invite_signup_url(token), status_code=302)

    # ---- dashboard / analytics ----

    @app.get(f"{prefix}/dashboard")
    def api_dist_dashboard(
        _session: AuthSession = Depends(require_superadmin),
    ) -> dict[str, Any]:
        try:
            return dist_analytics.dashboard_metrics()
        except Exception as exc:
            raise _http_err(exc) from exc

    @app.get(f"{prefix}/analytics/funnel")
    def api_dist_funnel(
        _session: AuthSession = Depends(require_superadmin),
    ) -> dict[str, Any]:
        try:
            return dist_analytics.funnel_analytics()
        except Exception as exc:
            raise _http_err(exc) from exc

    @app.get(f"{prefix}/analytics/opportunity")
    def api_dist_opportunity(
        _session: AuthSession = Depends(require_superadmin),
    ) -> dict[str, Any]:
        try:
            return dist_analytics.opportunity_by_geo()
        except Exception as exc:
            raise _http_err(exc) from exc

    @app.get(f"{prefix}/attention")
    def api_dist_attention(
        _session: AuthSession = Depends(require_superadmin),
    ) -> dict[str, Any]:
        try:
            items = dist_analytics.churches_needing_attention()
            return {"ok": True, "items": items, "count": len(items)}
        except Exception as exc:
            raise _http_err(exc) from exc

    # ---- churches ----

    @app.get(f"{prefix}/churches")
    def api_dist_list_churches(
        q: str = Query(""),
        country: str = Query(""),
        city: str = Query(""),
        diocese: str = Query(""),
        language: str = Query(""),
        mass_language: str = Query(""),
        pipeline_status: str = Query(""),
        priority: str = Query(""),
        campaign_id: str = Query(""),
        trial_status: str = Query(""),
        subscription_status: str = Query(""),
        last_contacted_from: str = Query(""),
        last_contacted_to: str = Query(""),
        follow_up_from: str = Query(""),
        follow_up_to: str = Query(""),
        has_account: Optional[bool] = Query(None),
        has_activity: Optional[bool] = Query(None),
        limit: int = Query(200, ge=1, le=500),
        offset: int = Query(0, ge=0),
        _session: AuthSession = Depends(require_superadmin),
    ) -> dict[str, Any]:
        filters: dict[str, Any] = {
            "q": q,
            "country": country,
            "city": city,
            "diocese": diocese,
            "language": language,
            "mass_language": mass_language,
            "pipeline_status": pipeline_status,
            "priority": priority,
            "campaign_id": campaign_id,
            "trial_status": trial_status,
            "subscription_status": subscription_status,
            "last_contacted_from": last_contacted_from,
            "last_contacted_to": last_contacted_to,
            "follow_up_from": follow_up_from,
            "follow_up_to": follow_up_to,
            "has_account": has_account,
            "has_activity": has_activity,
            "limit": limit,
            "offset": offset,
        }
        try:
            rows = dist_churches.list_churches(filters)
            return {"ok": True, "churches": rows, "count": len(rows)}
        except Exception as exc:
            raise _http_err(exc) from exc

    @app.post(f"{prefix}/churches")
    def api_dist_create_church(
        body: ChurchCreateBody,
        session: AuthSession = Depends(require_superadmin),
    ) -> dict[str, Any]:
        try:
            church = dist_churches.create_church(
                body.model_dump(exclude_none=True),
                actor_user_id=session.user.user_id,
            )
            return {"ok": True, "church": church}
        except Exception as exc:
            raise _http_err(exc) from exc

    @app.get(f"{prefix}/churches/{{church_id}}")
    def api_dist_get_church(
        church_id: str,
        _session: AuthSession = Depends(require_superadmin),
    ) -> dict[str, Any]:
        try:
            return {"ok": True, "church": dist_churches.get_church(church_id)}
        except Exception as exc:
            raise _http_err(exc) from exc

    @app.patch(f"{prefix}/churches/{{church_id}}")
    def api_dist_update_church(
        church_id: str,
        body: ChurchUpdateBody,
        session: AuthSession = Depends(require_superadmin),
    ) -> dict[str, Any]:
        try:
            church = dist_churches.update_church(
                church_id,
                body.model_dump(exclude_none=True),
                actor_user_id=session.user.user_id,
            )
            return {"ok": True, "church": church}
        except Exception as exc:
            raise _http_err(exc) from exc

    @app.delete(f"{prefix}/churches/{{church_id}}")
    def api_dist_delete_church(
        church_id: str,
        _session: AuthSession = Depends(require_superadmin),
    ) -> dict[str, Any]:
        try:
            return dist_churches.delete_church(church_id)
        except Exception as exc:
            raise _http_err(exc) from exc

    @app.post(f"{prefix}/churches/{{church_id}}/status")
    def api_dist_set_status(
        church_id: str,
        body: StatusBody,
        session: AuthSession = Depends(require_superadmin),
    ) -> dict[str, Any]:
        try:
            church = dist_churches.set_pipeline_status(
                church_id, body.status, actor_user_id=session.user.user_id
            )
            return {"ok": True, "church": church}
        except Exception as exc:
            raise _http_err(exc) from exc

    @app.get(f"{prefix}/churches/{{church_id}}/activity")
    def api_dist_church_activity(
        church_id: str,
        limit: int = Query(100, ge=1, le=500),
        _session: AuthSession = Depends(require_superadmin),
    ) -> dict[str, Any]:
        try:
            return {
                "ok": True,
                "activities": list_activities(church_id, limit=limit),
            }
        except Exception as exc:
            raise _http_err(exc) from exc

    @app.get(f"{prefix}/churches/{{church_id}}/liturgyflow")
    def api_dist_church_liturgyflow(
        church_id: str,
        _session: AuthSession = Depends(require_superadmin),
    ) -> dict[str, Any]:
        try:
            church = dist_churches.get_church(church_id)
            usage = dist_churches.get_church_liturgyflow_activity(church)
            return {"ok": True, "liturgyflow": usage}
        except Exception as exc:
            raise _http_err(exc) from exc

    @app.post(f"{prefix}/churches/{{church_id}}/interactions")
    def api_dist_create_interaction(
        church_id: str,
        body: InteractionBody,
        session: AuthSession = Depends(require_superadmin),
    ) -> dict[str, Any]:
        try:
            row = dist_interactions.create_interaction(
                church_id,
                interaction_type=body.interaction_type,
                summary=body.summary,
                result=body.result,
                next_action=body.next_action,
                interacted_at=body.interacted_at,
                actor_user_id=session.user.user_id,
            )
            return {"ok": True, "interaction": row}
        except Exception as exc:
            raise _http_err(exc) from exc

    @app.get(f"{prefix}/churches/{{church_id}}/interactions")
    def api_dist_list_interactions(
        church_id: str,
        limit: int = Query(100, ge=1, le=500),
        _session: AuthSession = Depends(require_superadmin),
    ) -> dict[str, Any]:
        try:
            return {
                "ok": True,
                "interactions": dist_interactions.list_interactions(
                    church_id, limit=limit
                ),
            }
        except Exception as exc:
            raise _http_err(exc) from exc

    @app.post(f"{prefix}/churches/{{church_id}}/follow-up/complete")
    def api_dist_follow_up_complete(
        church_id: str,
        body: FollowUpCompleteBody,
        session: AuthSession = Depends(require_superadmin),
    ) -> dict[str, Any]:
        try:
            church = dist_churches.complete_follow_up(
                church_id, note=body.note, actor_user_id=session.user.user_id
            )
            return {"ok": True, "church": church}
        except Exception as exc:
            raise _http_err(exc) from exc

    @app.post(f"{prefix}/churches/{{church_id}}/follow-up/reschedule")
    def api_dist_follow_up_reschedule(
        church_id: str,
        body: FollowUpRescheduleBody,
        session: AuthSession = Depends(require_superadmin),
    ) -> dict[str, Any]:
        try:
            church = dist_churches.reschedule_follow_up(
                church_id,
                at=body.at,
                note=body.note,
                actor_user_id=session.user.user_id,
            )
            return {"ok": True, "church": church}
        except Exception as exc:
            raise _http_err(exc) from exc

    @app.get(f"{prefix}/follow-ups")
    def api_dist_follow_ups(
        today: bool = Query(True),
        overdue: bool = Query(True),
        _session: AuthSession = Depends(require_superadmin),
    ) -> dict[str, Any]:
        try:
            return dist_churches.list_follow_ups(today=today, overdue=overdue)
        except Exception as exc:
            raise _http_err(exc) from exc

    # ---- campaigns ----

    @app.get(f"{prefix}/campaigns")
    def api_dist_list_campaigns(
        status: str = Query(""),
        _session: AuthSession = Depends(require_superadmin),
    ) -> dict[str, Any]:
        try:
            rows = dist_campaigns.list_campaigns(status=status or None)
            return {"ok": True, "campaigns": rows, "count": len(rows)}
        except Exception as exc:
            raise _http_err(exc) from exc

    @app.post(f"{prefix}/campaigns")
    def api_dist_create_campaign(
        body: CampaignBody,
        session: AuthSession = Depends(require_superadmin),
    ) -> dict[str, Any]:
        try:
            campaign = dist_campaigns.create_campaign(
                body.model_dump(exclude_none=True),
                created_by=session.user.user_id,
            )
            return {"ok": True, "campaign": campaign}
        except Exception as exc:
            raise _http_err(exc) from exc

    @app.get(f"{prefix}/campaigns/{{campaign_id}}")
    def api_dist_get_campaign(
        campaign_id: str,
        _session: AuthSession = Depends(require_superadmin),
    ) -> dict[str, Any]:
        try:
            return {"ok": True, "campaign": dist_campaigns.get_campaign(campaign_id)}
        except Exception as exc:
            raise _http_err(exc) from exc

    @app.patch(f"{prefix}/campaigns/{{campaign_id}}")
    def api_dist_update_campaign(
        campaign_id: str,
        body: CampaignUpdateBody,
        _session: AuthSession = Depends(require_superadmin),
    ) -> dict[str, Any]:
        try:
            campaign = dist_campaigns.update_campaign(
                campaign_id, body.model_dump(exclude_none=True)
            )
            return {"ok": True, "campaign": campaign}
        except Exception as exc:
            raise _http_err(exc) from exc

    @app.post(f"{prefix}/campaigns/{{campaign_id}}/churches")
    def api_dist_associate_churches(
        campaign_id: str,
        body: CampaignChurchesBody,
        _session: AuthSession = Depends(require_superadmin),
    ) -> dict[str, Any]:
        try:
            return dist_campaigns.associate_churches(campaign_id, body.church_ids)
        except Exception as exc:
            raise _http_err(exc) from exc

    @app.delete(f"{prefix}/campaigns/{{campaign_id}}/churches/{{church_id}}")
    def api_dist_disassociate_church(
        campaign_id: str,
        church_id: str,
        _session: AuthSession = Depends(require_superadmin),
    ) -> dict[str, Any]:
        try:
            return dist_campaigns.disassociate_church(campaign_id, church_id)
        except Exception as exc:
            raise _http_err(exc) from exc

    # ---- invites ----

    @app.post(f"{prefix}/churches/{{church_id}}/invite")
    def api_dist_create_invite(
        church_id: str,
        body: InviteCreateBody = Body(default_factory=InviteCreateBody),
        session: AuthSession = Depends(require_superadmin),
    ) -> dict[str, Any]:
        try:
            result = dist_invites.create_distribution_invite(
                church_id,
                actor_user_id=session.user.user_id,
                ttl_days=body.ttl_days,
            )
            return {"ok": True, **result}
        except Exception as exc:
            raise _http_err(exc) from exc

    @app.get(f"{prefix}/invites")
    def api_dist_list_invites(
        church_id: str = Query(""),
        include_accepted: bool = Query(True),
        _session: AuthSession = Depends(require_superadmin),
    ) -> dict[str, Any]:
        try:
            rows = dist_invites.list_invites(
                church_id=church_id or None,
                include_accepted=include_accepted,
            )
            return {"ok": True, "invites": rows, "count": len(rows)}
        except Exception as exc:
            raise _http_err(exc) from exc

    @app.post(f"{prefix}/invites/{{invite_id}}/revoke")
    def api_dist_revoke_invite(
        invite_id: str,
        session: AuthSession = Depends(require_superadmin),
    ) -> dict[str, Any]:
        try:
            invite = dist_invites.revoke_invite(
                invite_id, actor_user_id=session.user.user_id
            )
            return {"ok": True, "invite": invite}
        except Exception as exc:
            raise _http_err(exc) from exc

    # ---- referrals ----

    @app.get(f"{prefix}/referrals")
    def api_dist_list_referrals(
        referring_church_id: str = Query(""),
        referred_church_id: str = Query(""),
        status: str = Query(""),
        _session: AuthSession = Depends(require_superadmin),
    ) -> dict[str, Any]:
        try:
            rows = dist_referrals.list_referrals(
                referring_church_id=referring_church_id or None,
                referred_church_id=referred_church_id or None,
                status=status or None,
            )
            return {"ok": True, "referrals": rows, "count": len(rows)}
        except Exception as exc:
            raise _http_err(exc) from exc

    @app.post(f"{prefix}/churches/{{church_id}}/referral-code")
    def api_dist_ensure_referral_code(
        church_id: str,
        _session: AuthSession = Depends(require_superadmin),
    ) -> dict[str, Any]:
        try:
            church = dist_referrals.ensure_referral_code(church_id)
            return {
                "ok": True,
                "church_id": church.get("id"),
                "referral_code": church.get("referral_code"),
                "church": church,
            }
        except Exception as exc:
            raise _http_err(exc) from exc

    @app.post(f"{prefix}/referrals")
    def api_dist_create_referral(
        body: ReferralCreateBody,
        session: AuthSession = Depends(require_superadmin),
    ) -> dict[str, Any]:
        try:
            referred_payload = (
                body.referred.model_dump(exclude_none=True) if body.referred else None
            )
            referral = dist_referrals.create_referral(
                referring_church_id=body.referring_church_id,
                referred_church_id=body.referred_church_id,
                referred_payload=referred_payload,
                actor_user_id=session.user.user_id,
                status=body.status or "pending",
            )
            return {"ok": True, "referral": referral}
        except Exception as exc:
            raise _http_err(exc) from exc

    # ---- import ----

    @app.post(f"{prefix}/import/preview")
    def api_dist_import_preview(
        body: ImportRowsBody,
        _session: AuthSession = Depends(require_superadmin),
    ) -> dict[str, Any]:
        try:
            return dist_churches.import_churches_preview(body.rows)
        except Exception as exc:
            raise _http_err(exc) from exc

    @app.post(f"{prefix}/import/confirm")
    def api_dist_import_confirm(
        body: ImportRowsBody,
        session: AuthSession = Depends(require_superadmin),
    ) -> dict[str, Any]:
        try:
            return dist_churches.import_churches(
                body.rows, actor_user_id=session.user.user_id
            )
        except Exception as exc:
            raise _http_err(exc) from exc
