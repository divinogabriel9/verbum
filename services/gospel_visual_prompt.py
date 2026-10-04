"""
Build a *short* visual description for image models from Gospel text — not a poster quote.

Goal: prompts like “Jesus walking on the water”: concrete, figure-friendly, no scripture
pasted into the prompt and no typography instructions that fight the layout model.
"""

from __future__ import annotations

import re

_AMEN_LEAD = re.compile(r"^(\s*amen\s*,?\s*)+", re.IGNORECASE)
_I_SAY = re.compile(r"\bi\s+say\s+to\s+you\b[^.?!]*[.?!]?\s*", re.IGNORECASE)
_VERILY = re.compile(r"\bverily\b[,.\s]*", re.IGNORECASE)


def _flatten(text: str) -> str:
    t = text.replace("\u201c", " ").replace("\u201d", " ").replace("\u2018", " ").replace("\u2019", " ")
    t = t.replace('"', " ").replace("'", " ")
    t = re.sub(r"\[[^\]]{0,200}\]", " ", t)
    t = re.sub(r"\s+", " ", t).strip()
    return t


def _strip_leading_verse_tokens(words: list[str]) -> list[str]:
    """Drop NAB-style leading verse numbers."""
    out = list(words)
    while out and out[0].isdigit():
        out = out[1:]
    return out


def _trim_boilerplate(phrase: str) -> str:
    s = _AMEN_LEAD.sub("", phrase).strip()
    s = _VERILY.sub("", s).strip()
    s = _I_SAY.sub("", s).strip()
    return s


# Strip Gospel *speech* introducers so we do not feed dialogue into the image model
# (models often render dialogue as fake subtitles / misspelled words on the canvas).
_SPEECH_INTRO = re.compile(
    r"^\s*(jesus\s+said\s+to\s+(?:his\s+)?disciples|he\s+said\s+to\s+them|"
    r"they\s+said\s+to\s+him|pilate\s+(?:asked|said)|the\s+crowd\s+said)\s*[:,]\s*",
    re.IGNORECASE,
)


def _strip_speech_introducers(text: str) -> str:
    t = text.strip()
    prev = None
    while prev != t:
        prev = t
        t = _SPEECH_INTRO.sub("", t).strip()
    return t


# Opening patterns that read like direct speech / transcript — never use verbatim (typography risk).
_TRANSCRIPT_PREFIXES = (
    "when the ",
    "when he ",
    "if you ",
    "if they ",
    "whoever ",
    "who do ",
    "blessed are ",
    "you are ",
    "i am ",
    "amen, amen",
    "receive ",
    "peace be with",
    "what good ",
    "why do ",
    "how can ",
    "do not ",
    "do not be ",
    "unless ",
    "because you ",
)


def _looks_like_spoken_transcript(s: str) -> bool:
    head = (s or "").strip()[:320].lower()
    return any(head.startswith(p) for p in _TRANSCRIPT_PREFIXES)


# Used only when we have almost no liturgical cues — still avoid the stock open-arm pose.
_SAFE_SCENE_FALLBACK = (
    "a concrete Gospel encounter told through gesture, place, and relationship — "
    "not a generic outdoor teaching circle"
)

# Dialogue-heavy pericopes → visual icons (never paste speech; models paint fake subtitles).
_PARABLE_VISUALS: tuple[tuple[tuple[str, ...], str], ...] = (
    (("sower", "seed fell", "rocky ground", "among thorns", "good soil"),
     "a sower casting seed across path, rocks, thorns, and rich soil on a hillside"),
    (("mustard seed", "birds of the air"),
     "tiny mustard seed in an open palm before a large sheltering shrub with nesting birds"),
    (("vine", "branches", "vinedresser"),
     "living vineyard vine with fruitful branches under a vinedresser's tending hands"),
    (("wedding feast", "wedding banquet", "marriage feast", "wedding garment"),
     "king confronting a silent guest without a wedding garment in a lamp-lit banquet hall, attendants turning him toward the dark doorway outside"),
    (("ten virgins", "wise virgins", "foolish virgins"),
     "wise virgins with bright lamps and foolish virgins with empty lamps as the bridegroom arrives at night"),
    (("five talents", "buried it in the ground", "ten minas", "wicked lazy"),
     "a master reckoning accounts as one servant returns a single buried coin"),
    (("eleventh hour", "denarius a day", "hired laborers for his vineyard"),
     "equal denarii paid at the vineyard gate while early workers protest"),
    (("went up to the temple to pray", "be merciful to me a sinner", "pharisee and the tax collector"),
     "proud Pharisee praying upright while a tax collector bows beating his breast"),
    (("sheep and the goats", "least of these", "when did we see you hungry"),
     "Christ separating a crowd — mercy given on one side, indifference turning away on the other"),
    (("samaritan", "bandits", "half-dead"),
     "a Samaritan kneeling to bind a wounded traveler's wounds on a lonely road"),
    (("prodigal",),
     "a father running to embrace his returning son on a dusty estate road"),
    (("lost sheep", "good shepherd", "ninety-nine"),
     "a shepherd carrying a lamb across rocky pasture at dusk"),
    (("render to caesar", "denarius", "whose image", "tribute"),
     "hands holding up a denarius between Christ and questioners in the temple courts"),
    (("blessed are", "poor in spirit", "beatitude"),
     "Christ seated on a hillside teaching a crowd seated on the slope below"),
    (("wash", "feet", "basin"),
     "Christ kneeling with basin and towel washing a disciple's feet"),
    (("tax collector", "zacchaeus", "sycamore"),
     "Zacchaeus in a sycamore as Christ looks up and calls him down"),
    (("martha", "mary", "better part"),
     "Mary seated listening at Christ's feet while Martha pauses mid-service"),
    (("children", "little children", "become like"),
     "Christ seated welcoming little children brought close to him"),
    (("send", "two by two", "harvest is abundant", "laborers are few"),
     "Christ sending pairs of disciples outward along diverging village roads"),
    (("lazarus", "come out"),
     "Lazarus stepping from a tomb as Christ calls him forth"),
    (("transfigur", "dazzling white", "moses and elijah"),
     "Christ radiant on a mountain peak with Moses and Elijah in glory"),
    (("emmaus", "eyes were opened"),
     "Christ breaking bread at a wayside table as two disciples recognize him"),
    (("blind", "bartimaeus", "receive your sight"),
     "Christ touching the eyes of a kneeling blind man by the roadside"),
    (("paralyt", "mat"),
     "a healed man rising and rolling his mat while Christ gestures him forward"),
    (("storm", "waves", "boat", "be still"),
     "Christ calming violent waves from a small fishing boat"),
    (("loaves", "fishes", "five thousand"),
     "Christ blessing bread and fish as baskets pass through a hillside crowd"),
)


def _parable_visual_from_blob(blob: str) -> str:
    for keys, visual in _PARABLE_VISUALS:
        if any(k in blob for k in keys):
            return visual
    return ""


def _visual_line_from_feast_and_ref(title: str, ref: str, gospel_plaintext: str = "") -> str:
    t = title.strip() or "Sunday Mass"
    blob = f"{t} {ref} {gospel_plaintext}".lower()
    parable = _parable_visual_from_blob(blob)
    if parable:
        return f"{t}, sacred Gospel scene ({ref}): {parable}"
    return (
        f"{t} ({ref}): story-specific Gospel encounter through gesture, place, "
        "and relationship — not a generic outdoor teaching circle"
    )

_WEAK_TAIL = frozenset(
    {
        "and",
        "or",
        "the",
        "a",
        "an",
        "of",
        "in",
        "for",
        "to",
        "with",
        "that",
        "when",
        "where",
        "on",
        "by",
        "as",
        "at",
    }
)


def _drop_weak_trailing_words(words: list[str], *, min_keep: int = 6) -> list[str]:
    w = list(words)
    while len(w) > min_keep:
        tail = w[-1].lower().strip(",.;:\"'")
        if tail in _WEAK_TAIL:
            w.pop()
        else:
            break
    return w


def build_visual_scene_line(
    liturgical_title: str,
    gospel_reference: str,
    gospel_plaintext: str,
    *,
    max_words: int = 14,
    max_chars: int = 140,
) -> str:
    """
    One short English line describing *who does what* for the hero image.

    Avoids pasting Gospel *dialogue* into the prompt — models often paint that as fake
    subtitles (garbled spelling). Uses physical scene language or a safe feast-based fallback.
    """
    title = (liturgical_title or "").replace(" Celebration", "").strip()
    ref = (gospel_reference or "").strip() or "the Gospel"
    body = _flatten(gospel_plaintext or "")

    # Prefer parable / pericope icons before any dialogue excerpt (avoids fake subtitles
    # and the old "Jesus teaching outdoors" sameness).
    parable = _parable_visual_from_blob(f"{title} {ref} {body}".lower())
    if parable:
        out = f"{title}, {parable}" if title else parable
        return out[:max_chars] if len(out) > max_chars else out

    if not body:
        if title:
            return f"{title}, sacred moment from {ref}"
        return f"sacred Gospel scene from {ref}"

    body = _strip_speech_introducers(body)
    words = _strip_leading_verse_tokens(body.split())
    if not words:
        return _visual_line_from_feast_and_ref(title, ref, gospel_plaintext)

    chunk = _drop_weak_trailing_words(words[:max_words])
    phrase = " ".join(chunk)
    phrase = _trim_boilerplate(phrase)
    if not phrase:
        phrase = " ".join(words[:max_words])

    if _looks_like_spoken_transcript(phrase):
        out = _visual_line_from_feast_and_ref(title, ref, gospel_plaintext)
        return out[:max_chars] if len(out) > max_chars else out
    if len(phrase) > max_chars:
        phrase = phrase[: max_chars - 1].rsplit(" ", 1)[0]

    lowered = phrase.lower()
    if not any(
        x in lowered
        for x in (
            "jesus",
            "christ",
            "lord ",
            "lord,",
            "disciples",
            "apostles",
            "peter",
            "mary",
            "shepherd",
            "crowd",
            "pharise",
            "pilate",
            "woman",
            "man ",
            "men ",
            "child",
            "blind",
            "lame",
            "paralytic",
        )
    ):
        phrase = (f"Jesus and followers: {phrase}").strip()
        if len(phrase) > max_chars + 20:
            phrase = phrase[: max_chars + 19].rsplit(" ", 1)[0]

    if title and len(phrase) < 40:
        phrase = f"{phrase}; {title}"

    if len(phrase) > max_chars:
        phrase = phrase[: max_chars - 1].rsplit(" ", 1)[0]
    return phrase
