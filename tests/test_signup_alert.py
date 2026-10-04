"""First-login signup alert + mandatory onboarding helpers."""

from __future__ import annotations

from fastapi import HTTPException


def test_profile_onboarding_incomplete_without_timestamp():
    from services.onboarding import profile_onboarding_complete

    assert profile_onboarding_complete(None) is False
    assert profile_onboarding_complete({}) is False
    assert profile_onboarding_complete({"onboarding_completed_at": None}) is False
    assert profile_onboarding_complete({"onboarding_completed_at": "2026-10-04T00:00:00Z"})


def test_require_profile_onboarding_complete_raises():
    from services.onboarding import require_profile_onboarding_complete

    try:
        require_profile_onboarding_complete({"email": "a@b.com"})
        raise AssertionError("expected HTTPException")
    except HTTPException as exc:
        assert exc.status_code == 403
    require_profile_onboarding_complete({"onboarding_completed_at": "2026-10-04T00:00:00Z"})


def test_maybe_alert_new_signup_skips_already_alerted():
    from services import onboarding as ob

    assert (
        ob.maybe_alert_new_signup(
            "u1",
            email="ehmandc1234@gmail.com",
            profile={"id": "u1", "signup_alerted_at": "2026-10-04T01:00:00Z"},
        )
        is False
    )
