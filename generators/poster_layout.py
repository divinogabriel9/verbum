"""
Pillow layout engine for AI Mass posters: title, hero image, Gospel quote, info, celebrant, footer.

Liturgical accent colors (poster-specific; Easter uses gold accents even when vestments are white):

- Advent / Lent → purple
- Easter → gold
- Pentecost → red
- Ordinary Time → green
- Christmas and other white seasons → soft gold / cream accent on white
"""

from __future__ import annotations

from pathlib import Path
from typing import Mapping, Optional, Tuple

from PIL import Image, ImageDraw, ImageFont

AccentRGB = Tuple[int, int, int]


def poster_accent_rgb(liturgical_season_key: str) -> AccentRGB:
    """
    Map calendar season machine keys to RGB accents for borders and highlights.

    ``liturgical_season_key`` matches ``get_liturgical_color()`` ``season`` field:
    advent, christmas, lent, easter, ordinary_time, pentecost.
    """
    sk = (liturgical_season_key or "").strip().lower()
    if sk in ("advent", "lent"):
        return (92, 61, 140)  # purple
    if sk == "easter":
        return (200, 155, 55)  # gold
    if sk == "pentecost":
        return (178, 34, 34)  # red
    if sk == "ordinary_time":
        return (45, 106, 62)  # green
    if sk == "christmas":
        return (198, 160, 89)  # warm gold on white seasons
    return (120, 118, 128)


def _try_font(size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    for path in (
        "/System/Library/Fonts/Supplemental/Georgia.ttf",
        "/System/Library/Fonts/Supplemental/Arial.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    ):
        try:
            return ImageFont.truetype(path, size=size)
        except OSError:
            continue
    return ImageFont.load_default()


def _wrap(draw: ImageDraw.ImageDraw, text: str, font: ImageFont.ImageFont, max_w: int) -> list[str]:
    lines: list[str] = []
    for paragraph in (text or "").split("\n"):
        paragraph = paragraph.strip()
        if not paragraph:
            continue
        words = paragraph.split()
        cur: list[str] = []
        for w in words:
            trial = " ".join(cur + [w])
            bbox = draw.textbbox((0, 0), trial, font=font)
            if bbox[2] - bbox[0] <= max_w:
                cur.append(w)
            else:
                if cur:
                    lines.append(" ".join(cur))
                cur = [w]
        if cur:
            lines.append(" ".join(cur))
    return lines or [""]


def _draw_rounded_rect(
    draw: ImageDraw.ImageDraw,
    xy: tuple[int, int, int, int],
    fill: AccentRGB,
    outline: AccentRGB,
    width: int = 3,
) -> None:
    draw.rounded_rectangle(xy, radius=12, fill=fill, outline=outline, width=width)


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
) -> Image.Image:
    """
    Compose one poster frame at the requested pixel size.

    Layout (top → bottom):
    1. Top title band — liturgical day
    2. Main image — scaled/cropped AI art
    3. Quote box — Gospel quote + reference
    4. Info box — lectionary year + date
    5. Celebrant line
    6. Footer — community name
    """
    w, h = size
    accent = poster_accent_rgb(liturgical_season_key)
    bg = (18, 18, 22)

    img = Image.new("RGB", (w, h), bg)
    draw = ImageDraw.Draw(img)

    margin = max(16, int(w * 0.04))
    title_h = int(h * 0.08)
    footer_h = int(h * 0.06)
    hero_h = max(int((h - title_h - footer_h - int(h * 0.28)) * 0.72), int(h * 0.38))

    font_title = _try_font(max(18, int(w / 28)))
    font_quote = _try_font(max(15, int(w / 32)))
    font_meta = _try_font(max(13, int(w / 38)))
    font_small = _try_font(max(12, int(w / 42)))

    # --- Title band ---
    title_band = (margin, margin, w - margin, margin + title_h)
    draw.rounded_rectangle(
        title_band,
        radius=8,
        fill=(accent[0] // 4 + 20, accent[1] // 4 + 20, accent[2] // 4 + 24),
    )
    title_lines = _wrap(draw, liturgical_day, font_title, w - 2 * margin - 16)
    ty = margin + 8
    for ln in title_lines[:2]:
        tw = draw.textbbox((0, 0), ln, font=font_title)
        draw.text((margin + 12, ty), ln, fill=(248, 246, 240), font=font_title)
        ty += tw[3] - tw[1] + 4

    # --- Hero image ---
    y0 = margin + title_h + 10
    box = (margin, y0, w - margin, y0 + hero_h)
    bw, bh = box[2] - box[0], box[3] - box[1]
    try:
        hero = Image.open(hero_image_path).convert("RGB")
    except OSError:
        hero = Image.new("RGB", (max(bw, 2), max(bh, 2)), (42, 40, 58))
        hd = ImageDraw.Draw(hero)
        hd.rectangle((0, 0, bw - 1, bh - 1), outline=accent, width=4)
        hint = "HF token missing or image decode failed — check outputs/images hero PNG."
        for i, ln in enumerate(_wrap(hd, hint, font_small, max(bw - 20, 80))[:5]):
            hd.text((12, 12 + i * 18), ln, fill=(230, 225, 210), font=font_small)
    irw, irh = hero.size
    scale = max(bw / max(irw, 1), bh / max(irh, 1))
    nw, nh = max(1, int(irw * scale)), max(1, int(irh * scale))
    hero2 = hero.resize((nw, nh), Image.Resampling.LANCZOS)
    cx = (nw - bw) // 2
    cy = (nh - bh) // 2
    hero2 = hero2.crop((cx, cy, cx + bw, cy + bh))
    img.paste(hero2, (box[0], box[1]))

    draw.rounded_rectangle(box, radius=10, outline=accent, width=3)

    # --- Quote + info stack ---
    y1 = box[3] + 12
    quote_h = int(h * 0.12)
    inner_w = w - 2 * margin

    qbox = (margin, y1, w - margin, min(y1 + quote_h + 40, h - footer_h - 50))
    _draw_rounded_rect(
        draw,
        qbox,
        fill=(28, 28, 34),
        outline=accent,
        width=2,
    )
    qpad = margin + 14
    quote_text = (gospel_quote or "—").strip()
    if len(quote_text) > 420:
        quote_text = quote_text[:417] + "…"
    qlines = _wrap(draw, f"“{quote_text}”", font_quote, inner_w - 28)
    qy = y1 + 10
    for ln in qlines[:6]:
        draw.text((qpad, qy), ln, fill=(245, 242, 235), font=font_quote)
        bbox = draw.textbbox((0, 0), ln, font=font_quote)
        qy += bbox[3] - bbox[1] + 4
    ref_ln = (gospel_reference or "—").strip()
    draw.text((qpad, qy + 4), ref_ln, fill=accent, font=font_meta)

    y2 = qy + 28 + (draw.textbbox((0, 0), ref_ln, font=font_meta)[3] - draw.textbbox((0, 0), ref_ln, font=font_meta)[1])
    info_y = max(y2 + 8, qbox[3] + 8)
    ibox = (margin, info_y, w - margin, info_y + 52)
    _draw_rounded_rect(draw, ibox, fill=(32, 32, 38), outline=accent, width=2)
    info_line = f"Sunday Lectionary Year {year_cycle}".strip() if year_cycle else "Sunday Lectionary"
    draw.text((margin + 14, info_y + 8), info_line, fill=(220, 218, 210), font=font_meta)
    draw.text((margin + 14, info_y + 30), date_display, fill=(180, 178, 170), font=font_small)

    celeb_y = ibox[3] + 10
    celeb = f"Mass Celebrant: {celebrant_name or '—'}"
    draw.text((margin + 6, celeb_y), celeb, fill=(230, 228, 220), font=font_meta)

    # --- Footer ---
    foot = (community_name or "").strip()
    if foot:
        fb = draw.textbbox((0, 0), foot, font=font_small)
        draw.text(((w - (fb[2] - fb[0])) // 2, h - margin - (fb[3] - fb[1])), foot, fill=accent, font=font_small)

    return img


def _letterbox_image(image: Image.Image, size: tuple[int, int], bg: tuple[int, int, int]) -> Image.Image:
    tw, th = size
    iw, ih = image.size
    scale = min(tw / max(iw, 1), th / max(ih, 1))
    nw, nh = max(1, int(iw * scale)), max(1, int(ih * scale))
    resized = image.resize((nw, nh), Image.Resampling.LANCZOS)
    canvas = Image.new("RGB", (tw, th), bg)
    ox = (tw - nw) // 2
    oy = (th - nh) // 2
    canvas.paste(resized, (ox, oy))
    return canvas


def export_poster_sizes(
    master: Image.Image,
    out_dir: Path,
    *,
    instagram_post: tuple[int, int] = (1080, 1350),
    instagram_story: tuple[int, int] = (1080, 1920),
    facebook: tuple[int, int] = (1200, 630),
) -> dict[str, Path]:
    """
    Resize / letterbox the composed master into standard social sizes and write PNG files.

    Writes ``mass_poster_instagram.png``, ``mass_poster_story.png``, ``mass_poster_facebook.png``.
    """
    out_dir.mkdir(parents=True, exist_ok=True)
    paths: dict[str, Path] = {}

    def save_scaled(target: tuple[int, int], name: str, letterbox: bool) -> None:
        tw, th = target
        if letterbox:
            out_img = _letterbox_image(master, (tw, th), (18, 18, 22))
        else:
            out_img = master.resize((tw, th), Image.Resampling.LANCZOS)
        p = out_dir / name
        out_img.save(p, format="PNG", optimize=True)
        key = name.replace(".png", "").replace("mass_poster_", "")
        paths[key] = p

    save_scaled(instagram_post, "mass_poster_instagram.png", letterbox=False)
    save_scaled(instagram_story, "mass_poster_story.png", letterbox=True)
    save_scaled(facebook, "mass_poster_facebook.png", letterbox=True)
    return paths
