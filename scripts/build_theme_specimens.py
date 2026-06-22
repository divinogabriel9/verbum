"""Generate Theme 1 type-specimen PNGs for the Theme Lab card.

Each specimen renders a font in the exact color/background it occupies in the
generated deck, with an uppercase and a lowercase line so the Theme chooser can
show "what font is used inside the theme" at a glance.

Run from the project root:  python scripts/build_theme_specimens.py
"""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

_ROOT = Path(__file__).resolve().parents[1]
_OUT = _ROOT / "static" / "images" / "theme"
_SYS = Path("/System/Library/Fonts/Supplemental")
_BUNDLED_FONTS = _ROOT / "data" / "reference" / "fonts"

SCALE = 2  # render at 2x for crisp display
W, H = 760, 232

UPPER = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
LOWER = "abcdefghijklmnopqrstuvwxyz"

# (slug, ttf path, bg hex, text hex, big-sample)
# Black backgrounds throughout; the highlighted Georgia section tags use the amber
# accent #FFB800, body/emphasis stay off-white, hymn lyrics white.
SPECIMENS = [
    ("georgia", _SYS / "Georgia Bold.ttf", "#000000", "#FFB800", "Aa Gg Rr 123"),
    ("arial", _SYS / "Arial.ttf", "#000000", "#F0FDF4", "Aa Gg Rr 123"),
    ("poppins", _BUNDLED_FONTS / "Poppins-Bold.ttf", "#000000", "#FFFFFF", "AA GG RR"),
    ("arialblack", _SYS / "Arial Black.ttf", "#000000", "#F0FDF4", "Aa 123"),
]


def _hex(value: str) -> tuple[int, int, int]:
    v = value.lstrip("#")
    return int(v[0:2], 16), int(v[2:4], 16), int(v[4:6], 16)


def _font(path: Path, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(path), size * SCALE)


def build() -> None:
    _OUT.mkdir(parents=True, exist_ok=True)
    for slug, ttf, bg, fg, big in SPECIMENS:
        if not ttf.is_file():
            print(f"skip {slug}: missing {ttf}")
            continue
        img = Image.new("RGB", (W * SCALE, H * SCALE), _hex(bg))
        draw = ImageDraw.Draw(img)
        fg_rgb = _hex(fg)
        pad = 28 * SCALE
        draw.text((pad, 22 * SCALE), big, font=_font(ttf, 46), fill=fg_rgb)
        draw.text((pad, 112 * SCALE), UPPER, font=_font(ttf, 24), fill=fg_rgb)
        draw.text((pad, 158 * SCALE), LOWER, font=_font(ttf, 24), fill=fg_rgb)
        img = img.resize((W, H), Image.LANCZOS)
        out = _OUT / f"{slug}.png"
        img.save(out)
        print(f"wrote {out}")


if __name__ == "__main__":
    build()
