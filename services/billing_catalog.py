"""LiturgyFlow parish subscription catalog (display + Stripe Price IDs)."""

from __future__ import annotations

import os
from dataclasses import dataclass
from functools import lru_cache
from typing import Any, Optional


INTERVALS: tuple[str, ...] = ("monthly", "quarterly", "semiannual", "annual")
CURRENCIES: tuple[str, ...] = ("krw", "php", "myr", "usd")

# Signup / parish registration country → local Stripe currency.
_COUNTRY_CURRENCY: dict[str, str] = {
    "KR": "krw",
    "PH": "php",
    "MY": "myr",
}

# Longest-prefix dial codes used to recover country from E.164 phones.
_DIAL_TO_COUNTRY: tuple[tuple[str, str], ...] = (
    ("+971", "AE"),
    ("+966", "SA"),
    ("+886", "TW"),
    ("+852", "HK"),
    ("+974", "QA"),
    ("+965", "KW"),
    ("+973", "BH"),
    ("+353", "IE"),
    ("+351", "PT"),
    ("+82", "KR"),
    ("+63", "PH"),
    ("+60", "MY"),
    ("+81", "JP"),
    ("+65", "SG"),
    ("+61", "AU"),
    ("+64", "NZ"),
    ("+91", "IN"),
    ("+86", "CN"),
    ("+84", "VN"),
    ("+66", "TH"),
    ("+62", "ID"),
    ("+55", "BR"),
    ("+52", "MX"),
    ("+49", "DE"),
    ("+44", "GB"),
    ("+43", "AT"),
    ("+41", "CH"),
    ("+39", "IT"),
    ("+34", "ES"),
    ("+33", "FR"),
    ("+32", "BE"),
    ("+31", "NL"),
    ("+48", "PL"),
    ("+1", "US"),
)


def normalize_country_code(value: str | None) -> str:
    code = (value or "").strip().upper()
    if len(code) == 2 and code.isalpha():
        return code
    return ""


def currency_for_country_code(country_code: str | None) -> str:
    """Map parish registration country to billing currency (default USD)."""
    code = normalize_country_code(country_code)
    return _COUNTRY_CURRENCY.get(code, "usd")


def country_code_from_phone(phone: str | None) -> str:
    """Best-effort ISO country from an E.164 phone number."""
    raw = (phone or "").strip()
    if not raw:
        return ""
    if not raw.startswith("+"):
        digits = "".join(ch for ch in raw if ch.isdigit())
        raw = ("+" + digits) if digits else ""
    for dial, iso in sorted(_DIAL_TO_COUNTRY, key=lambda item: len(item[0]), reverse=True):
        if raw.startswith(dial):
            return iso
    return ""

# Public parish pricing (publisher deck). Stripe unit amounts live in bootstrap script.
_DISPLAY: dict[str, dict[str, str]] = {
    "monthly": {
        "krw": "₩9,900",
        "php": "₱199",
        "myr": "RM19.90",
        "usd": "$6.99",
        "label": "Monthly",
        "billing_hint": "Billed every month",
    },
    "quarterly": {
        "krw": "₩27,000",
        "php": "₱549",
        "myr": "RM54.90",
        "usd": "$18.99",
        "label": "3-month",
        "billing_hint": "Billed every 3 months",
    },
    "semiannual": {
        "krw": "₩49,000",
        "php": "₱999",
        "myr": "RM99.90",
        "usd": "$34.99",
        "label": "6-month",
        "billing_hint": "Billed every 6 months",
    },
    "annual": {
        "krw": "₩79,000",
        "php": "₱1,599",
        "myr": "RM159.90",
        "usd": "$59.99",
        "label": "Annual",
        "billing_hint": "Billed once a year",
    },
}

TRIAL_DAYS = 14


def _clean(value: str | None) -> str:
    return (value or "").strip()


def _price_env_key(interval: str, currency: str) -> str:
    return f"STRIPE_PRICE_{interval.upper()}_{currency.upper()}"


@lru_cache(maxsize=1)
def _price_id_map() -> dict[str, str]:
    """Map ``interval:currency`` → Stripe Price id from env."""
    out: dict[str, str] = {}
    for interval in INTERVALS:
        for currency in CURRENCIES:
            price_id = _clean(os.environ.get(_price_env_key(interval, currency)))
            if price_id:
                out[f"{interval}:{currency}"] = price_id
    return out


def clear_price_id_cache() -> None:
    _price_id_map.cache_clear()


def resolve_price_id(interval: str, currency: str) -> Optional[str]:
    key = f"{(interval or '').strip().lower()}:{(currency or '').strip().lower()}"
    return _price_id_map().get(key)


def lookup_plan_for_price(price_id: str) -> Optional[tuple[str, str]]:
    """Return ``(interval, currency)`` for a configured Price id."""
    pid = _clean(price_id)
    if not pid:
        return None
    for key, value in _price_id_map().items():
        if value == pid:
            interval, currency = key.split(":", 1)
            return interval, currency
    return None


@dataclass(frozen=True)
class PlanOffer:
    interval: str
    currency: str
    price_id: str
    label: str
    amount_display: str
    billing_hint: str


def configured_offers(*, currency: Optional[str] = None) -> list[PlanOffer]:
    wanted = (currency or "").strip().lower() or None
    offers: list[PlanOffer] = []
    for interval in INTERVALS:
        meta = _DISPLAY[interval]
        for cur in CURRENCIES:
            if wanted and cur != wanted:
                continue
            price_id = resolve_price_id(interval, cur)
            if not price_id:
                continue
            offers.append(
                PlanOffer(
                    interval=interval,
                    currency=cur,
                    price_id=price_id,
                    label=str(meta["label"]),
                    amount_display=str(meta[cur]),
                    billing_hint=str(meta["billing_hint"]),
                )
            )
    return offers


def catalog_payload(*, currency: Optional[str] = None) -> dict[str, Any]:
    """Public plan list for the Billing settings UI."""
    offers = configured_offers(currency=currency)
    intervals_out: list[dict[str, Any]] = []
    for interval in INTERVALS:
        meta = _DISPLAY[interval]
        prices = [
            {
                "currency": o.currency,
                "price_id": o.price_id,
                "amount_display": o.amount_display,
            }
            for o in offers
            if o.interval == interval
        ]
        if not prices and currency:
            # Still show display amounts even before Price IDs are wired.
            cur = currency.strip().lower()
            if cur in CURRENCIES:
                prices = [
                    {
                        "currency": cur,
                        "price_id": None,
                        "amount_display": meta[cur],
                    }
                ]
        intervals_out.append(
            {
                "interval": interval,
                "label": meta["label"],
                "billing_hint": meta["billing_hint"],
                "prices": prices,
            }
        )
    return {
        "trial_days": TRIAL_DAYS,
        "currencies": list(CURRENCIES),
        "intervals": intervals_out,
        "checkout_ready": bool(offers),
    }
