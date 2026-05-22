"""
Reusable poster template system for Verbum / GFCC Mass posters.

Public API:
- :func:`compose_poster` — render with a named preset
- :class:`PosterContent` — swappable text, hero, palette
- :func:`export_primary_poster_pair` / :func:`export_poster_sizes`
"""

from generators.poster.composer import compose_poster, content_from_legacy_kwargs
from generators.poster.export import export_poster_sizes, export_primary_poster_pair
from generators.poster.presets import PRESET_IDS
from generators.poster.types import (
    PPT_SIZE,
    SOCIAL_SIZE,
    PosterContent,
    PosterPalette,
    palette_from_season,
    poster_accent_rgb,
)

__all__ = [
    "PRESET_IDS",
    "PPT_SIZE",
    "SOCIAL_SIZE",
    "PosterContent",
    "PosterPalette",
    "compose_poster",
    "content_from_legacy_kwargs",
    "export_poster_sizes",
    "export_primary_poster_pair",
    "palette_from_season",
    "poster_accent_rgb",
]
