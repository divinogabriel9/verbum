#!/usr/bin/env python3
"""Check / send a sample LiturgyFlow admin alert (email + Telegram).

Usage:
  python scripts/test_admin_alerts.py --check
  python scripts/test_admin_alerts.py --send
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

_ROOT = Path(__file__).resolve().parents[1]
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

try:
    from services.env_config import load_project_dotenv

    load_project_dotenv()
except Exception:
    pass

from services.admin_alerts import admin_alerts_status, emit_admin_alert  # noqa: E402


def main() -> int:
    if len(sys.argv) < 2 or sys.argv[1] in {"-h", "--help"}:
        print(__doc__)
        return 2
    status = admin_alerts_status()
    if sys.argv[1] in {"--check", "-c", "check"}:
        print(json.dumps(status, indent=2))
        return 0 if status.get("alerts_enabled") else 1
    if sys.argv[1] in {"--send", "-s", "send"}:
        print(json.dumps(status, indent=2))
        result = emit_admin_alert(
            kind="test",
            title="Alert test",
            subtitle="If you got this, admin alerts are working.",
            lines=["Sent from scripts/test_admin_alerts.py"],
        )
        print(
            f"ok={result.ok} email_ok={result.email_ok} telegram_ok={result.telegram_ok} "
            f"email_errors={result.email_errors!r} telegram_error={result.telegram_error!r}"
        )
        return 0 if result.ok else 1
    print(__doc__)
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
