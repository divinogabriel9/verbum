"""Parse Verbum Song Catalog .txt exports (single or multi-song).

Format (Gemini-friendly)::

    ===SONG===
    TITLE: …
    AUTHOR: …
    SECTION: entrance|offertory|communion|recessional|meditation
    MOODS: triumphant, solemn, mercy, journey, reverent
    LANGUAGE: English|Tagalog|Mix
    SEASONS: all  (optional)
    LYRICS:
    Verse 1
    …

    Chorus
    …
    ===END===

    ---

    ===SONG===
    …
    ===END===

Also accepts TextEdit/Word ``.rtf`` (highlights often break ``===SONG===`` into ``=SONG=``).
"""

from __future__ import annotations

import re
from typing import Any

from services.gospel_mood import normalize_gospel_moods
from services.hymn_catalog_store import catalog_sections

_SECTIONS = set(catalog_sections())
_SONG_START_RE = re.compile(r"^={1,3}\s*SONG\s*={1,3}\s*$", re.IGNORECASE | re.MULTILINE)
_SONG_END_RE = re.compile(r"^={1,3}\s*END\s*={1,3}\s*$", re.IGNORECASE | re.MULTILINE)
_SONG_SEP_RE = re.compile(r"^---\s*$", re.MULTILINE)
_FIELD_RE = re.compile(
    r"^(TITLE|AUTHOR|SECTION|SECTIONS|MASS[_ ]?PART|MOOD|MOODS|GOSPEL[_ ]?MOODS|"
    r"LANGUAGE|LANG|SEASONS?)\s*:\s*(.*)$",
    re.IGNORECASE,
)
_LYRICS_RE = re.compile(r"^LYRICS\s*:\s*(.*)$", re.IGNORECASE)
_ALLOWED_SEASONS = frozenset(
    {
        "all",
        "ordinary_time",
        "advent",
        "christmas",
        "lent",
        "easter",
        "pentecost",
        "ordinary",
    }
)
_SEASON_ALIASES = {
    "ordinary": "ordinary_time",
    "ot": "ordinary_time",
}
_RTF_HEX_ESCAPE = re.compile(r"\\'([0-9a-fA-F]{2})")


def looks_like_rtf(text: str) -> bool:
    head = (text or "").lstrip()[:64].lower()
    return head.startswith("{\\rtf")


def strip_rtf(text: str) -> str:
    """
    Best-effort plain text from simple TextEdit/Word RTF.

    Uses a small state scanner so line breaks survive (TextEdit often ends
    each visual line with ``\\`` + newline, and highlights split ``===SONG===``).
    """
    raw = (text or "").replace("\r\n", "\n").replace("\r", "\n")
    if not looks_like_rtf(raw):
        return raw

    out: list[str] = []
    i = 0
    n = len(raw)
    # Skip nested destinations like {\fonttbl…}, {\*\…}
    skip_depth = 0

    while i < n:
        ch = raw[i]

        if ch == "{":
            # Destination group? {\* or {\fonttbl / \colortbl / …
            nxt = raw[i + 1 : i + 12]
            if skip_depth > 0:
                skip_depth += 1
                i += 1
                continue
            if nxt.startswith("\\*") or re.match(
                r"\\(fonttbl|colortbl|stylesheet|info|header|footer|pict|object|expandedcolortbl)",
                nxt,
                re.IGNORECASE,
            ):
                skip_depth = 1
                i += 1
                continue
            i += 1
            continue

        if ch == "}":
            if skip_depth > 0:
                skip_depth -= 1
            i += 1
            continue

        if skip_depth > 0:
            i += 1
            continue

        if ch == "\\":
            if i + 1 >= n:
                break
            nxt = raw[i + 1]

            # Escaped specials
            if nxt in "{}\\":
                out.append(nxt)
                i += 2
                continue

            # Hex char: \'hh
            if nxt == "'" and i + 3 < n:
                hx = raw[i + 2 : i + 4]
                if re.fullmatch(r"[0-9a-fA-F]{2}", hx):
                    try:
                        out.append(bytes([int(hx, 16)]).decode("cp1252", errors="replace"))
                    except Exception:
                        pass
                    i += 4
                    continue

            # Unicode: \uN?
            if nxt == "u":
                m = re.match(r"\\u(-?\d+)\??", raw[i:])
                if m:
                    try:
                        code = int(m.group(1))
                        if code < 0:
                            code += 65536
                        out.append(chr(code))
                    except Exception:
                        pass
                    i += len(m.group(0))
                    continue

            # Control word: \par \line \tab \cb3 \f0 …
            m = re.match(r"\\([a-zA-Z]+)(-?\d*) ?", raw[i:])
            if m:
                word = m.group(1).lower()
                if word in {"par", "line", "page", "cell"}:
                    out.append("\n")
                elif word == "tab":
                    out.append("\t")
                # else drop (\cb, \cf, \f, \fs, \outl, …)
                i += len(m.group(0))
                continue

            # Lone backslash before newline = soft break (common in Apple RTF)
            if nxt == "\n":
                out.append("\n")
                i += 2
                continue

            # Unknown control symbol — skip backslash + one char
            i += 2
            continue

        if ch == "\n":
            # RTF source newlines are insignificant unless we already emitted breaks
            i += 1
            continue

        out.append(ch)
        i += 1

    text_out = "".join(out)
    text_out = text_out.replace("\u00a0", " ")
    text_out = re.sub(r"[ \t]+\n", "\n", text_out)
    text_out = re.sub(r"\n{3,}", "\n\n", text_out)
    return text_out.strip()


def normalize_verbum_markers(text: str) -> str:
    """Repair RTF/highlight damage: ``=SONG=`` / ``==SONG==`` → ``===SONG===``."""
    raw = (text or "").replace("\r\n", "\n").replace("\r", "\n")
    # Markers may sit on their own line, or get glued to TITLE: after bad strip
    raw = re.sub(
        r"={1,3}\s*SONG\s*={1,3}",
        "\n===SONG===\n",
        raw,
        flags=re.IGNORECASE,
    )
    raw = re.sub(
        r"={1,3}\s*END\s*={1,3}",
        "\n===END===\n",
        raw,
        flags=re.IGNORECASE,
    )
    raw = re.sub(r"\n{3,}", "\n\n", raw)
    return raw.strip()


_INLINE_FIELD_NAMES = (
    r"TITLE|AUTHOR|SECTION|SECTIONS|MASS[_ ]?PART|MOODS?|GOSPEL[_ ]?MOODS|"
    r"LANGUAGE|LANG|SEASONS?|LYRICS"
)
_STRUCTURE_INLINE_NAMES = (
    r"pre[- ]?chorus|post[- ]?chorus|pre[- ]?verse|post[- ]?verse|middle[- ]?8|"
    r"refrain|verse|chorus|stanza|bridge|response|coda|intro|vamp|outro|"
    r"interlude|instrumental|ending|finale|hook|breakdown|spoken|solo|"
    r"ad[- ]?lib|tag|turnaround|chant"
)


def expand_inline_verbum_layout(text: str) -> str:
    """
    Expand Gemini/TextEdit one-line songs into line-oriented Verbum layout.

    Handles blobs like::

        ===SONG=== TITLE: Foo AUTHOR: SECTION: entrance … LYRICS: Chorus …
        Verse 1 … =END=
    """
    raw = (text or "").replace("\r\n", "\n").replace("\r", "\n")
    if not raw.strip():
        return ""

    # Put each metadata field on its own line (also AUTHOR:SECTION: with no space).
    raw = re.sub(
        rf"(?i)\s*(?=({_INLINE_FIELD_NAMES})\s*:)",
        "\n",
        raw,
    )

    # LYRICS: <text> → LYRICS: then body on the next line
    raw = re.sub(r"(?im)^(LYRICS)\s*:\s*(?=\S)", r"\1:\n", raw)

    # Mid-stream structure headers: "…puso Verse 1 Purihin…" / "…puso Chorus Pumasok…"
    raw = re.sub(
        rf"(?i)(?<=\S)\s+(?=((?:\[|\()?\s*(?:{_STRUCTURE_INLINE_NAMES})"
        rf"(?:[ \t]+\d+)?\s*(?:\]|\))?\s*:?)(?:\s+|$))",
        "\n",
        raw,
    )

    # Header sharing a line with lyric text: "Chorus Pumasok…" / "Verse 1 Purihin…"
    raw = re.sub(
        rf"(?im)^([ \t]*(?:\[|\()?\s*(?:{_STRUCTURE_INLINE_NAMES})"
        rf"(?:[ \t]+\d+)?\s*(?:\]|\))?\s*:?)[ \t]+(?=[A-Za-zÀ-ÿ\"'“‘])",
        r"\1\n",
        raw,
    )

    # Blank line before each structure header (slide/block separation)
    try:
        from services.mass_text_format import ensure_lyric_section_breaks

        raw = ensure_lyric_section_breaks(raw)
    except Exception:
        pass

    raw = re.sub(r"[ \t]+\n", "\n", raw)
    raw = re.sub(r"\n{3,}", "\n\n", raw)
    return raw.strip()


def prepare_upload_text(text: str) -> str:
    """Strip RTF (if any), repair markers, and expand flattened one-line songs."""
    plain = strip_rtf(text)
    marked = normalize_verbum_markers(plain)
    return expand_inline_verbum_layout(marked)


def looks_like_verbum_song_txt(text: str) -> bool:
    """True when the blob uses Verbum multi-field song markers."""
    raw = prepare_upload_text(text)
    if not raw.strip():
        return False
    if _SONG_START_RE.search(raw):
        return True
    has_title = bool(re.search(r"^TITLE\s*:", raw, re.IGNORECASE | re.MULTILINE))
    has_section = bool(
        re.search(r"^(SECTION|SECTIONS|MASS[_ ]?PART)\s*:", raw, re.IGNORECASE | re.MULTILINE)
    )
    has_lyrics = bool(re.search(r"^LYRICS\s*:", raw, re.IGNORECASE | re.MULTILINE))
    return has_title and has_section and has_lyrics


def _split_list(value: str) -> list[str]:
    parts: list[str] = []
    for chunk in re.split(r"[,;/|]+", value or ""):
        item = chunk.strip()
        if item:
            parts.append(item)
    return parts


def _normalize_section(raw: str) -> str:
    key = re.sub(r"[\s-]+", "_", (raw or "").strip().lower())
    aliases = {
        "entrance_hymn": "entrance",
        "gathering": "entrance",
        "opening": "entrance",
        "offering": "offertory",
        "gifts": "offertory",
        "preparation": "offertory",
        "eucharist": "communion",
        "holy_communion": "communion",
        "closing": "recessional",
        "sending": "recessional",
        "dismissal": "recessional",
        "reflection": "meditation",
        "silent": "meditation",
    }
    key = aliases.get(key, key)
    return key if key in _SECTIONS else ""


def _normalize_seasons(raw: str | list[str] | None) -> list[str]:
    if isinstance(raw, list):
        items = [str(x) for x in raw]
    else:
        items = _split_list(str(raw or ""))
    out: list[str] = []
    for item in items:
        key = re.sub(r"[\s-]+", "_", item.strip().lower())
        key = _SEASON_ALIASES.get(key, key)
        if key in _ALLOWED_SEASONS and key not in out:
            out.append("ordinary_time" if key == "ordinary" else key)
    return out or ["all"]


def _normalize_language(raw: str) -> str:
    lang = (raw or "").strip()
    if not lang:
        return "Tagalog"
    low = lang.lower()
    if low in {"tl", "fil", "filipino", "tagalog"}:
        return "Tagalog"
    if low in {"en", "eng", "english"}:
        return "English"
    if low in {"mix", "mixed", "bilingual"}:
        return "Mix"
    return lang[:40]


def _extract_song_chunks(text: str) -> list[str]:
    raw = (text or "").replace("\r\n", "\n").replace("\r", "\n").strip()
    if not raw:
        return []

    starts = list(_SONG_START_RE.finditer(raw))
    if starts:
        chunks: list[str] = []
        for i, match in enumerate(starts):
            start = match.end()
            end = starts[i + 1].start() if i + 1 < len(starts) else len(raw)
            body = raw[start:end]
            end_m = _SONG_END_RE.search(body)
            if end_m:
                body = body[: end_m.start()]
            body = body.strip()
            if body:
                chunks.append(body)
        return chunks

    # No ===SONG=== markers: split on --- if multiple field blocks exist.
    parts = [p.strip() for p in _SONG_SEP_RE.split(raw) if p.strip()]
    if len(parts) > 1:
        return parts
    return [raw]


def _parse_song_chunk(chunk: str) -> dict[str, Any] | None:
    lines = (chunk or "").split("\n")
    fields: dict[str, str] = {}
    lyrics_lines: list[str] | None = None

    for line in lines:
        if lyrics_lines is not None:
            lyrics_lines.append(line)
            continue
        lyr = _LYRICS_RE.match(line.strip())
        if lyr:
            lyrics_lines = []
            first = (lyr.group(1) or "").rstrip()
            if first:
                lyrics_lines.append(first)
            continue
        field = _FIELD_RE.match(line.strip())
        if field:
            key = re.sub(r"[\s]+", "_", field.group(1).strip().upper())
            key = key.replace("MASS_PART", "SECTION").replace("MASSPART", "SECTION")
            key = key.replace("GOSPEL_MOODS", "MOODS").replace("GOSPELMOODS", "MOODS")
            key = key.replace("MOOD", "MOODS") if key == "MOOD" else key
            key = "LANGUAGE" if key in {"LANG"} else key
            key = "SEASONS" if key in {"SEASON"} else key
            key = "SECTION" if key in {"SECTIONS"} else key
            fields[key] = (field.group(2) or "").strip()
            continue

    title = (fields.get("TITLE") or "").strip()
    lyrics = "\n".join(lyrics_lines or []).strip() if lyrics_lines is not None else ""
    if not title or not lyrics:
        return None

    section = _normalize_section(fields.get("SECTION") or "")
    if not section:
        # Allow SECTION: entrance, communion style → first valid
        for part in _split_list(fields.get("SECTION") or ""):
            section = _normalize_section(part)
            if section:
                break
    if not section:
        section = "meditation"

    moods = normalize_gospel_moods(_split_list(fields.get("MOODS") or ""))
    seasons = _normalize_seasons(fields.get("SEASONS"))
    language = _normalize_language(fields.get("LANGUAGE") or "")
    author = (fields.get("AUTHOR") or "").strip()

    return {
        "title": title,
        "author": author,
        "section": section,
        "sections": [section],
        "gospel_moods": moods,
        "language": language,
        "seasons": seasons,
        "lyrics": lyrics,
    }


def parse_verbum_song_txt(text: str) -> dict[str, Any]:
    """
    Parse one or more songs from Verbum .txt / .rtf content.

    Returns ``{"ok": bool, "songs": [...], "errors": [...], "format": "verbum"|""}``.
    """
    prepared = prepare_upload_text(text)
    if not looks_like_verbum_song_txt(prepared):
        return {
            "ok": False,
            "songs": [],
            "errors": ["Not a Verbum song .txt (missing ===SONG=== or TITLE/SECTION/LYRICS)."],
            "format": "",
        }

    songs: list[dict[str, Any]] = []
    errors: list[str] = []
    for idx, chunk in enumerate(_extract_song_chunks(prepared), start=1):
        parsed = _parse_song_chunk(chunk)
        if not parsed:
            errors.append(f"Song block {idx}: missing TITLE or LYRICS.")
            continue
        songs.append(parsed)

    if not songs:
        return {
            "ok": False,
            "songs": [],
            "errors": errors or ["No valid songs found in file."],
            "format": "verbum",
        }
    return {"ok": True, "songs": songs, "errors": errors, "format": "verbum"}
