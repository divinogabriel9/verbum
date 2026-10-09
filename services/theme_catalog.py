"""Theme marketplace pricing catalog (₱49/mo ladder + local currencies)."""

from __future__ import annotations

from typing import Any, Optional

THEME_INTERVALS: tuple[str, ...] = ("monthly", "quarterly", "semiannual", "annual")
THEME_CURRENCIES: tuple[str, ...] = ("krw", "php", "myr", "usd")

# Amounts in smallest currency unit (cents / won / sen).
# Anchored to PHP ₱49 / month with duration discounts.
_AMOUNTS_CENTS: dict[str, dict[str, int]] = {
    "monthly": {
        "php": 4900,
        "usd": 99,
        "krw": 1900,
        "myr": 490,
    },
    "quarterly": {
        "php": 12900,
        "usd": 249,
        "krw": 4900,
        "myr": 1290,
    },
    "semiannual": {
        "php": 22900,
        "usd": 449,
        "krw": 8900,
        "myr": 2290,
    },
    "annual": {
        "php": 39900,
        "usd": 799,
        "krw": 14900,
        "myr": 3990,
    },
}

_DISPLAY: dict[str, dict[str, str]] = {
    "monthly": {
        "php": "₱49",
        "usd": "$0.99",
        "krw": "₩1,900",
        "myr": "RM4.90",
        "label": "1 month",
        "months": "1",
        "billing_hint": "Access for 1 month",
    },
    "quarterly": {
        "php": "₱129",
        "usd": "$2.49",
        "krw": "₩4,900",
        "myr": "RM12.90",
        "label": "3 months",
        "months": "3",
        "billing_hint": "Save vs monthly",
    },
    "semiannual": {
        "php": "₱229",
        "usd": "$4.49",
        "krw": "₩8,900",
        "myr": "RM22.90",
        "label": "6 months",
        "months": "6",
        "billing_hint": "Better seasonal value",
    },
    "annual": {
        "php": "₱399",
        "usd": "$7.99",
        "krw": "₩14,900",
        "myr": "RM39.90",
        "label": "12 months",
        "months": "12",
        "billing_hint": "Lowest monthly rate",
    },
}

_MONTHS: dict[str, int] = {
    "monthly": 1,
    "quarterly": 3,
    "semiannual": 6,
    "annual": 12,
}


def theme_term_months(interval: str) -> int:
    return _MONTHS.get((interval or "").strip().lower(), 1)


def theme_amount_cents(interval: str, currency: str) -> Optional[int]:
    iv = (interval or "").strip().lower()
    cur = (currency or "").strip().lower()
    row = _AMOUNTS_CENTS.get(iv) or {}
    if cur not in row:
        return None
    return int(row[cur])


def theme_amount_display(interval: str, currency: str) -> str:
    iv = (interval or "").strip().lower()
    cur = (currency or "").strip().lower()
    meta = _DISPLAY.get(iv) or {}
    return str(meta.get(cur) or "")


def theme_catalog_payload(*, currency: Optional[str] = None) -> dict[str, Any]:
    cur = (currency or "php").strip().lower()
    if cur not in THEME_CURRENCIES:
        cur = "php"
    offers: list[dict[str, Any]] = []
    for interval in THEME_INTERVALS:
        meta = _DISPLAY[interval]
        cents = theme_amount_cents(interval, cur) or 0
        months = theme_term_months(interval)
        per_month = int(round(cents / months)) if months else cents
        offers.append(
            {
                "interval": interval,
                "label": meta["label"],
                "months": months,
                "currency": cur,
                "amount_cents": cents,
                "amount_display": theme_amount_display(interval, cur),
                "per_month_cents": per_month,
                "billing_hint": meta["billing_hint"],
            }
        )
    return {
        "currency": cur,
        "currencies": list(THEME_CURRENCIES),
        "intervals": list(THEME_INTERVALS),
        "offers": offers,
        "base_monthly_php": "₱49",
        "note": (
            "Themes are optional add-ons. LiturgyFlow Classic and your Parish DNA "
            "stay included with your parish plan. An active LiturgyFlow subscription "
            "is required to purchase a theme."
        ),
    }
