#!/usr/bin/env python3
"""
Fetch all 150 Psalms (World English Bible) from bible-api.com and save to data/psalm_cache.json.

Run once after clone, or when refreshing the local Psalm library:
    python scripts/build_psalm_cache.py
"""

from __future__ import annotations

import json
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from services.gospel_fallback import fetch_world_english_gospel  # noqa: E402
from services.psalm_cache import psalm_cache_path  # noqa: E402


def fetch_psalm(n: int) -> str | None:
    ref = f"Psalm {n}"
    text = fetch_world_english_gospel(ref)
    if text and len(text) > 20:
        return text.strip()
    return None


def main() -> int:
    psalms: dict[str, str] = {}
    failed: list[int] = []

    for n in range(1, 151):
        print(f"Fetching Psalm {n}...", end=" ", flush=True)
        text = fetch_psalm(n)
        if text:
            psalms[str(n)] = text
            print(f"OK ({len(text)} chars)")
        else:
            failed.append(n)
            print("FAILED")
        time.sleep(0.25)

    if failed:
        print(f"\nRetrying {len(failed)} failed psalms...")
        still_failed: list[int] = []
        for n in failed:
            print(f"Retry Psalm {n}...", end=" ", flush=True)
            time.sleep(1.0)
            text = fetch_psalm(n)
            if text:
                psalms[str(n)] = text
                print(f"OK ({len(text)} chars)")
            else:
                still_failed.append(n)
                print("FAILED")
        failed = still_failed

    out = {
        "version": "world-english-bible",
        "source": "https://bible-api.com",
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "psalms": psalms,
    }

    path = psalm_cache_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as fh:
        json.dump(out, fh, ensure_ascii=False, indent=2)
        fh.write("\n")

    print(f"\nSaved {len(psalms)}/150 psalms to {path}")
    if failed:
        print(f"Failed psalms: {failed}")
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
