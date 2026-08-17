"""Mass Divider architecture: templates, styles, analysis, prompts (no image APIs)."""

from __future__ import annotations

from pathlib import Path

from services.ai_styles import get_visual_style, load_style_prompts, resolve_style_for_generation
from services.mass_divider.fields import resolve_mass_divider_fields
from services.mass_divider.gospel_analysis import analyze_gospel_visual
from services.mass_divider.prompt_builder import build_background_prompt, negative_prompt
from services.mass_divider.templates import (
    get_divider_template,
    list_divider_templates,
    resolve_divider_template_id,
)
from services.mass_divider.types import SLIDE_HEIGHT_IN, SLIDE_WIDTH_IN


def test_three_templates_registered():
    ids = {t.id for t in list_divider_templates()}
    assert ids == {"divider1", "divider2", "divider3"}


def test_boxes_stay_on_canvas():
    for template in list_divider_templates():
        for box in template.boxes.values():
            assert box.left >= -0.05
            assert box.top >= -0.05
            assert box.left + box.width <= SLIDE_WIDTH_IN + 1.0
            assert box.top + box.height <= SLIDE_HEIGHT_IN + 0.25
            assert box.max_pt >= box.min_pt >= 12


def test_divider2_composition_is_quote_left_subject_right():
    profile = get_divider_template("divider2").composition
    assert profile.subject_position == "right"
    assert profile.safe_fraction("left") >= 0.4
    assert profile.safe_fraction("bottom") >= 0.15
    assert profile.background_complexity["left"] == "low"
    assert profile.brightness_preference["left"] == "dark"


def test_layout_does_not_depend_on_visual_style():
    d2 = get_divider_template("divider2")
    cinematic = get_visual_style("cinematic")
    renaissance = get_visual_style("renaissance")
    assert cinematic.id != renaissance.id
    assert cinematic.prompt != renaissance.prompt
    for style in ("cinematic", "renaissance", "stained_glass"):
        same = get_divider_template("divider2")
        assert same.boxes["gospel_quote"].left == d2.boxes["gospel_quote"].left
        assert same.boxes["celebrant_name"].left == d2.boxes["celebrant_name"].left
        assert same.composition.visual_focus == d2.composition.visual_focus


def test_auto_layout_is_stable_for_same_mass():
    quote = "O woman, great is your faith! Let it be done for you as you wish."
    title = "20th Sunday in Ordinary Time"
    first = resolve_divider_template_id("auto", gospel_quote=quote, sunday_title=title)
    second = resolve_divider_template_id("auto", gospel_quote=quote, sunday_title=title)
    assert first == second
    assert first in {"divider1", "divider2", "divider3"}
    assert resolve_divider_template_id("divider2") == "divider2"


def test_fields_keep_celebrant_and_co_separate():
    fields = resolve_mass_divider_fields(
        gospel_quote="O woman, great is your faith!",
        gospel_reference="Matthew 15:21-28",
        celebrant="Divino Gabriel",
        co_celebrant="Fr. Joseph Cruz",
        date="2026-08-16",
        lectionary_cycle="A",
        mass_title="20th Sunday in Ordinary Time Celebration",
    )
    assert fields.celebrant == "Divino Gabriel"
    assert fields.co_celebrant == "Fr. Joseph Cruz"
    assert fields.year_cycle == "A"
    assert "Celebration" not in fields.sunday_title
    assert fields.heading == "HOLY EUCHARISTIC CELEBRATION"


def test_gospel_analysis_canaanite_woman():
    analysis = analyze_gospel_visual(
        sunday_title="20th Sunday in Ordinary Time",
        gospel_reference="Matthew 15:21-28",
        gospel_text="O woman, great is your faith! Let it be done for you as you wish.",
        gospel_quote="O woman, great is your faith!",
        season_key="ordinary_time",
    )
    payload = analysis.to_dict()
    for key in (
        "primary_theme",
        "secondary_themes",
        "emotional_tone",
        "visual_concept",
        "visual_metaphor",
        "focal_subject",
        "environment",
    ):
        assert payload[key]
    assert "faith" in analysis.primary_theme.lower() or "woman" in analysis.visual_concept.lower()
    assert "Christ" in analysis.visual_concept or "Christ" in analysis.focal_subject


def test_prompt_is_artwork_only():
    analysis = analyze_gospel_visual(
        sunday_title="20th Sunday in Ordinary Time",
        gospel_reference="Matthew 15:21-28",
        gospel_text="O woman, great is your faith!",
        gospel_quote="O woman, great is your faith!",
        season_key="ordinary_time",
    )
    template = get_divider_template("divider2")
    prompt = build_background_prompt(
        analysis=analysis,
        style=get_visual_style("cinematic"),
        profile=template.composition,
    ).lower()
    assert "do not generate readable text" in prompt
    assert "divino" not in prompt
    assert "august 16" not in prompt
    assert "holy eucharistic" not in prompt
    assert "20th sunday" not in prompt
    assert "text-safe" in prompt
    assert "cinematic" in prompt
    assert "letters" in negative_prompt()


def test_style_json_loads_structured_entries():
    prompts = load_style_prompts()
    assert set(prompts) >= {"cinematic", "realistic", "renaissance", "stained_glass", "modern"}
    stained = get_visual_style("stained_glass")
    assert stained.label
    assert "stained glass" in stained.prompt.lower()
    assert resolve_style_for_generation("auto", recommended="renaissance") == "renaissance"
    assert resolve_style_for_generation("modern") == "modern"


def test_uploaded_divider_still_wins_over_poster():
    import tempfile

    from pipeline import _resolve_divider_poster_path

    with tempfile.TemporaryDirectory() as raw:
        tmp_path = Path(raw)
        uploaded = tmp_path / "custom.png"
        uploaded.write_bytes(b"png")
        poster = tmp_path / "stem_16x9.png"
        poster.write_bytes(b"poster")
        chosen = _resolve_divider_poster_path(
            uploaded=uploaded,
            poster_ppt_path=poster,
            use_poster_as_divider=True,
        )
        assert chosen == uploaded
        assert _resolve_divider_poster_path(
            uploaded=None, poster_ppt_path=poster, use_poster_as_divider=True
        ) is None
