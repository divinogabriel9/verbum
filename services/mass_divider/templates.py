"""Mass Divider layout templates.

Geometry is the existing PPTX truth source (20×11.25 in canvas). Visual style
never changes these boxes — only the artwork behind them.
"""

from __future__ import annotations

from typing import Optional

from services.mass_divider.types import (
    DIVIDER_TEMPLATE_DEFAULT,
    DIVIDER_TEMPLATE_IDS,
    CompositionProfile,
    DividerTemplate,
    PanelBox,
    TextBox,
)

_TEMPLATES: dict[str, DividerTemplate] = {}


def _box(
    box_id: str,
    left: float,
    top: float,
    width: float,
    height: float,
    max_pt: float,
    min_pt: float,
    **kwargs: object,
) -> TextBox:
    return TextBox(
        id=box_id,
        left=left,
        top=top,
        width=width,
        height=height,
        max_pt=max_pt,
        min_pt=min_pt,
        **kwargs,  # type: ignore[arg-type]
    )


def _register(template: DividerTemplate) -> DividerTemplate:
    _TEMPLATES[template.id] = template
    return template


DIVIDER1 = _register(
    DividerTemplate(
        id="divider1",
        name="Divider 1 · Classic",
        description="Celebrant left, gospel quote card, bottom title bar.",
        preview="",
        has_heading=False,
        boxes={
            "celebrant_label": _box(
                "celebrant_label", 1.405, 2.614, 4.604, 0.698, 37, 37, role="label"
            ),
            "celebrant_name": _box(
                "celebrant_name",
                0.292,
                3.339,
                7.206,
                1.156,
                61,
                20,
                single_line=True,
                role="celebrant",
            ),
            "year_date": _box(
                "year_date", 0.292, 4.844, 7.206, 0.95, 49, 28, italic=True, role="year_date"
            ),
            "co_celebrant_label": _box(
                "co_celebrant_label",
                1.405,
                6.208,
                4.604,
                0.698,
                37,
                37,
                optional=True,
                role="label",
            ),
            "co_celebrant_name": _box(
                "co_celebrant_name",
                0.104,
                6.966,
                7.206,
                1.156,
                52,
                20,
                single_line=True,
                optional=True,
                role="co_celebrant",
            ),
            "gospel_quote": _box(
                "gospel_quote",
                7.546,
                2.614,
                11.784,
                2.649,
                39,
                22,
                bold=False,
                role="quote",
            ),
            "gospel_citation": _box(
                "gospel_citation", 10.256, 6.345, 6.364, 0.771, 41, 24, role="citation"
            ),
            "sunday_title": _box(
                "sunday_title", 3.495, 9.199, 13.52, 1.271, 68, 32, role="title"
            ),
        },
        panels=(
            PanelBox(7.498, 1.388, 11.968, 6.702, role="quote_panel"),
            PanelBox(0.985, 9.299, 18.03, 1.217, role="bottom_bar"),
        ),
        composition=CompositionProfile(
            text_safe_zones={"left": 0.38, "right": 0.62, "bottom": 0.18},
            visual_focus=(0.68, 0.40),
            subject_position="right",
            background_complexity={"left": "low", "center": "medium", "right": "medium"},
            brightness_preference={"left": "dark", "center": "dark", "right": "dark"},
        ),
    )
)

DIVIDER2 = _register(
    DividerTemplate(
        id="divider2",
        name="Divider 2 · Stone & Light",
        description="Gospel quote with citation, celebrant on the right, bold title.",
        preview="/static/images/dividers/divider2_preview.jpg",
        static_background="data/reference/dividers/divider2_plate.png",
        has_heading=False,
        boxes={
            "gospel_quote": _box(
                "gospel_quote",
                1.924,
                1.936,
                8.714,
                4.05,
                62,
                28,
                italic=True,
                role="quote",
            ),
            "gospel_citation": _box(
                "gospel_citation", 1.924, 6.10, 8.714, 0.72, 28, 18, role="citation"
            ),
            "celebrant_label": _box(
                "celebrant_label", 13.0725, 1.6547, 5.575, 0.653, 35, 35, role="label"
            ),
            "celebrant_name": _box(
                "celebrant_name",
                12.252,
                2.093,
                7.216,
                1.868,
                71,
                28,
                single_line=True,
                role="celebrant",
            ),
            "year_date": _box(
                "year_date", 11.6262, 4.558, 8.4677, 0.984, 51, 26, role="year_date"
            ),
            "co_celebrant_label": _box(
                "co_celebrant_label",
                13.227,
                6.10,
                5.575,
                0.45,
                28,
                28,
                optional=True,
                role="label",
            ),
            "co_celebrant_name": _box(
                "co_celebrant_name",
                12.252,
                6.55,
                7.216,
                0.90,
                52,
                18,
                single_line=True,
                optional=True,
                role="co_celebrant",
            ),
            "sunday_title": _box(
                "sunday_title", 0.136, 9.248, 19.728, 1.713, 70, 36, role="title"
            ),
        },
        composition=CompositionProfile(
            text_safe_zones={"left": 0.45, "right": 0.42, "bottom": 0.18},
            visual_focus=(0.72, 0.38),
            subject_position="right",
            background_complexity={"left": "low", "center": "medium", "right": "high"},
            brightness_preference={"left": "dark", "center": "medium", "right": "medium"},
        ),
    )
)

DIVIDER3 = _register(
    DividerTemplate(
        id="divider3",
        name="Divider 3 · Gospel",
        description="Sunday title and celebrant on the left, gospel quote on the right panel.",
        preview="/static/images/dividers/divider3_preview.jpg",
        has_heading=True,
        boxes={
            "heading": _box(
                "heading", 0.5636, 0.7656, 10.1891, 1.217, 40, 22, single_line=True, role="heading"
            ),
            "sunday_title": _box(
                "sunday_title", 0.0794, 2.2647, 10.7055, 3.2565, 66, 40, role="title"
            ),
            "year_date": _box(
                "year_date", 1.268, 5.441, 8.4535, 1.045, 43, 24, italic=True, role="year_date"
            ),
            "celebrant_label": _box(
                "celebrant_label", 1.8149, 6.8841, 7.206, 0.7678, 37, 37, role="label"
            ),
            "celebrant_name": _box(
                "celebrant_name",
                0.8102,
                7.4732,
                9.1636,
                1.156,
                61,
                22,
                single_line=True,
                role="celebrant",
            ),
            "gospel_quote": _box(
                "gospel_quote",
                9.0733,
                2.614,
                11.784,
                2.8075,
                39,
                36,
                bold=False,
                role="quote",
            ),
            "gospel_citation": _box(
                "gospel_citation", 11.7833, 6.345, 6.364, 1.40, 35, 22, role="citation"
            ),
            "co_celebrant_label": _box(
                "co_celebrant_label",
                1.5835,
                8.8415,
                7.206,
                0.7678,
                37,
                37,
                optional=True,
                role="label",
            ),
            "co_celebrant_name": _box(
                "co_celebrant_name",
                0.7054,
                9.3838,
                9.1636,
                1.156,
                61,
                18,
                single_line=True,
                optional=True,
                role="co_celebrant",
            ),
        },
        panels=(
            PanelBox(10.6545, 2.2364, 8.5455, 7.4182, role="quote_panel"),
            PanelBox(0.5636, 0.7656, 10.1891, 1.217, role="kicker"),
        ),
        composition=CompositionProfile(
            text_safe_zones={"left": 0.52, "right": 0.48, "top": 0.12, "bottom": 0.08},
            visual_focus=(0.70, 0.45),
            subject_position="right",
            background_complexity={"left": "low", "center": "medium", "right": "medium"},
            brightness_preference={"left": "dark", "center": "dark", "right": "dark"},
        ),
    )
)


def list_divider_templates() -> tuple[DividerTemplate, ...]:
    return tuple(_TEMPLATES[k] for k in DIVIDER_TEMPLATE_IDS if k in _TEMPLATES)


def get_divider_template(selection: Optional[str]) -> DividerTemplate:
    key = str(selection or "").strip().lower() or DIVIDER_TEMPLATE_DEFAULT
    return _TEMPLATES.get(key) or _TEMPLATES[DIVIDER_TEMPLATE_DEFAULT]


def resolve_divider_template_id(
    selection: Optional[str],
    *,
    gospel_quote: str = "",
    sunday_title: str = "",
) -> str:
    """Resolve a layout id. ``auto`` picks among existing templates only."""
    key = str(selection or "").strip().lower() or DIVIDER_TEMPLATE_DEFAULT
    if key in _TEMPLATES:
        return key
    if key == "auto":
        quote = (gospel_quote or "").strip()
        title = (sunday_title or "").strip()
        if len(quote) >= 140:
            return "divider2"
        if len(title) >= 36:
            return "divider3"
        return "divider2"
    return DIVIDER_TEMPLATE_DEFAULT
