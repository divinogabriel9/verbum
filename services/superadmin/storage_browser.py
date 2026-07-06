"""Superadmin storage browser for the user-uploads bucket."""

from __future__ import annotations

from typing import Any

from services.auth_config import supabase_enabled, supabase_url
from services.storage_assets import _BUCKET, _normalize_signed_url
from services.supabase_client import get_service_client

_MAX_PAGE = 100


def _signed_url_service(client: Any, path: str) -> str:
    try:
        res = client.storage.from_(_BUCKET).create_signed_url(path, 3600)
        if isinstance(res, dict):
            for key in ("signedURL", "signedUrl", "signed_url", "url"):
                if key in res:
                    url = _normalize_signed_url(res.get(key))
                    if url:
                        return url
            data = res.get("data")
            if isinstance(data, dict):
                for key in ("signedURL", "signedUrl", "signed_url", "url"):
                    if key in data:
                        url = _normalize_signed_url(data.get(key))
                        if url:
                            return url
    except Exception:
        pass
    return ""


def _is_folder(row: dict[str, Any]) -> bool:
    if row.get("id") is None and row.get("metadata") is None:
        return True
    meta = row.get("metadata")
    if isinstance(meta, dict) and meta.get("mimetype") == "application/octet-stream":
        return False
    return row.get("id") is None


def list_storage_browser(
    *,
    prefix: str = "",
    page: int = 1,
    per_page: int = 50,
) -> dict[str, Any]:
    if not supabase_enabled():
        return {
            "ok": True,
            "items": [],
            "total": 0,
            "page": page,
            "per_page": per_page,
            "prefix": "",
            "bucket": _BUCKET,
            "supabase_url": supabase_url(),
        }

    page = max(1, page)
    per_page = max(1, min(per_page, _MAX_PAGE))
    folder = (prefix or "").strip().strip("/")

    client = get_service_client()
    list_opts: dict[str, Any] = {
        "limit": per_page,
        "offset": (page - 1) * per_page,
        "sortBy": {"column": "name", "order": "asc"},
    }
    rows = client.storage.from_(_BUCKET).list(folder, list_opts)
    if not isinstance(rows, list):
        rows = []

    items: list[dict[str, Any]] = []
    for row in rows:
        if not isinstance(row, dict):
            continue
        name = str(row.get("name") or "").strip()
        if not name:
            continue
        rel = f"{folder}/{name}" if folder else name
        is_folder = _is_folder(row)
        item: dict[str, Any] = {
            "name": name,
            "path": rel,
            "kind": "folder" if is_folder else "file",
            "size": None,
            "updated_at": row.get("updated_at") or row.get("created_at"),
        }
        meta = row.get("metadata")
        if isinstance(meta, dict):
            item["size"] = meta.get("size")
            item["content_type"] = meta.get("mimetype")
        if not is_folder:
            item["url"] = _signed_url_service(client, rel)
        items.append(item)

    return {
        "ok": True,
        "items": items,
        "total": len(items),
        "page": page,
        "per_page": per_page,
        "prefix": folder,
        "bucket": _BUCKET,
        "supabase_url": supabase_url(),
        "has_more": len(items) >= per_page,
    }
