#!/usr/bin/env python3
"""Create LiturgyFlow parish Product + multi-currency Prices in Stripe.

Usage:
  export STRIPE_SECRET_KEY=sk_test_...   # or rk_test_...
  python scripts/stripe_bootstrap_catalog.py
  python scripts/stripe_bootstrap_catalog.py --write-env   # append Price ids to .env

Idempotent: reuses an existing Product with metadata.liturgyflow_catalog=parish_v1.
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from services.env_config import load_project_dotenv  # noqa: E402

# Stripe unit amounts (smallest currency unit). KRW is zero-decimal.
CATALOG: list[dict] = [
    # interval, currency, unit_amount, recurring months
    {"interval": "monthly", "currency": "usd", "unit_amount": 699, "interval_count": 1},
    {"interval": "monthly", "currency": "krw", "unit_amount": 9900, "interval_count": 1},
    {"interval": "monthly", "currency": "php", "unit_amount": 19900, "interval_count": 1},
    {"interval": "monthly", "currency": "myr", "unit_amount": 1990, "interval_count": 1},
    {"interval": "quarterly", "currency": "usd", "unit_amount": 1899, "interval_count": 3},
    {"interval": "quarterly", "currency": "krw", "unit_amount": 27000, "interval_count": 3},
    {"interval": "quarterly", "currency": "php", "unit_amount": 54900, "interval_count": 3},
    {"interval": "quarterly", "currency": "myr", "unit_amount": 5490, "interval_count": 3},
    {"interval": "semiannual", "currency": "usd", "unit_amount": 3499, "interval_count": 6},
    {"interval": "semiannual", "currency": "krw", "unit_amount": 49000, "interval_count": 6},
    {"interval": "semiannual", "currency": "php", "unit_amount": 99900, "interval_count": 6},
    {"interval": "semiannual", "currency": "myr", "unit_amount": 9990, "interval_count": 6},
    {"interval": "annual", "currency": "usd", "unit_amount": 5999, "interval_count": 12},
    {"interval": "annual", "currency": "krw", "unit_amount": 79000, "interval_count": 12},
    {"interval": "annual", "currency": "php", "unit_amount": 159900, "interval_count": 12},
    {"interval": "annual", "currency": "myr", "unit_amount": 15990, "interval_count": 12},
]

PRODUCT_META = "parish_v1"


def _env_key(interval: str, currency: str) -> str:
    return f"STRIPE_PRICE_{interval.upper()}_{currency.upper()}"


def main() -> int:
    load_project_dotenv()
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--write-env",
        action="store_true",
        help="Append/update STRIPE_PRICE_* lines in project .env",
    )
    args = parser.parse_args()

    key = (os.environ.get("STRIPE_SECRET_KEY") or os.environ.get("STRIPE_API_KEY") or "").strip()
    if not key:
        print("Set STRIPE_SECRET_KEY first.", file=sys.stderr)
        return 1

    import stripe

    client = stripe.StripeClient(key)

    product_id = None
    products = client.v1.products.list({"limit": 100, "active": True})
    for p in products.data or []:
        meta = getattr(p, "metadata", None) or {}
        if isinstance(meta, dict) and meta.get("liturgyflow_catalog") == PRODUCT_META:
            product_id = p.id
            print(f"Reusing product {product_id} ({p.name})")
            break
    if not product_id:
        product = client.v1.products.create(
            {
                "name": "LiturgyFlow Parish",
                "description": "Parish subscription for LiturgyFlow Mass media generation.",
                "metadata": {"liturgyflow_catalog": PRODUCT_META},
            }
        )
        product_id = product.id
        print(f"Created product {product_id}")

    # Index existing prices on this product
    existing: dict[tuple[str, str, int], str] = {}
    starting_after = None
    while True:
        params: dict = {"product": product_id, "limit": 100, "active": True}
        if starting_after:
            params["starting_after"] = starting_after
        page = client.v1.prices.list(params)
        rows = page.data or []
        for price in rows:
            cur = (getattr(price, "currency", "") or "").lower()
            amount = int(getattr(price, "unit_amount", 0) or 0)
            rec = getattr(price, "recurring", None)
            count = int(getattr(rec, "interval_count", 1) or 1) if rec else 1
            existing[(cur, str(count), amount)] = price.id
        if not getattr(page, "has_more", False) or not rows:
            break
        starting_after = rows[-1].id

    env_lines: dict[str, str] = {}
    for row in CATALOG:
        currency = row["currency"]
        amount = int(row["unit_amount"])
        count = int(row["interval_count"])
        interval = row["interval"]
        key_tuple = (currency, str(count), amount)
        price_id = existing.get(key_tuple)
        if price_id:
            print(f"Reuse {_env_key(interval, currency)}={price_id}")
        else:
            price = client.v1.prices.create(
                {
                    "product": product_id,
                    "currency": currency,
                    "unit_amount": amount,
                    "recurring": {"interval": "month", "interval_count": count},
                    "metadata": {
                        "liturgyflow_interval": interval,
                        "liturgyflow_currency": currency,
                    },
                }
            )
            price_id = price.id
            print(f"Created {_env_key(interval, currency)}={price_id}")
        env_lines[_env_key(interval, currency)] = price_id

    print("\n# Add to .env / Render:")
    for k, v in env_lines.items():
        print(f"{k}={v}")

    if args.write_env:
        env_path = ROOT / ".env"
        existing_text = env_path.read_text(encoding="utf-8") if env_path.is_file() else ""
        lines = existing_text.splitlines()
        keys = set(env_lines)
        kept = [ln for ln in lines if ln.split("=", 1)[0].strip() not in keys]
        if kept and kept[-1].strip():
            kept.append("")
        kept.append("# Stripe parish Price ids (stripe_bootstrap_catalog.py)")
        for k, v in env_lines.items():
            kept.append(f"{k}={v}")
        env_path.write_text("\n".join(kept) + "\n", encoding="utf-8")
        print(f"\nUpdated {env_path}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
