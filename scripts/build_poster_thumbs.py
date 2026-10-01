#!/usr/bin/env python3
"""Build small WebP thumbs for Liturgy divider poster pickers (UI only).

Full PNGs stay used for PPTX generation. Re-run after replacing source posters:
  .venv/bin/python scripts/build_poster_thumbs.py
"""

from __future__ import annotations

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "static" / "images" / "posters"
OUT = SRC / "thumbs"
MAX_W = 640
QUALITY = 72


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for src in sorted(SRC.glob("*.png")):
        im = Image.open(src).convert("RGB")
        w, h = im.size
        if w > MAX_W:
            nh = int(round(h * (MAX_W / float(w))))
            im = im.resize((MAX_W, nh), Image.Resampling.LANCZOS)
        out = OUT / f"{src.stem}.webp"
        im.save(out, "WEBP", quality=QUALITY, method=6)
        print(f"{src.name} -> {out.name} ({out.stat().st_size // 1024}KB)")


if __name__ == "__main__":
    main()
