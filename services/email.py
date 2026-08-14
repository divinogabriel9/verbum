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


def _ssl_context() -> ssl.SSLContext:
    """Use certifi's CA bundle so macOS/Python.org builds can verify HTTPS."""
    try:
        import certifi

        return ssl.create_default_context(cafile=certifi.where())
    except Exception:
        return ssl.create_default_context()


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


# Premium SaaS email tokens (LiturgyFlow / Winter Berry)
_EMAIL_BG = "#F8F9FB"
_EMAIL_CARD = "#FFFFFF"
_EMAIL_PRIMARY = "#a10f0d"
_EMAIL_PRIMARY_HOVER = "#8a0c0b"
_EMAIL_INK = "#1F2937"
_EMAIL_MUTED = "#6B7280"
_EMAIL_BORDER = "#E5E7EB"
_EMAIL_FONT = (
    "-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif"
)


def brand_header_html() -> str:
    home = _esc_attr(app_home_url())
    logo = brand_logo_url()
    if logo:
        safe_logo = _esc_attr(logo)
        mark = (
            f'<a href="{home}" style="text-decoration:none;display:inline-block;">'
            f'<img src="{safe_logo}" alt="LiturgyFlow" width="48" height="48" '
            f'style="display:block;width:48px;height:48px;border:0;border-radius:12px;" />'
            f"</a>"
        )
    else:
        mark = (
            f'<a href="{home}" style="font-family:{_EMAIL_FONT};font-size:18px;'
            f'font-weight:700;color:{_EMAIL_PRIMARY};text-decoration:none;">LiturgyFlow</a>'
        )
    return f"""
<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto 28px;">
  <tr>
    <td align="center" style="padding:0 0 12px;">{mark}</td>
  </tr>
  <tr>
    <td align="center" style="font-family:{_EMAIL_FONT};font-size:17px;font-weight:650;
                               letter-spacing:-0.02em;color:{_EMAIL_INK};padding:0 0 4px;">
      LiturgyFlow
    </td>
  </tr>
  <tr>
    <td align="center" style="font-family:{_EMAIL_FONT};font-size:13px;line-height:1.4;
                               color:{_EMAIL_MUTED};">
      Catholic Mass media for parishes
    </td>
  </tr>
</table>"""


def event_card_html(*, date_label: str = "", title: str = "") -> str:
    date_s = (date_label or "").strip()
    title_s = (title or "").strip()
    if not date_s and not title_s:
        return ""
    date_row = (
        f'<div style="font-family:{_EMAIL_FONT};font-size:15px;font-weight:600;'
        f'line-height:1.4;color:{_EMAIL_INK};margin:0 0 4px;">{_esc_attr(date_s)}</div>'
        if date_s
        else ""
    )
    title_row = (
        f'<div style="font-family:{_EMAIL_FONT};font-size:15px;line-height:1.45;'
        f'color:{_EMAIL_MUTED};margin:0;">{_esc_attr(title_s)}</div>'
        if title_s
        else ""
    )
    return f"""
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
       style="margin:0 0 28px;border:1px solid {_EMAIL_BORDER};border-radius:14px;background:{_EMAIL_BG};">
  <tr>
    <td align="center" style="padding:18px 20px;">
      {date_row}
      {title_row}
    </td>
  </tr>
</table>"""


def primary_cta_html(label: str, url: str) -> str:
    safe_label = _esc_attr(label or "Continue")
    safe_url = _esc_attr(url or "")
    return f"""
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 12px;">
  <tr>
    <td align="center" bgcolor="{_EMAIL_PRIMARY}"
        style="border-radius:14px;background-color:{_EMAIL_PRIMARY};">
      <!--[if mso]>
      <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" href="{safe_url}"
        style="height:52px;v-text-anchor:middle;width:100%;" arcsize="20%" fillcolor="{_EMAIL_PRIMARY}" stroke="f">
        <w:anchorlock/>
        <center style="color:#ffffff;font-family:Arial,sans-serif;font-size:16px;font-weight:600;">
          {safe_label}
        </center>
      </v:roundrect>
      <![endif]-->
      <!--[if !mso]><!-- -->
      <a href="{safe_url}"
         style="display:block;padding:16px 24px;font-family:{_EMAIL_FONT};font-size:16px;font-weight:600;
                line-height:1.25;color:#ffffff;text-decoration:none;border-radius:14px;text-align:center;">
        {safe_label}
      </a>
      <!--<![endif]-->
    </td>
  </tr>
</table>"""


def helper_text_html(text: str) -> str:
    clean = (text or "").strip()
    if not clean:
        return ""
    return (
        f'<p style="margin:0 0 8px;font-family:{_EMAIL_FONT};font-size:13px;'
        f'line-height:1.45;color:{_EMAIL_MUTED};text-align:center;">{_esc_attr(clean)}</p>'
    )


def email_footer_html() -> str:
    home = _esc_attr(app_home_url())
    return f"""
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:8px;">
  <tr>
    <td align="center" style="padding:28px 12px 0;font-family:{_EMAIL_FONT};font-size:13px;
                               line-height:1.55;color:{_EMAIL_MUTED};">
      <div style="margin:0 0 6px;">Made with &#10084;&#65039; by LiturgyFlow</div>
      <div style="margin:0 0 14px;">Helping Catholic parishes prepare Mass beautifully.</div>
      <div>
        <a href="{home}" style="color:{_EMAIL_MUTED};text-decoration:underline;">Support</a>
        &nbsp;&middot;&nbsp;
        <a href="{home}" style="color:{_EMAIL_MUTED};text-decoration:underline;">Privacy</a>
        &nbsp;&middot;&nbsp;
        <a href="{home}" style="color:{_EMAIL_MUTED};text-decoration:underline;">Unsubscribe</a>
      </div>
    </td>
  </tr>
</table>"""


def detail_rows(rows: list[tuple[str, str]]) -> str:
    """Compact label/value list for admin emails (kept minimal)."""
    if not rows:
        return ""
    parts: list[str] = [
        f'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" '
        f'style="margin:0 0 24px;border:1px solid {_EMAIL_BORDER};border-radius:14px;overflow:hidden;">'
    ]
    for i, (label, value) in enumerate(rows):
        border = f"border-bottom:1px solid {_EMAIL_BORDER};" if i < len(rows) - 1 else ""
        parts.append(
            f"<tr><td style=\"padding:14px 16px;{border}background:{_EMAIL_CARD};"
            f'font-family:{_EMAIL_FONT};text-align:left;">'
            f'<div style="font-size:12px;font-weight:600;color:{_EMAIL_MUTED};margin:0 0 4px;">'
            f"{_esc_attr(label)}</div>"
            f'<div style="font-size:15px;line-height:1.45;color:{_EMAIL_INK};">{value}</div>'
            f"</td></tr>"
        )
    parts.append("</table>")
    return "".join(parts)


def wrap_html(
    *,
    title: str,
    body_html: str = "",
    subtitle: str = "",
    cta_label: str = "",
    cta_url: str = "",
    helper: str = "",
    event_date: str = "",
    event_title: str = "",
    footer_note: str = "",
    preheader: str = "",
) -> str:
    """Premium SaaS transactional shell — one action, lots of whitespace.

    Prefer ``subtitle`` + ``cta_*`` + optional ``event_*``. ``body_html`` remains
    for rare admin detail blocks. ``footer_note`` is ignored (kept for call-site compat).
    """
    del footer_note  # intentional: SaaS footer replaces per-email notes
    safe_title = _esc_attr(title or "LiturgyFlow")
    safe_sub = _esc_attr(subtitle or "")
    safe_pre = _esc_attr(preheader or subtitle or title or "")
    cta = primary_cta_html(cta_label, cta_url) if cta_label and cta_url else ""
    event = event_card_html(date_label=event_date, title=event_title)
    helper_block = helper_text_html(helper)
    body = (body_html or "").strip()
    body_block = (
        f'<div style="font-family:{_EMAIL_FONT};font-size:16px;line-height:1.55;'
        f'color:{_EMAIL_INK};text-align:center;margin:0 0 8px;">{body}</div>'
        if body
        else ""
    )
    subtitle_block = (
        f'<p style="margin:0 0 28px;font-family:{_EMAIL_FONT};font-size:17px;line-height:1.5;'
        f'color:{_EMAIL_MUTED};text-align:center;">{safe_sub}</p>'
        if safe_sub
        else '<div style="height:12px;line-height:12px;font-size:0;">&nbsp;</div>'
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
<body style="margin:0;padding:0;background-color:{_EMAIL_BG};">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">{safe_pre}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
         style="background-color:{_EMAIL_BG};">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
               style="max-width:600px;width:100%;">
          <tr>
            <td align="center" style="padding:0 0 8px;">{brand_header_html()}</td>
          </tr>
          <tr>
            <td style="background-color:{_EMAIL_CARD};border:1px solid {_EMAIL_BORDER};border-radius:20px;
                       box-shadow:0 8px 30px rgba(0,0,0,.06);padding:40px 32px;">
              <h1 style="margin:0 0 12px;font-family:{_EMAIL_FONT};font-size:32px;line-height:1.15;
                         font-weight:700;letter-spacing:-0.03em;color:{_EMAIL_INK};text-align:center;">
                {safe_title}
              </h1>
              {subtitle_block}
              {event}
              {body_block}
              {cta}
              {helper_block}
            </td>
          </tr>
          <tr>
            <td align="center">{email_footer_html()}</td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""


# Back-compat alias used by older call sites
def _cta_button(label: str, url: str) -> str:
    return primary_cta_html(label, url)


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
        with urllib.request.urlopen(req, timeout=20, context=_ssl_context()) as resp:
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
        with urllib.request.urlopen(req, timeout=20, context=_ssl_context()) as resp:
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
        context = _ssl_context()
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
