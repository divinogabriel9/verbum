"""Hymn slide typography for projector-style lyrics (black slides)."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Mapping, Optional

DEFAULT_BODY_PT = 55.0
DEFAULT_TITLE_PT = 38.0  # ~70% of body (30% smaller)
DEFAULT_ALIGN = "center"


@dataclass(frozen=True)
class HymnTypographySettings:
    title_pt: float = DEFAULT_TITLE_PT
    body_pt: float = DEFAULT_BODY_PT
    title_align: str = DEFAULT_ALIGN
    body_align: str = DEFAULT_ALIGN

    @classmethod
    def from_mapping(cls, raw: Optional[Mapping[str, Any]]) -> HymnTypographySettings:
        if not raw:
            return cls()
        title_pt = _float(raw.get("title_pt"), DEFAULT_TITLE_PT)
        body_pt = _float(raw.get("body_pt"), DEFAULT_BODY_PT)
        title_align = _align(raw.get("title_align"), DEFAULT_ALIGN)
        body_align = _align(raw.get("body_align"), DEFAULT_ALIGN)
        return cls(
            title_pt=max(18.0, min(72.0, title_pt)),
            body_pt=max(24.0, min(96.0, body_pt)),
            title_align=title_align,
            body_align=body_align,
        )

    def to_dict(self) -> dict[str, Any]:
        return {
            "title_pt": self.title_pt,
            "body_pt": self.body_pt,
            "title_align": self.title_align,
            "body_align": self.body_align,
        }


def _float(value: Any, default: float) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _align(value: Any, default: str) -> str:
    s = str(value or default).strip().lower()
    if s in ("left", "center", "right"):
        return s
    return default


def typography_for_section(
    hymn_typography: Optional[Mapping[str, Any]],
    section: str,
) -> HymnTypographySettings:
    """Resolve section-level defaults (entrance, communion, …)."""
    if not hymn_typography:
        return HymnTypographySettings()
    sec = (section or "").strip().lower()
    if sec and sec in hymn_typography:
        block = hymn_typography.get(sec)
        if isinstance(block, Mapping):
            base = {k: v for k, v in block.items() if k != "slides"}
            return HymnTypographySettings.from_mapping(base)
    if "default" in hymn_typography:
        block = hymn_typography.get("default")
        if isinstance(block, Mapping):
            base = {k: v for k, v in block.items() if k != "slides"}
            return HymnTypographySettings.from_mapping(base)
    return HymnTypographySettings()


def typography_for_hymn_slide(
    hymn_typography: Optional[Mapping[str, Any]],
    section: str,
    slide_index: int,
) -> HymnTypographySettings:
    """Merge section defaults with per-slide overrides (``slides`` map in typography JSON)."""
    base = typography_for_section(hymn_typography, section)
    if not hymn_typography:
        return base
    sec = (section or "").strip().lower()
    block = hymn_typography.get(sec) if sec else None
    if not isinstance(block, Mapping):
        return base
    slides = block.get("slides")
    if not isinstance(slides, Mapping):
        return base
    raw = slides.get(str(slide_index))
    if raw is None:
        raw = slides.get(slide_index)
    if not isinstance(raw, Mapping):
        return base
    merged = {**base.to_dict(), **raw}
    return HymnTypographySettings.from_mapping(merged)
