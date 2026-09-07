"""Operator-facing legal / compliance configuration."""

from __future__ import annotations

import os
from functools import lru_cache
from typing import Any

from services.public_contacts import public_contact_emails


def _clean(value: str | None) -> str:
    return (value or "").strip()


@lru_cache(maxsize=1)
def legal_config() -> dict[str, Any]:
    """Public legal metadata used by policy pages and consent UI.

    Never falls back to SUPERADMIN_EMAILS or personal Gmail addresses.
    """
    from services.auth_config import app_public_url

    contacts = public_contact_emails()
    product = _clean(os.environ.get("LEGAL_PRODUCT_NAME")) or "LiturgyFlow"
    operator = _clean(os.environ.get("LEGAL_OPERATOR_NAME")) or product
    jurisdiction = (
        _clean(os.environ.get("LEGAL_JURISDICTION"))
        or "Republic of the Philippines"
    )
    site_url = app_public_url() or "https://liturgyflow.com"
    effective = _clean(os.environ.get("LEGAL_EFFECTIVE_DATE")) or "6 September 2026"

    return {
        "product_name": product,
        "operator_name": operator,
        "jurisdiction": jurisdiction,
        "privacy_email": contacts["privacy"],
        "dmca_email": contacts["dmca"],
        "support_email": contacts["support"],
        "site_url": site_url.rstrip("/"),
        "effective_date": effective,
        "pages": (
            ("privacy", "Privacy Policy"),
            ("terms", "Terms of Service"),
            ("cookies", "Cookie Policy"),
            ("refund", "Refund Policy"),
            ("copyright", "Copyright & IP"),
            ("accessibility", "Accessibility"),
        ),
    }


LEGAL_SLUGS = frozenset(
    {"privacy", "terms", "cookies", "refund", "copyright", "accessibility"}
)
