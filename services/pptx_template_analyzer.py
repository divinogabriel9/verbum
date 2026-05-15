"""
Scan an uploaded PPTX for colors and typography to feed ``custom_theme`` (hex + font).

Full slide geometry cloning is not performed here; the Mass deck keeps its layout while
adopting the scanned palette and primary font family.
"""

from __future__ import annotations

import io
import re
import zipfile
from pathlib import Path
from typing import Any, Optional


def _read_theme_colors(zf: zipfile.ZipFile) -> dict[str, str]:
    """Best-effort a:srgbClr / srgbClr hex values from theme1.xml."""
    out: dict[str, str] = {}
    try:
        raw = zf.read("ppt/theme/theme1.xml").decode("utf-8", errors="ignore")
    except KeyError:
        return out
    for m in re.finditer(
        r'<a:srgbClr val="([0-9A-Fa-f]{6})"',
        raw,
    ):
        h = "#" + m.group(1).lower()
        if "accent1" not in out:
            out["accent1"] = h
        elif "accent2" not in out:
            out["accent2"] = h
    for m in re.finditer(r'<a:sysClr[^>]*lastClr="([0-9A-Fa-f]{6})"', raw):
        if "bg1" not in out:
            out["bg1"] = "#" + m.group(1).lower()
    return out


def _font_from_slide_xml(xml: str) -> Optional[str]:
    m = re.search(r'<a:latin[^>]*typeface="([^"]+)"', xml)
    return m.group(1) if m else None


def analyze_pptx_template(path: Path | str, *, max_slides_scan: int = 4) -> dict[str, Any]:
    p = Path(path)
    if not p.is_file():
        return {"ok": False, "error": "Template file not found."}
    try:
        zf = zipfile.ZipFile(p, "r")
    except zipfile.BadZipFile:
        return {"ok": False, "error": "Not a valid .pptx file."}

    theme = _read_theme_colors(zf)
    fonts: list[str] = []
    slide_names = sorted(
        [n for n in zf.namelist() if re.match(r"ppt/slides/slide\d+\.xml$", n)],
        key=lambda s: int(re.search(r"slide(\d+)", s).group(1)),
    )
    for name in slide_names[:max_slides_scan]:
        try:
            xml = zf.read(name).decode("utf-8", errors="ignore")
        except KeyError:
            continue
        f = _font_from_slide_xml(xml)
        if f and f not in fonts:
            fonts.append(f)

    zf.close()

    bg = theme.get("bg1") or "#182033"
    primary = theme.get("accent1") or "#f8c66a"
    accent = theme.get("accent2") or "#f15f3a"
    text = "#ffffff"
    font = (fonts[0] if fonts else "Calibri") + ", Calibri, sans-serif"

    notes = (
        f"Scanned {min(len(slide_names), max_slides_scan)} slide(s) and theme XML. "
        "Colors map to deck background, headings, and accents; body layout follows the standard Mass template."
    )

    return {
        "ok": True,
        "custom_theme": {
            "name": p.stem,
            "bg": bg,
            "primary": primary,
            "accent": accent,
            "text": text,
            "font": font,
        },
        "fonts_detected": fonts,
        "theme_xml_colors": theme,
        "notes": notes,
    }


def analyze_pptx_bytes(data: bytes) -> dict[str, Any]:
    buf = io.BytesIO(data)
    try:
        zf = zipfile.ZipFile(buf, "r")
    except zipfile.BadZipFile:
        return {"ok": False, "error": "Not a valid .pptx file."}
    zf.close()
    from tempfile import NamedTemporaryFile

    with NamedTemporaryFile(suffix=".pptx", delete=False) as tmp:
        tmp.write(data)
        tpath = Path(tmp.name)
    try:
        return analyze_pptx_template(tpath)
    finally:
        tpath.unlink(missing_ok=True)
