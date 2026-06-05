"""Shared mass media generation for CLI and web."""

from __future__ import annotations

from dataclasses import dataclass, field
import logging
import os
import random
from pathlib import Path
from typing import Any, Mapping, Optional

from generators.gospel_visual import render_gospel_moment
from generators.poster_generator import (
    PosterTemplate,
    export_social_variants,
    generate_mass_poster,
)
from generators.powerpoint import generate_mass_ppt
from services.community_config import get_community_name, get_logo_path, update_community
from services.gospel_quote_extractor import (
    first_sentence_slide_quote,
    pick_sentence_interactive,
    split_slide_sentences,
)
from services.hymn_library import get_hymn, recommend_sections, section_candidates, web_cached_for_section
from services.song_selection import default_song_selections_for_date, filter_songs_rows_en_tl_only

logger = logging.getLogger(__name__)
from services.liturgical_calendar import get_liturgical_color
from services.lectionary_service import get_liturgical_data
from services.media_naming import mass_export_stem
from services.web_hymn_discovery import discover_hymns_for_readings
from services.lyrics_fetcher import ensure_lyrics_for_song
from services.mass_text_format import synopsis_from_reading
from services.usccb_readings import enrich_psalm_text_for_slides


@dataclass
class PreviewPayload:
    ok: bool
    error: Optional[str] = None
    title: str = ""
    gospel_reference: str = ""
    season: str = ""
    lectionary_cycle: str = ""
    liturgical_color: Optional[Mapping[str, Any]] = None
    gospel_text_length: int = 0
    sentences: list[str] = field(default_factory=list)
    quote_attribution: Optional[str] = None
    songs_by_section: dict[str, list[dict[str, str]]] = field(default_factory=dict)
    gospel_quote: str = ""
    default_song_selections: dict[str, str] = field(default_factory=dict)
    estimated_slide_count: int = 0
    first_reading_reference: str = ""
    first_reading_excerpt: str = ""
    second_reading_reference: str = ""
    second_reading_excerpt: str = ""
    psalm_text: str = ""
    gospel_text: str = ""


def _merge_song_sections(
    base: dict[str, list[dict[str, Any]]],
    extra: dict[str, list[dict[str, Any]]],
    *,
    cap: int = 10,
) -> dict[str, list[dict[str, Any]]]:
    out: dict[str, list[dict[str, Any]]] = {}
    for sec in ("entrance", "offertory", "communion", "recessional", "meditation"):
        merged: list[dict[str, Any]] = []
        seen_ids: set[str] = set()
        seen_titles: set[str] = set()
        for row in (base.get(sec) or []) + (extra.get(sec) or []):
            hid = str(row.get("id") or "").strip()
            title = str(row.get("title") or "").strip()
            if not hid or not title:
                continue
            tl = title.lower()
            if hid in seen_ids or tl in seen_titles:
                continue
            seen_ids.add(hid)
            seen_titles.add(tl)
            merged.append(
                {
                    "id": hid,
                    "title": title,
                    "author": str(row.get("author") or "").strip(),
                    "source": str(row.get("source") or ""),
                    "language": str(row.get("language") or ""),
                    "has_lyrics": bool(row.get("has_lyrics", False)),
                }
            )
            if len(merged) >= cap:
                break
        out[sec] = filter_songs_rows_en_tl_only(merged)
    return out


def refresh_song_section(
    *,
    date: str,
    section: str,
    current_ids: Optional[list[str]] = None,
    limit: int = 10,
) -> list[dict[str, Any]]:
    """
    Live-refresh a single section's recommendations.
    Prioritizes freshly discovered web songs, then cached web, then local library.
    """
    sec = (section or "").strip().lower()
    if sec not in {"entrance", "offertory", "communion", "recessional", "meditation"}:
        return []
    data = get_liturgical_data(date)
    if not data:
        return []
    liturgical_color = get_liturgical_color(date)
    season_key = str(liturgical_color.get("season") or "ordinary_time")
    web_enabled = os.getenv("SONG_WEB_FETCH", "1").strip().lower() not in {"0", "false", "off", "no"}
    fresh_web: list[dict[str, Any]] = []
    if web_enabled:
        web_map = discover_hymns_for_readings(
            gospel_reference=str(data.get("gospel_reference") or ""),
            season_key=season_key,
            max_candidates=24,
            fetch_lyrics_count=12,
        )
        fresh_web = list(web_map.get(sec) or [])
        for row in fresh_web:
            row["source"] = "web"

    cached_web = web_cached_for_section(sec, limit=60)
    local_pool = section_candidates(season_key=season_key, section=sec, limit=60)
    random.shuffle(local_pool)

    seen_ids = set()
    seen_titles = set()
    avoid = {str(x).strip() for x in (current_ids or []) if str(x).strip()}
    out: list[dict[str, Any]] = []

    def push(rows: list[dict[str, Any]], *, prefer_new: bool = False) -> None:
        nonlocal out
        for row in rows:
            hid = str(row.get("id") or "").strip()
            title = str(row.get("title") or "").strip()
            src = str(row.get("source") or "")
            language = str(row.get("language") or "")
            has_lyrics = bool(row.get("has_lyrics", False))
            if not hid or not title:
                continue
            tl = title.lower()
            if hid in seen_ids or tl in seen_titles:
                continue
            if prefer_new and hid in avoid:
                continue
            seen_ids.add(hid)
            seen_titles.add(tl)
            out.append(
                {
                    "id": hid,
                    "title": title,
                    "source": src,
                    "language": language,
                    "has_lyrics": has_lyrics,
                }
            )
            if len(out) >= limit:
                return

    push(fresh_web, prefer_new=True)
    if len(out) < limit:
        push(cached_web, prefer_new=True)
    if len(out) < limit:
        push(local_pool, prefer_new=True)
    # backfill with previous ids only if needed
    if len(out) < limit:
        push(fresh_web)
    if len(out) < limit:
        push(cached_web)
    if len(out) < limit:
        push(local_pool)
    return out[: max(1, limit)]


def refresh_all_song_sections(
    *,
    date: str,
    current_ids: Optional[Mapping[str, list[str]]] = None,
    limit: int = 10,
) -> dict[str, list[dict[str, Any]]]:
    cmap = current_ids or {}
    return {
        "entrance": refresh_song_section(
            date=date, section="entrance", current_ids=list(cmap.get("entrance", [])), limit=limit
        ),
        "offertory": refresh_song_section(
            date=date, section="offertory", current_ids=list(cmap.get("offertory", [])), limit=limit
        ),
        "communion": refresh_song_section(
            date=date, section="communion", current_ids=list(cmap.get("communion", [])), limit=limit
        ),
        "recessional": refresh_song_section(
            date=date, section="recessional", current_ids=list(cmap.get("recessional", [])), limit=limit
        ),
        "meditation": refresh_song_section(
            date=date, section="meditation", current_ids=list(cmap.get("meditation", [])), limit=limit
        ),
    }


def resolve_slide_line(
    gospel_slide_quote: str,
    gospel_text: str,
    *,
    sentence_index: Optional[int] = None,
    interactive_pick: bool = False,
    gospel_quote_override: Optional[str] = None,
) -> str:
    """Pick the short line for slides (first sentence by default, or chosen index / override / CLI prompt)."""
    ovr = (gospel_quote_override or "").strip()
    if ovr:
        return ovr
    base_quote = (gospel_slide_quote or "").strip() or (gospel_text or "")
    sentences = split_slide_sentences(base_quote)
    if sentence_index is not None and sentences and 0 <= sentence_index < len(sentences):
        return sentences[sentence_index]
    if interactive_pick and len(sentences) > 1:
        return pick_sentence_interactive(sentences)
    return first_sentence_slide_quote(base_quote)


def _dedupe_song_ids_across_sections(sel: Mapping[str, str]) -> dict[str, str]:
    order = ["entrance", "offertory", "communion_1", "communion_2", "recessional", "meditation"]
    used: set[str] = set()
    out: dict[str, str] = {}
    for key in order:
        hid = str(sel.get(key) or "").strip()
        if not hid or hid in used:
            continue
        used.add(hid)
        out[key] = hid
    return out


def _merge_default_and_user_songs(
    season_key: str,
    user: Optional[Mapping[str, str]],
) -> dict[str, str]:
    defaults = default_song_selections_for_date(season_key)
    merged: dict[str, str] = {**defaults}
    if user:
        for k, v in user.items():
            kk = str(k).strip()
            vv = str(v or "").strip()
            if vv:
                merged[kk] = vv
    return _dedupe_song_ids_across_sections(merged)


def _hymn_title_for_poster(section: str, hymn_id: str) -> str:
    hid = (hymn_id or "").strip()
    if not hid:
        return ""
    row = get_hymn(section, hid)
    return str(row.get("title") or hid).strip() if row else hid


def _resolve_divider_poster_path(
    *,
    uploaded: Optional[Path],
    poster_ppt_path: Optional[Path],
    use_poster_as_divider: bool,
) -> Optional[Path]:
    """Uploaded divider wins; otherwise use 16:9 poster when OpenAI poster is enabled."""
    if uploaded and Path(uploaded).is_file():
        return Path(uploaded)
    if use_poster_as_divider and poster_ppt_path and Path(poster_ppt_path).is_file():
        return Path(poster_ppt_path)
    return None


def fetch_preview(date: str) -> PreviewPayload:
    data = get_liturgical_data(date)
    if not data:
        return PreviewPayload(
            ok=False,
            error="Unable to fetch liturgical data. Use a valid date (YYYY-MM-DD).",
        )
    liturgical_color = get_liturgical_color(date)
    gospel_text = data.get("gospel_text") or ""
    gospel_slide_quote = (data.get("gospel_slide_quote") or "").strip()
    base_quote = gospel_slide_quote or gospel_text or ""
    sentences = split_slide_sentences(base_quote)
    season_key = str(liturgical_color.get("season") or "ordinary_time")
    by_sec_base = recommend_sections(season_key=season_key, per_section=7)
    by_sec_web: dict[str, list[dict[str, Any]]] = {}
    web_enabled = os.getenv("SONG_WEB_FETCH", "1").strip().lower() not in {"0", "false", "off", "no"}
    if web_enabled:
        by_sec_web = discover_hymns_for_readings(
            gospel_reference=str(data.get("gospel_reference") or ""),
            season_key=season_key,
            max_candidates=18,
            fetch_lyrics_count=10,
        )
    for sec in ("entrance", "offertory", "communion", "recessional", "meditation"):
        for row in by_sec_web.get(sec) or []:
            row["source"] = "web"
            row["language"] = str(row.get("language") or "")
            row["has_lyrics"] = bool(row.get("has_lyrics", False))
    by_sec = _merge_song_sections(by_sec_base, by_sec_web, cap=10)
    g_quote_preview = (first_sentence_slide_quote(base_quote) or "").strip()
    default_picks = default_song_selections_for_date(season_key)
    est_slides = 78 + min(12, len(sentences))
    fr_txt = data.get("first_reading_text") or ""
    sr_txt = data.get("second_reading_text") or ""
    raw_psalm = (data.get("psalm_text") or "").split(" or ", 1)[0].strip()
    return PreviewPayload(
        ok=True,
        title=data.get("title") or "Sunday Mass Celebration",
        gospel_reference=data.get("gospel_reference") or "N/A",
        season=data.get("season") or "",
        lectionary_cycle=data.get("lectionary_cycle") or "",
        liturgical_color=liturgical_color,
        gospel_text_length=len(gospel_text),
        sentences=sentences,
        quote_attribution=data.get("quote_attribution"),
        songs_by_section=by_sec,
        gospel_quote=g_quote_preview,
        default_song_selections=default_picks,
        estimated_slide_count=est_slides,
        first_reading_reference=str(data.get("first_reading") or "").strip(),
        first_reading_excerpt=synopsis_from_reading(fr_txt, max_chars=720) if fr_txt else "",
        second_reading_reference=str(data.get("second_reading") or "").strip(),
        second_reading_excerpt=synopsis_from_reading(sr_txt, max_chars=720) if sr_txt else "",
        psalm_text=raw_psalm,
        gospel_text=gospel_text,
    )


@dataclass
class GenerationResult:
    ok: bool
    error: Optional[str] = None
    pptx_path: Optional[Path] = None
    poster_path: Optional[Path] = None
    poster_ppt_path: Optional[Path] = None
    title: str = ""
    gospel_reference: str = ""
    slide_line_preview: str = ""
    gospel_text_length: int = 0
    liturgical_color_name: str = ""
    liturgical_color_hex: str = ""
    liturgical_season_label: str = ""
    selected_songs: dict[str, str] = field(default_factory=dict)
    gospel_quote: str = ""
    slide_count: int = 0
    liturgical_color: Optional[Mapping[str, Any]] = None
    export_stem: str = ""
    include_social_exports: bool = False


def _poster_template_arg(name: str) -> PosterTemplate:
    n = (name or "").strip().lower()
    if n == "classic_white" or n == "classic":
        return "classic_white"
    return "liturgical_color"


def generate_mass_media(
    date: str,
    celebrant: str,
    *,
    sentence_index: Optional[int] = None,
    interactive_pick: bool = False,
    poster_template: str = "liturgical_color",
    include_social_exports: bool = False,
    include_gospel_art: bool = True,
    include_ai_mass_poster: bool = False,
    ai_poster_style: str = "cinematic",
    community_name: Optional[str] = None,
    song_selections: Optional[Mapping[str, str]] = None,
    custom_theme: Optional[Mapping[str, Any]] = None,
    divider_poster_path: Optional[Path] = None,
    announcement_image_paths: Optional[list[Path]] = None,
    mass_collection_amount: Optional[str] = None,
    mass_collection_date_label: Optional[str] = None,
    food_sponsors: Optional[list[str]] = None,
    psalm_text_override: Optional[str] = None,
    gospel_quote_override: Optional[str] = None,
    hymn_typography: Optional[Mapping[str, Any]] = None,
    include_church_logo: bool = False,
    include_church_name: bool = False,
    hymn_lyric_overrides: Optional[Mapping[str, Any]] = None,
    creed_choice: str = "nicene",
    hymn_lyrics_layout: str = "single",
) -> GenerationResult:
    if community_name and str(community_name).strip():
        update_community(community_name=str(community_name).strip())

    data = get_liturgical_data(date)
    if not data:
        return GenerationResult(
            ok=False,
            error="Unable to fetch liturgical data.",
        )

    title = data.get("title") or "Sunday Mass Celebration"
    gospel_ref = data.get("gospel_reference") or "N/A"
    gospel_text = data.get("gospel_text") or ""
    gospel_slide_quote = (data.get("gospel_slide_quote") or "").strip()
    season = data.get("season") or ""
    cycle = data.get("lectionary_cycle") or ""
    quote_attr = data.get("quote_attribution")

    liturgical_color = get_liturgical_color(date)
    color_name = str(liturgical_color.get("color_name") or "")
    color_hex = str(liturgical_color.get("hex") or "")
    season_lbl = str(liturgical_color.get("season") or "")
    season_key = str(liturgical_color.get("season") or "ordinary_time")

    slide_line = resolve_slide_line(
        gospel_slide_quote,
        gospel_text,
        sentence_index=sentence_index,
        interactive_pick=interactive_pick,
        gospel_quote_override=gospel_quote_override,
    )

    picks = _merge_default_and_user_songs(season_key, song_selections)

    # Ensure selected songs have lyrics before deck generation (best-effort auto-heal).
    sec_map = {
        "entrance": "entrance",
        "offertory": "offertory",
        "communion_1": "communion",
        "communion_2": "communion",
        "recessional": "recessional",
        "meditation": "meditation",
    }
    for key, sec in sec_map.items():
        sid = str(picks.get(key) or "").strip()
        if sid:
            ensure_lyrics_for_song(sec, sid)

    community_display = get_community_name()
    stem = mass_export_stem(community_display, date, title, season)

    tpl = _poster_template_arg(poster_template)
    logo = get_logo_path()
    entrance_title = _hymn_title_for_poster("entrance", picks.get("entrance", ""))
    comm_titles: list[str] = []
    for ck in ("communion_1", "communion_2"):
        t = _hymn_title_for_poster("communion", picks.get(ck, ""))
        if t:
            comm_titles.append(t)
    communion_line = " · ".join(comm_titles)

    psalm_body = (psalm_text_override or "").strip() or (data.get("psalm_text") or "").split(" or ", 1)[0].strip()
    psalm_body = enrich_psalm_text_for_slides(
        psalm_body,
        data.get("psalm") or "",
        psalm_response=(data.get("psalm_response") or "").strip(),
    )

    _root = Path(__file__).resolve().parent
    _out = _root / "outputs"

    # Primary posters: OpenAI (hero art) or liturgical color template.
    if include_ai_mass_poster:
        if not (os.environ.get("OPENAI_API_KEY") or "").strip():
            return GenerationResult(
                ok=False,
                error="OPENAI_API_KEY is required when “Generate poster with OpenAI” is enabled.",
            )
        try:
            from generators.ai_poster_generator import generate_primary_openai_posters

            poster_path, poster_ppt_path = generate_primary_openai_posters(
                date,
                celebrant_name=celebrant,
                style=ai_poster_style,
                output_stem=stem,
                output_dir=_out,
                include_social_exports=include_social_exports,
            )
        except Exception as exc:
            logger.exception("OpenAI poster generation failed")
            return GenerationResult(
                ok=False,
                error=f"OpenAI poster generation failed: {exc}",
            )
    else:
        poster_path, poster_ppt_path = generate_mass_poster(
            title=title,
            gospel_reference=gospel_ref,
            celebrant=celebrant,
            date=date,
            template=tpl,
            liturgical_color=liturgical_color,
            logo_path=logo,
            community_name=community_display,
            gospel_quote=slide_line,
            entrance_song_title=entrance_title,
            communion_song_titles=communion_line,
            output_stem=stem,
            include_social_exports=include_social_exports,
        )

    divider_for_ppt = _resolve_divider_poster_path(
        uploaded=divider_poster_path,
        poster_ppt_path=poster_ppt_path,
        use_poster_as_divider=include_ai_mass_poster,
    )

    slide_count, pptx_path = generate_mass_ppt(
        title=title,
        gospel_reference=gospel_ref,
        gospel_quote=slide_line or gospel_text,
        season=season,
        lectionary_cycle=cycle,
        celebrant=celebrant,
        date=date,
        quote_attribution=quote_attr,
        quote_max_chars=400,
        gospel_full_text=gospel_text,
        first_reading_ref=data.get("first_reading") or "",
        first_reading_text=data.get("first_reading_text") or "",
        psalm_ref=data.get("psalm") or "",
        psalm_text=psalm_body,
        second_reading_ref=data.get("second_reading") or "",
        second_reading_text=data.get("second_reading_text") or "",
        gospel_acclamation_verse=data.get("gospel_acclamation") or "",
        liturgical_color=liturgical_color,
        custom_theme=custom_theme,
        song_selections=picks,
        output_stem=stem,
        liturgical_poster_png=None,
        divider_poster_png=divider_for_ppt,
        announcement_image_paths=announcement_image_paths,
        mass_collection_amount=mass_collection_amount or "",
        mass_collection_date_label=mass_collection_date_label or "",
        food_sponsors=food_sponsors,
        hymn_typography=hymn_typography,
        include_church_logo=include_church_logo,
        include_church_name=include_church_name,
        hymn_lyric_overrides=hymn_lyric_overrides,
        creed_choice=creed_choice,
        hymn_lyrics_layout=hymn_lyrics_layout,
    )

    if include_social_exports and poster_path and poster_path.is_file():
        export_social_variants(poster_path, output_dir=_out, prefix=stem)
    if include_gospel_art:
        ref_short = (gospel_ref or "").strip()[:90] if gospel_ref else ""
        render_gospel_moment(
            out_path=_root / "outputs" / f"{stem}_gospel_moment.png",
            liturgical_color=liturgical_color,
            line1="Gospel",
            line2=ref_short,
        )

    preview = slide_line[:180] + ("…" if len(slide_line) > 180 else "")

    return GenerationResult(
        ok=True,
        pptx_path=pptx_path,
        poster_path=poster_path,
        poster_ppt_path=poster_ppt_path,
        title=title,
        gospel_reference=gospel_ref,
        slide_line_preview=preview,
        gospel_text_length=len(gospel_text),
        liturgical_color_name=color_name,
        liturgical_color_hex=color_hex,
        liturgical_season_label=season_lbl,
        selected_songs=dict(picks),
        gospel_quote=slide_line,
        slide_count=slide_count,
        liturgical_color=liturgical_color,
        export_stem=stem,
        include_social_exports=include_social_exports,
    )


def regenerate_mass_pptx(
    date: str,
    celebrant: str,
    *,
    sentence_index: Optional[int] = None,
    song_selections: Optional[Mapping[str, str]] = None,
    custom_theme: Optional[Mapping[str, Any]] = None,
    hymn_typography: Optional[Mapping[str, Any]] = None,
    divider_poster_path: Optional[Path] = None,
    announcement_image_paths: Optional[list[Path]] = None,
    mass_collection_amount: Optional[str] = None,
    mass_collection_date_label: Optional[str] = None,
    food_sponsors: Optional[list[str]] = None,
    psalm_text_override: Optional[str] = None,
    gospel_quote_override: Optional[str] = None,
    include_church_logo: bool = False,
    include_church_name: bool = False,
    hymn_lyric_overrides: Optional[Mapping[str, Any]] = None,
    creed_choice: str = "nicene",
    hymn_lyrics_layout: str = "single",
) -> GenerationResult:
    """Rebuild only the PowerPoint file (overwrites ``outputs/{stem}.pptx``)."""
    data = get_liturgical_data(date)
    if not data:
        return GenerationResult(ok=False, error="Unable to fetch liturgical data.")

    title = data.get("title") or "Sunday Mass Celebration"
    gospel_ref = data.get("gospel_reference") or "N/A"
    gospel_text = data.get("gospel_text") or ""
    gospel_slide_quote = (data.get("gospel_slide_quote") or "").strip()
    season = data.get("season") or ""
    cycle = data.get("lectionary_cycle") or ""
    quote_attr = data.get("quote_attribution")
    liturgical_color = get_liturgical_color(date)

    slide_line = resolve_slide_line(
        gospel_slide_quote,
        gospel_text,
        sentence_index=sentence_index,
        interactive_pick=False,
        gospel_quote_override=gospel_quote_override,
    )

    picks = _merge_default_and_user_songs(
        str(liturgical_color.get("season") or "ordinary_time"), song_selections
    )
    sec_map = {
        "entrance": "entrance",
        "offertory": "offertory",
        "communion_1": "communion",
        "communion_2": "communion",
        "recessional": "recessional",
        "meditation": "meditation",
    }
    for key, sec in sec_map.items():
        sid = str(picks.get(key) or "").strip()
        if sid:
            ensure_lyrics_for_song(sec, sid)

    community_display = get_community_name()
    stem = mass_export_stem(community_display, date, title, season)
    _root = Path(__file__).resolve().parent
    _out = _root / "outputs"
    poster_ppt_path = _out / f"{stem}_16x9.png"
    if not poster_ppt_path.is_file():
        poster_ppt_path = None

    divider_for_ppt = _resolve_divider_poster_path(
        uploaded=divider_poster_path,
        poster_ppt_path=poster_ppt_path,
        use_poster_as_divider=bool(poster_ppt_path),
    )

    psalm_body = (psalm_text_override or "").strip() or (data.get("psalm_text") or "").split(" or ", 1)[0].strip()
    psalm_body = enrich_psalm_text_for_slides(
        psalm_body,
        data.get("psalm") or "",
        psalm_response=(data.get("psalm_response") or "").strip(),
    )

    slide_count, pptx_path = generate_mass_ppt(
        title=title,
        gospel_reference=gospel_ref,
        gospel_quote=slide_line or gospel_text,
        season=season,
        lectionary_cycle=cycle,
        celebrant=celebrant,
        date=date,
        quote_attribution=quote_attr,
        quote_max_chars=400,
        gospel_full_text=gospel_text,
        first_reading_ref=data.get("first_reading") or "",
        first_reading_text=data.get("first_reading_text") or "",
        psalm_ref=data.get("psalm") or "",
        psalm_text=psalm_body,
        second_reading_ref=data.get("second_reading") or "",
        second_reading_text=data.get("second_reading_text") or "",
        gospel_acclamation_verse=data.get("gospel_acclamation") or "",
        liturgical_color=liturgical_color,
        custom_theme=custom_theme,
        song_selections=picks,
        output_stem=stem,
        liturgical_poster_png=None,
        divider_poster_png=divider_for_ppt,
        announcement_image_paths=announcement_image_paths,
        mass_collection_amount=mass_collection_amount or "",
        mass_collection_date_label=mass_collection_date_label or "",
        food_sponsors=food_sponsors,
        hymn_typography=hymn_typography,
        include_church_logo=include_church_logo,
        include_church_name=include_church_name,
        hymn_lyric_overrides=hymn_lyric_overrides,
        creed_choice=creed_choice,
        hymn_lyrics_layout=hymn_lyrics_layout,
    )

    return GenerationResult(
        ok=True,
        pptx_path=pptx_path,
        title=title,
        gospel_reference=gospel_ref,
        slide_line_preview=slide_line[:180] + ("…" if len(slide_line) > 180 else ""),
        slide_count=slide_count,
        export_stem=stem,
    )
