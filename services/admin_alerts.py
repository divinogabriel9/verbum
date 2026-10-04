"""Operator alerts: email (Brevo) + Telegram for LiturgyFlow ops events."""

from __future__ import annotations

import logging
import os
import threading
import time
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

_MEMORY_THROTTLE: dict[str, float] = {}
_MEMORY_THROTTLE_MAX = 4000


@dataclass
class AdminAlertResult:
    ok: bool
    email_ok: bool = False
    telegram_ok: bool = False
    email_errors: list[str] = field(default_factory=list)
    telegram_error: str = ""
    recipients: list[str] = field(default_factory=list)
    skipped: bool = False
    skip_reason: str = ""


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


def alert_throttle_allows(key: str, *, ttl_s: int) -> bool:
    """Return True once per key within ttl (Redis when available, else memory)."""
    clean = (key or "").strip()
    if not clean or ttl_s <= 0:
        return True
    redis_key = "verbum:ops_alert:" + clean
    try:
        from services.redis_client import get_redis

        client = get_redis()
        if client is not None:
            ok = client.set(redis_key, "1", nx=True, ex=int(ttl_s))
            return bool(ok)
    except Exception:
        pass
    now = time.time()
    if len(_MEMORY_THROTTLE) > _MEMORY_THROTTLE_MAX:
        cutoff = now - 3600
        stale = [k for k, ts in _MEMORY_THROTTLE.items() if ts < cutoff]
        for k in stale[:1000]:
            _MEMORY_THROTTLE.pop(k, None)
    prev = _MEMORY_THROTTLE.get(clean)
    if prev is not None and (now - prev) < ttl_s:
        return False
    _MEMORY_THROTTLE[clean] = now
    return True


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


def emit_admin_alert_bg(kind: str, **kwargs: Any) -> None:
    """Fire-and-forget so request latency is not blocked by Brevo/Telegram."""

    def _run() -> None:
        safe_emit_admin_alert(kind, **kwargs)

    try:
        threading.Thread(target=_run, name=f"ops-alert-{kind}", daemon=True).start()
    except Exception as exc:
        logger.warning("Could not spawn alert thread %s: %s", kind, exc)
        safe_emit_admin_alert(kind, **kwargs)


# ── Convenience helpers for call sites ──────────────────────────────────────


def alert_new_signup(
    *,
    name: str,
    email: str,
    provider: str = "",
    parish: str = "",
) -> AdminAlertResult:
    """Account created (OAuth/email) — before the mandatory onboarding form."""
    lines = [
        f"Name: {name}" if name else "",
        f"Email: {email}" if email else "",
        f"Sign-up method: {provider}" if provider else "",
        f"Parish: {parish}" if parish else "Parish: (not set yet — onboarding pending)",
        "Status: Account created; onboarding form not completed yet.",
    ]
    return safe_emit_admin_alert(
        "new_signup",
        title="New signup",
        subtitle="Someone created an account (form still required).",
        lines=lines,
    )


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
        subtitle="Onboarding form submitted — parish awaiting approval.",
        lines=lines,
    )


def alert_parish_join_request(
    *,
    name: str,
    email: str,
    parish: str,
) -> AdminAlertResult:
    return safe_emit_admin_alert(
        "parish_join",
        title="Parish join request",
        subtitle="Someone asked to join an existing parish as media.",
        lines=[
            f"Name: {name}" if name else "",
            f"Email: {email}" if email else "",
            f"Parish: {parish}" if parish else "",
            "Role if approved: media",
        ],
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
    """Telegram ping; Brevo already emails SUPERADMIN on access requests."""
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


def alert_demo_generation(
    *,
    client_ip: str,
    country: str,
    device_brand: str,
    mass_date: str,
    mass_language: str,
) -> AdminAlertResult:
    return safe_emit_admin_alert(
        "demo_generation",
        title="Landing demo generate",
        subtitle="Guest built a Mass deck from the marketing page.",
        lines=[
            f"IP: {client_ip}" if client_ip else "",
            f"Country: {country}" if country else "",
            f"Device: {device_brand}" if device_brand else "",
            f"Mass date: {mass_date}" if mass_date else "",
            f"Language: {mass_language}" if mass_language else "",
        ],
    )


def alert_contact_message(
    *,
    name: str,
    email: str,
    topic: str,
) -> AdminAlertResult:
    """Telegram ping; Brevo already emails SUPERADMIN on contact form."""
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


def alert_user_login(
    *,
    email: str = "",
    name: str = "",
    parish: str = "",
    country: str = "",
    user_id: str = "",
) -> AdminAlertResult:
    """Login / session resume. Throttled per user (default 6h) to avoid spam."""
    uid = (user_id or email or "anon").strip().lower()
    ttl = int((os.environ.get("ALERT_LOGIN_TTL_S") or "21600").strip() or "21600")
    if not alert_throttle_allows(f"login:{uid}", ttl_s=max(300, ttl)):
        return AdminAlertResult(ok=False, skipped=True, skip_reason="throttled")
    return safe_emit_admin_alert(
        "login",
        title="User active",
        subtitle="Someone signed in / came back online.",
        lines=[
            f"Name: {name}" if name else "",
            f"Email: {email}" if email else "",
            f"Parish: {parish}" if parish else "",
            f"Country: {country}" if country else "",
        ],
    )


def alert_mass_generated(
    *,
    email: str = "",
    name: str = "",
    parish: str = "",
    mass_date: str = "",
    slide_count: int | None = None,
    title: str = "",
    source: str = "app",
) -> AdminAlertResult:
    lines = [
        f"Who: {name}" if name else "",
        f"Email: {email}" if email else "",
        f"Parish: {parish}" if parish else "",
        f"Mass date: {mass_date}" if mass_date else "",
        f"Title: {title}" if title else "",
        f"Slides: {slide_count}" if slide_count is not None else "",
        f"Source: {source}" if source else "",
    ]
    return safe_emit_admin_alert(
        "mass_generated",
        title="Mass PPTX generated",
        subtitle="A parish built a Mass deck.",
        lines=lines,
    )


def alert_mass_generate_failed(
    *,
    email: str = "",
    parish: str = "",
    mass_date: str = "",
    error: str = "",
    source: str = "app",
) -> AdminAlertResult:
    err = (error or "unknown error").strip()[:400]
    return safe_emit_admin_alert(
        "mass_generate_failed",
        title="Mass generate failed",
        subtitle="PPTX generation hit an error.",
        lines=[
            f"Email: {email}" if email else "",
            f"Parish: {parish}" if parish else "",
            f"Mass date: {mass_date}" if mass_date else "",
            f"Source: {source}" if source else "",
            f"Error: {err}" if err else "",
        ],
    )


def alert_payment_event(
    *,
    event_type: str,
    parish: str = "",
    parish_id: str = "",
    status: str = "",
    email: str = "",
    amount_label: str = "",
) -> AdminAlertResult:
    et = (event_type or "payment").strip()
    title = "Payment received" if "paid" in et or et.endswith("completed") else "Billing update"
    if "failed" in et:
        title = "Payment failed"
    return safe_emit_admin_alert(
        "payment",
        title=title,
        subtitle=et,
        lines=[
            f"Parish: {parish}" if parish else "",
            f"Parish ID: {parish_id}" if parish_id else "",
            f"Status: {status}" if status else "",
            f"Customer: {email}" if email else "",
            f"Amount: {amount_label}" if amount_label else "",
        ],
    )


def alert_server_crash(
    *,
    path: str = "",
    method: str = "",
    status_code: int = 500,
    error: str = "",
    user_email: str = "",
) -> AdminAlertResult:
    """Unhandled 500s. Throttled by path+error signature (15 min)."""
    err = (error or "Unhandled exception").strip()[:500]
    sig = f"{method}:{path}:{status_code}:{err[:120]}".lower()
    ttl = int((os.environ.get("ALERT_CRASH_TTL_S") or "900").strip() or "900")
    if not alert_throttle_allows(f"crash:{sig}", ttl_s=max(60, ttl)):
        return AdminAlertResult(ok=False, skipped=True, skip_reason="throttled")
    return safe_emit_admin_alert(
        "crash",
        title="Server error",
        subtitle=f"{method or 'HTTP'} {path or '/'} → {status_code}",
        lines=[
            f"User: {user_email}" if user_email else "",
            f"Error: {err}",
        ],
    )


def _spawn_alert(name: str, fn, kwargs: dict[str, Any]) -> None:
    try:
        threading.Thread(target=fn, kwargs=kwargs, name=name, daemon=True).start()
    except Exception:
        fn(**kwargs)


def alert_user_login_bg(**kwargs: Any) -> None:
    _spawn_alert("ops-alert-login", alert_user_login, kwargs)


def alert_mass_generated_bg(**kwargs: Any) -> None:
    _spawn_alert("ops-alert-mass-gen", alert_mass_generated, kwargs)


def alert_mass_generate_failed_bg(**kwargs: Any) -> None:
    _spawn_alert("ops-alert-mass-fail", alert_mass_generate_failed, kwargs)


def alert_payment_event_bg(**kwargs: Any) -> None:
    _spawn_alert("ops-alert-payment", alert_payment_event, kwargs)


def alert_server_crash_bg(**kwargs: Any) -> None:
    _spawn_alert("ops-alert-crash", alert_server_crash, kwargs)
