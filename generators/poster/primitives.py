"""Shared drawing primitives: fonts, text, stickers, atmosphere."""

from __future__ import annotations

import math
import re
from pathlib import Path
from typing import TYPE_CHECKING

from PIL import Image, ImageDraw, ImageFilter, ImageFont

from generators.poster.types import FontSet, RGB

if TYPE_CHECKING:
    from generators.poster.types import RenderContext


def try_font(size: int, *, bold: bool = False) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    candidates: list[str] = []
    if bold:
        candidates.extend(
            (
                "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
                "/System/Library/Fonts/Supplemental/Georgia Bold.ttf",
                "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
            )
        )
    else:
        candidates.extend(
            (
                "/System/Library/Fonts/Supplemental/Arial.ttf",
                "/System/Library/Fonts/Supplemental/Georgia.ttf",
                "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
            )
        )
    for path in candidates:
        try:
            return ImageFont.truetype(path, size=size)
        except OSError:
            continue
    return ImageFont.load_default()


def try_script_font(size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    for path in (
        "/System/Library/Fonts/Supplemental/Brush Script.ttf",
        "/System/Library/Fonts/Supplemental/SnellRoundhand.ttc",
        "/System/Library/Fonts/Supplemental/Zapfino.ttf",
        "/System/Library/Fonts/Supplemental/Georgia Italic.ttf",
    ):
        try:
            return ImageFont.truetype(path, size=size)
        except OSError:
            continue
    return try_font(size)


def load_fonts(scale: float) -> FontSet:
    return FontSet(
        title=try_font(max(36, int(78 * scale)), bold=True),
        meta=try_font(max(14, int(24 * scale)), bold=True),
        celebrant=try_font(max(12, int(18 * scale)), bold=True),
        script=try_script_font(max(28, int(56 * scale))),
        quote=try_font(max(15, int(26 * scale)), bold=True),
        gospel=try_font(max(13, int(20 * scale)), bold=True),
        gospel_ref=try_font(max(12, int(18 * scale))),
        small=try_font(max(10, int(14 * scale))),
    )


def text_width(draw: ImageDraw.ImageDraw, text: str, font: ImageFont.ImageFont) -> int:
    if hasattr(draw, "textlength"):
        return int(draw.textlength(text, font=font))
    bbox = draw.textbbox((0, 0), text, font=font)
    return bbox[2] - bbox[0]


def text_height(draw: ImageDraw.ImageDraw, text: str, font: ImageFont.ImageFont) -> int:
    bbox = draw.textbbox((0, 0), text, font=font)
    return bbox[3] - bbox[1]


def wrap_text(
    draw: ImageDraw.ImageDraw, text: str, font: ImageFont.ImageFont, max_w: int
) -> list[str]:
    lines: list[str] = []
    for paragraph in (text or "").split("\n"):
        paragraph = paragraph.strip()
        if not paragraph:
            continue
        words = paragraph.split()
        cur: list[str] = []
        for w in words:
            trial = " ".join(cur + [w])
            if text_width(draw, trial, font) <= max_w:
                cur.append(w)
            else:
                if cur:
                    lines.append(" ".join(cur))
                cur = [w]
        if cur:
            lines.append(" ".join(cur))
    return lines or [""]


def callout_from_quote(gospel_quote: str) -> str:
    q = (gospel_quote or "").strip().strip("“”\"'")
    if not q:
        return ""
    m = re.search(r"([A-Za-z][A-Za-z'!]{1,24}!)", q)
    if m:
        return m.group(1)
    words = re.findall(r"[A-Za-z']+", q)
    if not words:
        return ""
    first = words[0]
    if len(first) <= 18:
        return first[0].upper() + first[1:] + ("!" if "!" in q else "")
    return (first[:18] + "!") if "!" in q else first[:18]


def format_date_badge_lines(date_display: str, year_cycle: str) -> tuple[str, str]:
    """Return (year_line, date_line) e.g. YEAR A / APRIL 5, 2026."""
    cycle = (year_cycle or "").strip().upper()
    year_line = f"YEAR {cycle}" if cycle and cycle != "—" else ""
    date_up = (date_display or "").strip().upper()
    # Drop weekday prefix for badge compactness
    for prefix in ("MONDAY, ", "TUESDAY, ", "WEDNESDAY, ", "THURSDAY, ", "FRIDAY, ", "SATURDAY, ", "SUNDAY, "):
        if date_up.startswith(prefix):
            date_up = date_up[len(prefix) :]
            break
    return year_line, date_up


def paste_logo_top_left(img: Image.Image, logo_path: Path, *, max_w: int, margin: int) -> int:
    try:
        logo = Image.open(logo_path).convert("RGBA")
    except OSError:
        return 0
    w, h = logo.size
    if w > max_w:
        nh = max(1, int(h * (max_w / w)))
        logo = logo.resize((max_w, nh), Image.Resampling.LANCZOS)
    lw, _ = logo.size
    img.paste(logo, (margin, margin), logo)
    return lw


def paste_hero_cover(img: Image.Image, hero: Image.Image, box: tuple[int, int, int, int]) -> None:
    x0, y0, x1, y1 = box
    bw, bh = x1 - x0, y1 - y0
    irw, irh = hero.size
    scale = max(bw / max(irw, 1), bh / max(irh, 1))
    nw, nh = max(1, int(irw * scale)), max(1, int(irh * scale))
    hero2 = hero.resize((nw, nh), Image.Resampling.LANCZOS)
    cx = (nw - bw) // 2
    cy = (nh - bh) // 2
    hero2 = hero2.crop((cx, cy, cx + bw, cy + bh))
    img.paste(hero2, (x0, y0))


def draw_paper_card(
    base: Image.Image,
    box: tuple[int, int, int, int],
    *,
    fill: RGB,
    shadow_offset: tuple[int, int] = (6, 8),
    radius: int = 14,
    rotation_deg: float = 0.0,
) -> Image.Image:
    """Return an RGBA card layer to alpha-composite onto base."""
    x0, y0, x1, y1 = box
    pad = 24
    layer = Image.new("RGBA", base.size, (0, 0, 0, 0))
    card = Image.new("RGBA", (x1 - x0 + pad * 2, y1 - y0 + pad * 2), (0, 0, 0, 0))
    cd = ImageDraw.Draw(card)
    sx, sy = shadow_offset
    cd.rounded_rectangle(
        (pad + sx, pad + sy, x1 - x0 + pad + sx, y1 - y0 + pad + sy),
        radius=radius,
        fill=(20, 18, 24, 70),
    )
    cd.rounded_rectangle(
        (pad, pad, x1 - x0 + pad, y1 - y0 + pad),
        radius=radius,
        fill=(*fill, 255),
        outline=(200, 190, 175, 180),
        width=2,
    )
    if rotation_deg:
        card = card.rotate(rotation_deg, expand=True, resample=Image.Resampling.BICUBIC)
    ox = x0 - (card.width - (x1 - x0)) // 2
    oy = y0 - (card.height - (y1 - y0)) // 2
    layer.paste(card, (ox, oy), card)
    return Image.alpha_composite(base.convert("RGBA"), layer).convert("RGB")


def draw_tape_strip(
    draw: ImageDraw.ImageDraw,
    cx: int,
    cy: int,
    *,
    width: int,
    height: int,
    color: RGB,
    angle_deg: float = -35,
) -> None:
    tape = Image.new("RGBA", (width, height), (*color, 210))
    tape = tape.rotate(angle_deg, expand=True, resample=Image.Resampling.BICUBIC)
    # Draw via temporary — use rectangle approximation on draw for speed
    hw, hh = width // 2, height // 2
    rad = math.radians(angle_deg)
    cos_a, sin_a = math.cos(rad), math.sin(rad)
    corners = [
        (-hw, -hh),
        (hw, -hh),
        (hw, hh),
        (-hw, hh),
    ]
    pts = []
    for dx, dy in corners:
        rx = int(cx + dx * cos_a - dy * sin_a)
        ry = int(cy + dx * sin_a + dy * cos_a)
        pts.append((rx, ry))
    draw.polygon(pts, fill=(*color, 200))


def apply_vignette(img: Image.Image, region: tuple[int, int, int, int], strength: float = 0.45) -> Image.Image:
    x0, y0, x1, y1 = region
    overlay = Image.new("RGBA", img.size, (0, 0, 0, 0))
    odraw = ImageDraw.Draw(overlay)
    cx = (x0 + x1) // 2
    cy = (y0 + y1) // 2
    rw = (x1 - x0) // 2
    rh = (y1 - y0) // 2
    for i in range(5, 0, -1):
        alpha = int(255 * strength * (i / 5) * 0.35)
        odraw.ellipse(
            (cx - rw * i // 5, cy - rh * i // 5, cx + rw * i // 5, cy + rh * i // 5),
            fill=(0, 0, 0, alpha),
        )
    return Image.alpha_composite(img.convert("RGBA"), overlay).convert("RGB")


def apply_center_glow(
    img: Image.Image,
    center: tuple[int, int],
    radius: int,
    color: RGB,
    opacity: float = 0.18,
) -> Image.Image:
    overlay = Image.new("RGBA", img.size, (0, 0, 0, 0))
    odraw = ImageDraw.Draw(overlay)
    cx, cy = center
    alpha = int(255 * opacity)
    odraw.ellipse(
        (cx - radius, cy - radius, cx + radius, cy + radius),
        fill=(*color, alpha),
    )
    blurred = overlay.filter(ImageFilter.GaussianBlur(radius=max(8, radius // 8)))
    return Image.alpha_composite(img.convert("RGBA"), blurred).convert("RGB")


def apply_light_rays(
    img: Image.Image,
    origin: tuple[int, int],
    color: RGB,
    opacity: float = 0.08,
) -> Image.Image:
    overlay = Image.new("RGBA", img.size, (0, 0, 0, 0))
    odraw = ImageDraw.Draw(overlay)
    ox, oy = origin
    w, h = img.size
    alpha = int(255 * opacity)
    for angle in range(0, 360, 28):
        rad = math.radians(angle)
        ex = int(ox + math.cos(rad) * max(w, h))
        ey = int(oy + math.sin(rad) * max(w, h))
        odraw.line((ox, oy, ex, ey), fill=(*color, alpha), width=max(40, w // 24))
    blurred = overlay.filter(ImageFilter.GaussianBlur(radius=28))
    return Image.alpha_composite(img.convert("RGBA"), blurred).convert("RGB")


def draw_text_in_box(
    ctx: RenderContext,
    box: tuple[int, int, int, int],
    lines: list[str],
    font: ImageFont.ImageFont,
    fill: RGB,
    *,
    align: str = "center",
    line_gap: int = 4,
) -> None:
    x0, y0, x1, y1 = box
    total_h = sum(text_height(ctx.draw, ln, font) + line_gap for ln in lines) - line_gap
    y = y0 + max(0, (y1 - y0 - total_h) // 2)
    for ln in lines:
        tw = text_width(ctx.draw, ln, font)
        if align == "center":
            x = x0 + (x1 - x0 - tw) // 2
        elif align == "right":
            x = x1 - tw - 8
        else:
            x = x0 + 12
        ctx.draw.text((x, y), ln, fill=fill, font=font)
        y += text_height(ctx.draw, ln, font) + line_gap
