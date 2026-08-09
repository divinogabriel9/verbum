#!/usr/bin/env python3
"""HTTP trigger for production cron — hits the live web service autofetch endpoint.

Uses APP_PUBLIC_URL + CRON_SECRET so the fetch runs on the web dyno (where the
readings cache lives), not on an ephemeral cron filesystem.
"""

from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request


def main() -> int:
    base = (os.environ.get("APP_PUBLIC_URL") or os.environ.get("RENDER_EXTERNAL_URL") or "").rstrip("/")
    secret = (os.environ.get("CRON_SECRET") or os.environ.get("EMAIL_CRON_SECRET") or "").strip()
    if not base:
        print("APP_PUBLIC_URL (or RENDER_EXTERNAL_URL) is required", file=sys.stderr)
        return 2
    if not secret:
        print("CRON_SECRET is required", file=sys.stderr)
        return 2

    url = f"{base}/api/internal/readings/auto-fetch"
    body = json.dumps(
        {
            "attempts": int(os.environ.get("READINGS_AUTOFETCH_ATTEMPTS") or "3"),
            "sundays_ahead": int(os.environ.get("READINGS_AUTOFETCH_SUNDAYS") or "8"),
            "scope": (os.environ.get("READINGS_AUTOFETCH_SCOPE") or "missing").strip() or "missing",
            "alert": (os.environ.get("READINGS_AUTOFETCH_ALERT") or "1").strip() not in ("0", "false", "no"),
            "dry_run": False,
        }
    ).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=body,
        method="POST",
        headers={
            "Content-Type": "application/json",
            "X-Cron-Secret": secret,
            "User-Agent": "verbum-readings-autofetch-cron/1.0",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=900) as resp:
            raw = resp.read().decode("utf-8", errors="replace")
            print(raw)
            try:
                data = json.loads(raw)
            except json.JSONDecodeError:
                return 0
            critical = data.get("critical_sundays") or []
            return 1 if critical else 0
    except urllib.error.HTTPError as exc:
        err_body = exc.read().decode("utf-8", errors="replace")
        print(f"HTTP {exc.code}: {err_body}", file=sys.stderr)
        return 1
    except Exception as exc:
        print(f"Request failed: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
