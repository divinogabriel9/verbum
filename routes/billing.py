"""Stripe Billing routes: catalog, Checkout, Customer Portal, webhooks."""

from __future__ import annotations

import logging
from typing import Any, Literal, Optional

from fastapi import Depends, HTTPException, Request
from pydantic import BaseModel, Field

from services.api_security import AuthSession, require_session
from services.billing_catalog import CURRENCIES, INTERVALS, catalog_payload
from services.membership_config import is_superadmin_user, membership_payload
from services.stripe_billing import (
    billing_enabled,
    billing_payload,
    construct_webhook_event,
    create_checkout_session,
    create_portal_session,
    process_webhook_event,
)
from services.user_church_context import get_church_profile_context, set_church_profile

logger = logging.getLogger(__name__)


class CheckoutBody(BaseModel):
    interval: Literal["monthly", "quarterly", "semiannual", "annual"] = "monthly"
    currency: Literal["krw", "php", "myr", "usd"] = "usd"


def _require_parish_billing_manager(session: AuthSession) -> dict[str, Any]:
    ctx = get_church_profile_context() or {}
    parish_id = str(ctx.get("parish_id") or ctx.get("id") or "").strip()
    if not parish_id:
        raise HTTPException(
            status_code=400,
            detail="Create your parish profile before starting billing.",
        )
    if is_superadmin_user(session.user):
        return ctx
    role = (ctx.get("parish_role") or "").strip().lower()
    if role != "president":
        raise HTTPException(
            status_code=403,
            detail="Only the parish president can manage billing.",
        )
    return ctx


def register_billing_routes(app) -> None:
    @app.get("/api/billing/catalog")
    def api_billing_catalog(currency: Optional[str] = None) -> dict[str, Any]:
        cur = (currency or "").strip().lower() or None
        if cur and cur not in CURRENCIES:
            raise HTTPException(status_code=400, detail="Unsupported currency.")
        payload = catalog_payload(currency=cur)
        payload["billing_enabled"] = billing_enabled()
        return {"ok": True, **payload}

    @app.get("/api/billing/status")
    def api_billing_status(
        session: AuthSession = Depends(require_session),
    ) -> dict[str, Any]:
        from services.parish_store import get_parish_by_id, get_user_parish_context

        ctx = get_user_parish_context(session.user.user_id, access_token=session.token)
        if ctx and ctx.get("parish_id"):
            fresh = get_parish_by_id(str(ctx["parish_id"]))
            if fresh:
                from services.parish_store import _shape_church_context

                shaped = _shape_church_context(
                    fresh,
                    user_id=session.user.user_id,
                    parish_role=str(ctx.get("parish_role") or "president"),
                    member_id=ctx.get("member_id"),
                )
                set_church_profile(shaped)
                ctx = shaped
        else:
            ctx = get_church_profile_context()
        billing = billing_payload(ctx)
        membership = membership_payload(ctx, user=session.user)
        return {
            "ok": True,
            "billing": billing,
            "membership": membership,
            "parish_id": (ctx or {}).get("parish_id"),
            "community_name": (ctx or {}).get("community_name") or "",
        }

    @app.post("/api/billing/checkout")
    def api_billing_checkout(
        body: CheckoutBody,
        session: AuthSession = Depends(require_session),
    ) -> dict[str, Any]:
        ctx = _require_parish_billing_manager(session)
        parish_id = str(ctx.get("parish_id") or ctx.get("id") or "")
        interval = body.interval
        currency = body.currency
        if interval not in INTERVALS or currency not in CURRENCIES:
            raise HTTPException(status_code=400, detail="Invalid plan selection.")
        return create_checkout_session(
            parish_id=parish_id,
            user_id=session.user.user_id,
            email=session.user.email,
            interval=interval,
            currency=currency,
        )

    @app.post("/api/billing/portal")
    def api_billing_portal(
        session: AuthSession = Depends(require_session),
    ) -> dict[str, Any]:
        ctx = _require_parish_billing_manager(session)
        parish_id = str(ctx.get("parish_id") or ctx.get("id") or "")
        return create_portal_session(parish_id=parish_id)

    @app.post("/api/billing/webhook")
    async def api_billing_webhook(request: Request) -> dict[str, Any]:
        payload = await request.body()
        sig = request.headers.get("stripe-signature") or ""
        if not sig:
            raise HTTPException(status_code=400, detail="Missing Stripe-Signature header.")
        event = construct_webhook_event(payload, sig)
        try:
            return process_webhook_event(event)
        except HTTPException:
            raise
        except Exception as exc:
            logger.exception("Stripe webhook handler failed")
            raise HTTPException(status_code=500, detail="Webhook handler failed.") from exc
