"""Normalize uploaded raster images to 16×9 PNG for full-bleed slides."""

from __future__ import annotations

import io
from pathlib import Path
from typing import BinaryIO

TARGET_W = 1920
TARGET_H = 1080


def image_bytes_to_16x9_png(raw: bytes, dest: Path) -> Path:
    """Letterbox or crop to 16×9, write PNG to ``dest``."""
    try:
        from PIL import Image
    except ImportError as exc:  # pragma: no cover
        raise RuntimeError("Pillow is required for image normalization.") from exc

    im = Image.open(io.BytesIO(raw))
    im = im.convert("RGBA") if im.mode in ("RGBA", "P", "LA") else im.convert("RGB")

    tw, th = TARGET_W, TARGET_H
    src_w, src_h = im.size
    scale = max(tw / src_w, th / src_h)
    nw = int(src_w * scale)
    nh = int(src_h * scale)
    im = im.resize((nw, nh), Image.Resampling.LANCZOS)

    left = max(0, (nw - tw) // 2)
    top = max(0, (nh - th) // 2)
    im = im.crop((left, top, left + tw, top + th))

    dest.parent.mkdir(parents=True, exist_ok=True)
    if im.mode == "RGB":
        im.save(dest, format="PNG", optimize=True)
    else:
        im.save(dest, format="PNG", optimize=True)
    return dest


def save_upload_stream_to_16x9(stream: BinaryIO, dest: Path) -> Path:
    raw = stream.read()
    if not raw:
        raise ValueError("Empty file.")
    return image_bytes_to_16x9_png(raw, dest)
