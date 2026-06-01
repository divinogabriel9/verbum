#!/usr/bin/env python3
"""
Fetch common Roman Catholic responsorial canticles (non-Psalms) into data/canticle_cache.json.

Run after clone or when refreshing:
    python scripts/build_canticle_cache.py
"""

from __future__ import annotations

import json
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from services.canticle_cache import canticle_cache_path, normalize_canticle_cache_key  # noqa: E402
from services.gospel_fallback import fetch_world_english_gospel  # noqa: E402
from services.responsorial_reading import responsorial_api_reference  # noqa: E402

# Common RC responsorial canticles (non-Psalms) from the Roman Missal / lectionary.
CANTICLE_REFERENCES: list[str] = [
    "Isaiah 12:2-6",
    "Isaiah 38:10-14,17-20",
    "Isaiah 61:10-62:5",
    "Daniel 3:52-57",
    "Daniel 3:52-56",
    "Daniel 3:52-55",
    "Daniel 3:52-53",
    "1 Samuel 2:1-10",
    "Jeremiah 31:31-34",
    "Philippians 2:6-11",
    "Colossians 1:12-20",
    "Ephesians 1:3-10",
    "Revelation 19:1-7",
    "1 Peter 2:21-24",
    "1 Chronicles 29:10-13",
    "Habakkuk 3:1-4,13-15,17-19",
    "Tobit 13:1-2,7-8",
]


def fetch_canticle(ref: str) -> str | None:
    api_ref = responsorial_api_reference(ref)
    text = fetch_world_english_gospel(api_ref)
    if text and len(text.strip()) > 40:
        return text.strip()
    return None


def main() -> int:
    canticles: dict[str, str] = {}
    failed: list[str] = []

    for ref in CANTICLE_REFERENCES:
        print(f"Fetching {ref}...", end=" ", flush=True)
        text = fetch_canticle(ref)
        if text:
            canticles[ref] = text
            print(f"OK ({len(text)} chars)")
        else:
            failed.append(ref)
            print("FAILED")
        time.sleep(0.35)

    if failed:
        print(f"\nRetrying {len(failed)} failed canticles...")
        still_failed: list[str] = []
        for ref in failed:
            print(f"Retry {ref}...", end=" ", flush=True)
            time.sleep(1.0)
            text = fetch_canticle(ref)
            if text:
                canticles[ref] = text
                print(f"OK ({len(text)} chars)")
            else:
                still_failed.append(ref)
                print("FAILED")
        failed = still_failed

    # Normalize keys for lookup consistency
    normalized: dict[str, str] = {}
    for ref, text in canticles.items():
        normalized[normalize_canticle_cache_key(ref)] = text
        if ref.lower() != normalize_canticle_cache_key(ref):
            normalized[ref] = text

    out = {
        "version": "world-english-bible",
        "source": "https://bible-api.com",
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "canticles": {**canticles, **{k: v for k, v in normalized.items() if k not in canticles}},
    }

    path = canticle_cache_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as fh:
        json.dump(out, fh, ensure_ascii=False, indent=2)
        fh.write("\n")

    print(f"\nSaved {len(canticles)}/{len(CANTICLE_REFERENCES)} canticles to {path}")
    if failed:
        print(f"Failed: {failed}")
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
