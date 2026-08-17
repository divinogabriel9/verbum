"""Mass Divider architecture: templates, styles, Gospel analysis, prompt builder."""

from __future__ import annotations

from services.mass_divider.fields import (
    fields_from_liturgical_payload,
    resolve_mass_divider_fields,
    sunday_title_display,
)
from services.mass_divider.gospel_analysis import (
    analysis_from_liturgical_payload,
    analyze_gospel_visual,
)
from services.mass_divider.prompt_builder import (
    NO_TEXT_EXCLUSIONS,
    build_background_prompt,
    negative_prompt,
)
from services.mass_divider.templates import (
    get_divider_template,
    list_divider_templates,
    resolve_divider_template_id,
)
from services.mass_divider.types import (
    AI_STYLE_DEFAULT,
    AI_STYLE_IDS,
    DIVIDER_TEMPLATE_DEFAULT,
    DIVIDER_TEMPLATE_IDS,
    HEADING_DEFAULT,
    CompositionProfile,
    DividerTemplate,
    GospelVisualAnalysis,
    MassDividerFields,
    VisualStyle,
)

__all__ = [
    "AI_STYLE_DEFAULT",
    "AI_STYLE_IDS",
    "DIVIDER_TEMPLATE_DEFAULT",
    "DIVIDER_TEMPLATE_IDS",
    "HEADING_DEFAULT",
    "NO_TEXT_EXCLUSIONS",
    "CompositionProfile",
    "DividerTemplate",
    "GospelVisualAnalysis",
    "MassDividerFields",
    "VisualStyle",
    "analysis_from_liturgical_payload",
    "analyze_gospel_visual",
    "build_background_prompt",
    "fields_from_liturgical_payload",
    "get_divider_template",
    "list_divider_templates",
    "negative_prompt",
    "resolve_divider_template_id",
    "resolve_mass_divider_fields",
    "sunday_title_display",
]
