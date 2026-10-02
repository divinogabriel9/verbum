"""Stripe Billing for per-parish LiturgyFlow subscriptions."""

from __future__ import annotations

import logging
import os
import secrets
import string
from datetime import datetime, timezone
from functools import lru_cache
from typing import Any, Optional

from fastapi import HTTPException

from services.auth_config import app_public_url
from services.billing_catalog import (
    TRIAL_DAYS,
    lookup_plan_for_price,
    resolve_price_id,
)
from services.parish_store import get_parish_by_id

logger = logging.getLogger(__name__)

PAID_ACCESS_STATUSES = frozenset({"active", "trialing", "past_due"})
_GRANDFATHER_OK = frozenset({"approved"})


def _clean(value: str | None) -> str:
    return (value or "").strip()


def stripe_secret_key() -> str:
    return _clean(os.environ.get("STRIPE_SECRET_KEY")) or _clean(
        os.environ.get("STRIPE_API_KEY")
    )


def stripe_publishable_key() -> str:
    return _clean(os.environ.get("STRIPE_PUBLISHABLE_KEY"))


def stripe_webhook_secret() -> str:
    return _clean(os.environ.get("STRIPE_WEBHOOK_SECRET"))


def billing_enabled() -> bool:
    """True when Stripe secret is configured (Checkout + webhooks live)."""
    flag = _clean(os.environ.get("STRIPE_BILLING_ENABLED")).lower()
    if flag in {"0", "false", "no", "off"}:
        return False
    return bool(stripe_secret_key())


def automatic_tax_enabled() -> bool:
    """Only enable after Stripe Tax registrations are active (see tax docs)."""
    return _clean(os.environ.get("STRIPE_AUTOMATIC_TAX")).lower() in {
        "1",
        "true",
        "yes",
        "on",
    }


@lru_cache(maxsize=1)
def get_stripe_client():
    key = stripe_secret_key()
    if not key:
        raise RuntimeError("STRIPE_SECRET_KEY is not configured.")
    import stripe

    return stripe.StripeClient(key)


def clear_stripe_client_cache() -> None:
    get_stripe_client.cache_clear()


def _integration_identifier(label: str = "liturgyflow_parish_checkout") -> str:
    suffix = "".join(secrets.choice(string.ascii_lowercase) for _ in range(8))
    return f"{label}_{suffix}"


def _public_base_url() -> str:
    base = app_public_url()
    if base:
        return base
    return "http://127.0.0.1:8000"


def _ts_to_iso(ts: Any) -> Optional[str]:
    if ts is None:
        return None
    try:
        return datetime.fromtimestamp(int(ts), tz=timezone.utc).isoformat()
    except (TypeError, ValueError, OSError):
        return None


def parish_has_paid_access(parish_row: Optional[dict[str, Any]]) -> bool:
    """Whether this parish row unlocks the full app under billing rules."""
    if not parish_row:
        return False
    status = _clean(parish_row.get("stripe_subscription_status")).lower()
    if status in PAID_ACCESS_STATUSES:
        return True
    # Legacy approved parishes (pre-Stripe) keep access until they subscribe.
    if not _clean(parish_row.get("stripe_customer_id")):
        membership = _clean(parish_row.get("membership_status")).lower()
        if membership in _GRANDFATHER_OK:
            return True
    return False


def billing_payload(parish_row: Optional[dict[str, Any]]) -> dict[str, Any]:
    row = parish_row or {}
    sub_status = _clean(row.get("stripe_subscription_status")).lower() or None
    price_id = _clean(row.get("stripe_price_id")) or None
    plan = lookup_plan_for_price(price_id) if price_id else None
    enabled = billing_enabled()
    paid = parish_has_paid_access(row) if enabled else None
    return {
        "billing_enabled": enabled,
        "publishable_key": stripe_publishable_key() or None,
        "trial_days": TRIAL_DAYS,
        "stripe_customer_id": _clean(row.get("stripe_customer_id")) or None,
        "stripe_subscription_id": _clean(row.get("stripe_subscription_id")) or None,
        "stripe_subscription_status": sub_status,
        "stripe_price_id": price_id,
        "stripe_current_period_end": row.get("stripe_current_period_end"),
        "plan_interval": plan[0] if plan else None,
        "plan_currency": plan[1] if plan else None,
        "has_paid_access": paid if enabled else True,
        "can_start_checkout": enabled and not (sub_status in PAID_ACCESS_STATUSES),
        "can_manage_billing": enabled and bool(_clean(row.get("stripe_customer_id"))),
    }


def _service_client():
    from services.supabase_client import get_service_client

    return get_service_client()


def update_parish_billing(parish_id: str, fields: dict[str, Any]) -> dict[str, Any]:
    pid = _clean(parish_id)
    if not pid:
        raise ValueError("parish_id required")
    payload = {k: v for k, v in fields.items() if k.startswith("stripe_") or k == "membership_status"}
    if not payload:
        raise ValueError("No billing fields to update")
    client = _service_client()
    result = (
        client.table("parishes")
        .update(payload)
        .eq("id", pid)
        .execute()
    )
    rows = result.data or []
    if not rows:
        raise HTTPException(status_code=404, detail="Parish not found for billing update.")
    return rows[0]


def find_parish_id_by_customer(customer_id: str) -> Optional[str]:
    cid = _clean(customer_id)
    if not cid:
        return None
    try:
        client = _service_client()
        result = (
            client.table("parishes")
            .select("id")
            .eq("stripe_customer_id", cid)
            .limit(1)
            .execute()
        )
        rows = result.data or []
        return str(rows[0]["id"]) if rows else None
    except Exception:
        logger.exception("find_parish_id_by_customer failed")
        return None


def find_parish_id_by_subscription(subscription_id: str) -> Optional[str]:
    sid = _clean(subscription_id)
    if not sid:
        return None
    try:
        client = _service_client()
        result = (
            client.table("parishes")
            .select("id")
            .eq("stripe_subscription_id", sid)
            .limit(1)
            .execute()
        )
        rows = result.data or []
        return str(rows[0]["id"]) if rows else None
    except Exception:
        logger.exception("find_parish_id_by_subscription failed")
        return None


def _ensure_customer(
    *,
    parish: dict[str, Any],
    email: Optional[str],
    user_id: str,
) -> str:
    existing = _clean(parish.get("stripe_customer_id"))
    client = get_stripe_client()
    parish_id = str(parish.get("id") or "")
    if existing:
        return existing

    params: dict[str, Any] = {
        "metadata": {
            "parish_id": parish_id,
            "user_id": user_id,
            "community_name": _clean(parish.get("community_name"))[:200],
        },
    }
    if email:
        params["email"] = email
    name = _clean(parish.get("community_name"))
    if name:
        params["name"] = name[:200]

    customer = client.v1.customers.create(params)
    customer_id = str(customer.id)
    update_parish_billing(parish_id, {"stripe_customer_id": customer_id})
    return customer_id


def create_checkout_session(
    *,
    parish_id: str,
    user_id: str,
    email: Optional[str],
    interval: str,
    currency: str,
) -> dict[str, Any]:
    if not billing_enabled():
        raise HTTPException(status_code=503, detail="Billing is not configured.")

    price_id = resolve_price_id(interval, currency)
    if not price_id:
        raise HTTPException(
            status_code=400,
            detail=f"No Stripe Price configured for {interval}/{currency}.",
        )

    parish = get_parish_by_id(parish_id)
    if not parish:
        raise HTTPException(status_code=404, detail="Parish not found.")
    if not _clean(parish.get("community_name")):
        raise HTTPException(
            status_code=400,
            detail="Set your parish name before starting a subscription.",
        )

    sub_status = _clean(parish.get("stripe_subscription_status")).lower()
    if sub_status in PAID_ACCESS_STATUSES:
        raise HTTPException(
            status_code=409,
            detail="This parish already has an active subscription. Use Manage billing.",
        )

    customer_id = _ensure_customer(parish=parish, email=email, user_id=user_id)
    base = _public_base_url()
    success_url = f"{base}/settings/billing?checkout=success&session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{base}/settings/billing?checkout=cancel"

    params: dict[str, Any] = {
        "mode": "subscription",
        "customer": customer_id,
        "client_reference_id": parish_id,
        "success_url": success_url,
        "cancel_url": cancel_url,
        "line_items": [{"price": price_id, "quantity": 1}],
        "allow_promotion_codes": True,
        "billing_address_collection": "required",
        "integration_identifier": _integration_identifier(),
        "metadata": {
            "parish_id": parish_id,
            "user_id": user_id,
            "interval": interval.strip().lower(),
            "currency": currency.strip().lower(),
        },
        "subscription_data": {
            "trial_period_days": TRIAL_DAYS,
            "billing_mode": {"type": "flexible"},
            "metadata": {
                "parish_id": parish_id,
                "user_id": user_id,
            },
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
        # Common misconfig: live key + test Price IDs (or the reverse).
        if "No such price" in msg:
            raise HTTPException(
                status_code=502,
                detail=(
                    "Stripe Price ID is not valid for the configured API key "
                    "(live/test mismatch). Update STRIPE_PRICE_* env vars to match "
                    "the same mode as STRIPE_SECRET_KEY."
                ),
            ) from exc
        logger.exception("Stripe Checkout Session create failed")
        raise HTTPException(
            status_code=502,
            detail=f"Stripe Checkout failed: {msg[:240]}",
        ) from exc
    url = getattr(session, "url", None)
    if not url:
        raise HTTPException(status_code=502, detail="Stripe Checkout did not return a URL.")
    return {"ok": True, "url": url, "session_id": session.id}


def create_portal_session(*, parish_id: str) -> dict[str, Any]:
    if not billing_enabled():
        raise HTTPException(status_code=503, detail="Billing is not configured.")
    parish = get_parish_by_id(parish_id)
    if not parish:
        raise HTTPException(status_code=404, detail="Parish not found.")
    customer_id = _clean(parish.get("stripe_customer_id"))
    if not customer_id:
        raise HTTPException(
            status_code=400,
            detail="No Stripe customer for this parish. Start a trial first.",
        )
    base = _public_base_url()
    client = get_stripe_client()
    portal = client.v1.billing_portal.sessions.create(
        {
            "customer": customer_id,
            "return_url": f"{base}/settings/billing",
        }
    )
    url = getattr(portal, "url", None)
    if not url:
        raise HTTPException(status_code=502, detail="Stripe Portal did not return a URL.")
    return {"ok": True, "url": url}


def _subscription_fields(subscription: Any) -> dict[str, Any]:
    status = _clean(getattr(subscription, "status", None)).lower()
    customer = getattr(subscription, "customer", None)
    if hasattr(customer, "id"):
        customer = customer.id
    price_id = None
    items = getattr(subscription, "items", None)
    data = getattr(items, "data", None) if items is not None else None
    if data:
        first = data[0]
        price = getattr(first, "price", None)
        price_id = getattr(price, "id", None) if price is not None else None
    period_end = _ts_to_iso(getattr(subscription, "current_period_end", None))
    fields: dict[str, Any] = {
        "stripe_subscription_id": str(getattr(subscription, "id", "") or ""),
        "stripe_subscription_status": status or None,
        "stripe_price_id": _clean(price_id) or None,
        "stripe_current_period_end": period_end,
    }
    if customer:
        fields["stripe_customer_id"] = str(customer)
    if status in PAID_ACCESS_STATUSES:
        fields["membership_status"] = "approved"
    return fields


def sync_subscription_object(subscription: Any, *, parish_id: Optional[str] = None) -> Optional[str]:
    """Persist subscription state onto the parish row. Returns parish_id."""
    sid = _clean(getattr(subscription, "id", None))
    meta = getattr(subscription, "metadata", None) or {}
    pid = _clean(parish_id) or _clean(meta.get("parish_id") if isinstance(meta, dict) else None)
    if not pid:
        pid = find_parish_id_by_subscription(sid) or ""
    if not pid:
        customer = getattr(subscription, "customer", None)
        if hasattr(customer, "id"):
            customer = customer.id
        pid = find_parish_id_by_customer(str(customer or "")) or ""
    if not pid:
        logger.warning("Stripe subscription %s has no parish_id mapping", sid)
        return None
    fields = _subscription_fields(subscription)
    update_parish_billing(pid, fields)
    return pid


def handle_checkout_session_completed(session: Any) -> Optional[str]:
    parish_id = _clean(getattr(session, "client_reference_id", None))
    meta = getattr(session, "metadata", None) or {}
    if not parish_id and isinstance(meta, dict):
        parish_id = _clean(meta.get("parish_id"))
    customer = getattr(session, "customer", None)
    if hasattr(customer, "id"):
        customer = customer.id
    subscription = getattr(session, "subscription", None)
    if hasattr(subscription, "id"):
        subscription_id = subscription.id
    else:
        subscription_id = subscription

    if parish_id and customer:
        update_parish_billing(
            parish_id,
            {
                "stripe_customer_id": str(customer),
                "membership_status": "approved",
            },
        )

    if subscription_id:
        client = get_stripe_client()
        sub = client.v1.subscriptions.retrieve(str(subscription_id))
        return sync_subscription_object(sub, parish_id=parish_id or None)
    return parish_id or None


def construct_webhook_event(payload: bytes, sig_header: str):
    secret = stripe_webhook_secret()
    if not secret:
        raise HTTPException(status_code=503, detail="STRIPE_WEBHOOK_SECRET is not configured.")
    client = get_stripe_client()
    import stripe

    try:
        return client.construct_event(payload, sig_header, secret)
    except stripe.SignatureVerificationError as exc:
        logger.warning("Stripe webhook signature failed: %s", exc)
        raise HTTPException(status_code=400, detail="Invalid Stripe signature.") from exc
    except Exception as exc:
        logger.warning("Stripe webhook parse failed: %s", exc)
        raise HTTPException(status_code=400, detail="Invalid Stripe webhook payload.") from exc


def process_webhook_event(event: Any) -> dict[str, Any]:
    etype = _clean(getattr(event, "type", None))
    data_object = getattr(getattr(event, "data", None), "object", None)
    parish_id: Optional[str] = None

    if etype == "checkout.session.completed":
        parish_id = handle_checkout_session_completed(data_object)
    elif etype in {
        "customer.subscription.created",
        "customer.subscription.updated",
        "customer.subscription.deleted",
    }:
        parish_id = sync_subscription_object(data_object)
    elif etype in {"invoice.paid", "invoice.payment_failed"}:
        subscription = getattr(data_object, "subscription", None)
        if hasattr(subscription, "id"):
            subscription = subscription.id
        if subscription:
            client = get_stripe_client()
            sub = client.v1.subscriptions.retrieve(str(subscription))
            parish_id = sync_subscription_object(sub)
    else:
        logger.info("Ignoring Stripe event type %s", etype)

    return {"ok": True, "type": etype, "parish_id": parish_id}
