"""GFCC flat poster preset (legacy white layout, no scrapbook cards)."""

from __future__ import annotations

from PIL import Image, ImageDraw

from generators.ai_image_generator import hero_image_is_real
from generators.poster.primitives import (
    callout_from_quote,
    format_date_badge_lines,
    paste_hero_cover,
    paste_logo_top_left,
    text_height,
    text_width,
    wrap_text,
)
from generators.poster.types import RenderContext


def render(canvas: Image.Image, ctx: RenderContext) -> Image.Image:
    w, h = ctx.width, ctx.height
    scale = ctx.scale
    margin = ctx.margin
    palette = ctx.palette
    draw = ctx.draw

    img = canvas
    img.paste(palette.background, (0, 0, w, h))
    draw = ImageDraw.Draw(img)

    header_h = max(int(h * 0.14), int(120 * scale))
    footer_h = max(int(h * 0.22), int(200 * scale))

    logo_w = 0
    if ctx.content.logo_path and ctx.content.logo_path.is_file():
        logo_w = paste_logo_top_left(img, ctx.content.logo_path, max_w=int(200 * scale), margin=margin)

    title = (ctx.content.title or "SUNDAY MASS").strip().upper()
    ty = margin + int(8 * scale)
    for ln in wrap_text(draw, title, ctx.fonts.title, w - 2 * margin - int(320 * scale))[:2]:
        tw = text_width(draw, ln, ctx.fonts.title)
        draw.text(((w - tw) // 2, ty), ln, fill=palette.dominant, font=ctx.fonts.title)
        ty += text_height(draw, ln, ctx.fonts.title) + int(4 * scale)

    celeb = f"MASS CELEBRANT: {(ctx.content.celebrant_name or 'TBD').strip().upper()}"
    cy = margin + int(4 * scale)
    for ln in wrap_text(draw, celeb, ctx.fonts.celebrant, int(340 * scale))[:3]:
        tw = text_width(draw, ln, ctx.fonts.celebrant)
        draw.text((w - margin - tw, cy), ln, fill=palette.dominant, font=ctx.fonts.celebrant)
        cy += text_height(draw, ln, ctx.fonts.celebrant) + 2

    year_line, date_line = format_date_badge_lines(ctx.content.date_display, ctx.content.year_cycle)
    date_line_full = f"{year_line} {date_line}".strip() if year_line else date_line
    dx = margin + logo_w + (int(12 * scale) if logo_w else 0)
    draw.text((dx, margin + int(52 * scale)), date_line_full, fill=palette.dominant, font=ctx.fonts.meta)

    hero_path = ctx.content.hero_image_path
    if not hero_image_is_real(hero_path):
        raise ValueError(f"Hero image missing: {hero_path}")
    hero_box = (0, header_h, w, h - footer_h)
    hero = Image.open(hero_path).convert("RGB")
    paste_hero_cover(img, hero, hero_box)

    quote_raw = (ctx.content.gospel_quote or "").strip().strip("“”\"'")
    if len(quote_raw) > 320:
        quote_raw = quote_raw[:317].rstrip() + "…"
    quote_caps = f"“{quote_raw.upper()}”" if quote_raw else ""
    callout = ctx.content.callout or callout_from_quote(ctx.content.gospel_quote)
    y = hero_box[3] + int(10 * scale)
    if callout:
        cw = text_width(draw, callout, ctx.fonts.script)
        draw.text(((w - cw) // 2, y), callout, fill=palette.accent, font=ctx.fonts.script)
        y += text_height(draw, callout, ctx.fonts.script) + int(6 * scale)
    for ln in wrap_text(draw, quote_caps, ctx.fonts.quote, w - 2 * margin)[:4]:
        tw = text_width(draw, ln, ctx.fonts.quote)
        draw.text(((w - tw) // 2, y), ln, fill=palette.text, font=ctx.fonts.quote)
        y += text_height(draw, ln, ctx.fonts.quote) + int(4 * scale)

    ref = (ctx.content.gospel_reference or "—").strip()
    gy = h - margin - text_height(draw, ref, ctx.fonts.gospel_ref)
    label = "Gospel:"
    lw = text_width(draw, label, ctx.fonts.gospel)
    rw = text_width(draw, ref, ctx.fonts.gospel_ref)
    gx = (w - lw - 6 - rw) // 2
    draw.text((gx, gy), label, fill=palette.accent, font=ctx.fonts.gospel)
    draw.text((gx + lw + 6, gy), ref, fill=palette.accent2, font=ctx.fonts.gospel_ref)

    ctx.image = img
    return img
