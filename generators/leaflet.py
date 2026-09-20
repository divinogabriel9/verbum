"""A4 landscape Mass leaflet — 4 columns per side, one sheet only (front + back).

Physical layout (each side of the paper):

  ┌────┬────┬────┬────┐
  │ 1  │ 2  │ 3  │ 4  │
  └────┴────┴────┴────┘

Half-fold on the vertical centre: each folded face has two columns
side by side. Always exactly one A4 sheet (front + back = 8 columns).
Text is auto-scaled so content fits.

Content follows Mass order (same flow as the PowerPoint).
"""

from __future__ import annotations

import logging
import re
from datetime import datetime
from pathlib import Path
from typing import Any, Mapping, Optional, Sequence

from reportlab.lib.colors import Color, HexColor
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen.canvas import Canvas
from reportlab.platypus import Paragraph, Spacer, Table, TableStyle

logger = logging.getLogger(__name__)

# Set by _register_fonts(); used so <b> markup always picks a real bold face.
_ACTIVE_BOLD = "Times-Bold"
_ACTIVE_ITALIC = "Times-Italic"

PAGE_W, PAGE_H = landscape(A4)
COLS, ROWS = 4, 1
CELLS_PER_SIDE = COLS * ROWS  # 4
CELLS_PER_SHEET = CELLS_PER_SIDE * 2  # 8 — hard max (front + back of one A4)
MAX_PDF_PAGES = 2  # front + back only

CELL_W = PAGE_W / COLS
CELL_H = PAGE_H / ROWS
# Small breathing room from page edge / between columns — no framed boxes.
MARGIN = 3.0 * mm
GUTTER = 2.0 * mm
FOOTER_H = 2.5 * mm
CONTENT_W = CELL_W - 2 * MARGIN - GUTTER / 2
CONTENT_H = CELL_H - 2 * MARGIN - FOOTER_H

_CREAM = HexColor("#F7F3EA")
_INK = HexColor("#1C1916")
_MUTED = HexColor("#5C564E")
_DEFAULT_ACCENT = HexColor("#6B2D3C")

_WS = re.compile(r"\s+")
_FLOW_MARK = re.compile(r"<<([A-Z]+)>>")
_MULTI_NL = re.compile(r"\n{3,}")
_BLANK_LINES = re.compile(r"\n\s*\n+")
_LYRIC_SECTION = re.compile(
    r"^(?P<label>"
    r"Chorus|Refrain|Bridge|Pre-?Chorus|Outro|Ending|Coda|"
    r"Verse\s*\d*|V\.?\s*\d+"
    r")\s*:?\s*$",
    re.IGNORECASE,
)


def _hex_color(raw: str | None, fallback: Color = _DEFAULT_ACCENT) -> Color:
    s = (raw or "").strip()
    if not s:
        return fallback
    if not s.startswith("#"):
        s = "#" + s
    try:
        return HexColor(s)
    except Exception:
        return fallback


def _esc(text: str) -> str:
    return (
        (text or "")
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
    )


def _clean_space(text: str) -> str:
    return _WS.sub(" ", (text or "").replace("\u00a0", " ")).strip()


def _pretty_season(season: str) -> str:
    s = _clean_space(season)
    if not s:
        return ""
    return s.replace("_", " ").strip().title()


def _clip(text: str, max_chars: int) -> str:
    t = (text or "").strip()
    if max_chars <= 0 or len(t) <= max_chars:
        return t
    cut = t[: max_chars - 1].rsplit(" ", 1)[0]
    return (cut or t[: max_chars - 1]).rstrip(".,;:") + "…"


def _norm_lyric_block(lines: Sequence[str]) -> str:
    return _WS.sub(" ", " ".join((ln or "").strip() for ln in lines if (ln or "").strip())).casefold()


def _section_kind(label: str) -> str:
    low = (label or "").strip().casefold()
    if low.startswith("refrain"):
        return "refrain"
    if "chorus" in low:
        return "chorus"
    return "other"


def _compact_repeating_lyrics(text: str) -> str:
    """
    Keep the first Chorus/Refrain in full; replace later repeats with
    italic markers like <i>(chorus)</i> / <i>(refrain)</i>.
    Also collapses unlabeled blocks that match a known chorus/refrain body.
    """
    raw = (text or "").replace("\r\n", "\n").replace("\r", "\n").strip()
    if not raw:
        return ""

    lines = raw.split("\n")
    segments: list[dict[str, Any]] = []
    label = ""
    kind = "other"
    body: list[str] = []

    def flush() -> None:
        nonlocal label, kind, body
        if not label and not any((ln or "").strip() for ln in body):
            body = []
            return
        # Drop leading/trailing blank lines inside the section body
        while body and not body[0].strip():
            body.pop(0)
        while body and not body[-1].strip():
            body.pop()
        segments.append({"label": label, "kind": kind, "lines": list(body)})
        label, kind, body = "", "other", []

    for line in lines:
        m = _LYRIC_SECTION.match(line.strip())
        if m:
            flush()
            label = m.group("label").strip()
            kind = _section_kind(label)
            body = []
        else:
            body.append(line)
    flush()

    # If no section headers, split on blank lines and detect duplicate blocks.
    if len(segments) == 1 and not segments[0]["label"]:
        paras = [p.strip() for p in _BLANK_LINES.split(raw) if p.strip()]
        if len(paras) >= 2:
            segments = [
                {"label": "", "kind": "other", "lines": p.split("\n")} for p in paras
            ]

    seen_chorus = ""
    seen_refrain = ""
    chorus_done = False
    refrain_done = False
    # Track unlabeled identical repeats (treat later copies as chorus cues)
    unlabeled_seen: dict[str, int] = {}
    out: list[str] = []

    def _emit_section(lab: str, body_lines: list[str]) -> None:
        chunk = ([lab] if lab else []) + body_lines
        if any((ln or "").strip() for ln in chunk):
            out.append(_esc("\n".join(chunk)).replace("\n", "<br/>"))

    for seg in segments:
        lines_s: list[str] = seg["lines"]
        norm = _norm_lyric_block(lines_s)
        sk = seg["kind"]
        lab = str(seg["label"] or "")

        if sk == "chorus":
            if chorus_done:
                out.append("<i>(chorus)</i>")
                continue
            if norm:
                seen_chorus = norm
            chorus_done = True
            _emit_section(lab, lines_s)
            continue

        if sk == "refrain":
            if refrain_done:
                out.append("<i>(refrain)</i>")
                continue
            if norm:
                seen_refrain = norm
            refrain_done = True
            _emit_section(lab, lines_s)
            continue

        # Unlabeled (or verse) block that repeats a known chorus/refrain body
        if norm and seen_chorus and norm == seen_chorus:
            out.append("<i>(chorus)</i>")
            continue
        if norm and seen_refrain and norm == seen_refrain:
            out.append("<i>(refrain)</i>")
            continue

        # Unlabeled stanza that repeats later in the song (no headers)
        if not lab and norm and len(norm) >= 40:
            count = unlabeled_seen.get(norm, 0)
            if count >= 1:
                out.append("<i>(chorus)</i>")
                unlabeled_seen[norm] = count + 1
                continue
            unlabeled_seen[norm] = 1

        _emit_section(lab, lines_s)

    return "<br/><br/>".join(out)


def _lyrics_html(text: str, *, max_chars: int = 0) -> str:
    """Compact repeats, optionally clip, return reportlab-safe HTML."""
    html = _compact_repeating_lyrics(text)
    if max_chars > 0 and len(html) > max_chars * 2:
        # Clip on plain text then re-compact for a cleaner cut
        plain = _clip(text, max_chars)
        html = _compact_repeating_lyrics(plain)
    return html


def _parse_role_chunks(text: str) -> list[tuple[str, str]]:
    """Split flow-marked text into (role, body) chunks. role: priest|all|plain."""
    raw = (text or "").replace("<<BR>>", "\n").strip()
    if not raw:
        return []
    if "<<P>>" not in raw and "<<A>>" not in raw and "<<H>>" not in raw and "<<D>>" not in raw:
        return [("plain", _MULTI_NL.sub("\n\n", raw).strip())]

    chunks: list[tuple[str, str]] = []
    parts = _FLOW_MARK.split(raw)
    if parts and parts[0].strip():
        chunks.append(("plain", parts[0].strip()))
    i = 1
    while i + 1 < len(parts):
        code = (parts[i] or "").upper()
        body = (parts[i + 1] or "").strip()
        i += 2
        if not body:
            continue
        if code == "P":
            chunks.append(("priest", body))
        elif code in ("A", "H"):
            chunks.append(("all", body))
        elif code == "D":
            continue
        else:
            chunks.append(("plain", body))
    return [(role, _MULTI_NL.sub("\n\n", body).strip()) for role, body in chunks if body]


def _chunk_to_html(role: str, body: str, *, bare: bool = False) -> str:
    # Collapse blank lines inside a chunk to save vertical space
    compact = _BLANK_LINES.sub("\n", body).strip()
    body_html = _esc(compact).replace("\n", "<br/>")
    if bare or role == "plain":
        return body_html
    if role == "priest":
        return f'<font name="{_ACTIVE_BOLD}"><b>P-</b></font> {body_html}'
    if role == "all":
        return f'<font name="{_ACTIVE_BOLD}"><b>All- {body_html}</b></font>'
    return body_html


def _to_para_html(text: str, *, as_all: bool = False, bare: bool = False) -> str:
    chunks = _parse_role_chunks(text)
    if not chunks:
        return ""
    if as_all and len(chunks) == 1 and chunks[0][0] == "plain":
        return _chunk_to_html("all", chunks[0][1], bare=bare)
    sep = "<br/>" if bare else "<br/><br/>"
    return sep.join(_chunk_to_html(role, body, bare=bare) for role, body in chunks)


def _kyrie_html(text: str) -> str:
    """Kyrie: no All: labels, no blank paragraph gaps."""
    chunks = _parse_role_chunks(text)
    lines: list[str] = []
    for _role, body in chunks:
        for line in _BLANK_LINES.sub("\n", body).split("\n"):
            s = line.strip()
            if s:
                lines.append(_esc(s))
    return "<br/>".join(lines)


def _dialogue_line(priest: str, assembly: str) -> str:
    return (
        f'<font name="{_ACTIVE_BOLD}"><b>P-</b></font> {_esc(priest)}'
        f'<br/><font name="{_ACTIVE_BOLD}"><b>All- {_esc(assembly)}</b></font>'
    )


def _register_fonts() -> tuple[str, str, str]:
    global _ACTIVE_BOLD, _ACTIVE_ITALIC
    candidates = [
        (
            "/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf",
            "/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf",
            "/usr/share/fonts/truetype/dejavu/DejaVuSerif-Italic.ttf",
            "/usr/share/fonts/truetype/dejavu/DejaVuSerif-BoldItalic.ttf",
        ),
        (
            "/System/Library/Fonts/Supplemental/Times New Roman.ttf",
            "/System/Library/Fonts/Supplemental/Times New Roman Bold.ttf",
            "/System/Library/Fonts/Supplemental/Times New Roman Italic.ttf",
            "/System/Library/Fonts/Supplemental/Times New Roman Bold Italic.ttf",
        ),
        (
            "/Library/Fonts/Times New Roman.ttf",
            "/Library/Fonts/Times New Roman Bold.ttf",
            "/Library/Fonts/Times New Roman Italic.ttf",
            "/Library/Fonts/Times New Roman Bold Italic.ttf",
        ),
    ]
    for regular, bold, italic, bold_italic in candidates:
        if Path(regular).is_file() and Path(bold).is_file():
            try:
                pdfmetrics.registerFont(TTFont("LeafletSerif", regular))
                pdfmetrics.registerFont(TTFont("LeafletSerif-Bold", bold))
                if Path(italic).is_file():
                    pdfmetrics.registerFont(TTFont("LeafletSerif-Italic", italic))
                    italic_name = "LeafletSerif-Italic"
                else:
                    italic_name = "LeafletSerif"
                if Path(bold_italic).is_file():
                    pdfmetrics.registerFont(TTFont("LeafletSerif-BoldItalic", bold_italic))
                    bi_name = "LeafletSerif-BoldItalic"
                else:
                    bi_name = "LeafletSerif-Bold"
                # Required so <b>/<i> in Paragraph HTML switch faces.
                pdfmetrics.registerFontFamily(
                    "LeafletSerif",
                    normal="LeafletSerif",
                    bold="LeafletSerif-Bold",
                    italic=italic_name,
                    boldItalic=bi_name,
                )
                _ACTIVE_BOLD = "LeafletSerif-Bold"
                _ACTIVE_ITALIC = italic_name
                return "LeafletSerif", "LeafletSerif-Bold", italic_name
            except Exception:
                logger.debug("Could not register font pair %s", regular, exc_info=True)
    _ACTIVE_BOLD = "Times-Bold"
    _ACTIVE_ITALIC = "Times-Italic"
    return "Times-Roman", "Times-Bold", "Times-Italic"


def _fit_cover_title_style(
    text: str,
    bold_font: str,
    *,
    scale: float,
    max_width: float,
    tag: str,
) -> ParagraphStyle:
    """Shrink the Mass title so ``Title (A)`` stays on one line in the column."""
    s = max(0.62, min(1.0, scale))
    target = 15.0 * s
    floor = 8.0 * s
    size = target
    while size > floor and pdfmetrics.stringWidth(text, bold_font, size) > max_width:
        size -= 0.2
    size = round(max(floor, size), 2)
    return ParagraphStyle(
        f"lf_ct_fit_{tag}_{int(size * 10)}",
        fontName=bold_font,
        fontSize=size,
        leading=round(size * 1.2, 2),
        textColor=_INK,
        alignment=TA_CENTER,
        spaceAfter=round(5 * s, 2),
    )


def _styles(
    body_font: str,
    bold_font: str,
    italic_font: str = "Times-Italic",
    *,
    scale: float = 1.0,
) -> dict[str, ParagraphStyle]:
    """Build styles; ``scale`` < 1 shrinks type to fit one sheet."""
    s = max(0.62, min(1.0, scale))
    tag = f"{int(round(s * 100)):03d}"

    def sz(n: float) -> float:
        return round(n * s, 2)

    return {
        "title": ParagraphStyle(
            f"lf_title_{tag}",
            fontName=bold_font,
            fontSize=sz(12),
            leading=sz(14.5),
            textColor=_INK,
            spaceAfter=sz(3.5),
            alignment=TA_JUSTIFY,
        ),
        "h": ParagraphStyle(
            f"lf_h_{tag}",
            fontName=bold_font,
            fontSize=sz(9.5),
            leading=sz(11.8),
            textColor=_INK,
            spaceBefore=sz(3.5),
            spaceAfter=sz(1.8),
            alignment=TA_JUSTIFY,
        ),
        "body": ParagraphStyle(
            f"lf_body_{tag}",
            fontName=body_font,
            fontSize=sz(9),
            leading=sz(11.2),
            textColor=_INK,
            spaceAfter=sz(2),
            alignment=TA_JUSTIFY,
        ),
        "lyric": ParagraphStyle(
            f"lf_lyric_{tag}",
            fontName=body_font,
            fontSize=sz(8.8),
            leading=sz(11),
            textColor=_INK,
            spaceAfter=sz(1.8),
            leftIndent=0,
            alignment=TA_JUSTIFY,
        ),
        "small": ParagraphStyle(
            f"lf_small_{tag}",
            fontName=body_font,
            fontSize=sz(7.5),
            leading=sz(9.4),
            textColor=_MUTED,
            spaceAfter=sz(1.5),
            alignment=TA_JUSTIFY,
        ),
        "response": ParagraphStyle(
            f"lf_response_{tag}",
            fontName=body_font,
            fontSize=sz(8.8),
            leading=sz(11),
            textColor=_INK,
            spaceAfter=sz(1.8),
            alignment=TA_JUSTIFY,
        ),
        "quote": ParagraphStyle(
            f"lf_quote_{tag}",
            fontName=italic_font,
            fontSize=sz(10.5),
            leading=sz(13.5),
            textColor=_INK,
            spaceBefore=sz(6),
            spaceAfter=sz(3),
            alignment=TA_CENTER,
        ),
        # Cover block — larger, centered
        "center_kicker": ParagraphStyle(
            f"lf_ck_{tag}",
            fontName=bold_font,
            fontSize=sz(11),
            leading=sz(13.5),
            textColor=_MUTED,
            alignment=TA_CENTER,
            spaceAfter=sz(4),
        ),
        "center_title": ParagraphStyle(
            f"lf_ct_{tag}",
            fontName=bold_font,
            fontSize=sz(15),
            leading=sz(18),
            textColor=_INK,
            alignment=TA_CENTER,
            spaceAfter=sz(5),
        ),
        "center_body": ParagraphStyle(
            f"lf_cb_{tag}",
            fontName=body_font,
            fontSize=sz(10),
            leading=sz(13),
            textColor=_MUTED,
            alignment=TA_CENTER,
            spaceAfter=sz(3),
        ),
    }


def _format_date(iso: str) -> str:
    raw = (iso or "").strip()
    try:
        return datetime.strptime(raw[:10], "%Y-%m-%d").strftime("%A, %d %B %Y")
    except ValueError:
        return raw


def _P(html: str, style: ParagraphStyle) -> Optional[Paragraph]:
    if not (html or "").strip():
        return None
    return Paragraph(html, style)


def _add(story: list[Any], item: Any) -> None:
    if item is not None:
        story.append(item)


def _heading(story: list[Any], styles: dict[str, ParagraphStyle], text: str) -> None:
    _add(story, _P(_esc(text), styles["h"]))


def _block(
    story: list[Any],
    styles: dict[str, ParagraphStyle],
    heading: str,
    body: str,
    *,
    lyric: bool = False,
    as_all: bool = False,
    kyrie: bool = False,
) -> None:
    if kyrie:
        html = _kyrie_html(body)
    else:
        html = _to_para_html(body, as_all=as_all)
    if not html and not heading:
        return
    if heading:
        _heading(story, styles, heading)
    if html:
        _add(story, _P(html, styles["lyric"] if lyric else styles["body"]))


def _prayer_bundle(
    *,
    mass_language: str,
    creed_choice: str,
    gloria_choice: str,
    our_father_choice: str,
) -> dict[str, str]:
    """Return prayer texts with <<P>>/<<A>>/<<H>> markers preserved for labeling."""
    lang = (mass_language or "english").strip().lower()
    if lang == "tagalog":
        from generators import gfcc_flow_content_tagalog as flow
    else:
        from generators import gfcc_flow_content as flow

    gloria = ""
    if (gloria_choice or "english").strip().lower() != "none":
        gloria = getattr(flow, "GLORIA_FULL", "") or ""

    creed = ""
    cc = (creed_choice or "nicene").strip().lower()
    if cc == "apostles":
        creed = (
            "<<A>>I believe in God, the Father almighty, Creator of heaven and earth, "
            "and in Jesus Christ, his only Son, our Lord, who was conceived by the Holy Spirit, "
            "born of the Virgin Mary, suffered under Pontius Pilate, was crucified, died and was buried; "
            "he descended into hell; on the third day he rose again from the dead; "
            "he ascended into heaven, and is seated at the right hand of God the Father almighty; "
            "from there he will come to judge the living and the dead.\n\n"
            "I believe in the Holy Spirit, the holy catholic Church, the communion of saints, "
            "the forgiveness of sins, the resurrection of the body, and life everlasting. Amen."
        )
    elif cc != "none":
        creed = "\n".join(
            [
                getattr(flow, "CREED_1", "") or "",
                getattr(flow, "CREED_2", "") or "",
                getattr(flow, "CREED_3", "") or "",
            ]
        )

    of_choice = (our_father_choice or "english").strip().lower()
    if of_choice == "korean":
        our_father = (getattr(flow, "OUR_FATHER_KO_1", "") or "") + "\n" + (
            getattr(flow, "OUR_FATHER_KO_2", "") or ""
        )
    else:
        our_father = getattr(flow, "OUR_FATHER_ENGLISH", "") or ""

    return {
        "sign_cross": getattr(flow, "SIGN_CROSS", "") or "",
        "confiteor": getattr(flow, "CONFITEOR_OPEN", "") or "",
        "kyrie": getattr(flow, "KYRIE", "") or "",
        "gloria": gloria,
        "pray_brethren": getattr(flow, "PRAY_BRETHREN", "") or "",
        "preface": getattr(flow, "PREFACE_DIALOGUE", "") or "",
        "sanctus": getattr(flow, "SANCTUS", "") or "",
        "mystery": getattr(flow, "MYSTERY_FAITH", "") or "",
        "our_father": our_father,
        "communion_deliver": getattr(flow, "COMMUNION_RITE_DELIVER", "") or "",
        "lamb": getattr(flow, "LAMB_OF_GOD", "") or "",
        "communion_dialog": getattr(flow, "COMMUNION_DIALOGUE", "") or "",
        "sign_peace": getattr(flow, "SIGN_PEACE", "") or "",
        "creed": creed,
    }


def _song_map(songs: Sequence[Mapping[str, str]]) -> dict[str, Mapping[str, str]]:
    """Index songs by label keyword for Mass-flow insertion."""
    out: dict[str, Mapping[str, str]] = {}
    for song in songs:
        label = _clean_space(str(song.get("label") or "")).lower()
        if "entrance" in label:
            out.setdefault("entrance", song)
        elif "offertor" in label:
            out.setdefault("offertory", song)
        elif "communion ii" in label or "communion 2" in label:
            out.setdefault("communion_2", song)
        elif "communion iii" in label or "communion 3" in label:
            out.setdefault("communion_3", song)
        elif "communion" in label:
            out.setdefault("communion_1", song)
        elif "meditation" in label:
            out.setdefault("meditation", song)
        elif "recessional" in label or "recess" in label:
            out.setdefault("recessional", song)
    return out


def _add_song(
    story: list[Any],
    styles: dict[str, ParagraphStyle],
    song: Optional[Mapping[str, str]],
    fallback_label: str,
    *,
    lyric_chars: int = 0,
    titles_only: bool = False,
) -> None:
    if not song:
        return
    title = _clean_space(str(song.get("title") or ""))
    lyrics = str(song.get("lyrics") or "").strip()
    label = _clean_space(str(song.get("label") or fallback_label))
    head = f"{label} — {title}" if title else label
    _heading(story, styles, head)
    if titles_only:
        return
    if not lyrics:
        _add(story, _P("(Lyrics not available.)", styles["lyric"]))
        return
    html = _lyrics_html(lyrics, max_chars=lyric_chars)
    if html:
        _add(story, _P(html, styles["lyric"]))


# Compact tiers for the one-sheet auto-fit pass.
# Higher tier = more aggressive truncation / omission.
_COMPACT_TIERS: list[dict[str, Any]] = [
    {
        "reading": 0,
        "psalm": 0,
        "gospel": 0,
        "lyric": 0,
        "prayer": 0,
        "titles_only": False,
        "drop_extra_songs": False,
        "drop_announcements": False,
        "drop_quote": False,
        "drop_dialogues": False,
        "max_notes": 8,
    },
    {
        "reading": 1400,
        "psalm": 900,
        "gospel": 1600,
        "lyric": 900,
        "prayer": 0,
        "titles_only": False,
        "drop_extra_songs": False,
        "drop_announcements": False,
        "drop_quote": False,
        "drop_dialogues": False,
        "max_notes": 4,
    },
    {
        "reading": 900,
        "psalm": 600,
        "gospel": 1000,
        "lyric": 500,
        "prayer": 700,
        "titles_only": False,
        "drop_extra_songs": True,
        "drop_announcements": False,
        "drop_quote": True,
        "drop_dialogues": False,
        "max_notes": 2,
    },
    {
        "reading": 550,
        "psalm": 400,
        "gospel": 650,
        "lyric": 0,
        "prayer": 450,
        "titles_only": True,
        "drop_extra_songs": True,
        "drop_announcements": True,
        "drop_quote": True,
        "drop_dialogues": True,
        "max_notes": 0,
    },
]


def _maybe_clip(text: str, limit: int) -> str:
    if not limit:
        return text or ""
    return _clip(text or "", limit)


def _build_mass_flow(
    styles: dict[str, ParagraphStyle],
    *,
    parish: str,
    title: str,
    date_label: str,
    season: str,
    color_name: str,
    celebrant: str,
    co_celebrant: str,
    gospel_quote: str,
    gospel_reference: str,
    cycle: str,
    first_reading_ref: str,
    first_reading_text: str,
    psalm_ref: str,
    psalm_text: str,
    second_reading_ref: str,
    second_reading_text: str,
    gospel_text: str,
    gospel_acclamation: str,
    prayers: Mapping[str, str],
    songs: Sequence[Mapping[str, str]],
    announcements: Sequence[str],
    compact: Optional[Mapping[str, Any]] = None,
) -> list[Any]:
    """Same order as the Mass PowerPoint deck."""
    cfg = dict(_COMPACT_TIERS[0])
    if compact:
        cfg.update(dict(compact))

    story: list[Any] = []
    by = _song_map(songs)
    lyric_chars = int(cfg.get("lyric") or 0)
    titles_only = bool(cfg.get("titles_only"))
    drop_extra = bool(cfg.get("drop_extra_songs"))
    prayer_lim = int(cfg.get("prayer") or 0)

    def prayer(key: str) -> str:
        return _maybe_clip(prayers.get(key, ""), prayer_lim)

    # --- Cover / title (boxed so the front face is obvious) ---
    cover: list[Any] = []
    display = title or "Sunday Mass"
    cycle_letter = _clean_space(cycle).upper()[:1]
    if cycle_letter and cycle_letter.isalpha():
        display = f"{display} ({cycle_letter})"
    pad = 4.0  # matches TableStyle padding below
    inner_w = max(40.0, CONTENT_W - 2 * pad)
    _add(cover, _P(_esc(parish or "Sunday Mass"), styles["center_kicker"]))
    # Keep ``25th Sunday in Ordinary Time (A)`` on one line by shrinking to fit.
    title_style = _fit_cover_title_style(
        display,
        styles["center_title"].fontName,
        scale=styles["center_title"].fontSize / 15.0,
        max_width=inner_w * 0.98,
        tag=styles["center_title"].name,
    )
    _add(cover, _P(_esc(display), title_style))
    _add(cover, _P(_esc(date_label), styles["center_body"]))
    celeb = celebrant
    if co_celebrant:
        celeb = f"{celebrant} · {co_celebrant}" if celebrant else co_celebrant
    if celeb:
        _add(cover, _P(f"Celebrant: {_esc(celeb)}", styles["center_body"]))
    quote = _clean_space(gospel_quote)
    if quote and not cfg.get("drop_quote"):
        _add(
            cover,
            _P(f"<i>“{_esc(_clip(quote, 220))}”</i>", styles["quote"]),
        )
        if gospel_reference:
            _add(cover, _P(_esc(gospel_reference), styles["center_body"]))

    boxed = Table([[cover]], colWidths=[CONTENT_W])
    boxed.setStyle(
        TableStyle(
            [
                ("BOX", (0, 0), (-1, -1), 1.25, _INK),
                ("TOPPADDING", (0, 0), (-1, -1), pad),
                ("BOTTOMPADDING", (0, 0), (-1, -1), pad),
                ("LEFTPADDING", (0, 0), (-1, -1), pad),
                ("RIGHTPADDING", (0, 0), (-1, -1), pad),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("BACKGROUND", (0, 0), (-1, -1), _CREAM),
            ]
        )
    )
    story.append(boxed)
    story.append(Spacer(1, 5))

    # --- Entrance ---
    _add(story, _P("Introductory Rites", styles["title"]))
    _add_song(
        story, styles, by.get("entrance"), "Entrance",
        lyric_chars=lyric_chars, titles_only=titles_only,
    )

    # --- Greeting / Penitential / Gloria ---
    _block(story, styles, "Sign of the Cross & Greeting", prayer("sign_cross"))
    _block(story, styles, "Confiteor", prayer("confiteor"))
    # Kyrie: no All: labels, no blank-line paragraphs
    _block(story, styles, "Kyrie", prayers.get("kyrie", ""), kyrie=True)
    if prayers.get("gloria"):
        _block(story, styles, "Gloria", prayer("gloria"))

    # --- Liturgy of the Word ---
    _add(story, _P("Liturgy of the Word", styles["title"]))
    fr = _maybe_clip(first_reading_text, int(cfg.get("reading") or 0))
    if first_reading_ref or fr:
        head = "First Reading"
        if first_reading_ref:
            head = f"First Reading — {_clean_space(first_reading_ref)}"
        _block(story, styles, head, fr)
        if not cfg.get("drop_dialogues"):
            _add(
                story,
                _P(_dialogue_line("The Word of the Lord.", "Thanks be to God."), styles["response"]),
            )
    ps = _maybe_clip(psalm_text, int(cfg.get("psalm") or 0))
    if psalm_ref or ps:
        head = "Responsorial Psalm"
        if psalm_ref:
            head = f"Responsorial Psalm — {_clean_space(psalm_ref)}"
        _block(story, styles, head, ps)
    sr = _maybe_clip(second_reading_text, int(cfg.get("reading") or 0))
    if second_reading_ref or sr:
        head = "Second Reading"
        if second_reading_ref:
            head = f"Second Reading — {_clean_space(second_reading_ref)}"
        _block(story, styles, head, sr)
        if not cfg.get("drop_dialogues"):
            _add(
                story,
                _P(_dialogue_line("The Word of the Lord.", "Thanks be to God."), styles["response"]),
            )
    if gospel_acclamation:
        _block(story, styles, "Gospel Acclamation", _maybe_clip(gospel_acclamation, 280))
    gt = _maybe_clip(gospel_text, int(cfg.get("gospel") or 0))
    if gospel_reference or gt:
        head = "Gospel"
        if gospel_reference:
            head = f"Gospel — {_clean_space(gospel_reference)}"
        if not cfg.get("drop_dialogues"):
            _add(
                story,
                _P(
                    _dialogue_line("The Lord be with you.", "And with your spirit."),
                    styles["response"],
                ),
            )
            _add(
                story,
                _P(
                    _dialogue_line(
                        "A reading from the holy Gospel according to the Evangelist.",
                        "Glory to you, O Lord.",
                    ),
                    styles["response"],
                ),
            )
        _block(story, styles, head, gt)
        if not cfg.get("drop_dialogues"):
            _add(
                story,
                _P(
                    _dialogue_line("The Gospel of the Lord.", "Praise to you, Lord Jesus Christ."),
                    styles["response"],
                ),
            )
    if prayers.get("creed"):
        _block(story, styles, "Profession of Faith (Creed)", prayer("creed"), as_all=True)

    # --- Liturgy of the Eucharist ---
    _add(story, _P("Liturgy of the Eucharist", styles["title"]))
    _add_song(
        story, styles, by.get("offertory"), "Offertory",
        lyric_chars=lyric_chars, titles_only=titles_only,
    )
    _block(story, styles, "Pray, brethren", prayer("pray_brethren"))
    _block(story, styles, "Preface dialogue", prayer("preface"))
    _block(story, styles, "Sanctus", prayer("sanctus"))
    _block(story, styles, "Mystery of Faith", prayer("mystery"))
    _block(story, styles, "Our Father", prayer("our_father"))
    _block(story, styles, "Embolism & Doxology", prayer("communion_deliver"))
    _block(story, styles, "Sign of Peace", prayer("sign_peace"))
    _block(story, styles, "Lamb of God", prayer("lamb"))
    _block(story, styles, "Communion", prayer("communion_dialog"))
    _add_song(
        story, styles, by.get("communion_1"), "Communion",
        lyric_chars=lyric_chars, titles_only=titles_only,
    )
    if not drop_extra:
        _add_song(
            story, styles, by.get("communion_2"), "Communion II",
            lyric_chars=lyric_chars, titles_only=titles_only,
        )
        _add_song(
            story, styles, by.get("communion_3"), "Communion III",
            lyric_chars=lyric_chars, titles_only=titles_only,
        )
        _add_song(
            story, styles, by.get("meditation"), "Meditation",
            lyric_chars=lyric_chars, titles_only=titles_only,
        )

    # --- Closing ---
    _add(story, _P("Concluding Rites", styles["title"]))
    _add_song(
        story, styles, by.get("recessional"), "Recessional",
        lyric_chars=lyric_chars, titles_only=titles_only,
    )
    _add(
        story,
        _P(
            _esc(parish or "Thank you for worshipping with us.")
            + " Please take a moment of silence and greet one another in peace.",
            styles["body"],
        ),
    )
    max_notes = int(cfg.get("max_notes") or 0)
    if max_notes > 0 and not cfg.get("drop_announcements"):
        notes = [_clean_space(str(a)) for a in announcements if _clean_space(str(a or ""))]
        if notes:
            _heading(story, styles, "Parish notes")
            for note in notes[:max_notes]:
                _add(story, _P(f"• {_esc(_clip(note, 120))}", styles["body"]))
    _add(story, _P("Generated with LiturgyFlow", styles["small"]))
    return story


def _flowable_height(fl: Any, width: float) -> float:
    try:
        _w, h = fl.wrap(width, CONTENT_H * 6)
        return float(h or 0)
    except Exception:
        return 12.0


def _split_paragraph(
    p: Paragraph, width: float, max_h: float
) -> tuple[Optional[Paragraph], Optional[Paragraph]]:
    try:
        parts = p.split(width, max_h)
    except Exception:
        return p, None
    if not parts:
        return None, p
    if len(parts) == 1:
        return parts[0], None
    return parts[0], parts[1]


def _paginate(flowables: Sequence[Any], width: float, max_h: float) -> list[list[Any]]:
    pages: list[list[Any]] = []
    current: list[Any] = []
    used = 0.0
    queue = list(flowables)
    safety = 0
    while queue and safety < 8000:
        safety += 1
        fl = queue.pop(0)
        h = _flowable_height(fl, width)
        if current and used + h > max_h - 0.5:
            if isinstance(fl, Paragraph) and h > max_h * 0.28:
                first, rest = _split_paragraph(fl, width, max(22.0, max_h - used - 1))
                if first is not None:
                    fh = _flowable_height(first, width)
                    if used + fh <= max_h + 0.5:
                        current.append(first)
                        pages.append(current)
                        current = []
                        used = 0.0
                        if rest is not None:
                            queue.insert(0, rest)
                        continue
            pages.append(current)
            current = []
            used = 0.0
            queue.insert(0, fl)
            continue
        if not current and h > max_h and isinstance(fl, Paragraph):
            first, rest = _split_paragraph(fl, width, max_h)
            if first is not None:
                current.append(first)
                pages.append(current)
                current = []
                used = 0.0
                if rest is not None:
                    queue.insert(0, rest)
                continue
        current.append(fl)
        used += h
    if current:
        pages.append(current)
    return pages or [[]]


def _pad_cells(cells: list[list[Any]], *, max_cells: int = CELLS_PER_SHEET) -> list[list[Any]]:
    """Pad to a full sheet, then hard-cap at one A4 duplex (8 cells)."""
    out = list(cells)[:max_cells]
    while len(out) < max_cells:
        out.append([])
    return out[:max_cells]


def _sheet_cell_map(n_cells: int) -> list[tuple[list[int], list[int]]]:
    """
    Always one physical sheet: front 4 cols + back 4 cols.

      Front:  [0][1] | [2][3]
      Back:   [4][5] | [6][7]
    """
    _ = n_cells  # always one sheet; arg kept for call-site clarity
    front = [0, 1, 2, 3]
    back = [4, 5, 6, 7]
    return [(front, back)]


def _fit_flowables(
    *,
    body_font: str,
    bold_font: str,
    italic_font: str,
    build_kwargs: dict[str, Any],
) -> tuple[list[list[Any]], float, int]:
    """
    Auto-adjuster: try decreasing font scale, then tighter content tiers,
    until everything paginates into ≤ 8 cells (one A4 duplex).
    """
    # Font scales from full size down to ~62%
    scales = [1.0, 0.95, 0.90, 0.85, 0.80, 0.75, 0.70, 0.65, 0.62]
    best_cells: list[list[Any]] = []
    best_scale = 1.0
    best_tier = 0
    best_count = 10_000

    for tier_i, compact in enumerate(_COMPACT_TIERS):
        for scale in scales:
            styles = _styles(body_font, bold_font, italic_font, scale=scale)
            flowables = _build_mass_flow(styles, compact=compact, **build_kwargs)
            cells = _paginate(flowables, CONTENT_W, CONTENT_H)
            n = len(cells)
            if n < best_count:
                best_count = n
                best_cells = cells
                best_scale = scale
                best_tier = tier_i
            if n <= CELLS_PER_SHEET:
                logger.info(
                    "Leaflet fit: %s cells @ scale=%.2f tier=%s",
                    n,
                    scale,
                    tier_i,
                )
                return _pad_cells(cells), scale, tier_i

    logger.warning(
        "Leaflet overflow after auto-fit (%s cells); clipping to one sheet "
        "(scale=%.2f tier=%s)",
        best_count,
        best_scale,
        best_tier,
    )
    return _pad_cells(best_cells), best_scale, best_tier


def _cell_origin(index: int) -> tuple[float, float]:
    """Column index 0..3 left→right → bottom-left origin of cell."""
    col = index % COLS
    x = col * CELL_W
    y = 0.0
    return x, y


def _draw_side_chrome(c: Canvas, accent: Color) -> None:
    """Plain cream page — no frames, dividers, or fold marks."""
    _ = accent  # liturgical accent unused now (kept for call-site stability)
    c.setFillColor(_CREAM)
    c.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)


def _draw_cell(
    c: Canvas,
    col_index: int,
    flowables: Sequence[Any],
    *,
    cell_no: int,
    cell_total: int,
) -> None:
    _ = cell_no, cell_total  # no cell chrome / page numbers
    x0, y0 = _cell_origin(col_index)
    x = x0 + MARGIN + (GUTTER / 4)
    y = y0 + CELL_H - MARGIN
    for fl in flowables:
        avail = y - (y0 + MARGIN + FOOTER_H)
        if avail < 6:
            break
        _w, h = fl.wrap(CONTENT_W, avail)
        if h > avail:
            break
        fl.drawOn(c, x, y - h)
        y -= h


def generate_mass_leaflet(
    *,
    output_path: Path,
    title: str,
    date: str,
    parish_name: str = "",
    celebrant: str = "",
    co_celebrant: str = "",
    season: str = "",
    lectionary_cycle: str = "",
    liturgical_color_name: str = "",
    liturgical_color_hex: str = "",
    gospel_quote: str = "",
    gospel_reference: str = "",
    first_reading_ref: str = "",
    first_reading_text: str = "",
    psalm_ref: str = "",
    psalm_text: str = "",
    second_reading_ref: str = "",
    second_reading_text: str = "",
    gospel_text: str = "",
    gospel_acclamation: str = "",
    songs: Optional[Sequence[Mapping[str, str]]] = None,
    song_titles: Optional[Mapping[str, str]] = None,
    announcements: Optional[Sequence[str]] = None,
    mass_language: str = "english",
    creed_choice: str = "nicene",
    gloria_choice: str = "english",
    our_father_choice: str = "english",
) -> Path:
    out = Path(output_path)
    out.parent.mkdir(parents=True, exist_ok=True)

    body_font, bold_font, italic_font = _register_fonts()
    accent = _hex_color(liturgical_color_hex)
    display_title = (title or "Sunday Mass").replace(" Celebration", "").strip() or "Sunday Mass"
    date_label = _format_date(date)
    parish = _clean_space(parish_name)[:80]
    prayers = _prayer_bundle(
        mass_language=mass_language,
        creed_choice=creed_choice,
        gloria_choice=gloria_choice,
        our_father_choice=our_father_choice,
    )

    song_rows: list[Mapping[str, str]] = list(songs or [])
    if not song_rows and song_titles:
        order = [
            ("Entrance", "entrance"),
            ("Offertory", "offertory"),
            ("Communion", "communion_1"),
            ("Communion II", "communion_2"),
            ("Communion III", "communion_3"),
            ("Meditation", "meditation"),
            ("Recessional", "recessional"),
        ]
        for label, key in order:
            t = _clean_space(str(song_titles.get(key) or ""))
            if t:
                song_rows.append({"label": label, "title": t, "lyrics": ""})

    build_kwargs: dict[str, Any] = {
        "parish": parish,
        "title": display_title,
        "date_label": date_label,
        "season": _pretty_season(season),
        "color_name": _clean_space(liturgical_color_name),
        "celebrant": _clean_space(celebrant),
        "co_celebrant": _clean_space(co_celebrant),
        "gospel_quote": gospel_quote,
        "gospel_reference": gospel_reference,
        "cycle": _clean_space(lectionary_cycle),
        "first_reading_ref": first_reading_ref,
        "first_reading_text": first_reading_text,
        "psalm_ref": psalm_ref,
        "psalm_text": psalm_text,
        "second_reading_ref": second_reading_ref,
        "second_reading_text": second_reading_text,
        "gospel_text": gospel_text,
        "gospel_acclamation": gospel_acclamation,
        "prayers": prayers,
        "songs": song_rows,
        "announcements": list(announcements or []),
    }

    cells, scale_used, tier_used = _fit_flowables(
        body_font=body_font,
        bold_font=bold_font,
        italic_font=italic_font,
        build_kwargs=build_kwargs,
    )
    sheets = _sheet_cell_map(len(cells))
    total = CELLS_PER_SHEET  # always one duplex sheet

    c = Canvas(str(out), pagesize=landscape(A4))
    c.setTitle(f"{display_title} — Mass leaflet")
    c.setAuthor(parish or "LiturgyFlow")

    for front_idx, back_idx in sheets:
        _draw_side_chrome(c, accent)
        for qi, cell_i in enumerate(front_idx):
            _draw_cell(
                c,
                qi,
                cells[cell_i] if cell_i < len(cells) else [],
                cell_no=cell_i + 1,
                cell_total=total,
            )
        c.showPage()
        _draw_side_chrome(c, accent)
        for qi, cell_i in enumerate(back_idx):
            _draw_cell(
                c,
                qi,
                cells[cell_i] if cell_i < len(cells) else [],
                cell_no=cell_i + 1,
                cell_total=total,
            )
        c.showPage()

    c.save()
    logger.info(
        "Wrote Mass leaflet %s (1 sheet / %s pages, scale=%.2f, compact_tier=%s)",
        out.name,
        MAX_PDF_PAGES,
        scale_used,
        tier_used,
    )
    return out
