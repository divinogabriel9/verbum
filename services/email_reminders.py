"""Weekly Mass PPTX + choir practice share reminder job."""

from __future__ import annotations

import logging
from datetime import date, timedelta
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

ReminderKind = Literal["mass_pptx", "practice_share", "auto", "both"]
Audience = Literal["presidents", "all_members"]


def upcoming_sunday(today: Optional[date] = None) -> date:
    base = today or date.today()
    # Monday=0 … Sunday=6 → days until next Sunday (0 if today is Sunday)
    days = (6 - base.weekday()) % 7
    return base + timedelta(days=days)


def _resolve_kinds(kind: ReminderKind, *, today: Optional[date] = None) -> list[str]:
    k = (kind or "auto").strip().lower()
    if k == "both":
        return ["mass_pptx", "practice_share"]
    if k in {"mass_pptx", "practice_share"}:
        return [k]
    if k != "auto":
        return []
    # UTC weekday: Wed=2 → mass PPTX; Fri=4 → practice share
    wd = (today or date.today()).weekday()
    if wd == 2:
        return ["mass_pptx"]
    if wd == 4:
        return ["practice_share"]
    return []


def _dedupe_key(kind: str, parish_id: str, mass_date: str, email: str = "") -> str:
    addr = (email or "").strip().lower()
    if addr:
        return f"verbum:email_reminder:{kind}:{parish_id}:{mass_date}:{addr}"
    return f"verbum:email_reminder:{kind}:{parish_id}:{mass_date}"


def _already_sent(kind: str, parish_id: str, mass_date: str, email: str = "") -> bool:
    client = get_redis()
    if client is None:
        return False
    try:
        return bool(client.get(_dedupe_key(kind, parish_id, mass_date, email)))
    except Exception:
        return False


def _mark_sent(kind: str, parish_id: str, mass_date: str, email: str = "") -> None:
    client = get_redis()
    if client is None:
        return
    try:
        # Keep ~10 days so we don't re-send for the same Sunday.
        client.setex(_dedupe_key(kind, parish_id, mass_date, email), 10 * 86400, "1")
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


def _profiles_by_ids(user_ids: list[str]) -> dict[str, dict[str, Any]]:
    ids = [u for u in user_ids if u]
    if not ids:
        return {}
    from services.supabase_client import get_service_client

    try:
        client = get_service_client()
        result = (
            client.table("profiles")
            .select("id, email, first_name, last_name")
            .in_("id", ids)
            .execute()
        )
        out: dict[str, dict[str, Any]] = {}
        for row in result.data or []:
            if isinstance(row, dict) and row.get("id"):
                out[str(row["id"])] = row
        return out
    except Exception as exc:
        logger.warning("profiles batch lookup failed: %s", exc)
        return {}


def _parish_member_ids(parish_id: str) -> list[str]:
    from services.parish_store import list_active_members

    return [
        str(m.get("user_id") or "").strip()
        for m in list_active_members(parish_id)
        if str(m.get("user_id") or "").strip()
    ]


def _recipient_user_ids(parish_id: str, audience: Audience) -> list[str]:
    from services.parish_store import get_president_user_id, list_active_members

    if audience == "all_members":
        return _parish_member_ids(parish_id)

    uid = get_president_user_id(parish_id)
    if uid:
        return [uid]
    members = list_active_members(parish_id)
    if not members:
        return []
    fallback = str(members[0].get("user_id") or "").strip()
    return [fallback] if fallback else []


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


def list_reminder_recipients(
    *,
    audience: Audience = "all_members",
    mass_date: Optional[str] = None,
) -> dict[str, Any]:
    """List emails that would receive Mass/practice reminders (approved parishes)."""
    sunday = date.fromisoformat(mass_date) if mass_date else upcoming_sunday()
    sunday_iso = sunday.isoformat()
    if not supabase_enabled():
        return {
            "ok": False,
            "message": "Supabase required.",
            "mass_date": sunday_iso,
            "audience": audience,
            "recipients": [],
            "count": 0,
        }

    parishes = _list_approved_parishes()
    recipients: list[dict[str, Any]] = []
    seen_emails: set[str] = set()

    for parish in parishes:
        pid = str(parish.get("id") or "")
        community = str(parish.get("community_name") or "").strip()
        uids = _recipient_user_ids(pid, audience)
        profiles = _profiles_by_ids(uids)
        for uid in uids:
            prof = profiles.get(uid) or {}
            email = str(prof.get("email") or "").strip().lower()
            if not email or email in seen_emails:
                continue
            seen_emails.add(email)
            recipients.append(
                {
                    "email": email,
                    "user_id": uid,
                    "first_name": str(prof.get("first_name") or "").strip(),
                    "last_name": str(prof.get("last_name") or "").strip(),
                    "parish_id": pid,
                    "community_name": community,
                }
            )

    recipients.sort(key=lambda r: (r.get("community_name") or "", r.get("email") or ""))
    return {
        "ok": True,
        "mass_date": sunday_iso,
        "audience": audience,
        "parishes": len(parishes),
        "count": len(recipients),
        "emails": [r["email"] for r in recipients],
        "recipients": recipients,
    }


def run_weekly_reminders(
    *,
    kind: ReminderKind = "auto",
    mass_date: Optional[str] = None,
    dry_run: bool = False,
    force: bool = True,
    audience: Audience = "all_members",
) -> dict[str, Any]:
    """Send reminders to approved parish members.

    Always emails eligible users — does **not** skip if they already generated a
    Mass deck or created a practice share. ``force=False`` only re-enables
    same-week Redis dedupe (to avoid double-sends if a job is retried).
    """
    kinds = _resolve_kinds(kind)
    sunday = date.fromisoformat(mass_date) if mass_date else upcoming_sunday()
    sunday_iso = sunday.isoformat()

    summary: dict[str, Any] = {
        "ok": True,
        "kinds": kinds,
        "requested_kind": kind,
        "mass_date": sunday_iso,
        "audience": audience,
        "email_configured": email_enabled(),
        "reminders_enabled": reminders_enabled(),
        "dry_run": dry_run,
        "force": force,
        "skipped_weekday": not kinds,
        "sent": 0,
        "skipped": 0,
        "failed": 0,
        "details": [],
    }

    if not kinds:
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

    for resolved in kinds:
        for parish in parishes:
            pid = str(parish.get("id") or "")
            community = str(parish.get("community_name") or "").strip()

            uids = _recipient_user_ids(pid, audience)
            profiles = _profiles_by_ids(uids)
            if not uids:
                summary["skipped"] += 1
                summary["details"].append(
                    {
                        "parish_id": pid,
                        "community_name": community,
                        "kind": resolved,
                        "status": "no_members",
                    }
                )
                continue

            for uid in uids:
                prof = profiles.get(uid) or {}
                email = str(prof.get("email") or "").strip().lower()
                detail: dict[str, Any] = {
                    "parish_id": pid,
                    "community_name": community,
                    "kind": resolved,
                    "user_id": uid,
                    "email": email or None,
                }
                if not email:
                    detail["status"] = "no_email"
                    summary["skipped"] += 1
                    summary["details"].append(detail)
                    continue

                # Optional same-week dedupe only when force=False (manual cautious runs).
                if not force and _already_sent(resolved, pid, sunday_iso, email):
                    detail["status"] = "deduped"
                    summary["skipped"] += 1
                    summary["details"].append(detail)
                    continue

                first_name = str(prof.get("first_name") or "").strip()

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
                    _mark_sent(resolved, pid, sunday_iso, email)
                    detail["status"] = "sent"
                    detail["provider"] = result.provider
                    summary["sent"] += 1
                else:
                    detail["status"] = "failed"
                    detail["error"] = result.error
                    summary["failed"] += 1
                summary["details"].append(detail)

    return summary
