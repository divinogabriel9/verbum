"""Internal readings autofetch jobs (cron)."""

from __future__ import annotations

from typing import Any, Literal, Optional

from fastapi import Header, Query
from pydantic import BaseModel, Field

from services.cron_auth import cron_secret_configured, require_cron_auth
from services.readings_autofetch import (
    DEFAULT_ATTEMPTS,
    DEFAULT_SUNDAYS_AHEAD,
    run_readings_autofetch,
    upcoming_sundays,
)


class ReadingsAutofetchBody(BaseModel):
    attempts: int = Field(DEFAULT_ATTEMPTS, ge=1, le=5)
    sundays_ahead: int = Field(DEFAULT_SUNDAYS_AHEAD, ge=1, le=16)
    scope: Literal["missing", "all"] = "missing"
    dry_run: bool = False
    alert: bool = True


def register_readings_job_routes(app) -> None:
    @app.get("/api/internal/readings/auto-fetch/status")
    def api_readings_autofetch_status(
        authorization: Optional[str] = Header(None),
        x_cron_secret: Optional[str] = Header(None, alias="X-Cron-Secret"),
        sundays_ahead: int = Query(DEFAULT_SUNDAYS_AHEAD, ge=1, le=16),
    ) -> dict[str, Any]:
        require_cron_auth(authorization, x_cron_secret)
        from services.superadmin.readings_admin import assess_readings_health

        targets = upcoming_sundays(count=sundays_ahead)
        health = {iso: assess_readings_health(iso).get("status") for iso in targets}
        return {
            "ok": True,
            "cron_secret_configured": cron_secret_configured(),
            "sundays_ahead": sundays_ahead,
            "targets": targets,
            "health": health,
            "critical_sundays": [iso for iso, st in health.items() if st == "critical"],
            "warning_sundays": [iso for iso, st in health.items() if st == "warning"],
        }

    @app.post("/api/internal/readings/auto-fetch")
    def api_readings_autofetch_run(
        body: ReadingsAutofetchBody,
        authorization: Optional[str] = Header(None),
        x_cron_secret: Optional[str] = Header(None, alias="X-Cron-Secret"),
    ) -> dict[str, Any]:
        """Check upcoming Sundays and live-fetch incomplete ones (up to ``attempts`` passes).

        Emails SUPERADMIN_EMAILS when any Sunday remains critical after the run.
        """
        require_cron_auth(authorization, x_cron_secret)
        return run_readings_autofetch(
            attempts=body.attempts,
            sundays_ahead=body.sundays_ahead,
            scope=body.scope,
            dry_run=body.dry_run,
            alert=body.alert,
        )
