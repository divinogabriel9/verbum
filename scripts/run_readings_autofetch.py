#!/usr/bin/env python3
"""Run readings autofetch locally or from a cron host.

Examples:
  python scripts/run_readings_autofetch.py --dry-run
  python scripts/run_readings_autofetch.py --attempts 3 --sundays-ahead 8

Via HTTP (production cron):
  python scripts/cron_curl_readings_autofetch.py
  # or:
  curl -X POST "$APP_PUBLIC_URL/api/internal/readings/auto-fetch" \\
    -H "X-Cron-Secret: $CRON_SECRET" \\
    -H "Content-Type: application/json" \\
    -d '{"attempts":3,"sundays_ahead":8,"scope":"missing","alert":true}'
"""

from __future__ import annotations

import argparse
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

from services.readings_autofetch import run_readings_autofetch  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser(description="Autofetch upcoming Sunday readings")
    parser.add_argument("--attempts", type=int, default=3)
    parser.add_argument("--sundays-ahead", type=int, default=8)
    parser.add_argument("--scope", choices=("missing", "all"), default="missing")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--no-alert", action="store_true", help="Skip superadmin email")
    args = parser.parse_args()

    result = run_readings_autofetch(
        attempts=args.attempts,
        sundays_ahead=args.sundays_ahead,
        scope=args.scope,
        dry_run=args.dry_run,
        alert=not args.no_alert,
    )
    print(json.dumps(result, indent=2, default=str))
    critical = result.get("critical_sundays") or []
    return 1 if critical and not args.dry_run else 0


if __name__ == "__main__":
    raise SystemExit(main())
