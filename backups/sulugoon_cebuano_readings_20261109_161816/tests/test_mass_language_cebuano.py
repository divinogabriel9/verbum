"""Cebuano (Bisaya) Ordo / mass_language smoke tests."""

from __future__ import annotations

from services.mass_language import (
    defaults_for_mass_language,
    gospel_acclamation_refrain,
    normalize_mass_language,
    reading_section_label,
    readings_language_for,
)
from services.prayer_service import get_our_father, get_prayer


def test_normalize_mass_language_cebuano_aliases():
    assert normalize_mass_language("cebuano") == "cebuano"
    assert normalize_mass_language("Bisaya") == "cebuano"
    assert normalize_mass_language("visaya") == "cebuano"
    assert normalize_mass_language("ceb") == "cebuano"
    # Existing languages are untouched.
    assert normalize_mass_language("tagalog") == "tagalog"
    assert normalize_mass_language("english") == "english"
    assert normalize_mass_language("korean") == "english"


def test_cebuano_readings_fall_back_to_english():
    assert readings_language_for("cebuano") == "english"
    assert readings_language_for("tagalog") == "tagalog"
    assert readings_language_for("english") == "english"


def test_cebuano_defaults():
    d = defaults_for_mass_language("cebuano")
    assert d["creed_choice"] == "apostles"
    assert d["our_father_choice"] == "visaya"


def test_cebuano_labels_and_refrain():
    assert reading_section_label("first", "cebuano") == "Unang Pagbasa"
    assert reading_section_label("second", "bisaya") == "Ikaduhang Pagbasa"
    assert gospel_acclamation_refrain("cebuano") == "Aleluya! Aleluya!"


def test_cebuano_prayers_are_localized():
    assert "Himaya sa Dios" in get_prayer("gloria", language="cebuano")
    assert "Nagatoo ako" in get_prayer("apostles_creed", language="cebuano")
    assert "Nagatoo ako sa usa ka Dios" in get_prayer("nicene_creed", language="cebuano")
    assert "Kordero sa Dios" in get_prayer("lamb_of_god", language="cebuano")
    assert "Santos, Santos, Santos" in get_prayer("holy_holy", language="cebuano")
    assert "Ginoo, kaloy-i kami" in get_prayer("kyrie", language="cebuano")
    assert "Nagakumpisal ako" in get_prayer("penitential_act", language="cebuano")
    assert "gimantala namo" in get_prayer("mystery_of_faith", language="cebuano")
    assert "Amahan namo" in get_our_father("visaya")
    assert "Amahan namo" in get_our_father("cebuano")
    # English stays English.
    assert "Glory to God" in get_prayer("gloria", language="english")


def test_cebuano_flow_module_exports():
    from generators import gfcc_flow_content_cebuano as ceb
    from generators import gfcc_flow_content_tagalog as tl

    assert "Ang Ginoo maanaa kaninyo" in ceb.SIGN_CROSS
    assert "Ug maanaa usab kanimo" in ceb.SIGN_CROSS
    assert "Dawaton unta sa Ginoo" in ceb.PRAY_BRETHREN
    assert "Kordero sa Dios" in ceb.LAMB_OF_GOD
    assert "{gospel_book}" in ceb.GOSPEL_INTRO
    # Same vernacular surface as the Tagalog module (what the deck builder reads).
    missing = [
        name for name in dir(tl)
        if name.isupper() and not hasattr(ceb, name)
    ]
    assert not missing, f"Cebuano flow module missing: {missing}"


def test_powerpoint_section_titles_and_flow_selection():
    from generators import powerpoint as pp
    from generators import gfcc_flow_content_cebuano as ceb

    with pp._mass_lang_override("cebuano"):
        assert pp._flow() is ceb
        assert pp._section_title("lotw") == "Liturhiya sa Pulong sa Dios"
        assert pp._section_title("lamb_of_god") == "Kordero sa Dios"
        assert pp._divider_year_word() == "TUIG"
        assert pp._dialogue_labels() == ("Pari: ", "Tanan: ")
        assert pp._gospel_book_for_language("Matthew 16:21-27") == "San Mateo"
        assert not pp._use_english_rite_templates()
    # Back to English after the override.
    assert pp._section_title("lotw") == "Liturgy of the Word"
    assert pp._divider_year_word() == "YEAR"
    assert pp._gospel_book_for_language("Matthew 16:21-27", "english") == "Matthew"
