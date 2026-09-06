"""Operator alerts: email (Brevo) + Telegram for new registrations and submissions."""

from __future__ import annotations

import logging
import os
from dataclasses import dataclass, field
from typing import Any, Optional

from services.email import EmailResult, app_home_url, detail_rows, email_enabled, send_email, wrap_html
from services.telegram_notify import (
    format_alert_html,
    send_telegram_message,
    telegram_config_status,
    telegram_enabled,
)

logger = logging.getLogger(__name__)


@dataclass
class AdminAlertResult:
    ok: bool
    email_ok: bool = False
    telegram_ok: bool = False
    email_errors: list[str] = field(default_factory=list)
    telegram_error: str = ""
    recipients: list[str] = field(default_factory=list)


def alerts_enabled() -> bool:
    flag = (os.environ.get("ADMIN_ALERTS_ENABLED") or "1").strip().lower()
    if flag in {"0", "false", "no", "off"}:
        return False
    return email_enabled() or telegram_enabled()


def alert_inbox() -> list[str]:
    """Who receives admin alert emails."""
    custom = (os.environ.get("ALERT_EMAILS") or "").strip()
    if custom:
        return [e.strip().lower() for e in custom.split(",") if e.strip()]
    try:
        from services.membership_config import superadmin_emails

        emails = sorted(superadmin_emails())
        if emails:
            return emails
    except Exception:
        raw = (os.environ.get("SUPERADMIN_EMAILS") or "").strip()
        if raw:
            return [e.strip().lower() for e in raw.split(",") if e.strip()]
    fallback = (
        (os.environ.get("ACCESS_REQUEST_TO") or "").strip()
        or (os.environ.get("INVITE_CONTACT_EMAIL") or "").strip()
    )
    return [fallback.lower()] if fallback else []


def admin_deep_link() -> str:
    base = app_home_url().rstrip("/")
    return f"{base}/superadmin"


def admin_alerts_status() -> dict[str, Any]:
    return {
        "alerts_enabled": alerts_enabled(),
        "email_enabled": email_enabled(),
        "email_recipients": alert_inbox(),
        **telegram_config_status(),
    }


def _esc(text: str) -> str:
    return (
        (text or "")
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )


def _send_alert_emails(
    *,
    title: str,
    subtitle: str,
    lines: list[str],
    cta_url: str,
    preheader: str,
) -> tuple[bool, list[str], list[str]]:
    recipients = alert_inbox()
    if not recipients:
        return False, [], ["no alert email recipients"]
    if not email_enabled():
        return False, recipients, ["email not configured"]

    rows = [("Detail", _esc(line)) for line in lines if (line or "").strip()]
    body = detail_rows(rows) if rows else ""
    errors: list[str] = []
    any_ok = False
    for to_addr in recipients:
        result: EmailResult = send_email(
            to=to_addr,
            subject=f"LiturgyFlow · {title}",
            text="\n".join(
                [
                    f"LiturgyFlow · {title}",
                    subtitle,
                    *lines,
                    cta_url,
                ]
            ),
            html=wrap_html(
                title=title,
                subtitle=subtitle,
                body_html=body,
                cta_label="Open Superadmin",
                cta_url=cta_url,
                preheader=preheader or title,
            ),
        )
        if result.ok:
            any_ok = True
        else:
            errors.append(f"{to_addr}: {result.error or 'send failed'}")
    return any_ok, recipients, errors


def emit_admin_alert(
    *,
    kind: str,
    title: str,
    subtitle: str = "",
    lines: Optional[list[str]] = None,
    send_email_alert: bool = True,
    send_telegram_alert: bool = True,
) -> AdminAlertResult:
    """Fan out an operator alert. Never raises."""
    if not alerts_enabled():
        logger.info("Skip admin alert %s — alerts disabled/unconfigured", kind)
        return AdminAlertResult(ok=False, telegram_error="alerts disabled")

    detail_lines = [str(x).strip() for x in (lines or []) if str(x).strip()]
    cta = admin_deep_link()
    result = AdminAlertResult(ok=False)

    if send_email_alert:
        email_ok, recipients, errors = _send_alert_emails(
            title=title,
            subtitle=subtitle,
            lines=detail_lines,
            cta_url=cta,
            preheader=f"{title} · {subtitle}".strip(" ·"),
        )
        result.email_ok = email_ok
        result.recipients = recipients
        result.email_errors = errors
        if errors:
            logger.warning("Admin alert email %s issues: %s", kind, "; ".join(errors))

    if send_telegram_alert and telegram_enabled():
        text = format_alert_html(
            title=title,
            subtitle=subtitle,
            lines=detail_lines,
            url=cta,
            url_label="Open Superadmin",
        )
        tg = send_telegram_message(text)
        result.telegram_ok = tg.ok
        result.telegram_error = tg.error
        if not tg.ok:
            logger.warning("Admin alert telegram %s failed: %s", kind, tg.error)
    elif send_telegram_alert and not telegram_enabled():
        result.telegram_error = "telegram not configured"

    result.ok = result.email_ok or result.telegram_ok
    if result.ok:
        logger.info(
            "Admin alert %s sent email=%s telegram=%s",
            kind,
            int(result.email_ok),
            int(result.telegram_ok),
        )
    else:
        logger.warning(
            "Admin alert %s not delivered email_err=%s tg_err=%s",
            kind,
            result.email_errors,
            result.telegram_error,
        )
    return result


def safe_emit_admin_alert(kind: str, **kwargs: Any) -> AdminAlertResult:
    try:
        return emit_admin_alert(kind=kind, **kwargs)
    except Exception as exc:
        logger.warning("Admin alert %s raised: %s", kind, exc)
        return AdminAlertResult(ok=False, telegram_error=str(exc))


# ── Convenience helpers for call sites ──────────────────────────────────────


def alert_registration(
    *,
    name: str,
    email: str,
    parish: str,
    role: str = "",
) -> AdminAlertResult:
    lines = [
        f"Name: {name}" if name else "",
        f"Email: {email}" if email else "",
        f"Parish: {parish}" if parish else "",
        f"Role: {role}" if role else "",
    ]
    return safe_emit_admin_alert(
        "registration",
        title="New registration",
        subtitle="A parish signup is awaiting approval.",
        lines=lines,
    )


def alert_song_submission(
    *,
    title: str,
    submitted_by: str,
    language: str = "",
    similar_count: int = 0,
) -> AdminAlertResult:
    lines = [
        f"Song: {title}" if title else "",
        f"From: {submitted_by}" if submitted_by else "",
        f"Language: {language}" if language else "",
    ]
    if similar_count:
        lines.append(f"Similar catalog titles: {similar_count}")
    return safe_emit_admin_alert(
        "song_submission",
        title="Song submission",
        subtitle="New song awaiting catalog approval.",
        lines=lines,
    )


def alert_priest_submission(*, name: str, submitted_by: str) -> AdminAlertResult:
    return safe_emit_admin_alert(
        "priest_submission",
        title="Priest name submission",
        subtitle="New priest name awaiting approval.",
        lines=[f"Name: {name}", f"From: {submitted_by}" if submitted_by else ""],
    )


def alert_parish_rename(
    *,
    previous_name: str,
    new_name: str,
    submitted_by: str,
) -> AdminAlertResult:
    return safe_emit_admin_alert(
        "parish_rename",
        title="Parish rename request",
        subtitle="A parish asked to change its display name.",
        lines=[
            f"From: {previous_name}" if previous_name else "",
            f"To: {new_name}" if new_name else "",
            f"Requested by: {submitted_by}" if submitted_by else "",
        ],
    )


def alert_access_request(
    *,
    name: str,
    email: str,
    parish: str,
) -> AdminAlertResult:
    """Telegram (+ optional email). Prefer telegram-only when Brevo already emailed."""
    return safe_emit_admin_alert(
        "access_request",
        title="Access request",
        subtitle="Someone requested LiturgyFlow access.",
        lines=[
            f"Name: {name}" if name else "",
            f"Email: {email}" if email else "",
            f"Parish: {parish}" if parish else "",
        ],
        send_email_alert=False,
    )


def alert_contact_message(
    *,
    name: str,
    email: str,
    topic: str,
) -> AdminAlertResult:
    return safe_emit_admin_alert(
        "contact",
        title="Contact form",
        subtitle=topic or "New contact message",
        lines=[
            f"Name: {name}" if name else "",
            f"Email: {email}" if email else "",
        ],
        send_email_alert=False,
    )
