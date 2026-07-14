"""Supabase Storage helpers for user- and parish-scoped assets."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Optional

from services.auth_config import supabase_enabled, supabase_service_role_key, supabase_url
from services.supabase_client import get_service_client, get_user_client

_BUCKET = "user-uploads"


@dataclass(frozen=True)
class StoredAsset:
    path: str
    signed_url: str


def _normalize_signed_url(raw: Any) -> str:
    text = str(raw or "").strip()
    if not text:
        return ""
    if text.startswith("http://") or text.startswith("https://"):
        return text
    base = supabase_url().rstrip("/")
    if not base:
        return text
    if text.startswith("/storage/"):
        return f"{base}{text}"
    if text.startswith("/object/"):
        return f"{base}/storage/v1{text}"
    return f"{base}/storage/v1/{text.lstrip('/')}"


def _signed_url(client: Any, path: str, *, expires_in: int = 3600) -> str:
    res = client.storage.from_(_BUCKET).create_signed_url(path, expires_in)
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
    raise RuntimeError("Could not build signed URL for storage asset.")


def _user_path(user_id: str, leaf: str) -> str:
    uid = (user_id or "").strip()
    rel = (leaf or "").strip().lstrip("/")
    if not uid or not rel:
        raise ValueError("user_id and asset path are required.")
    return f"{uid}/{rel}"


def _parish_path(parish_id: str, leaf: str) -> str:
    pid = (parish_id or "").strip()
    rel = (leaf or "").strip().lstrip("/")
    if not pid or not rel:
        raise ValueError("parish_id and asset path are required.")
    return f"parishes/{pid}/{rel}"


def storage_ready(access_token: Optional[str]) -> bool:
    return bool(supabase_enabled() and (access_token or "").strip())


def parish_storage_ready() -> bool:
    """Parish assets use the service role so all members can share one library."""
    return bool(supabase_enabled() and (supabase_service_role_key() or "").strip())


def upload_user_asset(
    *,
    user_id: str,
    access_token: str,
    relative_path: str,
    raw: bytes,
    content_type: str,
    upsert: bool = True,
) -> StoredAsset:
    client = get_user_client(access_token)
    path = _user_path(user_id, relative_path)
    options = {"content-type": content_type, "upsert": "true" if upsert else "false"}
    client.storage.from_(_BUCKET).upload(path, raw, options)
    return StoredAsset(path=path, signed_url=_signed_url(client, path))


def upload_parish_asset(
    *,
    parish_id: str,
    relative_path: str,
    raw: bytes,
    content_type: str,
    upsert: bool = True,
) -> StoredAsset:
    client = get_service_client()
    path = _parish_path(parish_id, relative_path)
    options = {"content-type": content_type, "upsert": "true" if upsert else "false"}
    client.storage.from_(_BUCKET).upload(path, raw, options)
    return StoredAsset(path=path, signed_url=_signed_url(client, path))


def signed_asset_url(*, access_token: str, path: str, expires_in: int = 3600) -> str:
    p = (path or "").strip()
    if not p:
        return ""
    client = get_user_client(access_token)
    return _signed_url(client, p, expires_in=expires_in)


def signed_service_asset_url(*, path: str, expires_in: int = 3600) -> str:
    p = (path or "").strip()
    if not p:
        return ""
    return _signed_url(get_service_client(), p, expires_in=expires_in)


def _list_folder(client: Any, folder: str) -> list[dict[str, Any]]:
    rows = client.storage.from_(_BUCKET).list(folder.rstrip("/"))
    if not isinstance(rows, list):
        return []
    out: list[dict[str, Any]] = []
    for row in rows:
        name = str((row or {}).get("name") or "").strip()
        if not name:
            continue
        path = f"{folder.rstrip('/')}/{name}"
        try:
            url = _signed_url(client, path)
        except Exception:
            url = ""
        out.append({"name": name, "path": path, "url": url})
    return out


def list_user_assets(*, user_id: str, access_token: str, prefix: str) -> list[dict[str, Any]]:
    client = get_user_client(access_token)
    folder = _user_path(user_id, prefix).rstrip("/")
    return _list_folder(client, folder)


def list_parish_assets(*, parish_id: str, prefix: str) -> list[dict[str, Any]]:
    client = get_service_client()
    folder = _parish_path(parish_id, prefix).rstrip("/")
    return _list_folder(client, folder)


def delete_user_asset(*, user_id: str, access_token: str, relative_path: str) -> None:
    client = get_user_client(access_token)
    client.storage.from_(_BUCKET).remove([_user_path(user_id, relative_path)])


def delete_parish_asset(*, parish_id: str, relative_path: str) -> None:
    client = get_service_client()
    client.storage.from_(_BUCKET).remove([_parish_path(parish_id, relative_path)])


def download_user_asset(*, access_token: str, path: str) -> bytes:
    client = get_user_client(access_token)
    raw = client.storage.from_(_BUCKET).download((path or "").strip())
    if isinstance(raw, (bytes, bytearray)):
        return bytes(raw)
    raise RuntimeError("Failed to download storage asset.")


def download_service_asset(*, path: str) -> bytes:
    client = get_service_client()
    raw = client.storage.from_(_BUCKET).download((path or "").strip())
    if isinstance(raw, (bytes, bytearray)):
        return bytes(raw)
    raise RuntimeError("Failed to download storage asset.")
