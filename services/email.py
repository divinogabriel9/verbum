"""Transactional email via Brevo API (recommended), Resend, or SMTP.

Brevo setup order (dashboard → env → test):
  1. Generate API key          → BREVO_API_KEY=xkeysib-…
  2. Create / verify sender    → EMAIL_FROM / BREVO_FROM
  3. Authenticate domain       → DNS in Brevo (best deliverability)
  4. Connect in this project   → env vars below (+ authorised IPs if enabled)
  5. Send a test email         → python scripts/test_brevo_email.py you@…
  6. Later: contacts / campaigns (not required for LiturgyFlow notifications)

Do not use Brevo Email Campaigns for access requests, invites, or reminders.
Those use the transactional endpoint POST /v3/smtp/email.
"""

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
from typing import Any

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class EmailResult:
    ok: bool
    provider: str = ""
    error: str = ""


def _env(name: str) -> str:
    return (os.environ.get(name) or "").strip()


def email_transport() -> str:
    """auto | brevo_api | smtp | resend — default auto (API first, then SMTP)."""
    raw = (_env("EMAIL_TRANSPORT") or "auto").lower()
    if raw in {"auto", "brevo_api", "api", "smtp", "resend"}:
        return "brevo_api" if raw == "api" else raw
    return "auto"


def brevo_api_configured() -> bool:
    return bool(_env("BREVO_API_KEY"))


def smtp_configured() -> bool:
    return bool(_env("SMTP_HOST") and _env("SMTP_USER") and _env("SMTP_PASSWORD"))


def resend_configured() -> bool:
    return bool(_env("RESEND_API_KEY"))


def email_enabled() -> bool:
    transport = email_transport()
    if transport == "brevo_api":
        return brevo_api_configured()
    if transport == "smtp":
        return smtp_configured()
    if transport == "resend":
        return resend_configured()
    return brevo_api_configured() or resend_configured() or smtp_configured()


def default_from_address() -> str:
    """Resolved From header. Empty if none configured (do not invent a domain)."""
    return (
        _env("EMAIL_FROM")
        or _env("BREVO_FROM")
        or _env("RESEND_FROM")
        or _env("SMTP_FROM")
        or _env("ACCESS_REQUEST_FROM")
    )


def sender_email_only() -> str:
    _, addr = _split_from(default_from_address())
    return addr


def email_config_status() -> dict[str, Any]:
    """Safe diagnostic (no secrets) for setup check / admin status."""
    from_raw = default_from_address()
    name, addr = _split_from(from_raw)
    transport = email_transport()
    steps = [
        {
            "id": 1,
            "title": "Generate API key",
            "done": brevo_api_configured(),
            "hint": "Brevo → SMTP & API → API keys → create key (xkeysib-…). Set BREVO_API_KEY.",
        },
        {
            "id": 2,
            "title": "Create sender",
            "done": bool(addr and "@" in addr),
            "hint": "Brevo → Senders → add/verify. Set EMAIL_FROM=LiturgyFlow <that@address>.",
        },
        {
            "id": 3,
            "title": "Authenticate domain (recommended)",
            "done": None,  # cannot verify DNS from here
            "hint": "Brevo → Domains → add domain → copy DNS records. Improves inbox delivery.",
        },
        {
            "id": 4,
            "title": "Connect API in project",
            "done": email_enabled() and bool(addr),
            "hint": "Set BREVO_API_KEY + EMAIL_FROM on Render and local .env. Authorise Render IP if Brevo IP lock is on.",
        },
        {
            "id": 5,
            "title": "Send a test email",
            "done": None,
            "hint": "python scripts/test_brevo_email.py you@example.com",
        },
    ]
    return {
        "email_enabled": email_enabled(),
        "transport": transport,
        "brevo_api_configured": brevo_api_configured(),
        "smtp_configured": smtp_configured(),
        "resend_configured": resend_configured(),
        "from_configured": bool(addr),
        "from_name": name if addr else "",
        "from_email": addr,
        "smtp_host": _env("SMTP_HOST") or None,
        "setup_steps": steps,
        "reminders_enabled": reminders_enabled(),
    }


def _split_from(raw: str) -> tuple[str, str]:
    name, addr = parseaddr(raw or "")
    addr = (addr or "").strip()
    name = (name or "").strip()
    if not addr and "@" in (raw or ""):
        addr = (raw or "").strip()
    return name or "LiturgyFlow", addr


def brand_logo_url() -> str:
    """Public absolute URL for the logo shown inside HTML emails."""
    custom = _env("EMAIL_LOGO_URL")
    if custom:
        return custom
    try:
        from services.auth_config import app_public_url

        base = app_public_url()
    except Exception:
        base = ""
    if not base:
        return ""
    # Brand mark for HTML emails (square LiturgyFlow crest).
    path = _env("EMAIL_LOGO_PATH") or "/static/brand/email-logo.png"
    if not path.startswith("/"):
        path = "/" + path
    return f"{base.rstrip('/')}{path}"


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
    logo = brand_logo_url()
    if logo:
        safe_logo = logo.replace('"', "%22")
        brand_block = (
            f'<div style="margin:0 0 16px;">'
            f'<img src="{safe_logo}" alt="LiturgyFlow" width="56" height="56" '
            f'style="display:block;width:56px;height:56px;border:0;border-radius:14px;" />'
            f"</div>"
            f'<p style="margin:0 0 4px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;'
            f'color:#c45c26;font-weight:700;">LiturgyFlow</p>'
        )
    else:
        brand_block = (
            '<p style="margin:0 0 4px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;'
            'color:#c45c26;font-weight:700;">LiturgyFlow</p>'
        )
    return f"""<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{safe_title}</title></head>
<body style="margin:0;padding:0;background:#f3f1ee;font-family:Georgia,'Times New Roman',serif;color:#1c1917;">
  <div style="max-width:560px;margin:0 auto;padding:32px 16px;">
    <div style="background:#ffffff;border-radius:12px;padding:28px 24px;border:1px solid #e8e4de;">
      {brand_block}
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


def _humanize_brevo_error(status: int, detail: str) -> str:
    low = (detail or "").lower()
    if status == 401 and (
        "authorised_ips" in low or "authorized_ips" in low or "unrecognised ip" in low
    ):
        return (
            f"{status} {detail} → Add Render's IP in Brevo Security → Authorised IPs, "
            "or disable IP restriction for the API key."
        )
    if "valid sender" in low or "invalid_parameter" in low:
        return (
            f"{status} {detail} → EMAIL_FROM must be a verified Brevo sender "
            "(Senders page). Example: LiturgyFlow <you@yourdomain.com>"
        )
    return f"{status} {detail}"


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

    if not sender or "@" not in _split_from(sender)[1]:
        return EmailResult(
            ok=False,
            error=(
                "EMAIL_FROM / BREVO_FROM not set. Create a verified sender in Brevo, "
                "then set EMAIL_FROM=LiturgyFlow <verified@address>"
            ),
        )

    transport = email_transport()
    attempts: list[EmailResult] = []

    use_brevo = transport in {"auto", "brevo_api"}
    use_resend = transport in {"auto", "resend"}
    use_smtp = transport in {"auto", "smtp"}

    if use_brevo:
        brevo = _send_via_brevo(
            to=dest, subject=subj, text=body_text, html=body_html, reply_to=reply, from_addr=sender
        )
        attempts.append(brevo)
        if brevo.ok:
            return brevo
        if transport == "brevo_api":
            return brevo

    if use_resend:
        resend = _send_via_resend(
            to=dest, subject=subj, text=body_text, html=body_html, reply_to=reply, from_addr=sender
        )
        attempts.append(resend)
        if resend.ok:
            return resend
        if transport == "resend":
            return resend

    if use_smtp:
        smtp = _send_via_smtp(
            to=dest, subject=subj, text=body_text, html=body_html, reply_to=reply, from_addr=sender
        )
        attempts.append(smtp)
        if smtp.ok:
            return smtp
        if transport == "smtp":
            return smtp

    if not email_enabled():
        return EmailResult(ok=False, error="email not configured")
    for result in attempts:
        if result.provider and result.error and "unset" not in result.error.lower():
            return result
    for result in reversed(attempts):
        if result.error:
            return result
    return EmailResult(ok=False, error="all providers failed")


def _send_via_brevo(
    *,
    to: str,
    subject: str,
    text: str,
    html: str,
    reply_to: str,
    from_addr: str,
) -> EmailResult:
    api_key = _env("BREVO_API_KEY")
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
        human = _humanize_brevo_error(exc.code, detail)
        logger.warning("Brevo email failed: %s", human)
        return EmailResult(ok=False, provider="brevo", error=human)
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
    api_key = _env("RESEND_API_KEY")
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
    host = _env("SMTP_HOST")
    user = _env("SMTP_USER")
    password = _env("SMTP_PASSWORD")
    if not host or not user or not password:
        return EmailResult(ok=False, error="SMTP_* unset")
    try:
        port = int(_env("SMTP_PORT") or "587")
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
    raw = (_env("EMAIL_REMINDERS_ENABLED") or "1").lower()
    return raw not in {"0", "false", "no", "off"}
