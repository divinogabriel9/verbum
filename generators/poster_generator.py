"""Portrait mass poster (social) + 16×9 poster for projection / deck handouts."""

from __future__ import annotations

from pathlib import Path
from typing import Any, Literal, Mapping, Optional, Tuple

from PIL import Image, ImageDraw, ImageFont

from services.community_config import get_community_name

_PROJECT_ROOT = Path(__file__).resolve().parents[1]
_OUTPUT_DIR = _PROJECT_ROOT / "outputs"

POSTER_W = 1080
POSTER_H = 1350
PPT_POSTER_W = 1920
PPT_POSTER_H = 1080

PosterTemplate = Literal["classic_white", "liturgical_color"]


def _text_width(draw: ImageDraw.ImageDraw, text: str, font: ImageFont.ImageFont) -> float:
    if hasattr(draw, "textlength"):
        return float(draw.textlength(text, font=font))
    bbox = draw.textbbox((0, 0), text, font=font)
    return float(bbox[2] - bbox[0])


def _wrap_lines(draw: ImageDraw.ImageDraw, text: str, font: ImageFont.ImageFont, max_width: int) -> list[str]:
    lines: list[str] = []
    for paragraph in text.split("\n"):
        paragraph = paragraph.strip()
        if not paragraph:
            continue
        words = paragraph.split()
        current: list[str] = []
        for w in words:
            trial = " ".join(current + [w])
            if _text_width(draw, trial, font) <= max_width:
                current.append(w)
            else:
                if current:
                    lines.append(" ".join(current))
                current = [w]
        if current:
            lines.append(" ".join(current))
    return lines or [""]


def _try_font(size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    for path in (
        "/System/Library/Fonts/Supplemental/Arial.ttf",
        "/System/Library/Fonts/Helvetica.ttc",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    ):
        try:
            return ImageFont.truetype(path, size=size)
        except OSError:
            continue
    return ImageFont.load_default()


def _tint_rgb(rgb: tuple[int, int, int], *, toward_white: float = 0.86) -> tuple[int, int, int]:
    r, g, b = rgb
    t = toward_white
    return (
        int(r * (1 - t) + 255 * t),
        int(g * (1 - t) + 255 * t),
        int(b * (1 - t) + 255 * t),
    )


def _darken_for_text(bg: tuple[int, int, int]) -> tuple[int, int, int]:
    """Aim for readable body on tinted background."""
    lum = (0.2126 * bg[0] + 0.7152 * bg[1] + 0.0722 * bg[2]) / 255.0
    if lum > 0.72:
        return (32, 30, 28)
    return (245, 242, 237)


def _muted_text(title_rgb: tuple[int, int, int]) -> tuple[int, int, int]:
    return tuple(int(c * 0.55 + 128 * 0.45) for c in title_rgb)  # type: ignore[return-value]


def _paste_logo(img: Image.Image, logo_path: Path, *, margin_x: int) -> None:
    logo = Image.open(logo_path).convert("RGBA")
    pw, ph = img.size
    max_w = min(220, int(pw * 0.22))
    w, h = logo.size
    if w > max_w:
        nh = max(1, int(h * (max_w / w)))
        logo = logo.resize((max_w, nh), Image.Resampling.LANCZOS)
    lw, lh = logo.size
    x = pw - margin_x - lw
    y = ph - margin_x - lh
    img.paste(logo, (x, y), logo)


def _layout_fonts(pw: int, ph: int) -> tuple[float, int, int, int, int, int]:
    """Scale factor, kicker, title, date, body, margin."""
    portrait = ph >= pw * 1.02
    if portrait:
        s = min(pw / 1080.0, ph / 1350.0)
        margin = max(48, int(72 * s))
        return (
            s,
            max(11, int(13 * s)),
            max(26, int(40 * s)),
            max(18, int(26 * s)),
            max(16, int(22 * s)),
            margin,
        )
    s = min(pw / 1920.0, ph / 1080.0)
    margin = max(40, int(56 * s))
    return (
        s,
        max(10, int(12 * s)),
        max(22, int(34 * s)),
        max(16, int(22 * s)),
        max(14, int(19 * s)),
        margin,
    )


def _diagonal_gradient_image(pw: int, ph: int, c_tl: tuple[int, int, int], c_br: tuple[int, int, int]) -> Image.Image:
    s = 128
    grad = Image.new("RGB", (s, s))
    gp = grad.load()
    sm1 = max(1, s - 1)
    for y in range(s):
        for x in range(s):
            t = (x + y) / (2 * sm1)
            gp[x, y] = tuple(int(c_tl[i] * (1 - t) + c_br[i] * t) for i in range(3))
    return grad.resize((pw, ph), Image.Resampling.LANCZOS)


def _with_accent_orb(
    rgb_base: Image.Image,
    accent: tuple[int, int, int] = (241, 95, 58),
    opacity: float = 0.22,
) -> Image.Image:
    w, h = rgb_base.size
    layer = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    dr = ImageDraw.Draw(layer)
    a = int(255 * opacity)
    ar, ag, ab = accent
    dr.ellipse(
        [int(w * 0.56), int(-h * 0.08), int(w * 1.05), int(h * 0.44)],
        fill=(ar, ag, ab, a),
    )
    return Image.alpha_composite(rgb_base.convert("RGBA"), layer).convert("RGB")


def _compose_mass_poster_image(
    pw: int,
    ph: int,
    *,
    title: str,
    gospel_reference: str,
    celebrant: str,
    date: str,
    template: PosterTemplate,
    liturgical_color: Optional[Mapping[str, Any]],
    logo_path: Optional[Path],
    community_name: str,
    gospel_quote: str,
    entrance_title: str,
    communion_titles: str,
) -> Image.Image:
    """
    Dashboard-style poster: diagonal gradient + soft accent orb (Theme Lab / poster live preview),
    left-aligned headline stack, footer band, logo lower-right.
    """
    _s, fs_kicker, fs_title, fs_date, fs_line, margin_x = _layout_fonts(pw, ph)
    max_text_w = min(int(pw * 0.78), pw - 2 * margin_x)
    x_left = margin_x

    lit_rgb: tuple[int, int, int] = (23, 32, 51)
    if liturgical_color and "rgb" in liturgical_color:
        raw = liturgical_color["rgb"]
        lit_rgb = (int(raw[0]), int(raw[1]), int(raw[2]))

    if template == "classic_white":
        c_tl = (248, 250, 252)
        c_br = (226, 232, 240)
        kicker_c = (180, 83, 9)
        title_c = (15, 23, 42)
        body_c = (51, 65, 85)
        muted_c = (100, 116, 139)
        orb = (241, 95, 58)
    else:
        base = _tint_rgb(lit_rgb, toward_white=0.08)
        c_tl = (max(0, base[0] - 38), max(0, base[1] - 32), max(0, base[2] - 28))
        c_br = _tint_rgb(lit_rgb, toward_white=0.12)
        kicker_c = (248, 198, 106)
        title_c = (255, 255, 255)
        body_c = (226, 232, 240)
        muted_c = (186, 199, 215)
        orb = (241, 95, 58)

    img = _with_accent_orb(_diagonal_gradient_image(pw, ph, c_tl, c_br), accent=orb, opacity=0.22)
    draw = ImageDraw.Draw(img)

    font_kicker = _try_font(fs_kicker)
    font_title = _try_font(fs_title)
    font_date = _try_font(fs_date)
    font_line = _try_font(fs_line)

    gq = (gospel_quote or "").strip()
    if len(gq) > 420:
        gq = gq[:417].rstrip() + "…"

    comm = (community_name or "").strip() or get_community_name()
    ent = (entrance_title or "").strip()
    comm_line = (communion_titles or "").strip()

    lit_name = ""
    if liturgical_color:
        lit_name = str(liturgical_color.get("color_name") or "").strip().upper()
    kicker_text = (lit_name + " · MASS")[:44] if lit_name else "SUNDAY MASS"

    title_lines = _wrap_lines(draw, (title or "Mass").strip(), font_title, max_text_w)
    quote_lines = _wrap_lines(draw, f"“{gq}”", font_line, max_text_w) if gq else []
    music_blocks: list[str] = []
    if ent:
        music_blocks.append(f"Entrance: {ent}")
    if comm_line:
        music_blocks.append(f"Communion: {comm_line}")
    music_lines: list[str] = []
    for blk in music_blocks:
        music_lines.extend(_wrap_lines(draw, blk, font_line, max_text_w))

    footer_lines: list[str] = [
        f"{date or '—'} · {celebrant or '—'}",
        f"Gospel: {gospel_reference or '—'}",
    ]
    if comm:
        footer_lines.append(comm)

    def line_h(text: str, font: ImageFont.ImageFont) -> int:
        bbox = draw.textbbox((0, 0), text or " ", font=font)
        return bbox[3] - bbox[1]

    logo_reserve = min(200, int(ph * 0.22))
    gap_k = 10
    gap_s = 14
    gap_sm = 8

    footer_h = sum(line_h(ln, font_line) + gap_sm for ln in footer_lines) + gap_sm
    y_footer = ph - margin_x - footer_h - logo_reserve

    y = margin_x + int(ph * 0.02)
    draw.text((x_left, y), kicker_text, fill=kicker_c, font=font_kicker)
    y += line_h(kicker_text, font_kicker) + gap_k

    for ln in title_lines:
        draw.text((x_left, y), ln, fill=title_c, font=font_title)
        y += line_h(ln, font_title) + gap_s

    y += gap_s
    for ln in quote_lines:
        if y > y_footer - line_h(ln, font_line) - 12:
            break
        draw.text((x_left, y), ln, fill=body_c, font=font_line)
        y += line_h(ln, font_line) + gap_sm

    if music_lines:
        y += gap_s
        for ln in music_lines:
            if y > y_footer - line_h(ln, font_line) - 8:
                break
            draw.text((x_left, y), ln, fill=muted_c, font=font_line)
            y += line_h(ln, font_line) + gap_sm

    fy = y_footer
    for ln in footer_lines:
        draw.text((x_left, fy), ln, fill=muted_c, font=font_line)
        fy += line_h(ln, font_line) + gap_sm

    if logo_path and logo_path.is_file():
        _paste_logo(img, logo_path, margin_x=margin_x)

    return img


def compose_mass_poster_wallpaper(
    pw: int,
    ph: int,
    *,
    template: PosterTemplate = "liturgical_color",
    liturgical_color: Optional[Mapping[str, Any]] = None,
) -> Image.Image:
    """Liturgical gradient + accent orb only (no baked-in poster text)."""
    lit_rgb: tuple[int, int, int] = (23, 32, 51)
    if liturgical_color and "rgb" in liturgical_color:
        raw = liturgical_color["rgb"]
        lit_rgb = (int(raw[0]), int(raw[1]), int(raw[2]))

    if template == "classic_white":
        c_tl = (248, 250, 252)
        c_br = (226, 232, 240)
        orb = (241, 95, 58)
    else:
        base = _tint_rgb(lit_rgb, toward_white=0.08)
        c_tl = (max(0, base[0] - 38), max(0, base[1] - 32), max(0, base[2] - 28))
        c_br = _tint_rgb(lit_rgb, toward_white=0.12)
        orb = (241, 95, 58)

    return _with_accent_orb(_diagonal_gradient_image(pw, ph, c_tl, c_br), accent=orb, opacity=0.22)


def generate_mass_poster(
    title: str,
    gospel_reference: str,
    celebrant: str,
    date: str,
    *,
    template: PosterTemplate = "liturgical_color",
    liturgical_color: Optional[Mapping[str, Any]] = None,
    logo_path: Optional[Path] = None,
    community_name: Optional[str] = None,
    gospel_quote: str = "",
    entrance_song_title: str = "",
    communion_song_titles: str = "",
    output_stem: str = "mass_poster",
) -> Tuple[Path, Path]:
    """
    Writes ``outputs/{output_stem}.png`` (1080×1350, social / feed) and
    ``outputs/{output_stem}_16x9.png`` (1920×1080, presentation-friendly).

    Default ``output_stem="mass_poster"`` preserves legacy filenames.

    Returns ``(social_path, ppt_aspect_path)``.
    """
    _OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    stem = (output_stem or "mass_poster").strip() or "mass_poster"
    social_path = _OUTPUT_DIR / f"{stem}.png"
    ppt_path = _OUTPUT_DIR / f"{stem}_16x9.png"

    comm = (community_name or "").strip() or get_community_name()

    img_social = _compose_mass_poster_image(
        POSTER_W,
        POSTER_H,
        title=title,
        gospel_reference=gospel_reference,
        celebrant=celebrant,
        date=date,
        template=template,
        liturgical_color=liturgical_color,
        logo_path=logo_path,
        community_name=comm,
        gospel_quote=gospel_quote,
        entrance_title=entrance_song_title,
        communion_titles=communion_song_titles,
    )
    img_social.save(social_path, format="PNG", optimize=True)

    # For the 16×9 variant used as slide wallpaper, keep only the liturgical
    # gradient + orb; all readable text comes from PowerPoint text boxes.
    img_ppt = compose_mass_poster_wallpaper(
        PPT_POSTER_W,
        PPT_POSTER_H,
        template=template,
        liturgical_color=liturgical_color,
    )
    img_ppt.save(ppt_path, format="PNG", optimize=True)

    return social_path, ppt_path


def _letterbox(image: Image.Image, size: tuple[int, int], bg: tuple[int, int, int]) -> Image.Image:
    tw, th = size
    iw, ih = image.size
    scale = min(tw / iw, th / ih)
    nw, nh = max(1, int(iw * scale)), max(1, int(ih * scale))
    resized = image.resize((nw, nh), Image.Resampling.LANCZOS)
    canvas = Image.new("RGB", (tw, th), bg)
    ox = (tw - nw) // 2
    oy = (th - nh) // 2
    canvas.paste(resized, (ox, oy))
    return canvas


def export_social_variants(
    poster_path: Path,
    output_dir: Optional[Path] = None,
    *,
    prefix: str = "mass_poster",
) -> dict[str, Path]:
    """
    Instagram 1:1, Stories 9:16, Open Graph 1.91:1 — written next to ``poster_path``.
    """
    output_dir = output_dir or poster_path.parent
    output_dir.mkdir(parents=True, exist_ok=True)
    src = Image.open(poster_path).convert("RGB")
    w, h = src.size
    out: dict[str, Path] = {}

    side = min(w, h)
    left = (w - side) // 2
    top = (h - side) // 2
    square_src = src.crop((left, top, left + side, top + side))
    p_sq = output_dir / f"{prefix}_instagram_square.png"
    square_src.resize((1080, 1080), Image.Resampling.LANCZOS).save(p_sq, format="PNG", optimize=True)
    out["instagram_square"] = p_sq

    letterbox_bg = (22, 22, 26)
    p_story = output_dir / f"{prefix}_instagram_story.png"
    _letterbox(src, (1080, 1920), letterbox_bg).save(p_story, format="PNG", optimize=True)
    out["instagram_story"] = p_story

    p_og = output_dir / f"{prefix}_open_graph.png"
    _letterbox(src, (1200, 630), letterbox_bg).save(p_og, format="PNG", optimize=True)
    out["open_graph"] = p_og

    return out
