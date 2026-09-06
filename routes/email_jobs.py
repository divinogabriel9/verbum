"""Internal email reminder jobs (cron / manual trigger)."""

from __future__ import annotations

from typing import Any, Literal, Optional

from fastapi import Header, HTTPException, Query
from pydantic import BaseModel, Field

from services.admin_alerts import admin_alerts_status, emit_admin_alert
from services.cron_auth import cron_secret_configured, require_cron_auth
from services.email import (
    app_home_url,
    email_config_status,
    email_enabled,
    reminders_enabled,
    send_email,
    wrap_html,
)
from services.email_reminders import list_reminder_recipients, run_weekly_reminders
from services.telegram_notify import telegram_enabled


class ReminderRunBody(BaseModel):
    kind: Literal["auto", "mass_pptx", "practice_share", "both"] = "both"
    mass_date: Optional[str] = Field(None, max_length=16)
    dry_run: bool = False
    force: bool = True
    audience: Literal["presidents", "all_members"] = "all_members"


class EmailTestBody(BaseModel):
    to: str = Field(..., min_length=3, max_length=320)


def register_email_job_routes(app) -> None:
    @app.get("/api/internal/email-reminders/status")
    def api_email_reminders_status(
        authorization: Optional[str] = Header(None),
        x_cron_secret: Optional[str] = Header(None, alias="X-Cron-Secret"),
    ) -> dict[str, Any]:
        require_cron_auth(authorization, x_cron_secret)
        status = email_config_status()
        return {
            "ok": True,
            "email_configured": email_enabled(),
            "reminders_enabled": reminders_enabled(),
            "cron_secret_configured": cron_secret_configured(),
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
        require_cron_auth(authorization, x_cron_secret)
        return list_reminder_recipients(audience=audience, mass_date=mass_date)

    @app.post("/api/internal/email/test")
    def api_email_test(
        body: EmailTestBody,
        authorization: Optional[str] = Header(None),
        x_cron_secret: Optional[str] = Header(None, alias="X-Cron-Secret"),
    ) -> dict[str, Any]:
        """Send one transactional test email (Brevo setup step 5)."""
        require_cron_auth(authorization, x_cron_secret)
        to = (body.to or "").strip().lower()
        if "@" not in to:
            raise HTTPException(status_code=400, detail="Valid to email required.")
        result = send_email(
            to=to,
            subject="LiturgyFlow Brevo test",
            text="If you received this, transactional email is working.",
            html=wrap_html(
                title="Brevo test OK",
                subtitle="Transactional email from LiturgyFlow is working.",
                cta_label="Open LiturgyFlow",
                cta_url=app_home_url(),
                preheader="Brevo transactional test",
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
        require_cron_auth(authorization, x_cron_secret)
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
        require_cron_auth(authorization, x_cron_secret)
        return run_weekly_reminders(
            kind=kind,
            mass_date=mass_date,
            dry_run=dry_run,
            force=force,
            audience=audience,
        )

    @app.get("/api/internal/admin-alerts/status")
    def api_admin_alerts_status(
        authorization: Optional[str] = Header(None),
        x_cron_secret: Optional[str] = Header(None, alias="X-Cron-Secret"),
    ) -> dict[str, Any]:
        require_cron_auth(authorization, x_cron_secret)
        return {"ok": True, **admin_alerts_status()}

    @app.post("/api/internal/admin-alerts/test")
    def api_admin_alerts_test(
        authorization: Optional[str] = Header(None),
        x_cron_secret: Optional[str] = Header(None, alias="X-Cron-Secret"),
    ) -> dict[str, Any]:
        """Send a sample operator alert on email + Telegram."""
        require_cron_auth(authorization, x_cron_secret)
        result = emit_admin_alert(
            kind="test",
            title="Alert test",
            subtitle="If you got this, admin alerts are working.",
            lines=[
                f"Email channel: {'on' if email_enabled() else 'off'}",
                f"Telegram channel: {'on' if telegram_enabled() else 'off'}",
            ],
        )
        return {
            "ok": result.ok,
            "email_ok": result.email_ok,
            "telegram_ok": result.telegram_ok,
            "email_errors": result.email_errors,
            "telegram_error": result.telegram_error,
            "recipients": result.recipients,
            "status": admin_alerts_status(),
        }
