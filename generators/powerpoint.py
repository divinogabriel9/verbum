"""
GFCC full Mass deck content with ExampleForVerbum.pptx visual system (fonts, positions, #050907).

1920×1080 landscape. Slide backgrounds and typography follow the parish Verbum template deck;
content still comes from GFCC markers, prayers, readings, and hymn library.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any, List, Mapping, Optional, Tuple

from pptx import Presentation
from pptx.dml.color import RGBColor
from pptx.enum.text import MSO_ANCHOR, MSO_AUTO_SIZE, PP_ALIGN
from pptx.util import Inches, Pt

from services.community_config import get_community_name, get_logo_path
from services.hymn_library import get_hymn
from services.prayer_service import get_prayer

from . import gfcc_flow_content as GFCC

SLIDE_WIDTH = Inches(20)
SLIDE_HEIGHT = Inches(11.25)

MARGIN_SIDE = Inches(0.75)
MARGIN_TOP = Inches(0.5)

# --- ExampleForVerbum.pptx (measured from slide XML: slides 7, 9, 20, 23) ---
_EMU_PER_IN = 914400


def _verbum_inches(emu: int):
    return Inches(emu / _EMU_PER_IN)


# Logo + parish strip (same grpSp on dialogue / reading / hymn slides)
_VERBUM_LOGO_LEFT = _verbum_inches(472727)
_VERBUM_LOGO_TOP = _verbum_inches(284088)
_VERBUM_LOGO_W = _verbum_inches(544090)
_VERBUM_LOGO_H_MAX = _verbum_inches(538990)
_VERBUM_NAME_LEFT = _verbum_inches(1073111)
_VERBUM_NAME_TOP = _verbum_inches(293226)
_VERBUM_NAME_W = _verbum_inches(1233900)
_VERBUM_NAME_H = _verbum_inches(537900)
_VERBUM_BRAND_GROUP_BOTTOM = _verbum_inches(284088 + 547038)
_VERBUM_CONTENT_LEFT = _verbum_inches(1163709)
_VERBUM_CONTENT_W = _verbum_inches(16253615)


def _safe_content_lw() -> tuple[Any, Any]:
    return _VERBUM_CONTENT_LEFT, _VERBUM_CONTENT_W


_VERBUM_SECTION_TITLE_LEFT = _verbum_inches(2874744)
_VERBUM_SECTION_TITLE_TOP = _verbum_inches(21037)
_VERBUM_SECTION_TITLE_W = _verbum_inches(12538500)
_VERBUM_SECTION_TITLE_H = _verbum_inches(1123500)

_VERBUM_BG = RGBColor(5, 9, 7)
_VERBUM_GOLD = RGBColor(255, 184, 0)
_VERBUM_GOLD_SOFT = RGBColor(255, 222, 89)
_VERBUM_WHITE = RGBColor(255, 255, 255)
_VERBUM_READING_BODY = RGBColor(255, 248, 235)

_FONT_POPPINS = "Poppins"
_FONT_POPPINS_SEMIBOLD = "Poppins SemiBold"
_FONT_POPPINS_BLACK = "Poppins Black"
_FONT_LORA = "Lora"
_FONT_ALICE = "Alice"
_FONT_ALEGREYA_SC = "Alegreya Sans SC"

_MARKED_BODY_PT = 54
_MARKED_PRIEST_PT = 54
_DIRECTION_PT = 45
_COMMUNITY_NAME_PT = 12
_READING_HEAD_PT = 46
_READING_BODY_PT = 44
_LOTW_HERO_PT = 52

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

_MAX_CHARS_READING = 900
_MAX_MARKED_BODY = 2600
# Hymn / lyrics slides (ExampleForVerbum slide 23: #050907, Lora gold title, Poppins white body)
_LYRIC_CHUNK = 360
_LYRIC_TITLE_DISPLAY_PT = 73
_LYRIC_BODY_DISPLAY_PT = 69
_HYMN_BG = _VERBUM_BG
_HYMN_GOLD_TITLE = _VERBUM_GOLD
_HYMN_BODY_WHITE = _VERBUM_WHITE
_HYMN_BRAND_WHITE = _VERBUM_WHITE
_HYMN_FOOTER_MUTED = RGBColor(200, 200, 205)
_HYMN_TITLE_FONT = _FONT_LORA
_HYMN_BODY_FONT = _FONT_POPPINS
_BRAND_BAND = Inches(1.05)
_LOGO_MAX_W = Inches(0.95)
_LOGO_MAX_H = Inches(0.42)
_COMMUNITY_HEADER_PT = _COMMUNITY_NAME_PT

_PROJECT_ROOT = Path(__file__).resolve().parents[1]
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


def _hex_to_rgb(value: Any) -> Optional[RGBColor]:
    text = str(value or "").strip().lstrip("#")
    if len(text) != 6:
        return None
    try:
        return RGBColor(int(text[0:2], 16), int(text[2:4], 16), int(text[4:6], 16))
    except ValueError:
        return None


def _build_slide_theme(
    liturgical_color: Optional[Mapping[str, Any]],
    custom_theme: Optional[Mapping[str, Any]] = None,
) -> SlideTheme:
    """
    Deck colors/fonts. Optional ``custom_theme`` hex overrides; otherwise the deck matches
    ExampleForVerbum.pptx dark slides (#050907, gold/white, Poppins family).
    """
    del liturgical_color  # mass deck follows Verbum template visuals, not liturgical fill
    if custom_theme:
        bg = _hex_to_rgb(custom_theme.get("bg"))
        primary = _hex_to_rgb(custom_theme.get("text")) or _hex_to_rgb(custom_theme.get("primary"))
        emphasis = _hex_to_rgb(custom_theme.get("primary")) or _hex_to_rgb(custom_theme.get("accent"))
        muted = _hex_to_rgb(custom_theme.get("accent"))
        if bg and primary and emphasis and muted:
            font_name = str(custom_theme.get("font") or _FONT_POPPINS).split(",")[0].strip() or _FONT_POPPINS
            return SlideTheme(bg=bg, primary=primary, muted=muted, emphasis=emphasis, font_name=font_name)

    return SlideTheme(
        bg=_VERBUM_BG,
        primary=_VERBUM_WHITE,
        muted=_VERBUM_GOLD_SOFT,
        emphasis=_VERBUM_GOLD,
        font_name=_FONT_POPPINS,
    )


def _accent(liturgical_color: Optional[Mapping[str, Any]]) -> RGBColor:
    """Backward-compatible single accent RGB (emphasis tone for callers that only need one color)."""
    return _build_slide_theme(liturgical_color).emphasis


def _content_top():
    """Vertical start for slide body text (below Verbum logo + parish name strip)."""
    return _VERBUM_BRAND_GROUP_BOTTOM + Inches(0.1)


def _apply_slide_branding(slide, theme: SlideTheme) -> None:
    """Logo + parish name (ExampleForVerbum grpSp positions on slide)."""
    logo = get_logo_path()
    name = get_community_name()
    if logo and logo.is_file():
        pic = slide.shapes.add_picture(str(logo), _VERBUM_LOGO_LEFT, _VERBUM_LOGO_TOP, width=_VERBUM_LOGO_W)
        if pic.height > _VERBUM_LOGO_H_MAX:
            scale = _VERBUM_LOGO_H_MAX / pic.height
            pic.width = int(pic.width * scale)
            pic.height = int(pic.height * scale)

    nb = slide.shapes.add_textbox(_VERBUM_NAME_LEFT, _VERBUM_NAME_TOP, _VERBUM_NAME_W, _VERBUM_NAME_H)
    tf = nb.text_frame
    _prep_tf(tf)
    tf.clear()
    tf.word_wrap = True
    tf.vertical_anchor = MSO_ANCHOR.MIDDLE
    p0 = tf.paragraphs[0]
    p0.text = name
    _style_para(p0, size_pt=_COMMUNITY_NAME_PT, color=theme.primary, bold=False, font_name=_FONT_POPPINS)
    p0.alignment = PP_ALIGN.LEFT


def _apply_hymn_branding(slide, theme: SlideTheme) -> None:
    """Same parish strip as dialogue slides (Verbum hymn slides use #050907, not black)."""
    _apply_slide_branding(slide, theme)


def _add_hymn_footer(slide, footer_section: str) -> None:
    lx = MARGIN_SIDE
    w = SLIDE_WIDTH - 2 * MARGIN_SIDE
    y = SLIDE_HEIGHT - Inches(0.95)
    foot = slide.shapes.add_textbox(lx, y, w, Inches(0.85))
    tf = foot.text_frame
    _prep_tf(tf)
    tf.clear()
    p0 = tf.paragraphs[0]
    p0.text = get_community_name()
    _style_para(p0, size_pt=_FOOTER_PT, color=_HYMN_FOOTER_MUTED, bold=True, font_name=_FONT_POPPINS)
    p1 = tf.add_paragraph()
    p1.text = footer_section
    _style_para(p1, size_pt=_FOOTER_PT - 1, color=_HYMN_GOLD_TITLE, bold=False, font_name=_FONT_POPPINS)
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
    """Text frame insets (Verbum txBody: zero margins, square wrap)."""
    tf.word_wrap = True
    tf.auto_size = MSO_AUTO_SIZE.NONE
    tf.margin_left = Inches(0)
    tf.margin_right = Inches(0)
    tf.margin_top = Inches(0)
    tf.margin_bottom = Inches(0)


def _style_para(p, *, size_pt, color, bold=False, italic=False, font_name=None):
    p.font.name = font_name or _ACTIVE_FONT
    p.font.size = Pt(size_pt)
    p.font.bold = bold
    p.font.italic = italic
    p.font.color.rgb = color


def _style_run(run, *, size_pt, color, bold=False, italic=False, font_name=None):
    run.font.name = font_name or _ACTIVE_FONT
    run.font.size = Pt(size_pt)
    run.font.bold = bold
    run.font.italic = italic
    run.font.color.rgb = color


def _marked_line_spacing(p) -> None:
    p.line_spacing = 1.4


def _add_community_footer(slide, footer_section: str, theme: SlideTheme):
    lx = MARGIN_SIDE
    w = SLIDE_WIDTH - 2 * MARGIN_SIDE
    y = SLIDE_HEIGHT - Inches(0.95)
    foot = slide.shapes.add_textbox(lx, y, w, Inches(0.85))
    tf = foot.text_frame
    _prep_tf(tf)
    tf.clear()
    p0 = tf.paragraphs[0]
    p0.text = get_community_name()
    _style_para(p0, size_pt=_FOOTER_PT, color=theme.primary, bold=True, font_name=_FONT_POPPINS)
    p1 = tf.add_paragraph()
    p1.text = footer_section
    _style_para(p1, size_pt=_FOOTER_PT - 1, color=theme.emphasis, bold=False, font_name=_FONT_POPPINS)
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


def _add_marked_slide(prs: Presentation, footer_section: str, marked_text: str, theme: SlideTheme) -> None:
    slide = prs.slides.add_slide(_layout_blank(prs))
    _set_slide_bg(slide, theme.bg)
    _apply_slide_branding(slide, theme)
    lx, w = _safe_content_lw()
    top = _content_top()
    body_h = SLIDE_HEIGHT - top - Inches(1.05)

    box = slide.shapes.add_textbox(lx, top, w, body_h)
    tf = box.text_frame
    _prep_tf(tf)
    tf.clear()
    first = True
    for role, line in _parse_marked_lines(marked_text):
        p = tf.paragraphs[0] if first else tf.add_paragraph()
        first = False
        p.clear()
        if role == "priest":
            r1 = p.add_run()
            r1.text = "Priest"
            _style_run(r1, size_pt=_MARKED_PRIEST_PT, color=_VERBUM_GOLD, bold=True, font_name=_FONT_POPPINS_SEMIBOLD)
            r2 = p.add_run()
            r2.text = f": {line}"
            _style_run(r2, size_pt=_MARKED_PRIEST_PT, color=_VERBUM_WHITE, bold=True, font_name=_FONT_POPPINS_SEMIBOLD)
            p.space_before = Pt(6)
            p.alignment = PP_ALIGN.LEFT
        elif role == "all":
            r1 = p.add_run()
            r1.text = f"ALL: {line}"
            _style_run(r1, size_pt=_MARKED_BODY_PT, color=_VERBUM_WHITE, bold=True, font_name=_FONT_POPPINS_BLACK)
            p.space_before = Pt(6)
            p.alignment = PP_ALIGN.LEFT
        elif role == "direction":
            p.text = line
            _style_para(
                p,
                size_pt=_DIRECTION_PT,
                color=_VERBUM_GOLD_SOFT,
                bold=False,
                italic=True,
                font_name=_FONT_LORA,
            )
            p.alignment = PP_ALIGN.JUSTIFY
        elif role == "hymn":
            p.text = line
            _style_para(p, size_pt=_MARKED_BODY_PT, color=_VERBUM_WHITE, bold=True, font_name=_FONT_POPPINS)
            p.alignment = PP_ALIGN.LEFT
        else:
            p.text = line
            _style_para(p, size_pt=_MARKED_BODY_PT, color=_VERBUM_WHITE, bold=True, font_name=_FONT_POPPINS_SEMIBOLD)
            p.alignment = PP_ALIGN.LEFT
        _marked_line_spacing(p)
        p.space_after = Pt(8)

    tf.auto_size = MSO_AUTO_SIZE.TEXT_TO_FIT_SHAPE

    _add_community_footer(slide, footer_section, theme)


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
    chunks = _chunk_marked_body(marked)
    for i, ch in enumerate(chunks):
        foot = footer if len(chunks) == 1 else f"{footer} ({i + 1}/{len(chunks)})"
        _add_marked_slide(prs, foot, ch, theme)


def _add_section_card(prs: Presentation, big_lines: str, footer_section: str, theme: SlideTheme) -> None:
    slide = prs.slides.add_slide(_layout_blank(prs))
    _set_slide_bg(slide, theme.bg)
    _apply_slide_branding(slide, theme)
    lx, w = _safe_content_lw()
    top = _content_top() + Inches(0.35)
    box = slide.shapes.add_textbox(lx, top, w, Inches(4.8))
    tf = box.text_frame
    _prep_tf(tf)
    tf.clear()
    p = tf.paragraphs[0]
    p.text = big_lines
    _style_para(p, size_pt=56, color=_VERBUM_WHITE, bold=True, font_name=_FONT_ALEGREYA_SC)
    p.alignment = PP_ALIGN.CENTER
    _marked_line_spacing(p)
    tf.auto_size = MSO_AUTO_SIZE.TEXT_TO_FIT_SHAPE
    _add_community_footer(slide, footer_section, theme)


def _chunk_long_plain_segment(text: str, limit: int) -> List[str]:
    """Split one lyric segment across slides (line / word aware)."""
    t = (text or "").strip()
    if not t:
        return []
    if len(t) <= limit:
        return [t]
    out: List[str] = []
    i, n = 0, len(t)
    while i < n:
        j = min(i + limit, n)
        if j < n:
            k = t.rfind("\n", i + 1, j)
            if k <= i:
                k = t.rfind(" ", i + 1, j)
            if k > i:
                j = k
        part = t[i:j].strip()
        if part:
            out.append(part)
        i = j
        while i < n and t[i].isspace():
            i += 1
    return out if out else [t[:limit]]


def _chunk_lyrics_display(text: str, limit: int = _LYRIC_CHUNK) -> List[str]:
    """Prefer stanza boundaries (blank lines), then size limits within each stanza."""
    cleaned = (text or "").strip()
    t = cleaned.strip() or "(No lyrics in library for this selection.)"
    stanzas = [s.strip() for s in re.split(r"\n\s*\n+", t) if s.strip()]
    if len(stanzas) <= 1:
        return _chunk_long_plain_segment(t, limit)
    chunks: List[str] = []
    for stanza in stanzas:
        if len(stanza) <= limit:
            chunks.append(stanza)
        else:
            chunks.extend(_chunk_long_plain_segment(stanza, limit))
    return chunks if chunks else [t[:limit]]


def _fill_hymn_body_caps(tf, chunk: str) -> None:
    """Verbum hymn body: centered Poppins bold white (ExampleForVerbum slide 23), preserve casing."""
    lines = [ln.strip() for ln in chunk.split("\n") if ln.strip()]
    longest = max((len(ln) for ln in lines), default=0)
    line_count = len(lines)
    size_pt = _LYRIC_BODY_DISPLAY_PT
    if line_count >= 8 or longest >= 40:
        size_pt = 56
    if line_count >= 10 or longest >= 48:
        size_pt = 50
    if line_count >= 12 or longest >= 56:
        size_pt = 44
    if line_count >= 14 or longest >= 64:
        size_pt = 38

    tf.clear()
    first = True
    for raw in lines:
        p = tf.paragraphs[0] if first else tf.add_paragraph()
        first = False
        p.text = raw
        _style_para(
            p,
            size_pt=size_pt,
            color=_HYMN_BODY_WHITE,
            bold=True,
            font_name=_HYMN_BODY_FONT,
        )
        p.alignment = PP_ALIGN.CENTER
        p.space_after = Pt(10 if size_pt >= 38 else 8)
        p.line_spacing = 1.4
    if first:
        p = tf.paragraphs[0]
        p.text = (chunk or "").strip()
        _style_para(
            p,
            size_pt=size_pt,
            color=_HYMN_BODY_WHITE,
            bold=True,
            font_name=_HYMN_BODY_FONT,
        )
        p.alignment = PP_ALIGN.CENTER
        p.line_spacing = 1.4


def _add_hymn_lyric_slides(
    prs: Presentation,
    footer_section: str,
    hymn_title: str,
    lyrics: str,
    theme: SlideTheme,
) -> None:
    """
    Verbum hymn slides (#050907): gold Lora title; lyrics in bold white Poppins, centered (slide 23).
    """
    title = (hymn_title or "Hymn").strip()
    raw_lyrics = (lyrics or "").strip() or "(No lyrics in library for this hymn.)"
    chunks = _chunk_lyrics_display(raw_lyrics)
    if not chunks:
        chunks = [raw_lyrics]

    first_chunk = chunks[0]
    rest_chunks = chunks[1:]

    w = SLIDE_WIDTH - 2 * MARGIN_SIDE
    lx_body = MARGIN_SIDE

    slide0 = prs.slides.add_slide(_layout_blank(prs))
    _set_slide_bg(slide0, theme.bg)
    _apply_hymn_branding(slide0, theme)

    title_top = _content_top()
    title_box = slide0.shapes.add_textbox(lx_body, title_top, w, Inches(1.05))
    tft = title_box.text_frame
    _prep_tf(tft)
    tft.clear()
    pt = tft.paragraphs[0]
    pt.text = title
    _style_para(
        pt,
        size_pt=_LYRIC_TITLE_DISPLAY_PT,
        color=_HYMN_GOLD_TITLE,
        bold=False,
        font_name=_HYMN_TITLE_FONT,
    )
    pt.alignment = PP_ALIGN.CENTER
    _marked_line_spacing(pt)

    body_top = title_top + Inches(1.15)
    body_h = SLIDE_HEIGHT - body_top - Inches(0.95)
    body_box = slide0.shapes.add_textbox(lx_body, body_top, w, body_h)
    tfb = body_box.text_frame
    _prep_tf(tfb)
    tfb.word_wrap = True
    tfb.vertical_anchor = MSO_ANCHOR.MIDDLE
    _fill_hymn_body_caps(tfb, first_chunk)
    tfb.auto_size = MSO_AUTO_SIZE.TEXT_TO_FIT_SHAPE
    _add_hymn_footer(slide0, footer_section)

    for chunk in rest_chunks:
        slide = prs.slides.add_slide(_layout_blank(prs))
        _set_slide_bg(slide, theme.bg)
        _apply_hymn_branding(slide, theme)
        body_h2 = SLIDE_HEIGHT - _content_top() - Inches(0.95)
        bx = slide.shapes.add_textbox(lx_body, _content_top(), w, body_h2)
        tf = bx.text_frame
        _prep_tf(tf)
        tf.word_wrap = True
        tf.vertical_anchor = MSO_ANCHOR.MIDDLE
        _fill_hymn_body_caps(tf, chunk)
        tf.auto_size = MSO_AUTO_SIZE.TEXT_TO_FIT_SHAPE
        _add_hymn_footer(slide, footer_section)


def _try_library_hymn(prs: Presentation, section: str, hymn_id: str, footer: str, theme: SlideTheme) -> bool:
    h = get_hymn(section, hymn_id)
    if not h:
        return False
    title = str(h.get("title") or "Hymn")
    lyrics = str(h.get("lyrics") or "")
    _add_hymn_lyric_slides(prs, footer, title, lyrics, theme)
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


def _fill_multipara(
    tf,
    text: str,
    *,
    size_pt: int,
    color: RGBColor,
    font_name: Optional[str] = None,
    italic: bool = False,
):
    tf.clear()
    raw = (text or "").strip()
    parts = [b.strip() for b in raw.split("\n\n") if b.strip()] or ([raw] if raw else [""])
    first = True
    for block in parts:
        p = tf.paragraphs[0] if first else tf.add_paragraph()
        first = False
        p.text = block
        _style_para(p, size_pt=size_pt, color=color, bold=False, italic=italic, font_name=font_name)
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
    main_text = (body or "").strip()

    def one_slide(head: str, sub: str, main: str) -> None:
        slide = prs.slides.add_slide(_layout_blank(prs))
        _set_slide_bg(slide, theme.bg)
        _apply_slide_branding(slide, theme)
        lx, w = _safe_content_lw()
        cur_top = _content_top() + Inches(0.06)

        if lotw_banner:
            hero_h = Inches(1.2)
            hero = slide.shapes.add_textbox(lx, cur_top, w, hero_h)
            htf = hero.text_frame
            _prep_tf(htf)
            htf.clear()
            hp = htf.paragraphs[0]
            hp.text = "Liturgy of the Word"
            _style_para(
                hp,
                size_pt=_LOTW_HERO_PT,
                color=_VERBUM_WHITE,
                bold=True,
                font_name=_FONT_ALEGREYA_SC,
            )
            hp.alignment = PP_ALIGN.CENTER
            _marked_line_spacing(hp)
            cur_top += hero_h + Inches(0.08)

        title_h = Inches(0.88)
        title_box = slide.shapes.add_textbox(lx, cur_top, w, title_h)
        tf_t = title_box.text_frame
        _prep_tf(tf_t)
        tf_t.clear()
        p0 = tf_t.paragraphs[0]
        if lotw_banner:
            p0.text = head if "continued" in head.lower() else f"{section} ({ref})"
        else:
            p0.text = head
        _style_para(p0, size_pt=_READING_HEAD_PT, color=_VERBUM_GOLD, bold=True, font_name=_FONT_POPPINS)
        p0.alignment = PP_ALIGN.CENTER
        cur_top += title_h + Inches(0.06)

        sub_h = Inches(0.52)
        sub_box = slide.shapes.add_textbox(lx, cur_top, w, sub_h)
        _prep_tf(sub_box.text_frame)
        sub_box.text_frame.clear()
        sp = sub_box.text_frame.paragraphs[0]
        sp.text = sub
        _style_para(sp, size_pt=22, color=_VERBUM_WHITE, bold=False, font_name=_FONT_POPPINS)
        sp.alignment = PP_ALIGN.CENTER
        cur_top += sub_h + Inches(0.12)

        body_h = SLIDE_HEIGHT - cur_top - Inches(1.0)
        bsh = slide.shapes.add_textbox(lx, cur_top, w, body_h)
        _prep_tf(bsh.text_frame)
        main_stripped = (main or "").strip()
        if not main_stripped:
            bsh.text_frame.clear()
            pz = bsh.text_frame.paragraphs[0]
            pz.text = "\u00a0"
            _style_para(
                pz,
                size_pt=_READING_BODY_PT,
                color=_VERBUM_READING_BODY,
                bold=False,
                italic=True,
                font_name=_FONT_ALICE,
            )
            pz.alignment = PP_ALIGN.CENTER
        else:
            _fill_multipara(
                bsh.text_frame,
                main_stripped,
                size_pt=_READING_BODY_PT,
                color=_VERBUM_READING_BODY,
                font_name=_FONT_ALICE,
                italic=True,
            )
            for para in bsh.text_frame.paragraphs:
                para.alignment = PP_ALIGN.CENTER
                _marked_line_spacing(para)
        bsh.text_frame.auto_size = MSO_AUTO_SIZE.TEXT_TO_FIT_SHAPE
        _add_community_footer(slide, footer_tag, theme)

    if not main_text:
        one_slide(section, ref, unavailable_note)
        return
    chunks = chunk_plain_text(main_text)
    total = len(chunks)
    for i, chunk in enumerate(chunks):
        head = section if i == 0 else f"{section} (continued)"
        if lotw_banner:
            sub = "" if total <= 1 else f"Slide {i + 1} of {total}"
        else:
            sub = ref if total <= 1 else f"{ref}  ·  slide {i + 1} of {total}"
        one_slide(head, sub, chunk)


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
    lx, w = _safe_content_lw()
    y = _content_top() + Inches(0.12)

    tb = slide.shapes.add_textbox(lx, y, w, Inches(1.15))
    tft = tb.text_frame
    _prep_tf(tft)
    tft.clear()
    p0 = tft.paragraphs[0]
    p0.text = title or "Mass"
    _style_para(p0, size_pt=44, color=theme.emphasis, bold=False, font_name=_FONT_LORA)
    p0.alignment = PP_ALIGN.CENTER
    _marked_line_spacing(p0)
    tft.auto_size = MSO_AUTO_SIZE.TEXT_TO_FIT_SHAPE

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
    if liturgical_color:
        meta += f"\n\nLiturgical color: {liturgical_color.get('color_name', '')} ({liturgical_color.get('season', '')})"

    mb = slide.shapes.add_textbox(lx, y + Inches(1.22), w, Inches(3.55))
    _prep_tf(mb.text_frame)
    _fill_multipara(mb.text_frame, meta, size_pt=_GREET_PT, color=theme.primary, font_name=_FONT_POPPINS)
    for para in mb.text_frame.paragraphs:
        para.alignment = PP_ALIGN.CENTER
    mb.text_frame.auto_size = MSO_AUTO_SIZE.TEXT_TO_FIT_SHAPE

    if quote_attribution and g_line:
        nb = slide.shapes.add_textbox(lx, SLIDE_HEIGHT - Inches(1.2), w, Inches(0.75))
        _prep_tf(nb.text_frame)
        _fill_multipara(
            nb.text_frame,
            str(quote_attribution),
            size_pt=_META_PT,
            color=theme.muted,
            font_name=_FONT_POPPINS,
            italic=True,
        )

    _add_community_footer(slide, "Title", theme)


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
    user_divider_png_paths: Optional[list[Path]] = None,
    mass_collection_amount: str = "",
    mass_collection_for_date: str = "",
    food_sponsors: Optional[list[str]] = None,
    announcement_png_paths: Optional[list[Path]] = None,
) -> tuple[int, Path]:
    global _ACTIVE_FONT
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

    sel = song_selections or {}

    # --- Pre-Mass (GFCC PDF p.1 style) ---
    _add_marked_slide(prs, "Pre-Mass", GFCC.SILENT_REMINDER, theme)

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

    _add_marked_slide(
        prs,
        "Intro",
        "<<D>>Welcome to the celebration of the Holy Eucharist.\n"
        "<<D>>Please stand and join in singing the Entrance hymn.",
        theme,
    )

    ent_id = str(sel.get("entrance") or "").strip()
    if not ent_id or not _try_library_hymn(prs, "entrance", ent_id, "Entrance", theme):
        _add_marked_slide(
            prs,
            "Entrance",
            "<<D>>No Entrance hymn lyrics were selected. Choose one Entrance song in Mass Flow or save lyrics in Lyrics Studio before generating.",
            theme,
        )
    for extra in user_divider_png_paths or []:
        pp = Path(extra)
        if pp.is_file():
            _add_liturgical_poster_full_slide(prs, pp)

    # --- Introductory Rites ---
    _add_marked_slide(prs, "Introductory Rites", GFCC.SIGN_CROSS, theme)
    _add_marked_chunked(prs, "Penitential Act", get_prayer("penitential_act"), theme)
    _add_marked_slide(prs, "Kyrie Eleison", GFCC.KYRIE, theme)
    _add_marked_chunked(prs, "Gloria", get_prayer("gloria"), theme)
    _add_marked_slide(prs, "Liturgy of the Word", GFCC.OPENING_PRAYER, theme)

    # --- Liturgy of the Word ---
    _add_section_card(prs, "LITURGY OF\nTHE WORD", "Liturgy of the Word", theme)

    _add_reading_block(
        prs,
        section="First Reading",
        reference=first_reading_ref or "—",
        body=(first_reading_text or "").strip(),
        unavailable_note=unavail,
        lotw_banner=True,
        footer_tag="Liturgy of the Word",
        theme=theme,
    )
    _add_reading_block(
        prs,
        section="Responsorial Psalm",
        reference=psalm_ref or "—",
        body=(psalm_text or "").strip(),
        unavailable_note=unavail,
        lotw_banner=True,
        footer_tag="Liturgy of the Word",
        theme=theme,
    )
    if (second_reading_ref or "").strip():
        _add_reading_block(
            prs,
            section="Second Reading",
            reference=second_reading_ref.strip(),
            body=(second_reading_text or "").strip(),
            unavailable_note=unavail,
            lotw_banner=True,
            footer_tag="Liturgy of the Word",
            theme=theme,
        )

    _add_marked_slide(prs, "Gospel Acclamation", GFCC.ALLELUIA_SING, theme)
    _add_marked_slide(prs, "Gospel Acclamation", GFCC.ALLELUIA_COMMENTATOR, theme)
    _add_marked_slide(prs, "Gospel", GFCC.GOSPEL_INTRO, theme)
    _add_reading_block(
        prs,
        section="Gospel",
        reference=gospel_reference or "—",
        body=(gospel_full_text or "").strip(),
        unavailable_note=unavail,
        lotw_banner=True,
        footer_tag="Liturgy of the Word",
        theme=theme,
    )
    _add_marked_slide(prs, "Gospel", GFCC.GOSPEL_END, theme)

    _add_marked_slide(
        prs,
        "Homily",
        "<<D>>Time for the homily — Father will now preach.\n<<D>>Commentator may introduce the theme.",
        theme,
    )
    # --- Creed ---
    _add_marked_chunked(prs, "Nicene Creed", get_prayer("nicene_creed"), theme)
    # --- Prayer of the Faithful ---
    _add_marked_slide(prs, "Prayer of the Faithful", GFCC.PRAYER_FAITHFUL_1, theme)
    _add_marked_slide(prs, "Prayer of the Faithful", GFCC.PRAYER_FAITHFUL_2, theme)
    # --- Liturgy of the Eucharist ---
    off_id = str(sel.get("offertory") or "").strip()
    if not off_id or not _try_library_hymn(prs, "offertory", off_id, "Offertory", theme):
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
    _add_marked_slide(prs, "The Communion Rite", GFCC.COMMUNION_RITE_DELIVER, theme)
    _add_marked_slide(prs, "Sign of Peace", GFCC.SIGN_PEACE, theme)
    _add_marked_slide(prs, "Lamb of God", get_prayer("lamb_of_god"), theme)
    _add_marked_slide(prs, "The Communion Rite", GFCC.COMMUNION_DIALOGUE, theme)
    c1 = str(sel.get("communion_1") or "").strip()
    c2 = str(sel.get("communion_2") or "").strip()
    comm_ok = False
    if c1 and _try_library_hymn(prs, "communion", c1, "Communion (1)", theme):
        comm_ok = True
    if c2 and _try_library_hymn(prs, "communion", c2, "Communion (2)", theme):
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
        _try_library_hymn(prs, "meditation", med_id, "Meditation", theme)
    _add_marked_slide(prs, "The Communion Rite", GFCC.POST_COMMUNION, theme)
    # --- Announcements ---
    _add_marked_slide(prs, "Announcements", GFCC.ANNOUNCEMENTS_TITLE, theme)
    _add_marked_slide(prs, "Announcements", GFCC.WELCOME_NEWCOMERS, theme)
    _add_marked_slide(prs, "Announcements", GFCC.CONFESSION_SLIDE, theme)

    coll_lines: list[str] = []
    if (mass_collection_amount or "").strip():
        coll_lines.append(f"<<D>>Amount: {(mass_collection_amount or '').strip()}")
    if (mass_collection_for_date or "").strip():
        coll_lines.append(f"<<D>>For: {(mass_collection_for_date or '').strip()}")
    if coll_lines:
        _add_marked_slide(prs, "Announcements", "<<H>>Mass Collection\n" + "\n".join(coll_lines), theme)
    else:
        _add_marked_slide(prs, "Announcements", GFCC.COLLECTION_PLACEHOLDER, theme)

    sponsors = [str(x).strip() for x in (food_sponsors or []) if str(x).strip()]
    if sponsors:
        sp_body = "\n".join(f"<<D>>{name}" for name in sponsors)
        _add_marked_slide(prs, "Announcements", "<<H>>Food Sponsors\n" + sp_body, theme)
    else:
        _add_marked_slide(prs, "Announcements", GFCC.SPONSORSHIP, theme)

    _add_marked_slide(prs, "Announcements", GFCC.FB_UPDATES, theme)

    for ap in announcement_png_paths or []:
        p = Path(ap)
        if p.is_file():
            _add_liturgical_poster_full_slide(prs, p)

    _add_marked_slide(prs, "Final Blessing", GFCC.FINAL_BLESSING, theme)
    rec_id = str(sel.get("recessional") or "").strip()
    if not rec_id or not _try_library_hymn(prs, "recessional", rec_id, "Recessional", theme):
        _add_marked_slide(
            prs,
            "Recessional",
            "<<D>>No Recessional hymn lyrics were selected. Choose one Recessional song in Mass Flow or save lyrics in Lyrics Studio before generating.",
            theme,
        )
    # Full-screen 16×9 parish poster (generated before the deck — see pipeline order).
    if liturgical_poster_png is not None:
        _add_liturgical_poster_full_slide(prs, liturgical_poster_png)

    if quote_attribution and g_line:
        _add_marked_slide(prs, "Scripture note", f"<<D>>{quote_attribution}", theme)

    _OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    stem = (output_stem or "mass_presentation").strip() or "mass_presentation"
    out = _OUTPUT_DIR / f"{stem}.pptx"
    n_slides = len(prs.slides)
    prs.save(out)
    print(f"✅ PowerPoint created: {out} ({n_slides} slides)")
    return n_slides, out
