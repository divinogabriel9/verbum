"""Shared max lengths for user-editable text (keep in sync with frontend via /api/input-limits)."""

from __future__ import annotations

CHURCH_NAME = 240
CELEBRANT_NAME = 200
SONG_TITLE = 240
SONG_AUTHOR = 240
SONG_ID = 160
SECTION_LABEL = 80
SECTION_KEY = 40
GOSPEL_QUOTE = 2000
PSALM_REFRAIN = 500
PSALM_FULL = 12000
LYRICS_FULL = 50000
LYRIC_BLOCK = 4000
HYMN_OVERRIDE = 12000
SEARCH_QUERY = 120
EVENT_NAME = 120
FOOD_SPONSOR = 120
COLLECTION_AMOUNT = 120
COLLECTION_DATE_LABEL = 240
THEME_NAME = 80
HEX_COLOR = 7
AI_PROMPT = 4000
API_KEY = 512
FILE_BASENAME = 200
AI_POSTER_STYLE = 64
CURRENCY_CODE = 8
LANGUAGE = 40
IMPORT_LIST_ITEM = 240

MAX_CELEBRANTS = 32
MAX_FOOD_SPONSORS = 24
MAX_ANNOUNCEMENT_IMAGES = 24
MAX_EXTRA_SONG_SECTIONS = 12
MAX_IMPORT_SONG_ROWS = 500
MAX_GOSPEL_MOODS = 5


def public_limits() -> dict[str, int]:
    """JSON-safe limits for the browser."""
    return {
        "church_name": CHURCH_NAME,
        "celebrant_name": CELEBRANT_NAME,
        "song_title": SONG_TITLE,
        "song_author": SONG_AUTHOR,
        "song_id": SONG_ID,
        "section_label": SECTION_LABEL,
        "section_key": SECTION_KEY,
        "gospel_quote": GOSPEL_QUOTE,
        "psalm_refrain": PSALM_REFRAIN,
        "psalm_full": PSALM_FULL,
        "lyrics_full": LYRICS_FULL,
        "lyric_block": LYRIC_BLOCK,
        "hymn_override": HYMN_OVERRIDE,
        "search_query": SEARCH_QUERY,
        "event_name": EVENT_NAME,
        "food_sponsor": FOOD_SPONSOR,
        "collection_amount": COLLECTION_AMOUNT,
        "collection_date_label": COLLECTION_DATE_LABEL,
        "theme_name": THEME_NAME,
        "hex_color": HEX_COLOR,
        "ai_prompt": AI_PROMPT,
        "api_key": API_KEY,
        "file_basename": FILE_BASENAME,
        "language": LANGUAGE,
    }
