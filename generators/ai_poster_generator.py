"""
AI-driven Mass / parish event posters from lectionary data and OpenAI image generation.

Public entry points:
- :func:`generate_primary_openai_posters` — main ``outputs/{stem}.png`` and ``{stem}_16x9.png``
- :func:`create_mass_poster` — additional social sizes under ``outputs/posters/``

See also: :mod:`generators.ai_image_generator`, :mod:`generators.poster` (template presets).
"""

from __future__ import annotations

import datetime as _dt
import os
from pathlib import Path
from typing import Optional, Tuple

from PIL import Image

from generators.ai_image_generator import (
    WIDESCREEN_16_9,
    _openai_widescreen_api_size,
    generate_sacred_illustration,
)
from generators.poster import (
    PPT_SIZE,
    PosterContent,
    compose_poster,
    export_poster_sizes,
    export_primary_poster_pair,
)
from generators.poster.primitives import callout_from_quote
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


def _build_mass_poster_master(
    date: str,
    *,
    celebrant_name: Optional[str] = None,
    style: str = "cinematic",
    reuse_existing_hero: bool = False,
    gospel_quote: Optional[str] = None,
    gospel_reference: Optional[str] = None,
    liturgical_title: Optional[str] = None,
    image_backend: str = "openai",
) -> Image.Image:
    """Liturgical load, AI hero (visual only), composited as a full-bleed poster."""
    data = get_liturgical_data(date)
    if not data:
        raise ValueError(f"No liturgical data for {date!r}.")

    liturgical = get_liturgical_color(date)
    season_key = str(liturgical.get("season") or "ordinary_time")

    gospel_ref = (gospel_reference or data.get("gospel_reference") or "").strip() or "Gospel"
    gospel_slide = (data.get("gospel_slide_quote") or "").strip()
    gospel_full = (data.get("gospel_text") or "").strip()
    base_quote = gospel_slide or gospel_full
    sentences = split_slide_sentences(base_quote)
    default_quote = (
        sentences[0]
        if sentences
        else first_sentence_slide_quote(base_quote)
        if base_quote
        else gospel_ref
    )
    quote_for_poster = (gospel_quote or "").strip() or default_quote

    title = str(data.get("title") or "Sunday Mass Celebration")
    community = get_community_name()
    celebrant = (celebrant_name or os.environ.get("MASS_CELEBRANT") or "TBD").strip()

    _IMAGES_DIR.mkdir(parents=True, exist_ok=True)
    date_iso = date.strip()
    resolved_style = resolve_ai_image_style(style)
    hero_path = _IMAGES_DIR / f"{date_iso}_{resolved_style}_hero.png"

    display_title = (liturgical_title or title.replace(" Celebration", "").strip() or title)
    if not (reuse_existing_hero and hero_path.is_file()):
        visual_line = build_visual_scene_line(display_title, gospel_ref, gospel_full)
        generate_sacred_illustration(
            gospel_ref,
            out_path=hero_path,
            style=resolved_style,
            visual_scene_line=visual_line,
            image_backend=image_backend,
            openai_size=_openai_widescreen_api_size(),
            output_size=WIDESCREEN_16_9,
            sunday_title=display_title,
            gospel_text=gospel_full,
            season_key=season_key,
        )

    cycle = str(data.get("lectionary_cycle") or "").strip().upper() or "—"

    content = PosterContent(
        title=display_title,
        gospel_quote=quote_for_poster,
        gospel_reference=gospel_ref,
        date_display=_format_long_date(date),
        year_cycle=cycle,
        celebrant_name=celebrant,
        hero_image_path=hero_path,
        liturgical_season_key=season_key,
        logo_path=None,
        community_name=community,
        callout=callout_from_quote(quote_for_poster),
    )
    return compose_poster(PPT_SIZE, content, preset="gfcc_flat")


def generate_primary_openai_posters(
    date: str,
    *,
    celebrant_name: Optional[str] = None,
    style: str = "cinematic",
    output_stem: str,
    output_dir: Path,
    include_social_exports: bool = False,
    reuse_existing_hero: bool = False,
    gospel_quote: Optional[str] = None,
    gospel_reference: Optional[str] = None,
    liturgical_title: Optional[str] = None,
    image_backend: str = "openai",
) -> Tuple[Optional[Path], Path]:
    """
    Build AI-backed parish posters (OpenAI or Gemini — same prompt).

    By default writes only ``{stem}_16x9.png`` (projection / PPT slide).
    When ``include_social_exports`` is true, also writes ``{stem}.png`` (1080×1350)
    and variants under ``outputs/posters/``.
    """
    master = _build_mass_poster_master(
        date,
        celebrant_name=celebrant_name,
        style=style,
        reuse_existing_hero=reuse_existing_hero,
        gospel_quote=gospel_quote,
        gospel_reference=gospel_reference,
        liturgical_title=liturgical_title,
        image_backend=image_backend,
    )
    social_path, ppt_path = export_primary_poster_pair(
        master, output_dir, output_stem, include_social=include_social_exports
    )
    if include_social_exports:
        _POSTERS_DIR.mkdir(parents=True, exist_ok=True)
        export_poster_sizes(master, _POSTERS_DIR)
    return social_path, ppt_path


def create_mass_poster(
    date: str,
    *,
    celebrant_name: Optional[str] = None,
    language: str = "English",
    style: str = "cinematic",
    gospel_quote: Optional[str] = None,
) -> dict[str, Path]:
    """
    Build AI-backed social poster exports for a Mass date (``outputs/posters/``).

    For main deck posters use :func:`generate_primary_openai_posters`.
    """
    del language  # Reserved for future bilingual prompts / captions.
    master = _build_mass_poster_master(
        date,
        celebrant_name=celebrant_name,
        style=style,
        gospel_quote=gospel_quote,
    )
    _POSTERS_DIR.mkdir(parents=True, exist_ok=True)
    return export_poster_sizes(master, _POSTERS_DIR)
