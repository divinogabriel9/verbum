"""
Backward-compatible shim for the poster template package.

New code should use :mod:`generators.poster`.
"""

from __future__ import annotations

from pathlib import Path
from typing import Optional

from PIL import Image

from generators.poster import (
    PPT_SIZE,
    SOCIAL_SIZE,
    compose_poster,
    content_from_legacy_kwargs,
    export_poster_sizes,
    export_primary_poster_pair,
    palette_from_season,
    poster_accent_rgb,
)

# Re-export sizes for callers that imported these names
_PPT_SIZE = PPT_SIZE
_SOCIAL_SIZE = SOCIAL_SIZE


def compose_ai_mass_poster(
    size: tuple[int, int],
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
    preset: str = "verbum",
) -> Image.Image:
    """Compose a Mass poster (default preset: ``verbum`` scrapbook style)."""
    content = content_from_legacy_kwargs(
        liturgical_day=liturgical_day,
        hero_image_path=hero_image_path,
        gospel_quote=gospel_quote,
        gospel_reference=gospel_reference,
        year_cycle=year_cycle,
        date_display=date_display,
        celebrant_name=celebrant_name,
        community_name=community_name,
        liturgical_season_key=liturgical_season_key,
        logo_path=logo_path,
    )
    return compose_poster(size, content, preset=preset)


__all__ = [
    "compose_ai_mass_poster",
    "export_poster_sizes",
    "export_primary_poster_pair",
    "poster_accent_rgb",
    "palette_from_season",
]
