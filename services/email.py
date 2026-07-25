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


def app_home_url() -> str:
    try:
        from services.auth_config import app_public_url

        return app_public_url() or "https://liturgyflow.com"
    except Exception:
        return "https://liturgyflow.com"


def _esc_attr(value: str) -> str:
    return (
        (value or "")
        .replace("&", "&amp;")
        .replace('"', "&quot;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
    )


def _cta_button(label: str, url: str) -> str:
    safe_label = _esc_attr(label or "Open LiturgyFlow")
    safe_url = _esc_attr(url or "")
    return f"""
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:28px 0 12px;">
  <tr>
    <td align="left" bgcolor="#a10f0d" style="border-radius:10px;background-color:#a10f0d;">
      <a href="{safe_url}"
         style="display:inline-block;padding:14px 22px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;
                font-size:15px;font-weight:600;line-height:1.2;color:#ffffff;text-decoration:none;border-radius:10px;">
        {safe_label}
      </a>
    </td>
  </tr>
</table>
<p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;
          font-size:12px;line-height:1.5;color:#5C6B75;word-break:break-all;">
  Or open:<br>
  <a href="{safe_url}" style="color:#5C6B75;text-decoration:underline;">{safe_url}</a>
</p>"""


def detail_rows(rows: list[tuple[str, str]]) -> str:
    """Render a clean label/value card for admin-style emails."""
    parts: list[str] = [
        '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" '
        'style="margin:8px 0 20px;border:1px solid #E4E9EF;border-radius:12px;overflow:hidden;">'
    ]
    for i, (label, value) in enumerate(rows):
        border = "border-bottom:1px solid #E4E9EF;" if i < len(rows) - 1 else ""
        parts.append(
            f'<tr>'
            f'<td style="padding:12px 14px;{border}background:#FFFFFF;'
            f"font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;\">"
            f'<div style="font-size:11px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;'
            f'color:#5C6B75;margin:0 0 4px;">{_esc_attr(label)}</div>'
            f'<div style="font-size:15px;line-height:1.45;color:#15333D;">{value}</div>'
            f"</td></tr>"
        )
    parts.append("</table>")
    return "".join(parts)


def wrap_html(
    *,
    title: str,
    body_html: str,
    cta_label: str = "",
    cta_url: str = "",
    footer_note: str = "",
    preheader: str = "",
) -> str:
    """Branded transactional shell — table layout for Gmail/Outlook."""
    cta = _cta_button(cta_label, cta_url) if cta_label and cta_url else ""
    foot = (
        f'<p style="margin:24px 0 0;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Helvetica,Arial,sans-serif;'
        f'font-size:12px;line-height:1.5;color:#5C6B75;">{footer_note}</p>'
        if footer_note
        else ""
    )
    safe_title = _esc_attr(title or "LiturgyFlow")
    safe_pre = _esc_attr(preheader or title or "")
    logo = brand_logo_url()
    home = _esc_attr(app_home_url())

    if logo:
        safe_logo = _esc_attr(logo)
        logo_cell = (
            f'<a href="{home}" style="text-decoration:none;">'
            f'<img src="{safe_logo}" alt="LiturgyFlow" width="64" height="64" '
            f'style="display:block;width:64px;height:64px;border:0;border-radius:16px;" />'
            f"</a>"
        )
    else:
        logo_cell = (
            f'<a href="{home}" style="font-family:Georgia,\'Times New Roman\',serif;font-size:22px;'
            f'color:#a10f0d;text-decoration:none;font-weight:700;">LiturgyFlow</a>'
        )

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>{safe_title}</title>
<!--[if mso]><style>body,table,td{{font-family:Arial,sans-serif!important;}}</style><![endif]-->
</head>
<body style="margin:0;padding:0;background-color:#EEF2F6;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
    {safe_pre}
  </div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#EEF2F6;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;">
          <tr>
            <td align="left" style="padding:0 4px 18px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td valign="middle" style="padding-right:12px;">{logo_cell}</td>
                  <td valign="middle">
                    <div style="font-family:Georgia,'Times New Roman',serif;font-size:20px;line-height:1.1;color:#15333D;font-weight:700;">
                      LiturgyFlow
                    </div>
                    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;
                                font-size:12px;line-height:1.3;color:#5C6B75;margin-top:3px;">
                      Catholic Mass media for parishes
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="background-color:#FFFFFF;border:1px solid #E4E9EF;border-radius:16px;padding:0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="height:4px;line-height:4px;font-size:0;background-color:#a10f0d;border-radius:16px 16px 0 0;">&nbsp;</td>
                </tr>
                <tr>
                  <td style="padding:28px 28px 8px;">
                    <h1 style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:26px;line-height:1.2;
                               font-weight:700;color:#15333D;letter-spacing:-0.02em;">
                      {safe_title}
                    </h1>
                  </td>
                </tr>
                <tr>
                  <td style="padding:8px 28px 28px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;
                             font-size:16px;line-height:1.55;color:#15333D;">
                    {body_html}
                    {cta}
                    {foot}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:20px 8px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;
                                       font-size:11px;line-height:1.5;color:#5C6B75;">
              Sent by <a href="{home}" style="color:#5C6B75;text-decoration:underline;">LiturgyFlow</a>
              · Mass decks, posters &amp; choir practice
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
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
