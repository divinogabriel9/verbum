"""
Pick a short "slide quote" from a Gospel body.

1) Prefer passages inside quotation marks attributed to Jesus (answered / said ...).
2) If none, use the longest substantive quoted dialogue in the verse.
3) If there are no typographic quotes, fall back to the opening sentence/clause.

Curly quotes are normalized to ASCII " for matching.
"""

from __future__ import annotations

import re
from typing import List, Tuple

# After _normalize_typography(), typographic double quotes become ASCII ".
_PAIR_RE = re.compile(r'"([^"]{12,}?)"')

# Sentence splitter for fallback (lightweight -- good enough for liturgical prose).
_SENT_SPLIT = re.compile(r"(?<=[.!?])\s+")


_JESUS_CUE = re.compile(
    r"Jesus\s+(?:answered|answered\s+them|replied|crying|crying\s+out|said|said\s+to\s+them"
    r"|said\s+to\s+(?:him|her|Simon|Philip|Nicodemus|the\s+Crowds?|(?:his\s+)?disciples"
    r"|the\s+Pharisees|the\s+woman|Thomas|Martha))"
    r"|told\s+(?:them|him|her|Nicodemus|the\s+disciples|The\s+Crowds?)",
    re.IGNORECASE,
)

# Others addressing Jesus / crowd lines we should not treat as "Jesus said" attribution.
_OTHER_CUE = re.compile(
    r"(?:his\s+disciples|(?:his\s+)?disciples|they|the\s+disciples|The\s+Crowds?|pilate|The\s+Pilate"
    r"|Chief\s+Priests?|scribes?\s+and\s+Pharisees|some\s+(?:Pharisees|of\s+the\s+Pharisees)"
    r")\s+said\b"
    r"|said\s+to\s+Jesus|asked\s+Jesus",
    re.IGNORECASE,
)


def _normalize_typography(text: str) -> str:
    if not text:
        return ""
    t = (
        text.replace("\u2018", "'")
        .replace("\u2019", "'")
        .replace("\u201c", '"')
        .replace("\u201d", '"')
    )
    t = re.sub(r"\s+", " ", t).strip()
    return t


def _latest_match_end(pat: re.Pattern[str], hay: str) -> int | None:
    ends: List[int] = []
    for m in pat.finditer(hay):
        ends.append(m.end())
    return max(ends) if ends else None


def _is_jesus_attributed(norm: str, q_open_index: int) -> bool:
    """True if text immediately before the opening quote is best read as Jesus speaking."""
    tail = norm[max(0, q_open_index - 320) : q_open_index]
    jesus_end = _latest_match_end(_JESUS_CUE, tail)
    other_end = _latest_match_end(_OTHER_CUE, tail)

    if jesus_end is None:
        return False
    if other_end is None or jesus_end > other_end:
        return True
    return False


def _quoted_segments(norm: str) -> List[Tuple[int, int, str]]:
    out: List[Tuple[int, int, str]] = []
    for m in _PAIR_RE.finditer(norm):
        inner = (m.group(1) or "").strip()
        if len(inner) < 12:
            continue
        if inner.isdigit():
            continue
        out.append((m.start(), m.end(), inner))
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
    for start, _, inner in spans:
        if _is_jesus_attributed(norm, start):
            jesus_chunks.append(inner)

    if jesus_chunks:
        merged = " ".join(jesus_chunks)
        merged = re.sub(r"\s+", " ", merged).strip()
        return _trim_to(max_chars, merged)

    if spans:
        best = max(spans, key=lambda x: len(x[2]))
        return _trim_to(max_chars, best[2])

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
        if part:
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
