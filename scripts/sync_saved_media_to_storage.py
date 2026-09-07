#!/usr/bin/env python3
"""Sync local data/uploads/saved_media to Supabase.

Targets:
  shared  — catalog 10s clips / instrumentals (play via /api/files hydrate)
  parish  — Media tab library (what deploy lists in /api/saved-media)

Usage:
  .venv/bin/python scripts/sync_saved_media_to_storage.py --target parish \\
      --parish-id 489af5f3-5323-4cea-ac0f-ffbfc871c893
  .venv/bin/python scripts/sync_saved_media_to_storage.py --target shared
  .venv/bin/python scripts/sync_saved_media_to_storage.py --dry-run --target parish \\
      --parish-id …
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
    list_parish_assets,
    list_shared_assets,
    parish_storage_ready,
    upload_parish_asset,
    upload_shared_media_asset,
)

_KINDS = (
    ("music", ".mp3", "audio/mpeg"),
    ("video", ".mp4", "video/mp4"),
)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument(
        "--target",
        choices=("shared", "parish"),
        default="parish",
        help="Where to upload (default: parish = Media tab on deploy).",
    )
    parser.add_argument(
        "--parish-id",
        default="",
        help="Required for --target parish (Supabase parish UUID).",
    )
    parser.add_argument(
        "--include-previews",
        action="store_true",
        help="Also sync preview_*.mp3 (catalog clips). Default skips them for parish.",
    )
    args = parser.parse_args()

    if not parish_storage_ready():
        print("Supabase service role is not configured; cannot upload.")
        return 1

    parish_id = (args.parish_id or "").strip()
    if args.target == "parish" and not parish_id:
        print("ERROR: --parish-id is required for --target parish")
        return 1

    uploaded = skipped = failed = 0
    for kind, ext, ctype in _KINDS:
        folder = f"saved_media/{kind}"
        local_dir = uploads_dir() / "saved_media" / kind
        if not local_dir.is_dir():
            print(f"skip missing dir {local_dir}")
            continue

        if args.target == "parish":
            existing = {
                str(row.get("name") or "")
                for row in list_parish_assets(
                    parish_id=parish_id, prefix=folder, sign_urls=False
                )
            }
        else:
            existing = {
                str(row.get("name") or "")
                for row in list_shared_assets(prefix=folder, sign_urls=False)
            }

        files = sorted(
            p for p in local_dir.iterdir() if p.is_file() and p.suffix.lower() == ext
        )
        if kind == "music" and args.target == "parish" and not args.include_previews:
            files = [p for p in files if not p.name.startswith("preview_")]

        print(
            f"{kind}: {len(files)} local candidates, "
            f"{len(existing)} already in {args.target}"
        )
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
                if args.target == "parish":
                    upload_parish_asset(
                        parish_id=parish_id,
                        relative_path=rel,
                        raw=path.read_bytes(),
                        content_type=ctype,
                        upsert=True,
                    )
                else:
                    upload_shared_media_asset(
                        relative_path=rel,
                        raw=path.read_bytes(),
                        content_type=ctype,
                        upsert=True,
                    )
                print(f"  uploaded {rel}")
                uploaded += 1
            except Exception as exc:
                failed += 1
                print(f"  FAIL {rel}: {exc}")

    print(
        f"done uploaded={uploaded} skipped={skipped} failed={failed} "
        f"target={args.target} dry_run={args.dry_run}"
    )
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
