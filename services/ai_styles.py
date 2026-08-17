"""Load AI image style fragments from ``data/styles.json`` for diffusion prompts."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Optional

from services.mass_divider.types import AI_STYLE_DEFAULT, VisualStyle

_PROJECT_ROOT = Path(__file__).resolve().parents[1]
_STYLES_PATH = _PROJECT_ROOT / "data" / "styles.json"

_cache: Optional[dict[str, VisualStyle]] = None


def _parse_style(key: str, raw: object) -> Optional[VisualStyle]:
    ks = str(key).strip().lower().replace("-", "_")
    if not ks:
        return None
    if isinstance(raw, str):
        prompt = raw.strip()
        if not prompt:
            return None
        return VisualStyle(id=ks, label=ks.replace("_", " ").title(), prompt=prompt)
    if isinstance(raw, dict):
        prompt = str(raw.get("prompt") or raw.get("fragment") or "").strip()
        if not prompt:
            return None
        label = str(raw.get("label") or ks.replace("_", " ").title()).strip()
        avoid = str(raw.get("avoid") or "").strip()
        return VisualStyle(id=ks, label=label, prompt=prompt, avoid=avoid)
    return None


def load_visual_styles() -> dict[str, VisualStyle]:
    """Return style key → VisualStyle. Keys are normalized to lowercase."""
    global _cache
    if _cache is not None:
        return _cache
    fallback = VisualStyle(
        id=AI_STYLE_DEFAULT,
        label="Cinematic",
        prompt=(
            "epic cinematic biblical scene, volumetric light rays, dramatic sky, "
            "movie poster style"
        ),
        avoid="text, logos",
    )
    if not _STYLES_PATH.is_file():
        _cache = {AI_STYLE_DEFAULT: fallback}
        return _cache
    with _STYLES_PATH.open(encoding="utf-8") as f:
        raw: object = json.load(f)
    out: dict[str, VisualStyle] = {}
    if isinstance(raw, dict):
        for k, v in raw.items():
            parsed = _parse_style(str(k), v)
            if parsed:
                out[parsed.id] = parsed
    _cache = out if out else {AI_STYLE_DEFAULT: fallback}
    return _cache


def load_style_prompts() -> dict[str, str]:
    """Return style key → prompt fragment (backward-compatible)."""
    return {key: style.prompt for key, style in load_visual_styles().items()}


def resolve_ai_image_style(requested: Optional[str]) -> str:
    """Normalize key; unknown values fall back to ``cinematic`` (or first available)."""
    styles = load_visual_styles()
    key = (requested or AI_STYLE_DEFAULT).strip().lower().replace("-", "_")
    if key in ("auto", ""):
        return AI_STYLE_DEFAULT
    if key in styles:
        return key
    if AI_STYLE_DEFAULT in styles:
        return AI_STYLE_DEFAULT
    return next(iter(styles))


def get_visual_style(requested: Optional[str]) -> VisualStyle:
    styles = load_visual_styles()
    resolved = resolve_ai_image_style(requested)
    return styles.get(resolved) or next(iter(styles.values()))


def style_prompt_fragment(style_key: str) -> str:
    """Prompt fragment for a resolved style key."""
    return get_visual_style(style_key).prompt


def resolve_style_for_generation(
    requested: Optional[str],
    *,
    recommended: Optional[str] = None,
) -> str:
    """Honor an explicit style; ``auto`` uses Gospel-recommended style."""
    key = (requested or "").strip().lower().replace("-", "_")
    if key in ("", "auto"):
        return resolve_ai_image_style(recommended or AI_STYLE_DEFAULT)
    return resolve_ai_image_style(key)
