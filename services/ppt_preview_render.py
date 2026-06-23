"""
Multi-slide PowerPoint preview for the web UI.

LibreOffice's ``--convert-to png`` on a ``.pptx`` often emits **only the first slide**
as a single PNG, which makes every preview card look like “slide 1”.

This module prefers: **PPTX → PDF (LibreOffice) → one PNG per page (pypdfium2)**,
then falls back to whatever PNGs LO produced from a direct PNG export.
"""

from __future__ import annotations

import re
import subprocess
import tempfile
from pathlib import Path
from typing import Optional


def count_ppt_slides(ppt: Path) -> int:
    """Return slide count using python-pptx (no LibreOffice)."""
    try:
        from pptx import Presentation
    except ImportError:
        return 0
    try:
        return len(Presentation(str(ppt)).slides)
    except Exception:
        return 0


def _natural_sort_pngs(paths: list[Path]) -> list[Path]:
    """Order ``name1.png``, ``name2.png``, …, ``name10.png`` numerically when possible."""

    def key(p: Path) -> tuple[int, str]:
        m = re.search(r"(\d+)", p.stem)
        return (int(m.group(1)) if m else 0, p.name.lower())

    return sorted(paths, key=key)


def convert_pptx_to_pdf(
    ppt: Path,
    out_dir: Path,
    *,
    soffice_bin: str,
    timeout: int = 120,
) -> Optional[Path]:
    """Convert ``ppt`` to a PDF in ``out_dir`` via LibreOffice. Returns the PDF path or ``None``."""
    out_dir.mkdir(parents=True, exist_ok=True)
    cmd = [
        soffice_bin,
        "--headless",
        "--convert-to",
        "pdf",
        "--outdir",
        str(out_dir),
        str(ppt.resolve()),
    ]
    try:
        subprocess.run(cmd, check=True, capture_output=True, text=True, timeout=timeout)
    except (subprocess.CalledProcessError, subprocess.TimeoutExpired, OSError):
        return None
    # LibreOffice names the output after the input stem.
    candidate = out_dir / f"{ppt.stem}.pdf"
    if candidate.is_file():
        return candidate
    pdfs = sorted(out_dir.glob("*.pdf"))
    return pdfs[0] if pdfs else None


def _render_pdf_pages_to_pngs(pdf_path: Path, out_dir: Path) -> list[Path]:
    """Rasterize each PDF page to ``slide_0001.png`` … in ``out_dir``."""
    try:
        import pypdfium2 as pdfium  # type: ignore[import-untyped]
    except ImportError:
        return []

    out: list[Path] = []
    try:
        doc = pdfium.PdfDocument(str(pdf_path))
    except Exception:
        return []

    for i in range(len(doc)):
        page = doc[i]
        try:
            bitmap = page.render(scale=1.25)
            pil_image = bitmap.to_pil()
        except Exception:
            continue
        dest = out_dir / f"slide_{i + 1:04d}.png"
        try:
            pil_image.save(dest, format="PNG", optimize=True)
            out.append(dest)
        except OSError:
            continue
    return out


def render_ppt_preview_pngs(
    ppt: Path,
    out_dir: Path,
    *,
    soffice_bin: str,
) -> tuple[list[Path], str]:
    """
    Write one PNG per slide into ``out_dir`` when possible.

    Returns ``(paths_sorted, message)``. ``message`` is non-empty when a fallback was used.
    """
    out_dir.mkdir(parents=True, exist_ok=True)
    n_slides = count_ppt_slides(ppt)
    message = ""

    # --- Primary: PDF export then pypdfium2 (full deck thumbnails) ---
    with tempfile.TemporaryDirectory(prefix="ppt_pdf_") as tmp:
        tmp_path = Path(tmp)
        pdf_path = convert_pptx_to_pdf(ppt, tmp_path, soffice_bin=soffice_bin)

        if pdf_path is not None:
            pdf_pages = _render_pdf_pages_to_pngs(pdf_path, out_dir)
            if pdf_pages:
                if n_slides and len(pdf_pages) != n_slides:
                    message = (
                        f"Preview: {len(pdf_pages)} image(s) from PDF (python-pptx reports {n_slides} slides). "
                        "Counts can differ if the deck has hidden slides; install current LibreOffice + pypdfium2."
                    )
                return (sorted(pdf_pages, key=lambda p: p.name), message)

    # --- Fallback: direct PNG export (often first slide only) ---
    png_cmd = [
        soffice_bin,
        "--headless",
        "--convert-to",
        "png",
        "--outdir",
        str(out_dir),
        str(ppt.resolve()),
    ]
    try:
        subprocess.run(png_cmd, check=True, capture_output=True, text=True, timeout=120)
    except (subprocess.CalledProcessError, subprocess.TimeoutExpired, OSError):
        return ([], "LibreOffice could not render the deck.")

    pngs = [p for p in out_dir.glob("*.png") if p.is_file()]
    pngs = _natural_sort_pngs(pngs)
    if len(pngs) == 1 and n_slides > 1:
        message = (
            "Preview shows the first slide only (LibreOffice PNG export). "
            "Install ``pypdfium2`` (`pip install pypdfium2`) for full-deck thumbnails via PDF."
        )
    return (pngs, message)
