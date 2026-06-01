#!/usr/bin/env python3
"""Retry fetching specific psalms and merge into data/psalm_cache.json."""

from __future__ import annotations

import json
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from scripts.build_psalm_cache import fetch_psalm  # noqa: E402
from services.psalm_cache import psalm_cache_path  # noqa: E402


def main() -> int:
    path = psalm_cache_path()
    with path.open(encoding="utf-8") as fh:
        blob = json.load(fh)
    psalms = blob.get("psalms") or {}

    missing = [n for n in range(1, 151) if not str(n) in psalms or not psalms[str(n)].strip()]
    if not missing:
        print("All 150 psalms present.")
        return 0

    print(f"Missing {len(missing)} psalms: {missing}")
    failed: list[int] = []
    for n in missing:
        print(f"Fetching Psalm {n}...", end=" ", flush=True)
        time.sleep(1.0)
        text = fetch_psalm(n)
        if text:
            psalms[str(n)] = text
            print(f"OK ({len(text)} chars)")
        else:
            failed.append(n)
            print("FAILED")

    blob["psalms"] = psalms
    blob["updated_at"] = datetime.now(timezone.utc).isoformat()
    with path.open("w", encoding="utf-8") as fh:
        json.dump(blob, fh, ensure_ascii=False, indent=2)
        fh.write("\n")

    print(f"\nNow have {len(psalms)}/150 psalms")
    if failed:
        print(f"Still missing: {failed}")
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
