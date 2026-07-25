"""High-level transactional email senders for LiturgyFlow."""

from __future__ import annotations

import logging
from datetime import date
from typing import Any

from services.email import EmailResult, detail_rows, email_enabled, send_email, wrap_html
from services.email_links import (
    home_cta_url,
    invite_signup_url,
    mass_pptx_cta_url,
    practice_share_cta_url,
)

logger = logging.getLogger(__name__)


def _esc(text: str) -> str:
    return (
        (text or "")
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )


def _format_mass_date(mass_date: str) -> str:
    raw = (mass_date or "").strip()
    try:
        d = date.fromisoformat(raw)
    except ValueError:
        return raw
    # Avoid %-d (POSIX-only); strip leading zero from day.
    return d.strftime("%A, %B %d").replace(" 0", " ")


def notify_access_request_admin(
    *,
    name: str,
    email: str,
    parish: str,
    message: str,
    client_ip: str,
    to_addr: str,
) -> EmailResult:
    body_text = "\n".join(
        [
            "New LiturgyFlow access request",
            f"Name: {name}",
            f"Email: {email}",
            f"Parish: {parish}",
            f"Message: {message or '(none)'}",
        ]
    )
    rows = [
        ("Name", _esc(name)),
        (
            "Email",
            f'<a href="mailto:{_esc(email)}" style="color:#a10f0d;text-decoration:none;">{_esc(email)}</a>',
        ),
        ("Parish", _esc(parish)),
    ]
    if (message or "").strip():
        rows.append(("Message", _esc(message.strip())))
    return send_email(
        to=to_addr,
        subject=f"Access request — {name}",
        text=body_text,
        html=wrap_html(
            title="New access request",
            subtitle="Review and send an invite if approved.",
            body_html=detail_rows(rows),
            preheader=f"{name} · {parish}",
        ),
        reply_to=email,
    )


def notify_access_request_user(*, name: str, email: str, parish: str) -> EmailResult:
    text = (
        f"We received your LiturgyFlow access request for {parish}.\n"
        "We’ll email you if you’re approved.\n"
    )
    return send_email(
        to=email,
        subject="We received your access request",
        text=text,
        html=wrap_html(
            title="Request received",
            subtitle="We’ll email you if you’re approved.",
            cta_label="Open LiturgyFlow",
            cta_url=home_cta_url(),
            preheader="Access request received",
        ),
    )


def notify_membership_approved(
    *,
    email: str,
    first_name: str = "",
    community_name: str = "",
) -> EmailResult:
    parish = (community_name or "").strip() or "your parish"
    return send_email(
        to=email,
        subject="You're approved — LiturgyFlow is ready",
        text=f"{parish} is approved. Generate this week’s Mass PowerPoint when you’re ready.\n",
        html=wrap_html(
            title="You’re approved",
            subtitle=f"{parish} can use LiturgyFlow fully now.",
            cta_label="Create Mass PPTX",
            cta_url=mass_pptx_cta_url(),
            preheader=f"{parish} is ready",
        ),
    )


def notify_membership_rejected(
    *,
    email: str,
    first_name: str = "",
    community_name: str = "",
) -> EmailResult:
    parish = (community_name or "").strip() or "your parish"
    return send_email(
        to=email,
        subject="LiturgyFlow membership update",
        text=f"We couldn’t approve {parish} for LiturgyFlow at this time.\n",
        html=wrap_html(
            title="Membership update",
            subtitle=f"We couldn’t approve {parish} at this time.",
            cta_label="Open LiturgyFlow",
            cta_url=home_cta_url(),
            preheader="Membership update",
        ),
    )


def notify_platform_invite(
    *,
    email: str,
    invite_url: str,
    community_name: str = "",
    invite_role: str = "president",
    note: str = "",
) -> EmailResult:
    parish = (community_name or "").strip() or "a parish"
    role = (invite_role or "president").strip().lower()
    role_label = "media teammate" if role == "media" else "parish lead"
    url = (invite_url or "").strip() or invite_signup_url("")
    helper = (note or "").strip()[:160]
    return send_email(
        to=email,
        subject=f"You're invited to LiturgyFlow — {parish}",
        text=f"You're invited as a {role_label} for {parish}.\n{url}\n",
        html=wrap_html(
            title="You’re invited",
            subtitle=f"Join {parish} as a {role_label}.",
            cta_label="Accept invite",
            cta_url=url,
            helper=helper,
            preheader=f"Join {parish}",
        ),
    )


def notify_mass_pptx_reminder(
    *,
    email: str,
    first_name: str = "",
    community_name: str = "",
    mass_date: str,
    mass_title: str = "",
) -> EmailResult:
    title = (mass_title or "").strip()
    cta = mass_pptx_cta_url(mass_date=mass_date)
    date_label = _format_mass_date(mass_date)
    return send_email(
        to=email,
        subject=f"Sunday Mass slides ({mass_date})",
        text=f"Generate this week’s Mass PowerPoint for {date_label}.\n{cta}\n",
        html=wrap_html(
            title="Sunday Mass slides",
            subtitle="Generate this week’s Mass PowerPoint.",
            event_date=date_label,
            event_title=title,
            cta_label="Create Mass PPTX",
            cta_url=cta,
            preheader=f"Mass slides · {mass_date}",
        ),
    )


def notify_practice_share_reminder(
    *,
    email: str,
    first_name: str = "",
    community_name: str = "",
    mass_date: str,
    mass_title: str = "",
) -> EmailResult:
    title = (mass_title or "").strip()
    cta = practice_share_cta_url(mass_date=mass_date)
    date_label = _format_mass_date(mass_date)
    return send_email(
        to=email,
        subject=f"Choir practice lyrics ({mass_date})",
        text=f"Share this week’s practice lyrics with your choir.\n{cta}\n",
        html=wrap_html(
            title="Choir Practice Lyrics",
            subtitle="Share this week’s practice lyrics with your choir.",
            event_date=date_label,
            event_title=title,
            cta_label="Share Lyrics",
            cta_url=cta,
            helper="Secure link · Expires in 24 hours",
            preheader=f"Share lyrics · {mass_date}",
        ),
    )


def safe_send(label: str, fn, **kwargs: Any) -> EmailResult:
    """Call a notify_* helper; never raise to callers."""
    if not email_enabled():
        logger.info("Skip email %s — not configured", label)
        return EmailResult(ok=False, error="email not configured")
    try:
        result = fn(**kwargs)
        if not result.ok:
            logger.warning("Email %s failed: %s %s", label, result.provider, result.error)
        return result
    except Exception as exc:
        logger.warning("Email %s raised: %s", label, exc)
        return EmailResult(ok=False, error=str(exc))
