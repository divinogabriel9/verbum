#!/usr/bin/env python3
"""Concatenate static/js/app/app-0N-*.js into static/js/app.js for the browser."""
from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
APP_DIR = ROOT / "static" / "js" / "app"
OUT = ROOT / "static" / "js" / "app.js"


def strip_header(text: str) -> str:
    if text.startswith("/*"):
        end = text.find("*/")
        if end != -1:
            text = text[end + 2 :]
            if text.startswith("\n"):
                text = text[1:]
    return text


def main() -> None:
    parts = sorted(APP_DIR.glob("app-0[1-9]*.js"))
    if len(parts) != 9:
        raise SystemExit(f"expected 9 part files, found {len(parts)}: {parts}")
    chunks = [
        "/* Verbum SPA — generated from static/js/app/app-0N-*.js\n"
        " * Edit the part files, then run: python3 scripts/rebuild-app-js.py\n"
        " */\n"
    ]
    for p in parts:
        body = strip_header(p.read_text(encoding="utf-8"))
        if not body.endswith("\n"):
            body += "\n"
        chunks.append(f"\n/* ==== {p.name} ==== */\n")
        chunks.append(body)
    OUT.write_text("".join(chunks), encoding="utf-8")
    print(f"wrote {OUT.relative_to(ROOT)} ({OUT.stat().st_size:,} bytes)")


if __name__ == "__main__":
    main()
