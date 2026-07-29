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
