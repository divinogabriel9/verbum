"""Parish/user Mass Builder habit learning — frequency + recency scoring.

Learns stable generate choices from ``generation_history.output_summary.habits``
and returns smart defaults so returning users spend less time in the wizard.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from typing import Any, Mapping, Optional

from services.auth_config import supabase_enabled
from services.platform_cache import cache_get_json, cache_set_json

logger = logging.getLogger(__name__)

LOOKBACK_DAYS = 30
MIN_SAMPLES_ENUM = 3
MIN_SAMPLES_SONG = 2
CONFIDENCE_THRESHOLD = 0.55
RECENCY_HALF_LIFE_DAYS = 14.0
CACHE_TTL_S = 120

SONG_SLOTS = (
    "entrance",
    "offertory",
    "communion_1",
    "communion_2",
    "recessional",
    "meditation",
)

# Stable rite / branding knobs (not date-specific readings).
ENUM_FIELDS = (
    "creed_choice",
    "our_father_choice",
    "mass_language",
    "hymn_lyrics_layout",
    "lotw_poster",
    "lote_poster",
    "poster_template",
    "include_church_logo",
    "include_church_name",
    "include_footer",
)

_ALLOWED: dict[str, frozenset[Any]] = {
    "creed_choice": frozenset({"nicene", "apostles"}),
    "our_father_choice": frozenset({"english", "malay", "tagalog", "visaya", "korean"}),
    "mass_language": frozenset({"english", "tagalog"}),
    "hymn_lyrics_layout": frozenset({"single", "dual"}),
    "lotw_poster": frozenset({"lotw1", "lotw2", "lotw3", "lotw4"}),
    "lote_poster": frozenset({"lote1", "lote2", "lote3", "lote4"}),
    "poster_template": frozenset({"liturgical_color", "classic_white"}),
    "include_church_logo": frozenset({True, False}),
    "include_church_name": frozenset({True, False}),
    "include_footer": frozenset({True, False}),
}


@dataclass(frozen=True)
class HabitPick:
    value: Any
    confidence: float
    samples: int
    source: str  # user | parish


def snapshot_from_generate(
    *,
    songs: Optional[Mapping[str, Any]] = None,
    creed_choice: str = "nicene",
    our_father_choice: str = "english",
    mass_language: str = "english",
    hymn_lyrics_layout: str = "dual",
    include_church_logo: bool = False,
    include_church_name: bool = False,
    include_footer: bool = False,
    lotw_poster: str = "lotw1",
    lote_poster: str = "lote1",
    poster_template: str = "liturgical_color",
    celebrant: str = "",
    season: str = "",
    gospel_mood: str = "",
) -> dict[str, Any]:
    """Compact preference blob stored under ``output_summary.habits``."""
    song_map: dict[str, str] = {}
    if songs:
        for slot in SONG_SLOTS:
            raw = songs.get(slot)
            hid = str(raw or "").strip()
            if hid:
                song_map[slot] = hid
    creed = str(creed_choice or "nicene").strip().lower()
    if creed not in _ALLOWED["creed_choice"]:
        creed = "nicene"
    of_choice = str(our_father_choice or "english").strip().lower()
    if of_choice not in _ALLOWED["our_father_choice"]:
        of_choice = "english"
    mass_lang = str(mass_language or "english").strip().lower()
    if mass_lang not in _ALLOWED["mass_language"]:
        mass_lang = "english"
    layout = str(hymn_lyrics_layout or "dual").strip().lower()
    if layout not in _ALLOWED["hymn_lyrics_layout"]:
        layout = "dual"
    lotw = str(lotw_poster or "lotw1").strip().lower()
    if lotw not in _ALLOWED["lotw_poster"]:
        lotw = "lotw1"
    lote = str(lote_poster or "lote1").strip().lower()
    if lote not in _ALLOWED["lote_poster"]:
        lote = "lote1"
    poster = str(poster_template or "liturgical_color").strip().lower()
    if poster not in _ALLOWED["poster_template"]:
        poster = "liturgical_color"
    return {
        "v": 1,
        "songs": song_map,
        "creed_choice": creed,
        "our_father_choice": of_choice,
        "mass_language": mass_lang,
        "hymn_lyrics_layout": layout,
        "include_church_logo": bool(include_church_logo),
        "include_church_name": bool(include_church_name),
        "include_footer": bool(include_footer),
        "lotw_poster": lotw,
        "lote_poster": lote,
        "poster_template": poster,
        "celebrant": str(celebrant or "").strip()[:120],
        "season": str(season or "").strip().lower().replace(" ", "_")[:64],
        "gospel_mood": str(gospel_mood or "").strip().lower()[:32],
    }


def _parse_created_at(raw: Any) -> Optional[datetime]:
    if isinstance(raw, datetime):
        return raw if raw.tzinfo else raw.replace(tzinfo=timezone.utc)
    text = str(raw or "").strip()
    if not text:
        return None
    try:
        if text.endswith("Z"):
            text = text[:-1] + "+00:00"
        dt = datetime.fromisoformat(text)
        return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
    except ValueError:
        return None


def _event_weight(created_at: Optional[datetime], *, now: datetime, season_match: bool) -> float:
    if not created_at:
        w = 1.0
    else:
        age_days = max(0.0, (now - created_at).total_seconds() / 86400.0)
        w = 0.5 ** (age_days / RECENCY_HALF_LIFE_DAYS)
    if season_match:
        w *= 1.35
    return w


def _habits_from_row(row: Mapping[str, Any]) -> dict[str, Any]:
    summary = row.get("output_summary")
    if not isinstance(summary, dict):
        return {}
    habits = summary.get("habits")
    return habits if isinstance(habits, dict) else {}


def _score_categorical(
    events: list[tuple[dict[str, Any], float]],
    field: str,
    *,
    source: str,
) -> Optional[HabitPick]:
    allowed = _ALLOWED.get(field)
    if not allowed:
        return None
    scores: dict[Any, float] = {}
    counts: dict[Any, int] = {}
    total_w = 0.0
    samples = 0
    for habits, weight in events:
        raw = habits.get(field)
        if field.startswith("include_"):
            if not isinstance(raw, bool):
                continue
            val: Any = raw
        else:
            val = str(raw or "").strip().lower()
            if val not in allowed:
                continue
        scores[val] = scores.get(val, 0.0) + weight
        counts[val] = counts.get(val, 0) + 1
        total_w += weight
        samples += 1
    if samples < MIN_SAMPLES_ENUM or total_w <= 0:
        return None
    best_val, best_w = max(scores.items(), key=lambda kv: kv[1])
    confidence = best_w / total_w
    if confidence < CONFIDENCE_THRESHOLD:
        return None
    return HabitPick(
        value=best_val,
        confidence=round(confidence, 3),
        samples=counts.get(best_val, 0),
        source=source,
    )


def _score_song_slot(
    events: list[tuple[dict[str, Any], float]],
    slot: str,
    *,
    source: str,
    mood_key: str = "",
) -> Optional[HabitPick]:
    scores: dict[str, float] = {}
    counts: dict[str, int] = {}
    total_w = 0.0
    samples = 0
    mk = (mood_key or "").strip().lower()
    for habits, weight in events:
        songs = habits.get("songs")
        if not isinstance(songs, dict):
            continue
        hid = str(songs.get(slot) or "").strip()
        if not hid:
            continue
        w = weight
        if mk and str(habits.get("gospel_mood") or "").strip().lower() == mk:
            w *= 1.2
        scores[hid] = scores.get(hid, 0.0) + w
        counts[hid] = counts.get(hid, 0) + 1
        total_w += w
        samples += 1
    if samples < MIN_SAMPLES_SONG or total_w <= 0:
        return None
    best_id, best_w = max(scores.items(), key=lambda kv: kv[1])
    confidence = best_w / total_w
    if confidence < CONFIDENCE_THRESHOLD:
        return None
    return HabitPick(
        value=best_id,
        confidence=round(confidence, 3),
        samples=counts.get(best_id, 0),
        source=source,
    )


def _score_celebrant(
    events: list[tuple[dict[str, Any], float]],
    *,
    source: str,
) -> Optional[HabitPick]:
    scores: dict[str, float] = {}
    counts: dict[str, int] = {}
    total_w = 0.0
    samples = 0
    for habits, weight in events:
        name = str(habits.get("celebrant") or "").strip()
        if not name:
            continue
        scores[name] = scores.get(name, 0.0) + weight
        counts[name] = counts.get(name, 0) + 1
        total_w += weight
        samples += 1
    if samples < 2 or total_w <= 0:
        return None
    best, best_w = max(scores.items(), key=lambda kv: kv[1])
    confidence = best_w / total_w
    if confidence < CONFIDENCE_THRESHOLD:
        return None
    return HabitPick(
        value=best,
        confidence=round(confidence, 3),
        samples=counts.get(best, 0),
        source=source,
    )


def _weighted_events(
    rows: list[dict[str, Any]],
    *,
    season: str,
    now: datetime,
) -> list[tuple[dict[str, Any], float]]:
    season_key = (season or "").strip().lower()
    out: list[tuple[dict[str, Any], float]] = []
    for row in rows:
        habits = _habits_from_row(row)
        if not habits:
            continue
        created = _parse_created_at(row.get("created_at"))
        season_match = bool(
            season_key and str(habits.get("season") or "").strip().lower() == season_key
        )
        out.append((habits, _event_weight(created, now=now, season_match=season_match)))
    return out


def _pick_better(a: Optional[HabitPick], b: Optional[HabitPick]) -> Optional[HabitPick]:
    if a and not b:
        return a
    if b and not a:
        return b
    if not a or not b:
        return None
    # Prefer user; otherwise higher confidence.
    if a.source == "user" and b.source != "user":
        return a
    if b.source == "user" and a.source != "user":
        return b
    return a if a.confidence >= b.confidence else b


def compute_smart_defaults(
    *,
    user_rows: list[dict[str, Any]],
    parish_rows: list[dict[str, Any]],
    season: str = "",
    gospel_mood: str = "",
    seasonal_songs: Optional[Mapping[str, str]] = None,
    now: Optional[datetime] = None,
) -> dict[str, Any]:
    """Merge user + parish habit scores into a UI-ready defaults payload."""
    clock = now or datetime.now(timezone.utc)
    user_events = _weighted_events(user_rows, season=season, now=clock)
    parish_events = _weighted_events(parish_rows, season=season, now=clock)

    suggestions: dict[str, Any] = {}
    confidence: dict[str, Any] = {}
    sources: dict[str, str] = {}

    for field in ENUM_FIELDS:
        pick = _pick_better(
            _score_categorical(user_events, field, source="user"),
            _score_categorical(parish_events, field, source="parish"),
        )
        if pick:
            suggestions[field] = pick.value
            confidence[field] = {
                "confidence": pick.confidence,
                "samples": pick.samples,
                "source": pick.source,
            }
            sources[field] = pick.source

    songs_out: dict[str, str] = {}
    song_meta: dict[str, Any] = {}
    for slot in SONG_SLOTS:
        pick = _pick_better(
            _score_song_slot(user_events, slot, source="user", mood_key=gospel_mood),
            _score_song_slot(parish_events, slot, source="parish", mood_key=gospel_mood),
        )
        if pick:
            songs_out[slot] = str(pick.value)
            song_meta[slot] = {
                "confidence": pick.confidence,
                "samples": pick.samples,
                "source": pick.source,
            }
            sources[f"songs.{slot}"] = pick.source

    # Fill remaining song slots from seasonal/mood defaults.
    if seasonal_songs:
        for slot, hid in seasonal_songs.items():
            sk = str(slot).strip()
            hv = str(hid or "").strip()
            if sk in SONG_SLOTS and hv and sk not in songs_out:
                songs_out[sk] = hv
                song_meta[sk] = {
                    "confidence": 0.0,
                    "samples": 0,
                    "source": "seasonal",
                }

    if songs_out:
        suggestions["songs"] = songs_out
        confidence["songs"] = song_meta

    cel = _pick_better(
        _score_celebrant(user_events, source="user"),
        _score_celebrant(parish_events, source="parish"),
    )
    if cel:
        suggestions["celebrant"] = cel.value
        confidence["celebrant"] = {
            "confidence": cel.confidence,
            "samples": cel.samples,
            "source": cel.source,
        }
        sources["celebrant"] = cel.source

    habit_field_count = sum(
        1
        for k in suggestions
        if k != "songs" or any(
            (confidence.get("songs") or {}).get(s, {}).get("source") in {"user", "parish"}
            for s in SONG_SLOTS
        )
    )
    # Count only fields learned from habits (not pure seasonal fill).
    learned = 0
    for key, meta in confidence.items():
        if key == "songs":
            learned += sum(
                1
                for slot_meta in (meta or {}).values()
                if isinstance(slot_meta, dict) and slot_meta.get("source") in {"user", "parish"}
            )
        elif isinstance(meta, dict) and meta.get("source") in {"user", "parish"}:
            learned += 1

    return {
        "ok": True,
        "has_habits": learned > 0,
        "learned_count": learned,
        "lookback_days": LOOKBACK_DAYS,
        "season": season or None,
        "gospel_mood": gospel_mood or None,
        "suggestions": suggestions,
        "confidence": confidence,
        "sources": sources,
        "sample_counts": {
            "user": len(user_events),
            "parish": len(parish_events),
        },
        "hint": (
            "Based on your usual Mass settings from the last month."
            if learned
            else "Not enough recent Masses yet — using seasonal defaults."
        ),
        # keep unused var referenced for linters / future UI
        "_habit_field_count": habit_field_count,
    }


def _lookback_iso(*, now: Optional[datetime] = None) -> str:
    clock = now or datetime.now(timezone.utc)
    start = clock - timedelta(days=LOOKBACK_DAYS)
    return start.isoformat()


def fetch_user_generation_rows(
    user_id: str,
    *,
    access_token: Optional[str] = None,
    limit: int = 40,
) -> list[dict[str, Any]]:
    if not supabase_enabled() or not (user_id or "").strip():
        return []
    try:
        from services.supabase_client import _client_for_user

        client = _client_for_user(access_token)
        cols = "id, user_id, mass_date, celebrant, output_summary, created_at, parish_id"
        try:
            result = (
                client.table("generation_history")
                .select(cols)
                .eq("user_id", user_id.strip())
                .gte("created_at", _lookback_iso())
                .order("created_at", desc=True)
                .limit(max(1, min(limit, 80)))
                .execute()
            )
        except Exception:
            result = (
                client.table("generation_history")
                .select("id, user_id, mass_date, celebrant, output_summary, created_at")
                .eq("user_id", user_id.strip())
                .gte("created_at", _lookback_iso())
                .order("created_at", desc=True)
                .limit(max(1, min(limit, 80)))
                .execute()
            )
        return list(result.data or [])
    except Exception:
        logger.debug("mass_habits user history fetch failed", exc_info=True)
        return []


def fetch_parish_generation_rows(
    parish_id: str,
    *,
    exclude_user_id: str = "",
    limit: int = 60,
) -> list[dict[str, Any]]:
    pid = (parish_id or "").strip()
    if not supabase_enabled() or not pid:
        return []
    try:
        from services.supabase_client import get_service_client

        client = get_service_client()
        q = (
            client.table("generation_history")
            .select("id, user_id, mass_date, celebrant, output_summary, created_at, parish_id")
            .eq("parish_id", pid)
            .gte("created_at", _lookback_iso())
            .order("created_at", desc=True)
            .limit(max(1, min(limit, 100)))
        )
        result = q.execute()
        rows = list(result.data or [])
        excl = (exclude_user_id or "").strip()
        if excl:
            rows = [r for r in rows if str(r.get("user_id") or "") != excl]
        return rows
    except Exception:
        logger.debug("mass_habits parish history fetch failed", exc_info=True)
        return []


def smart_defaults_for_session(
    *,
    user_id: str,
    parish_id: str = "",
    access_token: Optional[str] = None,
    mass_date: str = "",
    season: str = "",
    gospel_mood: str = "",
    seasonal_songs: Optional[Mapping[str, str]] = None,
) -> dict[str, Any]:
    """Cached smart-defaults resolver for the API."""
    uid = (user_id or "").strip()
    pid = (parish_id or "").strip()
    d = (mass_date or "").strip() or str(date.today())
    season_key = (season or "").strip().lower()
    mood_key = (gospel_mood or "").strip().lower()
    cache_key = f"verbum:habits:v1:{uid}:{pid}:{d}:{season_key}:{mood_key}"
    hit = cache_get_json(cache_key)
    if isinstance(hit, dict) and hit.get("ok"):
        return hit

    user_rows = fetch_user_generation_rows(uid, access_token=access_token)
    parish_rows = fetch_parish_generation_rows(pid, exclude_user_id=uid) if pid else []
    payload = compute_smart_defaults(
        user_rows=user_rows,
        parish_rows=parish_rows,
        season=season_key,
        gospel_mood=mood_key,
        seasonal_songs=seasonal_songs,
    )
    # Drop internal helper key from API response.
    payload.pop("_habit_field_count", None)
    try:
        cache_set_json(cache_key, payload, ttl_s=CACHE_TTL_S)
    except Exception:
        pass
    return payload
