"""Distribution CRM constants."""

from __future__ import annotations

PIPELINE_STATUSES: tuple[str, ...] = (
    "discovered",
    "contacted",
    "interested",
    "demo",
    "trial",
    "activated",
    "paid",
    "referral",
)

PIPELINE_LABELS: dict[str, str] = {
    "discovered": "Discovered",
    "contacted": "Contacted",
    "interested": "Interested",
    "demo": "Demo",
    "trial": "Trial",
    "activated": "Activated",
    "paid": "Paid",
    "referral": "Referral",
}

PRIORITIES: tuple[str, ...] = ("low", "medium", "high")

INTERACTION_TYPES: tuple[str, ...] = (
    "email",
    "phone",
    "kakaotalk",
    "facebook",
    "in_person",
    "demo",
    "other",
)

STAGE_ORDER: tuple[str, ...] = PIPELINE_STATUSES

CAMPAIGN_STATUSES: tuple[str, ...] = ("draft", "active", "paused", "completed")

INVITE_STATUSES: tuple[str, ...] = ("pending", "accepted", "expired", "revoked")

REFERRAL_STATUSES: tuple[str, ...] = (
    "pending",
    "signed_up",
    "activated",
    "rewarded",
    "cancelled",
)

CHURCH_WRITABLE_FIELDS: frozenset[str] = frozenset(
    {
        "parish_id",
        "parish_name",
        "diocese",
        "country",
        "state_province",
        "city",
        "address",
        "website",
        "contact_person",
        "contact_role",
        "email",
        "phone",
        "messaging_platform",
        "language",
        "mass_language",
        "has_english_mass",
        "has_filipino_community",
        "has_media_ministry",
        "current_presentation_method",
        "current_software",
        "pipeline_status",
        "priority",
        "assigned_to",
        "notes",
        "referral_source",
        "referral_code",
        "lead_score",
        "lead_score_factors",
        "last_contacted_at",
        "next_follow_up_at",
        "next_follow_up_note",
        "demo_status",
        "trial_start_at",
        "trial_expires_at",
        "subscription_status",
    }
)
