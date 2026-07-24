"""Transactional email via Brevo API, Resend, or SMTP (Brevo SMTP compatible)."""

from __future__ import annotations

import json
import logging
import os
import smtplib
import ssl
import urllib.error
import urllib.request
from dataclasses import dataclass
from email.message import EmailMessage
from email.utils import formataddr, parseaddr
from typing import Any, Optional

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class EmailResult:
    ok: bool
    provider: str = ""
    error: str = ""


def email_enabled() -> bool:
    return bool(
        os.environ.get("BREVO_API_KEY", "").strip()
        or os.environ.get("RESEND_API_KEY", "").strip()
        or (
            os.environ.get("SMTP_HOST", "").strip()
            and os.environ.get("SMTP_USER", "").strip()
            and os.environ.get("SMTP_PASSWORD", "").strip()
        )
    )


def default_from_address() -> str:
    return (
        os.environ.get("EMAIL_FROM", "").strip()
        or os.environ.get("BREVO_FROM", "").strip()
        or os.environ.get("RESEND_FROM", "").strip()
        or os.environ.get("SMTP_FROM", "").strip()
        or os.environ.get("ACCESS_REQUEST_FROM", "").strip()
        or "LiturgyFlow <noreply@liturgyflow.com>"
    )


def _split_from(raw: str) -> tuple[str, str]:
    name, addr = parseaddr(raw or "")
    addr = (addr or "").strip()
    name = (name or "").strip()
    if not addr and "@" in (raw or ""):
        addr = raw.strip()
    return name or "LiturgyFlow", addr


def _cta_button(label: str, url: str) -> str:
    safe_label = (
        (label or "Open LiturgyFlow")
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
    )
    safe_url = (url or "").replace('"', "%22")
    return (
        f'<p style="margin:28px 0 8px;">'
        f'<a href="{safe_url}" style="display:inline-block;padding:12px 22px;'
        f"background:#c45c26;color:#ffffff;text-decoration:none;border-radius:8px;"
        f'font-weight:600;font-family:Georgia,serif;font-size:15px;">'
        f"{safe_label}</a></p>"
        f'<p style="margin:0;font-size:12px;color:#6b6560;word-break:break-all;">'
        f'Or open: <a href="{safe_url}" style="color:#6b6560;">{safe_url}</a></p>'
    )


def wrap_html(
    *,
    title: str,
    body_html: str,
    cta_label: str = "",
    cta_url: str = "",
    footer_note: str = "",
) -> str:
    cta = _cta_button(cta_label, cta_url) if cta_label and cta_url else ""
    foot = (
        f'<p style="margin:24px 0 0;font-size:12px;color:#8a847c;">{footer_note}</p>'
        if footer_note
        else ""
    )
    safe_title = (
        (title or "LiturgyFlow")
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
    )
    return f"""<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{safe_title}</title></head>
<body style="margin:0;padding:0;background:#f3f1ee;font-family:Georgia,'Times New Roman',serif;color:#1c1917;">
  <div style="max-width:560px;margin:0 auto;padding:32px 16px;">
    <div style="background:#ffffff;border-radius:12px;padding:28px 24px;border:1px solid #e8e4de;">
      <p style="margin:0 0 4px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#c45c26;font-weight:700;">LiturgyFlow</p>
      <h1 style="margin:0 0 16px;font-size:22px;line-height:1.25;font-weight:700;">{safe_title}</h1>
      <div style="font-size:15px;line-height:1.55;color:#3f3a36;">{body_html}</div>
      {cta}
      {foot}
    </div>
    <p style="margin:16px 8px 0;font-size:11px;color:#9a948c;text-align:center;">
      Sent by LiturgyFlow · Catholic Mass media for parishes
    </p>
  </div>
</body>
</html>"""


def send_email(
    *,
    to: str,
    subject: str,
    text: str,
    html: str = "",
    reply_to: str = "",
    from_addr: str = "",
) -> EmailResult:
    dest = (to or "").strip().lower()
    if not dest or "@" not in dest:
        return EmailResult(ok=False, error="invalid recipient")
    subj = (subject or "").strip() or "LiturgyFlow"
    body_text = (text or "").strip() or subj
    body_html = (html or "").strip()
    sender = (from_addr or "").strip() or default_from_address()
    reply = (reply_to or "").strip()

    brevo = _send_via_brevo(
        to=dest, subject=subj, text=body_text, html=body_html, reply_to=reply, from_addr=sender
    )
    if brevo.ok or brevo.provider == "brevo":
        return brevo

    resend = _send_via_resend(
        to=dest, subject=subj, text=body_text, html=body_html, reply_to=reply, from_addr=sender
    )
    if resend.ok or resend.provider == "resend":
        return resend

    smtp = _send_via_smtp(
        to=dest, subject=subj, text=body_text, html=body_html, reply_to=reply, from_addr=sender
    )
    if smtp.ok:
        return smtp

    if not email_enabled():
        return EmailResult(ok=False, error="email not configured")
    return smtp if smtp.error else resend if resend.error else brevo


def _send_via_brevo(
    *,
    to: str,
    subject: str,
    text: str,
    html: str,
    reply_to: str,
    from_addr: str,
) -> EmailResult:
    api_key = os.environ.get("BREVO_API_KEY", "").strip()
    if not api_key:
        return EmailResult(ok=False, error="BREVO_API_KEY unset")
    name, email = _split_from(from_addr)
    if not email:
        return EmailResult(ok=False, provider="brevo", error="invalid from address")
    payload: dict[str, Any] = {
        "sender": {"name": name, "email": email},
        "to": [{"email": to}],
        "subject": subject,
        "textContent": text,
    }
    if html:
        payload["htmlContent"] = html
    if reply_to and "@" in reply_to:
        payload["replyTo"] = {"email": reply_to}
    req = urllib.request.Request(
        "https://api.brevo.com/v3/smtp/email",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "api-key": api_key,
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            ok = 200 <= getattr(resp, "status", 200) < 300
            return EmailResult(ok=ok, provider="brevo", error="" if ok else f"status {resp.status}")
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")[:400]
        logger.warning("Brevo email failed: %s %s", exc.code, detail)
        return EmailResult(ok=False, provider="brevo", error=f"{exc.code} {detail}")
    except Exception as exc:
        logger.warning("Brevo email failed: %s", exc)
        return EmailResult(ok=False, provider="brevo", error=str(exc))


def _send_via_resend(
    *,
    to: str,
    subject: str,
    text: str,
    html: str,
    reply_to: str,
    from_addr: str,
) -> EmailResult:
    api_key = os.environ.get("RESEND_API_KEY", "").strip()
    if not api_key:
        return EmailResult(ok=False, error="RESEND_API_KEY unset")
    payload: dict[str, Any] = {
        "from": from_addr,
        "to": [to],
        "subject": subject,
        "text": text,
    }
    if html:
        payload["html"] = html
    if reply_to:
        payload["reply_to"] = reply_to
    req = urllib.request.Request(
        "https://api.resend.com/emails",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            ok = 200 <= getattr(resp, "status", 200) < 300
            return EmailResult(ok=ok, provider="resend", error="" if ok else f"status {resp.status}")
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")[:400]
        logger.warning("Resend email failed: %s %s", exc.code, detail)
        return EmailResult(ok=False, provider="resend", error=f"{exc.code} {detail}")
    except Exception as exc:
        logger.warning("Resend email failed: %s", exc)
        return EmailResult(ok=False, provider="resend", error=str(exc))


def _send_via_smtp(
    *,
    to: str,
    subject: str,
    text: str,
    html: str,
    reply_to: str,
    from_addr: str,
) -> EmailResult:
    host = os.environ.get("SMTP_HOST", "").strip()
    user = os.environ.get("SMTP_USER", "").strip()
    password = os.environ.get("SMTP_PASSWORD", "").strip()
    if not host or not user or not password:
        return EmailResult(ok=False, error="SMTP_* unset")
    try:
        port = int(os.environ.get("SMTP_PORT", "587").strip() or "587")
    except ValueError:
        port = 587
    msg = EmailMessage()
    msg["Subject"] = subject
    name, email = _split_from(from_addr or user)
    msg["From"] = formataddr((name, email or user))
    msg["To"] = to
    if reply_to:
        msg["Reply-To"] = reply_to
    msg.set_content(text)
    if html:
        msg.add_alternative(html, subtype="html")
    try:
        context = ssl.create_default_context()
        with smtplib.SMTP(host, port, timeout=20) as smtp:
            smtp.starttls(context=context)
            smtp.login(user, password)
            smtp.send_message(msg)
        return EmailResult(ok=True, provider="smtp")
    except Exception as exc:
        logger.warning("SMTP email failed: %s", exc)
        return EmailResult(ok=False, provider="smtp", error=str(exc))


def reminders_enabled() -> bool:
    raw = (os.environ.get("EMAIL_REMINDERS_ENABLED", "1") or "1").strip().lower()
    return raw not in {"0", "false", "no", "off"}
