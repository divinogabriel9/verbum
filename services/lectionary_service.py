import datetime as _dt
import os

import requests

from core.liturgical_calendar import sunday_lectionary_cycle
from services.gospel_fallback import fetch_world_english_gospel, gospel_reference_looks_like_citation_only
from services.gospel_quote_extractor import extract_gospel_slide_quote
from services.lectionary_store import db_path, get_cached, ignore_cache, upsert
from services.usccb_client import USCCB_HTTP_CHALLENGE, get_usccb_soup
from services.mass_text_format import reading_body_is_usable
from services.usccb_readings import (
    collect_psalm_refrain_options,
    fetch_readings_for_date,
    is_usccb_nav_chrome_title,
    scrape_mass_celebration_from_soup,
)


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


def _payload_title_stale(payload: dict) -> bool:
    """Older cache rows used season-only or nav-scraped titles instead of the mass-day name."""
    title = (payload.get("title") or "").strip()
    season = (payload.get("season") or "").strip()
    celebration = (payload.get("celebration") or "").strip()
    if celebration and not is_usccb_nav_chrome_title(celebration):
        if not is_usccb_nav_chrome_title(title):
            return False
    if is_usccb_nav_chrome_title(celebration) or is_usccb_nav_chrome_title(title):
        return True
    if not title:
        return True
    if season and title == f"{season} Celebration":
        return True
    if title.endswith(" Celebration") and not celebration:
        return True
    return False


def _payload_complete(payload: dict) -> bool:
    """
    Strict check that a payload has everything a Sunday deck needs.

    Unlike ``_payload_readings_usable`` (passes if *any* one reading exists), this
    requires the first-reading body, a derivable responsorial-psalm refrain, and
    the gospel body — the exact fields that silently broke past decks. The second
    reading is intentionally optional (weekday Masses don't have one).
    """
    if not payload:
        return False
    if _payload_title_stale(payload):
        return False
    if not reading_body_is_usable(
        payload.get("first_reading_text") or "",
        payload.get("first_reading") or "",
    ):
        return False
    if not reading_body_is_usable(
        payload.get("gospel_text") or "",
        payload.get("gospel_reference") or "",
    ):
        return False
    refrains = collect_psalm_refrain_options(
        payload.get("psalm_text") or "",
        payload.get("psalm") or "",
        psalm_response=payload.get("psalm_response") or "",
    )
    if not refrains:
        return False
    return True


def _merge_payloads(old: dict | None, new: dict | None) -> dict:
    """
    Field-level merge that prefers non-empty fresh values but falls back to cached
    ones — so a partial live fetch (e.g. USCCB bot-challenge) can never blank out
    reading text that was previously cached. ``new`` (live) wins per field only
    when it carries content.
    """
    if not old:
        return dict(new or {})
    if not new:
        return dict(old)
    merged = dict(old)
    for key, val in new.items():
        if isinstance(val, str):
            if val.strip():
                merged[key] = val
            elif key not in merged:
                merged[key] = val
        elif val is not None:
            merged[key] = val
        elif key not in merged:
            merged[key] = val
    # A failed scrape yields a generic "<Season> Celebration" title — never let it
    # overwrite a real mass-day name already in the cache.
    if _payload_title_stale(new) and not _payload_title_stale(old):
        merged["title"] = old.get("title")
        if (old.get("celebration") or "").strip():
            merged["celebration"] = old.get("celebration")
    return merged


def _resolve_mass_celebration(
    blocks: dict,
    source_url: str,
) -> str:
    celebration = (blocks.get("mass_celebration") or "").strip()
    if celebration and not is_usccb_nav_chrome_title(celebration):
        return celebration
    url = (source_url or "").strip()
    if not url:
        return ""
    soup, _http = get_usccb_soup(url)
    if soup is None:
        return ""
    return scrape_mass_celebration_from_soup(soup)


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
        blocks: dict = {}
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

            # The lectionary API occasionally omits a reference (the first reading
            # is missing for some dates). Fall back to the citation scraped from USCCB.
            if not gospel_reference:
                gospel_reference = (blocks.get("gospel_ref") or "").strip()

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

        season = data.get("season", "Ordinary Time")
        celebration = _resolve_mass_celebration(blocks, source_url)
        title = celebration or f"{season} Celebration"

        return {
            "title": title,
            "celebration": celebration,
            "season": season,
            "lectionary_cycle": lectionary_cycle,
            "first_reading": (readings.get("firstReading", "") or "").strip()
            or (blocks.get("first_reading_ref") or "").strip(),
            "psalm": (readings.get("psalm", "") or "").strip()
            or (blocks.get("psalm_ref") or "").strip(),
            "second_reading": (readings.get("secondReading", "") or "").strip()
            or (blocks.get("second_reading_ref") or "").strip(),
            "first_reading_text": first_reading_text,
            "psalm_text": psalm_text,
            "psalm_response": psalm_response,
            "second_reading_text": second_reading_text,
            "gospel_reference": gospel_reference,
            "gospel_text": gospel_text,
            "gospel_acclamation": (blocks.get("gospel_acclamation") or "").strip(),
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

    cached: dict | None = None
    if not bypass_read:
        cached = get_cached(normalized)
        if cached is not None and not _payload_readings_usable(cached):
            print(f"Lectionary cache stale (verse-only readings): {normalized}")
            cached = None
        elif cached is not None and _payload_title_stale(cached):
            print(f"Lectionary cache stale (season-only title): {normalized}")
            cached = None
        elif cached is not None and not _payload_complete(cached):
            # Keep the partial data around for merge fallback, but refetch so the
            # missing first reading / psalm refrain gets filled in.
            print(f"Lectionary cache incomplete (missing first reading or psalm refrain): {normalized}")
        elif cached is not None:
            print(f"Lectionary cache hit: {normalized}")
            return cached

    data = fetch_liturgical_data_live(normalized, use_readings_cache=not bypass_read)
    if data is None:
        # Live fetch failed entirely (network/USCCB down) — serve the best cached
        # data we have rather than nothing.
        if cached is not None:
            print(f"Lectionary live fetch failed; serving cached data: {normalized}")
        return cached

    # Never let an incomplete live fetch (e.g. a USCCB bot-challenge) overwrite
    # reading text that was previously cached.
    merged = _merge_payloads(cached, data)

    should_write = os.environ.get("LECTIONARY_NO_WRITE_CACHE", "").strip() not in ("1", "true")
    if use_cache and should_write and (cached is None or merged != cached):
        upsert(normalized, merged)
        print(f"Lectionary saved to database: {db_path()}")

    return merged
