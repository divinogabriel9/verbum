"""
Content model for the Mass title / welcome slide (Gospel-first hierarchy).
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

from services.gospel_quote_extractor import (
    extract_gospel_slide_quote,
    split_slide_sentences,
)


@dataclass(frozen=True)
class TitleSlideContent:
    celebration: str
    date_label: str
    main_message: str
    supporting_quote: str
    gospel_reference: str
    celebrant: str


def _normalize_compare(text: str) -> str:
    return " ".join((text or "").lower().split())


def _display_quote(text: str) -> str:
    t = (text or "").strip()
    if not t:
        return ""
    if t[0] in "\"“‘":
        return t
    return f"\u201c{t}\u201d"


def _celebration_display(title: str) -> str:
    t = (title or "").strip() or "Sunday Mass"
    return t.replace(" Celebration", "").strip() or t


def resolve_title_slide_content(
    *,
    title: str,
    date_label: str,
    celebrant: str,
    gospel_reference: str,
    gospel_quote: str = "",
    gospel_full_text: str = "",
    quote_attribution: Optional[str] = None,
    hero_max_chars: int = 200,
) -> TitleSlideContent:
    """
    Build title-slide copy: hero Gospel line, optional second sentence, citation, footer name.
    """
    full = (gospel_full_text or "").strip()
    picked = (gospel_quote or "").strip()

    if picked:
        main = picked
    elif full:
        main = extract_gospel_slide_quote(full, max_chars=hero_max_chars)
    else:
        main = ""

    if full and len(main) < 48:
        richer = extract_gospel_slide_quote(full, max_chars=hero_max_chars)
        if len(richer) > len(main):
            main = richer

    main = main.strip()
    main_display = _display_quote(main) if main else ""

    supporting = ""
    base_for_sents = extract_gospel_slide_quote(full, max_chars=400) if full else picked
    sentences = split_slide_sentences(base_for_sents)
    main_cmp = _normalize_compare(main)
    for sent in sentences[1:]:
        if _normalize_compare(sent) != main_cmp and len(sent.strip()) > 24:
            supporting = _display_quote(sent.strip())
            break

    if not supporting:
        attr = (quote_attribution or "").strip()
        if attr and _normalize_compare(attr) not in main_cmp and attr.lower() not in main_cmp:
            supporting = attr if attr[0] in "\"“‘" else _display_quote(attr)

    gref = (gospel_reference or "").strip() or "—"

    return TitleSlideContent(
        celebration=_celebration_display(title),
        date_label=(date_label or "").strip(),
        main_message=main_display,
        supporting_quote=supporting,
        gospel_reference=gref,
        celebrant=(celebrant or "").strip(),
    )
