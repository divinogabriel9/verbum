"""Mass Divider PNG overlay — AI artwork + deterministic template text."""

from __future__ import annotations

from typing import List

from PIL import Image, ImageDraw

from generators.ai_image_generator import hero_image_is_real
from generators.powerpoint import _divider3_panel_quote_layout, _divider_quote_lines
from generators.poster.primitives import paste_hero_cover, text_height, text_width, try_font, wrap_text
from generators.poster.types import RenderContext
from services.mass_divider.templates import get_divider_template
from services.mass_divider.types import SLIDE_WIDTH_IN, TextBox

_CREAM = (250, 248, 244)
_GOLD = (255, 234, 191)
_QUOTE = (239, 237, 236)
_GOSPEL = (255, 222, 158)


def _px(inches: float, canvas_w: int) -> int:
    return int(round(inches * (canvas_w / SLIDE_WIDTH_IN)))


def _box_rect(box: TextBox, canvas_w: int) -> tuple[int, int, int, int]:
    return (
        _px(box.left, canvas_w),
        _px(box.top, canvas_w),
        _px(box.width, canvas_w),
        _px(box.height, canvas_w),
    )


def _fit_font(draw, text: str, box: TextBox, canvas_w: int):
    width_px = max(8, _px(box.width, canvas_w) - 8)
    height_px = max(8, _px(box.height, canvas_w) - 8)
    pt = int(box.max_pt)
    min_pt = int(box.min_pt)
    while pt >= min_pt:
        font = try_font(pt, bold=box.bold)
        if box.single_line:
            if text_width(draw, text, font) <= width_px:
                return font, [text]
        else:
            lines = wrap_text(draw, text, font, width_px)
            line_h = max(text_height(draw, "Ag", font), 1)
            if len(lines) * int(line_h * 1.14) <= height_px:
                return font, lines
        pt -= 1
    font = try_font(min_pt, bold=box.bold)
    if box.single_line:
        return font, [text]
    return font, wrap_text(draw, text, font, width_px)


def _draw_block(
    draw: ImageDraw.ImageDraw,
    text: str,
    box: TextBox,
    canvas_w: int,
    fill: tuple[int, int, int],
) -> None:
    if not (text or "").strip():
        return
    x, y, w, h = _box_rect(box, canvas_w)
    font, lines = _fit_font(draw, text.strip(), box, canvas_w)
    # Honour explicit paragraph breaks (e.g. Divider 3 gospel citation).
    if "\n" in text:
        width_px = max(8, _px(box.width, canvas_w) - 8)
        pt = int(box.max_pt)
        min_pt = int(box.min_pt)
        while pt >= min_pt:
            font = try_font(pt, bold=box.bold)
            wrapped: List[str] = []
            for para in text.strip().split("\n"):
                para = para.strip()
                if not para:
                    continue
                if box.single_line:
                    wrapped.append(para)
                else:
                    wrapped.extend(wrap_text(draw, para, font, width_px))
            line_h = max(text_height(draw, "Ag", font), 1)
            height_px = max(8, _px(box.height, canvas_w) - 8)
            if len(wrapped) * int(line_h * 1.14) <= height_px:
                lines = wrapped
                break
            pt -= 1
        else:
            font = try_font(min_pt, bold=box.bold)
            wrapped = []
            for para in text.strip().split("\n"):
                para = para.strip()
                if para:
                    wrapped.extend(wrap_text(draw, para, font, width_px))
            lines = wrapped or [text.strip()]
    line_h = max(text_height(draw, "Ag", font), 1)
    total_h = int(len(lines) * line_h * 1.14)
    cy = y + max(0, (h - total_h) // 2)
    for i, line in enumerate(lines):
        tw = text_width(draw, line, font)
        if box.align == "left":
            tx = x
        elif box.align == "right":
            tx = x + max(0, w - tw)
        else:
            tx = x + max(0, (w - tw) // 2)
        draw.text((tx, cy + int(i * line_h * 1.14)), line, fill=fill, font=font)


def _year_date_line(year_cycle: str, date_display: str) -> str:
    cycle = (year_cycle or "—").strip().upper()
    date_line = (date_display or "").strip().upper()
    if date_line:
        return f"YEAR {cycle} | {date_line}"
    return f"YEAR {cycle}"


def _citation_lines(reference: str, template_id: str) -> List[str]:
    ref = (reference or "").strip() or "—"
    ref = ref.replace("-", "–")
    if template_id == "divider1":
        return [f"GOSPEL ({ref.upper()})"]
    if template_id == "divider3":
        cite = ref.upper()
        if cite.startswith("GOSPEL"):
            cite = cite.split("GOSPEL", 1)[-1].strip(" |:()")
        return ["GOSPEL", cite or "—"]
    return [ref.upper()]


def _citation(reference: str, template_id: str) -> str:
    return "\n".join(_citation_lines(reference, template_id))


def render(canvas: Image.Image, ctx: RenderContext) -> Image.Image:
    w, h = ctx.width, ctx.height
    content = ctx.content
    hero_path = content.hero_image_path
    if not hero_image_is_real(hero_path):
        raise ValueError(f"Hero image missing: {hero_path}")
    hero = Image.open(hero_path).convert("RGB")
    paste_hero_cover(canvas, hero, (0, 0, w, h))
    draw = ImageDraw.Draw(canvas)

    template = get_divider_template(getattr(content, "divider_template_id", None))
    boxes = template.boxes
    co_name = str(getattr(content, "co_celebrant_name", "") or "").strip()
    heading = str(getattr(content, "heading", "") or "").strip() or "HOLY EUCHARISTIC CELEBRATION"

    if "heading" in boxes and template.has_heading:
        _draw_block(draw, heading, boxes["heading"], w, _CREAM)
    if "sunday_title" in boxes:
        _draw_block(draw, content.title, boxes["sunday_title"], w, _CREAM)
    if "year_date" in boxes:
        _draw_block(
            draw,
            _year_date_line(content.year_cycle, content.date_display),
            boxes["year_date"],
            w,
            _CREAM,
        )
    if "celebrant_label" in boxes:
        label = "HOLY MASS CELEBRANT:" if template.id == "divider3" else "MASS CELEBRANT:"
        _draw_block(draw, label, boxes["celebrant_label"], w, _GOLD)
    if "celebrant_name" in boxes:
        _draw_block(draw, content.celebrant_name or "—", boxes["celebrant_name"], w, _CREAM)
    if co_name and "co_celebrant_label" in boxes:
        _draw_block(draw, "CO - CELEBRANT:", boxes["co_celebrant_label"], w, _GOLD)
    if co_name and "co_celebrant_name" in boxes:
        _draw_block(draw, co_name, boxes["co_celebrant_name"], w, _CREAM)
    if "gospel_quote" in boxes:
        quote = (content.gospel_quote or "").strip()
        if quote and quote[0] not in "\"“":
            quote = f"“{quote}"
        if quote and quote[-1] not in "\"”":
            quote = f"{quote}”"
        if template.id == "divider3":
            parts = _divider_quote_lines(quote)
            ql, qt, qw, qh, cl, ct, cw, ch, _, _ = _divider3_panel_quote_layout(
                parts, fallback_line=quote
            )
            quote_box = TextBox(
                "gospel_quote", ql, qt, qw, qh, 39, 36, bold=False, align="center"
            )
            cite_box = TextBox(
                "gospel_citation", cl, ct, cw, ch, 35, 22, bold=True, align="center"
            )
            _draw_block(draw, quote, quote_box, w, _QUOTE)
            _draw_block(
                draw,
                _citation(content.gospel_reference, template.id),
                cite_box,
                w,
                _GOSPEL,
            )
        else:
            _draw_block(draw, quote, boxes["gospel_quote"], w, _QUOTE)
            if "gospel_citation" in boxes:
                _draw_block(
                    draw,
                    _citation(content.gospel_reference, template.id),
                    boxes["gospel_citation"],
                    w,
                    _GOLD,
                )
    elif "gospel_citation" in boxes:
        _draw_block(
            draw,
            _citation(content.gospel_reference, template.id),
            boxes["gospel_citation"],
            w,
            _GOLD if template.id != "divider3" else _GOSPEL,
        )

    ctx.image = canvas
    ctx.draw = draw
    return canvas
