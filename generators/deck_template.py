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
HYMN_TITLE_BOX_H = Inches(0.95)  # title spans 0.12in .. 1.07in
HYMN_BODY_TOP_OFFSET = Inches(1.05)  # body top relative to the title top
# Bottom safe margin for lyric bodies. The footer strip is now reclaimed for
# lyrics (the footer is a debug-only overlay), so bodies extend nearly to the
# bottom edge and only keep this small margin off the very edge.
_LYRIC_BODY_BOTTOM_MARGIN = Inches(0.2)

# Two-blocks-per-slide ("dual") geometry. The two verse boxes fill the slide
# vertically: the top box's top edge is flush with the slide top (on non-title
# continuation slides) and the bottom box's bottom edge is flush with the slide
# bottom, separated only by a small gap.
_HYMN_DUAL_GAP = Inches(0.3)  # small gap between the two verse boxes

# Continuation (non-title) slides: top box flush to the top edge, bottom box
# flush to the bottom edge, split evenly around the gap.
_HYMN_DUAL_CONT_BOX_H = (SLIDE_HEIGHT - _HYMN_DUAL_GAP) / 2
_HYMN_DUAL_TOP_CONT = 0  # flush with the top of the slide
_HYMN_DUAL_BOTTOM_CONT = _HYMN_DUAL_CONT_BOX_H + _HYMN_DUAL_GAP

# First (title) slides: top box clears the title; bottom box still runs flush to
# the bottom edge, with the same small gap between the two boxes.
_HYMN_DUAL_TOP_FIRST = Inches(1.20)  # below the title
_HYMN_DUAL_FIRST_BOX_H = (SLIDE_HEIGHT - _HYMN_DUAL_TOP_FIRST - _HYMN_DUAL_GAP) / 2
_HYMN_DUAL_BOTTOM_FIRST = _HYMN_DUAL_TOP_FIRST + _HYMN_DUAL_FIRST_BOX_H + _HYMN_DUAL_GAP

# Full-bleed lyric textbox tuning (no side inset; spans the full slide width).
_LYRIC_TF_SIDE_MARGIN = Inches(0)
_LYRIC_SAFE_SIDE_RATIO = 0.0
_LYRIC_TEXTBOX_WIDTH_RATIO = 1.0

# --- Mass collection slide --------------------------------------------------
COLLECTION_TITLE_H = Inches(1.15)
COLLECTION_FOOTER_TOP = Inches(1.55)

# --- Conversions ------------------------------------------------------------
_EMU_PER_INCH = 914400
