"""
Verbum scrapbook poster preset — layered layout with stickers, atmosphere, and palette.

Render order: background → hero → atmosphere → cards → title → logo → tape.
"""

from __future__ import annotations

from PIL import Image, ImageDraw

from generators.ai_image_generator import hero_image_is_real
from generators.poster.primitives import (
    apply_center_glow,
    apply_light_rays,
    apply_vignette,
    callout_from_quote,
    draw_paper_card,
    draw_tape_strip,
    draw_text_in_box,
    format_date_badge_lines,
    paste_hero_cover,
    paste_logo_top_left,
    text_height,
    text_width,
    wrap_text,
)
from generators.poster.types import RenderContext


def _hero_region(ctx: RenderContext) -> tuple[int, int, int, int]:
    w, h = ctx.width, ctx.height
    top = int(h * 0.12)
    bottom = int(h * 0.78)
    side = int(w * 0.06)
    return (side, top, w - side, bottom)


def draw_background(ctx: RenderContext) -> None:
    ctx.image.paste(ctx.palette.background, (0, 0, ctx.width, ctx.height))
    # Subtle warm paper grain via soft gradient bands
    overlay = Image.new("RGBA", (ctx.width, ctx.height), (0, 0, 0, 0))
    od = ImageDraw.Draw(overlay)
    p = ctx.palette.paper
    od.rectangle((0, 0, ctx.width, ctx.height // 3), fill=(*p, 35))
    od.rectangle((0, ctx.height * 2 // 3, ctx.width, ctx.height), fill=(*p, 50))
    ctx.image = Image.alpha_composite(ctx.image.convert("RGBA"), overlay).convert("RGB")
    ctx.draw = ImageDraw.Draw(ctx.image)


def draw_hero_layer(ctx: RenderContext) -> None:
    hero_path = ctx.content.hero_image_path
    if not hero_image_is_real(hero_path):
        raise ValueError(
            f"Hero image is missing or a placeholder: {hero_path}. "
            "Regenerate with a valid OPENAI_API_KEY."
        )
    try:
        hero = Image.open(hero_path).convert("RGB")
    except OSError as exc:
        raise ValueError(f"Could not load hero image: {hero_path}") from exc
    box = _hero_region(ctx)
    paste_hero_cover(ctx.image, hero, box)
    ctx.draw = ImageDraw.Draw(ctx.image)


def draw_atmosphere_layer(ctx: RenderContext) -> None:
    box = _hero_region(ctx)
    cx = (box[0] + box[2]) // 2
    cy = (box[1] + box[3]) // 2
    ctx.image = apply_light_rays(
        ctx.image, (cx, int(box[1] * 0.6)), ctx.palette.accent, opacity=0.07
    )
    ctx.image = apply_center_glow(
        ctx.image, (cx, cy), int((box[2] - box[0]) * 0.45), ctx.palette.dominant, opacity=0.12
    )
    ctx.image = apply_vignette(ctx.image, box, strength=0.38)
    ctx.draw = ImageDraw.Draw(ctx.image)


def draw_date_badge(ctx: RenderContext) -> None:
    m = ctx.margin
    year_line, date_line = format_date_badge_lines(
        ctx.content.date_display, ctx.content.year_cycle
    )
    lines = [ln for ln in (year_line, date_line) if ln]
    if not lines:
        return
    fs = ctx.fonts.meta
    max_w = max(text_width(ctx.draw, ln, fs) for ln in lines) + 40
    line_h = sum(text_height(ctx.draw, ln, fs) + 6 for ln in lines)
    box = (m, int(ctx.height * 0.14), m + max_w, int(ctx.height * 0.14) + line_h + 28)
    ctx.image = draw_paper_card(
        ctx.image, box, fill=ctx.palette.paper, rotation_deg=-2.5, shadow_offset=(5, 7)
    )
    ctx.draw = ImageDraw.Draw(ctx.image)
    ctx.card_boxes.append(box)
    draw_text_in_box(ctx, box, lines, fs, ctx.palette.dominant, align="left")


def draw_celebrant_sticker(ctx: RenderContext) -> None:
    name = (ctx.content.celebrant_name or "TBD").strip().upper()
    label = "MASS CELEBRANT"
    lines = [label, name]
    fs_label = ctx.fonts.small
    fs_name = ctx.fonts.celebrant
    w = ctx.width
    m = ctx.margin
    max_inner = int(w * 0.28)
    name_lines = wrap_text(ctx.draw, name, fs_name, max_inner)
    lw = max(
        text_width(ctx.draw, label, fs_label),
        max((text_width(ctx.draw, ln, fs_name) for ln in name_lines), default=0),
    )
    lh = (
        text_height(ctx.draw, label, fs_label)
        + 6
        + sum(text_height(ctx.draw, ln, fs_name) + 4 for ln in name_lines)
    )
    box = (w - m - lw - 36, int(ctx.height * 0.12), w - m, int(ctx.height * 0.12) + lh + 32)
    ctx.image = draw_paper_card(
        ctx.image, box, fill=ctx.palette.quote_fill, rotation_deg=3.0, shadow_offset=(6, 8)
    )
    ctx.draw = ImageDraw.Draw(ctx.image)
    ctx.card_boxes.append(box)
    inner = (box[0] + 14, box[1] + 10, box[2] - 10, box[3] - 10)
    ctx.draw.text((inner[0], inner[1]), label, fill=ctx.palette.accent, font=fs_label)
    y = inner[1] + text_height(ctx.draw, label, fs_label) + 8
    for ln in name_lines[:3]:
        ctx.draw.text((inner[0], y), ln, fill=ctx.palette.dominant, font=fs_name)
        y += text_height(ctx.draw, ln, fs_name) + 3


def draw_quote_sticker(ctx: RenderContext) -> None:
    quote_raw = (ctx.content.gospel_quote or "").strip().strip("“”\"'")
    if len(quote_raw) > 200:
        quote_raw = quote_raw[:197].rstrip() + "…"
    if not quote_raw:
        return
    display = f"“{quote_raw}”"
    fs = ctx.fonts.quote
    max_w = int(ctx.width * 0.34)
    lines = wrap_text(ctx.draw, display, fs, max_w)[:4]
    callout = (ctx.content.callout or "").strip() or callout_from_quote(ctx.content.gospel_quote)

    lw = max((text_width(ctx.draw, ln, fs) for ln in lines), default=80)
    lh = sum(text_height(ctx.draw, ln, fs) + 6 for ln in lines)
    if callout:
        lh += text_height(ctx.draw, callout, ctx.fonts.script) + 12

    ref = (ctx.content.gospel_reference or "").strip()
    lh += text_height(ctx.draw, ref, ctx.fonts.gospel_ref) + 16

    box_w = lw + 48
    box_h = lh + 40
    x1 = ctx.width - ctx.margin - 20
    x0 = x1 - box_w
    y0 = int(ctx.height * 0.22)
    box = (x0, y0, x1, y0 + box_h)

    ctx.image = draw_paper_card(
        ctx.image, box, fill=ctx.palette.quote_fill, rotation_deg=4.5, shadow_offset=(7, 9)
    )
    ctx.draw = ImageDraw.Draw(ctx.image)
    ctx.card_boxes.append(box)

    y = box[1] + 16
    if callout:
        cw = text_width(ctx.draw, callout, ctx.fonts.script)
        ctx.draw.text(
            (box[0] + (box_w - cw) // 2, y),
            callout,
            fill=ctx.palette.accent,
            font=ctx.fonts.script,
        )
        y += text_height(ctx.draw, callout, ctx.fonts.script) + 8

    for ln in lines:
        tw = text_width(ctx.draw, ln, fs)
        ctx.draw.text((box[0] + (box_w - tw) // 2, y), ln, fill=ctx.palette.text, font=fs)
        y += text_height(ctx.draw, ln, fs) + 6

    ref_label = "Gospel:"
    ctx.draw.text((box[0] + 16, y), ref_label, fill=ctx.palette.accent, font=ctx.fonts.gospel)
    ctx.draw.text(
        (box[0] + 16 + text_width(ctx.draw, ref_label, ctx.fonts.gospel) + 4, y),
        ref,
        fill=ctx.palette.accent2,
        font=ctx.fonts.gospel_ref,
    )


def draw_title_layer(ctx: RenderContext) -> None:
    title = (ctx.content.title or "SUNDAY MASS").strip().upper()
    fs = ctx.fonts.title
    max_w = int(ctx.width * 0.72)
    lines = wrap_text(ctx.draw, title, fs, max_w)[:2]
    total_h = sum(text_height(ctx.draw, ln, fs) + 6 for ln in lines)
    y = ctx.margin + int(4 * ctx.scale)
    for ln in lines:
        tw = text_width(ctx.draw, ln, fs)
        x = (ctx.width - tw) // 2
        # Soft shadow
        ctx.draw.text((x + 2, y + 2), ln, fill=(40, 40, 48), font=fs)
        ctx.draw.text((x, y), ln, fill=ctx.palette.dominant, font=fs)
        y += text_height(ctx.draw, ln, fs) + 6


def draw_logo_layer(ctx: RenderContext) -> None:
    lp = ctx.content.logo_path
    if lp and lp.is_file():
        paste_logo_top_left(
            ctx.image, lp, max_w=int(180 * ctx.scale), margin=ctx.margin
        )
        ctx.draw = ImageDraw.Draw(ctx.image)


def draw_decorations(ctx: RenderContext) -> None:
    tape_c = ctx.palette.tape
    for box in ctx.card_boxes:
        x0, y0, x1, y1 = box
        draw_tape_strip(ctx.draw, x0 + 18, y0 - 4, width=56, height=18, color=tape_c, angle_deg=-32)
        draw_tape_strip(ctx.draw, x1 - 22, y1 - 8, width=52, height=16, color=tape_c, angle_deg=24)


def render_verbum(canvas: Image.Image, ctx: RenderContext) -> Image.Image:
    """Run all Verbum layers; mutates ctx.image in place."""
    draw_background(ctx)
    draw_hero_layer(ctx)
    draw_atmosphere_layer(ctx)
    draw_date_badge(ctx)
    draw_celebrant_sticker(ctx)
    draw_quote_sticker(ctx)
    draw_title_layer(ctx)
    draw_logo_layer(ctx)
    draw_decorations(ctx)
    return ctx.image


def render(canvas: Image.Image, ctx: RenderContext) -> Image.Image:
    return render_verbum(canvas, ctx)
