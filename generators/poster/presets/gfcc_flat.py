"""GFCC flat poster — full-bleed AI hero, image only (no text overlays)."""

from __future__ import annotations

from PIL import Image

from generators.ai_image_generator import hero_image_is_real
from generators.poster.primitives import paste_hero_cover
from generators.poster.types import RenderContext


def render(canvas: Image.Image, ctx: RenderContext) -> Image.Image:
    w, h = ctx.width, ctx.height
    palette = ctx.palette

    img = canvas
    img.paste(palette.background, (0, 0, w, h))

    hero_path = ctx.content.hero_image_path
    if not hero_image_is_real(hero_path):
        raise ValueError(f"Hero image missing: {hero_path}")
    hero = Image.open(hero_path).convert("RGB")
    paste_hero_cover(img, hero, (0, 0, w, h))

    ctx.image = img
    return img
