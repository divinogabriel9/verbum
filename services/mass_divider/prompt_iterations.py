"""Alternate assemblies of the same gospel analysis (OG fine-tune family).

``og`` is not implemented here — it stays in ``prompt_builder.build_background_prompt``
so the production fine-tune cannot drift. These iterations reuse the same analysis
fields with different framing / emphasis only.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Optional

from services.mass_divider.prompt_builder import (
    NO_TEXT_EXCLUSIONS,
    OG_ANTI_SAMENESS,
    OG_DECISIVE_MOMENT,
    composition_prompt_lines,
)
from services.mass_divider.types import CompositionProfile, GospelVisualAnalysis, VisualStyle

PROMPT_ITERATION_DEFAULT = "og"


@dataclass(frozen=True)
class PromptIteration:
    id: str
    label: str
    description: str


# First entry is always OG (handled by prompt_builder). Others are iterations.
PROMPT_ITERATIONS: tuple[PromptIteration, ...] = (
    PromptIteration(
        id="og",
        label="OG Fine-tune",
        description="Current production prompt — decisive climax, anti-sameness, narrative first.",
    ),
    PromptIteration(
        id="og_tight",
        label="OG · Tighter climax",
        description="Same analysis; stronger freeze-frame on the single turning action.",
    ),
    PromptIteration(
        id="og_relational",
        label="OG · Relational beat",
        description="Same analysis; who faces whom and supporting figures lead the staging.",
    ),
    PromptIteration(
        id="og_place",
        label="OG · Place-led",
        description="Same analysis; environment and story-specific props carry the beat.",
    ),
    PromptIteration(
        id="og_close",
        label="OG · Closer lens",
        description="Same analysis; closer crop on faces, hands, and the decisive gesture.",
    ),
)

_BY_ID = {item.id: item for item in PROMPT_ITERATIONS}


def list_prompt_iterations() -> list[dict[str, str]]:
    return [
        {"id": item.id, "label": item.label, "description": item.description}
        for item in PROMPT_ITERATIONS
    ]


def resolve_prompt_iteration(raw: Optional[str]) -> str:
    key = str(raw or "").strip().lower().replace("-", "_").replace(" ", "_")
    if not key or key in {"default", "original", "fine_tune", "finetune"}:
        return PROMPT_ITERATION_DEFAULT
    if key in _BY_ID:
        return key
    return PROMPT_ITERATION_DEFAULT


def prompt_iteration_label(raw: Optional[str]) -> str:
    key = resolve_prompt_iteration(raw)
    item = _BY_ID.get(key)
    return item.label if item else "OG Fine-tune"


_TIGHT_CLIMAX = (
    "TIGHTER CLIMAX: Freeze ONE irreversible instant — the hand raised, the garment seized, "
    "the recognition flash, the judgment spoken. Prefer a single decisive gesture over a wide "
    "establishing tableau. Still THIS pericope only."
)

_RELATIONAL = (
    "RELATIONAL BEAT: Make the story readable through relationship — who faces whom, "
    "distance vs approach, teacher and seeker, judge and guest, healer and petitioner. "
    "Supporting figures and eye-lines matter as much as the central pose."
)

_PLACE_LED = (
    "PLACE-LED STAGING: Let the concrete environment and story-specific props carry identity "
    "(table, boat, well, road, threshing floor, banquet). The climax still happens here — "
    "do not empty the setting into a soft mood shot."
)

_CLOSER_LENS = (
    "CLOSER LENS: Prefer a nearer camera on faces, hands, and the decisive gesture. "
    "Crop tighter than a full-group tableau while keeping the Gospel beat unmistakable."
)


def _shared_tail(
    *,
    analysis: GospelVisualAnalysis,
    style: VisualStyle,
    profile: CompositionProfile,
    closing: str,
) -> list[str]:
    tones = ", ".join(analysis.emotional_tone[:3]) or "reverent"
    secondaries = ", ".join(analysis.secondary_themes[:3])
    parts: list[str] = [
        f"Primary spiritual theme: {analysis.primary_theme}.",
        f"Secondary themes: {secondaries}." if secondaries else "",
        f"Emotional tone: {tones}.",
        f"Visual metaphor: {analysis.visual_metaphor}.",
    ]
    if analysis.must_avoid:
        parts.append(f"Must avoid: {analysis.must_avoid}.")
    parts.append(f"STYLE: {style.label}. {style.prompt}".rstrip(".") + ".")
    if style.avoid:
        parts.append(f"Avoid: {style.avoid}.")
    parts.extend(composition_prompt_lines(profile))
    parts.append(closing)
    return [p for p in parts if p]


def build_iterated_background_prompt(
    *,
    analysis: GospelVisualAnalysis,
    style: VisualStyle,
    profile: CompositionProfile,
    iteration: str,
) -> str:
    """Assemble a non-OG iteration. Caller must not pass ``og`` here."""
    key = resolve_prompt_iteration(iteration)
    if key == "og":
        # Safety: never silently rebuild OG here — use prompt_builder instead.
        from services.mass_divider.prompt_builder import build_background_prompt

        return build_background_prompt(
            analysis=analysis, style=style, profile=profile, iteration="og"
        )

    base_open = [
        "Generate a biblical illustration BACKGROUND for a church presentation slide.",
        NO_TEXT_EXCLUSIONS,
        OG_ANTI_SAMENESS,
        OG_DECISIVE_MOMENT,
    ]

    if key == "og_tight":
        parts = [
            *base_open,
            _TIGHT_CLIMAX,
            f"NARRATIVE BEAT (must be visually specific to THIS Gospel): {analysis.visual_concept}.",
        ]
        if analysis.action:
            parts.append(f"ACTION & GESTURE (primary freeze-frame): {analysis.action}.")
        parts.append(f"FOCAL SUBJECT: {analysis.focal_subject}.")
        if analysis.supporting_figures:
            parts.append(f"SUPPORTING FIGURES / PROPS: {analysis.supporting_figures}.")
        parts.append(f"ENVIRONMENT: {analysis.environment}.")
        if analysis.camera:
            parts.append(f"CAMERA & BLOCKING: {analysis.camera}; prefer a decisive near-mid shot.")
        parts.extend(
            _shared_tail(
                analysis=analysis,
                style=style,
                profile=profile,
                closing=(
                    "Focus on one unmistakable climax instant unique to this Gospel moment, "
                    "readable in one glance as THIS Sunday's reading."
                ),
            )
        )
        return " ".join(p for p in parts if p)

    if key == "og_relational":
        parts = [
            *base_open,
            _RELATIONAL,
            f"NARRATIVE BEAT (must be visually specific to THIS Gospel): {analysis.visual_concept}.",
            f"FOCAL SUBJECT: {analysis.focal_subject}.",
        ]
        if analysis.supporting_figures:
            parts.append(
                f"SUPPORTING FIGURES / RELATIONSHIPS (lead the staging): {analysis.supporting_figures}."
            )
        if analysis.action:
            parts.append(f"ACTION & GESTURE between them: {analysis.action}.")
        parts.append(f"ENVIRONMENT: {analysis.environment}.")
        if analysis.camera:
            parts.append(f"CAMERA & BLOCKING: {analysis.camera}; favor clear eye-lines between figures.")
        parts.extend(
            _shared_tail(
                analysis=analysis,
                style=style,
                profile=profile,
                closing=(
                    "Focus on the relational storytelling unique to this Gospel moment, "
                    "readable in one glance as THIS Sunday's reading."
                ),
            )
        )
        return " ".join(p for p in parts if p)

    if key == "og_place":
        parts = [
            *base_open,
            _PLACE_LED,
            f"NARRATIVE BEAT (must be visually specific to THIS Gospel): {analysis.visual_concept}.",
            f"ENVIRONMENT (lead with place + props): {analysis.environment}.",
        ]
        if analysis.supporting_figures:
            parts.append(f"SUPPORTING FIGURES / PROPS: {analysis.supporting_figures}.")
        if analysis.action:
            parts.append(f"ACTION & GESTURE happening in this place: {analysis.action}.")
        parts.append(f"FOCAL SUBJECT: {analysis.focal_subject}.")
        if analysis.camera:
            parts.append(f"CAMERA & BLOCKING: {analysis.camera}; keep place-readable depth.")
        parts.extend(
            _shared_tail(
                analysis=analysis,
                style=style,
                profile=profile,
                closing=(
                    "Focus on place-and-prop storytelling unique to this Gospel moment, "
                    "readable in one glance as THIS Sunday's reading."
                ),
            )
        )
        return " ".join(p for p in parts if p)

    if key == "og_close":
        parts = [
            *base_open,
            _CLOSER_LENS,
            f"NARRATIVE BEAT (must be visually specific to THIS Gospel): {analysis.visual_concept}.",
        ]
        if analysis.action:
            parts.append(f"ACTION & GESTURE (fill the frame): {analysis.action}.")
        parts.append(f"FOCAL SUBJECT: {analysis.focal_subject}.")
        if analysis.supporting_figures:
            parts.append(f"SUPPORTING FIGURES / PROPS: {analysis.supporting_figures}.")
        parts.append(f"ENVIRONMENT: {analysis.environment}.")
        if analysis.camera:
            parts.append(
                f"CAMERA & BLOCKING: {analysis.camera}; push closer — faces and hands readable."
            )
        else:
            parts.append("CAMERA & BLOCKING: closer mid-shot or near detail on the decisive gesture.")
        parts.extend(
            _shared_tail(
                analysis=analysis,
                style=style,
                profile=profile,
                closing=(
                    "Focus on an intimate, close decisive beat unique to this Gospel moment, "
                    "readable in one glance as THIS Sunday's reading."
                ),
            )
        )
        return " ".join(p for p in parts if p)

    # Unknown → OG via prompt_builder
    from services.mass_divider.prompt_builder import build_background_prompt

    return build_background_prompt(
        analysis=analysis, style=style, profile=profile, iteration="og"
    )


def iteration_payload() -> dict[str, Any]:
    return {
        "ok": True,
        "default": PROMPT_ITERATION_DEFAULT,
        "iterations": list_prompt_iterations(),
    }
