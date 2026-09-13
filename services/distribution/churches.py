"""Distribution church (prospect) CRUD, import, and LiturgyFlow activity."""

from __future__ import annotations

import logging
import re
from datetime import timedelta
from typing import Any, Optional

from services.distribution._client import parse_iso, require_client, utc_now, utc_now_iso
from services.distribution.activities import list_activities, log_activity
from services.distribution.constants import (
    CHURCH_WRITABLE_FIELDS,
    PIPELINE_LABELS,
    PIPELINE_STATUSES,
    PRIORITIES,
)

logger = logging.getLogger(__name__)

_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _clean_payload(payload: dict[str, Any], *, allow_status: bool = True) -> dict[str, Any]:
    out: dict[str, Any] = {}
    for key, value in (payload or {}).items():
        if key not in CHURCH_WRITABLE_FIELDS:
            continue
        if key == "pipeline_status" and not allow_status:
            continue
        if key == "pipeline_status" and value is not None:
            status = str(value).strip().lower()
            if status not in PIPELINE_STATUSES:
                raise ValueError(f"Invalid pipeline_status: {value}")
            out[key] = status
            continue
        if key == "priority" and value is not None:
            pri = str(value).strip().lower()
            if pri not in PRIORITIES:
                raise ValueError(f"Invalid priority: {value}")
            out[key] = pri
            continue
        if key == "email" and value is not None:
            email = str(value).strip().lower()
            out[key] = email or None
            continue
        if isinstance(value, str):
            cleaned = value.strip()
            out[key] = cleaned if cleaned else None
        else:
            out[key] = value
    return out


def list_churches(filters: Optional[dict[str, Any]] = None) -> list[dict[str, Any]]:
    filters = filters or {}
    client = require_client()
    query = client.table("distribution_churches").select("*")

    campaign_id = str(filters.get("campaign_id") or "").strip()
    if campaign_id:
        link = (
            client.table("distribution_campaign_churches")
            .select("church_id")
            .eq("campaign_id", campaign_id)
            .execute()
        )
        ids = [str(r["church_id"]) for r in (link.data or []) if r.get("church_id")]
        if not ids:
            return []
        query = query.in_("id", ids)

    for key in (
        "country",
        "city",
        "diocese",
        "language",
        "mass_language",
        "pipeline_status",
        "priority",
        "subscription_status",
        "demo_status",
    ):
        val = filters.get(key)
        if val is not None and str(val).strip() != "":
            query = query.eq(key, str(val).strip())

    if filters.get("has_account") is True or str(filters.get("has_account") or "").lower() in {
        "1",
        "true",
        "yes",
    }:
        query = query.not_.is_("parish_id", "null")
    elif filters.get("has_account") is False or str(filters.get("has_account") or "").lower() in {
        "0",
        "false",
        "no",
    }:
        query = query.is_("parish_id", "null")

    trial_status = str(filters.get("trial_status") or "").strip().lower()
    now = utc_now()
    if trial_status == "active":
        query = (
            query.not_.is_("trial_expires_at", "null")
            .gte("trial_expires_at", now.isoformat())
            .eq("pipeline_status", "trial")
        )
    elif trial_status == "expired":
        query = query.not_.is_("trial_expires_at", "null").lt(
            "trial_expires_at", now.isoformat()
        )
    elif trial_status == "none":
        query = query.is_("trial_expires_at", "null")

    last_from = filters.get("last_contacted_from") or filters.get("last_contacted_at_from")
    last_to = filters.get("last_contacted_to") or filters.get("last_contacted_at_to")
    if last_from:
        query = query.gte("last_contacted_at", str(last_from))
    if last_to:
        query = query.lte("last_contacted_at", str(last_to))

    fu_from = filters.get("follow_up_from") or filters.get("next_follow_up_from")
    fu_to = filters.get("follow_up_to") or filters.get("next_follow_up_to")
    if fu_from:
        query = query.gte("next_follow_up_at", str(fu_from))
    if fu_to:
        query = query.lte("next_follow_up_at", str(fu_to))

    limit = int(filters.get("limit") or 200)
    offset = int(filters.get("offset") or 0)
    query = query.order("updated_at", desc=True).range(
        max(0, offset), max(0, offset) + max(1, min(limit, 500)) - 1
    )
    result = query.execute()
    rows = list(result.data or [])

    q = str(filters.get("q") or "").strip().lower()
    if q:
        rows = [
            r
            for r in rows
            if q
            in " ".join(
                [
                    str(r.get("parish_name") or ""),
                    str(r.get("email") or ""),
                    str(r.get("city") or ""),
                    str(r.get("contact_person") or ""),
                    str(r.get("diocese") or ""),
                    str(r.get("country") or ""),
                ]
            ).lower()
        ]

    if filters.get("has_activity") is True or str(filters.get("has_activity") or "").lower() in {
        "1",
        "true",
        "yes",
    }:
        if rows:
            ids = [str(r["id"]) for r in rows if r.get("id")]
            acts = (
                client.table("distribution_activities")
                .select("church_id")
                .in_("church_id", ids)
                .execute()
            )
            with_act = {str(a["church_id"]) for a in (acts.data or []) if a.get("church_id")}
            rows = [r for r in rows if str(r.get("id")) in with_act]
    elif filters.get("has_activity") is False or str(filters.get("has_activity") or "").lower() in {
        "0",
        "false",
        "no",
    }:
        if rows:
            ids = [str(r["id"]) for r in rows if r.get("id")]
            acts = (
                client.table("distribution_activities")
                .select("church_id")
                .in_("church_id", ids)
                .execute()
            )
            with_act = {str(a["church_id"]) for a in (acts.data or []) if a.get("church_id")}
            rows = [r for r in rows if str(r.get("id")) not in with_act]

    return rows


def get_church(church_id: str) -> dict[str, Any]:
    cid = (church_id or "").strip()
    if not cid:
        raise ValueError("church_id is required.")
    client = require_client()
    result = (
        client.table("distribution_churches").select("*").eq("id", cid).limit(1).execute()
    )
    rows = result.data or []
    if not rows:
        raise ValueError("Church not found.")
    church = rows[0]
    activities = list_activities(cid, limit=25)
    church["recent_activities"] = activities
    church["activity_count"] = len(activities)
    if activities:
        church["last_activity_at"] = activities[0].get("occurred_at")
    return church


def create_church(
    payload: dict[str, Any],
    actor_user_id: Optional[str] = None,
) -> dict[str, Any]:
    data = _clean_payload(payload or {})
    name = (data.get("parish_name") or "").strip()
    if not name:
        raise ValueError("parish_name is required.")
    data["parish_name"] = name
    if "pipeline_status" not in data:
        data["pipeline_status"] = "discovered"
    if "priority" not in data:
        data["priority"] = "medium"
    data["stage_entered_at"] = utc_now_iso()

    client = require_client()
    result = client.table("distribution_churches").insert(data).execute()
    rows = result.data or []
    if not rows:
        raise RuntimeError("Church create did not persist.")
    church = rows[0]
    try:
        log_activity(
            str(church["id"]),
            "discovered",
            "Church discovered",
            actor_user_id=actor_user_id,
            detail={"parish_name": name},
        )
    except Exception:
        logger.exception("Failed to log discovery activity")
    return church


def update_church(
    church_id: str,
    payload: dict[str, Any],
    actor_user_id: Optional[str] = None,
) -> dict[str, Any]:
    cid = (church_id or "").strip()
    if not cid:
        raise ValueError("church_id is required.")
    existing = get_church(cid)
    data = _clean_payload(payload or {}, allow_status=True)
    if not data:
        return existing

    status_changed = (
        "pipeline_status" in data
        and data["pipeline_status"] != existing.get("pipeline_status")
    )
    if status_changed:
        data["stage_entered_at"] = utc_now_iso()

    client = require_client()
    result = (
        client.table("distribution_churches").update(data).eq("id", cid).execute()
    )
    rows = result.data or []
    if not rows:
        raise RuntimeError("Church update did not persist.")
    updated = rows[0]

    if status_changed:
        old = str(existing.get("pipeline_status") or "")
        new = str(data["pipeline_status"])
        try:
            log_activity(
                cid,
                "status_change",
                f"Moved from {PIPELINE_LABELS.get(old, old)} → {PIPELINE_LABELS.get(new, new)}",
                actor_user_id=actor_user_id,
                detail={"from": old, "to": new},
            )
        except Exception:
            logger.exception("Failed to log status change")
    else:
        try:
            log_activity(
                cid,
                "update",
                "Church profile updated",
                actor_user_id=actor_user_id,
                detail={"fields": sorted(data.keys())},
            )
        except Exception:
            logger.exception("Failed to log update activity")
    return updated


def set_pipeline_status(
    church_id: str,
    status: str,
    actor_user_id: Optional[str] = None,
) -> dict[str, Any]:
    new_status = (status or "").strip().lower()
    if new_status not in PIPELINE_STATUSES:
        raise ValueError(f"Invalid status. Must be one of: {', '.join(PIPELINE_STATUSES)}")
    cid = (church_id or "").strip()
    existing = get_church(cid)
    old = str(existing.get("pipeline_status") or "")
    if old == new_status:
        return existing

    patch: dict[str, Any] = {
        "pipeline_status": new_status,
        "stage_entered_at": utc_now_iso(),
    }
    now = utc_now()
    if new_status == "trial" and not existing.get("trial_start_at"):
        patch["trial_start_at"] = now.isoformat()
        if not existing.get("trial_expires_at"):
            patch["trial_expires_at"] = (now + timedelta(days=14)).isoformat()

    client = require_client()
    result = client.table("distribution_churches").update(patch).eq("id", cid).execute()
    rows = result.data or []
    if not rows:
        raise RuntimeError("Status update did not persist.")
    try:
        log_activity(
            cid,
            "status_change",
            f"Moved from {PIPELINE_LABELS.get(old, old)} → {PIPELINE_LABELS.get(new_status, new_status)}",
            actor_user_id=actor_user_id,
            detail={"from": old, "to": new_status},
        )
    except Exception:
        logger.exception("Failed to log pipeline status change")
    return rows[0]


def delete_church(church_id: str) -> dict[str, Any]:
    cid = (church_id or "").strip()
    if not cid:
        raise ValueError("church_id is required.")
    client = require_client()
    existing = (
        client.table("distribution_churches").select("id").eq("id", cid).limit(1).execute()
    )
    if not (existing.data or []):
        raise ValueError("Church not found.")
    client.table("distribution_churches").delete().eq("id", cid).execute()
    return {"ok": True, "id": cid}


def get_church_liturgyflow_activity(church: dict[str, Any]) -> dict[str, Any]:
    """Summarize LiturgyFlow product usage for a linked parish account."""
    parish_id = str((church or {}).get("parish_id") or "").strip()
    empty = {
        "linked": False,
        "parish_id": None,
        "generation_count": 0,
        "first_generation_at": None,
        "last_generation_at": None,
        "member_count": 0,
        "members_created_at": [],
        "profiles_last_seen": [],
        "poster_count": 0,
    }
    if not parish_id:
        return empty

    client = require_client()
    out = {**empty, "linked": True, "parish_id": parish_id}

    try:
        gens = (
            client.table("generation_history")
            .select("id, created_at, output_summary")
            .eq("parish_id", parish_id)
            .order("created_at", desc=False)
            .limit(2000)
            .execute()
        )
        gen_rows = list(gens.data or [])
        out["generation_count"] = len(gen_rows)
        if gen_rows:
            out["first_generation_at"] = gen_rows[0].get("created_at")
            out["last_generation_at"] = gen_rows[-1].get("created_at")
            posters = 0
            for g in gen_rows:
                summary = g.get("output_summary") or {}
                if isinstance(summary, dict):
                    if summary.get("poster") or summary.get("posters") or summary.get(
                        "has_poster"
                    ):
                        posters += 1
                    files = summary.get("files") or summary.get("outputs") or []
                    if isinstance(files, list):
                        for f in files:
                            name = str(f if isinstance(f, str) else (f or {}).get("name") or "")
                            if "poster" in name.lower():
                                posters += 1
            out["poster_count"] = posters
    except Exception:
        logger.exception("generation_history lookup failed for parish %s", parish_id)

    member_user_ids: list[str] = []
    try:
        members = (
            client.table("parish_members")
            .select("user_id, created_at, role, status")
            .eq("parish_id", parish_id)
            .eq("status", "active")
            .execute()
        )
        member_rows = list(members.data or [])
        out["member_count"] = len(member_rows)
        out["members_created_at"] = [
            {"user_id": m.get("user_id"), "created_at": m.get("created_at"), "role": m.get("role")}
            for m in member_rows
        ]
        member_user_ids = [str(m["user_id"]) for m in member_rows if m.get("user_id")]
    except Exception:
        logger.exception("parish_members lookup failed for parish %s", parish_id)

    if member_user_ids:
        try:
            profiles = (
                client.table("profiles")
                .select("id, last_seen_at, email, first_name, last_name")
                .in_("id", member_user_ids[:200])
                .execute()
            )
            out["profiles_last_seen"] = list(profiles.data or [])
        except Exception:
            logger.exception("profiles last_seen lookup failed")

        if out.get("poster_count", 0) == 0:
            try:
                assets = (
                    client.table("user_media_assets")
                    .select("id", count="exact")
                    .in_("user_id", member_user_ids[:200])
                    .eq("asset_type", "poster")
                    .limit(0)
                    .execute()
                )
                out["poster_count"] = int(assets.count or 0)
            except Exception:
                logger.exception("user_media_assets poster count failed")

    return out


def _duplicate_key(row: dict[str, Any]) -> tuple[str, ...]:
    email = str(row.get("email") or "").strip().lower()
    if email:
        return ("email", email)
    name = str(row.get("parish_name") or "").strip().lower()
    city = str(row.get("city") or "").strip().lower()
    country = str(row.get("country") or "").strip().lower()
    return ("place", name, city, country)


def import_churches_preview(rows: list[dict[str, Any]]) -> dict[str, Any]:
    """Validate CSV-like row dicts and flag duplicates / errors."""
    client = require_client()
    existing = (
        client.table("distribution_churches")
        .select("id, parish_name, email, city, country")
        .limit(5000)
        .execute()
    )
    existing_rows = list(existing.data or [])
    existing_by_key: dict[tuple[str, ...], dict[str, Any]] = {}
    for er in existing_rows:
        existing_by_key[_duplicate_key(er)] = er

    preview: list[dict[str, Any]] = []
    seen_in_batch: dict[tuple[str, ...], int] = {}

    for idx, raw in enumerate(rows or []):
        item: dict[str, Any] = {
            "index": idx,
            "row": raw,
            "ok": True,
            "errors": [],
            "warnings": [],
            "duplicate_of": None,
        }
        name = str(raw.get("parish_name") or "").strip()
        if not name:
            item["ok"] = False
            item["errors"].append("parish_name is required")

        email = str(raw.get("email") or "").strip().lower()
        if email and not _EMAIL_RE.match(email):
            item["ok"] = False
            item["errors"].append("invalid email")

        status = str(raw.get("pipeline_status") or "discovered").strip().lower()
        if status and status not in PIPELINE_STATUSES:
            item["ok"] = False
            item["errors"].append(f"invalid pipeline_status: {status}")

        priority = str(raw.get("priority") or "medium").strip().lower()
        if priority and priority not in PRIORITIES:
            item["ok"] = False
            item["errors"].append(f"invalid priority: {priority}")

        email_key = ("email", email) if email else None
        place_key = (
            "place",
            name.lower(),
            str(raw.get("city") or "").strip().lower(),
            str(raw.get("country") or "").strip().lower(),
        )
        batch_key = email_key or place_key

        if email_key and email_key in existing_by_key:
            item["warnings"].append("duplicate email")
            item["duplicate_of"] = existing_by_key[email_key].get("id")
        elif name and place_key[2] and place_key[3] and place_key in existing_by_key:
            item["warnings"].append("duplicate parish_name+city+country")
            item["duplicate_of"] = existing_by_key[place_key].get("id")

        if batch_key in seen_in_batch:
            item["warnings"].append(
                f"duplicate within import (row {seen_in_batch[batch_key]})"
            )
        else:
            seen_in_batch[batch_key] = idx

        preview.append(item)

    return {
        "ok": True,
        "total": len(preview),
        "valid": sum(1 for p in preview if p["ok"]),
        "invalid": sum(1 for p in preview if not p["ok"]),
        "duplicates": sum(1 for p in preview if p.get("duplicate_of")),
        "rows": preview,
    }


def import_churches(
    rows: list[dict[str, Any]],
    actor_user_id: Optional[str] = None,
    *,
    skip_duplicates: bool = True,
) -> dict[str, Any]:
    preview = import_churches_preview(rows)
    created: list[dict[str, Any]] = []
    skipped: list[dict[str, Any]] = []
    errors: list[dict[str, Any]] = []

    for item in preview["rows"]:
        if not item["ok"]:
            errors.append(item)
            continue
        if skip_duplicates and item.get("duplicate_of"):
            skipped.append(item)
            continue
        raw = item["row"]
        try:
            payload = {
                "parish_name": raw.get("parish_name"),
                "diocese": raw.get("diocese"),
                "country": raw.get("country"),
                "state_province": raw.get("state_province") or raw.get("state"),
                "city": raw.get("city"),
                "address": raw.get("address"),
                "website": raw.get("website"),
                "contact_person": raw.get("contact_person"),
                "contact_role": raw.get("contact_role"),
                "email": raw.get("email"),
                "phone": raw.get("phone"),
                "language": raw.get("language"),
                "mass_language": raw.get("mass_language"),
                "pipeline_status": raw.get("pipeline_status") or "discovered",
                "priority": raw.get("priority") or "medium",
                "notes": raw.get("notes"),
                "referral_source": raw.get("referral_source") or "import",
            }
            church = create_church(payload, actor_user_id=actor_user_id)
            created.append(church)
        except Exception as exc:
            errors.append({"index": item["index"], "error": str(exc), "row": raw})

    return {
        "ok": True,
        "created_count": len(created),
        "skipped_count": len(skipped),
        "error_count": len(errors),
        "created": created,
        "skipped": skipped,
        "errors": errors,
    }


def complete_follow_up(
    church_id: str,
    note: Optional[str] = None,
    actor_user_id: Optional[str] = None,
) -> dict[str, Any]:
    cid = (church_id or "").strip()
    existing = get_church(cid)
    client = require_client()
    patch = {
        "next_follow_up_at": None,
        "next_follow_up_note": None,
        "last_contacted_at": utc_now_iso(),
    }
    result = client.table("distribution_churches").update(patch).eq("id", cid).execute()
    rows = result.data or []
    if not rows:
        raise RuntimeError("Follow-up complete did not persist.")
    summary = "Follow-up completed"
    if note:
        summary = f"Follow-up completed: {note.strip()}"
    try:
        log_activity(
            cid,
            "follow_up_complete",
            summary,
            actor_user_id=actor_user_id,
            detail={
                "previous_follow_up_at": existing.get("next_follow_up_at"),
                "note": (note or "").strip() or None,
            },
        )
    except Exception:
        logger.exception("Failed to log follow-up complete")
    return rows[0]


def reschedule_follow_up(
    church_id: str,
    at: str,
    note: Optional[str] = None,
    actor_user_id: Optional[str] = None,
) -> dict[str, Any]:
    cid = (church_id or "").strip()
    when = parse_iso(at)
    if not when:
        raise ValueError("Invalid follow-up datetime.")
    client = require_client()
    patch = {
        "next_follow_up_at": when.isoformat(),
        "next_follow_up_note": (note or "").strip() or None,
    }
    result = client.table("distribution_churches").update(patch).eq("id", cid).execute()
    rows = result.data or []
    if not rows:
        raise RuntimeError("Follow-up reschedule did not persist.")
    try:
        log_activity(
            cid,
            "follow_up_reschedule",
            f"Follow-up rescheduled to {when.isoformat()}",
            actor_user_id=actor_user_id,
            detail={"at": when.isoformat(), "note": patch["next_follow_up_note"]},
        )
    except Exception:
        logger.exception("Failed to log follow-up reschedule")
    return rows[0]


def list_follow_ups(*, today: bool = True, overdue: bool = True) -> dict[str, Any]:
    client = require_client()
    now = utc_now()
    start_today = now.replace(hour=0, minute=0, second=0, microsecond=0)
    end_today = start_today + timedelta(days=1)

    result = (
        client.table("distribution_churches")
        .select("*")
        .not_.is_("next_follow_up_at", "null")
        .order("next_follow_up_at", desc=False)
        .limit(500)
        .execute()
    )
    rows = list(result.data or [])
    today_rows: list[dict[str, Any]] = []
    overdue_rows: list[dict[str, Any]] = []
    upcoming: list[dict[str, Any]] = []

    for row in rows:
        at = parse_iso(row.get("next_follow_up_at"))
        if not at:
            continue
        if at < start_today:
            overdue_rows.append(row)
        elif at < end_today:
            today_rows.append(row)
        else:
            upcoming.append(row)

    out: dict[str, Any] = {"ok": True}
    if today:
        out["today"] = today_rows
    if overdue:
        out["overdue"] = overdue_rows
    out["upcoming"] = upcoming[:50]
    out["counts"] = {
        "today": len(today_rows),
        "overdue": len(overdue_rows),
        "upcoming": len(upcoming),
    }
    return out
