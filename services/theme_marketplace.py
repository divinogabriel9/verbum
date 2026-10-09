"""Theme marketplace: packs, licenses, seller applications, active deck source."""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Optional
from uuid import UUID

from fastapi import HTTPException

from services.theme_catalog import (
    theme_amount_cents,
    theme_amount_display,
    theme_catalog_payload,
    theme_term_months,
)

logger = logging.getLogger(__name__)

DECK_SOURCES = frozenset({"default", "parish_dna", "marketplace"})


def _clean(value: Any) -> str:
    return str(value or "").strip()


def _iso_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _parse_dt(value: Any) -> Optional[datetime]:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    raw = _clean(value)
    if not raw:
        return None
    try:
        if raw.endswith("Z"):
            raw = raw[:-1] + "+00:00"
        dt = datetime.fromisoformat(raw)
        return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
    except Exception:
        return None


def _sb():
    from services.supabase_client import get_service_client, supabase_enabled

    if not supabase_enabled():
        return None
    return get_service_client()


def _shape_pack(row: dict[str, Any]) -> dict[str, Any]:
    tags = list(row.get("season_tags") or [])
    is_placeholder = bool(row.get("is_placeholder")) or ("placeholder" in tags)
    return {
        "id": row.get("id"),
        "slug": row.get("slug"),
        "title": row.get("title"),
        "subtitle": row.get("subtitle") or "",
        "description": row.get("description") or "",
        "designer_label": row.get("designer_label") or "Designer",
        "seller_id": row.get("seller_id"),
        "status": row.get("status"),
        "is_free": bool(row.get("is_free")),
        "is_official": bool(row.get("is_official")),
        "is_placeholder": is_placeholder,
        "season_tags": tags,
        "preview_image_path": row.get("preview_image_path"),
        "has_master": bool(_clean(row.get("master_storage_path"))),
        "sort_order": int(row.get("sort_order") or 100),
        "published_at": row.get("published_at"),
    }


def _shape_license(row: dict[str, Any]) -> dict[str, Any]:
    expires = _parse_dt(row.get("expires_at"))
    now = datetime.now(timezone.utc)
    active = _clean(row.get("status")).lower() == "active" and (
        expires is None or expires > now
    )
    return {
        "id": row.get("id"),
        "parish_id": row.get("parish_id"),
        "pack_id": row.get("pack_id"),
        "term": row.get("term"),
        "currency": row.get("currency"),
        "amount_cents": row.get("amount_cents"),
        "status": "active" if active else (_clean(row.get("status")) or "expired"),
        "starts_at": row.get("starts_at"),
        "expires_at": row.get("expires_at"),
        "is_active": active,
    }


def list_published_packs() -> list[dict[str, Any]]:
    client = _sb()
    if not client:
        return _fallback_packs()
    try:
        res = (
            client.table("theme_packs")
            .select("*")
            .eq("status", "published")
            .order("sort_order")
            .execute()
        )
        rows = res.data or []
        shaped = [_shape_pack(r) for r in rows]
        have = {str(p.get("slug") or "") for p in shaped}
        # When the DB has real packs, only merge free/placeholder extras (never fake buyables).
        for extra in _fallback_packs():
            slug = str(extra.get("slug") or "")
            if not slug or slug in have:
                continue
            if not rows or extra.get("is_placeholder") or extra.get("is_free"):
                shaped.append(extra)
                have.add(slug)
        shaped.sort(key=lambda p: int(p.get("sort_order") or 100))
        return shaped or _fallback_packs()
    except Exception:
        logger.exception("list_published_packs failed")
        return _fallback_packs()


def _pack_row(
    *,
    n: int,
    slug: str,
    title: str,
    subtitle: str,
    designer: str,
    tags: list[str],
    sort_order: int,
    is_free: bool = False,
    is_placeholder: bool = False,
    description: str | None = None,
) -> dict[str, Any]:
    return {
        "id": f"00000000-0000-4000-8000-{n:012d}",
        "slug": slug,
        "title": title,
        "subtitle": subtitle,
        "description": (description or subtitle or "").strip(),
        "designer_label": designer,
        "seller_id": None,
        "status": "published",
        "is_free": is_free,
        "is_official": True,
        "is_placeholder": is_placeholder,
        "season_tags": tags,
        "preview_image_path": None,
        "has_master": False,
        "sort_order": sort_order,
        "published_at": None,
    }


def _fallback_packs() -> list[dict[str, Any]]:
    """Catalog seed used when DB is empty / offline — enough pins for a desktop feed."""
    rows = [
        _pack_row(
            n=1,
            slug="liturgyflow-classic",
            title="LiturgyFlow Basic",
            subtitle="Default Mass deck template",
            designer="LiturgyFlow",
            tags=["all", "included", "free"],
            sort_order=1,
            is_free=True,
            description=(
                "We kept the original LiturgyFlow cadence — dark stillness, "
                "generous type, and room for the assembly to breathe between slides."
            ),
        ),
        _pack_row(
            n=15,
            slug="sanctuary-amber",
            title="Sanctuary Amber",
            subtitle="Warm amber for Ordinary Time",
            designer="LiturgyFlow Studio",
            tags=["ordinary"],
            sort_order=5,
            description=(
                "Warm amber for Ordinary Time: candlelight on stone, quiet enough "
                "for weekday Mass, clear for Sunday proclamation."
            ),
        ),
        _pack_row(
            n=2,
            slug="ordinary-green-calm",
            title="Ordinary Green Calm",
            subtitle="Quiet green for Ordinary Time",
            designer="LiturgyFlow Studio",
            tags=["ordinary"],
            sort_order=10,
            description=(
                "Ordinary Time should feel settled, not sleepy. Soft greens and "
                "linen light so the Word carries without competing chrome."
            ),
        ),
        _pack_row(
            n=3,
            slug="advent-violet-light",
            title="Advent Violet Light",
            subtitle="Expectant violet for Advent",
            designer="LiturgyFlow Studio",
            tags=["advent"],
            sort_order=20,
            description=(
                "Advent is expectant violet — twilight, not gloom. We designed for "
                "waiting: soft edges, patient spacing, a glow that points forward."
            ),
        ),
        _pack_row(
            n=4,
            slug="lent-solemn-ash",
            title="Lent Solemn Ash",
            subtitle="Quiet Lent atmosphere",
            designer="LiturgyFlow Studio",
            tags=["lent"],
            sort_order=30,
            description=(
                "Lent asks for less. Ash, dust, and spare type so the penitential "
                "season can speak without decoration getting in the way."
            ),
        ),
        _pack_row(
            n=5,
            slug="easter-gold-dawn",
            title="Easter Gold Dawn",
            subtitle="Warm gold for the Octave",
            designer="Atelier Sanctus",
            tags=["easter"],
            sort_order=40,
        ),
        _pack_row(
            n=6,
            slug="christmas-night-crimson",
            title="Christmas Night Crimson",
            subtitle="Deep night for Nativity",
            designer="Atelier Sanctus",
            tags=["christmas"],
            sort_order=50,
        ),
        _pack_row(
            n=7,
            slug="ordinary-linen-light",
            title="Ordinary Linen Light",
            subtitle="Soft linen for weekday Mass",
            designer="Parish Pixel",
            tags=["ordinary"],
            sort_order=60,
        ),
        _pack_row(
            n=8,
            slug="advent-candle-glow",
            title="Advent Candle Glow",
            subtitle="Warm candlelight Advent",
            designer="Parish Pixel",
            tags=["advent"],
            sort_order=70,
        ),
        _pack_row(
            n=9,
            slug="lent-desert-path",
            title="Lent Desert Path",
            subtitle="Spare desert tones",
            designer="Schola Design",
            tags=["lent"],
            sort_order=80,
        ),
        _pack_row(
            n=10,
            slug="easter-white-alleluia",
            title="Easter White Alleluia",
            subtitle="Bright white & alleluia",
            designer="Schola Design",
            tags=["easter"],
            sort_order=90,
        ),
        _pack_row(
            n=11,
            slug="ordinary-river-stone",
            title="Ordinary River Stone",
            subtitle="Cool stone greens",
            designer="Verbum Lab",
            tags=["ordinary"],
            sort_order=100,
        ),
        _pack_row(
            n=12,
            slug="christmas-evergreen",
            title="Christmas Evergreen",
            subtitle="Evergreen & soft gold",
            designer="Verbum Lab",
            tags=["christmas"],
            sort_order=110,
        ),
        # Explicit placeholder pins (not purchasable yet)
        _pack_row(
            n=101,
            slug="placeholder-pentecost-fire",
            title="Pentecost Fire",
            subtitle="Coming soon",
            designer="Designer TBA",
            tags=["placeholder"],
            sort_order=900,
            is_placeholder=True,
        ),
        _pack_row(
            n=102,
            slug="placeholder-solemnity-ivory",
            title="Solemnity Ivory",
            subtitle="Coming soon",
            designer="Designer TBA",
            tags=["placeholder"],
            sort_order=910,
            is_placeholder=True,
        ),
        _pack_row(
            n=103,
            slug="placeholder-morning-mist",
            title="Morning Mist",
            subtitle="Coming soon",
            designer="Designer TBA",
            tags=["placeholder"],
            sort_order=920,
            is_placeholder=True,
        ),
        _pack_row(
            n=104,
            slug="placeholder-chapel-oak",
            title="Chapel Oak",
            subtitle="Coming soon",
            designer="Designer TBA",
            tags=["placeholder"],
            sort_order=930,
            is_placeholder=True,
        ),
    ]
    return rows


def get_pack(pack_id: str) -> Optional[dict[str, Any]]:
    pid = _clean(pack_id)
    if not pid:
        return None
    for pack in list_published_packs():
        if str(pack.get("id")) == pid or str(pack.get("slug")) == pid:
            return pack
    client = _sb()
    if not client:
        return None
    try:
        q = client.table("theme_packs").select("*")
        try:
            UUID(pid)
            res = q.eq("id", pid).limit(1).execute()
        except Exception:
            res = q.eq("slug", pid).limit(1).execute()
        rows = res.data or []
        return _shape_pack(rows[0]) if rows else None
    except Exception:
        logger.exception("get_pack failed")
        return None


def list_parish_licenses(parish_id: str) -> list[dict[str, Any]]:
    client = _sb()
    if not client:
        return []
    try:
        res = (
            client.table("theme_licenses")
            .select("*")
            .eq("parish_id", parish_id)
            .order("created_at", desc=True)
            .execute()
        )
        shaped = [_shape_license(r) for r in (res.data or [])]
        # Soft-expire stale rows
        for lic in shaped:
            if not lic["is_active"] and _clean(lic.get("status")) == "active":
                try:
                    client.table("theme_licenses").update({"status": "expired"}).eq(
                        "id", lic["id"]
                    ).execute()
                except Exception:
                    pass
                lic["status"] = "expired"
        return shaped
    except Exception:
        logger.exception("list_parish_licenses failed")
        return []


def parish_has_active_license(parish_id: str, pack_id: str) -> bool:
    pack = get_pack(pack_id)
    if pack and pack.get("is_free"):
        return True
    for lic in list_parish_licenses(parish_id):
        if str(lic.get("pack_id")) == str(pack_id) and lic.get("is_active"):
            return True
    return False


def get_parish_theme_state(parish_id: str) -> dict[str, Any]:
    from services.parish_store import get_parish_by_id

    parish = get_parish_by_id(parish_id) or {}
    source = _clean(parish.get("active_deck_source")).lower() or "default"
    if source not in DECK_SOURCES:
        source = "default"
    pack_id = _clean(parish.get("active_theme_pack_id")) or None
    active_pack = get_pack(pack_id) if pack_id and source == "marketplace" else None
    if source == "marketplace" and pack_id and not parish_has_active_license(parish_id, pack_id):
        # License expired — fall back
        source = "default"
        active_pack = None
        try:
            set_active_deck_source(parish_id, "default", pack_id=None)
        except Exception:
            pass
    licenses = list_parish_licenses(parish_id)
    licensed_ids = {str(l["pack_id"]) for l in licenses if l.get("is_active")}
    return {
        "active_deck_source": source,
        "active_theme_pack_id": pack_id if source == "marketplace" else None,
        "active_pack": active_pack,
        "licenses": licenses,
        "licensed_pack_ids": sorted(licensed_ids),
        "has_parish_dna": bool(_clean(parish.get("deck_dna_path"))),
    }


def set_active_deck_source(
    parish_id: str,
    source: str,
    *,
    pack_id: Optional[str] = None,
) -> dict[str, Any]:
    src = _clean(source).lower()
    if src not in DECK_SOURCES:
        raise HTTPException(status_code=400, detail="Invalid deck source.")
    client = _sb()
    if not client:
        raise HTTPException(status_code=503, detail="Database unavailable.")

    fields: dict[str, Any] = {"active_deck_source": src}
    if src == "marketplace":
        pid = _clean(pack_id)
        if not pid:
            raise HTTPException(status_code=400, detail="pack_id required for marketplace.")
        pack = get_pack(pid)
        if not pack or pack.get("status") != "published":
            raise HTTPException(status_code=404, detail="Theme pack not found.")
        if not pack.get("is_free") and not parish_has_active_license(parish_id, str(pack["id"])):
            raise HTTPException(
                status_code=403,
                detail="Purchase this theme (or renew) before applying it.",
            )
        # Free classic → default source
        if pack.get("is_free") and pack.get("slug") == "liturgyflow-classic":
            fields = {"active_deck_source": "default", "active_theme_pack_id": None}
        else:
            fields["active_theme_pack_id"] = pack["id"]
    elif src == "parish_dna":
        from services.parish_store import get_parish_by_id

        parish = get_parish_by_id(parish_id) or {}
        if not _clean(parish.get("deck_dna_path")):
            raise HTTPException(
                status_code=400,
                detail="Upload Parish Deck DNA in Settings before selecting it.",
            )
        fields["active_theme_pack_id"] = None
    else:
        fields["active_theme_pack_id"] = None

    try:
        client.table("parishes").update(fields).eq("id", parish_id).execute()
    except Exception as exc:
        logger.exception("set_active_deck_source failed")
        raise HTTPException(status_code=500, detail="Could not update theme selection.") from exc
    return get_parish_theme_state(parish_id)


def grant_license(
    *,
    parish_id: str,
    pack_id: str,
    term: str,
    currency: str,
    amount_cents: int,
    purchased_by_user_id: Optional[str] = None,
    stripe_checkout_session_id: Optional[str] = None,
    stripe_payment_intent_id: Optional[str] = None,
    starts_at: Optional[datetime] = None,
) -> dict[str, Any]:
    client = _sb()
    if not client:
        raise HTTPException(status_code=503, detail="Database unavailable.")

    pack = get_pack(pack_id)
    if not pack:
        raise HTTPException(status_code=404, detail="Theme pack not found.")

    # Idempotent on checkout session
    session_id = _clean(stripe_checkout_session_id)
    if session_id:
        try:
            existing = (
                client.table("theme_licenses")
                .select("*")
                .eq("stripe_checkout_session_id", session_id)
                .limit(1)
                .execute()
            )
            if existing.data:
                return _shape_license(existing.data[0])
        except Exception:
            pass

    start = starts_at or datetime.now(timezone.utc)
    months = theme_term_months(term) if term != "free" else 0
    expires = start + timedelta(days=30 * months) if months else None

    row = {
        "parish_id": parish_id,
        "pack_id": pack["id"],
        "term": term if term in {"monthly", "quarterly", "semiannual", "annual", "free"} else "monthly",
        "currency": (currency or "php").lower(),
        "amount_cents": int(amount_cents or 0),
        "status": "active",
        "starts_at": start.isoformat(),
        "expires_at": expires.isoformat() if expires else None,
        "purchased_by_user_id": purchased_by_user_id,
        "stripe_checkout_session_id": session_id or None,
        "stripe_payment_intent_id": _clean(stripe_payment_intent_id) or None,
    }
    try:
        res = client.table("theme_licenses").insert(row).execute()
        data = (res.data or [row])[0]
        return _shape_license(data)
    except Exception as exc:
        logger.exception("grant_license failed")
        raise HTTPException(status_code=500, detail="Could not grant theme license.") from exc


def catalog_for_parish(
    parish_id: Optional[str],
    *,
    currency: Optional[str] = None,
    has_app_subscription: bool = False,
) -> dict[str, Any]:
    from services.billing_catalog import currency_for_country_code
    from services.parish_store import get_parish_by_id
    from services.stripe_billing import resolve_parish_country_code

    cur = (currency or "").strip().lower() or None
    if not cur and parish_id:
        parish = get_parish_by_id(parish_id) or {}
        country = resolve_parish_country_code(parish)
        cur = currency_for_country_code(country)
    pricing = theme_catalog_payload(currency=cur)
    packs = list_published_packs()
    state = get_parish_theme_state(parish_id) if parish_id else {
        "active_deck_source": "default",
        "active_theme_pack_id": None,
        "active_pack": None,
        "licenses": [],
        "licensed_pack_ids": [],
        "has_parish_dna": False,
    }
    licensed = set(state.get("licensed_pack_ids") or [])
    enriched = []
    for pack in packs:
        pid = str(pack["id"])
        owned = bool(pack.get("is_free")) or pid in licensed
        placeholder = bool(pack.get("is_placeholder"))
        can_buy = (
            (not placeholder)
            and (not pack.get("is_free"))
            and has_app_subscription
            and not owned
        )
        blocked = None
        if placeholder:
            blocked = "Coming soon."
        elif not pack.get("is_free") and not has_app_subscription:
            blocked = "Subscribe to LiturgyFlow before buying themes."
        enriched.append(
            {
                **pack,
                "owned": owned,
                "can_purchase": can_buy,
                "purchase_blocked_reason": blocked,
                "is_active": (
                    (state.get("active_deck_source") == "default" and pack.get("slug") == "liturgyflow-classic")
                    or (
                        state.get("active_deck_source") == "marketplace"
                        and str(state.get("active_theme_pack_id")) == pid
                    )
                ),
            }
        )
    return {
        "ok": True,
        "pricing": pricing,
        "packs": enriched,
        "state": state,
        "has_app_subscription": has_app_subscription,
        "requires_subscription_to_buy": True,
        "browse_without_subscription": True,
    }


def get_or_create_seller_application(
    *,
    user_id: str,
    display_name: str,
    bio: str = "",
    payout_email: str = "",
) -> dict[str, Any]:
    client = _sb()
    if not client:
        raise HTTPException(status_code=503, detail="Database unavailable.")
    name = _clean(display_name) or "Designer"
    try:
        existing = (
            client.table("theme_sellers")
            .select("*")
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )
        if existing.data:
            row = existing.data[0]
            updates = {
                "display_name": name[:120],
                "bio": _clean(bio)[:2000],
                "updated_at": _iso_now(),
            }
            if _clean(payout_email):
                updates["payout_email"] = _clean(payout_email)[:200]
            if row.get("status") == "rejected":
                updates["status"] = "pending"
                updates["reviewed_at"] = None
                updates["reviewed_by"] = None
            client.table("theme_sellers").update(updates).eq("id", row["id"]).execute()
            refreshed = (
                client.table("theme_sellers")
                .select("*")
                .eq("id", row["id"])
                .limit(1)
                .execute()
            )
            return (refreshed.data or [row])[0]
        res = (
            client.table("theme_sellers")
            .insert(
                {
                    "user_id": user_id,
                    "display_name": name[:120],
                    "bio": _clean(bio)[:2000],
                    "payout_email": _clean(payout_email)[:200] or None,
                    "status": "pending",
                }
            )
            .execute()
        )
        return (res.data or [{}])[0]
    except Exception as exc:
        logger.exception("seller application failed")
        raise HTTPException(status_code=500, detail="Could not submit seller application.") from exc


def get_seller_for_user(user_id: str) -> Optional[dict[str, Any]]:
    client = _sb()
    if not client:
        return None
    try:
        res = (
            client.table("theme_sellers")
            .select("*")
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )
        rows = res.data or []
        return rows[0] if rows else None
    except Exception:
        return None


def require_approved_seller(user_id: str) -> dict[str, Any]:
    seller = get_seller_for_user(user_id)
    if not seller:
        raise HTTPException(status_code=403, detail="Apply as a designer first.")
    status = _clean(seller.get("status")).lower()
    if status != "approved":
        raise HTTPException(
            status_code=403,
            detail="Your designer account is pending review."
            if status == "pending"
            else "Designer account is not approved.",
        )
    return seller


def _slugify(value: str) -> str:
    import re

    text = _clean(value).lower()
    text = re.sub(r"[^a-z0-9]+", "-", text).strip("-")
    return (text or "theme")[:60]


def _unique_pack_slug(base: str) -> str:
    import secrets

    client = _sb()
    root = _slugify(base)
    for _ in range(8):
        candidate = f"{root}-{secrets.token_hex(2)}"
        if not client:
            return candidate
        try:
            existing = (
                client.table("theme_packs")
                .select("id")
                .eq("slug", candidate)
                .limit(1)
                .execute()
            )
            if not (existing.data or []):
                return candidate
        except Exception:
            return candidate
    return f"{root}-{secrets.token_hex(4)}"


def list_seller_packs(seller_id: str) -> list[dict[str, Any]]:
    client = _sb()
    if not client:
        return []
    try:
        res = (
            client.table("theme_packs")
            .select("*")
            .eq("seller_id", seller_id)
            .order("updated_at", desc=True)
            .execute()
        )
        return [_shape_pack(r) for r in (res.data or [])]
    except Exception:
        logger.exception("list_seller_packs failed")
        return []


def create_seller_pack(
    *,
    seller_id: str,
    title: str,
    subtitle: str = "",
    description: str = "",
    designer_label: str = "",
    season_tags: Optional[list[str]] = None,
) -> dict[str, Any]:
    client = _sb()
    if not client:
        raise HTTPException(status_code=503, detail="Database unavailable.")
    name = _clean(title)
    if len(name) < 2:
        raise HTTPException(status_code=400, detail="Pack title is required.")
    tags = [str(t).strip().lower() for t in (season_tags or []) if str(t).strip()][:12]
    slug = _unique_pack_slug(name)
    label = _clean(designer_label) or "Designer"
    try:
        res = (
            client.table("theme_packs")
            .insert(
                {
                    "slug": slug,
                    "title": name[:120],
                    "subtitle": _clean(subtitle)[:200],
                    "description": _clean(description)[:4000],
                    "designer_label": label[:120],
                    "seller_id": seller_id,
                    "status": "draft",
                    "is_free": False,
                    "is_official": False,
                    "season_tags": tags,
                    "sort_order": 200,
                }
            )
            .execute()
        )
        row = (res.data or [None])[0]
        if not row:
            raise HTTPException(status_code=500, detail="Could not create theme pack.")
        return _shape_pack(row)
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("create_seller_pack failed")
        raise HTTPException(status_code=500, detail="Could not create theme pack.") from exc


def _seller_owns_pack(seller_id: str, pack_id: str) -> Optional[dict[str, Any]]:
    client = _sb()
    if not client:
        return None
    try:
        res = (
            client.table("theme_packs")
            .select("*")
            .eq("id", pack_id)
            .eq("seller_id", seller_id)
            .limit(1)
            .execute()
        )
        rows = res.data or []
        return rows[0] if rows else None
    except Exception:
        return None


def update_seller_pack(
    *,
    seller_id: str,
    pack_id: str,
    title: Optional[str] = None,
    subtitle: Optional[str] = None,
    description: Optional[str] = None,
    designer_label: Optional[str] = None,
    season_tags: Optional[list[str]] = None,
) -> dict[str, Any]:
    client = _sb()
    if not client:
        raise HTTPException(status_code=503, detail="Database unavailable.")
    row = _seller_owns_pack(seller_id, pack_id)
    if not row:
        raise HTTPException(status_code=404, detail="Pack not found.")
    status = _clean(row.get("status")).lower()
    if status in {"published", "archived"}:
        raise HTTPException(
            status_code=400,
            detail="Published packs cannot be edited here. Contact support to revise.",
        )
    updates: dict[str, Any] = {"updated_at": _iso_now()}
    if title is not None:
        name = _clean(title)
        if len(name) < 2:
            raise HTTPException(status_code=400, detail="Pack title is required.")
        updates["title"] = name[:120]
    if subtitle is not None:
        updates["subtitle"] = _clean(subtitle)[:200]
    if description is not None:
        updates["description"] = _clean(description)[:4000]
    if designer_label is not None:
        updates["designer_label"] = (_clean(designer_label) or "Designer")[:120]
    if season_tags is not None:
        updates["season_tags"] = [
            str(t).strip().lower() for t in season_tags if str(t).strip()
        ][:12]
    if status == "rejected":
        updates["status"] = "draft"
    try:
        client.table("theme_packs").update(updates).eq("id", pack_id).execute()
        refreshed = (
            client.table("theme_packs").select("*").eq("id", pack_id).limit(1).execute()
        )
        return _shape_pack((refreshed.data or [row])[0])
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("update_seller_pack failed")
        raise HTTPException(status_code=500, detail="Could not update pack.") from exc


def submit_seller_pack(*, seller_id: str, pack_id: str) -> dict[str, Any]:
    client = _sb()
    if not client:
        raise HTTPException(status_code=503, detail="Database unavailable.")
    row = _seller_owns_pack(seller_id, pack_id)
    if not row:
        raise HTTPException(status_code=404, detail="Pack not found.")
    if not _clean(row.get("master_storage_path")):
        raise HTTPException(
            status_code=400,
            detail="Upload a DNA-compatible .pptx master before submitting.",
        )
    status = _clean(row.get("status")).lower()
    if status == "published":
        return _shape_pack(row)
    if status not in {"draft", "rejected", "pending_review"}:
        raise HTTPException(status_code=400, detail="This pack cannot be submitted.")
    try:
        client.table("theme_packs").update(
            {"status": "pending_review", "updated_at": _iso_now()}
        ).eq("id", pack_id).execute()
        refreshed = (
            client.table("theme_packs").select("*").eq("id", pack_id).limit(1).execute()
        )
        return _shape_pack((refreshed.data or [row])[0])
    except Exception as exc:
        logger.exception("submit_seller_pack failed")
        raise HTTPException(status_code=500, detail="Could not submit pack.") from exc


def list_theme_sellers(*, status: Optional[str] = None) -> list[dict[str, Any]]:
    client = _sb()
    if not client:
        return []
    try:
        q = client.table("theme_sellers").select("*").order("created_at", desc=True)
        st = _clean(status).lower()
        if st:
            q = q.eq("status", st)
        res = q.limit(200).execute()
        return list(res.data or [])
    except Exception:
        logger.exception("list_theme_sellers failed")
        return []


def set_theme_seller_status(
    *,
    seller_id: str,
    status: str,
    reviewed_by: Optional[str] = None,
) -> dict[str, Any]:
    client = _sb()
    if not client:
        raise HTTPException(status_code=503, detail="Database unavailable.")
    st = _clean(status).lower()
    if st not in {"pending", "approved", "rejected", "suspended"}:
        raise HTTPException(status_code=400, detail="Invalid seller status.")
    updates: dict[str, Any] = {
        "status": st,
        "updated_at": _iso_now(),
        "reviewed_at": _iso_now(),
    }
    if reviewed_by:
        updates["reviewed_by"] = reviewed_by
    try:
        res = (
            client.table("theme_sellers")
            .update(updates)
            .eq("id", seller_id)
            .execute()
        )
        rows = res.data or []
        if not rows:
            raise HTTPException(status_code=404, detail="Seller not found.")
        return rows[0]
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("set_theme_seller_status failed")
        raise HTTPException(status_code=500, detail="Could not update seller.") from exc


def set_pack_status(*, pack_id: str, status: str) -> dict[str, Any]:
    client = _sb()
    if not client:
        raise HTTPException(status_code=503, detail="Database unavailable.")
    st = _clean(status).lower()
    if st not in {"draft", "pending_review", "published", "rejected", "archived"}:
        raise HTTPException(status_code=400, detail="Invalid pack status.")
    updates: dict[str, Any] = {"status": st, "updated_at": _iso_now()}
    if st == "published":
        updates["published_at"] = _iso_now()
    try:
        res = client.table("theme_packs").update(updates).eq("id", pack_id).execute()
        rows = res.data or []
        if not rows:
            raise HTTPException(status_code=404, detail="Pack not found.")
        return _shape_pack(rows[0])
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("set_pack_status failed")
        raise HTTPException(status_code=500, detail="Could not update pack.") from exc


def save_seller_pack_master(
    *,
    seller_id: str,
    pack_id: str,
    pptx_bytes: bytes,
    slide_map: dict[str, Any],
) -> dict[str, Any]:
    from services.storage_assets import parish_storage_ready, upload_shared_asset

    client = _sb()
    if not client:
        raise HTTPException(status_code=503, detail="Database unavailable.")
    row = _seller_owns_pack(seller_id, pack_id)
    if not row:
        raise HTTPException(status_code=404, detail="Pack not found.")
    status = _clean(row.get("status")).lower()
    if status in {"published", "archived"}:
        raise HTTPException(status_code=400, detail="Cannot replace a published pack master.")
    if not parish_storage_ready():
        raise HTTPException(status_code=503, detail="Storage is not configured.")
    path = f"theme_packs/{seller_id}/{pack_id}/master.pptx"
    stored = upload_shared_asset(
        relative_path=path,
        raw=pptx_bytes,
        content_type=(
            "application/vnd.openxmlformats-officedocument.presentationml.presentation"
        ),
        upsert=True,
    )
    updates = {
        "master_storage_path": stored.path,
        "slide_map": dict(slide_map or {}),
        "updated_at": _iso_now(),
    }
    if status == "rejected":
        updates["status"] = "draft"
    try:
        client.table("theme_packs").update(updates).eq("id", pack_id).execute()
        refreshed = (
            client.table("theme_packs").select("*").eq("id", pack_id).limit(1).execute()
        )
        pack = _shape_pack((refreshed.data or [row])[0])
        pack["storage_path"] = stored.path
        return pack
    except Exception as exc:
        logger.exception("save_seller_pack_master failed")
        raise HTTPException(status_code=500, detail="Could not save pack master.") from exc


def resolve_marketplace_dna_for_parish(parish_id: str) -> Optional[dict[str, Any]]:
    """Return DNA payload for generation when marketplace pack is active."""
    state = get_parish_theme_state(parish_id)
    if state.get("active_deck_source") != "marketplace":
        return None
    pack = state.get("active_pack") or {}
    pack_id = pack.get("id")
    if not pack_id:
        return None
    client = _sb()
    if not client:
        return None
    try:
        res = (
            client.table("theme_packs")
            .select("master_storage_path, slide_map")
            .eq("id", pack_id)
            .limit(1)
            .execute()
        )
        rows = res.data or []
        if not rows:
            return None
        path = _clean(rows[0].get("master_storage_path"))
        if not path:
            return None
        return {
            "storage_path": path,
            "slide_map": rows[0].get("slide_map") or {},
            "updated_at": _iso_now(),
            "source": "marketplace",
            "pack_id": pack_id,
        }
    except Exception:
        logger.exception("resolve_marketplace_dna_for_parish failed")
        return None
