"""Cartoon apostle profile avatars (the Twelve; Matthias replaces Judas)."""

from __future__ import annotations

import hashlib
import json
from functools import lru_cache
from pathlib import Path
from typing import Any, Optional

_MANIFEST = (
    Path(__file__).resolve().parents[1] / "static" / "avatars" / "apostles" / "manifest.json"
)

_APOSTLE_PREFIX = "apostle:"


@lru_cache(maxsize=1)
def list_apostle_avatars() -> list[dict[str, str]]:
    raw = json.loads(_MANIFEST.read_text(encoding="utf-8"))
    out: list[dict[str, str]] = []
    for row in raw:
        aid = str(row.get("id") or "").strip()
        name = str(row.get("name") or "").strip()
        path = str(row.get("path") or "").strip()
        if aid and name and path:
            out.append({"id": aid, "name": name, "path": path, "token": f"{_APOSTLE_PREFIX}{aid}"})
    return out


def apostle_by_id(apostle_id: str) -> Optional[dict[str, str]]:
    key = (apostle_id or "").strip().lower()
    if not key:
        return None
    if key.startswith(_APOSTLE_PREFIX):
        key = key[len(_APOSTLE_PREFIX) :]
    for row in list_apostle_avatars():
        if row["id"] == key:
            return row
    return None


def apostle_from_avatar_value(value: Optional[str]) -> Optional[dict[str, str]]:
    text = str(value or "").strip()
    if not text:
        return None
    if text.startswith(_APOSTLE_PREFIX):
        return apostle_by_id(text)
    for row in list_apostle_avatars():
        stem = "/apostles/" + row["id"] + "."
        if text == row["path"] or text.endswith((stem + "webp", stem + "svg", stem + "png")):
            return row
    return None


def resolve_avatar_display_url(value: Optional[str]) -> Optional[str]:
    """Return a browser-usable URL for an apostle token/path, or None."""
    apostle = apostle_from_avatar_value(value)
    if apostle:
        return apostle["path"]
    text = str(value or "").strip()
    if text.startswith("/static/"):
        return text
    return None


def random_apostle_for_user(user_id: str) -> dict[str, str]:
    rows = list_apostle_avatars()
    if not rows:
        raise RuntimeError("No apostle avatars configured.")
    digest = hashlib.sha256((user_id or "guest").encode("utf-8")).hexdigest()
    idx = int(digest[:8], 16) % len(rows)
    return rows[idx]


def avatar_payload(value: Optional[str]) -> dict[str, Any]:
    apostle = apostle_from_avatar_value(value)
    if not apostle:
        return {
            "avatar_url": resolve_avatar_display_url(value),
            "apostle_id": None,
            "apostle_name": None,
        }
    return {
        "avatar_url": apostle["path"],
        "apostle_id": apostle["id"],
        "apostle_name": apostle["name"],
    }
