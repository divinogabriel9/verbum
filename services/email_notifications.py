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
    practice_lyrics_handoff_cta_url,
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


def notify_contact_admin(
    *,
    name: str,
    email: str,
    topic_label: str,
    message: str,
    client_ip: str,
    to_addr: str,
) -> EmailResult:
    body_text = "\n".join(
        [
            "New LiturgyFlow contact message",
            f"Name: {name}",
            f"Email: {email}",
            f"Topic: {topic_label}",
            f"Message: {message}",
        ]
    )
    rows = [
        ("Name", _esc(name)),
        (
            "Email",
            f'<a href="mailto:{_esc(email)}" style="color:#a10f0d;text-decoration:none;">{_esc(email)}</a>',
        ),
        ("Topic", _esc(topic_label)),
        ("Message", _esc(message)),
    ]
    return send_email(
        to=to_addr,
        subject=f"Contact — {topic_label} — {name}",
        text=body_text,
        html=wrap_html(
            title="New contact message",
            subtitle="Reply to this email to reach the sender.",
            body_html=detail_rows(rows),
            preheader=f"{name} · {topic_label}",
        ),
        reply_to=email,
    )


def notify_contact_user(*, name: str, email: str, topic_label: str) -> EmailResult:
    text = (
        f"We received your message about “{topic_label}”.\n"
        "We’ll reply by email.\n"
    )
    return send_email(
        to=email,
        subject="We received your message",
        text=text,
        html=wrap_html(
            title="Message received",
            subtitle="We’ll reply by email.",
            cta_label="Open LiturgyFlow",
            cta_url=home_cta_url(),
            preheader="Contact message received",
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
            helper="Secure link · Expires Sunday at 11:59 PM (UTC)",
            preheader=f"Share lyrics · {mass_date}",
        ),
    )


def notify_practice_leader_password(
    *,
    email: str,
    first_name: str = "",
    mass_date: str,
    mass_title: str = "",
    parish_name: str = "",
    leader_pin: str,
    practice_url: str = "",
) -> EmailResult:
    """Email the auto-generated leader password to the share creator only."""
    title = (mass_title or "").strip()
    date_label = _format_mass_date(mass_date)
    pin = "".join(ch for ch in str(leader_pin or "") if ch.isdigit())
    greeting = (first_name or "").strip()
    url = (practice_url or "").strip()
    rows = [
        ("Leader password", f'<span style="font-family:ui-monospace,Menlo,Consolas,monospace;letter-spacing:0.18em;font-weight:700;">{_esc(pin)}</span>'),
    ]
    if (parish_name or "").strip():
        rows.insert(0, ("Parish", _esc(parish_name.strip())))
    text_bits = [
        f"Hi {greeting}," if greeting else "Hello,",
        "",
        f"Your choir practice leader password for {date_label}:",
        pin,
        "",
        "Keep this private. Use it when you open the choir practice link to edit lyrics.",
        "Share only the choir PIN with choir members — not this leader password.",
        "",
    ]
    if url:
        text_bits.extend([f"Practice link: {url}", ""])
    return send_email(
        to=email,
        subject=f"Your practice leader password ({mass_date})",
        text="\n".join(text_bits),
        html=wrap_html(
            title="Your leader password",
            subtitle="Keep this private. Use it to edit lyrics from the shared choir practice link.",
            event_date=date_label,
            event_title=title,
            body_html=detail_rows(rows),
            cta_label="Open practice link" if url else "",
            cta_url=url if url else "",
            helper="Do not share this password with the choir. They use the choir PIN you created.",
            preheader=f"Leader password · {mass_date}",
        ),
    )


def notify_practice_lyrics_handoff(
    *,
    email: str,
    first_name: str = "",
    mass_date: str,
    mass_title: str = "",
    parish_name: str = "",
    sender_label: str = "",
    song_count: int = 0,
    handoff: str,
) -> EmailResult:
    """Choir leader → parish member: apply practice lyric order to this Mass PPTX."""
    title = (mass_title or "").strip()
    cta = practice_lyrics_handoff_cta_url(mass_date=mass_date, handoff=handoff)
    date_label = _format_mass_date(mass_date)
    who = (sender_label or "Your choir leader").strip() or "Your choir leader"
    count = max(0, int(song_count or 0))
    count_label = f"{count} song{'s' if count != 1 else ''}"
    parish = (parish_name or "").strip()
    rows = [
        ("From", _esc(who)),
        ("Songs", _esc(count_label)),
    ]
    if parish:
        rows.insert(0, ("Parish", _esc(parish)))
    greeting = (first_name or "").strip()
    text_bits = [
        f"Hi {greeting}," if greeting else "Hello,",
        "",
        f"{who} sent the choir practice lyric order for {date_label}.",
        "Open LiturgyFlow to use it for this Mass only, then generate the PowerPoint.",
        "",
        cta,
        "",
    ]
    return send_email(
        to=email,
        subject=f"Practice lyrics for Mass PPTX ({mass_date})",
        text="\n".join(text_bits),
        html=wrap_html(
            title="Practice lyrics for Mass",
            subtitle="Use the choir’s lyric order for this Mass only, then generate the PowerPoint.",
            event_date=date_label,
            event_title=title,
            body_html=detail_rows(rows),
            cta_label="Open Mass Builder",
            cta_url=cta,
            helper="Applies to this Mass only — does not change your song library.",
            preheader=f"Practice lyrics · {mass_date}",
        ),
    )


def notify_readings_critical_sundays(
    *,
    critical_sundays: list[str],
    warning_sundays: list[str] | None = None,
    attempts: int = 3,
    scope: str = "missing",
) -> dict[str, Any]:
    """Email every SUPERADMIN_EMAILS address about Sundays still critical after autofetch."""
    from services.email import app_home_url
    from services.email_links import sign_in_redirect_url
    from services.membership_config import superadmin_emails

    critical = [str(d).strip() for d in (critical_sundays or []) if str(d).strip()]
    warnings = [str(d).strip() for d in (warning_sundays or []) if str(d).strip()]
    recipients = sorted(superadmin_emails())
    if not critical:
        return {"ok": True, "sent": 0, "skipped": "no critical Sundays", "recipients": recipients}
    if not recipients:
        return {"ok": False, "sent": 0, "error": "SUPERADMIN_EMAILS is empty", "recipients": []}
    if not email_enabled():
        return {
            "ok": False,
            "sent": 0,
            "error": "email not configured",
            "recipients": recipients,
            "critical_sundays": critical,
        }

    crit_lines = "\n".join(f"  • {d}" for d in critical)
    warn_block = ""
    if warnings:
        warn_block = "\nAlso warning (incomplete):\n" + "\n".join(f"  • {d}" for d in warnings)

    cta = sign_in_redirect_url("/calendar")
    subject = f"Critical readings missing — {len(critical)} Sunday(s)"
    text = (
        "LiturgyFlow readings autofetch finished with critical Sundays still missing.\n\n"
        f"Attempts: {attempts}\n"
        f"Scope: {scope}\n\n"
        f"Critical Sundays:\n{crit_lines}\n"
        f"{warn_block}\n\n"
        f"Open calendar (superadmin): {cta}\n"
        f"App: {app_home_url()}\n"
    )
    rows = [
        ("Critical Sundays", _esc(", ".join(critical))),
        ("Attempts", _esc(str(attempts))),
        ("Scope", _esc(scope)),
    ]
    if warnings:
        rows.append(("Warning Sundays", _esc(", ".join(warnings))))

    sent = 0
    errors: list[str] = []
    for to_addr in recipients:
        result = send_email(
            to=to_addr,
            subject=subject,
            text=text,
            html=wrap_html(
                title="Critical Sunday readings missing",
                subtitle="Autofetch could not complete these Mass dates. Review the calendar and fetch or paste manually.",
                body_html=detail_rows(rows),
                cta_label="Open calendar",
                cta_url=cta,
                preheader=f"{len(critical)} critical Sunday(s)",
            ),
        )
        if result.ok:
            sent += 1
        else:
            errors.append(f"{to_addr}: {result.error or result.provider}")
            logger.warning("readings critical alert failed for %s: %s", to_addr, result.error)

    return {
        "ok": sent > 0,
        "sent": sent,
        "recipients": recipients,
        "critical_sundays": critical,
        "warning_sundays": warnings,
        "errors": errors,
    }


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
