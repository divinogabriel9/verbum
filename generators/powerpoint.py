"""
GFCC-style full Mass deck (community footer, poster dividers). Readings from API/USCCB.

1920×1080 landscape. Slide fill uses the liturgical calendar color; body/muted/emphasis
text colors are chosen for contrast (never matching the background).
"""

from __future__ import annotations

import math
import re
from copy import deepcopy
from dataclasses import dataclass
from pathlib import Path
from typing import Any, List, Mapping, Optional, Tuple

from pptx import Presentation
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE_TYPE
from pptx.enum.text import MSO_ANCHOR, MSO_AUTO_SIZE, PP_ALIGN
from pptx.util import Inches, Pt

from services.community_config import get_community_name, get_logo_path
from services.hymn_library import get_hymn
from services.hymn_typography import HymnTypographySettings, typography_for_hymn_slide
from services.mass_text_format import (
    clean_lyrics_for_projection,
    ensure_lyric_section_breaks,
    parse_structured_lyric_sections,
    pick_hymn_lyrics_for_slides,
    strip_reading_verse_markers,
)
from services.prayer_service import get_prayer
from services.prayer_templates import PENITENTIAL_ACT

from . import gfcc_flow_content as GFCC

SLIDE_WIDTH = Inches(20)
SLIDE_HEIGHT = Inches(11.25)

MARGIN_SIDE = Inches(1.0)
MARGIN_TOP = Inches(0.58)

_BG = RGBColor(18, 18, 22)
_GOLD_FALLBACK = RGBColor(220, 170, 90)
_BODY = RGBColor(245, 245, 245)
_MUTED = RGBColor(155, 155, 165)

_TITLE_PT = 38
_SECTION_PT = 30
_BODY_PT = 19
_META_PT = 14
_GREET_PT = 21
_FOOTER_PT = 13
_RITE_BODY_PT = 50
_RITE_DIRECTION_PT = 45
_LOTW_TITLE_PT = 50
_LOTW_BODY_PT = 65

_MAX_CHARS_READING = 820
_MAX_MARKED_BODY = 2600
# Hymn / lyrics slides (black screen, gold title, white ALL CAPS body — projector style)
_LYRIC_MAX_LINES_PER_SLIDE = 6
_LYRIC_TITLE_DISPLAY_PT = 38
_LYRIC_BODY_DISPLAY_PT = 55
_HYMN_BG = RGBColor(0, 0, 0)
_HYMN_GOLD_TITLE = RGBColor(255, 204, 77)
_HYMN_BODY_WHITE = RGBColor(255, 255, 255)
_HYMN_BRAND_WHITE = RGBColor(255, 255, 255)
_HYMN_FOOTER_MUTED = RGBColor(140, 140, 145)
_HYMN_TITLE_FONT = "Georgia"
_HYMN_BODY_FONT = "Arial Black"
_BRAND_BAND = Inches(1.05)
_LOGO_MAX_W = Inches(0.95)
_LOGO_MAX_H = Inches(0.42)
_COMMUNITY_HEADER_PT = 15
_HYMN_TITLE_TOP = Inches(0.12)
_EMU_PER_INCH = 914400
_LYRIC_SAFE_SIDE_RATIO = 0.0
_LYRIC_TEXTBOX_WIDTH_RATIO = 1.0
_LYRIC_MIN_WORDS_PER_LINE = 3
_LYRIC_TF_SIDE_MARGIN = Inches(0)
_LYRIC_MIN_PT = 52
_LYRIC_MAX_PT = 72
_LYRIC_SOFT_WRAP_CHARS = 46
_LYRIC_FIT_WIDTH_SAFETY = 0.96
_LYRIC_FIT_HEIGHT_SAFETY = 0.90

_PROJECT_ROOT = Path(__file__).resolve().parents[1]
_REFERENCE_DECK_FILENAME = "GCCC24May2026_Eastertide.pptx"
_REFERENCE_SLIDE_PRE_MASS = 0
_REFERENCE_SLIDE_PENITENTIAL = (7, 8)
_REFERENCE_SLIDE_KYRIE = 9
_REFERENCE_FOOTER_ZONE_TOP = int(SLIDE_HEIGHT * 0.78)
_reference_mass_deck: Optional[Presentation] = None


@dataclass(frozen=True)
class DeckBrandingOptions:
    include_logo: bool = True
    include_name: bool = True


_deck_branding = DeckBrandingOptions()
_OUTPUT_DIR = _PROJECT_ROOT / "outputs"


@dataclass(frozen=True)
class SlideTheme:
    """Per-deck colors: liturgical fill + foreground roles."""

    bg: RGBColor
    primary: RGBColor
    muted: RGBColor
    emphasis: RGBColor
    font_name: str = "Calibri"


_ACTIVE_FONT = "Calibri"


def _clamp_byte(x: float) -> int:
    return max(0, min(255, int(round(x))))


def _hex_to_rgb(value: Any) -> Optional[RGBColor]:
    text = str(value or "").strip().lstrip("#")
    if len(text) != 6:
        return None
    try:
        return RGBColor(int(text[0:2], 16), int(text[2:4], 16), int(text[4:6], 16))
    except ValueError:
        return None


def _rel_lum(r: int, g: int, b: int) -> float:
    def lin(c: int) -> float:
        cs = c / 255.0
        return cs / 12.92 if cs <= 0.03928 else ((cs + 0.055) / 1.055) ** 2.4

    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)


def _build_slide_theme(
    liturgical_color: Optional[Mapping[str, Any]],
    custom_theme: Optional[Mapping[str, Any]] = None,
) -> SlideTheme:
    """
    Liturgical RGB fills the slide; foreground colors follow background luminance.
    Cream/white seasons use near-black body text; darker greens/purples/reds use warm off-white
    and a gold emphasis so roles never mirror the fill.
    """
    if custom_theme:
        bg = _hex_to_rgb(custom_theme.get("bg"))
        primary = _hex_to_rgb(custom_theme.get("text")) or _hex_to_rgb(custom_theme.get("primary"))
        emphasis = _hex_to_rgb(custom_theme.get("primary")) or _hex_to_rgb(custom_theme.get("accent"))
        muted = _hex_to_rgb(custom_theme.get("accent"))
        if bg and primary and emphasis and muted:
            font_name = str(custom_theme.get("font") or "Calibri").split(",")[0].strip() or "Calibri"
            return SlideTheme(bg=bg, primary=primary, muted=muted, emphasis=emphasis, font_name=font_name)

    if liturgical_color and "rgb" in liturgical_color:
        r, g, b = liturgical_color["rgb"]
        r, g, b = int(r), int(g), int(b)
    else:
        return SlideTheme(bg=_BG, primary=_BODY, muted=_MUTED, emphasis=_GOLD_FALLBACK)

    bg = RGBColor(r, g, b)
    light_bg = _rel_lum(r, g, b) > 0.55

    if light_bg:
        primary = RGBColor(26, 26, 30)
        muted = RGBColor(95, 93, 104)
        emphasis = RGBColor(
            _clamp_byte(r * 0.28 + 18),
            _clamp_byte(g * 0.27 + 16),
            _clamp_byte(b * 0.30 + 20),
        )
    else:
        primary = RGBColor(250, 248, 244)
        muted = RGBColor(188, 186, 198)
        emphasis = RGBColor(255, 218, 145)

    return SlideTheme(bg=bg, primary=primary, muted=muted, emphasis=emphasis)


def _accent(liturgical_color: Optional[Mapping[str, Any]]) -> RGBColor:
    """Backward-compatible single accent RGB (emphasis tone for callers that only need one color)."""
    return _build_slide_theme(liturgical_color).emphasis


def _content_top():
    """Vertical start for slide body text (below logo + parish name)."""
    if not (_deck_branding.include_logo or _deck_branding.include_name):
        return MARGIN_TOP
    return MARGIN_TOP + _BRAND_BAND


def _apply_slide_branding(slide, theme: SlideTheme) -> None:
    """Top-left logo and parish name (GFCC reference deck style)."""
    if not _deck_branding.include_logo and not _deck_branding.include_name:
        return
    logo = get_logo_path() if _deck_branding.include_logo else None
    name = get_community_name() if _deck_branding.include_name else ""
    top = Inches(0.28)
    cursor_left = MARGIN_SIDE
    if logo and logo.is_file():
        pic = slide.shapes.add_picture(str(logo), cursor_left, top, width=_LOGO_MAX_W)
        if pic.height > _LOGO_MAX_H:
            scale = _LOGO_MAX_H / pic.height
            pic.width = int(pic.width * scale)
            pic.height = int(pic.height * scale)
        cursor_left = pic.left + pic.width + Inches(0.14)

    if _deck_branding.include_name and name:
        name_w = SLIDE_WIDTH - cursor_left - MARGIN_SIDE
        nb = slide.shapes.add_textbox(cursor_left, top, name_w, _LOGO_MAX_H)
        tf = nb.text_frame
        _prep_tf(tf)
        tf.clear()
        tf.word_wrap = True
        tf.vertical_anchor = MSO_ANCHOR.MIDDLE
        p0 = tf.paragraphs[0]
        p0.text = name
        _style_para(p0, size_pt=_COMMUNITY_HEADER_PT, color=theme.primary, bold=True)
        p0.alignment = PP_ALIGN.LEFT


def _apply_hymn_branding(slide) -> None:
    """Top-left logo + parish name on black hymn slides (white text)."""
    if not _deck_branding.include_logo and not _deck_branding.include_name:
        return
    logo = get_logo_path() if _deck_branding.include_logo else None
    name = get_community_name() if _deck_branding.include_name else ""
    top = Inches(0.28)
    cursor_left = MARGIN_SIDE
    if logo and logo.is_file():
        pic = slide.shapes.add_picture(str(logo), cursor_left, top, width=_LOGO_MAX_W)
        if pic.height > _LOGO_MAX_H:
            scale = _LOGO_MAX_H / pic.height
            pic.width = int(pic.width * scale)
            pic.height = int(pic.height * scale)
        cursor_left = pic.left + pic.width + Inches(0.14)
    if _deck_branding.include_name and name:
        name_w = SLIDE_WIDTH - cursor_left - MARGIN_SIDE
        nb = slide.shapes.add_textbox(cursor_left, top, name_w, _LOGO_MAX_H)
        tf = nb.text_frame
        _prep_tf(tf)
        tf.clear()
        tf.word_wrap = True
        tf.vertical_anchor = MSO_ANCHOR.MIDDLE
        p0 = tf.paragraphs[0]
        p0.text = name
        _style_para(p0, size_pt=_COMMUNITY_HEADER_PT, color=_HYMN_BRAND_WHITE, bold=True)
        p0.alignment = PP_ALIGN.LEFT


def _add_hymn_footer(slide, footer_section: str) -> None:
    lx = MARGIN_SIDE
    w = SLIDE_WIDTH - 2 * MARGIN_SIDE
    y = SLIDE_HEIGHT - Inches(0.95)
    foot = slide.shapes.add_textbox(lx, y, w, Inches(0.85))
    tf = foot.text_frame
    _prep_tf(tf)
    tf.clear()
    p0 = tf.paragraphs[0]
    if _deck_branding.include_name:
        p0.text = get_community_name()
        _style_para(p0, size_pt=_FOOTER_PT, color=_HYMN_FOOTER_MUTED, bold=True)
    p1 = tf.add_paragraph()
    p1.text = footer_section
    _style_para(p1, size_pt=_FOOTER_PT - 1, color=_HYMN_GOLD_TITLE, bold=False)
    p1.space_before = Pt(2)


def _layout_blank(prs: Presentation):
    for layout in prs.slide_layouts:
        if "blank" in (layout.name or "").lower():
            return layout
    return prs.slide_layouts[-1]


def _add_liturgical_poster_full_slide(prs: Presentation, png_path: Path) -> None:
    """
    Embed the 16×9 liturgical poster (PNG) as one full-bleed slide for projection.

    Expects ``png_path`` to match the slide aspect ratio (1920×1080 → 20″×11.25″ deck).
    """
    p = Path(png_path)
    if not p.is_file():
        return
    slide = prs.slides.add_slide(_layout_blank(prs))
    slide.shapes.add_picture(
        str(p.resolve()),
        left=0,
        top=0,
        width=prs.slide_width,
        height=prs.slide_height,
    )


def _set_slide_bg(slide, rgb: RGBColor):
    fi = slide.background.fill
    fi.solid()
    fi.fore_color.rgb = rgb


def _prep_tf(tf):
    tf.word_wrap = True
    tf.auto_size = MSO_AUTO_SIZE.NONE
    tf.margin_left = Inches(0.12)
    tf.margin_right = Inches(0.12)
    tf.margin_top = Inches(0.08)
    tf.margin_bottom = Inches(0.08)


def _prep_hymn_lyric_tf(tf):
    """Full-width lyric textbox on title slides (side inset 0; vertical padding from _prep_tf)."""
    _prep_tf(tf)
    tf.margin_left = _LYRIC_TF_SIDE_MARGIN
    tf.margin_right = _LYRIC_TF_SIDE_MARGIN


def _prep_hymn_lyric_tf_full_bleed(tf):
    """Title-less lyric slides: textbox flush to all four slide edges."""
    _prep_tf(tf)
    tf.margin_left = _LYRIC_TF_SIDE_MARGIN
    tf.margin_right = _LYRIC_TF_SIDE_MARGIN
    tf.margin_top = Inches(0)
    tf.margin_bottom = Inches(0)


def _lyric_textbox_geometry(slide_width: int) -> Tuple[int, int]:
    """Return (left, width) so the textbox spans the full slide width."""
    width = int(slide_width * _LYRIC_TEXTBOX_WIDTH_RATIO)
    left = int(slide_width * _LYRIC_SAFE_SIDE_RATIO)
    return left, width


def _lyric_continuation_textbox_geometry(slide_width: int, slide_height: int) -> Tuple[int, int, int, int]:
    """Return (left, top, width, height) at 0% inset for title-less lyric slides."""
    return 0, 0, int(slide_width), int(slide_height)


def _word_count(line: str) -> int:
    return len((line or "").split())


def _enforce_min_words_per_line(
    lines: List[str],
    min_words: int = _LYRIC_MIN_WORDS_PER_LINE,
) -> List[str]:
    """Merge orphan lines so each rendered line has at least ``min_words`` when possible."""
    if not lines:
        return lines
    merged: List[str] = []
    pending = ""
    for line in lines:
        text = (line or "").strip()
        if not text:
            continue
        if pending:
            text = f"{pending} {text}".strip()
            pending = ""
        while _word_count(text) < min_words:
            # keep short source lines intact if nothing else to merge with
            if not merged:
                break
            prev = merged.pop()
            text = f"{prev} {text}".strip()
        if _word_count(text) < min_words:
            pending = text
            continue
        merged.append(text)
    if pending:
        if merged:
            merged[-1] = f"{merged[-1]} {pending}".strip()
        else:
            merged.append(pending)
    return merged


def _style_para(p, *, size_pt, color, bold=False, italic=False, font_name=None):
    p.font.name = font_name or _ACTIVE_FONT
    p.font.size = Pt(size_pt)
    p.font.bold = bold
    p.font.italic = italic
    p.font.color.rgb = color


def _add_community_footer(slide, footer_section: str, theme: SlideTheme):
    lx = MARGIN_SIDE
    w = SLIDE_WIDTH - 2 * MARGIN_SIDE
    y = SLIDE_HEIGHT - Inches(0.95)
    foot = slide.shapes.add_textbox(lx, y, w, Inches(0.85))
    tf = foot.text_frame
    _prep_tf(tf)
    tf.clear()
    if _deck_branding.include_name:
        p0 = tf.paragraphs[0]
        p0.text = get_community_name()
        _style_para(p0, size_pt=_FOOTER_PT, color=theme.muted, bold=True)
    p1 = tf.add_paragraph()
    p1.text = footer_section
    _style_para(p1, size_pt=_FOOTER_PT - 1, color=theme.emphasis, bold=False)
    p1.space_before = Pt(2)


def _parse_marked_lines(marked: str) -> List[Tuple[str, str]]:
    out: List[Tuple[str, str]] = []
    for raw in (marked or "").split("\n"):
        raw = raw.strip()
        if not raw:
            continue
        role = "plain"
        if raw.startswith("<<P>>"):
            role, raw = "priest", raw[5:].strip()
        elif raw.startswith("<<A>>"):
            role, raw = "all", raw[5:].strip()
        elif raw.startswith("<<D>>"):
            role, raw = "direction", raw[5:].strip()
        elif raw.startswith("<<H>>"):
            role, raw = "hymn", raw[5:].strip()
        out.append((role, raw))
    return out


def _suppress_all_role_prefix(footer_section: str) -> bool:
    """Kyrie / Gloria / Sanctus / Our Father / Lamb: congregation lines without an ``All:`` prefix."""
    f = (footer_section or "").strip().lower()
    keys = ("kyrie eleison", "gloria", "sanctus", "our father", "lamb of god")
    return any(f.startswith(k) for k in keys)


def _is_prayer_rite_slide(footer_section: str) -> bool:
    """Mass prayer rites rendered large for projection (Kyrie, Gloria, Creed, etc.)."""
    f = (footer_section or "").strip().lower()
    keys = (
        "kyrie",
        "gloria",
        "sanctus",
        "our father",
        "lamb of god",
        "penitential act",
        "nicene creed",
    )
    return any(k in f for k in keys)


def _marked_body_height_inches() -> float:
    """Usable vertical space for marked prayer/body text (inches)."""
    top = _length_to_inches(_content_top())
    return float(SLIDE_HEIGHT.inches) - top - 1.1


def _rite_display_line(role: str, line: str, *, strip_all: bool) -> str:
    if role == "priest":
        return f"Priest: {line}"
    if role == "all":
        return line if strip_all else f"All: {line}"
    return line


def _rite_wrapped_line_units(role: str, line: str, *, strip_all: bool) -> float:
    """Estimate how many slide lines one marked line consumes at rite font size."""
    text = _rite_display_line(role, line, strip_all=strip_all)
    chars_per_line = 24 if role in ("priest", "all", "plain") else 30
    if role == "direction":
        chars_per_line = 34
    wrapped = max(1, math.ceil(len(text) / chars_per_line))
    extra = 0.25 if role in ("priest", "all") else 0.12
    return wrapped + extra


def _rite_line_height_inches(font_pt: float = _RITE_BODY_PT) -> float:
    return (font_pt * 1.22 + 8) / 72.0


def _serialize_marked_lines(items: List[Tuple[str, str]]) -> str:
    out: List[str] = []
    for role, line in items:
        if role == "priest":
            out.append(f"<<P>>{line}")
        elif role == "all":
            out.append(f"<<A>>{line}")
        elif role == "direction":
            out.append(f"<<D>>{line}")
        elif role == "hymn":
            out.append(f"<<H>>{line}")
        else:
            out.append(line)
    return "\n".join(out)


def _chunk_marked_rite_by_fit(
    marked: str,
    footer_section: str,
    body_h_inches: Optional[float] = None,
) -> List[str]:
    """Split prayer-rite marked text across slides when 50pt body would overflow."""
    items = _parse_marked_lines(marked)
    if not items:
        return [marked]

    strip_all = _suppress_all_role_prefix(footer_section)
    body_h = float(body_h_inches or _marked_body_height_inches())
    capacity = max(3.0, body_h / _rite_line_height_inches(_RITE_BODY_PT))

    grouped: List[List[Tuple[str, str]]] = []
    current: List[Tuple[str, str]] = []
    used = 0.0

    for role, line in items:
        units = _rite_wrapped_line_units(role, line, strip_all=strip_all)
        if current and used + units > capacity:
            grouped.append(current)
            current = []
            used = 0.0
        current.append((role, line))
        used += units

    if current:
        grouped.append(current)

    if not grouped:
        return [marked]
    return [_serialize_marked_lines(part) for part in grouped]


def _render_templated_prayer_slide(
    prs: Presentation,
    template: Mapping[str, Any],
    slide_spec: Mapping[str, Any],
    theme: SlideTheme,
    *,
    footer_section: str,
    slide_index: int = 0,
    slide_total: int = 1,
) -> None:
    """Render one prayer-template slide (fixed line breaks and rite typography)."""
    footer = template.get("footer") or footer_section
    if slide_total > 1:
        footer = f"{footer} ({slide_index + 1}/{slide_total})"

    body_pt = int(template.get("body_pt") or _RITE_BODY_PT)
    dir_pt = int(template.get("direction_pt") or _RITE_DIRECTION_PT)

    slide = prs.slides.add_slide(_layout_blank(prs))
    _set_slide_bg(slide, theme.bg)
    _apply_slide_branding(slide, theme)
    lx, top, w = MARGIN_SIDE, _content_top(), SLIDE_WIDTH - 2 * MARGIN_SIDE
    body_h = SLIDE_HEIGHT - top - Inches(1.1)

    box = slide.shapes.add_textbox(lx, top, w, body_h)
    tf = box.text_frame
    _prep_tf(tf)
    tf.clear()
    tf.vertical_anchor = MSO_ANCHOR.MIDDLE

    first = True
    for line_spec in slide_spec.get("lines") or []:
        style = str(line_spec.get("style") or "plain").strip().lower()
        raw = str(line_spec.get("text") or "").strip()
        if not raw:
            continue
        # Skip sidenote-style directions (kept italic in the template) from projection.
        if style == "direction":
            continue
        p = tf.paragraphs[0] if first else tf.add_paragraph()
        first = False

        if style == "priest":
            p.text = f"Priest: {raw}"
            _style_para(p, size_pt=body_pt, color=theme.emphasis, bold=True)
            p.space_before = Pt(6)
        elif style == "all_lead":
            p.text = f"ALL: {raw}"
            _style_para(p, size_pt=body_pt, color=theme.primary, bold=True)
            p.space_before = Pt(6)
        elif style == "all_body":
            p.text = raw
            _style_para(p, size_pt=body_pt, color=theme.primary, bold=False)
            p.space_before = Pt(4)
        else:
            p.text = raw
            _style_para(p, size_pt=body_pt, color=theme.primary, bold=False)

        p.alignment = PP_ALIGN.CENTER
        p.space_after = Pt(8)

    _add_community_footer(slide, footer, theme)


def _add_templated_prayer(prs: Presentation, template: Mapping[str, Any], theme: SlideTheme) -> None:
    slides = list(template.get("slides") or [])
    total = len(slides)
    footer_base = str(template.get("footer") or "Prayer")
    for i, slide_spec in enumerate(slides):
        _render_templated_prayer_slide(
            prs,
            template,
            slide_spec,
            theme,
            footer_section=footer_base,
            slide_index=i,
            slide_total=total,
        )


def _reference_mass_deck_path() -> Optional[Path]:
    candidates = (
        _PROJECT_ROOT / "data" / "reference" / _REFERENCE_DECK_FILENAME,
        _PROJECT_ROOT / "outputs" / "GFCC24May2026_Eastertide.pptx",
        Path.home() / "Downloads" / _REFERENCE_DECK_FILENAME,
    )
    for path in candidates:
        if path.is_file():
            return path.resolve()
    return None


def _load_reference_mass_deck() -> Optional[Presentation]:
    global _reference_mass_deck
    if _reference_mass_deck is not None:
        return _reference_mass_deck
    ref_path = _reference_mass_deck_path()
    if not ref_path:
        return None
    _reference_mass_deck = Presentation(str(ref_path))
    return _reference_mass_deck


def _is_reference_branding_shape(shape) -> bool:
    """Skip reference logo groups and baked-in parish footer text boxes."""
    if shape.shape_type == MSO_SHAPE_TYPE.GROUP:
        return True
    if not getattr(shape, "has_text_frame", False) or not shape.has_text_frame:
        return False
    if int(shape.top) >= _REFERENCE_FOOTER_ZONE_TOP:
        return True
    text = (shape.text_frame.text or "").strip().lower()
    parish = get_community_name().strip().lower()
    if parish and parish in text and int(shape.top) < _REFERENCE_FOOTER_ZONE_TOP:
        return True
    return False


def _copy_slide_into_presentation(
    prs: Presentation,
    slide_src,
    theme: SlideTheme,
    footer_section: str,
) -> None:
    """
    Clone prayer/body shapes from a reference slide.

    Uses liturgical ``theme`` background plus current logo and parish name;
    does not copy reference background, logo group, or footer text.
    """
    layout = _layout_blank(prs)
    dest = prs.slides.add_slide(layout)
    for shp in list(dest.shapes):
        el = shp.element
        el.getparent().remove(el)
    for shp in slide_src.shapes:
        if _is_reference_branding_shape(shp):
            continue
        newel = deepcopy(shp.element)
        dest.shapes._spTree.insert_element_before(newel, "p:extLst")
    _set_slide_bg(dest, theme.bg)
    _apply_slide_branding(dest, theme)
    _add_community_footer(dest, footer_section, theme)


def _copy_reference_slides(
    prs: Presentation,
    slide_specs: Tuple[Tuple[int, str], ...],
    theme: SlideTheme,
) -> bool:
    ref = _load_reference_mass_deck()
    if ref is None:
        return False
    for idx, _footer in slide_specs:
        if idx < 0 or idx >= len(ref.slides):
            return False
    total = len(slide_specs)
    for part_i, (idx, footer_base) in enumerate(slide_specs):
        footer = footer_base if total == 1 else f"{footer_base} ({part_i + 1}/{total})"
        _copy_slide_into_presentation(prs, ref.slides[idx], theme, footer)
    return True


def _add_pre_mass_slide(prs: Presentation, theme: SlideTheme) -> None:
    if _copy_reference_slides(prs, ((_REFERENCE_SLIDE_PRE_MASS, "Pre-Mass"),), theme):
        return
    _add_marked_slide(prs, "Pre-Mass", GFCC.SILENT_REMINDER, theme)


def _add_penitential_act_slides(prs: Presentation, theme: SlideTheme) -> None:
    specs = tuple((idx, "Penitential Act") for idx in _REFERENCE_SLIDE_PENITENTIAL)
    if _copy_reference_slides(prs, specs, theme):
        return
    _add_templated_prayer(prs, PENITENTIAL_ACT, theme)


def _add_kyrie_slide(prs: Presentation, theme: SlideTheme) -> None:
    if _copy_reference_slides(prs, ((_REFERENCE_SLIDE_KYRIE, "Kyrie Eleison"),), theme):
        return
    _add_marked_slide(prs, "Kyrie Eleison", GFCC.KYRIE, theme)


def _render_marked_slide(
    prs: Presentation,
    footer_section: str,
    marked_text: str,
    theme: SlideTheme,
) -> None:
    slide = prs.slides.add_slide(_layout_blank(prs))
    _set_slide_bg(slide, theme.bg)
    _apply_slide_branding(slide, theme)
    lx, top, w = MARGIN_SIDE, _content_top(), SLIDE_WIDTH - 2 * MARGIN_SIDE
    body_h = SLIDE_HEIGHT - top - Inches(1.1)

    box = slide.shapes.add_textbox(lx, top, w, body_h)
    tf = box.text_frame
    _prep_tf(tf)
    tf.clear()
    first = True
    strip_all = _suppress_all_role_prefix(footer_section)
    rite_slide = _is_prayer_rite_slide(footer_section)
    main_pt = _RITE_BODY_PT if rite_slide else _BODY_PT + 1
    dir_pt = _RITE_DIRECTION_PT if rite_slide else _META_PT + 1
    plain_pt = _RITE_BODY_PT if rite_slide else _BODY_PT
    if rite_slide:
        tf.vertical_anchor = MSO_ANCHOR.MIDDLE
    for role, line in _parse_marked_lines(marked_text):
        p = tf.paragraphs[0] if first else tf.add_paragraph()
        first = False
        if role == "priest":
            p.text = f"Priest: {line}"
            _style_para(p, size_pt=main_pt, color=theme.emphasis, bold=True)
            p.space_before = Pt(4)
        elif role == "all":
            p.text = line if strip_all else f"All: {line}"
            _style_para(p, size_pt=main_pt, color=theme.primary, bold=True)
            p.space_before = Pt(4)
        elif role == "direction":
            # Omit italic sidenotes for large projected prayer rites; keep for non-rite slides.
            if not rite_slide:
                p.text = line
                _style_para(p, size_pt=dir_pt, color=theme.emphasis, bold=False, italic=True)
        elif role == "hymn":
            p.text = line
            _style_para(p, size_pt=plain_pt, color=theme.primary, bold=True)
        else:
            p.text = line
            _style_para(p, size_pt=plain_pt, color=theme.primary, bold=False)
        p.alignment = PP_ALIGN.CENTER
        p.space_after = Pt(8 if rite_slide else 5)

    _add_community_footer(slide, footer_section, theme)


def _add_marked_slide(prs: Presentation, footer_section: str, marked_text: str, theme: SlideTheme) -> None:
    if _is_prayer_rite_slide(footer_section):
        chunks = _chunk_marked_rite_by_fit(marked_text, footer_section)
        total = len(chunks)
        for i, ch in enumerate(chunks):
            foot = footer_section if total == 1 else f"{footer_section} ({i + 1}/{total})"
            _render_marked_slide(prs, foot, ch, theme)
        return
    _render_marked_slide(prs, footer_section, marked_text, theme)


def _chunk_marked_body(marked: str, limit: int = _MAX_MARKED_BODY) -> List[str]:
    if len(marked) <= limit:
        return [marked]
    parts, buf, n = [], [], 0
    for line in marked.split("\n"):
        line_len = len(line) + 1
        if n + line_len > limit and buf:
            parts.append("\n".join(buf))
            buf, n = [line], line_len
        else:
            buf.append(line)
            n += line_len
    if buf:
        parts.append("\n".join(buf))
    return parts if parts else [marked[:limit]]


def _add_marked_chunked(prs: Presentation, footer: str, marked: str, theme: SlideTheme) -> None:
    if _is_prayer_rite_slide(footer):
        chunks = _chunk_marked_rite_by_fit(marked, footer)
    else:
        chunks = _chunk_marked_body(marked)
    for i, ch in enumerate(chunks):
        foot = footer if len(chunks) == 1 else f"{footer} ({i + 1}/{len(chunks)})"
        _add_marked_slide(prs, foot, ch, theme)


def _add_divider_cover(
    prs: Presentation,
    *,
    celebrant: str,
    date: str,
    season: str,
    lectionary_cycle: str,
    gospel_reference: str,
    gospel_quote: str,
    quote_max_chars: int,
    theme: SlideTheme,
    background_image_path: Optional[Path] = None,
    divider_poster_path: Optional[Path] = None,
) -> None:
    slide = prs.slides.add_slide(_layout_blank(prs))

    cover: Optional[Path] = None
    if divider_poster_path and Path(divider_poster_path).is_file():
        cover = Path(divider_poster_path).resolve()
    elif background_image_path and Path(background_image_path).is_file():
        cover = Path(background_image_path).resolve()

    # Add background image if provided, otherwise use solid color
    if cover and cover.is_file():
        slide.shapes.add_picture(
            str(cover),
            left=0,
            top=0,
            width=prs.slide_width,
            height=prs.slide_height,
        )
    else:
        _set_slide_bg(slide, theme.bg)
    
    _apply_slide_branding(slide, theme)
    lx = MARGIN_SIDE
    lw = SLIDE_WIDTH - 2 * MARGIN_SIDE
    ty = _content_top() + Inches(0.35)

    g_line = (gospel_quote or "").strip()
    if quote_max_chars and len(g_line) > quote_max_chars:
        g_line = g_line[: quote_max_chars - 1].rstrip() + "\u2026"
    gref = (gospel_reference or "").strip() or "—"

    lines = [
        "MASS CELEBRANT:",
        celebrant,
        "",
        *(
            ["", "\n".join(get_community_name().split()), ""]
            if _deck_branding.include_name
            else []
        ),
        f"Gospel ({gref})",
    ]
    if g_line:
        lines.append(f"\u201c{g_line}\u201d")
    lines.extend(["", f"YEAR {(lectionary_cycle or '—').strip().upper()}", f"{date} · {(season or '').strip()}"])

    blk = slide.shapes.add_textbox(lx, ty, lw, Inches(6.5))
    tf = blk.text_frame
    _prep_tf(tf)
    tf.clear()
    first = True
    for line in lines:
        p = tf.paragraphs[0] if first else tf.add_paragraph()
        first = False
        p.text = line
        bold = "CELEBRANT" in line or line.startswith("MASS")
        _style_para(p, size_pt=_GREET_PT, color=theme.primary if not bold else theme.emphasis, bold=bold)
        p.space_after = Pt(3)

    _add_community_footer(slide, "Mass poster / divider", theme)


def _add_section_card(prs: Presentation, big_lines: str, footer_section: str, theme: SlideTheme) -> None:
    slide = prs.slides.add_slide(_layout_blank(prs))
    _set_slide_bg(slide, theme.bg)
    _apply_slide_branding(slide, theme)
    lx, top, w = MARGIN_SIDE, _content_top() + Inches(0.25), SLIDE_WIDTH - 2 * MARGIN_SIDE
    box = slide.shapes.add_textbox(lx, top, w, Inches(4.5))
    tf = box.text_frame
    _prep_tf(tf)
    tf.clear()
    p = tf.paragraphs[0]
    p.text = big_lines
    _style_para(p, size_pt=44, color=theme.emphasis, bold=True)
    p.alignment = PP_ALIGN.CENTER
    _add_community_footer(slide, footer_section, theme)


def _length_to_inches(value: Any) -> float:
    """Convert python-pptx Length or raw EMU int to inches."""
    if hasattr(value, "inches"):
        return float(value.inches)
    return float(value) / _EMU_PER_INCH


def split_lyrics(lines: List[str], max_lines: int = _LYRIC_MAX_LINES_PER_SLIDE) -> List[str]:
    """Group lyric lines into slide blocks (each block is lines joined with newlines)."""
    if not lines:
        return []
    blocks: List[str] = []
    for i in range(0, len(lines), max_lines):
        blocks.append("\n".join(lines[i : i + max_lines]))
    return blocks


def _token_width_units(token: str) -> float:
    """Approximate rendered token width in relative units."""
    if not token:
        return 0.0
    narrow = set(".,:;!'|ijlIt`")
    wide = set("MW@#%&QGOD")
    units = 0.0
    for ch in token:
        if ch == " ":
            units += 0.33
        elif ch in narrow:
            units += 0.38
        elif ch in wide:
            units += 0.9
        else:
            units += 0.62
    return units


def measureRenderedText(lines: List[str], font_size_pt: float) -> Mapping[str, float]:
    """
    Estimate text footprint for full-width lyric fitting.

    Uses a conservative width model to keep projector readability.
    """
    safe_width_inches = float(SLIDE_WIDTH.inches) * _LYRIC_TEXTBOX_WIDTH_RATIO
    line_height_inches = (font_size_pt * 1.16) / 72.0
    max_line_inches = 0.0
    for line in lines:
        units = _token_width_units(line.strip().upper())
        # 1 unit is approximated as ~0.63em for Arial Black in projection use.
        # Conservative estimate for Arial Black ALL CAPS on projectors.
        estimated = (units * font_size_pt * 0.80) / 72.0
        if estimated > max_line_inches:
            max_line_inches = estimated
    return {
        "max_line_width_inches": max_line_inches,
        "text_height_inches": len(lines) * line_height_inches,
        "available_width_inches": safe_width_inches,
    }


def detectOverflow(lines: List[str], font_size_pt: float, box_height_inches: float) -> bool:
    measured = measureRenderedText(lines, font_size_pt)
    max_w = measured["available_width_inches"] * _LYRIC_FIT_WIDTH_SAFETY
    max_h = box_height_inches * _LYRIC_FIT_HEIGHT_SAFETY
    return bool(
        measured["max_line_width_inches"] > max_w
        or measured["text_height_inches"] > max_h
    )


def _lyric_lines_from_chunk(lyrics_text: str) -> List[str]:
    """
    Preserve line breaks from Lyrics Studio / saved hymn blocks.

    Only re-wraps individual lines that exceed the soft character limit.
    """
    raw_lines = [ln.strip() for ln in (lyrics_text or "").splitlines() if ln.strip()]
    if not raw_lines:
        return []
    out: List[str] = []
    for raw in raw_lines:
        if len(raw) <= _LYRIC_SOFT_WRAP_CHARS:
            out.append(raw)
            continue
        wrapped = optimizeLineBreaks(raw)
        out.extend(wrapped if wrapped else [raw])
    return out


def optimizeLineBreaks(lyrics_text: str) -> List[str]:
    """
    Phrase-aware line optimizer for worship lyrics.

    Prefers natural breathing punctuation and conjunction boundaries.
    Each line keeps at least ``_LYRIC_MIN_WORDS_PER_LINE`` words when split.
    """
    min_words = _LYRIC_MIN_WORDS_PER_LINE
    raw_lines = [ln.strip() for ln in (lyrics_text or "").splitlines() if ln.strip()]
    out: List[str] = []
    break_re = re.compile(r"\s+(,|;|:|\.|—|-|and|but|for|that|with|to)\s+", flags=re.IGNORECASE)
    for raw in raw_lines:
        words = raw.split()
        if len(words) <= (min_words * 2 - 1):
            out.append(raw)
            continue
        candidate = None
        midpoint = len(raw) // 2
        for m in break_re.finditer(raw):
            idx = m.start()
            left_n = _word_count(raw[:idx])
            right_n = _word_count(raw[idx:])
            if left_n < min_words or right_n < min_words:
                continue
            if candidate is None or abs(idx - midpoint) < abs(candidate - midpoint):
                candidate = idx
        if candidate is not None:
            first = raw[:candidate].strip()
            second = raw[candidate:].strip(" ,-;:.")
            if first and second and _word_count(first) >= min_words and _word_count(second) >= min_words:
                out.extend([first, second])
                continue
        # Balanced split with minimum words on each line.
        cut = max(min_words, min(len(words) - min_words, len(words) // 2))
        if cut < min_words or len(words) - cut < min_words:
            out.append(raw)
            continue
        out.extend([" ".join(words[:cut]), " ".join(words[cut:])])
    return _enforce_min_words_per_line(out)


def calculateOptimalFontSize(lines: List[str], box_height_inches: float) -> int:
    """Choose largest readable lyric size (60–72pt) that fits fixed full-width textbox."""
    line_count = len(lines)
    height_cap = _LYRIC_MAX_PT
    if line_count >= 6:
        height_cap = min(height_cap, 58)
    elif line_count >= 5:
        height_cap = min(height_cap, 64)
    elif line_count >= 4:
        height_cap = min(height_cap, 68)
    for pt in range(height_cap, _LYRIC_MIN_PT - 1, -1):
        if not detectOverflow(lines, float(pt), box_height_inches):
            return pt
    return _LYRIC_MIN_PT


def fitLyricsToFullWidthTextbox(lyrics_text: str, box_height_inches: float) -> Tuple[List[str], int]:
    """
    Fit lyrics into fixed near-edge-to-edge textbox.

    Keeps constant width and adjusts font size; preserves structured block line breaks.
    """
    lines = _lyric_lines_from_chunk(lyrics_text)
    if not lines:
        return [""], _LYRIC_MIN_PT

    fitted = lines
    size_pt = calculateOptimalFontSize(fitted, box_height_inches)
    while size_pt > _LYRIC_MIN_PT and detectOverflow(fitted, float(size_pt), box_height_inches):
        size_pt -= 2
    return fitted, size_pt


def _chunk_section_for_slides(section_text: str, max_lines: int = _LYRIC_MAX_LINES_PER_SLIDE) -> List[str]:
    """One structured block (verse/chorus); sub-chunk only when that block exceeds line budget."""
    cleaned = clean_lyrics_for_projection(section_text)
    if not cleaned:
        return []
    line_list = [ln for ln in cleaned.splitlines() if ln.strip()]
    if not line_list:
        return [cleaned]
    if len(line_list) <= max_lines:
        return ["\n".join(line_list)]
    return split_lyrics(line_list, max_lines=max_lines)


def _chunk_lyrics_display(text: str, max_lines: int = _LYRIC_MAX_LINES_PER_SLIDE) -> List[str]:
    """
    Split lyrics for hymn slides by structured-editor blocks (verse, chorus, bridge, etc.).

    Each blank-line-separated section from Lyrics Studio becomes its own slide group.
    Long sections may span multiple slides, but chunks never cross section boundaries.
    """
    t = ensure_lyric_section_breaks((text or "").strip())
    if not t:
        return []

    sections = parse_structured_lyric_sections(t)
    chunks: List[str] = []
    for section in sections:
        chunks.extend(_chunk_section_for_slides(section, max_lines=max_lines))

    return chunks if chunks else [t]


def _pp_align(name: str) -> PP_ALIGN:
    key = (name or "center").strip().lower()
    return {
        "left": PP_ALIGN.LEFT,
        "center": PP_ALIGN.CENTER,
        "right": PP_ALIGN.RIGHT,
    }.get(key, PP_ALIGN.CENTER)


def _auto_body_pt(line_count: int, longest: int, base_pt: float) -> float:
    size_pt = base_pt
    if line_count >= 8 or longest >= 40:
        size_pt = min(size_pt, 50.0)
    if line_count >= 10 or longest >= 48:
        size_pt = min(size_pt, 44.0)
    if line_count >= 12 or longest >= 56:
        size_pt = min(size_pt, 38.0)
    if line_count >= 14 or longest >= 64:
        size_pt = min(size_pt, 34.0)
    return size_pt


def _fill_hymn_body_caps(
    tf,
    chunk: str,
    *,
    typography: Optional[HymnTypographySettings] = None,
    box_height_inches: Optional[float] = None,
) -> None:
    """ALL CAPS bold sans-serif (white on black), optional custom size/alignment."""
    box_h = float(box_height_inches or 0.0) or float(SLIDE_HEIGHT.inches * 0.72)
    lines, auto_fit_pt = fitLyricsToFullWidthTextbox(chunk, box_h)
    size_pt = int(max(_LYRIC_MIN_PT, min(_LYRIC_MAX_PT, auto_fit_pt)))
    if typography:
        requested = int(max(_LYRIC_MIN_PT, min(_LYRIC_MAX_PT, round(typography.body_pt))))
        size_pt = min(size_pt, requested)
    while size_pt > _LYRIC_MIN_PT and detectOverflow(lines, float(size_pt), box_h):
        size_pt -= 2
    align = _pp_align(typography.body_align if typography else "center")

    tf.clear()
    first = True
    for raw in lines:
        p = tf.paragraphs[0] if first else tf.add_paragraph()
        first = False
        p.text = raw.upper()
        _style_para(
            p,
            size_pt=size_pt,
            color=_HYMN_BODY_WHITE,
            bold=True,
            font_name=_HYMN_BODY_FONT,
        )
        p.alignment = align
        p.space_after = Pt(6)
        p.line_spacing = 1.0
    if first:
        p = tf.paragraphs[0]
        p.text = (chunk or "").strip().upper()
        _style_para(
            p,
            size_pt=size_pt,
            color=_HYMN_BODY_WHITE,
            bold=True,
            font_name=_HYMN_BODY_FONT,
        )
        p.alignment = align


def _add_hymn_lyric_slides(
    prs: Presentation,
    footer_section: str,
    hymn_title: str,
    lyrics: str,
    theme: SlideTheme,
    *,
    hymn_typography: Optional[Mapping[str, Any]] = None,
    section: str = "",
) -> None:
    """
    Black screen: gold serif title; lyrics in white ALL CAPS bold sans, large and centered.
    First slide: title at top center + first lyric block below; further slides continue lyrics.
    """
    del theme  # hymn slides use fixed projector palette, not liturgical theme
    title = (hymn_title or "Hymn").strip()
    raw_lyrics = (lyrics or "").strip() or "(No lyrics in library for this hymn.)"
    chunks = _chunk_lyrics_display(raw_lyrics)
    if not chunks:
        chunks = [raw_lyrics]

    first_chunk = chunks[0]
    rest_chunks = chunks[1:]

    # Slide 1: gold title + first lyrics
    slide0 = prs.slides.add_slide(_layout_blank(prs))
    _set_slide_bg(slide0, _HYMN_BG)
    _apply_hymn_branding(slide0)

    w = SLIDE_WIDTH - 2 * MARGIN_SIDE
    title_top = _HYMN_TITLE_TOP
    title_box = slide0.shapes.add_textbox(MARGIN_SIDE, title_top, w, Inches(0.95))
    tft = title_box.text_frame
    _prep_tf(tft)
    tft.clear()
    typo0 = typography_for_hymn_slide(hymn_typography, section, 0)
    pt = tft.paragraphs[0]
    title_pt = typo0.title_pt
    title_align = _pp_align(typo0.title_align)
    pt.text = title
    _style_para(
        pt,
        size_pt=title_pt,
        color=_HYMN_GOLD_TITLE,
        bold=True,
        font_name=_HYMN_TITLE_FONT,
    )
    pt.alignment = title_align

    body_top = title_top + Inches(1.05)
    body_h = SLIDE_HEIGHT - body_top - Inches(0.95)
    lyric_left, lyric_w = _lyric_textbox_geometry(prs.slide_width)
    body_box = slide0.shapes.add_textbox(lyric_left, body_top, lyric_w, body_h)
    tfb = body_box.text_frame
    _prep_hymn_lyric_tf(tfb)
    tfb.word_wrap = True
    tfb.vertical_anchor = MSO_ANCHOR.MIDDLE
    _fill_hymn_body_caps(tfb, first_chunk, typography=typo0, box_height_inches=_length_to_inches(body_h))
    _add_hymn_footer(slide0, footer_section)

    for slide_idx, chunk in enumerate(rest_chunks, start=1):
        typo_n = typography_for_hymn_slide(hymn_typography, section, slide_idx)
        slide = prs.slides.add_slide(_layout_blank(prs))
        _set_slide_bg(slide, _HYMN_BG)
        _apply_hymn_branding(slide)
        cont_left, cont_top, cont_w, cont_h = _lyric_continuation_textbox_geometry(
            prs.slide_width, prs.slide_height
        )
        bx = slide.shapes.add_textbox(cont_left, cont_top, cont_w, cont_h)
        tf = bx.text_frame
        _prep_hymn_lyric_tf_full_bleed(tf)
        tf.word_wrap = True
        tf.vertical_anchor = MSO_ANCHOR.MIDDLE
        _fill_hymn_body_caps(tf, chunk, typography=typo_n, box_height_inches=_length_to_inches(cont_h))
        _add_hymn_footer(slide, footer_section)


def _try_library_hymn(
    prs: Presentation,
    section: str,
    hymn_id: str,
    footer: str,
    theme: SlideTheme,
    *,
    hymn_typography: Optional[Mapping[str, Any]] = None,
    hymn_lyric_overrides: Optional[Mapping[str, Any]] = None,
) -> bool:
    h = get_hymn(section, hymn_id)
    if not h:
        return False
    title = str(h.get("title") or "Hymn")
    library_lyrics = str(h.get("lyrics") or "")
    lyrics = library_lyrics
    if hymn_lyric_overrides:
        sec_block = hymn_lyric_overrides.get(section)
        if isinstance(sec_block, Mapping):
            ov = sec_block.get(hymn_id) or sec_block.get(str(hymn_id))
            if ov:
                lyrics = pick_hymn_lyrics_for_slides(library_lyrics, str(ov))
    _add_hymn_lyric_slides(
        prs,
        footer,
        title,
        lyrics,
        theme,
        hymn_typography=hymn_typography,
        section=section,
    )
    return True


def chunk_plain_text(text: str, limit: int = _MAX_CHARS_READING) -> List[str]:
    if not (text or "").strip():
        return []
    norm = " ".join(text.split())
    if len(norm) <= limit:
        return [norm]
    sentences = re.split(r"(?<=[.!?])\s+", norm)
    out: List[str] = []
    buf = ""
    for s in sentences:
        w = s.strip()
        if not w:
            continue
        spacer = " " if buf else ""
        if len(buf) + len(spacer) + len(w) <= limit:
            buf += spacer + w
        else:
            if buf:
                out.append(buf.strip())
            if len(w) <= limit:
                buf = w
            else:
                for i in range(0, len(w), limit):
                    piece = w[i : i + limit].strip()
                    if piece:
                        out.append(piece)
                buf = ""
    if buf:
        out.append(buf.strip())
    return out if out else [norm[:limit]]


def _paragraphs(tf, *, size_pt, color, bold=False):
    tf.clear()
    p = tf.paragraphs[0]
    _style_para(p, size_pt=size_pt, color=color, bold=bold)


def _fill_multipara(tf, text: str, *, size_pt: int, color: RGBColor):
    tf.clear()
    raw = (text or "").strip()
    parts = [b.strip() for b in raw.split("\n\n") if b.strip()] or ([raw] if raw else [""])
    first = True
    for block in parts:
        p = tf.paragraphs[0] if first else tf.add_paragraph()
        first = False
        p.text = block
        _style_para(p, size_pt=size_pt, color=color)
        p.space_after = Pt(5)


def _add_reading_block(
    prs: Presentation,
    *,
    section: str,
    reference: str,
    body: str,
    unavailable_note: str,
    lotw_banner: bool,
    footer_tag: str,
    theme: SlideTheme,
) -> None:
    ref = (reference or "").strip() or "—"
    body = strip_reading_verse_markers((body or "").strip())

    def one_slide(head: str, sub: str, main: str):
        slide = prs.slides.add_slide(_layout_blank(prs))
        _set_slide_bg(slide, theme.bg)
        _apply_slide_branding(slide, theme)
        lx, top, w = MARGIN_SIDE, _content_top(), SLIDE_WIDTH - 2 * MARGIN_SIDE
        title_h = Inches(1.12) if lotw_banner else Inches(0.92)
        title_box = slide.shapes.add_textbox(lx, top, w, title_h)
        tf_t = title_box.text_frame
        _prep_tf(tf_t)
        tf_t.clear()
        if lotw_banner:
            p0 = tf_t.paragraphs[0]
            p0.text = "Liturgy of the Word"
            _style_para(p0, size_pt=_SECTION_PT - 2, color=theme.emphasis, bold=True)
            p1 = tf_t.add_paragraph()
            p1.text = head if "continued" in head.lower() else f"{section} ({ref})"
            _style_para(p1, size_pt=_META_PT + 2, color=theme.muted, bold=False)
        else:
            _paragraphs(tf_t, size_pt=_SECTION_PT, color=theme.emphasis, bold=True)
            tf_t.paragraphs[0].text = head

        sub_top = top + title_h + Inches(0.06)
        sub_h = Inches(0.48)
        sub_box = slide.shapes.add_textbox(lx, sub_top, w, sub_h)
        _prep_tf(sub_box.text_frame)
        _paragraphs(sub_box.text_frame, size_pt=_META_PT, color=theme.muted)
        sub_box.text_frame.paragraphs[0].text = sub

        body_top = sub_top + sub_h + Inches(0.12)
        body_h = SLIDE_HEIGHT - body_top - Inches(1.0)
        bsh = slide.shapes.add_textbox(lx, body_top, w, body_h)
        _prep_tf(bsh.text_frame)
        _paragraphs(bsh.text_frame, size_pt=_BODY_PT, color=theme.primary)
        _fill_multipara(bsh.text_frame, main, size_pt=_BODY_PT, color=theme.primary)
        _add_community_footer(slide, footer_tag, theme)

    if not body:
        one_slide(section, ref, unavailable_note)
        return
    chunks = chunk_plain_text(body)
    total = len(chunks)
    for i, chunk in enumerate(chunks):
        head = section if i == 0 else f"{section} (continued)"
        if lotw_banner:
            sub = "" if total <= 1 else f"Slide {i + 1} of {total}"
        else:
            sub = ref if total <= 1 else f"{ref}  ·  slide {i + 1} of {total}"
        one_slide(head, sub, chunk)


def _add_lotw_reading_slide(
    prs: Presentation,
    *,
    section: str,
    reference: str,
    full_text: str,
    theme: SlideTheme,
) -> None:
    """Liturgy of the Word reading: 50pt headers, 65pt centered body (verse numbers kept)."""
    ref = (reference or "").strip() or "—"
    body = (full_text or "").strip()
    chunks = chunk_plain_text(body, limit=220) if body else []
    total = max(1, len(chunks))

    for i in range(total):
        chunk = chunks[i] if chunks else ""
        slide = prs.slides.add_slide(_layout_blank(prs))
        _set_slide_bg(slide, theme.bg)
        _apply_slide_branding(slide, theme)
        lx, top, w = MARGIN_SIDE, _content_top(), SLIDE_WIDTH - 2 * MARGIN_SIDE
        body_h = SLIDE_HEIGHT - top - Inches(1.1)
        box = slide.shapes.add_textbox(lx, top, w, body_h)
        tf = box.text_frame
        _prep_tf(tf)
        tf.clear()
        tf.vertical_anchor = MSO_ANCHOR.MIDDLE

        p0 = tf.paragraphs[0]
        p0.text = "Liturgy of the Word"
        _style_para(p0, size_pt=_LOTW_TITLE_PT, color=theme.emphasis, bold=True)
        p0.alignment = PP_ALIGN.CENTER
        p0.space_after = Pt(10)

        head = section if i == 0 else f"{section} (continued)"
        p1 = tf.add_paragraph()
        p1.text = f"{head}\n({ref})"
        _style_para(p1, size_pt=_LOTW_TITLE_PT, color=theme.emphasis, bold=True)
        p1.alignment = PP_ALIGN.CENTER
        p1.space_after = Pt(12)

        if total > 1:
            p_cnt = tf.add_paragraph()
            p_cnt.text = f"Slide {i + 1} of {total}"
            _style_para(p_cnt, size_pt=_META_PT + 2, color=theme.muted, bold=False)
            p_cnt.alignment = PP_ALIGN.CENTER
            p_cnt.space_after = Pt(10)

        if chunk:
            p2 = tf.add_paragraph()
            p2.text = chunk
            _style_para(p2, size_pt=_LOTW_BODY_PT, color=theme.primary, bold=False)
            p2.alignment = PP_ALIGN.CENTER
            p2.space_after = Pt(8)

        foot = "Liturgy of the Word" if total == 1 else f"Liturgy of the Word ({i + 1}/{total})"
        _add_community_footer(slide, foot, theme)


def _add_title_slide(
    prs: Presentation,
    *,
    title: str,
    date: str,
    celebrant: str,
    gospel_reference: str,
    gospel_quote: str,
    season: str,
    lectionary_cycle: str,
    liturgical_color: Optional[Mapping[str, Any]],
    quote_attribution: Optional[str],
    quote_max_chars: int,
    theme: SlideTheme,
) -> None:
    slide = prs.slides.add_slide(_layout_blank(prs))
    _set_slide_bg(slide, theme.bg)
    _apply_slide_branding(slide, theme)
    lx, w = MARGIN_SIDE, SLIDE_WIDTH - 2 * MARGIN_SIDE
    y = _content_top() + Inches(0.15)

    tb = slide.shapes.add_textbox(lx, y, w, Inches(1.05))
    tft = tb.text_frame
    _prep_tf(tft)
    tft.clear()
    p0 = tft.paragraphs[0]
    p0.text = title or "Mass"
    _style_para(p0, size_pt=_TITLE_PT, color=theme.emphasis, bold=True)
    p0.alignment = PP_ALIGN.CENTER

    g_line = (gospel_quote or "").strip()
    if quote_max_chars and len(g_line) > quote_max_chars:
        g_line = g_line[: quote_max_chars - 1].rstrip() + "\u2026"
    gref = (gospel_reference or "").strip() or "—"

    meta = (
        f"{date}\n\nCelebrant: {celebrant}\n\n"
        f"Gospel: {gref}\n"
        f"Season: {(season or '—').strip()} · Sunday Lectionary Year {(lectionary_cycle or '—').strip().upper()}"
    )
    if g_line:
        meta += f"\n\nExcerpt:\n\u201c{g_line}\u201d"

    mb = slide.shapes.add_textbox(lx, y + Inches(1.15), w, Inches(3.4))
    _prep_tf(mb.text_frame)
    _fill_multipara(mb.text_frame, meta, size_pt=_GREET_PT, color=theme.primary)

    if quote_attribution and g_line:
        nb = slide.shapes.add_textbox(lx, SLIDE_HEIGHT - Inches(1.2), w, Inches(0.75))
        _prep_tf(nb.text_frame)
        _fill_multipara(nb.text_frame, str(quote_attribution), size_pt=_META_PT, color=theme.muted)

    _add_community_footer(slide, "Title", theme)


def _add_full_bleed_png_slides(prs: Presentation, paths: List[Optional[Path]]) -> None:
    for raw in paths or []:
        if not raw:
            continue
        p = Path(raw)
        if not p.is_file():
            continue
        slide = prs.slides.add_slide(_layout_blank(prs))
        slide.shapes.add_picture(
            str(p.resolve()),
            left=0,
            top=0,
            width=prs.slide_width,
            height=prs.slide_height,
        )


def _add_mass_collection_slide(
    prs: Presentation,
    theme: SlideTheme,
    *,
    amount: str,
    date_label: str,
) -> None:
    lines = ["<<H>>MASS COLLECTION", "<<D>>Thank you for your generosity."]
    if (amount or "").strip():
        lines.append(f"<<D>>Amount: {amount.strip()}")
    if (date_label or "").strip():
        lines.append(f"<<D>>Date: {date_label.strip()}")
    if len(lines) == 2:
        lines.append("<<D>>(Enter collection amount and date in Mass Builder.)")
    _add_marked_slide(prs, "Mass Collection", "\n".join(lines), theme)


def _add_food_sponsors_slide(prs: Presentation, theme: SlideTheme, sponsors: List[str]) -> None:
    names = [(s or "").strip() for s in (sponsors or [])]
    names = [n for n in names if n]
    if not names:
        return
    lines: List[str] = ["<<H>>FOOD SPONSORS", "<<D>>The community thanks our food sponsors."]
    for ss in names:
        lines.append(f"<<D>>• {ss}")
    _add_marked_slide(prs, "Food Sponsors", "\n".join(lines), theme)


def generate_mass_ppt(
    title: str,
    gospel_reference: str,
    gospel_quote: str,
    season: str,
    lectionary_cycle: str,
    celebrant: str,
    date: str,
    *,
    gospel_full_text: str = "",
    first_reading_ref: str = "",
    first_reading_text: str = "",
    psalm_ref: str = "",
    psalm_text: str = "",
    second_reading_ref: str = "",
    second_reading_text: str = "",
    quote_attribution=None,
    quote_max_chars: int = 400,
    liturgical_color: Optional[Mapping[str, Any]] = None,
    custom_theme: Optional[Mapping[str, Any]] = None,
    song_selections: Optional[Mapping[str, Any]] = None,
    output_stem: str = "mass_presentation",
    liturgical_poster_png: Optional[Path] = None,
    divider_poster_png: Optional[Path] = None,
    announcement_image_paths: Optional[List[Path]] = None,
    mass_collection_amount: str = "",
    mass_collection_date_label: str = "",
    food_sponsors: Optional[List[str]] = None,
    hymn_typography: Optional[Mapping[str, Any]] = None,
    include_church_logo: bool = True,
    include_church_name: bool = True,
    hymn_lyric_overrides: Optional[Mapping[str, Any]] = None,
) -> tuple[int, Path]:
    global _ACTIVE_FONT, _deck_branding, _reference_mass_deck
    _reference_mass_deck = None
    _deck_branding = DeckBrandingOptions(
        include_logo=bool(include_church_logo),
        include_name=bool(include_church_name),
    )
    prs = Presentation()
    prs.slide_width = SLIDE_WIDTH
    prs.slide_height = SLIDE_HEIGHT
    theme = _build_slide_theme(liturgical_color, custom_theme)
    _ACTIVE_FONT = theme.font_name

    g_line = (gospel_quote or "").strip()
    if quote_max_chars and len(g_line) > quote_max_chars:
        g_line = g_line[: quote_max_chars - 1].rstrip() + "\u2026"

    unavail = (
        "Full text was not loaded from bible.usccb.org. "
        "Open today’s readings for this date and paste if needed."
    )

    ctx = dict(
        celebrant=celebrant,
        date=date,
        season=season,
        lectionary_cycle=lectionary_cycle,
        gospel_reference=gospel_reference or "",
        gospel_quote=g_line,
        quote_max_chars=quote_max_chars,
        theme=theme,
        background_image_path=liturgical_poster_png,
        divider_poster_path=divider_poster_png,
    )

    sel = song_selections or {}

    # --- Pre-Mass (reference deck slide) ---
    _add_pre_mass_slide(prs, theme)

    _add_title_slide(
        prs,
        title=title,
        date=date,
        celebrant=celebrant,
        gospel_reference=gospel_reference or "",
        gospel_quote=g_line,
        season=season,
        lectionary_cycle=lectionary_cycle,
        liturgical_color=liturgical_color,
        quote_attribution=quote_attribution,
        quote_max_chars=quote_max_chars,
        theme=theme,
    )

    ent_id = str(sel.get("entrance") or "").strip()
    if not ent_id or not _try_library_hymn(
        prs, "entrance", ent_id, "Entrance", theme, hymn_typography=hymn_typography, hymn_lyric_overrides=hymn_lyric_overrides
    ):
        _add_marked_slide(
            prs,
            "Entrance",
            "<<D>>No Entrance hymn lyrics were selected. Choose one Entrance song in Mass Flow or save lyrics in Lyrics Studio before generating.",
            theme,
        )
    _add_divider_cover(prs, **ctx)

    # --- Introductory Rites ---
    _add_marked_slide(prs, "Introductory Rites", GFCC.SIGN_CROSS, theme)
    _add_penitential_act_slides(prs, theme)
    _add_kyrie_slide(prs, theme)
    _add_marked_chunked(prs, "Gloria", get_prayer("gloria"), theme)
    _add_marked_slide(prs, "Liturgy of the Word", GFCC.OPENING_PRAYER, theme)

    # --- Liturgy of the Word ---
    _add_section_card(prs, "LITURGY OF\nTHE WORD", "Liturgy of the Word", theme)

    _add_lotw_reading_slide(
        prs,
        section="First Reading",
        reference=first_reading_ref or "—",
        full_text=(first_reading_text or "").strip(),
        theme=theme,
    )
    _add_lotw_reading_slide(
        prs,
        section="Responsorial Psalm",
        reference=psalm_ref or "—",
        full_text=(psalm_text or "").strip(),
        theme=theme,
    )
    if (second_reading_ref or "").strip():
        _add_lotw_reading_slide(
            prs,
            section="Second Reading",
            reference=second_reading_ref.strip(),
            full_text=(second_reading_text or "").strip(),
            theme=theme,
        )

    _add_marked_slide(prs, "Gospel Acclamation", GFCC.ALLELUIA_SING, theme)
    _add_marked_slide(prs, "Gospel Acclamation", GFCC.ALLELUIA_COMMENTATOR, theme)
    _add_marked_slide(prs, "Gospel Acclamation", GFCC.GOSPEL_INTRO, theme)

    _add_marked_slide(prs, "Gospel Acclamation", GFCC.GOSPEL_END, theme)
    _add_divider_cover(prs, **ctx)

    # --- Creed ---
    _add_marked_chunked(prs, "Nicene Creed", get_prayer("nicene_creed"), theme)
    _add_divider_cover(prs, **ctx)

    # --- Prayer of the Faithful ---
    _add_marked_slide(prs, "Prayer of the Faithful", GFCC.PRAYER_FAITHFUL_1, theme)
    _add_marked_slide(prs, "Prayer of the Faithful", GFCC.PRAYER_FAITHFUL_2, theme)
    _add_divider_cover(prs, **ctx)

    # --- Liturgy of the Eucharist ---
    off_id = str(sel.get("offertory") or "").strip()
    if not off_id or not _try_library_hymn(
        prs, "offertory", off_id, "Offertory", theme, hymn_typography=hymn_typography, hymn_lyric_overrides=hymn_lyric_overrides
    ):
        _add_marked_slide(
            prs,
            "Offertory",
            "<<D>>No Offertory hymn lyrics were selected. Choose one Offertory song in Mass Flow or save lyrics in Lyrics Studio before generating.",
            theme,
        )
    _add_section_card(prs, "LITURGY OF\nTHE EUCHARIST", "Liturgy of the Eucharist", theme)
    _add_marked_slide(prs, "Liturgy of the Eucharist", GFCC.PRAY_BRETHREN, theme)
    _add_section_card(prs, "LITURGY OF\nTHE EUCHARIST", "Liturgy of the Eucharist", theme)
    _add_marked_slide(prs, "Liturgy of the Eucharist", GFCC.PREFACE_DIALOGUE, theme)
    _add_marked_slide(prs, "Liturgy of the Eucharist", GFCC.PREFACE_ACCLAIM, theme)
    _add_marked_chunked(prs, "Sanctus", get_prayer("holy_holy"), theme)
    _add_section_card(prs, "LITURGY OF\nTHE EUCHARIST", "Liturgy of the Eucharist", theme)
    _add_marked_slide(prs, "The Eucharistic Prayer", get_prayer("mystery_of_faith"), theme)
    _add_section_card(prs, "LITURGY OF\nTHE EUCHARIST", "Liturgy of the Eucharist", theme)
    _add_marked_slide(prs, "Great Amen", GFCC.GREAT_AMEN, theme)
    _add_marked_chunked(prs, "Our Father", get_prayer("our_father"), theme)
    _add_divider_cover(prs, **ctx)
    _add_marked_slide(prs, "The Communion Rite", GFCC.COMMUNION_RITE_DELIVER, theme)
    _add_divider_cover(prs, **ctx)
    _add_marked_slide(prs, "Sign of Peace", GFCC.SIGN_PEACE, theme)
    _add_marked_slide(prs, "Lamb of God", get_prayer("lamb_of_god"), theme)
    _add_marked_slide(prs, "The Communion Rite", GFCC.COMMUNION_DIALOGUE, theme)
    _add_divider_cover(prs, **ctx)
    c1 = str(sel.get("communion_1") or "").strip()
    c2 = str(sel.get("communion_2") or "").strip()
    comm_ok = False
    if c1 and _try_library_hymn(
        prs, "communion", c1, "Communion (1)", theme, hymn_typography=hymn_typography, hymn_lyric_overrides=hymn_lyric_overrides
    ):
        comm_ok = True
    if c2 and _try_library_hymn(
        prs, "communion", c2, "Communion (2)", theme, hymn_typography=hymn_typography, hymn_lyric_overrides=hymn_lyric_overrides
    ):
        comm_ok = True
    if not comm_ok:
        _add_marked_slide(
            prs,
            "Communion",
            "<<D>>No Communion hymn lyrics were selected. Choose up to two Communion songs in Mass Flow or save lyrics in Lyrics Studio before generating.",
            theme,
        )
    med_id = str(sel.get("meditation") or "").strip()
    if med_id:
        _try_library_hymn(
            prs, "meditation", med_id, "Meditation", theme, hymn_typography=hymn_typography, hymn_lyric_overrides=hymn_lyric_overrides
        )
    _add_marked_slide(prs, "The Communion Rite", GFCC.POST_COMMUNION, theme)
    _add_divider_cover(prs, **ctx)

    # --- Stewardship, sponsors, announcement posters (before final blessing) ---
    _add_mass_collection_slide(
        prs,
        theme,
        amount=mass_collection_amount or "",
        date_label=mass_collection_date_label or "",
    )
    _add_food_sponsors_slide(prs, theme, list(food_sponsors or []))
    ann_paths: List[Optional[Path]] = list(announcement_image_paths or [])
    _add_full_bleed_png_slides(prs, ann_paths)
    if not ann_paths:
        _add_marked_slide(prs, "Announcements", GFCC.ANNOUNCEMENTS_TITLE, theme)
        _add_marked_slide(prs, "Announcements", GFCC.WELCOME_NEWCOMERS, theme)
        _add_marked_slide(prs, "Announcements", GFCC.CONFESSION_SLIDE, theme)
        _add_marked_slide(prs, "Announcements", GFCC.FB_UPDATES, theme)

    _add_marked_slide(prs, "Final Blessing", GFCC.FINAL_BLESSING, theme)
    rec_id = str(sel.get("recessional") or "").strip()
    if not rec_id or not _try_library_hymn(
        prs, "recessional", rec_id, "Recessional", theme, hymn_typography=hymn_typography, hymn_lyric_overrides=hymn_lyric_overrides
    ):
        _add_marked_slide(
            prs,
            "Recessional",
            "<<D>>No Recessional hymn lyrics were selected. Choose one Recessional song in Mass Flow or save lyrics in Lyrics Studio before generating.",
            theme,
        )
    _add_divider_cover(prs, **ctx)

    _OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    stem = (output_stem or "mass_presentation").strip() or "mass_presentation"
    out = _OUTPUT_DIR / f"{stem}.pptx"
    n_slides = len(prs.slides)
    prs.save(out)
    print(f"✅ PowerPoint created: {out} ({n_slides} slides)")
    return n_slides, out
