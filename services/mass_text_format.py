"""Reading synopsis, won formatting, and lyric cleanup for Mass exports."""

from __future__ import annotations

import re

_VERSE_LINE_RE = re.compile(r"^\s*\d{1,3}\s*[:.)]\s*", re.MULTILINE)
_INLINE_VERSE_RE = re.compile(r"\b\d{1,3}\s*[:.)]\s*")
_STANDALONE_VERSE_LINE = re.compile(
    r"^\s*(\(\d+\)|\d{1,3}(?:\s*[-–—]\s*\d{1,3})?)\s*$"
)
_REFRAIN_ONLY_LINE = re.compile(r"^R\.?\s", re.I)


def strip_leading_verse_markers(text: str) -> str:
    """Remove duplicated verse numbers at line starts and compact inline verse markers."""
    t = (text or "").strip()
    if not t:
        return ""
    t = _VERSE_LINE_RE.sub("", t)
    t = _INLINE_VERSE_RE.sub(" ", t)
    return re.sub(r"\s+", " ", t).strip()


_PAREN_VERSE_START = re.compile(r"^\s*\(\s*\d{1,3}\s*\)\s*")


def strip_reading_verse_markers(text: str) -> str:
    """
    Strip verse-style numbering from lectionary text while preserving line breaks
    (unlike ``strip_leading_verse_markers``, which collapses to a synopsis line).
    """
    raw = (text or "").strip()
    if not raw:
        return ""
    out: list[str] = []
    for line in raw.split("\n"):
        s = line.strip()
        if _STANDALONE_VERSE_LINE.match(s):
            continue
        s = _VERSE_LINE_RE.sub("", line)
        s = _PAREN_VERSE_START.sub("", s)
        s = re.sub(r"^\s*\[\s*\d{1,3}\s*\]\s*", "", s)
        if s.strip():
            out.append(s.rstrip())
    return "\n".join(out)


def reading_body_is_usable(text: str, reference: str = "") -> bool:
    """
    True when ``text`` is real lectionary prose, not a citation or verse-number shell.
    """
    from services.gospel_fallback import gospel_reference_looks_like_citation_only

    t = (text or "").strip()
    if not t:
        return False
    if gospel_reference_looks_like_citation_only(reference, t):
        return False

    substantive: list[str] = []
    for line in t.splitlines():
        s = line.strip()
        if not s or _STANDALONE_VERSE_LINE.match(s):
            continue
        if _REFRAIN_ONLY_LINE.match(s):
            words = re.findall(r"[A-Za-z]{4,}", s)
            if len(words) >= 4:
                substantive.append(s)
            continue
        words = re.findall(r"[A-Za-z]{4,}", s)
        if len(words) >= 2 or (len(words) >= 1 and len(s) > 48):
            substantive.append(s)

    if not substantive:
        return False
    joined = " ".join(substantive)
    return len(re.findall(r"[A-Za-z]{4,}", joined)) >= 6


def synopsis_from_reading(full_text: str, *, max_chars: int = 380) -> str:
    """
    Short synopsis for slides (best-effort from plain text).
    Returns empty string when no usable text.
    """
    t = strip_leading_verse_markers(full_text)
    if not t:
        return ""
    # Prefer first one or two sentences
    parts = re.split(r"(?<=[.!?])\s+", t)
    buf = ""
    for p in parts:
        p = p.strip()
        if not p:
            continue
        spacer = " " if buf else ""
        if len(buf) + len(spacer) + len(p) <= max_chars:
            buf = spacer.join([buf, p]).strip() if buf else p
        else:
            break
    if buf:
        return buf[:max_chars].rstrip()
    return t[:max_chars].rstrip()


def format_krw_won(amount_raw: str) -> str:
    """Format amount as '###,### won' (Korean-style grouping)."""
    s = re.sub(r"[^\d]", "", str(amount_raw or ""))
    if not s:
        return ""
    try:
        n = int(s)
    except ValueError:
        return ""
    return f"{n:,} won"


def clean_lyrics_for_projection(lyrics: str) -> str:
    """
    Remove structure labels (refrain, verse, chorus, stanza, bridge, response)
    as standalone lines; collapse extra blank lines.
    """
    raw = (lyrics or "").splitlines()
    out: list[str] = []
    label_re = re.compile(
        r"^\s*(refrain|verse|chorus|stanza|bridge|response|coda|intro|vamp)(\s+\d+)?\s*[:.)-]?\s*$",
        re.IGNORECASE,
    )
    for line in raw:
        stripped = line.strip()
        if not stripped:
            if out and out[-1] != "":
                out.append("")
            continue
        if label_re.match(stripped):
            continue
        out.append(line.rstrip())
    text = "\n".join(out)
    text = re.sub(r"\n{3,}", "\n\n", text).strip()
    return text
