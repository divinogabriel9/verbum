"""Slide-kind catalog for Superadmin partial Mass generates."""

from __future__ import annotations

from typing import Any, Iterable, Optional

SLIDE_KIND_GROUPS: list[tuple[str, list[tuple[str, str]]]] = [
    (
        "Introductory rites",
        [
            ("pre_mass", "Pre-Mass"),
            ("cover", "Mass cover"),
            ("entrance", "Entrance hymn"),
            ("intro_rites", "Sign of the Cross"),
            ("penitential", "Penitential Act"),
            ("kyrie", "Kyrie"),
            ("gloria", "Gloria"),
            ("opening_prayer", "Opening prayer"),
        ],
    ),
    (
        "Liturgy of the Word",
        [
            ("lotw_title", "LOTW title"),
            ("first_reading", "First Reading"),
            ("psalm", "Responsorial Psalm"),
            ("second_reading", "Second Reading"),
            ("gospel_acclamation", "Gospel Acclamation"),
            ("creed", "Creed"),
            ("prayer_faithful", "Prayer of the Faithful"),
        ],
    ),
    (
        "Liturgy of the Eucharist",
        [
            ("offertory", "Offertory hymn"),
            ("lote_poster", "LOTE posters"),
            ("pray_brethren", "Pray, brethren"),
            ("preface", "Preface"),
            ("sanctus", "Sanctus"),
            ("mystery_of_faith", "Mystery of Faith"),
            ("great_amen", "Great Amen"),
            ("our_father", "Our Father"),
            ("sign_of_peace", "Sign of Peace"),
            ("lamb_of_god", "Lamb of God"),
            ("communion_rite", "Communion rite"),
            ("communion", "Communion hymns"),
            ("meditation", "Meditation / extras"),
            ("post_communion", "Post-communion"),
        ],
    ),
    (
        "Close",
        [
            ("welcoming", "Welcoming newcomers"),
            ("collection", "Mass collection"),
            ("food_sponsors", "Food sponsors"),
            ("sponsorship_contact", "Sponsorship contact"),
            ("merienda", "Merienda location"),
            ("custom_announcements", "Custom announcements"),
            ("confession", "Confession / images"),
            ("final_blessing", "Final blessing"),
            ("recessional", "Recessional hymn"),
            ("dividers", "Section divider covers"),
        ],
    ),
]

ALL_SLIDE_KINDS: frozenset[str] = frozenset(
    kind for _label, items in SLIDE_KIND_GROUPS for kind, _name in items
)


def normalize_slide_kinds(raw: Optional[Iterable[Any]]) -> Optional[set[str]]:
    """Return allowed kinds, or None when the request means a full deck."""
    if raw is None:
        return None
    kinds = {str(item or "").strip().lower() for item in raw}
    kinds.discard("")
    if not kinds:
        return None
    return {k for k in kinds if k in ALL_SLIDE_KINDS}


def slide_kinds_catalog() -> list[dict[str, Any]]:
    return [
        {
            "group": group,
            "items": [{"id": kid, "label": label} for kid, label in items],
        }
        for group, items in SLIDE_KIND_GROUPS
    ]
