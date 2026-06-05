"""Data types for the reusable poster template system."""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional, Tuple

RGB = Tuple[int, int, int]

PPT_SIZE = (1920, 1080)
SOCIAL_SIZE = (1080, 1350)

# GFCC / Verbum brand defaults
BRAND_RED: RGB = (186, 32, 48)
BRAND_ORANGE: RGB = (232, 118, 42)
BRAND_PAPER: RGB = (252, 248, 240)
BG_WHITE: RGB = (252, 250, 247)
TEXT_BLACK: RGB = (18, 18, 22)
GOSPEL_BLUE: RGB = (28, 48, 92)
TAPE_BEIGE: RGB = (218, 198, 152)


@dataclass(frozen=True)
class PosterPalette:
    """One dominant theme + two accents (no extra colors in layer code)."""

    dominant: RGB
    accent: RGB
    accent2: RGB
    background: RGB
    text: RGB
    paper: RGB
    quote_fill: RGB
    tape: RGB = TAPE_BEIGE


def palette_from_season(season_key: str) -> PosterPalette:
    sk = (season_key or "").strip().lower()
    if sk in ("advent", "lent"):
        dom = (92, 61, 140)
        return PosterPalette(
            dominant=dom,
            accent=(120, 90, 160),
            accent2=(200, 170, 220),
            background=BG_WHITE,
            text=TEXT_BLACK,
            paper=(248, 244, 252),
            quote_fill=(240, 236, 248),
        )
    if sk == "ordinary_time":
        dom = (45, 106, 62)
        return PosterPalette(
            dominant=dom,
            accent=(72, 140, 88),
            accent2=BRAND_ORANGE,
            background=BG_WHITE,
            text=TEXT_BLACK,
            paper=(244, 250, 246),
            quote_fill=(236, 248, 240),
        )
    return PosterPalette(
        dominant=BRAND_RED,
        accent=BRAND_ORANGE,
        accent2=GOSPEL_BLUE,
        background=BG_WHITE,
        text=TEXT_BLACK,
        paper=BRAND_PAPER,
        quote_fill=(255, 244, 238),
    )


def poster_accent_rgb(season_key: str) -> RGB:
    """Backward-compatible accent helper."""
    return palette_from_season(season_key).dominant


@dataclass
class PosterContent:
    """All swappable fields for any layout preset."""

    title: str
    gospel_quote: str
    gospel_reference: str
    date_display: str
    year_cycle: str
    celebrant_name: str
    hero_image_path: Path
    liturgical_season_key: str = "ordinary_time"
    logo_path: Optional[Path] = None
    community_name: str = ""
    callout: str = ""
    include_text_overlays: bool = True
    palette: Optional[PosterPalette] = None

    def resolved_palette(self) -> PosterPalette:
        return self.palette or palette_from_season(self.liturgical_season_key)


@dataclass
class FontSet:
    title: object
    meta: object
    celebrant: object
    script: object
    quote: object
    gospel: object
    gospel_ref: object
    small: object


@dataclass
class RenderContext:
    """Shared state passed to each layout layer."""

    image: object
    draw: object
    content: PosterContent
    palette: PosterPalette
    fonts: FontSet
    width: int
    height: int
    scale: float
    margin: int
    # Populated by layers for decoration pass
    card_boxes: list[tuple[int, int, int, int]] = field(default_factory=list)
