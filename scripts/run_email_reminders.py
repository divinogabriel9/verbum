#!/usr/bin/env python3
"""Run weekly LiturgyFlow email reminders (for Render Cron / local).

Examples:
  python scripts/run_email_reminders.py --kind auto
  python scripts/run_email_reminders.py --kind mass_pptx --dry-run
  python scripts/run_email_reminders.py --kind practice_share --date 2026-07-26
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
    from services.env_config import load_env_files

    load_env_files()
except Exception:
    pass

from services.email_reminders import run_weekly_reminders  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser(description="Send weekly LiturgyFlow email reminders")
    parser.add_argument(
        "--kind",
        choices=("auto", "mass_pptx", "practice_share"),
        default="auto",
        help="auto = Wed mass_pptx / Fri practice_share (local weekday)",
    )
    parser.add_argument("--date", dest="mass_date", default=None, help="YYYY-MM-DD Mass date")
    parser.add_argument("--dry-run", action="store_true", help="List recipients without sending")
    args = parser.parse_args()
    result = run_weekly_reminders(
        kind=args.kind,
        mass_date=args.mass_date,
        dry_run=args.dry_run,
    )
    print(json.dumps(result, indent=2, default=str))
    if not result.get("ok") and result.get("failed", 0) == 0 and not result.get("sent"):
        # Config / weekday skip — exit 0 for cron noise reduction when skipped_weekday
        if result.get("skipped_weekday"):
            return 0
        return 1
    if int(result.get("failed") or 0) > 0 and int(result.get("sent") or 0) == 0:
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
