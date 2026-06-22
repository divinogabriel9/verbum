"""Deck layout template: the single source of truth for slide geometry.

Every position, margin, and box rectangle the deck builder uses lives here so the
generated ``.pptx`` is laid out consistently and predictably. Renderers in
``generators/powerpoint.py`` import these names instead of sprinkling ad-hoc
``Inches(...)`` literals, which is what previously made alignment drift between
slide types.

Colors and fonts are owned by ``SlideTheme`` in ``powerpoint.py``; this module is
strictly geometry (EMU lengths and ratios), so it has no dependency on the theme.
"""

from __future__ import annotations

from pptx.util import Inches

# --- Canvas -----------------------------------------------------------------
SLIDE_WIDTH = Inches(20)
SLIDE_HEIGHT = Inches(11.25)

# --- Shared margins ---------------------------------------------------------
MARGIN_SIDE = Inches(1.0)
MARGIN_TOP = Inches(0.58)

# Vertical space reserved at the bottom of a body slide (keeps text clear of the
# community footer) and the dialogue variant which needs a little more breathing
# room beneath the centered priest/assembly lines.
CONTENT_BOTTOM_GAP = Inches(1.1)
DIALOGUE_BOTTOM_GAP = Inches(1.25)

# --- Branding band (top-left logo + parish name) ----------------------------
_BRAND_BAND = Inches(1.05)
_LOGO_MAX_W = Inches(0.95)
_LOGO_MAX_H = Inches(0.42)
LOGO_TOP = Inches(0.28)
LOGO_GAP = Inches(0.14)

# --- Community footer (bottom-left section tag) -----------------------------
FOOTER_TOP_OFFSET = Inches(0.95)  # distance from slide bottom to footer top
FOOTER_HEIGHT = Inches(0.85)

# --- Hymn / lyric slides ----------------------------------------------------
_HYMN_TITLE_TOP = Inches(0.12)
HYMN_TITLE_BOX_H = Inches(0.95)
HYMN_BODY_TOP_OFFSET = Inches(1.05)  # body top relative to the title top
_HYMN_DUAL_BOX_H = Inches(5.247)
_HYMN_DUAL_TOP_FIRST = Inches(0.901)
_HYMN_DUAL_BOTTOM_FIRST = Inches(5.984)
_HYMN_DUAL_TOP_CONT = Inches(0.484)
_HYMN_DUAL_BOTTOM_CONT = Inches(5.568)

# Full-bleed lyric textbox tuning (no side inset; spans the full slide width).
_LYRIC_TF_SIDE_MARGIN = Inches(0)
_LYRIC_SAFE_SIDE_RATIO = 0.0
_LYRIC_TEXTBOX_WIDTH_RATIO = 1.0

# --- Mass collection slide --------------------------------------------------
COLLECTION_TITLE_H = Inches(1.15)
COLLECTION_FOOTER_TOP = Inches(1.55)

# --- Conversions ------------------------------------------------------------
_EMU_PER_INCH = 914400
