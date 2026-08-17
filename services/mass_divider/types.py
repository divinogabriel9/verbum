"""Shared types for Mass Divider templates, styles, and Gospel visual analysis."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Literal, Optional

Complexity = Literal["low", "medium", "high"]
Brightness = Literal["dark", "medium", "bright"]
SubjectPosition = Literal["left", "center", "right"]
TextAlign = Literal["left", "center", "right"]

SLIDE_WIDTH_IN = 20.0
SLIDE_HEIGHT_IN = 11.25
ASPECT_RATIO = "16:9"
HEADING_DEFAULT = "HOLY EUCHARISTIC CELEBRATION"

DIVIDER_TEMPLATE_IDS = ("divider1", "divider2", "divider3")
DIVIDER_TEMPLATE_DEFAULT = "divider1"
AI_STYLE_IDS = ("cinematic", "realistic", "renaissance", "stained_glass", "modern")
AI_STYLE_DEFAULT = "cinematic"


@dataclass(frozen=True)
class TextBox:
    """One deterministic text slot on the 20×11.25 in divider canvas."""

    id: str
    left: float
    top: float
    width: float
    height: float
    max_pt: float
    min_pt: float
    bold: bool = True
    italic: bool = False
    align: TextAlign = "center"
    single_line: bool = False
    optional: bool = False
    role: str = ""


@dataclass(frozen=True)
class PanelBox:
    """Translucent panel that protects a text-safe region."""

    left: float
    top: float
    width: float
    height: float
    role: str = "panel"


@dataclass(frozen=True)
class CompositionProfile:
    """How AI artwork should be composed so template text stays readable.

    Fractions are 0–1 of canvas width/height. Layout geometry never reads
    visual style — only this profile is sent to the prompt builder.
    """

    text_safe_zones: dict[str, float]
    visual_focus: tuple[float, float]
    subject_position: SubjectPosition
    background_complexity: dict[str, Complexity]
    brightness_preference: dict[str, Brightness]
    aspect_ratio: str = ASPECT_RATIO

    def safe_fraction(self, edge: str) -> float:
        try:
            return max(0.0, min(1.0, float(self.text_safe_zones.get(edge) or 0.0)))
        except (TypeError, ValueError):
            return 0.0


@dataclass(frozen=True)
class DividerTemplate:
    id: str
    name: str
    description: str
    preview: str
    boxes: dict[str, TextBox]
    panels: tuple[PanelBox, ...] = ()
    composition: CompositionProfile = field(
        default_factory=lambda: CompositionProfile(
            text_safe_zones={"left": 0.4, "bottom": 0.15},
            visual_focus=(0.62, 0.42),
            subject_position="right",
            background_complexity={"left": "low", "center": "medium", "right": "high"},
            brightness_preference={"left": "dark", "center": "medium", "right": "medium"},
        )
    )
    static_background: Optional[str] = None
    has_heading: bool = False
    heading_default: str = HEADING_DEFAULT


@dataclass(frozen=True)
class VisualStyle:
    id: str
    label: str
    prompt: str
    avoid: str = ""


@dataclass
class GospelVisualAnalysis:
    primary_theme: str
    secondary_themes: list[str]
    emotional_tone: list[str]
    visual_concept: str
    visual_metaphor: str
    focal_subject: str
    environment: str
    recommended_style: str = AI_STYLE_DEFAULT
    mood_key: str = "reverent"

    def to_dict(self) -> dict[str, object]:
        return {
            "primary_theme": self.primary_theme,
            "secondary_themes": list(self.secondary_themes),
            "emotional_tone": list(self.emotional_tone),
            "visual_concept": self.visual_concept,
            "visual_metaphor": self.visual_metaphor,
            "focal_subject": self.focal_subject,
            "environment": self.environment,
            "recommended_style": self.recommended_style,
            "mood_key": self.mood_key,
        }


@dataclass(frozen=True)
class MassDividerFields:
    gospel_quote: str
    gospel_reference: str
    celebrant: str
    co_celebrant: str
    year_cycle: str
    mass_date: str
    sunday_title: str
    heading: str = HEADING_DEFAULT
    season: str = ""
