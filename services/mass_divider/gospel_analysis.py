"""Structured Gospel visual concept for AI artwork (never for typography)."""

from __future__ import annotations

from typing import Any, Mapping, Optional

from services.gospel_mood import infer_gospel_mood_key_from_preview
from services.gospel_visual_prompt import build_visual_scene_line
from services.mass_divider.types import AI_STYLE_DEFAULT, GospelVisualAnalysis

_MOOD_TO_STYLE = {
    "triumphant": "cinematic",
    "solemn": "renaissance",
    "mercy": "realistic",
    "journey": "cinematic",
    "reverent": "stained_glass",
}

_MOOD_THEMES = {
    "triumphant": ("Resurrection hope", ["Victory", "Joy", "Glory"], ["hopeful", "radiant", "triumphant"]),
    "solemn": ("Repentance and conversion", ["Humility", "Vigil", "Mercy"], ["solemn", "reverent", "quiet"]),
    "mercy": ("Divine mercy", ["Healing", "Compassion", "Welcome"], ["tender", "hopeful", "intimate"]),
    "journey": ("Discipleship", ["Calling", "Perseverance", "Mission"], ["earnest", "hopeful", "reverent"]),
    "reverent": ("Sacred encounter", ["Worship", "Awe", "Faith"], ["reverent", "intimate", "hopeful"]),
}

_MOOD_METAPHOR = {
    "triumphant": "Radiant heavenly light breaking through darkness",
    "solemn": "A single warm light emerging from surrounding shadow",
    "mercy": "Soft divine light resting on the wounded and the poor",
    "journey": "A path of light leading through an open landscape",
    "reverent": "Quiet sacred light filling a still biblical space",
}

_SUBJECT_RULES: tuple[tuple[tuple[str, ...], str, str], ...] = (
    (("canaanite", "syrophoenician", "great is your faith", "o woman"), "Persistent faith", "A humble woman approaching Christ with persistent faith"),
    (("woman", "faith"), "Persistent faith", "A humble woman approaching Christ with persistent faith"),
    (("walk on", "walking on the water", "sea of galilee"), "Trust amid the storm", "Christ walking toward disciples across stormy water"),
    (("prodigal",), "The Father's mercy", "A father embracing his returning son"),
    (("good shepherd", "lost sheep"), "The Good Shepherd", "Christ the shepherd carrying a lamb"),
    (("loaves", "fishes", "five thousand", "multipli"), "Divine provision", "Christ blessing bread among a gathered crowd"),
    (("last supper", "this is my body"), "The Eucharist", "Christ at table with the apostles, bread and cup before him"),
    (("crucifix", "calvary", "golgotha"), "The Passion", "Christ on the cross beneath a darkened sky"),
    (("empty tomb", "he is risen", "resurrection"), "The Resurrection", "The empty tomb at dawn with radiant light"),
    (("annunciation", "gabriel"), "The Annunciation", "Mary receiving the angel in a quiet interior"),
    (("nativity", "manger", "bethlehem"), "The Nativity", "The Holy Family in a humble stable, warm lantern light"),
    (("baptism", "jordan"), "The Baptism of the Lord", "Christ standing in the Jordan as light descends"),
    (("blind", "sight"), "Healing of the blind", "Christ gently restoring sight to a kneeling man"),
    (("paralyt",), "Healing and forgiveness", "Christ commanding a paralytic to rise"),
    (("storm", "waves", "boat"), "Peace in the storm", "Christ calming the sea from a small fishing boat"),
)


def _blob(*parts: str) -> str:
    return " ".join((p or "").lower() for p in parts if p)


def _match_subject(blob: str) -> tuple[Optional[str], Optional[str]]:
    for keys, theme, concept in _SUBJECT_RULES:
        if any(k in blob for k in keys):
            return theme, concept
    return None, None


def analyze_gospel_visual(
    *,
    sunday_title: str = "",
    gospel_reference: str = "",
    gospel_text: str = "",
    gospel_quote: str = "",
    season_key: str = "",
) -> GospelVisualAnalysis:
    """Return structured visual direction. Does not choose layout, fonts, or copy."""
    preview = {
        "title": sunday_title,
        "gospel_reference": gospel_reference,
        "gospel_text": gospel_text,
        "gospel_quote": gospel_quote,
        "season": season_key,
    }
    mood_key = infer_gospel_mood_key_from_preview(preview)
    theme, extras, tones = _MOOD_THEMES.get(mood_key, _MOOD_THEMES["reverent"])
    blob = _blob(sunday_title, gospel_reference, gospel_text[:800], gospel_quote)
    subject_theme, concept = _match_subject(blob)
    primary = subject_theme or theme
    scene = build_visual_scene_line(sunday_title, gospel_reference, gospel_text or "")
    visual_concept = concept or scene or "A reverent Gospel encounter with Christ"
    if "woman" in visual_concept.lower():
        focal = "Woman approaching Christ"
    elif "shepherd" in visual_concept.lower():
        focal = "Christ the Good Shepherd"
    elif "disciples" in visual_concept.lower() or "boat" in visual_concept.lower():
        focal = "Christ with the disciples"
    else:
        focal = "Jesus Christ in a sacred Gospel moment"
    secondary = list(extras)
    if subject_theme and theme not in secondary:
        secondary = [theme, *secondary][:3]
    return GospelVisualAnalysis(
        primary_theme=primary,
        secondary_themes=secondary,
        emotional_tone=list(tones),
        visual_concept=visual_concept,
        visual_metaphor=_MOOD_METAPHOR.get(mood_key, _MOOD_METAPHOR["reverent"]),
        focal_subject=focal,
        environment="Biblical setting, ancient Palestine, sacred atmosphere",
        recommended_style=_MOOD_TO_STYLE.get(mood_key, AI_STYLE_DEFAULT),
        mood_key=mood_key,
    )


def analysis_from_liturgical_payload(
    data: Mapping[str, Any],
    *,
    gospel_quote: str = "",
    season_key: str = "",
) -> GospelVisualAnalysis:
    return analyze_gospel_visual(
        sunday_title=str(data.get("title") or ""),
        gospel_reference=str(data.get("gospel_reference") or ""),
        gospel_text=str(data.get("gospel_text") or ""),
        gospel_quote=gospel_quote or str(data.get("gospel_slide_quote") or ""),
        season_key=season_key or str(data.get("season") or ""),
    )
