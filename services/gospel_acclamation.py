"""Gospel Acclamation verse cleanup for the Alleluia sandwich slide."""

from __future__ import annotations

import re

# Alleluia / Aleluya / Alleluya plus CJK spellings used in future Mass languages.
_ALLELUIA_TOKEN = (
    r"(?:alleluia|aleluya|alleluya|알렐루야|阿肋路亚)"
)
_ALLELUIA_ONLY_LINE_RE = re.compile(
    rf"^(?:R\.?\s*)?(?:{_ALLELUIA_TOKEN}[\s!,.]*)+$",
    flags=re.IGNORECASE,
)
_LEADING_ALLELUIA_RE = re.compile(
    rf"^(?:R\.?\s*)?(?:{_ALLELUIA_TOKEN}[\s!,.]*)+",
    flags=re.IGNORECASE,
)
_TRAILING_ALLELUIA_RE = re.compile(
    rf"(?:{_ALLELUIA_TOKEN}[\s!,.]*)+$",
    flags=re.IGNORECASE,
)


def extract_gospel_acclamation_verse(verse: str) -> str:
    """Strip lectionary Alleluia wrappers; keep only the sung verse body."""
    raw = (verse or "").strip()
    if not raw:
        return ""
    raw = re.sub(r"^R\.?\s*", "", raw, flags=re.I).strip()
    kept: list[str] = []
    for ln in re.split(r"\n+", raw):
        line = ln.strip()
        if not line or _ALLELUIA_ONLY_LINE_RE.match(line):
            continue
        line = _LEADING_ALLELUIA_RE.sub("", line).strip()
        line = _TRAILING_ALLELUIA_RE.sub("", line).strip()
        if line and not _ALLELUIA_ONLY_LINE_RE.match(line):
            kept.append(line)
    return "\n".join(kept).strip()


def wrap_gospel_acclamation_verse(verse: str, *, max_chars: int = 42) -> list[str]:
    """Keep authored line breaks; otherwise wrap to projector-width lines."""
    raw = (verse or "").strip()
    if not raw:
        return []
    if "\n" in raw:
        return [ln.strip() for ln in raw.splitlines() if ln.strip()]
    if ";" in raw and len(raw) > max_chars:
        parts = [p.strip() for p in re.split(r"(?<=;)\s*", raw) if p.strip()]
        if 2 <= len(parts) <= 6:
            return parts
    words = raw.split()
    lines: list[str] = []
    buf: list[str] = []
    for word in words:
        trial = " ".join(buf + [word])
        if buf and len(trial) > max_chars:
            lines.append(" ".join(buf))
            buf = [word]
        else:
            buf.append(word)
    if buf:
        lines.append(" ".join(buf))
    return lines
