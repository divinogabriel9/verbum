"""Weekly Mass PPTX + choir practice share reminder job."""

from __future__ import annotations

import logging
from datetime import date, datetime, timedelta, timezone
from typing import Any, Literal, Optional

from services.auth_config import supabase_enabled
from services.email import email_enabled, reminders_enabled
from services.email_notifications import (
    notify_mass_pptx_reminder,
    notify_practice_share_reminder,
    safe_send,
)
from services.redis_client import get_redis

logger = logging.getLogger(__name__)

ReminderKind = Literal["mass_pptx", "practice_share", "auto"]


def upcoming_sunday(today: Optional[date] = None) -> date:
    base = today or date.today()
    # Monday=0 … Sunday=6 → days until next Sunday (0 if today is Sunday)
    days = (6 - base.weekday()) % 7
    return base + timedelta(days=days)


def _resolve_kind(kind: ReminderKind, *, today: Optional[date] = None) -> Optional[str]:
    k = (kind or "auto").strip().lower()
    if k in {"mass_pptx", "practice_share"}:
        return k
    if k != "auto":
        return None
    # UTC weekday: Wed=2 → mass PPTX; Fri=4 → practice share
    wd = (today or date.today()).weekday()
    if wd == 2:
        return "mass_pptx"
    if wd == 4:
        return "practice_share"
    return None


def _dedupe_key(kind: str, parish_id: str, mass_date: str) -> str:
    return f"verbum:email_reminder:{kind}:{parish_id}:{mass_date}"


def _already_sent(kind: str, parish_id: str, mass_date: str) -> bool:
    client = get_redis()
    if client is None:
        return False
    try:
        return bool(client.get(_dedupe_key(kind, parish_id, mass_date)))
    except Exception:
        return False


def _mark_sent(kind: str, parish_id: str, mass_date: str) -> None:
    client = get_redis()
    if client is None:
        return
    try:
        # Keep ~10 days so we don't re-send for the same Sunday.
        client.setex(_dedupe_key(kind, parish_id, mass_date), 10 * 86400, "1")
    except Exception as exc:
        logger.warning("Reminder dedupe store failed: %s", exc)


def _list_approved_parishes() -> list[dict[str, Any]]:
    if not supabase_enabled():
        return []
    from services.supabase_client import get_service_client

    client = get_service_client()
    try:
        result = (
            client.table("parishes")
            .select("id, community_name, membership_status")
            .eq("membership_status", "approved")
            .execute()
        )
        return [r for r in (result.data or []) if isinstance(r, dict) and r.get("id")]
    except Exception as exc:
        logger.warning("list approved parishes failed: %s", exc)
        return []


def _president_profile(parish_id: str) -> Optional[dict[str, Any]]:
    from services.parish_store import get_president_user_id
    from services.supabase_client import get_service_client

    uid = get_president_user_id(parish_id)
    if not uid:
        # Fall back to any active member.
        from services.parish_store import list_active_members

        members = list_active_members(parish_id)
        if not members:
            return None
        uid = str(members[0].get("user_id") or "")
    if not uid:
        return None
    try:
        client = get_service_client()
        result = (
            client.table("profiles")
            .select("id, email, first_name, last_name")
            .eq("id", uid)
            .limit(1)
            .execute()
        )
        rows = result.data or []
        return rows[0] if rows else None
    except Exception as exc:
        logger.warning("president profile lookup failed: %s", exc)
        return None


def _parish_member_ids(parish_id: str) -> list[str]:
    from services.parish_store import list_active_members

    return [
        str(m.get("user_id") or "").strip()
        for m in list_active_members(parish_id)
        if str(m.get("user_id") or "").strip()
    ]


def _has_generation_for_date(parish_id: str, mass_date: str) -> bool:
    from services.supabase_client import get_service_client

    uids = _parish_member_ids(parish_id)
    if not uids:
        return False
    try:
        client = get_service_client()
        result = (
            client.table("generation_history")
            .select("id")
            .eq("mass_date", mass_date)
            .in_("user_id", uids)
            .limit(1)
            .execute()
        )
        return bool(result.data)
    except Exception as exc:
        logger.warning("generation_history check failed: %s", exc)
        return False


def _has_active_practice_share(parish_id: str, mass_date: str) -> bool:
    from services.supabase_client import get_service_client

    now = datetime.now(timezone.utc).isoformat()
    try:
        client = get_service_client()
        result = (
            client.table("choir_practice_shares")
            .select("token, expires_at, revoked_at")
            .eq("parish_id", parish_id)
            .eq("mass_date", mass_date)
            .is_("revoked_at", "null")
            .gt("expires_at", now)
            .limit(1)
            .execute()
        )
        return bool(result.data)
    except Exception as exc:
        # Table may be missing locally — treat as no share.
        logger.warning("practice share check failed: %s", exc)
        return False


def _mass_title_hint(mass_date: str) -> str:
    try:
        from services.lectionary_store import get_cached

        data = get_cached(mass_date)
        if isinstance(data, dict):
            return str(
                data.get("title")
                or data.get("celebration")
                or data.get("liturgical_day")
                or data.get("name")
                or ""
            ).strip()
    except Exception:
        pass
    return ""


def run_weekly_reminders(
    *,
    kind: ReminderKind = "auto",
    mass_date: Optional[str] = None,
    dry_run: bool = False,
) -> dict[str, Any]:
    """Send weekly reminders to approved parish presidents (one email per parish)."""
    resolved = _resolve_kind(kind)
    sunday = date.fromisoformat(mass_date) if mass_date else upcoming_sunday()
    sunday_iso = sunday.isoformat()

    summary: dict[str, Any] = {
        "ok": True,
        "kind": resolved,
        "requested_kind": kind,
        "mass_date": sunday_iso,
        "email_configured": email_enabled(),
        "reminders_enabled": reminders_enabled(),
        "dry_run": dry_run,
        "skipped_weekday": resolved is None,
        "sent": 0,
        "skipped": 0,
        "failed": 0,
        "details": [],
    }

    if resolved is None:
        summary["ok"] = True
        summary["message"] = "No reminder scheduled for this weekday (auto mode)."
        return summary

    if not reminders_enabled():
        summary["ok"] = False
        summary["message"] = "EMAIL_REMINDERS_ENABLED is off."
        return summary

    if not email_enabled() and not dry_run:
        summary["ok"] = False
        summary["message"] = "Email provider not configured (BREVO_API_KEY / SMTP / RESEND)."
        return summary

    if not supabase_enabled():
        summary["ok"] = False
        summary["message"] = "Supabase required for reminder recipients."
        return summary

    title = _mass_title_hint(sunday_iso)
    parishes = _list_approved_parishes()
    summary["parishes"] = len(parishes)

    for parish in parishes:
        pid = str(parish.get("id") or "")
        community = str(parish.get("community_name") or "").strip()
        detail: dict[str, Any] = {
            "parish_id": pid,
            "community_name": community,
            "kind": resolved,
        }

        if _already_sent(resolved, pid, sunday_iso):
            detail["status"] = "deduped"
            summary["skipped"] += 1
            summary["details"].append(detail)
            continue

        if resolved == "mass_pptx" and _has_generation_for_date(pid, sunday_iso):
            detail["status"] = "already_generated"
            summary["skipped"] += 1
            summary["details"].append(detail)
            continue

        if resolved == "practice_share" and _has_active_practice_share(pid, sunday_iso):
            detail["status"] = "already_shared"
            summary["skipped"] += 1
            summary["details"].append(detail)
            continue

        profile = _president_profile(pid)
        email = ((profile or {}).get("email") or "").strip().lower()
        if not email:
            detail["status"] = "no_email"
            summary["skipped"] += 1
            summary["details"].append(detail)
            continue

        first_name = str((profile or {}).get("first_name") or "").strip()
        detail["email"] = email

        if dry_run:
            detail["status"] = "dry_run"
            summary["sent"] += 1
            summary["details"].append(detail)
            continue

        if resolved == "mass_pptx":
            result = safe_send(
                "mass_pptx_reminder",
                notify_mass_pptx_reminder,
                email=email,
                first_name=first_name,
                community_name=community,
                mass_date=sunday_iso,
                mass_title=title,
            )
        else:
            result = safe_send(
                "practice_share_reminder",
                notify_practice_share_reminder,
                email=email,
                first_name=first_name,
                community_name=community,
                mass_date=sunday_iso,
                mass_title=title,
            )

        if result.ok:
            _mark_sent(resolved, pid, sunday_iso)
            detail["status"] = "sent"
            detail["provider"] = result.provider
            summary["sent"] += 1
        else:
            detail["status"] = "failed"
            detail["error"] = result.error
            summary["failed"] += 1
        summary["details"].append(detail)

    return summary
