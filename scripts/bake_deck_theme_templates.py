#!/usr/bin/env python3
"""Bake Theme 2 (Midnight) and Theme 3 (Paper) masters from LFTemplate1.pptx.

Run after editing Theme 1 so the mono masters stay in sync:

    python scripts/bake_deck_theme_templates.py

Writes:
  data/reference/LFTemplate2-midnight.pptx
  data/reference/LFTemplate3-paper.pptx

Generation then clones these files for theme2/theme3 without a live color pass.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

_ROOT = Path(__file__).resolve().parents[1]
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

from generators.powerpoint import (  # noqa: E402
    _MASTER_TEMPLATE_BY_THEME,
    bake_master_theme_template,
)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--theme",
        choices=("theme2", "theme3", "all"),
        default="all",
        help="Which mono master to bake (default: both)",
    )
    args = parser.parse_args()
    themes = ("theme2", "theme3") if args.theme == "all" else (args.theme,)
    src = _ROOT / "data" / "reference" / _MASTER_TEMPLATE_BY_THEME["theme1"]
    if not src.is_file():
        print(f"ERROR: Theme 1 master not found: {src}", file=sys.stderr)
        return 1
    for tid in themes:
        out = bake_master_theme_template(tid)
        print(f"Baked {tid} → {out} ({out.stat().st_size:,} bytes)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
