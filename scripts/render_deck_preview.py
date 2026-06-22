#!/usr/bin/env python3
"""Generate a sample Mass deck and rasterize every slide to PNG for inspection.

This is the ground-truth verification loop for the deck template: it builds a
representative deck (readings, rites, gospel acclamation, hymn lyrics, dialogue,
collection) for a fixed sample Sunday and renders the *actual* ``.pptx`` to
images via LibreOffice, so color and alignment can be checked exactly as they
will appear in projection - no guessing from an HTML approximation.

Examples
--------
    python3 scripts/render_deck_preview.py
    python3 scripts/render_deck_preview.py --date 2026-04-05            # Easter (white)
    python3 scripts/render_deck_preview.py --color 2D6A3E               # force a hex season
    python3 scripts/render_deck_preview.py --baseline                  # write regression baseline
    python3 scripts/render_deck_preview.py --no-rasterize              # build deck only
"""

from __future__ import annotations

import argparse
import shutil
import sys
from pathlib import Path
from typing import Any, Mapping, Optional

_PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(_PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(_PROJECT_ROOT))

from generators.powerpoint import generate_mass_ppt  # noqa: E402

SAMPLE_PSALM = (
    "R. (2b) My soul is thirsting for you, O Lord my God.\n\n"
    "O God, you are my God whom I seek; for you my flesh pines and my "
    "soul thirsts like the earth, parched, lifeless and without water.\n\n"
    "R. My soul is thirsting for you, O Lord my God."
)

SAMPLE_GOSPEL_ACCLAMATION = "I am the way, the truth, and the life, says the Lord; no one comes to the Father except through me."


def _hex_to_rgb(value: str) -> Optional[tuple[int, int, int]]:
    text = (value or "").strip().lstrip("#")
    if len(text) != 6:
        return None
    try:
        return (int(text[0:2], 16), int(text[2:4], 16), int(text[4:6], 16))
    except ValueError:
        return None


def _liturgical_color_for(date: str, color_hex: Optional[str]) -> Mapping[str, Any]:
    rgb = _hex_to_rgb(color_hex) if color_hex else None
    if rgb is not None:
        return {"rgb": rgb, "season": "custom"}
    try:
        from services.liturgical_calendar import get_liturgical_color

        lc = get_liturgical_color(date)
        rgb = tuple(int(c) for c in getattr(lc, "rgb", (45, 106, 62)))
        return {"rgb": rgb, "season": getattr(lc, "season", "ordinary_time")}
    except Exception as exc:  # pragma: no cover - fallback for offline/calendar issues
        print(f"  (using default green; could not resolve season color: {exc})")
        return {"rgb": (45, 106, 62), "season": "ordinary_time"}


def _sample_entrance_song() -> tuple[dict[str, str], Optional[dict[str, Any]]]:
    """Find one real library hymn (with lyrics) so the projector hymn slides render."""
    try:
        from services.hymn_library import load_library
    except Exception:
        return {}, None
    try:
        lib = load_library()
    except Exception:
        return {}, None
    for section in ("entrance", "offertory", "communion", "recessional", "meditation"):
        for item in lib.get(section) or []:
            if not isinstance(item, dict):
                continue
            if str(item.get("lyrics") or "").strip() and str(item.get("id") or "").strip():
                return {section: str(item["id"])}, item
    return {}, None


def _resolve_soffice() -> Optional[str]:
    found = shutil.which("soffice")
    if found:
        return found
    mac_bin = "/Applications/LibreOffice.app/Contents/MacOS/soffice"
    return mac_bin if Path(mac_bin).is_file() else None


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--date", default="2026-06-21", help="Sample Sunday (YYYY-MM-DD).")
    parser.add_argument("--color", default=None, help="Force a season fill as a hex string (e.g. 2D6A3E).")
    parser.add_argument(
        "--out",
        default=None,
        help="Directory for slide PNGs (default outputs/preview_slides/sample).",
    )
    parser.add_argument(
        "--baseline",
        action="store_true",
        help="Write to outputs/preview_slides/baseline (the regression reference set).",
    )
    parser.add_argument("--no-rasterize", action="store_true", help="Build the .pptx only; skip PNG rendering.")
    args = parser.parse_args()

    out_dir = Path(args.out) if args.out else _PROJECT_ROOT / "outputs" / "preview_slides" / (
        "baseline" if args.baseline else "sample"
    )

    liturgical_color = _liturgical_color_for(args.date, args.color)
    print(f"Season color: {liturgical_color}")

    song_selections, hymn = _sample_entrance_song()
    if hymn:
        print(f"Sample hymn: {hymn.get('title')} ({list(song_selections.keys())[0]})")
    else:
        print("No library hymn with lyrics found; hymn sections will use marked-slide fallback.")

    stem = "deck_preview_baseline" if args.baseline else "deck_preview_sample"
    n_slides, pptx_path = generate_mass_ppt(
        title="Twelfth Sunday in Ordinary Time",
        gospel_reference="Lk 9:18-24",
        gospel_quote="Who do you say that I am?",
        season=str(liturgical_color.get("season") or "ordinary_time"),
        lectionary_cycle="C",
        celebrant="Rev. Fr. Sample Celebrant",
        co_celebrant="Rev. Fr. Co Celebrant",
        date=args.date,
        first_reading_ref="Zec 12:10-11; 13:1",
        psalm_ref="Ps 63:2-6, 8-9",
        psalm_text=SAMPLE_PSALM,
        second_reading_ref="Gal 3:26-29",
        liturgical_color=liturgical_color,
        song_selections=song_selections,
        gospel_acclamation_verse=SAMPLE_GOSPEL_ACCLAMATION,
        mass_collection_amount="12500",
        mass_collection_date_label=args.date,
        food_sponsors=["Keshi Gonzales", "The Dela Cruz Family"],
        creed_choice="nicene",
        output_stem=stem,
    )
    print(f"Deck: {pptx_path} ({n_slides} slides)")

    if args.no_rasterize:
        return 0

    soffice = _resolve_soffice()
    if not soffice:
        print("LibreOffice (soffice) not found - install it to rasterize slides to PNG.")
        print("Deck was still generated; open the .pptx above to inspect.")
        return 0

    from services.ppt_preview_render import render_ppt_preview_pngs

    out_dir.mkdir(parents=True, exist_ok=True)
    for old in out_dir.glob("*.png"):
        old.unlink(missing_ok=True)
    png_paths, message = render_ppt_preview_pngs(pptx_path, out_dir, soffice_bin=soffice)
    if message:
        print(f"  {message}")
    if not png_paths:
        print("No slide images were produced.")
        return 1
    print(f"Rendered {len(png_paths)} slide PNG(s) to: {out_dir}")
    print(f"  first: {png_paths[0]}")
    print(f"  last:  {png_paths[-1]}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
