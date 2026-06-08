"""Gospel mood keys for hymn metadata and Mass song recommendations."""

from __future__ import annotations

from typing import Any

GOSPEL_MOOD_KEYS = ("triumphant", "solemn", "mercy", "journey", "reverent")

GOSPEL_MOOD_LABELS = {
    "triumphant": "Triumphant",
    "solemn": "Solemn",
    "mercy": "Mercy",
    "journey": "Journey",
    "reverent": "Reverent",
}

_MOOD_KEYWORDS: dict[str, tuple[str, ...]] = {
    "triumphant": (
        "alleluia",
        "alleluia",
        "hallelujah",
        "risen",
        "resurrection",
        "easter",
        "glory",
        "joyful",
        "joy to",
        "crown him",
        "triumph",
        "victory",
        "praise to the lord",
        "sing a new song",
    ),
    "solemn": (
        "repent",
        "passion",
        "cross",
        "forty days",
        "lent",
        "advent",
        "emmanuel",
        "prepare the way",
        "remember me",
        "save your people",
        "wait for the lord",
        "my song is love unknown",
    ),
    "mercy": (
        "mercy",
        "heal",
        "comfort",
        "forgiv",
        "compassion",
        "welcome",
        "afraid",
        "bread",
        "table",
        "hold your people",
        "tender",
        "bless",
    ),
    "journey": (
        "here i am",
        "send me",
        "follow",
        "go tell",
        "city of god",
        "many parts",
        "disciples",
        "mission",
        "road",
        "pilgrim",
        "lead me",
    ),
    "reverent": (
        "holy",
        "adore",
        "worship",
        "praise",
        "sanctus",
        "blessed",
        "lord of",
        "almighty",
    ),
}


def _blob_from_song(*, title: str = "", author: str = "", lyrics: str = "", seasons: Any = None) -> str:
    season_text = ""
    if isinstance(seasons, list):
        season_text = " ".join(str(s) for s in seasons)
    return " ".join(
        [
            (title or "").lower(),
            (author or "").lower(),
            (lyrics or "")[:800].lower(),
            season_text.lower().replace("_", " "),
        ]
    )


def infer_gospel_moods(
    *,
    title: str = "",
    author: str = "",
    lyrics: str = "",
    seasons: Any = None,
) -> list[str]:
    """Return one or more gospel mood tags for a hymn."""
    blob = _blob_from_song(title=title, author=author, lyrics=lyrics, seasons=seasons)
    matched: list[str] = []
    for mood in GOSPEL_MOOD_KEYS:
        if any(k in blob for k in _MOOD_KEYWORDS[mood]):
            matched.append(mood)
    if matched:
        return matched
    return ["reverent"]


def normalize_gospel_moods(raw: Any) -> list[str]:
    if not raw:
        return []
    if isinstance(raw, str):
        raw = [raw]
    if not isinstance(raw, list):
        return []
    out: list[str] = []
    for item in raw:
        key = str(item or "").strip().lower()
        if key in GOSPEL_MOOD_KEYS and key not in out:
            out.append(key)
    return out


def gospel_moods_for_song(item: dict[str, Any]) -> list[str]:
    explicit = normalize_gospel_moods(item.get("gospel_moods"))
    if explicit:
        return explicit
    return infer_gospel_moods(
        title=str(item.get("title") or ""),
        author=str(item.get("author") or ""),
        lyrics=str(item.get("lyrics") or ""),
        seasons=item.get("seasons"),
    )


def infer_gospel_mood_key_from_preview(preview: dict[str, Any]) -> str:
    season_key = str(preview.get("season") or "").lower().replace(" ", "_")
    blob = " ".join(
        [
            str(preview.get("title") or ""),
            str(preview.get("gospel_reference") or ""),
            str(preview.get("gospel_text") or "")[:600],
            str(preview.get("gospel_quote") or "")[:400],
            season_key.replace("_", " "),
        ]
    ).lower()

    if any(
        k in blob
        for k in (
            "resurrection",
            "risen",
            "empty tomb",
            "easter",
            "alleluia",
            "ascension",
            "pentecost",
        )
    ) or season_key in ("easter", "pentecost"):
        return "triumphant"
    if season_key in ("lent", "advent") or any(
        k in blob for k in ("repent", "fast", "desert", "temptation", "passion", "cross", "suffer")
    ):
        return "solemn"
    if any(
        k in blob
        for k in ("heal", "blind", "lame", "paralytic", "mercy", "forgiv", "compassion", "bless", "comfort", "weep", "touch")
    ):
        return "mercy"
    if any(
        k in blob
        for k in ("disciples", "apostles", "journey", "road", "follow", "sent ", "mission", "boat", "sea", "walk", "teach")
    ):
        return "journey"
    return "reverent"
