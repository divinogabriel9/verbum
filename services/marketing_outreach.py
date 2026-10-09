"""Superadmin marketing contacts + promo push/email broadcasts."""

from __future__ import annotations

import csv
import io
import logging
import re
from datetime import datetime, timezone
from typing import Any, Optional

from services.auth_config import supabase_enabled

logger = logging.getLogger(__name__)

_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _service_client():
    from services.supabase_client import get_service_client

    return get_service_client()


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def normalize_email(email: str) -> str:
    return (email or "").strip().lower()


def _valid_email(email: str) -> bool:
    return bool(_EMAIL_RE.match((email or "").strip()))


def _shape_contact(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": str(row.get("id") or ""),
        "email": row.get("email") or "",
        "user_id": str(row["user_id"]) if row.get("user_id") else None,
        "first_name": row.get("first_name") or "",
        "last_name": row.get("last_name") or "",
        "parish_name": row.get("parish_name") or "",
        "source": row.get("source") or "signup",
        "subscribed": bool(row.get("subscribed", True)),
        "created_at": row.get("created_at") or "",
        "updated_at": row.get("updated_at") or "",
    }


def _shape_campaign(row: dict[str, Any]) -> dict[str, Any]:
    channels = row.get("channels") or []
    if not isinstance(channels, list):
        channels = []
    return {
        "id": str(row.get("id") or ""),
        "title": row.get("title") or "",
        "message": row.get("message") or "",
        "link_url": row.get("link_url") or "",
        "channels": channels,
        "audience": row.get("audience") or "subscribed",
        "sent_by": str(row["sent_by"]) if row.get("sent_by") else None,
        "in_app_sent": int(row.get("in_app_sent") or 0),
        "email_sent": int(row.get("email_sent") or 0),
        "email_failed": int(row.get("email_failed") or 0),
        "recipient_count": int(row.get("recipient_count") or 0),
        "created_at": row.get("created_at") or "",
    }


def upsert_contact(
    *,
    email: str,
    user_id: str = "",
    first_name: str = "",
    last_name: str = "",
    parish_name: str = "",
    source: str = "signup",
    subscribed: bool = True,
) -> dict[str, Any]:
    """Insert or refresh a marketing contact by normalized email."""
    mail = (email or "").strip()
    norm = normalize_email(mail)
    if not norm or not _valid_email(mail) or not supabase_enabled():
        return {"ok": False, "error": "invalid_email"}

    src = (source or "signup").strip()[:40] or "signup"
    if src not in {"signup", "profile_sync", "import", "manual"}:
        src = "signup"

    payload: dict[str, Any] = {
        "email": mail,
        "email_normalized": norm,
        "first_name": (first_name or "").strip()[:80],
        "last_name": (last_name or "").strip()[:80],
        "parish_name": (parish_name or "").strip()[:160],
        "source": src,
        "subscribed": bool(subscribed),
        "updated_at": _now_iso(),
    }
    uid = (user_id or "").strip()
    if uid:
        payload["user_id"] = uid

    try:
        client = _service_client()
        existing = (
            client.table("marketing_contacts")
            .select("*")
            .eq("email_normalized", norm)
            .limit(1)
            .execute()
        )
        rows = existing.data or []
        if rows:
            row_id = rows[0].get("id")
            # Keep unsubscribed status unless explicitly re-subscribing via sync
            # with subscribed=True and prior was True; never force re-subscribe on sync.
            if rows[0].get("subscribed") is False and source == "profile_sync":
                payload.pop("subscribed", None)
            if not uid and rows[0].get("user_id"):
                payload.pop("user_id", None)
            result = (
                client.table("marketing_contacts")
                .update(payload)
                .eq("id", row_id)
                .execute()
            )
            data = (result.data or [None])[0] or rows[0]
            return {"ok": True, "contact": _shape_contact(data), "created": False}
        payload["created_at"] = _now_iso()
        result = client.table("marketing_contacts").insert(payload).execute()
        data = (result.data or [None])[0] or payload
        return {"ok": True, "contact": _shape_contact(data), "created": True}
    except Exception as exc:
        logger.warning("upsert_contact failed for %s: %s", norm, exc)
        return {"ok": False, "error": str(exc)}


def upsert_contact_from_signup(
    *,
    user_id: str,
    email: str = "",
    first_name: str = "",
    last_name: str = "",
    parish_name: str = "",
) -> dict[str, Any]:
    return upsert_contact(
        email=email,
        user_id=user_id,
        first_name=first_name,
        last_name=last_name,
        parish_name=parish_name,
        source="signup",
        subscribed=True,
    )


def sync_contacts_from_profiles() -> dict[str, Any]:
    """Pull every profile email into marketing_contacts."""
    if not supabase_enabled():
        return {"ok": False, "error": "supabase unavailable", "created": 0, "updated": 0}

    created = 0
    updated = 0
    skipped = 0
    try:
        client = _service_client()
        result = (
            client.table("profiles")
            .select("id, email, first_name, last_name")
            .order("created_at", desc=True)
            .range(0, 4999)
            .execute()
        )
        profiles = result.data or []
    except Exception as exc:
        logger.warning("sync_contacts_from_profiles load failed: %s", exc)
        return {"ok": False, "error": str(exc), "created": 0, "updated": 0}

    parish_by_user: dict[str, str] = {}
    try:
        from services.parish_store import get_user_parish_context

        for row in profiles:
            uid = str(row.get("id") or "")
            if not uid:
                continue
            try:
                ctx = get_user_parish_context(uid)
                parish_by_user[uid] = str((ctx or {}).get("community_name") or "").strip()
            except Exception:
                parish_by_user[uid] = ""
    except Exception:
        parish_by_user = {}

    for row in profiles:
        mail = (row.get("email") or "").strip()
        if not mail or not _valid_email(mail):
            skipped += 1
            continue
        uid = str(row.get("id") or "")
        res = upsert_contact(
            email=mail,
            user_id=uid,
            first_name=row.get("first_name") or "",
            last_name=row.get("last_name") or "",
            parish_name=parish_by_user.get(uid, ""),
            source="profile_sync",
            subscribed=True,
        )
        if not res.get("ok"):
            skipped += 1
            continue
        if res.get("created"):
            created += 1
        else:
            updated += 1

    return {
        "ok": True,
        "created": created,
        "updated": updated,
        "skipped": skipped,
        "scanned": len(profiles),
    }


def list_contacts(
    *,
    page: int = 1,
    per_page: int = 50,
    q: str = "",
    subscribed_only: bool = False,
) -> dict[str, Any]:
    if not supabase_enabled():
        return {
            "ok": True,
            "items": [],
            "total": 0,
            "page": page,
            "per_page": per_page,
        }

    page = max(1, int(page or 1))
    per_page = max(1, min(int(per_page or 50), 200))
    offset = (page - 1) * per_page
    query_text = (q or "").strip()

    try:
        client = _service_client()
        query = client.table("marketing_contacts").select("*", count="exact")
        if subscribed_only:
            query = query.eq("subscribed", True)
        if query_text:
            like = f"%{query_text}%"
            query = query.or_(
                f"email.ilike.{like},first_name.ilike.{like},"
                f"last_name.ilike.{like},parish_name.ilike.{like}"
            )
        result = (
            query.order("created_at", desc=True)
            .range(offset, offset + per_page - 1)
            .execute()
        )
        items = [_shape_contact(r) for r in (result.data or [])]
        total = int(result.count or 0) if result.count is not None else len(items)
        return {
            "ok": True,
            "items": items,
            "total": total,
            "page": page,
            "per_page": per_page,
        }
    except Exception as exc:
        logger.warning("list_contacts failed: %s", exc)
        return {"ok": False, "error": str(exc), "items": [], "total": 0, "page": page, "per_page": per_page}


def set_contact_subscribed(contact_id: str, subscribed: bool) -> dict[str, Any]:
    cid = (contact_id or "").strip()
    if not cid or not supabase_enabled():
        return {"ok": False, "error": "unavailable"}
    try:
        result = (
            _service_client()
            .table("marketing_contacts")
            .update({"subscribed": bool(subscribed), "updated_at": _now_iso()})
            .eq("id", cid)
            .execute()
        )
        row = (result.data or [None])[0]
        if not row:
            return {"ok": False, "error": "not_found"}
        return {"ok": True, "contact": _shape_contact(row)}
    except Exception as exc:
        return {"ok": False, "error": str(exc)}


def export_contacts_csv(*, subscribed_only: bool = False) -> dict[str, Any]:
    """Return CSV text of marketing contacts for download."""
    if not supabase_enabled():
        return {"ok": False, "error": "supabase unavailable", "csv": "", "count": 0}

    try:
        client = _service_client()
        query = client.table("marketing_contacts").select("*")
        if subscribed_only:
            query = query.eq("subscribed", True)
        result = query.order("created_at", desc=True).range(0, 9999).execute()
        rows = result.data or []
    except Exception as exc:
        return {"ok": False, "error": str(exc), "csv": "", "count": 0}

    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(
        [
            "email",
            "first_name",
            "last_name",
            "parish_name",
            "subscribed",
            "source",
            "user_id",
            "created_at",
            "updated_at",
        ]
    )
    for row in rows:
        writer.writerow(
            [
                row.get("email") or "",
                row.get("first_name") or "",
                row.get("last_name") or "",
                row.get("parish_name") or "",
                "yes" if row.get("subscribed") else "no",
                row.get("source") or "",
                row.get("user_id") or "",
                row.get("created_at") or "",
                row.get("updated_at") or "",
            ]
        )
    return {"ok": True, "csv": buf.getvalue(), "count": len(rows)}


def list_campaigns(*, limit: int = 20) -> dict[str, Any]:
    if not supabase_enabled():
        return {"ok": True, "items": []}
    try:
        result = (
            _service_client()
            .table("marketing_campaigns")
            .select("*")
            .order("created_at", desc=True)
            .limit(max(1, min(int(limit or 20), 50)))
            .execute()
        )
        return {"ok": True, "items": [_shape_campaign(r) for r in (result.data or [])]}
    except Exception as exc:
        logger.warning("list_campaigns failed: %s", exc)
        return {"ok": False, "error": str(exc), "items": []}


def send_promo_campaign(
    *,
    title: str,
    message: str,
    link_url: str = "",
    channels: Optional[list[str]] = None,
    audience: str = "subscribed",
    acting_user_id: str = "",
) -> dict[str, Any]:
    """Broadcast in-app push notifications and/or promo emails to contacts."""
    if not supabase_enabled():
        return {"ok": False, "error": "supabase unavailable"}

    title_clean = (title or "").strip()[:160]
    msg = (message or "").strip()[:500]
    if not title_clean or not msg:
        return {"ok": False, "error": "Title and message are required."}

    chans = [c.strip().lower() for c in (channels or []) if str(c).strip()]
    chans = [c for c in chans if c in {"in_app", "email"}]
    if not chans:
        return {"ok": False, "error": "Pick at least one channel (in-app or email)."}

    aud = (audience or "subscribed").strip().lower()
    if aud not in {"subscribed", "all"}:
        aud = "subscribed"

    link = (link_url or "").strip()[:500]
    notif_text = msg if not link else f"{msg} {link}".strip()
    notif_text = notif_text[:500]

    try:
        client = _service_client()
        query = client.table("marketing_contacts").select("*")
        if aud == "subscribed":
            query = query.eq("subscribed", True)
        result = query.order("created_at", desc=True).range(0, 9999).execute()
        contacts = result.data or []
    except Exception as exc:
        return {"ok": False, "error": str(exc)}

    if not contacts:
        return {"ok": False, "error": "No contacts match this audience."}

    in_app_sent = 0
    email_sent = 0
    email_failed = 0

    if "in_app" in chans:
        from services.user_notifications import create_user_notification

        meta: dict[str, Any] = {"title": title_clean, "promo": True}
        if link:
            meta["link_url"] = link
        for row in contacts:
            uid = str(row.get("user_id") or "").strip()
            if not uid:
                continue
            res = create_user_notification(
                user_id=uid,
                kind="promo",
                message=notif_text,
                meta=meta,
            )
            if res.get("ok"):
                in_app_sent += 1

    if "email" in chans:
        from services.email_notifications import notify_promo_campaign, safe_send

        for row in contacts:
            to_addr = (row.get("email") or "").strip()
            if not to_addr:
                continue
            name = " ".join(
                p
                for p in ((row.get("first_name") or "").strip(), (row.get("last_name") or "").strip())
                if p
            ).strip()
            result = safe_send(
                "promo_campaign",
                notify_promo_campaign,
                to_addr=to_addr,
                title=title_clean,
                message=msg,
                link_url=link,
                recipient_name=name,
            )
            if result.ok:
                email_sent += 1
            else:
                email_failed += 1

    campaign_row = {
        "title": title_clean,
        "message": msg,
        "link_url": link or None,
        "channels": chans,
        "audience": aud,
        "sent_by": (acting_user_id or "").strip() or None,
        "in_app_sent": in_app_sent,
        "email_sent": email_sent,
        "email_failed": email_failed,
        "recipient_count": len(contacts),
        "created_at": _now_iso(),
    }
    try:
        inserted = client.table("marketing_campaigns").insert(campaign_row).execute()
        campaign = _shape_campaign((inserted.data or [None])[0] or campaign_row)
    except Exception as exc:
        logger.warning("marketing_campaigns insert failed: %s", exc)
        campaign = _shape_campaign(campaign_row)

    return {
        "ok": True,
        "campaign": campaign,
        "recipient_count": len(contacts),
        "in_app_sent": in_app_sent,
        "email_sent": email_sent,
        "email_failed": email_failed,
    }
