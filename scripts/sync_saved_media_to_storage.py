#!/usr/bin/env python3
"""Upload local catalog media (data/uploads/saved_media) to shared Supabase storage.

Catalog 10s clips and admin-fetched videos used to live only on the machine
disk (gitignored). Render's filesystem is empty, so deploy could not play them.

Usage:
  .venv/bin/python scripts/sync_saved_media_to_storage.py
  .venv/bin/python scripts/sync_saved_media_to_storage.py --dry-run
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from services.env_config import load_project_dotenv

load_project_dotenv()

from services.community_config import uploads_dir
from services.storage_assets import (
    list_shared_assets,
    parish_storage_ready,
    upload_shared_media_asset,
)

_KINDS = (
    ("music", ".mp3", "audio/mpeg"),
    ("video", ".mp4", "video/mp4"),
)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true", help="List files without uploading.")
    args = parser.parse_args()

    if not parish_storage_ready():
        print("Supabase service role is not configured; cannot upload.")
        return 1

    uploaded = 0
    skipped = 0
    failed = 0
    for kind, ext, ctype in _KINDS:
        folder = f"saved_media/{kind}"
        local_dir = uploads_dir() / "saved_media" / kind
        if not local_dir.is_dir():
            print(f"skip missing dir {local_dir}")
            continue
        existing = {
            str(row.get("name") or "")
            for row in list_shared_assets(prefix=folder)
        }
        files = sorted(p for p in local_dir.iterdir() if p.is_file() and p.suffix.lower() == ext)
        print(f"{kind}: {len(files)} local, {len(existing)} already in shared storage")
        for path in files:
            if path.name in existing:
                skipped += 1
                continue
            rel = f"{folder}/{path.name}"
            if args.dry_run:
                print(f"  would upload {rel} ({path.stat().st_size} bytes)")
                uploaded += 1
                continue
            try:
                stored = upload_shared_media_asset(
                    relative_path=rel,
                    raw=path.read_bytes(),
                    content_type=ctype,
                    upsert=True,
                )
                print(f"  uploaded {rel}")
                uploaded += 1
                _ = stored
            except Exception as exc:
                failed += 1
                print(f"  FAIL {rel}: {exc}")

    print(f"done uploaded={uploaded} skipped={skipped} failed={failed} dry_run={args.dry_run}")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
