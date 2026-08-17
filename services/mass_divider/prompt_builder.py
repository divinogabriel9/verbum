"""Build artwork-only diffusion prompts from analysis + style + composition."""

from __future__ import annotations

from services.mass_divider.types import CompositionProfile, GospelVisualAnalysis, VisualStyle

NO_TEXT_EXCLUSIONS = (
    "Do NOT generate readable text, letters, numbers, captions, subtitles, watermarks, "
    "dates, Gospel references, names, logos, typography, decorative text, fake signage, "
    "fake scripture, fake UI, or church crests. Pure background illustration only."
)

_NEGATIVE = (
    "readable text, letters, words, typography, captions, subtitles, speech bubbles, "
    "Bible verse written on image, scripture text overlay, title card, fake poster text, "
    "misspelled words, garbled text, movie poster text, watermark, logo, UI, "
    "solid color only, empty scene, deformed hands, extra limbs, low quality, blurry"
)


def composition_prompt_lines(profile: CompositionProfile) -> list[str]:
    left = profile.safe_fraction("left")
    right = profile.safe_fraction("right")
    top = profile.safe_fraction("top")
    bottom = profile.safe_fraction("bottom")
    subject = profile.subject_position
    fx, fy = profile.visual_focus
    lines = [
        f"{profile.aspect_ratio} PowerPoint widescreen landscape, ultra high quality, "
        "presentation-ready, full-bleed edge-to-edge biblical scene, no letterboxing.",
        f"Place the main visual subject toward the {subject} of the frame "
        f"(focal point near {int(fx * 100)}% from the left, {int(fy * 100)}% from the top).",
    ]
    if left >= 0.2:
        complexity = profile.background_complexity.get("left", "low")
        brightness = profile.brightness_preference.get("left", "dark")
        lines.append(
            f"Left {int(left * 100)}% is a text-safe zone: {complexity} visual complexity, "
            f"{brightness} brightness, calm and low-detail, no important faces or focal subjects."
        )
    if right >= 0.2:
        complexity = profile.background_complexity.get("right", "medium")
        brightness = profile.brightness_preference.get("right", "medium")
        lines.append(
            f"Right {int(right * 100)}% may carry the primary scene: {complexity} detail, "
            f"{brightness} brightness."
        )
    if top >= 0.08:
        lines.append(
            f"Top {int(top * 100)}% should stay relatively uncluttered for heading text."
        )
    if bottom >= 0.1:
        lines.append(
            f"Bottom {int(bottom * 100)}% is reserved for a title bar: uncluttered, "
            "low detail, no important subjects."
        )
    return lines


def build_background_prompt(
    *,
    analysis: GospelVisualAnalysis,
    style: VisualStyle,
    profile: CompositionProfile,
) -> str:
    """Artwork-only prompt. Never include Mass copy, names, dates, or citations."""
    tones = ", ".join(analysis.emotional_tone[:3]) or "reverent"
    secondaries = ", ".join(analysis.secondary_themes[:3])
    parts = [
        "Generate a cinematic biblical illustration BACKGROUND for a church presentation slide.",
        NO_TEXT_EXCLUSIONS,
        f"STYLE: {style.label}. {style.prompt}".rstrip(".") + ".",
    ]
    if style.avoid:
        parts.append(f"Avoid: {style.avoid}.")
    parts.extend(
        [
            f"Primary spiritual theme: {analysis.primary_theme}.",
            f"Secondary themes: {secondaries}." if secondaries else "",
            f"Emotional tone: {tones}.",
            f"Visual concept: {analysis.visual_concept}.",
            f"Visual metaphor: {analysis.visual_metaphor}.",
            f"Focal subject: {analysis.focal_subject}.",
            f"Environment: {analysis.environment}.",
        ]
    )
    parts.extend(composition_prompt_lines(profile))
    parts.append("Focus on visual storytelling and worship atmosphere.")
    return " ".join(p for p in parts if p)


def negative_prompt() -> str:
    return _NEGATIVE
