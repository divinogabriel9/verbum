"""
Fixed slide templates for Mass prayer rites (projection layout).

Each template defines explicit line breaks and typography so decks match
parish-approved formatting instead of auto-fitting marked text.
"""

from __future__ import annotations

from typing import Any, Final, Mapping

# Penitential Act — matches GFCC reference slide (gold priest, ALL lead, body, rubric)
PENITENTIAL_ACT: Final[dict[str, Any]] = {
    "key": "penitential_act",
    "footer": "Penitential Act",
    "body_pt": 55,
    "direction_pt": 55,
    "slides": [
        {
            "lines": [
                {
                    "style": "priest",
                    "text": (
                        "Brethren (brothers and sisters),\n"
                        "let us acknowledge our sins,"
                    ),
                },
                {
                    "style": "all_lead",
                    "text": (
                        "I confess to almighty God\n"
                        "and to you, my brothers and sisters,"
                    ),
                },
                {
                    "style": "all_body",
                    "text": (
                        "that I have greatly sinned,\n"
                        "in my thoughts and in my words,"
                    ),
                },
                {
                    "style": "all_body",
                    "text": (
                        "in what I have done and in what I have failed to do,"
                    ),
                },
                {"style": "direction", "text": "(strike chest)"},
                {
                    "style": "all_body",
                    "text": (
                        "through my fault, through my fault,\n"
                        "through my most grievous fault;"
                    ),
                },
                {
                    "style": "all_body",
                    "text": (
                        "therefore I ask blessed Mary ever-Virgin,\n"
                        "all the Angels and Saints,"
                    ),
                },
                {
                    "style": "all_body",
                    "text": (
                        "and you, my brothers and sisters,\n"
                        "to pray for me to the Lord our God."
                    ),
                },
            ],
        },
        {
            "lines": [
                {
                    "style": "priest",
                    "text": (
                        "and so prepare ourselves to celebrate the sacred mysteries."
                    ),
                },
                {
                    "style": "priest",
                    "text": (
                        "May almighty God have mercy on us, forgive us our sins, "
                        "and bring us to everlasting life."
                    ),
                },
                {"style": "all_lead", "text": "Amen."},
            ],
        },
    ],
}

_TEMPLATES: Final[dict[str, dict[str, Any]]] = {
    "penitential_act": PENITENTIAL_ACT,
    "penitential": PENITENTIAL_ACT,
}


def get_prayer_template(name: str) -> dict[str, Any] | None:
    key = (name or "").strip().lower().replace(" ", "_").replace("-", "_")
    return _TEMPLATES.get(key)


def list_prayer_template_keys() -> tuple[str, ...]:
    return tuple(sorted(_TEMPLATES.keys()))
