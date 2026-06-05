"""Compose posters from :class:`PosterContent` and a named layout preset."""

from __future__ import annotations

from pathlib import Path
from typing import Optional

from PIL import Image, ImageDraw

from generators.poster.presets import PRESET_IDS, get_renderer
from generators.poster.primitives import load_fonts
from generators.poster.types import PPT_SIZE, PosterContent, RenderContext


def compose_poster(
    size: tuple[int, int],
    content: PosterContent,
    preset: str = "gfcc_flat",
) -> Image.Image:
    """Render a poster at ``size`` using the given layout preset."""
    w, h = size
    scale = min(w / PPT_SIZE[0], h / PPT_SIZE[1])
    margin = max(28, int(48 * scale))
    palette = content.resolved_palette()
    canvas = Image.new("RGB", (w, h), palette.background)
    ctx = RenderContext(
        image=canvas,
        draw=ImageDraw.Draw(canvas),
        content=content,
        palette=palette,
        fonts=load_fonts(scale),
        width=w,
        height=h,
        scale=scale,
        margin=margin,
    )
    renderer = get_renderer(preset)
    return renderer(canvas, ctx)


def content_from_legacy_kwargs(
    *,
    liturgical_day: str,
    hero_image_path: Path,
    gospel_quote: str,
    gospel_reference: str,
    year_cycle: str,
    date_display: str,
    celebrant_name: str,
    community_name: str,
    liturgical_season_key: str,
    logo_path: Optional[Path] = None,
) -> PosterContent:
    """Build :class:`PosterContent` from the legacy ``compose_ai_mass_poster`` keyword API."""
    return PosterContent(
        title=liturgical_day,
        gospel_quote=gospel_quote,
        gospel_reference=gospel_reference,
        date_display=date_display,
        year_cycle=year_cycle,
        celebrant_name=celebrant_name,
        hero_image_path=Path(hero_image_path),
        liturgical_season_key=liturgical_season_key,
        logo_path=logo_path,
        community_name=community_name,
    )
