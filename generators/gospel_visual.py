"""
Phase 3 kickstart: non-AI "Gospel moment" artwork — gradients in liturgical colors.

Optional later: swap for real AI generation using the same entry point.
"""

from __future__ import annotations

from pathlib import Path
from typing import Mapping, Optional, Tuple

from PIL import Image, ImageDraw, ImageFont

_PROJECT_ROOT = Path(__file__).resolve().parents[1]
_OUTPUT_DIR = _PROJECT_ROOT / "outputs"

BodyRGB = Tuple[int, int, int]


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


def _blend(a: BodyRGB, b: BodyRGB, t: float) -> BodyRGB:
    return (
        int(a[0] + (b[0] - a[0]) * t),
        int(a[1] + (b[1] - a[1]) * t),
        int(a[2] + (b[2] - a[2]) * t),
    )


def _rel_lum(c: BodyRGB) -> float:
    r, g, b = [x / 255.0 for x in c]

    def lin(x: float) -> float:
        return x / 12.92 if x <= 0.03928 else ((x + 0.055) / 1.055) ** 2.4

    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)


def render_gospel_moment(
    out_path: Optional[Path] = None,
    *,
    liturgical_color: Optional[Mapping[str, object]] = None,
    line1: str = "Gospel",
    line2: str = "",
    size: Tuple[int, int] = (1080, 1080),
) -> Path:
    """
    Square social asset with smooth diagonal gradient; short captions optional.
    """
    _OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    if out_path is None:
        out_path = _OUTPUT_DIR / "gospel_moment.png"

    rw, rh = size
    if liturgical_color and "rgb" in liturgical_color:
        raw = liturgical_color["rgb"]
        base: BodyRGB = (int(raw[0]), int(raw[1]), int(raw[2]))
    else:
        base = (58, 68, 62)

    accent = _blend(base, (255, 245, 230), 0.35)
    deep = _blend(base, (12, 14, 18), 0.55)

    img = Image.new("RGB", (rw, rh))
    px = img.load()
    rw1 = max(rw - 1, 1)
    rh1 = max(rh - 1, 1)
    for y in range(rh):
        for x in range(rw):
            tx = x / rw1
            ty = y / rh1
            t = (tx * 0.45 + ty * 0.55)
            px[x, y] = _blend(deep, accent, t)

    draw = ImageDraw.Draw(img)
    title_font = _try_font(36)
    sub_font = _try_font(22)
    caption = (line1 or "Gospel").strip()[:80]
    sub = (line2 or "").strip()[:100]

    lum = _rel_lum(accent)
    text_fill: BodyRGB = (18, 18, 22) if lum > 0.55 else (245, 243, 238)

    bbox = draw.textbbox((0, 0), caption, font=title_font)
    tx = (rw - (bbox[2] - bbox[0])) // 2
    ty = rh // 2 - 48
    draw.text((tx, ty), caption, fill=text_fill, font=title_font)

    if sub:
        bbox2 = draw.textbbox((0, 0), sub, font=sub_font)
        sx = (rw - (bbox2[2] - bbox2[0])) // 2
        draw.text((sx, ty + 52), sub, fill=text_fill, font=sub_font)

    img.save(out_path, format="PNG", optimize=True)
    return out_path
