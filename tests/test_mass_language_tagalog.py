"""Tagalog Ordo / mass_language smoke tests."""

from __future__ import annotations

from services.mass_language import defaults_for_mass_language, normalize_mass_language
from services.prayer_service import get_prayer


def test_normalize_mass_language():
    assert normalize_mass_language("tagalog") == "tagalog"
    assert normalize_mass_language("Filipino") == "tagalog"
    assert normalize_mass_language("tl") == "tagalog"
    assert normalize_mass_language("malay") == "english"
    assert normalize_mass_language(None) == "english"


def test_tagalog_defaults():
    d = defaults_for_mass_language("tagalog")
    assert d["creed_choice"] == "apostles"
    assert d["our_father_choice"] == "tagalog"


def test_tagalog_prayers_are_localized():
    gloria = get_prayer("gloria", language="tagalog")
    assert "Papuri sa Diyos" in gloria
    assert "kinalulugdan" in gloria

    creed = get_prayer("apostles_creed", language="tagalog")
    assert "Sumasampalataya ako" in creed

    lamb = get_prayer("lamb_of_god", language="tagalog")
    assert "Kordero ng Diyos" in lamb

    sanctus = get_prayer("holy_holy", language="tagalog")
    assert "Santo, Santo, Santo" in sanctus

    english = get_prayer("gloria", language="english")
    assert "Glory to God" in english


def test_tagalog_flow_module_exports():
    from generators import gfcc_flow_content_tagalog as tl

    assert "Sumainyo ang Panginoon" in tl.SIGN_CROSS
    assert "At sumaiyo rin" in tl.SIGN_CROSS
    assert "Tanggapin nawa ng Panginoon" in tl.PRAY_BRETHREN
    assert "Kordero ng Diyos" in tl.LAMB_OF_GOD or "Kordero" in tl.COMMUNION_DIALOGUE
