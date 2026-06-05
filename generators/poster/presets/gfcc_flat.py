"""GFCC flat poster — full-bleed AI hero with optional text overlays."""

from __future__ import annotations

from PIL import Image, ImageDraw

from generators.ai_image_generator import hero_image_is_real
from generators.poster.primitives import (
    callout_from_quote,
    format_date_badge_lines,
    paste_hero_cover,
    text_height,
    text_width,
    wrap_text,
)
from generators.poster.types import RenderContext


def _draw_text_band(
    img: Image.Image,
    *,
    y0: int,
    y1: int,
    opacity: float = 0.72,
) -> Image.Image:
    """Semi-transparent band for readable text over the hero."""
    overlay = Image.new("RGBA", img.size, (0, 0, 0, 0))
    od = ImageDraw.Draw(overlay)
    alpha = max(0, min(255, int(255 * opacity)))
    od.rectangle((0, y0, img.width, y1), fill=(12, 14, 18, alpha))
    return Image.alpha_composite(img.convert("RGBA"), overlay).convert("RGB")


def render(canvas: Image.Image, ctx: RenderContext) -> Image.Image:
    w, h = ctx.width, ctx.height
    scale = ctx.scale
    margin = ctx.margin
    palette = ctx.palette

    img = canvas
    img.paste(palette.background, (0, 0, w, h))

    hero_path = ctx.content.hero_image_path
    if not hero_image_is_real(hero_path):
        raise ValueError(f"Hero image missing: {hero_path}")
    hero = Image.open(hero_path).convert("RGB")
    paste_hero_cover(img, hero, (0, 0, w, h))
    draw = ImageDraw.Draw(img)

    if not ctx.content.include_text_overlays:
        ctx.image = img
        return img

    header_h = max(int(h * 0.11), int(88 * scale))
    footer_h = max(int(h * 0.17), int(130 * scale))
    img = _draw_text_band(img, y0=0, y1=header_h, opacity=0.58)
    img = _draw_text_band(img, y0=h - footer_h, y1=h, opacity=0.68)
    draw = ImageDraw.Draw(img)

    title = (ctx.content.title or "SUNDAY MASS").strip().upper()
    ty = margin
    title_max = w - 2 * margin - int(300 * scale)
    for ln in wrap_text(draw, title, ctx.fonts.title, title_max)[:2]:
        tw = text_width(draw, ln, ctx.fonts.title)
        draw.text(((w - tw) // 2, ty), ln, fill=(252, 250, 247), font=ctx.fonts.title)
        ty += text_height(draw, ln, ctx.fonts.title) + int(3 * scale)

    celeb = f"MASS CELEBRANT: {(ctx.content.celebrant_name or 'TBD').strip().upper()}"
    cy = margin + int(2 * scale)
    for ln in wrap_text(draw, celeb, ctx.fonts.celebrant, int(320 * scale))[:2]:
        tw = text_width(draw, ln, ctx.fonts.celebrant)
        draw.text((w - margin - tw, cy), ln, fill=(252, 250, 247), font=ctx.fonts.celebrant)
        cy += text_height(draw, ln, ctx.fonts.celebrant) + 2

    year_line, date_line = format_date_badge_lines(
        ctx.content.date_display, ctx.content.year_cycle
    )
    date_line_full = f"{year_line} {date_line}".strip() if year_line else date_line
    if date_line_full:
        draw.text(
            (margin, header_h - margin - text_height(draw, date_line_full, ctx.fonts.meta)),
            date_line_full,
            fill=(230, 228, 224),
            font=ctx.fonts.meta,
        )

    quote_raw = (ctx.content.gospel_quote or "").strip().strip("“”\"'")
    if len(quote_raw) > 280:
        quote_raw = quote_raw[:277].rstrip() + "…"
    quote_display = f"“{quote_raw}”" if quote_raw else ""
    callout = ctx.content.callout or callout_from_quote(ctx.content.gospel_quote)
    y = h - footer_h + int(12 * scale)
    if callout:
        cw = text_width(draw, callout, ctx.fonts.script)
        draw.text(((w - cw) // 2, y), callout, fill=palette.accent, font=ctx.fonts.script)
        y += text_height(draw, callout, ctx.fonts.script) + int(5 * scale)
    for ln in wrap_text(draw, quote_display, ctx.fonts.quote, w - 2 * margin)[:3]:
        tw = text_width(draw, ln, ctx.fonts.quote)
        draw.text(((w - tw) // 2, y), ln, fill=(252, 250, 247), font=ctx.fonts.quote)
        y += text_height(draw, ln, ctx.fonts.quote) + int(3 * scale)

    ref = (ctx.content.gospel_reference or "—").strip()
    label = "Gospel:"
    lw = text_width(draw, label, ctx.fonts.gospel)
    rw = text_width(draw, ref, ctx.fonts.gospel_ref)
    gx = (w - lw - 6 - rw) // 2
    gy = h - margin - text_height(draw, ref, ctx.fonts.gospel_ref)
    draw.text((gx, gy), label, fill=palette.accent, font=ctx.fonts.gospel)
    draw.text((gx + lw + 6, gy), ref, fill=palette.accent2, font=ctx.fonts.gospel_ref)

    ctx.image = img
    return img
