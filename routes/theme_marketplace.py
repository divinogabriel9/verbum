"""Theme marketplace API routes."""

from __future__ import annotations

import logging
from typing import Any, Literal, Optional

from fastapi import Depends, File, HTTPException, UploadFile
from pydantic import BaseModel, Field

from services.api_security import AuthSession, require_onboarded_session, require_superadmin
from services.membership_config import is_superadmin_user, is_theme_designer_profile
from services.stripe_billing import billing_enabled, parish_has_paid_access
from services.theme_catalog import THEME_CURRENCIES, THEME_INTERVALS
from services.theme_marketplace import (
    catalog_for_parish,
    create_seller_pack,
    get_or_create_seller_application,
    get_seller_for_user,
    list_seller_packs,
    list_theme_sellers,
    require_approved_seller,
    save_seller_pack_master,
    set_active_deck_source,
    set_pack_status,
    set_theme_seller_status,
    submit_seller_pack,
    update_seller_pack,
)
from services.user_church_context import get_church_profile_context

logger = logging.getLogger(__name__)


class ThemeCheckoutBody(BaseModel):
    pack_id: str = Field(..., min_length=1)
    interval: Literal["monthly", "quarterly", "semiannual", "annual"] = "monthly"
    currency: Literal["krw", "php", "myr", "usd"] = "php"


class ThemeApplyBody(BaseModel):
    source: Literal["default", "parish_dna", "marketplace"]
    pack_id: Optional[str] = None


class SellerApplyBody(BaseModel):
    display_name: str = Field(..., min_length=2, max_length=120)
    bio: str = Field(default="", max_length=2000)
    payout_email: str = Field(default="", max_length=200)


class StudioPackCreateBody(BaseModel):
    title: str = Field(..., min_length=2, max_length=120)
    subtitle: str = Field(default="", max_length=200)
    description: str = Field(default="", max_length=4000)
    designer_label: str = Field(default="", max_length=120)
    season_tags: list[str] = Field(default_factory=list, max_length=12)


class StudioPackUpdateBody(BaseModel):
    title: Optional[str] = Field(default=None, min_length=2, max_length=120)
    subtitle: Optional[str] = Field(default=None, max_length=200)
    description: Optional[str] = Field(default=None, max_length=4000)
    designer_label: Optional[str] = Field(default=None, max_length=120)
    season_tags: Optional[list[str]] = None


class AdminSellerStatusBody(BaseModel):
    status: Literal["pending", "approved", "rejected", "suspended"]


class AdminPackStatusBody(BaseModel):
    status: Literal["draft", "pending_review", "published", "rejected", "archived"]


def _parish_ctx(session: AuthSession) -> dict[str, Any]:
    from services.parish_store import get_parish_by_id, get_user_parish_context

    ctx = get_user_parish_context(session.user.user_id, access_token=session.token) or {}
    parish_id = str(ctx.get("parish_id") or ctx.get("id") or "").strip()
    if not parish_id:
        profile = get_church_profile_context() or {}
        parish_id = str(profile.get("parish_id") or profile.get("id") or "").strip()
        ctx = profile
    if not parish_id:
        raise HTTPException(status_code=400, detail="Join or create a parish first.")
    parish = get_parish_by_id(parish_id) or {}
    return {**ctx, **parish, "parish_id": parish_id}


def register_theme_marketplace_routes(app) -> None:
    @app.get("/api/themes/catalog")
    def api_themes_catalog(
        currency: Optional[str] = None,
        session: AuthSession = Depends(require_onboarded_session),
    ) -> dict[str, Any]:
        cur = (currency or "").strip().lower() or None
        if cur and cur not in THEME_CURRENCIES:
            raise HTTPException(status_code=400, detail="Unsupported currency.")

        parish_id: Optional[str] = None
        has_sub = False
        try:
            ctx = _parish_ctx(session)
            parish_id = str(ctx.get("parish_id") or "")
            has_sub = parish_has_paid_access(ctx) if parish_id else False
            if is_superadmin_user(session.user):
                has_sub = True
        except HTTPException:
            parish_id = None
            has_sub = False

        payload = catalog_for_parish(
            parish_id,
            currency=cur,
            has_app_subscription=has_sub,
        )
        payload["billing_enabled"] = billing_enabled()
        payload["is_superadmin"] = is_superadmin_user(session.user)
        return payload

    @app.get("/api/themes/pricing")
    def api_themes_pricing(currency: Optional[str] = None) -> dict[str, Any]:
        from services.theme_catalog import theme_catalog_payload

        cur = (currency or "php").strip().lower()
        if cur not in THEME_CURRENCIES:
            raise HTTPException(status_code=400, detail="Unsupported currency.")
        return {"ok": True, **theme_catalog_payload(currency=cur)}

    @app.post("/api/themes/checkout")
    def api_themes_checkout(
        body: ThemeCheckoutBody,
        session: AuthSession = Depends(require_onboarded_session),
    ) -> dict[str, Any]:
        from services.theme_billing import create_theme_checkout_session

        ctx = _parish_ctx(session)
        parish_id = str(ctx["parish_id"])
        if body.interval not in THEME_INTERVALS:
            raise HTTPException(status_code=400, detail="Invalid interval.")
        # Superadmin is forever premium — skip Stripe and grant the license directly.
        if is_superadmin_user(session.user):
            from services.theme_catalog import theme_amount_cents
            from services.theme_marketplace import get_pack, grant_license

            pack = get_pack(body.pack_id)
            if not pack:
                raise HTTPException(status_code=404, detail="Theme pack not found.")
            if pack.get("is_placeholder"):
                raise HTTPException(status_code=400, detail="This theme is coming soon.")
            if pack.get("is_free"):
                state = set_active_deck_source(parish_id, "default")
                return {"ok": True, "state": state, "message": "Free theme applied.", "granted": True}
            amount = theme_amount_cents(body.interval, body.currency) or 0
            lic = grant_license(
                parish_id=parish_id,
                pack_id=str(pack["id"]),
                term=body.interval,
                currency=body.currency,
                amount_cents=amount,
                purchased_by_user_id=session.user.user_id,
            )
            state = set_active_deck_source(
                parish_id, "marketplace", pack_id=str(pack["id"])
            )
            return {"ok": True, "license": lic, "state": state, "granted": True}
        return create_theme_checkout_session(
            parish_id=parish_id,
            user_id=session.user.user_id,
            email=getattr(session.user, "email", None),
            pack_id=body.pack_id,
            interval=body.interval,
            currency=body.currency,
        )

    @app.post("/api/themes/apply")
    def api_themes_apply(
        body: ThemeApplyBody,
        session: AuthSession = Depends(require_onboarded_session),
    ) -> dict[str, Any]:
        ctx = _parish_ctx(session)
        parish_id = str(ctx["parish_id"])
        state = set_active_deck_source(
            parish_id,
            body.source,
            pack_id=body.pack_id,
        )
        return {"ok": True, "state": state}

    @app.get("/api/themes/seller")
    def api_themes_seller_me(
        session: AuthSession = Depends(require_onboarded_session),
    ) -> dict[str, Any]:
        seller = get_seller_for_user(session.user.user_id)
        return {"ok": True, "seller": seller}

    @app.post("/api/themes/seller/apply")
    def api_themes_seller_apply(
        body: SellerApplyBody,
        session: AuthSession = Depends(require_onboarded_session),
    ) -> dict[str, Any]:
        seller = get_or_create_seller_application(
            user_id=session.user.user_id,
            display_name=body.display_name,
            bio=body.bio,
            payout_email=body.payout_email or (getattr(session.user, "email", None) or ""),
        )
        return {
            "ok": True,
            "seller": seller,
            "message": "Application received. We’ll review and email you when approved.",
        }

    @app.post("/api/themes/dev-grant")
    def api_themes_dev_grant(
        body: ThemeCheckoutBody,
        session: AuthSession = Depends(require_onboarded_session),
    ) -> dict[str, Any]:
        """Grant a license without Stripe when billing is off (local/dev) or superadmin."""
        from services.theme_catalog import theme_amount_cents
        from services.theme_marketplace import get_pack, grant_license

        if billing_enabled() and not is_superadmin_user(session.user):
            raise HTTPException(
                status_code=403,
                detail="Dev grant is only available when billing is off, or for superadmins.",
            )
        ctx = _parish_ctx(session)
        parish_id = str(ctx["parish_id"])
        if not parish_has_paid_access(ctx) and not is_superadmin_user(session.user):
            raise HTTPException(
                status_code=403,
                detail="Subscribe to LiturgyFlow before activating a theme.",
            )
        pack = get_pack(body.pack_id)
        if not pack:
            raise HTTPException(status_code=404, detail="Theme pack not found.")
        if pack.get("is_placeholder"):
            raise HTTPException(status_code=400, detail="This theme is coming soon.")
        if pack.get("is_free"):
            state = set_active_deck_source(parish_id, "default")
            return {"ok": True, "state": state, "message": "Free theme applied."}
        amount = theme_amount_cents(body.interval, body.currency) or 0
        lic = grant_license(
            parish_id=parish_id,
            pack_id=str(pack["id"]),
            term=body.interval,
            currency=body.currency,
            amount_cents=amount,
            purchased_by_user_id=session.user.user_id,
        )
        state = set_active_deck_source(
            parish_id, "marketplace", pack_id=str(pack["id"])
        )
        return {"ok": True, "license": lic, "state": state}

    @app.get("/api/themes/studio")
    def api_themes_studio(
        session: AuthSession = Depends(require_onboarded_session),
    ) -> dict[str, Any]:
        from services.supabase_client import get_profile

        profile = get_profile(session.user.user_id, access_token=session.token) or {}
        seller = get_seller_for_user(session.user.user_id)
        packs: list[dict[str, Any]] = []
        if seller and str(seller.get("status") or "").lower() == "approved":
            packs = list_seller_packs(str(seller["id"]))
        return {
            "ok": True,
            "is_theme_designer": is_theme_designer_profile(profile),
            "seller": seller,
            "packs": packs,
            "can_manage": bool(
                seller and str(seller.get("status") or "").lower() == "approved"
            ),
        }

    @app.post("/api/themes/studio/packs")
    def api_themes_studio_create_pack(
        body: StudioPackCreateBody,
        session: AuthSession = Depends(require_onboarded_session),
    ) -> dict[str, Any]:
        seller = require_approved_seller(session.user.user_id)
        pack = create_seller_pack(
            seller_id=str(seller["id"]),
            title=body.title,
            subtitle=body.subtitle,
            description=body.description,
            designer_label=body.designer_label or seller.get("display_name") or "",
            season_tags=body.season_tags,
        )
        return {"ok": True, "pack": pack}

    @app.patch("/api/themes/studio/packs/{pack_id}")
    def api_themes_studio_update_pack(
        pack_id: str,
        body: StudioPackUpdateBody,
        session: AuthSession = Depends(require_onboarded_session),
    ) -> dict[str, Any]:
        seller = require_approved_seller(session.user.user_id)
        pack = update_seller_pack(
            seller_id=str(seller["id"]),
            pack_id=pack_id,
            title=body.title,
            subtitle=body.subtitle,
            description=body.description,
            designer_label=body.designer_label,
            season_tags=body.season_tags,
        )
        return {"ok": True, "pack": pack}

    @app.post("/api/themes/studio/packs/{pack_id}/submit")
    def api_themes_studio_submit_pack(
        pack_id: str,
        session: AuthSession = Depends(require_onboarded_session),
    ) -> dict[str, Any]:
        seller = require_approved_seller(session.user.user_id)
        pack = submit_seller_pack(seller_id=str(seller["id"]), pack_id=pack_id)
        return {
            "ok": True,
            "pack": pack,
            "message": "Pack submitted for review.",
        }

    @app.post("/api/themes/studio/packs/{pack_id}/upload")
    async def api_themes_studio_upload_pack(
        pack_id: str,
        file: UploadFile = File(...),
        session: AuthSession = Depends(require_onboarded_session),
    ) -> dict[str, Any]:
        from services.parish_deck_dna import scan_deck_dna

        seller = require_approved_seller(session.user.user_id)
        name = (file.filename or "").lower()
        if not name.endswith(".pptx"):
            raise HTTPException(status_code=400, detail="Upload a .pptx DNA master.")
        raw = await file.read()
        if len(raw) < 1024:
            raise HTTPException(status_code=400, detail="File is too small to be a valid PPTX.")
        if len(raw) > 80 * 1024 * 1024:
            raise HTTPException(status_code=400, detail="File must be at most 80 MB.")

        import tempfile
        from pathlib import Path

        with tempfile.NamedTemporaryFile(suffix=".pptx", delete=False) as tmp:
            tmp.write(raw)
            tmp_path = Path(tmp.name)
        try:
            scanned = scan_deck_dna(tmp_path)
        finally:
            tmp_path.unlink(missing_ok=True)

        if not scanned.get("ok"):
            raise HTTPException(
                status_code=400,
                detail=scanned.get("error")
                or "DNA scan failed — check LFDNA footer labels.",
            )

        pack = save_seller_pack_master(
            seller_id=str(seller["id"]),
            pack_id=pack_id,
            pptx_bytes=raw,
            slide_map=scanned.get("slide_map") or {},
        )
        return {
            "ok": True,
            "pack": pack,
            "slots_found": scanned.get("slots_found") or [],
            "slide_count": scanned.get("slide_count"),
            "message": "Master uploaded. You can submit the pack for review.",
        }

    @app.get("/api/admin/themes/sellers")
    def api_admin_theme_sellers(
        status: Optional[str] = None,
        session: AuthSession = Depends(require_superadmin),
    ) -> dict[str, Any]:
        _ = session
        return {"ok": True, "sellers": list_theme_sellers(status=status)}

    @app.post("/api/admin/themes/sellers/{seller_id}/status")
    def api_admin_theme_seller_status(
        seller_id: str,
        body: AdminSellerStatusBody,
        session: AuthSession = Depends(require_superadmin),
    ) -> dict[str, Any]:
        seller = set_theme_seller_status(
            seller_id=seller_id,
            status=body.status,
            reviewed_by=session.user.user_id,
        )
        return {"ok": True, "seller": seller}

    @app.post("/api/admin/themes/packs/{pack_id}/status")
    def api_admin_theme_pack_status(
        pack_id: str,
        body: AdminPackStatusBody,
        session: AuthSession = Depends(require_superadmin),
    ) -> dict[str, Any]:
        _ = session
        pack = set_pack_status(pack_id=pack_id, status=body.status)
        return {"ok": True, "pack": pack}
