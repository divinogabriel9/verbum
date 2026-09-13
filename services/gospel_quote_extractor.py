"""
Pick a short "slide quote" from a Gospel body.

1) Prefer passages inside quotation marks attributed to Jesus (said / answered /
   sinabi ni Hesus / sumagot si Hesus …).
2) If none, use the longest substantive quoted dialogue in the verse.
3) If there are no typographic quotes, fall back to the opening sentence/clause.

Directional “ ” are kept so print-style paragraph reopeners do not close a speech.
ASCII " still toggles open/close. Single quotes stay inner dialogue.
"""

from __future__ import annotations

import re
from typing import List, Tuple

# Sentence splitter for fallback (lightweight -- good enough for liturgical prose).
_SENT_SPLIT = re.compile(r"(?<=[.!?])\s+")

# Narration mistaken for dialogue when quote pairing goes wrong.
_NARRATOR_CHUNK = re.compile(
    r"^(?:he|she|they|jesus)\s+(?:said|answered|replied)\b"
    r"|^(?:sinabi|wika|sabi)\s+(?:niya|nila|ng)\b",
    re.IGNORECASE,
)


_JESUS_CUE = re.compile(
    r"Jesus\s+(?:answered|answered\s+them|replied|crying|crying\s+out|said|said\s+to\s+them"
    r"|said\s+to\s+(?:him|her|Simon|Philip|Nicodemus|the\s+Crowds?|(?:his\s+)?disciples"
    r"|the\s+Pharisees|the\s+woman|Thomas|Martha)|told)"
    r"|told\s+(?:them|him|her|Nicodemus|the\s+disciples|The\s+Crowds?)"
    r"|(?:sinabi|wika|sabi|tumugon|sumagot|sagot|nagsabi)"
    r"(?:\s+sa\s+\S+)?"
    r"\s+(?:ni|si)\s+(?:Hesus|Jesus|Hesukristo)\b",
    re.IGNORECASE,
)

# Others addressing Jesus / crowd lines we should not treat as "Jesus said" attribution.
_OTHER_CUE = re.compile(
    r"(?:his\s+disciples|(?:his\s+)?disciples|they|the\s+disciples|The\s+Crowds?|pilate|The\s+Pilate"
    r"|Chief\s+Priests?|scribes?\s+and\s+Pharisees|some\s+(?:Pharisees|of\s+the\s+Pharisees)"
    r")\s+said\b"
    r"|said\s+to\s+Jesus|asked\s+Jesus"
    r"|(?:sinabi|wika|sabi|tumugon|sumagot|sagot|nagsabi|nagtanong)\s+"
    r"(?:nila|ng\s+(?:mga\s+)?(?:alagad|pariseo|punong\s+saserdote|matatanda|"
    r"tao|karamihan|diyablo|manunukso|ahas))"
    r"|(?:sinabi|wika|sabi|tumugon|sumagot|sagot|nagsabi)\s+ni\s+"
    r"(?!Hesus\b|Jesus\b|Hesukristo\b)\w+"
    r"|(?:nagsabi|nagtanong|sumigaw)\s+sa\s+kanya"
    r"|sagot\s+nila",
    re.IGNORECASE,
)


def _normalize_typography(text: str) -> str:
    if not text:
        return ""
    t = (
        text.replace("\u2018", "'")
        .replace("\u2019", "'")
    )
    t = re.sub(r"\s+", " ", t).strip()
    return t


def _clean_quote_inner(inner: str) -> str:
    inner = re.sub(r"[\u201c\u201d]", "", inner or "")
    return re.sub(r"\s+", " ", inner).strip()


def _latest_match_end(pat: re.Pattern[str], hay: str) -> int | None:
    ends: List[int] = []
    for m in pat.finditer(hay):
        ends.append(m.end())
    return max(ends) if ends else None


def _immediate_after_clause(norm: str, q_close_index: int) -> str:
    """Speaker tag after a closing quote (``sagot nila.``), not the next cue."""
    after = (norm[q_close_index : q_close_index + 80] or "").lstrip(" \t,;")
    if not after or after[0] in '"\u201c':
        return ""
    clause = re.split(r'[.?!\u201c"]', after, maxsplit=1)[0].strip()
    # ``Sumagot si Hesus, “…”`` introduces the next speech, not this one.
    if not clause or clause.endswith(","):
        return ""
    return clause


def _is_jesus_attributed(
    norm: str, q_open_index: int, q_close_index: int | None = None
) -> bool:
    """True if text beside this quote is best read as Jesus speaking."""
    if q_close_index is not None:
        clause = _immediate_after_clause(norm, q_close_index)
        if clause:
            other_after = _OTHER_CUE.search(clause) is not None
            jesus_after = _JESUS_CUE.search(clause) is not None
            if other_after and not jesus_after:
                return False
            if jesus_after and not other_after:
                return True

    tail = norm[max(0, q_open_index - 320) : q_open_index]
    jesus_end = _latest_match_end(_JESUS_CUE, tail)
    other_end = _latest_match_end(_OTHER_CUE, tail)

    if jesus_end is None:
        return False
    if other_end is None or jesus_end > other_end:
        return True
    return False


def _maybe_quote_span(
    out: List[Tuple[int, int, str]], start: int, end: int, inner: str
) -> None:
    inner = _clean_quote_inner(inner)
    if len(inner) < 12 or inner.isdigit():
        return
    out.append((start, end, inner))


def _quoted_segments(norm: str) -> List[Tuple[int, int, str]]:
    """Collect double-quoted speeches.

    A second “ while a quote is already open is a paragraph continuation
    (Awit at Papuri / print lectionaries), not a closer. ASCII " still
    toggles so USCCB straight-quote pericopes keep pairing.
    """
    out: List[Tuple[int, int, str]] = []
    start: int | None = None
    i = 0
    n = len(norm)
    while i < n:
        ch = norm[i]
        if ch == "\u201c":
            if start is None:
                start = i
        elif ch == "\u201d":
            if start is not None:
                _maybe_quote_span(out, start, i + 1, norm[start + 1 : i])
                start = None
        elif ch == '"':
            if start is None:
                start = i
            else:
                _maybe_quote_span(out, start, i + 1, norm[start + 1 : i])
                start = None
        i += 1
    if start is not None:
        _maybe_quote_span(out, start, n, norm[start + 1 :])
    return out


def _trim_to(max_chars: int, text: str) -> str:
    text = re.sub(r"\s+", " ", text).strip()
    if len(text) <= max_chars:
        return text
    cut = text[: max_chars - 1]
    tail = cut.rsplit(" ", 1)
    stem = tail[0] if len(tail) == 2 and len(tail[0]) > 40 else cut
    return stem.rstrip(" ,;—") + "\u2026"


def extract_gospel_slide_quote(full_gospel_text: str, max_chars: int = 340) -> str:
    """Return one short excerpt suitable for a poster/PPT subtitle."""
    raw = (full_gospel_text or "").strip()
    if not raw:
        return ""

    norm = _normalize_typography(raw)
    spans = _quoted_segments(norm)

    jesus_chunks: List[str] = []
    for start, end, inner in spans:
        if _NARRATOR_CHUNK.match(inner):
            continue
        if _is_jesus_attributed(norm, start, end):
            jesus_chunks.append(inner)

    if jesus_chunks:
        merged = " ".join(jesus_chunks)
        merged = re.sub(r"\s+", " ", merged).strip()
        return _trim_to(max_chars, merged)

    if spans:
        dialogue = [inner for _, _, inner in spans if not _NARRATOR_CHUNK.match(inner)]
        if dialogue:
            best = max(dialogue, key=len)
            return _trim_to(max_chars, best)

    parts = _SENT_SPLIT.split(norm)
    chunk = ""
    for p in parts:
        p = p.strip()
        if not p:
            continue
        chunk = chunk + (" " if chunk else "") + p
        if len(chunk) >= min(120, max_chars):
            break
    if not chunk:
        chunk = norm
    return _trim_to(max_chars, chunk)


def split_slide_sentences(text: str) -> List[str]:
    """Split on ASCII . ? ! followed by whitespace (first full stop / clause break)."""
    raw = _normalize_typography(text or "").strip()
    if not raw:
        return []
    parts = []
    for part in _SENT_SPLIT.split(raw):
        part = part.strip()
        if not part:
            continue
        # Drop narrator fragments and tiny clauses that are not slide-worthy.
        if _NARRATOR_CHUNK.match(part) and len(part) < 48:
            continue
        if len(part) < 12:
            continue
        parts.append(part)
    return parts


def first_sentence_slide_quote(text: str) -> str:
    """Use only the first sentence (through the first . ? or ! on the slide quote)."""
    sents = split_slide_sentences(text)
    if sents:
        return sents[0]
    return _normalize_typography(text or "").strip()


def pick_sentence_interactive(sentences: List[str]) -> str:
    """Ask the user which sentence to put on the slide."""
    if not sentences:
        return ""
    if len(sentences) == 1:
        return sentences[0]
    print("\nChoose one sentence for the slide:")
    for i, s in enumerate(sentences, 1):
        preview = s if len(s) <= 220 else s[:217].rstrip() + "\u2026"
        print(f"  [{i}] {preview}")
    while True:
        choice = input(f"Enter 1-{len(sentences)} (or Enter for 1): ").strip()
        if not choice:
            return sentences[0]
        if choice.isdigit():
            n = int(choice)
            if 1 <= n <= len(sentences):
                return sentences[n - 1]
        print("Invalid choice. Enter a number in range, or press Enter.")
