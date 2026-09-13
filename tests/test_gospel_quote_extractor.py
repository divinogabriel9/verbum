"""Gospel slide-quote picker — English + Tagalog speech cues."""

from __future__ import annotations

import json
from pathlib import Path

from services.gospel_quote_extractor import (
    extract_gospel_slide_quote,
    first_sentence_slide_quote,
    split_slide_sentences,
)

_CACHE = Path(__file__).resolve().parents[1] / "data" / "readings_cache_tagalog.json"

# Print-style parable: one speech, “ reopened at each paragraph, ” only at the end.
_TAGALOG_VINEYARD = (
    "Noong panahong iyon, sinabi ni Hesus sa kanyang mga alagad ang talinghagang ito: "
    "“Ang paghahari ng Diyos ay katulad nito: lumabas nang umagang-umaga ang may-ari "
    "ng ubasan upang humanap ng mga manggagawa. Nang magkasundo na sila sa upa na "
    "isang denaryo maghapon, sila’y pinapunta niya sa kanyang ubasan. "
    "Sinabi niya sa kanila, ‘Bakit kayo tatayu-tayo lang dito sa buong maghapon?’ "
    "“Wala pong magbigay sa amin ng trabaho, e!’ sagot nila. "
    "At sinabi niya, ‘Kung gayon, pumaroon kayo at gumawa sa aking ubasan.’\n\n"
    "“Pagtatakip-silim, sinabi ng may-ari ng ubasan sa kanyang katiwala, "
    "‘Tawagin mo na ang mga manggagawa at sila’y upahan.’ "
    "Kaya’t ang nahuhuli ay mauuna, at ang nauuna ay mahuhuli.”"
)

_ENGLISH_VINEYARD = (
    "Jesus told his disciples this parable: "
    '"The kingdom of heaven is like a landowner who went out at dawn to hire '
    "laborers for his vineyard. After agreeing with them for the usual daily wage, "
    "he sent them into his vineyard. Going out about nine o'clock, the landowner "
    "saw others standing idle in the marketplace, and he said to them, "
    "'You too go into my vineyard, and I will give you what is just.'\""
)


def test_tagalog_parable_starts_at_opening_not_sundown():
    quote = extract_gospel_slide_quote(_TAGALOG_VINEYARD, max_chars=300)
    assert quote.startswith("Ang paghahari ng Diyos ay katulad nito")
    assert "Pagtatakip-silim" not in quote.split(".")[0]
    sents = split_slide_sentences(quote)
    assert sents
    assert sents[0].startswith("Ang paghahari ng Diyos")


def test_english_parable_still_starts_at_kingdom():
    quote = extract_gospel_slide_quote(_ENGLISH_VINEYARD, max_chars=300)
    assert quote.startswith("The kingdom of heaven is like a landowner")
    sents = split_slide_sentences(quote)
    assert sents[0].startswith("The kingdom of heaven is like")


def test_tagalog_prefers_hesus_over_other_speaker():
    text = (
        "Sinabi ni Marta, “Panginoon, kung kayo po’y narito, hindi sana namatay "
        "ang aking kapatid.” Sumagot si Hesus, “Ako ang pagkabuhay at ang buhay. "
        "Ang nananalig sa akin, bagama’t mamatay ay mabubuhay.”"
    )
    quote = extract_gospel_slide_quote(text, max_chars=300)
    assert quote.startswith("Ako ang pagkabuhay")
    assert "kapatid" not in quote


def test_tagalog_sinabi_sa_kanila_ni_hesus():
    text = (
        "“Ang nakatatanda po,” sagot nila. "
        "Sinabi sa kanila ni Hesus, “Sinasabi ko sa inyo: ang mga publikano at "
        "masasamang babae’y mauuna pa sa inyong pasakop sa paghahari ng Diyos.”"
    )
    quote = extract_gospel_slide_quote(text, max_chars=300)
    assert quote.startswith("Sinasabi ko sa inyo")


def test_closed_quotes_are_not_merged_into_one_speech():
    text = (
        "Sinabi ni Hesus, “Sino sa dalawa ang sumunod sa kalooban ng kanyang ama?” "
        "“Ang nakatatanda po,” sagot nila. "
        "Sinabi sa kanila ni Hesus, “Sinasabi ko sa inyo: magsisi kayo.”"
    )
    quote = extract_gospel_slide_quote(text, max_chars=400)
    assert "Sino sa dalawa" in quote
    assert "Sinasabi ko sa inyo" in quote
    assert "nakatatanda" not in quote


def test_first_sentence_follows_extracted_quote():
    quote = extract_gospel_slide_quote(_TAGALOG_VINEYARD, max_chars=300)
    assert first_sentence_slide_quote(quote).startswith("Ang paghahari ng Diyos")


def test_cached_2026_09_20_tagalog_matches_english_opening():
    if not _CACHE.is_file():
        return
    blob = json.loads(_CACHE.read_text(encoding="utf-8"))
    entry = blob.get("2026-09-20") or {}
    gospel = (entry.get("gospel") or "").strip()
    if not gospel:
        return
    quote = extract_gospel_slide_quote(gospel, max_chars=300)
    sents = split_slide_sentences(quote)
    assert quote.startswith("Ang paghahari ng Diyos ay katulad nito")
    assert sents[0].startswith("Ang paghahari ng Diyos")
    assert not sents[0].startswith("Pagtatakip-silim")
