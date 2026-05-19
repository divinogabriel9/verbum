import datetime as _dt
import os

import requests

from core.liturgical_calendar import sunday_lectionary_cycle
from services.gospel_fallback import fetch_world_english_gospel, gospel_reference_looks_like_citation_only
from services.gospel_quote_extractor import extract_gospel_slide_quote
from services.lectionary_store import db_path, get_cached, ignore_cache, upsert
from services.usccb_client import USCCB_HTTP_CHALLENGE, get_usccb_soup
from services.mass_text_format import reading_body_is_usable
from services.usccb_readings import fetch_readings_for_date


def _payload_readings_usable(payload: dict) -> bool:
    """SQLite rows from older scrapers may store only verse numbers — refetch those."""
    if reading_body_is_usable(
        payload.get("first_reading_text") or "",
        payload.get("first_reading") or "",
    ):
        return True
    if reading_body_is_usable(
        payload.get("gospel_text") or "",
        payload.get("gospel_reference") or "",
    ):
        return True
    if reading_body_is_usable(payload.get("psalm_text") or "", payload.get("psalm") or ""):
        return True
    if reading_body_is_usable(
        payload.get("second_reading_text") or "",
        payload.get("second_reading") or "",
    ):
        return True
    return False


def _normalize_mass_date(date: str) -> str:
    return _dt.datetime.strptime(date.strip(), "%Y-%m-%d").date().isoformat()


def fetch_liturgical_data_live(date: str, *, use_readings_cache: bool = True) -> dict | None:
    """
    Fetch lectionary + USCCB text from the network only (no cache read/write here).
    date: YYYY-MM-DD
    """

    try:
        on_date = _dt.datetime.strptime(date.strip(), "%Y-%m-%d").date()
    except ValueError:
        print("❌ Invalid date. Use YYYY-MM-DD.")
        return None

    lectionary_cycle = sunday_lectionary_cycle(on_date)

    year = date.split("-")[0]
    month_day = date[5:]

    url = f"https://cpbjr.github.io/catholic-readings-api/readings/{year}/{month_day}.json"

    print("Fetching:", url)

    try:
        response = requests.get(url, timeout=10)

        if response.status_code != 200:
            print(f"API Error: {response.status_code}")
            return None

        data = response.json()
        readings = data.get("readings", {})
        source_url = data.get("usccbLink", "")
        gospel_reference = readings.get("gospel", "") or ""
        gospel_text = ""
        quote_attribution = None
        first_reading_text = ""
        psalm_text = ""
        second_reading_text = ""

        psalm_response = ""
        if source_url or readings:
            blocks = fetch_readings_for_date(
                date,
                source_url or "",
                fallback_refs=readings,
                use_cache=use_readings_cache,
            )
            first_reading_text = (blocks.get("first_reading") or "").strip()
            psalm_text = (blocks.get("psalm_text") or "").strip()
            psalm_response = (blocks.get("psalm_response") or "").strip()
            second_reading_text = (blocks.get("second_reading") or "").strip()
            gospel_text = (blocks.get("gospel") or "").strip()

            if not (
                first_reading_text
                or psalm_text
                or second_reading_text
                or gospel_text.strip()
            ):
                _page, http_err = get_usccb_soup((source_url or "").strip())
                if http_err == 403:
                    print(
                        "⚠️ bible.usccb.org returned HTTP 403 (often antivirus/VPN/firewall)."
                        " Disable blocking or open USCCB in a browser to copy readings."
                    )
                elif http_err == USCCB_HTTP_CHALLENGE:
                    print(
                        "⚠️ bible.usccb.org returned a bot-check page (\"Checking connection\") "
                        "instead of readings. Server/datacenter IPs are often blocked — "
                        "try locally, use a VPN, or paste readings manually."
                    )
                elif http_err:
                    print(
                        f"⚠️ bible.usccb.org HTTP {http_err}: readings text could not be downloaded."
                    )
                else:
                    print(
                        "⚠️ USCCB responded but readings could not be resolved. "
                        "References may still be filled from the lectionary API + Bible API."
                    )

        if gospel_reference_looks_like_citation_only(gospel_reference, gospel_text):
            alt_text = fetch_world_english_gospel(gospel_reference)
            if alt_text:
                gospel_text = alt_text
                quote_attribution = (
                    "Below: World English Bible (WEB) fallback — verify NABRE on bible.usccb.org."
                )
            else:
                gospel_text = gospel_reference.strip()

        gospel_slide_quote = (
            extract_gospel_slide_quote(gospel_text, max_chars=300) if gospel_text else ""
        )

        return {
            "title": f"{data.get('season', 'Sunday Mass')} Celebration",
            "season": data.get("season", "Ordinary Time"),
            "lectionary_cycle": lectionary_cycle,
            "first_reading": readings.get("firstReading", ""),
            "psalm": readings.get("psalm", ""),
            "second_reading": readings.get("secondReading", ""),
            "first_reading_text": first_reading_text,
            "psalm_text": psalm_text,
            "psalm_response": psalm_response,
            "second_reading_text": second_reading_text,
            "gospel_reference": gospel_reference,
            "gospel_text": gospel_text,
            "gospel_slide_quote": gospel_slide_quote,
            "source": source_url,
            "quote_attribution": quote_attribution,
        }

    except Exception as e:
        print(f"Connection Error: {e}")
        return None


def get_liturgical_data(date: str, *, use_cache: bool = True) -> dict | None:
    """
    Liturgical data for Mass date YYYY-MM-DD.
    Uses SQLite cache (see data/lectionary.sqlite) unless LECTIONARY_IGNORE_CACHE=1.
    """
    try:
        normalized = _normalize_mass_date(date)
    except ValueError:
        print("❌ Invalid date. Use YYYY-MM-DD.")
        return None

    bypass_read = ignore_cache() or not use_cache

    if not bypass_read:
        cached = get_cached(normalized)
        if cached is not None and not _payload_readings_usable(cached):
            print(f"Lectionary cache stale (verse-only readings): {normalized}")
            cached = None
        if cached is not None:
            print(f"Lectionary cache hit: {normalized}")
            return cached

    data = fetch_liturgical_data_live(normalized, use_readings_cache=not bypass_read)
    if data is None:
        return None

    should_write = os.environ.get("LECTIONARY_NO_WRITE_CACHE", "").strip() not in ("1", "true")
    if use_cache and should_write:
        upsert(normalized, data)
        print(f"Lectionary saved to database: {db_path()}")

    return data
