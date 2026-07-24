"""Internal email reminder jobs (cron / manual trigger)."""

from __future__ import annotations

import hmac
import os
from typing import Any, Literal, Optional

from fastapi import Header, HTTPException, Query
from pydantic import BaseModel, Field

from services.email import email_enabled, reminders_enabled
from services.email_reminders import run_weekly_reminders


class ReminderRunBody(BaseModel):
    kind: Literal["auto", "mass_pptx", "practice_share"] = "auto"
    mass_date: Optional[str] = Field(None, max_length=16)
    dry_run: bool = False


def _cron_secret() -> str:
    return (
        os.environ.get("CRON_SECRET", "").strip()
        or os.environ.get("EMAIL_CRON_SECRET", "").strip()
    )


def _require_cron_auth(
    authorization: Optional[str] = None,
    x_cron_secret: Optional[str] = None,
) -> None:
    expected = _cron_secret()
    if not expected:
        raise HTTPException(
            status_code=503,
            detail="Set CRON_SECRET (or EMAIL_CRON_SECRET) to enable reminder jobs.",
        )
    provided = (x_cron_secret or "").strip()
    if not provided and authorization:
        auth = authorization.strip()
        if auth.lower().startswith("bearer "):
            provided = auth[7:].strip()
        else:
            provided = auth
    if not provided or not hmac.compare_digest(provided, expected):
        raise HTTPException(status_code=401, detail="Invalid cron secret.")


def register_email_job_routes(app) -> None:
    @app.get("/api/internal/email-reminders/status")
    def api_email_reminders_status(
        authorization: Optional[str] = Header(None),
        x_cron_secret: Optional[str] = Header(None, alias="X-Cron-Secret"),
    ) -> dict[str, Any]:
        _require_cron_auth(authorization, x_cron_secret)
        return {
            "ok": True,
            "email_configured": email_enabled(),
            "reminders_enabled": reminders_enabled(),
            "cron_secret_configured": bool(_cron_secret()),
        }

    @app.post("/api/internal/email-reminders/run")
    def api_email_reminders_run(
        body: ReminderRunBody,
        authorization: Optional[str] = Header(None),
        x_cron_secret: Optional[str] = Header(None, alias="X-Cron-Secret"),
    ) -> dict[str, Any]:
        _require_cron_auth(authorization, x_cron_secret)
        return run_weekly_reminders(
            kind=body.kind,
            mass_date=body.mass_date,
            dry_run=body.dry_run,
        )

    @app.post("/api/internal/email-reminders/run/{kind}")
    def api_email_reminders_run_kind(
        kind: Literal["auto", "mass_pptx", "practice_share"],
        dry_run: bool = Query(False),
        mass_date: Optional[str] = Query(None, max_length=16),
        authorization: Optional[str] = Header(None),
        x_cron_secret: Optional[str] = Header(None, alias="X-Cron-Secret"),
    ) -> dict[str, Any]:
        _require_cron_auth(authorization, x_cron_secret)
        return run_weekly_reminders(kind=kind, mass_date=mass_date, dry_run=dry_run)
