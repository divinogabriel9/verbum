"""Hymn slide preview specs — same fit/chunk logic as ``generators.powerpoint``."""

from __future__ import annotations

from typing import Any, Mapping, Optional, Sequence

from generators.deck_template import (
    HYMN_BODY_TOP_OFFSET,
    SLIDE_HEIGHT,
    SLIDE_WIDTH,
    _HYMN_DUAL_CONT_BOX_H,
    _HYMN_DUAL_FIRST_BOX_H,
    _HYMN_TITLE_TOP,
    _LYRIC_BODY_BOTTOM_MARGIN,
)
from generators.powerpoint import (
    _HYMN_REF_BODY_PT_MIN,
    _HYMN_REF_LINE_SPACING,
    _HYMN_REF_TITLE_PT,
    _LYRIC_MAX_PT,
    _LYRIC_MIN_PT,
    _dual_second_verse_italic,
    _length_to_inches,
    _lyric_fit_height_inches,
    _normalize_hymn_lyrics_layout,
    _pair_blocks_for_dual_slides,
    detectOverflow,
    fitLyricsToFullWidthTextbox,
)
from services.hymn_typography import HymnTypographySettings, typography_for_hymn_slide

_SLIDE_WIDTH_PT = float(SLIDE_WIDTH.inches) * 72.0


def _resolve_body_lines_and_pt(
    chunk: str,
    *,
    typography: HymnTypographySettings,
    box_height_inches: float,
) -> tuple[list[str], int]:
    """Mirror ``powerpoint._fill_hymn_body_caps`` sizing without building a text frame."""
    fit_h = _lyric_fit_height_inches(box_height_inches)
    lines, auto_fit_pt = fitLyricsToFullWidthTextbox(chunk, fit_h)
    size_pt = int(max(_HYMN_REF_BODY_PT_MIN, min(_LYRIC_MAX_PT, auto_fit_pt)))
    requested = int(round(typography.body_pt))
    if requested >= _HYMN_REF_BODY_PT_MIN:
        size_pt = min(size_pt, requested)
    while size_pt > _LYRIC_MIN_PT and detectOverflow(lines, float(size_pt), fit_h):
        size_pt -= 2
    return [ln.upper() for ln in lines], size_pt


def _title_pt_for_slide(typography: HymnTypographySettings) -> float:
    return float(max(typography.title_pt, _HYMN_REF_TITLE_PT))


def _single_body_height_inches(*, with_title: bool) -> float:
    if with_title:
        body_top = _length_to_inches(_HYMN_TITLE_TOP + HYMN_BODY_TOP_OFFSET)
        return _length_to_inches(SLIDE_HEIGHT) - body_top - _length_to_inches(_LYRIC_BODY_BOTTOM_MARGIN)
    return _length_to_inches(SLIDE_HEIGHT) - _length_to_inches(_LYRIC_BODY_BOTTOM_MARGIN)


def _dual_body_height_inches(*, with_title: bool) -> float:
    box_h = _HYMN_DUAL_FIRST_BOX_H if with_title else _HYMN_DUAL_CONT_BOX_H
    return _length_to_inches(box_h)


def _block_payload(
    chunk: str,
    block_kind: str,
    *,
    typography: HymnTypographySettings,
    box_height_inches: float,
    italic: bool = False,
) -> dict[str, Any]:
    lines, body_pt = _resolve_body_lines_and_pt(
        chunk,
        typography=typography,
        box_height_inches=box_height_inches,
    )
    return {
        "lines": lines,
        "body_pt": body_pt,
        "body_align": typography.body_align,
        "block_kind": block_kind,
        "italic": bool(italic),
    }


def _ordered_plan_items(
    chunks: Sequence[Mapping[str, Any]],
    plan: Optional[Mapping[str, Any]],
) -> list[dict[str, Any]]:
    n = len(chunks)
    order_raw = (plan or {}).get("order")
    order = [int(x) for x in order_raw] if isinstance(order_raw, list) else list(range(n))
    disabled_raw = (plan or {}).get("disabled")
    disabled = {int(x) for x in disabled_raw} if isinstance(disabled_raw, list) else set()
    seen: set[int] = set()
    items: list[dict[str, Any]] = []
    for idx in order:
        if idx < 0 or idx >= n or idx in seen:
            continue
        seen.add(idx)
        row = chunks[idx] if isinstance(chunks[idx], Mapping) else {}
        items.append(
            {
                "chunk_idx": idx,
                "text": str(row.get("text") or ""),
                "block_kind": str(row.get("block_kind") or "verse"),
                "disabled": idx in disabled,
            }
        )
    for idx in range(n):
        if idx in seen:
            continue
        row = chunks[idx] if isinstance(chunks[idx], Mapping) else {}
        items.append(
            {
                "chunk_idx": idx,
                "text": str(row.get("text") or ""),
                "block_kind": str(row.get("block_kind") or "verse"),
                "disabled": idx in disabled,
            }
        )
    return items


def _pair_plan_items_for_dual(items: Sequence[Mapping[str, Any]]) -> list[list[dict[str, Any]]]:
    """Pair enabled blocks the same way as ``powerpoint._pair_blocks_for_dual_slides``."""
    enabled = [dict(item) for item in items if not item.get("disabled")]
    blocks = [(str(it.get("text") or ""), str(it.get("block_kind") or "verse")) for it in enabled]
    paired = _pair_blocks_for_dual_slides(blocks)
    groups: list[list[dict[str, Any]]] = []
    cursor = 0
    for group in paired:
        row: list[dict[str, Any]] = []
        for _text, _kind in group:
            if cursor >= len(enabled):
                break
            row.append(enabled[cursor])
            cursor += 1
        if row:
            groups.append(row)
    return groups


def build_hymn_slide_preview(
    *,
    hymn_title: str,
    section: str,
    layout: str,
    hymn_typography: Optional[Mapping[str, Any]],
    chunks: Sequence[Mapping[str, Any]],
    plan: Optional[Mapping[str, Any]] = None,
) -> dict[str, Any]:
    """
    Build per-slide typography/layout specs using the same pipeline as PPTX hymn slides.

    The frontend scales ``body_pt`` / ``title_pt`` by ``previewWidth / slide_width_pt``.
    """
    items = _ordered_plan_items(chunks, plan)
    mode = _normalize_hymn_lyrics_layout(layout)
    slides: list[dict[str, Any]] = []

    if mode == "dual":
        groups = _pair_plan_items_for_dual(items)
        title_assigned = False
        for group_i, group in enumerate(groups):
            typo = typography_for_hymn_slide(hymn_typography, section, group_i)
            show_title = not title_assigned
            if show_title:
                title_assigned = True
            with_title = show_title and len(group) >= 1
            box_h = _dual_body_height_inches(with_title=with_title)
            if len(group) == 1 and group_i == 0:
                box_h = _single_body_height_inches(with_title=True)
            elif len(group) == 1:
                box_h = _length_to_inches(SLIDE_HEIGHT)

            blocks = []
            for bi, item in enumerate(group):
                italic = _dual_second_verse_italic(
                    [(str(item.get("text") or ""), str(item.get("block_kind") or "verse")) for item in group],
                    bi,
                )
                blocks.append(
                    _block_payload(
                        str(item.get("text") or ""),
                        str(item.get("block_kind") or "verse"),
                        typography=typo,
                        box_height_inches=box_h,
                        italic=italic,
                    )
                )

            slides.append(
                {
                    "show_title": show_title,
                    "title_pt": _title_pt_for_slide(typo),
                    "title_align": typo.title_align,
                    "layout": "dual",
                    "dual_single": len(group) == 1,
                    "disabled": False,
                    "chunk_indices": [int(item.get("chunk_idx", -1)) for item in group],
                    "blocks": blocks,
                }
            )
    else:
        slide_idx = 0
        title_assigned = False
        for item in items:
            disabled = bool(item.get("disabled"))
            show_title = (not title_assigned) and (not disabled)
            if show_title:
                title_assigned = True
            typo = typography_for_hymn_slide(hymn_typography, section, slide_idx)
            if disabled:
                blocks = [
                    {
                        "lines": [
                            ln.strip().upper()
                            for ln in str(item.get("text") or "").splitlines()
                            if ln.strip()
                        ],
                        "body_pt": int(_HYMN_REF_BODY_PT_MIN),
                        "body_align": typo.body_align,
                        "block_kind": str(item.get("block_kind") or "verse"),
                        "italic": False,
                    }
                ]
            else:
                box_h = _single_body_height_inches(with_title=show_title)
                blocks = [
                    _block_payload(
                        str(item.get("text") or ""),
                        str(item.get("block_kind") or "verse"),
                        typography=typo,
                        box_height_inches=box_h,
                    )
                ]
                slide_idx += 1

            slides.append(
                {
                    "show_title": show_title,
                    "title_pt": _title_pt_for_slide(typo),
                    "title_align": typo.title_align,
                    "layout": "single",
                    "dual_single": False,
                    "disabled": disabled,
                    "chunk_indices": [int(item.get("chunk_idx", -1))],
                    "blocks": blocks,
                }
            )

    return {
        "ok": True,
        "hymn_title": (hymn_title or "Hymn").strip() or "Hymn",
        "slide_width_pt": _SLIDE_WIDTH_PT,
        "slide_height_pt": float(SLIDE_HEIGHT.inches) * 72.0,
        "line_spacing": _HYMN_REF_LINE_SPACING,
        "slides": slides,
    }
