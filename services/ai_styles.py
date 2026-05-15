"""Load AI image style fragments from ``data/styles.json`` for HF diffusion prompts."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Optional

_PROJECT_ROOT = Path(__file__).resolve().parents[1]
_STYLES_PATH = _PROJECT_ROOT / "data" / "styles.json"
_DEFAULT_STYLE_KEY = "cinematic"

_cache: Optional[dict[str, str]] = None


def load_style_prompts() -> dict[str, str]:
    """Return style key → prompt fragment. Keys are normalized to lowercase."""
    global _cache
    if _cache is not None:
        return _cache
    if not _STYLES_PATH.is_file():
        _cache = {
            _DEFAULT_STYLE_KEY: (
                "epic cinematic biblical scene, volumetric light rays, dramatic sky, movie poster style"
            )
        }
        return _cache
    with _STYLES_PATH.open(encoding="utf-8") as f:
        raw: object = json.load(f)
    out: dict[str, str] = {}
    if isinstance(raw, dict):
        for k, v in raw.items():
            ks = str(k).strip().lower().replace("-", "_")
            vs = str(v).strip()
            if ks and vs:
                out[ks] = vs
    _cache = out if out else {
        _DEFAULT_STYLE_KEY: (
            "epic cinematic biblical scene, volumetric light rays, dramatic sky, movie poster style"
        )
    }
    return _cache


def resolve_ai_image_style(requested: Optional[str]) -> str:
    """Normalize key; unknown values fall back to ``cinematic`` (or first available)."""
    styles = load_style_prompts()
    key = (requested or _DEFAULT_STYLE_KEY).strip().lower().replace("-", "_")
    if key in styles:
        return key
    if _DEFAULT_STYLE_KEY in styles:
        return _DEFAULT_STYLE_KEY
    return next(iter(styles))


def style_prompt_fragment(style_key: str) -> str:
    """Prompt fragment for a resolved style key."""
    styles = load_style_prompts()
    resolved = resolve_ai_image_style(style_key)
    return styles.get(resolved, "")
