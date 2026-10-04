"""Local version history for weekly Gospel poster heroes (v1, v2, …).

Active heroes keep the existing filenames used by Mass generate / shared cache.
Each new version archives only the styles actually regenerated under
``*_hero_v{N}.png`` — never silent copies of the previous set.
"""

from __future__ import annotations

import filecmp
import hashlib
import json
import logging
import re
import shutil
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

from services.ai_styles import resolve_ai_image_style
from services.weekly_style_posters import (
    local_hero_path,
    rebuild_ui_derivatives,
    style_ready,
    ui_thumb_path,
    weekly_style_ids,
    weekly_style_label,
)

logger = logging.getLogger(__name__)

_VERSION_FILE_RE = re.compile(
    r"^(?P<sunday>\d{4}-\d{2}-\d{2})_.+_hero_v(?P<version>\d+)\.png$",
    re.IGNORECASE,
)


def versions_manifest_path(output_dir: Path, *, sunday: str) -> Path:
    return Path(output_dir) / "images" / f"{sunday}_poster_versions.json"


def versioned_hero_path(
    output_dir: Path, *, sunday: str, style: str, version: int
) -> Path:
    resolved = resolve_ai_image_style(style)
    return Path(output_dir) / "images" / f"{sunday}_{resolved}_hero_v{int(version)}.png"


def _utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def _empty_manifest(sunday: str) -> dict[str, Any]:
    return {"sunday": sunday, "active_version": 0, "versions": []}


def load_manifest(output_dir: Path, *, sunday: str) -> dict[str, Any]:
    path = versions_manifest_path(output_dir, sunday=sunday)
    if not path.is_file():
        return _empty_manifest(sunday)
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        logger.debug("weekly version manifest read failed %s", path, exc_info=True)
        return _empty_manifest(sunday)
    if not isinstance(raw, dict):
        return _empty_manifest(sunday)
    versions = raw.get("versions")
    if not isinstance(versions, list):
        versions = []
    try:
        active = int(raw.get("active_version") or 0)
    except (TypeError, ValueError):
        active = 0
    return {
        "sunday": sunday,
        "active_version": active,
        "versions": [v for v in versions if isinstance(v, dict)],
    }


def save_manifest(output_dir: Path, *, sunday: str, manifest: dict[str, Any]) -> None:
    path = versions_manifest_path(output_dir, sunday=sunday)
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "sunday": sunday,
        "active_version": int(manifest.get("active_version") or 0),
        "versions": list(manifest.get("versions") or []),
    }
    path.write_text(json.dumps(payload, indent=2), encoding="utf-8")


def next_version_number(manifest: dict[str, Any]) -> int:
    nums = []
    for item in manifest.get("versions") or []:
        try:
            nums.append(int(item.get("version") or 0))
        except (TypeError, ValueError):
            continue
    return (max(nums) if nums else 0) + 1


def version_styles_on_disk(
    output_dir: Path, *, sunday: str, version: int
) -> list[str]:
    """Styles that have a real archived hero for this version (disk truth)."""
    return [
        sid
        for sid in weekly_style_ids()
        if versioned_hero_path(
            output_dir, sunday=sunday, style=sid, version=version
        ).is_file()
    ]


def format_version_label(version: int, styles: list[str] | tuple[str, ...] | None) -> str:
    """Human label that makes partial sets obvious when segregating posters."""
    ver = int(version)
    total = len(weekly_style_ids()) or 5
    ordered = [resolve_ai_image_style(s) for s in (styles or []) if str(s).strip()]
    # Preserve weekly style order; drop dupes.
    seen: set[str] = set()
    clean: list[str] = []
    for sid in weekly_style_ids():
        if sid in ordered and sid not in seen:
            clean.append(sid)
            seen.add(sid)
    for sid in ordered:
        if sid not in seen:
            clean.append(sid)
            seen.add(sid)
    n = len(clean)
    if n <= 0:
        return f"v{ver}"
    if n >= total:
        return f"v{ver} · all {total}"
    if n == 1:
        return f"v{ver} · {weekly_style_label(clean[0])} only"
    names = ", ".join(weekly_style_label(s) for s in clean[:3])
    if n > 3:
        names += f" +{n - 3}"
    return f"v{ver} · {n}/{total} · {names}"


def version_complete(
    output_dir: Path, *, sunday: str, version: int
) -> bool:
    for sid in weekly_style_ids():
        if not versioned_hero_path(
            output_dir, sunday=sunday, style=sid, version=version
        ).is_file():
            return False
    return True


def delete_style_version_files(
    output_dir: Path, *, sunday: str, style: str, version: int
) -> None:
    """Remove one style's archived hero (+ UI thumbs) for a version."""
    hero = versioned_hero_path(output_dir, sunday=sunday, style=style, version=version)
    for path in (hero, ui_thumb_path(hero, max_w=720), ui_thumb_path(hero, max_w=1600)):
        try:
            if path.is_file():
                path.unlink()
        except OSError:
            logger.debug("failed to remove %s", path, exc_info=True)


def prune_copied_styles_from_previous(
    output_dir: Path, *, sunday: str, version: int
) -> list[str]:
    """Drop archived styles in ``version`` that are byte-identical to the prior version.

    Partial regenerates must not look like a full new set when untouched styles
    were accidentally copied forward.
    """
    ver = int(version)
    if ver <= 1:
        return []
    prev = ver - 1
    removed: list[str] = []
    for sid in weekly_style_ids():
        cur = versioned_hero_path(output_dir, sunday=sunday, style=sid, version=ver)
        older = versioned_hero_path(output_dir, sunday=sunday, style=sid, version=prev)
        if not cur.is_file() or not older.is_file():
            continue
        try:
            same = filecmp.cmp(cur, older, shallow=False)
        except OSError:
            same = False
        if not same:
            continue
        delete_style_version_files(output_dir, sunday=sunday, style=sid, version=ver)
        removed.append(sid)
    if removed:
        manifest = load_manifest(output_dir, sunday=sunday)
        versions = []
        for item in manifest.get("versions") or []:
            try:
                num = int(item.get("version") or 0)
            except (TypeError, ValueError):
                continue
            if num != ver:
                versions.append(item)
                continue
            row = dict(item)
            styles = [
                s
                for s in version_styles_on_disk(output_dir, sunday=sunday, version=ver)
            ]
            row["styles"] = styles
            row["label"] = format_version_label(ver, styles)
            row["status"] = "ready" if version_complete(
                output_dir, sunday=sunday, version=ver
            ) else ("partial" if styles else "generating")
            versions.append(row)
        manifest["versions"] = versions
        save_manifest(output_dir, sunday=sunday, manifest=manifest)
        logger.info(
            "pruned copied styles sunday=%s v%s removed=%s",
            sunday,
            ver,
            removed,
        )
    return removed


def version_content_fingerprint(
    output_dir: Path, *, sunday: str, version: int
) -> str:
    """Cheap content fingerprint for a full archived version set."""
    digest = hashlib.sha256()
    saw = False
    for sid in weekly_style_ids():
        path = versioned_hero_path(
            output_dir, sunday=sunday, style=sid, version=version
        )
        digest.update(sid.encode("utf-8"))
        if not path.is_file():
            digest.update(b"missing")
            continue
        saw = True
        try:
            raw = path.read_bytes()
        except OSError:
            digest.update(b"unreadable")
            continue
        digest.update(str(len(raw)).encode("ascii"))
        digest.update(raw[:65536])
        if len(raw) > 65536:
            digest.update(raw[-65536:])
    return digest.hexdigest()[:20] if saw else ""


def versions_have_same_content(
    output_dir: Path, *, sunday: str, version_a: int, version_b: int
) -> bool:
    if int(version_a) == int(version_b):
        return True
    if not version_complete(output_dir, sunday=sunday, version=version_a):
        return False
    if not version_complete(output_dir, sunday=sunday, version=version_b):
        return False
    return version_content_fingerprint(
        output_dir, sunday=sunday, version=version_a
    ) == version_content_fingerprint(
        output_dir, sunday=sunday, version=version_b
    )


def delete_version_files(
    output_dir: Path, *, sunday: str, version: int
) -> None:
    images = Path(output_dir) / "images"
    if not images.is_dir():
        return
    for path in images.glob(f"{sunday}_*_hero_v{int(version)}*"):
        try:
            path.unlink()
        except OSError:
            logger.debug("failed to remove %s", path, exc_info=True)


def prune_duplicate_version(
    output_dir: Path, *, sunday: str, version: int
) -> bool:
    """If ``version`` is a complete duplicate of an older archive, drop it.

    Returns True when the version was removed.
    """
    ver = int(version)
    if ver <= 1 or not version_complete(output_dir, sunday=sunday, version=ver):
        return False
    for older in range(1, ver):
        if not versions_have_same_content(
            output_dir, sunday=sunday, version_a=older, version_b=ver
        ):
            continue
        delete_version_files(output_dir, sunday=sunday, version=ver)
        manifest = load_manifest(output_dir, sunday=sunday)
        versions = [
            item
            for item in (manifest.get("versions") or [])
            if int(item.get("version") or 0) != ver
        ]
        active = int(manifest.get("active_version") or 0)
        if active == ver:
            # Duplicate bytes — active heroes already match the older archive.
            active = older
        manifest["versions"] = versions
        manifest["active_version"] = active
        save_manifest(output_dir, sunday=sunday, manifest=manifest)
        logger.info(
            "pruned duplicate weekly poster version sunday=%s v%s (== v%s)",
            sunday,
            ver,
            older,
        )
        return True
    return False


def discover_version_numbers_on_disk(output_dir: Path, *, sunday: str) -> list[int]:
    """Find archived version numbers from ``*_hero_vN.png`` files."""
    images = Path(output_dir) / "images"
    found: set[int] = set()
    if not images.is_dir():
        return []
    for path in images.glob(f"{sunday}_*_hero_v*.png"):
        match = _VERSION_FILE_RE.match(path.name)
        if not match:
            continue
        try:
            found.add(int(match.group("version")))
        except (TypeError, ValueError):
            continue
    return sorted(found)


def archive_style_version(
    output_dir: Path, *, sunday: str, style: str, version: int
) -> bool:
    """Copy one active hero into its ``*_v{N}`` slot."""
    sid = resolve_ai_image_style(style)
    active = local_hero_path(output_dir, sunday=sunday, style=sid)
    if not active.is_file():
        return False
    dest = versioned_hero_path(output_dir, sunday=sunday, style=sid, version=version)
    dest.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(active, dest)
    for max_w in (720, 1600):
        src_thumb = ui_thumb_path(active, max_w=max_w)
        if src_thumb.is_file():
            try:
                shutil.copy2(src_thumb, ui_thumb_path(dest, max_w=max_w))
            except OSError:
                pass
    return True


def archive_active_as_version(
    output_dir: Path, *, sunday: str, version: int
) -> list[str]:
    """Copy current active heroes into ``*_v{N}`` slots. Returns archived style ids."""
    archived: list[str] = []
    for sid in weekly_style_ids():
        if archive_style_version(
            output_dir, sunday=sunday, style=sid, version=version
        ):
            archived.append(sid)
    return archived


def _active_differs_from_version(
    output_dir: Path, *, sunday: str, version: int
) -> bool:
    """True when active heroes look different from an archived version set."""
    saw_active = False
    for sid in weekly_style_ids():
        active = local_hero_path(output_dir, sunday=sunday, style=sid)
        archived = versioned_hero_path(
            output_dir, sunday=sunday, style=sid, version=version
        )
        if not active.is_file():
            continue
        saw_active = True
        if not archived.is_file():
            return True
        try:
            if active.stat().st_size != archived.stat().st_size:
                return True
            # Allow tiny mtime skew from copy2; treat clearly newer active as different.
            if active.stat().st_mtime > archived.stat().st_mtime + 1.5:
                return True
        except OSError:
            return True
    return False if saw_active else False


def record_style_in_version(
    output_dir: Path, *, sunday: str, version: int, style: str
) -> dict[str, Any]:
    """Archive one style into ``version`` and update the manifest entry."""
    sid = resolve_ai_image_style(style)
    archive_style_version(output_dir, sunday=sunday, style=sid, version=version)
    manifest = load_manifest(output_dir, sunday=sunday)
    versions = list(manifest.get("versions") or [])
    found = False
    for i, item in enumerate(versions):
        try:
            ver = int(item.get("version") or 0)
        except (TypeError, ValueError):
            continue
        if ver != int(version):
            continue
        found = True
        row = dict(item)
        styles = [str(s) for s in (row.get("styles") or []) if s]
        if sid not in styles:
            styles.append(sid)
        # Disk is source of truth — never inherit sibling styles from a prior set.
        styles = version_styles_on_disk(output_dir, sunday=sunday, version=ver)
        row["styles"] = styles
        row["label"] = format_version_label(ver, styles)
        if version_complete(output_dir, sunday=sunday, version=ver):
            row["status"] = "ready"
            manifest["active_version"] = ver
        else:
            row["status"] = "partial" if styles else "generating"
        versions[i] = row
        break
    if not found:
        styles = version_styles_on_disk(output_dir, sunday=sunday, version=int(version))
        complete = version_complete(output_dir, sunday=sunday, version=version)
        versions.append(
            {
                "version": int(version),
                "created_at": _utc_now(),
                "label": format_version_label(int(version), styles),
                "styles": styles or [sid],
                "status": "ready" if complete else ("partial" if styles else "generating"),
            }
        )
        if complete:
            manifest["active_version"] = int(version)
    manifest["versions"] = versions
    save_manifest(output_dir, sunday=sunday, manifest=manifest)
    # Strip accidental copies of the previous version's unchanged styles.
    prune_copied_styles_from_previous(
        output_dir, sunday=sunday, version=int(version)
    )
    return load_manifest(output_dir, sunday=sunday)


def _copy_version_style_to_active(
    output_dir: Path,
    *,
    sunday: str,
    style: str,
    version: int,
    sync_shared: bool = False,
) -> bool:
    """Copy one archived style onto the active hero path. Returns True on success."""
    sid = resolve_ai_image_style(style)
    src = versioned_hero_path(output_dir, sunday=sunday, style=sid, version=version)
    if not src.is_file():
        return False
    dest = local_hero_path(output_dir, sunday=sunday, style=sid)
    dest.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src, dest)
    need_rebuild = False
    for max_w in (720, 1600):
        src_thumb = ui_thumb_path(src, max_w=max_w)
        dest_thumb = ui_thumb_path(dest, max_w=max_w)
        if src_thumb.is_file():
            try:
                shutil.copy2(src_thumb, dest_thumb)
            except OSError:
                need_rebuild = True
        else:
            need_rebuild = True
    if need_rebuild:
        try:
            rebuild_ui_derivatives(sunday=sunday, style=sid, output_dir=output_dir)
        except Exception:
            logger.debug(
                "promote rebuild UI failed %s v%s %s", sunday, version, sid, exc_info=True
            )
    if sync_shared:
        try:
            from services.ai_hero_cache import try_upload_shared_hero

            try_upload_shared_hero(dest, date=sunday, style=sid)
        except Exception:
            logger.debug(
                "promote shared upload failed %s v%s %s", sunday, version, sid, exc_info=True
            )
    return True


def previous_complete_version(
    output_dir: Path, *, sunday: str, before: int
) -> int:
    """Nearest lower complete archive to use as the base under a partial version."""
    target = int(before)
    for ver in range(target - 1, 0, -1):
        if version_complete(output_dir, sunday=sunday, version=ver):
            return ver
    return 0


def promote_version_to_active(
    output_dir: Path,
    *,
    sunday: str,
    version: int,
    sync_shared: bool = False,
) -> dict[str, Any]:
    """Copy archived version files onto the active hero paths.

    Partial versions first restore the previous complete set, then overlay only
    the styles that belong to this version — avoids mixed v2/v3 active previews.
    Shared-cache upload is opt-in so version switching stays snappy.
    """
    ver = int(version)
    owned = version_styles_on_disk(output_dir, sunday=sunday, version=ver)
    if not owned:
        return {
            "ok": False,
            "sunday": sunday,
            "version": ver,
            "promoted": [],
            "missing": list(weekly_style_ids()),
            "manifest": load_manifest(output_dir, sunday=sunday),
        }

    promoted: list[str] = []
    missing: list[str] = []
    base_promoted: list[str] = []
    complete = version_complete(output_dir, sunday=sunday, version=ver)
    if not complete:
        base = previous_complete_version(output_dir, sunday=sunday, before=ver)
        if base > 0:
            for sid in weekly_style_ids():
                if _copy_version_style_to_active(
                    output_dir,
                    sunday=sunday,
                    style=sid,
                    version=base,
                    sync_shared=False,
                ):
                    base_promoted.append(sid)

    for sid in weekly_style_ids():
        if sid not in owned:
            if complete:
                missing.append(sid)
            continue
        if _copy_version_style_to_active(
            output_dir,
            sunday=sunday,
            style=sid,
            version=ver,
            sync_shared=sync_shared,
        ):
            promoted.append(sid)
        else:
            missing.append(sid)

    manifest = load_manifest(output_dir, sunday=sunday)
    versions = list(manifest.get("versions") or [])
    found = False
    for item in versions:
        try:
            if int(item.get("version") or 0) == ver:
                found = True
                break
        except (TypeError, ValueError):
            continue
    if not found and promoted:
        versions.append(
            {
                "version": ver,
                "created_at": _utc_now(),
                "label": format_version_label(ver, promoted),
                "styles": list(promoted),
                "status": "ready" if complete else "partial",
            }
        )
    manifest["versions"] = versions
    if promoted:
        manifest["active_version"] = ver
    save_manifest(output_dir, sunday=sunday, manifest=manifest)
    return {
        "ok": True,
        "sunday": sunday,
        "version": ver,
        "promoted": promoted,
        "base_promoted": base_promoted,
        "missing": missing,
        "manifest": manifest,
    }


def ensure_baseline_version_from_active(
    output_dir: Path, *, sunday: str, allow_download: bool = False
) -> dict[str, Any]:
    """If active heroes exist but no manifest yet, archive them as v1.

    ``allow_download=False`` keeps catalog/list paths local-only and fast.
    """
    manifest = sync_manifest_with_disk(output_dir, sunday=sunday)
    if manifest.get("versions"):
        return manifest
    ready_styles = [
        sid
        for sid in weekly_style_ids()
        if local_hero_path(output_dir, sunday=sunday, style=sid).is_file()
        or (allow_download and style_ready(sunday=sunday, style=sid, output_dir=output_dir))
    ]
    if not ready_styles:
        return manifest
    if allow_download:
        for sid in ready_styles:
            try:
                from services.weekly_style_posters import resolve_hero_file

                resolve_hero_file(sunday=sunday, style=sid, output_dir=output_dir)
            except Exception:
                pass
    archived = archive_active_as_version(output_dir, sunday=sunday, version=1)
    if not archived:
        return manifest
    manifest = {
        "sunday": sunday,
        "active_version": 1,
        "versions": [
            {
                "version": 1,
                "created_at": _utc_now(),
                "label": format_version_label(1, archived),
                "styles": archived,
                "status": "ready",
            }
        ],
    }
    save_manifest(output_dir, sunday=sunday, manifest=manifest)
    return manifest


def sync_manifest_with_disk(output_dir: Path, *, sunday: str) -> dict[str, Any]:
    """Merge on-disk ``*_hero_vN.png`` archives into the JSON manifest."""
    manifest = load_manifest(output_dir, sunday=sunday)
    versions = list(manifest.get("versions") or [])
    by_num: dict[int, dict[str, Any]] = {}
    for item in versions:
        try:
            ver = int(item.get("version") or 0)
        except (TypeError, ValueError):
            continue
        if ver > 0:
            by_num[ver] = dict(item)
    for ver in discover_version_numbers_on_disk(output_dir, sunday=sunday):
        styles = version_styles_on_disk(output_dir, sunday=sunday, version=ver)
        row = by_num.get(ver) or {
            "version": ver,
            "created_at": _utc_now(),
        }
        row["version"] = ver
        row["styles"] = styles
        row["label"] = format_version_label(ver, styles)
        row["status"] = (
            "ready"
            if version_complete(output_dir, sunday=sunday, version=ver)
            else ("partial" if styles else "generating")
        )
        by_num[ver] = row
    merged = [by_num[k] for k in sorted(by_num.keys())]
    active = int(manifest.get("active_version") or 0)
    if active <= 0 and merged:
        active = int(merged[-1].get("version") or 0)
    if active > 0 and active not in by_num and merged:
        active = int(merged[-1].get("version") or 0)
    manifest = {
        "sunday": sunday,
        "active_version": active,
        "versions": merged,
    }
    if merged:
        save_manifest(output_dir, sunday=sunday, manifest=manifest)
    return manifest


def reconcile_active_into_versions(
    output_dir: Path, *, sunday: str
) -> dict[str, Any]:
    """If active heroes differ from the latest archive, save them as a new version.

    Recovers cases where a regenerate overwrote active files before versioning
    finished writing ``*_v2`` archives.
    """
    manifest = ensure_baseline_version_from_active(
        output_dir, sunday=sunday, allow_download=False
    )
    has_active = any(
        local_hero_path(output_dir, sunday=sunday, style=sid).is_file()
        for sid in weekly_style_ids()
    )
    if not has_active:
        return manifest
    if not manifest.get("versions"):
        return ensure_baseline_version_from_active(
            output_dir, sunday=sunday, allow_download=False
        )
    latest = 0
    for item in manifest.get("versions") or []:
        try:
            latest = max(latest, int(item.get("version") or 0))
        except (TypeError, ValueError):
            continue
    if latest <= 0:
        return manifest
    # Never invent a new version while the latest archive is still partial —
    # mid-generate active folders always look "different" from an incomplete vN.
    if not version_complete(output_dir, sunday=sunday, version=latest):
        return manifest
    if not _active_differs_from_version(output_dir, sunday=sunday, version=latest):
        return manifest
    new_v = latest + 1
    archived = archive_active_as_version(output_dir, sunday=sunday, version=new_v)
    if not archived:
        return manifest
    # Never invent a "new" version that is a byte-for-byte copy of the latest.
    if versions_have_same_content(
        output_dir, sunday=sunday, version_a=latest, version_b=new_v
    ):
        delete_version_files(output_dir, sunday=sunday, version=new_v)
        return manifest
    # Drop styles that are unchanged copies of the prior archive.
    prune_copied_styles_from_previous(output_dir, sunday=sunday, version=new_v)
    archived = version_styles_on_disk(output_dir, sunday=sunday, version=new_v)
    if not archived:
        delete_version_files(output_dir, sunday=sunday, version=new_v)
        return load_manifest(output_dir, sunday=sunday)
    manifest = load_manifest(output_dir, sunday=sunday)
    versions = [
        v
        for v in (manifest.get("versions") or [])
        if int(v.get("version") or 0) != int(new_v)
    ]
    versions.append(
        {
            "version": new_v,
            "created_at": _utc_now(),
            "label": format_version_label(new_v, archived),
            "styles": archived,
            "status": "ready" if version_complete(
                output_dir, sunday=sunday, version=new_v
            ) else "partial",
        }
    )
    manifest["versions"] = versions
    manifest["active_version"] = new_v
    save_manifest(output_dir, sunday=sunday, manifest=manifest)
    return manifest


def begin_new_version(output_dir: Path, *, sunday: str) -> dict[str, Any]:
    """Snapshot current active set, then allocate the next version number."""
    manifest = ensure_baseline_version_from_active(
        output_dir, sunday=sunday, allow_download=True
    )
    # Refresh archive for the currently active version before we overwrite actives.
    active = int(manifest.get("active_version") or 0)
    if active > 0:
        archive_active_as_version(output_dir, sunday=sunday, version=active)
        manifest = sync_manifest_with_disk(output_dir, sunday=sunday)
    else:
        # No active version yet — baseline as v1 if possible.
        manifest = ensure_baseline_version_from_active(
            output_dir, sunday=sunday, allow_download=True
        )
        active = int(manifest.get("active_version") or 0)
        if active > 0:
            archive_active_as_version(output_dir, sunday=sunday, version=active)

    new_v = next_version_number(manifest)
    if new_v < 1:
        new_v = 1
    entry = {
        "version": new_v,
        "created_at": _utc_now(),
        "label": format_version_label(new_v, []),
        "styles": [],
        "status": "generating",
    }
    versions = list(manifest.get("versions") or [])
    # Avoid duplicate generating rows for the same version.
    versions = [
        v
        for v in versions
        if int(v.get("version") or 0) != int(new_v)
    ]
    versions.append(entry)
    manifest["versions"] = versions
    save_manifest(output_dir, sunday=sunday, manifest=manifest)
    return {"manifest": manifest, "version": new_v}


def finalize_version(
    output_dir: Path,
    *,
    sunday: str,
    version: int,
    styles: list[str],
    activate: bool = True,
) -> dict[str, Any]:
    """Archive only styles that belong to this version (never silent full-set copies)."""
    wanted: list[str] = []
    for raw in styles or []:
        sid = resolve_ai_image_style(str(raw))
        if sid and sid not in wanted:
            wanted.append(sid)
    # Keep anything already archived for this version number.
    for sid in version_styles_on_disk(output_dir, sunday=sunday, version=int(version)):
        if sid not in wanted:
            wanted.append(sid)
    archived: list[str] = []
    for sid in wanted:
        if archive_style_version(
            output_dir, sunday=sunday, style=sid, version=int(version)
        ):
            archived.append(sid)
    # Remove unchanged carry-overs from the previous version.
    prune_copied_styles_from_previous(
        output_dir, sunday=sunday, version=int(version)
    )
    archived = version_styles_on_disk(
        output_dir, sunday=sunday, version=int(version)
    )
    complete = version_complete(output_dir, sunday=sunday, version=int(version))
    manifest = load_manifest(output_dir, sunday=sunday)
    versions = []
    for item in manifest.get("versions") or []:
        try:
            ver = int(item.get("version") or 0)
        except (TypeError, ValueError):
            continue
        if ver == int(version):
            item = dict(item)
            item["styles"] = archived
            item["status"] = "ready" if complete else ("partial" if archived else "generating")
            item["label"] = format_version_label(ver, archived)
            if not item.get("created_at"):
                item["created_at"] = _utc_now()
        versions.append(item)
    if not any(int(v.get("version") or 0) == int(version) for v in versions):
        versions.append(
            {
                "version": int(version),
                "created_at": _utc_now(),
                "label": format_version_label(int(version), archived),
                "styles": archived,
                "status": "ready" if complete else ("partial" if archived else "generating"),
            }
        )
    manifest["versions"] = versions
    if activate and archived and complete:
        manifest["active_version"] = int(version)
    elif activate and archived:
        # Partial set can still be the working version without claiming a full ready set.
        manifest["active_version"] = int(version)
    save_manifest(output_dir, sunday=sunday, manifest=manifest)
    # Drop accidental duplicate archives (same bytes as an older version).
    if complete and prune_duplicate_version(
        output_dir, sunday=sunday, version=int(version)
    ):
        return load_manifest(output_dir, sunday=sunday)
    return manifest


def list_sundays_with_posters(output_dir: Path) -> list[dict[str, Any]]:
    """Discover Sundays that have active heroes and/or version manifests (local-only, fast)."""
    images = Path(output_dir) / "images"
    found: set[str] = set()
    if images.is_dir():
        for path in images.glob("*_poster_versions.json"):
            sunday = path.name.replace("_poster_versions.json", "")
            if len(sunday) == 10 and sunday[4] == "-":
                found.add(sunday)
        for path in images.glob("*_hero.png"):
            name = path.name
            if len(name) < 15:
                continue
            sunday = name[:10]
            if len(sunday) == 10 and sunday[4] == "-" and name.endswith("_hero.png"):
                # Skip versioned filenames that also end with _hero.png? pattern is date_style_hero.png
                if "_hero_v" in name:
                    continue
                found.add(sunday)
        for path in images.glob("*_hero_v*.png"):
            match = _VERSION_FILE_RE.match(path.name)
            if match:
                found.add(match.group("sunday"))
    out = []
    for sunday in sorted(found, reverse=True):
        manifest = sync_manifest_with_disk(output_dir, sunday=sunday)
        # Local baseline only — never download shared heroes during list/catalog.
        if not manifest.get("versions"):
            manifest = ensure_baseline_version_from_active(
                output_dir, sunday=sunday, allow_download=False
            )
        versions = [
            {
                "version": int(v.get("version") or 0),
                "label": str(v.get("label") or f"v{v.get('version')}"),
                "created_at": str(v.get("created_at") or ""),
                "status": str(v.get("status") or "ready"),
                "active": int(v.get("version") or 0)
                == int(manifest.get("active_version") or 0),
            }
            for v in (manifest.get("versions") or [])
            if isinstance(v, dict) and int(v.get("version") or 0) > 0
        ]
        out.append(
            {
                "sunday": sunday,
                "active_version": int(manifest.get("active_version") or 0),
                "version_count": len(versions),
                "versions": versions,
            }
        )
    return out


def versions_payload(output_dir: Path, *, sunday: str) -> dict[str, Any]:
    # Fast path for catalog: local disk only + reconcile active→new version when needed.
    reconcile_active_into_versions(output_dir, sunday=sunday)
    manifest = sync_manifest_with_disk(output_dir, sunday=sunday)
    if not manifest.get("versions"):
        manifest = ensure_baseline_version_from_active(
            output_dir, sunday=sunday, allow_download=False
        )
    versions = []
    for v in manifest.get("versions") or []:
        if not isinstance(v, dict):
            continue
        try:
            ver = int(v.get("version") or 0)
        except (TypeError, ValueError):
            continue
        if ver <= 0:
            continue
        styles = version_styles_on_disk(output_dir, sunday=sunday, version=ver) or list(
            v.get("styles") or []
        )
        complete = version_complete(output_dir, sunday=sunday, version=ver)
        versions.append(
            {
                "version": ver,
                "label": format_version_label(ver, styles),
                "created_at": str(v.get("created_at") or ""),
                "status": "ready" if complete else ("partial" if styles else "generating"),
                "styles": styles,
                "style_count": len(styles),
                "active": ver == int(manifest.get("active_version") or 0),
                "complete": complete,
            }
        )
    versions.sort(key=lambda x: x["version"], reverse=True)
    return {
        "ok": True,
        "sunday": sunday,
        "active_version": int(manifest.get("active_version") or 0),
        "versions": versions,
        "sundays": list_sundays_with_posters(output_dir),
    }
