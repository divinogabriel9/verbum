"""Gospel Acclamation sandwich copy — refrain + verse cleanup."""

from __future__ import annotations

from services.gospel_acclamation import (
    extract_gospel_acclamation_verse,
    wrap_gospel_acclamation_verse,
)
from services.mass_language import gospel_acclamation_refrain


def test_refrain_is_language_aware():
    assert gospel_acclamation_refrain("tagalog") == "Aleluya! Aleluya!"
    assert gospel_acclamation_refrain("tl") == "Aleluya! Aleluya!"
    assert gospel_acclamation_refrain("english") == "Alleluia! Alleluia!"
    assert gospel_acclamation_refrain("korean") == "알렐루야! 알렐루야!"
    assert gospel_acclamation_refrain("unknown-future") == "Alleluia! Alleluia!"


def test_extract_strips_tagalog_wrappers():
    raw = (
        "Aleluya! Aleluya! Ang tinig ko’y pakikinggan ng kabilang sa ‘king kawan; "
        "ako’y kanilang susundan. Aleluya! Aleluya!"
    )
    assert extract_gospel_acclamation_verse(raw) == (
        "Ang tinig ko’y pakikinggan ng kabilang sa ‘king kawan; "
        "ako’y kanilang susundan."
    )


def test_extract_strips_english_wrappers():
    raw = (
        "R. Alleluia, alleluia.\n"
        "Speak, Lord, your servant is listening.\n"
        "Alleluia, alleluia."
    )
    assert extract_gospel_acclamation_verse(raw) == (
        "Speak, Lord, your servant is listening."
    )


def test_extract_strips_trailing_response_cue():
    raw = "Open our hearts, O Lord, to listen to the words of your Son. R."
    assert extract_gospel_acclamation_verse(raw) == (
        "Open our hearts, O Lord, to listen to the words of your Son."
    )
    raw_multiline = (
        "R. Alleluia, alleluia.\n"
        "Open our hearts, O Lord, to listen to the words of your Son. R.\n"
        "Alleluia, alleluia."
    )
    assert extract_gospel_acclamation_verse(raw_multiline) == (
        "Open our hearts, O Lord, to listen to the words of your Son."
    )


def test_tagalog_gospel_intro_uses_evangelist():
    from generators.powerpoint import _format_gospel_intro, _gospel_book_for_language
    from generators.gfcc_flow_content_tagalog import GOSPEL_INTRO

    assert _gospel_book_for_language("Matthew 16:21-27", "tagalog") == "San Mateo"
    assert _gospel_book_for_language("Mateo 13, 36-43", "tagalog") == "San Mateo"
    text = _format_gospel_intro(GOSPEL_INTRO, "Luke 15:1-32", "tagalog")
    assert "ayon kay San Lucas" in text
    assert "{gospel_book}" not in text


def test_tagalog_gospel_intro_splits_into_two_pairs():
    from generators.powerpoint import (
        _format_gospel_intro,
        _tagalog_gospel_dialogue_pairs,
    )
    from generators.gfcc_flow_content_tagalog import GOSPEL_INTRO

    pairs = _tagalog_gospel_dialogue_pairs(
        _format_gospel_intro(GOSPEL_INTRO, "Matthew 16:21-27", "tagalog")
    )
    assert len(pairs) == 2
    assert pairs[0] == ("Sumainyo ang Panginoon.", "At sumaiyo rin.")
    assert pairs[1][0] == "Ang Mabuting Balita ng Panginoon ayon kay San Mateo."
    assert pairs[1][1] == "Papuri sa iyo, Panginoon."


def test_verse_pt_scales_with_length():
    from generators.powerpoint import _gospel_acclamation_verse_pt

    assert _gospel_acclamation_verse_pt(["Maikli."]) == 80.0
    two = wrap_gospel_acclamation_verse(
        "Kami’y iyong pangaralan upang aming matutuhan ang Salitang bumubuhay."
    )
    pt = _gospel_acclamation_verse_pt(two)
    assert 60.0 <= pt <= 80.0
    assert pt < 80.0
    long_lines = ["salita " * 18, "salita " * 18, "salita " * 18]
    assert _gospel_acclamation_verse_pt(long_lines) == 60.0


def test_wrap_prefers_semicolon_breaks():
    verse = (
        "Ang tinig ko’y pakikinggan ng kabilang sa ‘king kawan; "
        "ako’y kanilang susundan."
    )
    lines = wrap_gospel_acclamation_verse(verse, max_chars=42)
    assert len(lines) == 2
    assert lines[0].endswith(";")
