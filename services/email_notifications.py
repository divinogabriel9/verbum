"""High-level transactional email senders for LiturgyFlow."""

from __future__ import annotations

import logging
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


def _p(html: str) -> str:
    return (
        f'<p style="margin:0 0 14px;font-size:16px;line-height:1.55;color:#15333D;">{html}</p>'
    )


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
            "New LiturgyFlow access request (landing page)",
            "",
            f"Name: {name}",
            f"Email: {email}",
            f"Parish: {parish}",
            f"Message: {message or '(none)'}",
            f"IP: {client_ip or 'unknown'}",
            "",
            "Review and send an invite if approved.",
        ]
    )
    body_html = (
        _p("Someone requested access from the landing page.")
        + detail_rows(
            [
                ("Name", _esc(name)),
                ("Email", f'<a href="mailto:{_esc(email)}" style="color:#a10f0d;text-decoration:none;">{_esc(email)}</a>'),
                ("Parish", _esc(parish)),
                ("Message", _esc(message or "—")),
                ("IP", _esc(client_ip or "unknown")),
            ]
        )
        + _p("Review in admin and send an invite if you approve them.")
    )
    return send_email(
        to=to_addr,
        subject=f"LiturgyFlow access request — {name}",
        text=body_text,
        html=wrap_html(
            title="New access request",
            body_html=body_html,
            preheader=f"{name} · {parish}",
        ),
        reply_to=email,
    )


def notify_access_request_user(*, name: str, email: str, parish: str) -> EmailResult:
    first = (name or "").strip().split(" ", 1)[0] or "there"
    cta = home_cta_url()
    text = (
        f"Hi {first},\n\n"
        f"We received your LiturgyFlow access request for {parish}.\n"
        "We'll review it and email you if you're approved — this is not an instant signup.\n\n"
        f"Open LiturgyFlow: {cta}\n"
    )
    html = wrap_html(
        title="We received your request",
        body_html=(
            _p(f"Hi {_esc(first)},")
            + _p(
                f"Thanks — we received your access request for "
                f"<strong>{_esc(parish)}</strong>."
            )
            + _p(
                "We’ll review it and follow up by email if you’re approved. "
                "This is not an instant signup."
            )
        ),
        cta_label="Open LiturgyFlow",
        cta_url=cta,
        preheader=f"Request received for {parish}",
    )
    return send_email(
        to=email,
        subject="We received your LiturgyFlow access request",
        text=text,
        html=html,
    )


def notify_membership_approved(
    *,
    email: str,
    first_name: str = "",
    community_name: str = "",
) -> EmailResult:
    first = (first_name or "").strip() or "there"
    parish = (community_name or "").strip() or "your parish"
    cta = mass_pptx_cta_url()
    text = (
        f"Hi {first},\n\n"
        f"You're approved — {parish} can use LiturgyFlow fully now.\n"
        "Generate this week's Mass PowerPoint when you're ready.\n\n"
        f"{cta}\n"
    )
    html = wrap_html(
        title="You’re approved",
        body_html=(
            _p(f"Hi {_esc(first)},")
            + _p(
                f"<strong>{_esc(parish)}</strong> is approved. "
                "You can generate Mass decks, posters, and choir practice links."
            )
            + _p("A good next step: create this Sunday’s Mass PowerPoint.")
        ),
        cta_label="Create Mass PPTX",
        cta_url=cta,
        preheader=f"{parish} is ready on LiturgyFlow",
    )
    return send_email(
        to=email,
        subject="You're approved — LiturgyFlow is ready",
        text=text,
        html=html,
    )


def notify_membership_rejected(
    *,
    email: str,
    first_name: str = "",
    community_name: str = "",
) -> EmailResult:
    first = (first_name or "").strip() or "there"
    parish = (community_name or "").strip() or "your parish"
    cta = home_cta_url()
    text = (
        f"Hi {first},\n\n"
        f"We couldn't approve {parish} for LiturgyFlow at this time.\n"
        "Reply to this email or contact your administrator if you have questions.\n\n"
        f"{cta}\n"
    )
    html = wrap_html(
        title="Membership update",
        body_html=(
            _p(f"Hi {_esc(first)},")
            + _p(
                f"We couldn’t approve <strong>{_esc(parish)}</strong> for full "
                "LiturgyFlow access at this time."
            )
            + _p("If you believe this is a mistake, reply to this email or contact your administrator.")
        ),
        cta_label="Open LiturgyFlow",
        cta_url=cta,
        preheader="Update on your LiturgyFlow request",
    )
    return send_email(
        to=email,
        subject="LiturgyFlow membership update",
        text=text,
        html=html,
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
    note_line = f"\nNote: {note.strip()}\n" if (note or "").strip() else "\n"
    text = (
        f"You're invited to LiturgyFlow as a {role_label} for {parish}.\n"
        f"{note_line}"
        f"Accept your invite:\n{url}\n"
    )
    note_html = (
        _p(f"<em style=\"color:#5C6B75;\">{_esc(note.strip())}</em>")
        if (note or "").strip()
        else ""
    )
    html = wrap_html(
        title="You’re invited",
        body_html=(
            _p(
                f"You’ve been invited to LiturgyFlow as a "
                f"<strong>{_esc(role_label)}</strong> for "
                f"<strong>{_esc(parish)}</strong>."
            )
            + note_html
            + _p("Use the button below to create your account. An invite link is required.")
        ),
        cta_label="Accept invite",
        cta_url=url,
        preheader=f"Join {parish} on LiturgyFlow",
    )
    return send_email(
        to=email,
        subject=f"You're invited to LiturgyFlow — {parish}",
        text=text,
        html=html,
    )


def notify_mass_pptx_reminder(
    *,
    email: str,
    first_name: str = "",
    community_name: str = "",
    mass_date: str,
    mass_title: str = "",
) -> EmailResult:
    first = (first_name or "").strip() or "there"
    parish = (community_name or "").strip() or "your parish"
    title = (mass_title or "").strip()
    cta = mass_pptx_cta_url(mass_date=mass_date)
    title_bit = f" ({title})" if title else ""
    text = (
        f"Hi {first},\n\n"
        f"Reminder for {parish}: Sunday Mass slides for {mass_date}{title_bit} "
        "haven't been generated yet.\n\n"
        f"Create Mass PPTX:\n{cta}\n"
    )
    when = _esc(mass_date) + (f" — {_esc(title)}" if title else "")
    html = wrap_html(
        title="Sunday Mass slides",
        body_html=(
            _p(f"Hi {_esc(first)},")
            + _p(
                f"Reminder for <strong>{_esc(parish)}</strong>: Mass slides for "
                f"<strong>{when}</strong> haven’t been generated yet."
            )
            + detail_rows([("Mass date", when), ("Parish", _esc(parish))])
        ),
        cta_label="Create Mass PPTX",
        cta_url=cta,
        footer_note="You receive this because your parish is approved on LiturgyFlow.",
        preheader=f"Still to generate · {mass_date}",
    )
    return send_email(
        to=email,
        subject=f"Sunday Mass slides — still to generate ({mass_date})",
        text=text,
        html=html,
    )


def notify_practice_share_reminder(
    *,
    email: str,
    first_name: str = "",
    community_name: str = "",
    mass_date: str,
    mass_title: str = "",
) -> EmailResult:
    first = (first_name or "").strip() or "there"
    parish = (community_name or "").strip() or "your parish"
    title = (mass_title or "").strip()
    cta = practice_share_cta_url(mass_date=mass_date)
    title_bit = f" ({title})" if title else ""
    text = (
        f"Hi {first},\n\n"
        f"Reminder for {parish}: share choir practice lyrics for {mass_date}{title_bit}.\n"
        "Create a PIN-protected link (links expire after 24 hours).\n\n"
        f"Share lyrics:\n{cta}\n"
    )
    when = _esc(mass_date) + (f" — {_esc(title)}" if title else "")
    html = wrap_html(
        title="Share choir practice lyrics",
        body_html=(
            _p(f"Hi {_esc(first)},")
            + _p(
                f"Reminder for <strong>{_esc(parish)}</strong>: share this week’s choir "
                f"practice lyrics for <strong>{when}</strong>."
            )
            + _p(
                "Create a PIN-protected link when the choir is ready to practice "
                "(links expire after 24 hours)."
            )
        ),
        cta_label="Share lyrics",
        cta_url=cta,
        footer_note="You receive this because your parish is approved on LiturgyFlow.",
        preheader=f"Share lyrics · {mass_date}",
    )
    return send_email(
        to=email,
        subject=f"Share choir practice lyrics ({mass_date})",
        text=text,
        html=html,
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
