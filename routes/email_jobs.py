"""Internal email reminder jobs (cron / manual trigger)."""

from __future__ import annotations

import hmac
import os
from typing import Any, Literal, Optional

from fastapi import Header, HTTPException, Query
from pydantic import BaseModel, Field

from services.email import email_config_status, email_enabled, reminders_enabled, send_email, wrap_html
from services.email_reminders import list_reminder_recipients, run_weekly_reminders


class ReminderRunBody(BaseModel):
    kind: Literal["auto", "mass_pptx", "practice_share", "both"] = "both"
    mass_date: Optional[str] = Field(None, max_length=16)
    dry_run: bool = False
    force: bool = True
    audience: Literal["presidents", "all_members"] = "all_members"


class EmailTestBody(BaseModel):
    to: str = Field(..., min_length=3, max_length=320)


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
        status = email_config_status()
        return {
            "ok": True,
            "email_configured": email_enabled(),
            "reminders_enabled": reminders_enabled(),
            "cron_secret_configured": bool(_cron_secret()),
            **status,
        }

    @app.get("/api/internal/email-reminders/recipients")
    def api_email_reminders_recipients(
        audience: Literal["presidents", "all_members"] = Query("all_members"),
        mass_date: Optional[str] = Query(None, max_length=16),
        authorization: Optional[str] = Header(None),
        x_cron_secret: Optional[str] = Header(None, alias="X-Cron-Secret"),
    ) -> dict[str, Any]:
        """List approved-parish user emails for Mass PPTX / practice-share reminders."""
        _require_cron_auth(authorization, x_cron_secret)
        return list_reminder_recipients(audience=audience, mass_date=mass_date)

    @app.post("/api/internal/email/test")
    def api_email_test(
        body: EmailTestBody,
        authorization: Optional[str] = Header(None),
        x_cron_secret: Optional[str] = Header(None, alias="X-Cron-Secret"),
    ) -> dict[str, Any]:
        """Send one transactional test email (Brevo setup step 5)."""
        _require_cron_auth(authorization, x_cron_secret)
        to = (body.to or "").strip().lower()
        if "@" not in to:
            raise HTTPException(status_code=400, detail="Valid to email required.")
        result = send_email(
            to=to,
            subject="LiturgyFlow Brevo test",
            text="If you received this, transactional email is working.",
            html=wrap_html(
                title="Brevo test OK",
                body_html="<p>Transactional email from LiturgyFlow is working.</p>",
            ),
        )
        return {
            "ok": result.ok,
            "provider": result.provider,
            "error": result.error,
            "to": to,
            "config": email_config_status(),
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
            force=body.force,
            audience=body.audience,
        )

    @app.post("/api/internal/email-reminders/run/{kind}")
    def api_email_reminders_run_kind(
        kind: Literal["auto", "mass_pptx", "practice_share", "both"],
        dry_run: bool = Query(False),
        force: bool = Query(True),
        mass_date: Optional[str] = Query(None, max_length=16),
        audience: Literal["presidents", "all_members"] = Query("all_members"),
        authorization: Optional[str] = Header(None),
        x_cron_secret: Optional[str] = Header(None, alias="X-Cron-Secret"),
    ) -> dict[str, Any]:
        _require_cron_auth(authorization, x_cron_secret)
        return run_weekly_reminders(
            kind=kind,
            mass_date=mass_date,
            dry_run=dry_run,
            force=force,
            audience=audience,
        )
