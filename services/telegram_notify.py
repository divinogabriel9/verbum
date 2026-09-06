"""Free Telegram Bot API alerts for LiturgyFlow operators."""

from __future__ import annotations

import logging
import os
from dataclasses import dataclass
from typing import Any, Optional
from urllib.parse import urlencode
from urllib.request import Request, urlopen

logger = logging.getLogger(__name__)


@dataclass
class TelegramResult:
    ok: bool
    error: str = ""
    message_id: Optional[int] = None


def _env(name: str) -> str:
    return (os.environ.get(name) or "").strip()


def telegram_bot_token() -> str:
    return _env("TELEGRAM_BOT_TOKEN") or _env("ALERT_TELEGRAM_BOT_TOKEN")


def telegram_chat_ids() -> list[str]:
    """One or more chat IDs (comma-separated)."""
    raw = _env("TELEGRAM_CHAT_ID") or _env("ALERT_TELEGRAM_CHAT_ID")
    if not raw:
        return []
    return [part.strip() for part in raw.split(",") if part.strip()]


def telegram_enabled() -> bool:
    return bool(telegram_bot_token() and telegram_chat_ids())


def telegram_config_status() -> dict[str, Any]:
    chats = telegram_chat_ids()
    return {
        "telegram_enabled": telegram_enabled(),
        "bot_token_configured": bool(telegram_bot_token()),
        "chat_ids_configured": len(chats),
        "hint": (
            "Create a bot with @BotFather, DM it once, then set TELEGRAM_BOT_TOKEN "
            "and TELEGRAM_CHAT_ID (get id via @userinfobot or getUpdates)."
            if not telegram_enabled()
            else "Telegram alerts ready."
        ),
    }


def _esc_html(text: str) -> str:
    return (
        (text or "")
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
    )


def format_alert_html(
    *,
    title: str,
    subtitle: str = "",
    lines: Optional[list[str]] = None,
    url: str = "",
    url_label: str = "Open Superadmin",
) -> str:
    parts = [f"<b>LiturgyFlow · {_esc_html(title)}</b>"]
    if subtitle:
        parts.append(_esc_html(subtitle))
    for line in lines or []:
        clean = (line or "").strip()
        if clean:
            parts.append(_esc_html(clean))
    if url:
        parts.append(f'<a href="{_esc_html(url)}">{_esc_html(url_label or "Open")}</a>')
    return "\n".join(parts)


def send_telegram_message(
    text: str,
    *,
    chat_id: Optional[str] = None,
    parse_mode: str = "HTML",
    disable_web_page_preview: bool = True,
) -> TelegramResult:
    token = telegram_bot_token()
    if not token:
        return TelegramResult(ok=False, error="TELEGRAM_BOT_TOKEN not set")
    targets = [chat_id] if chat_id else telegram_chat_ids()
    if not targets:
        return TelegramResult(ok=False, error="TELEGRAM_CHAT_ID not set")

    last_error = ""
    any_ok = False
    last_mid: Optional[int] = None
    for cid in targets:
        payload = urlencode(
            {
                "chat_id": cid,
                "text": text,
                "parse_mode": parse_mode,
                "disable_web_page_preview": "true" if disable_web_page_preview else "false",
            }
        ).encode("utf-8")
        req = Request(
            f"https://api.telegram.org/bot{token}/sendMessage",
            data=payload,
            method="POST",
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
        try:
            with urlopen(req, timeout=12) as resp:
                status = getattr(resp, "status", 200) or 200
                body = resp.read().decode("utf-8", errors="replace")
            if status >= 400:
                last_error = f"HTTP {status}: {body[:240]}"
                logger.warning("Telegram send failed chat=%s: %s", cid, last_error)
                continue
            any_ok = True
            if '"message_id":' in body:
                try:
                    import json

                    data = json.loads(body)
                    mid = (data.get("result") or {}).get("message_id")
                    if mid is not None:
                        last_mid = int(mid)
                except Exception:
                    pass
        except Exception as exc:
            last_error = str(exc)
            logger.warning("Telegram send raised chat=%s: %s", cid, exc)
    if any_ok:
        return TelegramResult(ok=True, message_id=last_mid)
    return TelegramResult(ok=False, error=last_error or "telegram send failed")
