"""Superadmin hymn catalog status and Supabase publish helpers."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Literal

from services.auth_config import supabase_enabled
from services.hymn_catalog_store import (
    catalog_library_path,
    catalog_revision,
    catalog_sections,
    invalidate_catalog_cache,
    load_catalog_dict,
)
from services.song_catalog import save_catalog

SyncPrefer = Literal["active", "local"]


def _catalog_counts(catalog: dict[str, list[dict[str, Any]]]) -> dict[str, Any]:
    sections: dict[str, dict[str, int]] = {}
    total = 0
    with_lyrics = 0
    for sec in catalog_sections():
        rows = catalog.get(sec) or []
        section_total = len(rows)
        section_lyrics = sum(
            1 for row in rows if str((row or {}).get("lyrics") or "").strip()
        )
        sections[sec] = {"total": section_total, "with_lyrics": section_lyrics}
        total += section_total
        with_lyrics += section_lyrics
    return {
        "total": total,
        "with_lyrics": with_lyrics,
        "without_lyrics": max(0, total - with_lyrics),
        "sections": sections,
    }


def _local_file_meta() -> dict[str, Any]:
    path = catalog_library_path()
    if not path.is_file():
        return {"exists": False, "path": str(path)}
    try:
        stat = path.stat()
        return {
            "exists": True,
            "path": str(path),
            "mtime": datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc).isoformat(),
            "bytes": stat.st_size,
        }
    except OSError:
        return {"exists": True, "path": str(path)}


def _supabase_catalog_meta() -> dict[str, Any]:
    if not supabase_enabled():
        return {"configured": False}
    try:
        from services.supabase_client import get_service_client

        result = (
            get_service_client()
            .table("platform_hymn_catalog")
            .select("updated_at, updated_by")
            .eq("key", "global")
            .limit(1)
            .execute()
        )
        rows = result.data or []
        if not rows:
            return {"configured": True, "seeded": False}
        row = rows[0]
        return {
            "configured": True,
            "seeded": True,
            "updated_at": row.get("updated_at"),
            "updated_by": row.get("updated_by"),
        }
    except Exception as exc:
        return {"configured": True, "error": str(exc)[:120]}


def build_hymn_catalog_status() -> dict[str, Any]:
    catalog = load_catalog_dict(force=True)
    counts = _catalog_counts(catalog)
    supabase = _supabase_catalog_meta()
    return {
        "ok": True,
        "supabase": supabase,
        "source": "supabase" if supabase.get("seeded") else "local_file",
        "revision": catalog_revision(),
        "local_file": _local_file_meta(),
        "counts": {
            "total": counts["total"],
            "with_lyrics": counts["with_lyrics"],
            "without_lyrics": counts["without_lyrics"],
        },
        "sections": counts["sections"],
    }


def _load_local_file_catalog() -> dict[str, list[dict[str, Any]]]:
    path = catalog_library_path()
    if not path.is_file():
        return {sec: [] for sec in catalog_sections()}
    raw = json.loads(path.read_text(encoding="utf-8"))
    out = {sec: [] for sec in catalog_sections()}
    if isinstance(raw, dict):
        for sec in catalog_sections():
            rows = raw.get(sec) or []
            out[sec] = [x for x in rows if isinstance(x, dict)]
    return out


def sync_hymn_catalog_to_supabase(
    *,
    updated_by: str | None = None,
    prefer: SyncPrefer = "active",
) -> dict[str, Any]:
    """Publish hymn catalog to Supabase (platform_hymn_catalog + normalized lyrics tables)."""
    if not supabase_enabled():
        return {
            "ok": False,
            "error": "Supabase is not configured. Set SUPABASE_URL and service keys in environment.",
        }

    if prefer == "local":
        catalog = _load_local_file_catalog()
        source_label = "local_file"
    else:
        invalidate_catalog_cache()
        catalog = load_catalog_dict(force=True)
        source_label = "active_catalog"

    counts = _catalog_counts(catalog)
    if counts["total"] == 0:
        return {
            "ok": False,
            "error": "Catalog is empty — add songs in Song Library before syncing.",
        }

    try:
        save_catalog(catalog, updated_by=updated_by)
    except Exception as exc:
        return {"ok": False, "error": str(exc)[:200]}

    supabase = _supabase_catalog_meta()
    return {
        "ok": True,
        "source": source_label,
        "revision": catalog_revision(),
        "supabase": supabase,
        "counts": {
            "total": counts["total"],
            "with_lyrics": counts["with_lyrics"],
            "without_lyrics": counts["without_lyrics"],
        },
        "sections": counts["sections"],
        "synced_at": datetime.now(timezone.utc).isoformat(),
    }
