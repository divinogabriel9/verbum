"""Mass surface language for Order of Mass slide texts.

English remains the default. Tagalog uses Filipino Ordo wording as printed in
common Philippine missalettes (e.g. Sambuhay / Aklat ng Pagmimisa sa Roma).
"""

from __future__ import annotations

from typing import Final

ALLOWED_MASS_LANGUAGES: Final[frozenset[str]] = frozenset({"english", "tagalog"})

# When the user picks a mass language, apply these rite defaults unless they
# explicitly override later in the wizard.
MASS_LANGUAGE_DEFAULTS: Final[dict[str, dict[str, str]]] = {
    "english": {
        "creed_choice": "nicene",
        "our_father_choice": "english",
    },
    "tagalog": {
        "creed_choice": "apostles",
        "our_father_choice": "tagalog",
    },
}


def normalize_mass_language(value: str | None) -> str:
    lang = (value or "english").strip().lower().replace("-", "_").replace(" ", "_")
    if lang in {"filipino", "fil", "tl", "tgl"}:
        lang = "tagalog"
    if lang not in ALLOWED_MASS_LANGUAGES:
        return "english"
    return lang


def defaults_for_mass_language(language: str | None) -> dict[str, str]:
    lang = normalize_mass_language(language)
    return dict(MASS_LANGUAGE_DEFAULTS.get(lang, MASS_LANGUAGE_DEFAULTS["english"]))


# Gospel Acclamation sandwich refrain. Unknown / future Mass languages fall
# back to the Latin-rite English spelling so new languages stay formatted.
GOSPEL_ACCLAMATION_REFRAIN: Final[dict[str, str]] = {
    "english": "Alleluia! Alleluia!",
    "tagalog": "Aleluya! Aleluya!",
    "visaya": "Aleluya! Aleluya!",
    "cebuano": "Aleluya! Aleluya!",
    "malay": "Alleluya! Alleluya!",
    "korean": "알렐루야! 알렐루야!",
    "chinese": "阿肋路亚！阿肋路亚！",
}

_LANGUAGE_ALIASES: Final[dict[str, str]] = {
    "filipino": "tagalog",
    "fil": "tagalog",
    "tl": "tagalog",
    "tgl": "tagalog",
    "bisaya": "visaya",
    "ceb": "cebuano",
    "en": "english",
    "bm": "malay",
    "ms": "malay",
    "ko": "korean",
    "zh": "chinese",
    "zh_cn": "chinese",
    "zh_tw": "chinese",
}


READING_SECTION_LABELS: Final[dict[str, dict[str, str]]] = {
    "english": {
        "first": "First Reading",
        "second": "Second Reading",
    },
    "tagalog": {
        "first": "Unang Pagbasa",
        "second": "Ikalawang Pagbasa",
    },
}


def reading_section_label(which: str, language: str | None) -> str:
    """Localized First / Second Reading heading for LOTW cards."""
    lang = (language or "english").strip().lower().replace("-", "_").replace(" ", "_")
    lang = _LANGUAGE_ALIASES.get(lang, lang)
    labels = READING_SECTION_LABELS.get(lang) or READING_SECTION_LABELS["english"]
    key = "second" if (which or "").strip().lower() in {"second", "2", "ii"} else "first"
    return labels.get(key) or READING_SECTION_LABELS["english"][key]


def gospel_acclamation_refrain(language: str | None) -> str:
    """Localized ``Alleluia! Alleluia!`` line for the acclamation plate."""
    lang = (language or "english").strip().lower().replace("-", "_").replace(" ", "_")
    lang = _LANGUAGE_ALIASES.get(lang, lang)
    return GOSPEL_ACCLAMATION_REFRAIN.get(lang, GOSPEL_ACCLAMATION_REFRAIN["english"])
