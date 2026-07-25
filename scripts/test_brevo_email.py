#!/usr/bin/env python3
"""Brevo setup check + transactional test (not marketing campaigns).

Recommended order:
  1. Generate API key
  2. Create sender
  3. Authenticate domain (DNS)
  4. Connect API in project (.env / Render)
  5. Send a test email
  6. Later: contacts / automations / campaigns (optional)

Usage:
  python scripts/test_brevo_email.py --check
  python scripts/test_brevo_email.py you@example.com
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

try:
    from services.env_config import load_project_dotenv

    load_project_dotenv()
except Exception:
    pass

from services.email import (  # noqa: E402
    default_from_address,
    email_config_status,
    email_enabled,
    send_email,
    wrap_html,
)


def print_check() -> int:
    status = email_config_status()
    print("LiturgyFlow ↔ Brevo setup check\n")
    for step in status["setup_steps"]:
        done = step.get("done")
        if done is True:
            mark = "OK"
        elif done is False:
            mark = "TODO"
        else:
            mark = "—"
        print(f"  [{mark}] {step['id']}. {step['title']}")
        print(f"         {step['hint']}")
    print()
    print(
        f"transport={status['transport']}  "
        f"api={status['brevo_api_configured']}  "
        f"smtp={status['smtp_configured']}  "
        f"from={status['from_email'] or '(unset)'}"
    )
    print()
    print(json.dumps(status, indent=2))
    ready = status["email_enabled"] and status["from_configured"]
    if not ready:
        print("\nNot ready to send. Finish TODO steps above, then:")
        print("  python scripts/test_brevo_email.py you@example.com")
        return 1
    print("\nConfig looks ready. Send a test:")
    print("  python scripts/test_brevo_email.py you@example.com")
    return 0


def send_test(to: str) -> int:
    if not email_enabled():
        print("Email not configured. Run: python scripts/test_brevo_email.py --check")
        return 1
    sender = default_from_address()
    if not sender:
        print("Set EMAIL_FROM to a verified Brevo sender first.")
        return 1
    print(f"From: {sender}")
    print(f"To:   {to}")
    result = send_email(
        to=to,
        subject="LiturgyFlow Brevo test",
        text="If you received this, transactional email is working.",
        html=wrap_html(
            title="Brevo test OK",
            body_html=(
                "<p>If you received this, <strong>transactional</strong> email is working.</p>"
                "<p>Access requests, invites, and reminders use this path — "
                "not Email Campaigns.</p>"
            ),
        ),
    )
    print(f"ok={result.ok} provider={result.provider!r} error={result.error!r}")
    return 0 if result.ok else 1


def main() -> int:
    if len(sys.argv) < 2 or sys.argv[1] in {"-h", "--help"}:
        print(__doc__)
        return 2
    if sys.argv[1] in {"--check", "-c", "check"}:
        return print_check()
    to = sys.argv[1].strip()
    if "@" not in to:
        print("Usage: python scripts/test_brevo_email.py you@example.com")
        print("       python scripts/test_brevo_email.py --check")
        return 2
    return send_test(to)


if __name__ == "__main__":
    raise SystemExit(main())
