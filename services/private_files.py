"""Private local file URLs and safe path resolution for authenticated downloads."""

from __future__ import annotations

import mimetypes
from pathlib import Path
from typing import Optional

from fastapi import HTTPException


def media_file_url(relative_path: str) -> str:
    rel = (relative_path or "").strip().lstrip("/")
    return f"/api/files/media/{rel}" if rel else ""


def upload_file_url(relative_path: str) -> str:
    rel = (relative_path or "").strip().lstrip("/")
    return f"/api/files/uploads/{rel}" if rel else ""


def preview_file_url(filename: str) -> str:
    base = Path((filename or "").strip()).name
    return f"/api/files/preview/{base}" if base else ""


def resolve_under_root(root: Path, relative_path: str) -> Path:
    rel = (relative_path or "").strip().replace("\\", "/").lstrip("/")
    if not rel or rel.endswith("/") or ".." in rel.split("/"):
        raise HTTPException(status_code=400, detail="Invalid file path.")
    candidate = (root / rel).resolve()
    try:
        candidate.relative_to(root.resolve())
    except ValueError as exc:
        raise HTTPException(status_code=404, detail="File not found.") from exc
    if not candidate.is_file():
        raise HTTPException(status_code=404, detail="File not found.")
    return candidate


def media_type_for(path: Path) -> str:
    guessed, _ = mimetypes.guess_type(path.name)
    if guessed:
        return guessed
    suffix = path.suffix.lower()
    if suffix == ".pptx":
        return "application/vnd.openxmlformats-officedocument.presentationml.presentation"
    if suffix == ".zip":
        return "application/zip"
    return "application/octet-stream"


def download_filename(path: Path, *, fallback: Optional[str] = None) -> str:
    return fallback or path.name
