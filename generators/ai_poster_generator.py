"""
AI-driven Mass / parish event posters from lectionary data and a Hugging Face image model.

Public entry point: :func:`create_mass_poster` — fetches readings, picks a short Gospel quote,
generates sacred art (or a placeholder), composes layout, exports Instagram / Story / Facebook sizes.

See also: :mod:`generators.ai_image_generator`, :mod:`generators.poster_layout`.
"""

from __future__ import annotations

import datetime as _dt
import os
from pathlib import Path
from typing import Optional

from generators.ai_image_generator import generate_sacred_illustration
from generators.poster_layout import compose_ai_mass_poster, export_poster_sizes
from services.ai_styles import resolve_ai_image_style
from services.community_config import get_community_name
from services.gospel_visual_prompt import build_visual_scene_line
from services.gospel_quote_extractor import first_sentence_slide_quote, split_slide_sentences
from services.lectionary_service import get_liturgical_data
from services.liturgical_calendar import get_liturgical_color
_PROJECT_ROOT = Path(__file__).resolve().parents[1]
_POSTERS_DIR = _PROJECT_ROOT / "outputs" / "posters"
_IMAGES_DIR = _PROJECT_ROOT / "outputs" / "images"


def _format_long_date(date_iso: str) -> str:
    try:
        d = _dt.datetime.strptime(date_iso.strip(), "%Y-%m-%d").date()
        return d.strftime("%A, %d %B %Y")
    except ValueError:
        return date_iso


def create_mass_poster(
    date: str,
    *,
    celebrant_name: Optional[str] = None,
    language: str = "English",
    style: str = "cinematic",
) -> dict[str, Path]:
    """
    Build AI-backed event posters for a Mass date.

    Workflow:
    1. Load liturgical data (readings API + cache).
    2. Resolve Gospel reference and a short quote for the poster.
    3. Generate a sacred illustration via Hugging Face (or placeholder if no token).
    4. Compose the poster in a canonical 1080×1350 layout with liturgical accents.
    5. Export Instagram post, Instagram story, and Facebook cover sizes under ``outputs/posters/``.

    Args:
        date: Mass date ``YYYY-MM-DD``.
        celebrant_name: Priest name for the poster; defaults to ``MASS_CELEBRANT`` env or ``"TBD"``.
        language: Reserved for future prompt / caption localization (currently English-oriented art).
        style: Key from ``data/styles.json`` (default ``cinematic``). Hero image:
            ``outputs/images/{date}_{style}_hero.png``.

    Returns:
        Mapping with keys ``instagram``, ``story``, ``facebook`` → written ``Path`` objects.
    """
    del language  # Reserved for future bilingual prompts / captions.

    data = get_liturgical_data(date)
    if not data:
        raise ValueError(f"No liturgical data for {date!r}.")

    liturgical = get_liturgical_color(date)
    season_key = str(liturgical.get("season") or "ordinary_time")

    gospel_ref = str(data.get("gospel_reference") or "").strip() or "Gospel"
    gospel_slide = (data.get("gospel_slide_quote") or "").strip()
    gospel_full = (data.get("gospel_text") or "").strip()
    base_quote = gospel_slide or gospel_full
    sentences = split_slide_sentences(base_quote)
    short_quote = (
        sentences[0]
        if sentences
        else first_sentence_slide_quote(base_quote)
        if base_quote
        else gospel_ref
    )

    title = str(data.get("title") or "Sunday Mass Celebration")
    api_season = str(data.get("season") or "")
    community = get_community_name()
    celebrant = (celebrant_name or os.environ.get("MASS_CELEBRANT") or "TBD").strip()

    _IMAGES_DIR.mkdir(parents=True, exist_ok=True)
    date_iso = date.strip()
    resolved_style = resolve_ai_image_style(style)
    hero_path = _IMAGES_DIR / f"{date_iso}_{resolved_style}_hero.png"

    # Step 3 — AI hero: short visual line from Gospel prose (not the poster quote).
    visual_line = build_visual_scene_line(title, gospel_ref, gospel_full)
    generate_sacred_illustration(
        gospel_ref,
        out_path=hero_path,
        style=resolved_style,
        visual_scene_line=visual_line,
    )

    cycle = str(data.get("lectionary_cycle") or "").strip().upper() or "—"

    # Step 4 — single master canvas at Instagram post size.
    master = compose_ai_mass_poster(
        (1080, 1350),
        liturgical_day=title.replace(" Celebration", "").strip() or title,
        hero_image_path=hero_path,
        gospel_quote=short_quote,
        gospel_reference=gospel_ref,
        year_cycle=cycle,
        date_display=_format_long_date(date),
        celebrant_name=celebrant,
        community_name=community,
        liturgical_season_key=season_key,
    )

    # Step 5 — derivative sizes for social platforms.
    _POSTERS_DIR.mkdir(parents=True, exist_ok=True)
    return export_poster_sizes(master, _POSTERS_DIR)
