"""Persist user-uploaded poster images under uploads/saved_posters/."""

from __future__ import annotations

import json
import re
import uuid
from pathlib import Path
from typing import Any

from services.community_config import uploads_dir

_META = "index.json"


def _dir() -> Path:
    d = uploads_dir() / "saved_posters"
    d.mkdir(parents=True, exist_ok=True)
    return d


def _load_meta() -> list[dict[str, Any]]:
    p = _dir() / _META
    if not p.is_file():
        return []
    try:
        raw = json.loads(p.read_text(encoding="utf-8"))
        return raw if isinstance(raw, list) else []
    except (json.JSONDecodeError, OSError):
        return []


def _save_meta(rows: list[dict[str, Any]]) -> None:
    (_dir() / _META).write_text(json.dumps(rows, ensure_ascii=False, indent=2), encoding="utf-8")


def list_saved() -> list[dict[str, Any]]:
    rows = _load_meta()
    out = []
    for row in rows:
        fid = str(row.get("id") or "")
        rel = str(row.get("filename") or "")
        if not fid or not rel:
            continue
        fp = _dir() / rel
        if fp.is_file():
            out.append(
                {
                    "id": fid,
                    "label": str(row.get("label") or rel),
                    "url": f"/uploads/saved_posters/{rel}",
                    "created": row.get("created"),
                }
            )
    return sorted(out, key=lambda x: str(x.get("created") or ""), reverse=True)


def save_file(filename: str, raw: bytes) -> dict[str, Any]:
    safe = re.sub(r"[^a-zA-Z0-9._-]+", "_", (filename or "poster").strip())[:120]
    if not safe.lower().endswith((".png", ".jpg", ".jpeg", ".webp")):
        safe += ".png"
    fid = uuid.uuid4().hex[:12]
    stored = f"{fid}_{safe}"
    path = _dir() / stored
    path.write_bytes(raw)
    rows = _load_meta()
    entry = {"id": fid, "filename": stored, "label": filename or stored, "created": __import__("time").time()}
    rows.insert(0, entry)
    _save_meta(rows)
    return {"ok": True, "id": fid, "url": f"/uploads/saved_posters/{stored}", "label": entry["label"]}


def delete_saved(poster_id: str) -> bool:
    pid = (poster_id or "").strip()
    if not pid:
        return False
    rows = _load_meta()
    kept = [r for r in rows if str(r.get("id") or "") != pid]
    removed = next((r for r in rows if str(r.get("id") or "") == pid), None)
    if not removed:
        return False
    rel = str(removed.get("filename") or "")
    fp = _dir() / rel
    fp.unlink(missing_ok=True)
    _save_meta(kept)
    return True
