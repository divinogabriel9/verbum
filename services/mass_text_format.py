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


_STRUCTURE_LABEL_LINE_RE = re.compile(
    r"^\s*\[?\s*(refrain|verse|chorus|stanza|bridge|response|coda|intro|vamp)(\s*[\w\d]*)?\s*\]?\s*[:.)-]?\s*$",
    re.IGNORECASE,
)
_STRUCTURE_HEADER_RE = _STRUCTURE_LABEL_LINE_RE
_STRUCTURE_LABEL_INLINE_RE = re.compile(
    r"^\s*(refrain|verse|chorus|bridge|response|stanza|coda|intro|vamp)\s*:\s*(.*)$",
    re.IGNORECASE,
)

# --- Web-fetched lyric contamination (LyricFind/Hymnary scrape artifacts) ---
# Trailing "Copy" button text that web pages append to section headers/lines.
_COPY_BUTTON_TAIL_RE = re.compile(r"\s*\bcopy\b\s*$", re.IGNORECASE)
# Standalone UI/navigation lines that leak when HTML is flattened to text.
_WEB_UI_ARTIFACT_LINE_RE = re.compile(
    r"^\s*(?:copy|embed|share|add\s+song|charts|languages|genres|report|print|"
    r"edit|submit|cancel|save|powered\s+by\s+lyricfind|lyricfind|advertisement|"
    r"sponsored|sign\s+in|log\s+in|subscribe|show\s+all|view\s+all)\s*$",
    re.IGNORECASE,
)
# Licensing / boilerplate lines that should never reach a slide.
_WEB_UI_ARTIFACT_PREFIX_RE = re.compile(
    r"^\s*(?:lyrics\s+licensed|lyrics\s+powered|powered\s+by|songwriters?\s*:|"
    r"written\s+by\s*:|source\s*:|copyright\b|all\s+rights\s+reserved|©|"
    r"we\s+use\s+cookies|cookie\s+policy|terms\s+of\b|privacy\s+policy)",
    re.IGNORECASE,
)


def _strip_trailing_copy_button(line: str) -> str:
    """Drop a trailing 'Copy' button label, but only when it's clearly an artifact.

    ``Verse 1 Copy`` -> ``Verse 1``; a lone ``Copy`` -> ``""``. A real lyric line
    that happens to end in the word "copy" is left untouched.
    """
    match = _COPY_BUTTON_TAIL_RE.search(line)
    if not match:
        return line
    head = line[: match.start()].rstrip()
    if not head:
        return ""
    if _STRUCTURE_LABEL_LINE_RE.match(head):
        return head
    return line


def sanitize_web_lyrics(raw: str) -> str:
    """Scrub lyrics fetched from the web of UI/metadata artifacts.

    Removes "Copy" button text appended to headers (``Verse 1 Copy`` -> ``Verse 1``),
    standalone navigation/UI lines, and licensing boilerplate so structure labels
    stay recognizable and no metadata leaks onto slides. Repeated lyric lines are
    preserved on purpose (worship songs repeat intentionally).
    """
    text = (raw or "").strip()
    if not text:
        return ""
    out: list[str] = []
    for line in text.splitlines():
        s = line.strip()
        if not s:
            if out and out[-1] != "":
                out.append("")
            continue
        s = _strip_trailing_copy_button(s)
        if not s:
            continue
        if _WEB_UI_ARTIFACT_LINE_RE.match(s) or _WEB_UI_ARTIFACT_PREFIX_RE.match(s):
            continue
        out.append(s)
    cleaned = "\n".join(out)
    cleaned = re.sub(r"\n{3,}", "\n\n", cleaned).strip()
    return cleaned


def _non_empty_lyric_lines(text: str) -> list[str]:
    return [ln.strip() for ln in (text or "").splitlines() if ln.strip()]


def ensure_lyric_section_breaks(lyrics: str) -> str:
    """Insert blank lines before structure labels when paragraphs were flattened."""
    raw = (lyrics or "").strip()
    if not raw:
        return ""
    out: list[str] = []
    for line in raw.splitlines():
        stripped = line.strip()
        if stripped and out and out[-1] != "" and _STRUCTURE_HEADER_RE.match(stripped):
            out.append("")
        out.append(line.rstrip())
    return "\n".join(out).strip()


def restore_lyric_sections_from_library(flat_lyrics: str, library_lyrics: str) -> str:
    """
    Re-split flattened lyric overrides using the saved hymn's section line counts.

    Used when hymn preview edits were saved without blank lines between blocks.
    """
    lib_sections = parse_structured_lyric_sections(ensure_lyric_section_breaks(library_lyrics))
    flat_lines = _non_empty_lyric_lines(flat_lyrics)
    if len(lib_sections) < 2 or not flat_lines:
        return ensure_lyric_section_breaks(flat_lyrics)
    counts = [len(_non_empty_lyric_lines(sec)) for sec in lib_sections]
    if sum(counts) != len(flat_lines):
        return ensure_lyric_section_breaks(flat_lyrics)
    parts: list[str] = []
    idx = 0
    for count in counts:
        parts.append("\n".join(flat_lines[idx : idx + count]))
        idx += count
    return "\n\n".join(parts)


def _normalized_lyric_block(text: str) -> str:
    return re.sub(r"\s+", " ", (text or "").strip()).lower()


def _lyric_paragraph_blocks(text: str) -> list[str]:
    raw = ensure_lyric_section_breaks((text or "").strip())
    if not raw:
        return []
    return [b.strip() for b in raw.split("\n\n") if b.strip()]


def hymn_override_is_slide_plan_subset(library_lyrics: str, override: str) -> bool:
    """
    True when override keeps only some library blocks (slides turned off in song preview).

    Distinct from corrupted flattened overrides: every override block must match a library block.
    """
    lib_blocks = _lyric_paragraph_blocks(library_lyrics)
    ov_blocks = _lyric_paragraph_blocks(override)
    if not ov_blocks or not lib_blocks or len(ov_blocks) >= len(lib_blocks):
        return False
    lib_norm = [_normalized_lyric_block(b) for b in lib_blocks]
    for ob in ov_blocks:
        on = _normalized_lyric_block(ob)
        if not any(on == ln or on in ln or ln in on for ln in lib_norm):
            return False
    return True


def resolve_hymn_lyrics(library_lyrics: str, override: str | None) -> str:
    """Prefer override text but restore verse/chorus structure from the library when needed."""
    lib = (library_lyrics or "").strip()
    if not (override or "").strip():
        return lib
    ov = ensure_lyric_section_breaks(str(override).strip())
    if hymn_override_is_slide_plan_subset(lib, ov):
        return ov
    lib_sections = parse_structured_lyric_sections(lib)
    ov_sections = parse_structured_lyric_sections(ov)
    if len(lib_sections) >= 2 and len(ov_sections) < len(lib_sections):
        restored = restore_lyric_sections_from_library(ov, lib)
        if len(parse_structured_lyric_sections(restored)) >= len(ov_sections):
            return restored
    return ov


def pick_hymn_lyrics_for_slides(library_lyrics: str, override: str | None) -> str:
    """
    Lyrics used for hymn slides: library text unless a valid override is present.

    Ignores corrupted browser overrides (flattened preview saves with missing blocks
    or one long line per slide). Accepts intentional slide-plan subsets when slides
    are toggled off in the song preview panel.
    """
    lib = (library_lyrics or "").strip()
    if not (override or "").strip():
        return lib
    ov_raw = str(override).strip()
    if hymn_override_is_slide_plan_subset(lib, ov_raw):
        return ensure_lyric_section_breaks(ov_raw)
    resolved = resolve_hymn_lyrics(lib, ov_raw)
    lib_lines = _non_empty_lyric_lines(lib)
    res_lines = _non_empty_lyric_lines(resolved)
    if lib_lines and len(res_lines) < len(lib_lines):
        return lib
    lib_sections = parse_structured_lyric_sections(lib)
    res_sections = parse_structured_lyric_sections(resolved)
    if len(lib_sections) >= 2 and len(res_sections) < len(lib_sections):
        return lib
    if lib_lines and lib_sections:
        lib_max = max(len(ln) for ln in lib_lines)
        res_max = max(len(ln) for ln in res_lines) if res_lines else 0
        if len(lib_sections) >= 2 and res_max > max(lib_max * 2, 72):
            return lib
    return resolved


def _structure_kind_from_label_line(line: str) -> str | None:
    """Map a structure label line to verse|chorus|bridge|response|stanza|coda|intro|vamp."""
    stripped = (line or "").strip()
    m = _STRUCTURE_HEADER_RE.match(stripped)
    if m:
        kind = (m.group(1) or "").lower()
        return "chorus" if kind == "refrain" else kind
    inline = _STRUCTURE_LABEL_INLINE_RE.match(stripped)
    if inline:
        kind = (inline.group(1) or "").lower()
        return "chorus" if kind == "refrain" else kind
    return None


def parse_structured_lyric_sections_typed(lyrics: str) -> list[tuple[str, str]]:
    """
    Split saved lyrics into labeled blocks (matches Lyrics Studio structured editor).

    Returns ``(block_kind, body)`` pairs. ``block_kind`` is verse|chorus|bridge|etc.;
    unlabeled blocks default to ``verse``.
    """
    raw = ensure_lyric_section_breaks(sanitize_web_lyrics(lyrics))
    if not raw:
        return []

    sections: list[tuple[str, str]] = []
    for part in re.split(r"\n\s*\n+", raw):
        chunk = part.strip()
        if not chunk:
            continue
        lines = [ln.strip() for ln in chunk.splitlines() if ln.strip()]
        if not lines:
            continue

        first = lines[0]
        block_kind = "verse"
        body_lines: list[str]
        header_kind = _structure_kind_from_label_line(first)
        if header_kind:
            block_kind = header_kind
            body_lines = lines[1:]
        elif _STRUCTURE_HEADER_RE.match(first):
            body_lines = lines[1:]
        else:
            inline = _STRUCTURE_LABEL_INLINE_RE.match(first)
            if inline:
                block_kind = _structure_kind_from_label_line(first) or "verse"
                remainder = (inline.group(2) or "").strip()
                body_lines = ([remainder] if remainder else []) + lines[1:]
            else:
                body_lines = lines

        body_lines = [ln for ln in body_lines if not _STRUCTURE_LABEL_LINE_RE.match(ln)]
        body = "\n".join(body_lines).strip()
        if body:
            sections.append((block_kind, body))

    if sections:
        return sections
    return [("verse", raw)]


def parse_structured_lyric_sections(lyrics: str) -> list[str]:
    """
    Split saved lyrics into verse/chorus blocks (matches Lyrics Studio structured editor).

    Paragraphs are separated by blank lines. A leading label line (``Verse 1``,
    ``Chorus``, ``REFRAIN:``, etc.) starts a new block; label text is not included
    in the returned section bodies.
    """
    return [body for _kind, body in parse_structured_lyric_sections_typed(lyrics)]


def clean_lyrics_for_projection(lyrics: str) -> str:
    """
    Remove structure labels (refrain, verse, chorus, stanza, bridge, response)
    as standalone lines; collapse extra blank lines. Web-scrape artifacts
    (``Copy`` buttons, navigation, licensing text) are scrubbed first.
    """
    raw = sanitize_web_lyrics(lyrics).splitlines()
    out: list[str] = []
    for line in raw:
        stripped = line.strip()
        if not stripped:
            if out and out[-1] != "":
                out.append("")
            continue
        if _STRUCTURE_LABEL_LINE_RE.match(stripped):
            continue
        out.append(line.rstrip())
    text = "\n".join(out)
    text = re.sub(r"\n{3,}", "\n\n", text).strip()
    return text
