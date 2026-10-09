"""Stripe Checkout for time-limited theme pack licenses."""

from __future__ import annotations

import logging
import os
from typing import Any, Optional

from fastapi import HTTPException

from services.theme_catalog import (
    THEME_CURRENCIES,
    THEME_INTERVALS,
    theme_amount_cents,
    theme_amount_display,
    theme_term_months,
)
from services.theme_marketplace import get_pack, grant_license, parish_has_active_license

logger = logging.getLogger(__name__)


def _clean(value: Any) -> str:
    return str(value or "").strip()


def _public_base_url() -> str:
    return (
        _clean(os.environ.get("PUBLIC_BASE_URL"))
        or _clean(os.environ.get("RENDER_EXTERNAL_URL"))
        or "http://127.0.0.1:8000"
    ).rstrip("/")


def create_theme_checkout_session(
    *,
    parish_id: str,
    user_id: str,
    email: Optional[str],
    pack_id: str,
    interval: str,
    currency: str,
) -> dict[str, Any]:
    from services.parish_store import get_parish_by_id
    from services.stripe_billing import (
        billing_enabled,
        get_stripe_client,
        parish_has_paid_access,
        _ensure_customer,
        _integration_identifier,
        automatic_tax_enabled,
    )

    if not billing_enabled():
        raise HTTPException(status_code=503, detail="Billing is not configured.")

    iv = (interval or "").strip().lower()
    cur = (currency or "").strip().lower()
    if iv not in THEME_INTERVALS:
        raise HTTPException(status_code=400, detail="Invalid theme term.")
    if cur not in THEME_CURRENCIES:
        raise HTTPException(status_code=400, detail="Unsupported currency.")

    parish = get_parish_by_id(parish_id)
    if not parish:
        raise HTTPException(status_code=404, detail="Parish not found.")
    if not parish_has_paid_access(parish):
        raise HTTPException(
            status_code=403,
            detail="Subscribe to LiturgyFlow before buying a theme pack.",
        )

    pack = get_pack(pack_id)
    if not pack or pack.get("status") != "published":
        raise HTTPException(status_code=404, detail="Theme pack not found.")
    if pack.get("is_placeholder"):
        raise HTTPException(status_code=400, detail="This theme is coming soon.")
    if pack.get("is_free"):
        raise HTTPException(status_code=400, detail="This theme is included free — apply it from the catalog.")
    if parish_has_active_license(parish_id, str(pack["id"])):
        raise HTTPException(
            status_code=409,
            detail="This parish already has an active license for this theme.",
        )

    amount = theme_amount_cents(iv, cur)
    if amount is None or amount <= 0:
        raise HTTPException(status_code=400, detail="Price not available for this term/currency.")

    customer_id = _ensure_customer(parish=parish, email=email, user_id=user_id)
    base = _public_base_url()
    success_url = f"{base}/themes?theme_checkout=success&session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{base}/themes?theme_checkout=cancel"
    title = _clean(pack.get("title")) or "Mass theme"
    months = theme_term_months(iv)
    display = theme_amount_display(iv, cur)

    params: dict[str, Any] = {
        "mode": "payment",
        "customer": customer_id,
        "client_reference_id": parish_id,
        "success_url": success_url,
        "cancel_url": cancel_url,
        "line_items": [
            {
                "quantity": 1,
                "price_data": {
                    "currency": cur,
                    "unit_amount": amount,
                    "product_data": {
                        "name": f"{title} · {months} mo theme",
                        "description": (
                            f"LiturgyFlow theme license ({display}) for {months} month(s). "
                            "Requires an active LiturgyFlow parish plan to generate."
                        ),
                    },
                },
            }
        ],
        "allow_promotion_codes": True,
        "billing_address_collection": "required",
        "integration_identifier": _integration_identifier(),
        "metadata": {
            "purchase_kind": "theme_pack",
            "parish_id": parish_id,
            "user_id": user_id,
            "pack_id": str(pack["id"]),
            "pack_slug": _clean(pack.get("slug")),
            "interval": iv,
            "currency": cur,
            "amount_cents": str(amount),
        },
    }
    if automatic_tax_enabled():
        params["automatic_tax"] = {"enabled": True}
        params["customer_update"] = {"address": "auto", "name": "auto"}

    client = get_stripe_client()
    try:
        session = client.v1.checkout.sessions.create(params)
    except Exception as exc:
        msg = str(getattr(exc, "user", None) or exc)
        logger.exception("Theme Checkout Session create failed")
        raise HTTPException(
            status_code=502,
            detail=f"Theme checkout failed: {msg[:240]}",
        ) from exc

    url = getattr(session, "url", None)
    if not url:
        raise HTTPException(status_code=502, detail="Stripe Checkout did not return a URL.")
    return {
        "ok": True,
        "url": url,
        "session_id": session.id,
        "amount_display": display,
        "interval": iv,
        "currency": cur,
        "pack_id": pack["id"],
    }


def fulfill_theme_checkout_session(session: Any) -> Optional[str]:
    """Grant license from a completed Stripe Checkout (payment mode)."""
    meta = getattr(session, "metadata", None) or {}
    if not isinstance(meta, dict):
        meta = {}
    if _clean(meta.get("purchase_kind")).lower() != "theme_pack":
        return None

    parish_id = _clean(getattr(session, "client_reference_id", None)) or _clean(
        meta.get("parish_id")
    )
    pack_id = _clean(meta.get("pack_id"))
    interval = _clean(meta.get("interval")).lower() or "monthly"
    currency = _clean(meta.get("currency")).lower() or "php"
    user_id = _clean(meta.get("user_id")) or None
    amount_raw = meta.get("amount_cents")
    try:
        amount_cents = int(amount_raw) if amount_raw is not None else (
            theme_amount_cents(interval, currency) or 0
        )
    except Exception:
        amount_cents = theme_amount_cents(interval, currency) or 0

    payment_intent = getattr(session, "payment_intent", None)
    if hasattr(payment_intent, "id"):
        payment_intent = payment_intent.id

    if not parish_id or not pack_id:
        logger.warning("Theme checkout missing parish_id/pack_id: %s", getattr(session, "id", None))
        return None

    grant_license(
        parish_id=parish_id,
        pack_id=pack_id,
        term=interval,
        currency=currency,
        amount_cents=amount_cents,
        purchased_by_user_id=user_id,
        stripe_checkout_session_id=str(getattr(session, "id", "") or ""),
        stripe_payment_intent_id=str(payment_intent or "") or None,
    )
    return parish_id
