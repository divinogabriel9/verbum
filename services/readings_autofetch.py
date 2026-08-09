"""Scheduled readings health check + USCCB/Bible fetch (cron)."""

from __future__ import annotations

import datetime as dt
import logging
import time
from typing import Any, Literal

from services.membership_config import superadmin_emails
from services.readings_snapshot import invalidate_readings_memory
from services.superadmin.readings_admin import assess_readings_health
from services.lectionary_service import get_liturgical_data

logger = logging.getLogger(__name__)

DEFAULT_SUNDAYS_AHEAD = 8
DEFAULT_ATTEMPTS = 3
_FETCH_GAP_S = 0.75
_RETRY_GAP_S = 2.0


def upcoming_sundays(*, from_date: dt.date | None = None, count: int = DEFAULT_SUNDAYS_AHEAD) -> list[str]:
    """Next ``count`` Sundays starting from today (or ``from_date``), inclusive if today is Sunday."""
    start = from_date or dt.date.today()
    days_to_sun = (6 - start.weekday()) % 7
    first = start + dt.timedelta(days=days_to_sun)
    return [(first + dt.timedelta(days=7 * i)).isoformat() for i in range(max(1, count))]


def _health_status(iso: str) -> str:
    return str(assess_readings_health(iso).get("status") or "critical")


def _needs_fetch(status: str, *, scope: Literal["missing", "all"]) -> bool:
    if scope == "all":
        return True
    return status != "healthy"


def run_readings_autofetch(
    *,
    attempts: int = DEFAULT_ATTEMPTS,
    sundays_ahead: int = DEFAULT_SUNDAYS_AHEAD,
    scope: Literal["missing", "all"] = "missing",
    dry_run: bool = False,
    alert: bool = True,
) -> dict[str, Any]:
    """
    Check upcoming Sundays and live-fetch incomplete ones.

    Runs up to ``attempts`` passes. After the final pass, emails superadmins when
    any target Sunday is still ``critical``.
    """
    attempts = max(1, min(int(attempts or DEFAULT_ATTEMPTS), 5))
    sundays_ahead = max(1, min(int(sundays_ahead or DEFAULT_SUNDAYS_AHEAD), 16))
    targets = upcoming_sundays(count=sundays_ahead)

    before_map = {iso: _health_status(iso) for iso in targets}
    pass_details: list[dict[str, Any]] = []
    fetched_total = 0
    errors: list[str] = []

    for attempt in range(1, attempts + 1):
        pending = [iso for iso in targets if _needs_fetch(_health_status(iso), scope=scope)]
        if not pending:
            break

        attempt_row: dict[str, Any] = {
            "attempt": attempt,
            "pending": list(pending),
            "fetched": [],
            "errors": [],
        }
        if dry_run:
            pass_details.append(attempt_row)
            break

        for i, iso in enumerate(pending):
            try:
                invalidate_readings_memory(iso)
                live = get_liturgical_data(iso, force_refresh=True)
                if live is not None:
                    fetched_total += 1
                    attempt_row["fetched"].append(iso)
                else:
                    msg = f"{iso}: live fetch returned empty"
                    attempt_row["errors"].append(msg)
                    errors.append(msg)
            except Exception as exc:
                msg = f"{iso}: {exc}"
                attempt_row["errors"].append(msg)
                errors.append(msg)
                logger.warning("readings autofetch failed for %s: %s", iso, exc)

            if i + 1 < len(pending):
                time.sleep(_FETCH_GAP_S)

        pass_details.append(attempt_row)
        still = [iso for iso in targets if _needs_fetch(_health_status(iso), scope=scope)]
        if not still:
            break
        if attempt < attempts:
            time.sleep(_RETRY_GAP_S)

    after_map = {iso: _health_status(iso) for iso in targets}
    improved = [
        iso
        for iso in targets
        if before_map.get(iso) != "healthy" and after_map.get(iso) == "healthy"
    ]
    still_unhealthy = [iso for iso in targets if after_map.get(iso) != "healthy"]
    critical_sundays = [iso for iso in targets if after_map.get(iso) == "critical"]
    warning_sundays = [iso for iso in targets if after_map.get(iso) == "warning"]

    alert_result: dict[str, Any] | None = None
    if alert and critical_sundays and not dry_run:
        try:
            from services.email_notifications import notify_readings_critical_sundays

            alert_result = notify_readings_critical_sundays(
                critical_sundays=critical_sundays,
                warning_sundays=warning_sundays,
                attempts=attempts,
                scope=scope,
            )
        except Exception as exc:
            logger.exception("readings critical alert email failed")
            alert_result = {"ok": False, "error": str(exc)}

    return {
        "ok": True,
        "dry_run": dry_run,
        "scope": scope,
        "attempts": attempts,
        "sundays_ahead": sundays_ahead,
        "targets": targets,
        "before": before_map,
        "after": after_map,
        "improved": improved,
        "still_unhealthy": still_unhealthy,
        "critical_sundays": critical_sundays,
        "warning_sundays": warning_sundays,
        "fetched_total": fetched_total,
        "passes": pass_details,
        "errors": errors[-40:],
        "alert": alert_result,
        "superadmin_recipients": sorted(superadmin_emails()),
    }
