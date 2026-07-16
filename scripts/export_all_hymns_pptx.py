#!/usr/bin/env python3
"""Dump every library hymn into one dual-layout PPTX (A–Z by title) for spacing debug."""

from __future__ import annotations

import sys
from pathlib import Path

_ROOT = Path(__file__).resolve().parents[1]
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

from pptx import Presentation  # noqa: E402

from generators.deck_template import SLIDE_HEIGHT, SLIDE_WIDTH  # noqa: E402
from generators.powerpoint import (  # noqa: E402
    _add_hymn_lyric_slides,
    _build_slide_theme,
)
from services.hymn_library import load_library  # noqa: E402


def main() -> None:
    import generators.powerpoint as ppt

    out = _ROOT / "outputs" / "all_hymns_az_dual.pptx"
    lib = load_library()

    songs: list[tuple[str, str, str, str]] = []
    for section, items in (lib or {}).items():
        for item in items or []:
            lyrics = str(item.get("lyrics") or "").strip()
            if not lyrics:
                continue
            title = str(item.get("title") or "Hymn").strip() or "Hymn"
            hid = str(item.get("id") or "")
            songs.append((title, section, lyrics, hid))

    songs.sort(key=lambda row: row[0].casefold())

    theme = _build_slide_theme(None)
    ppt._ACTIVE_THEME = theme

    prs = Presentation()
    prs.slide_width = SLIDE_WIDTH
    prs.slide_height = SLIDE_HEIGHT

    for title, section, lyrics, _hid in songs:
        footer = section.replace("_", " ").title()
        _add_hymn_lyric_slides(
            prs,
            footer,
            title,
            lyrics,
            theme,
            section=section,
            hymn_lyrics_layout="dual",
        )

    out.parent.mkdir(parents=True, exist_ok=True)
    prs.save(str(out))
    print(f"Wrote {out}")
    print(f"Songs: {len(songs)}  Slides: {len(prs.slides)}")


if __name__ == "__main__":
    main()
