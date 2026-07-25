#!/usr/bin/env python3
"""List reminder recipients and/or send Mass PPTX + choir practice emails.

Examples:
  # Who would get mail?
  python scripts/run_email_reminders.py --list

  # Dry-run both reminders to all approved members
  python scripts/run_email_reminders.py --kind both --dry-run

  # Actually send both (Mass PPTX + share lyrics)
  python scripts/run_email_reminders.py --kind both --force

  # Presidents only
  python scripts/run_email_reminders.py --kind both --audience presidents --force
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

from services.email_reminders import list_reminder_recipients, run_weekly_reminders  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser(
        description="List or send LiturgyFlow Mass / practice-share reminders"
    )
    parser.add_argument(
        "--list",
        action="store_true",
        help="Print recipient emails (approved parishes) and exit",
    )
    parser.add_argument(
        "--kind",
        choices=("auto", "mass_pptx", "practice_share", "both"),
        default="both",
        help="both = Mass PPTX + share lyrics (default)",
    )
    parser.add_argument(
        "--audience",
        choices=("all_members", "presidents"),
        default="all_members",
        help="Who gets mail in each approved parish",
    )
    parser.add_argument("--date", dest="mass_date", default=None, help="YYYY-MM-DD Mass date")
    parser.add_argument("--dry-run", action="store_true", help="List actions without sending")
    parser.add_argument(
        "--force",
        action=argparse.BooleanOptionalAction,
        default=True,
        help="Send even if already emailed this week (default: true). Use --no-force to dedupe.",
    )
    args = parser.parse_args()

    if args.list:
        result = list_reminder_recipients(
            audience=args.audience,
            mass_date=args.mass_date,
        )
        print(json.dumps(result, indent=2, default=str))
        if result.get("emails"):
            print("\n--- emails ---")
            for email in result["emails"]:
                print(email)
        return 0 if result.get("ok") else 1

    result = run_weekly_reminders(
        kind=args.kind,
        mass_date=args.mass_date,
        dry_run=args.dry_run,
        force=args.force,
        audience=args.audience,
    )
    print(json.dumps(result, indent=2, default=str))
    if not result.get("ok") and result.get("failed", 0) == 0 and not result.get("sent"):
        if result.get("skipped_weekday"):
            return 0
        return 1
    if int(result.get("failed") or 0) > 0 and int(result.get("sent") or 0) == 0:
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
