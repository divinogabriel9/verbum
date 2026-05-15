"""Fetch hymn lyrics by title from multiple sources and persist locally."""

from __future__ import annotations

import re
from typing import Any
from urllib.error import URLError
from urllib.parse import quote_plus
from urllib.request import Request, urlopen

from services.song_catalog import load_catalog, update_lyrics
from services.web_hymn_discovery import extract_representative_text

_USER_AGENT = "church-media-generator/1.0"
_TIMEOUT_S = 6.0


def _read_url(url: str) -> str:
    req = Request(url, headers={"User-Agent": _USER_AGENT})
    with urlopen(req, timeout=_TIMEOUT_S) as resp:  # nosec B310 - read-only trusted host
        return resp.read().decode("utf-8", errors="replace")


def _search_hymnary_text_link(title: str) -> str:
    query = quote_plus(title.strip())
    url = f"https://hymnary.org/search?qu=text%3A{query}"
    html = _read_url(url)
    m = re.search(r'href="(/text/[^"#?]+)"', html)
    if not m:
        return ""
    return "https://hymnary.org" + m.group(1)


def _resolve_link(item: dict[str, Any]) -> str:
    link = str(item.get("text_link") or "").strip()
    if link:
        return link
    title = str(item.get("title") or "").strip()
    if not title:
        return ""
    return _search_hymnary_text_link(title)


def _search_lyricfind_link(title: str) -> str:
    """
    Find LyricFind lyrics URL via web search index.
    Works as fallback when Hymnary has no entry for modern songs.
    """
    query = quote_plus(f"site:lyrics.lyricfind.com/lyrics {title.strip()}")
    url = f"https://duckduckgo.com/html/?q={query}"
    html = _read_url(url)
    m = re.search(r"https://lyrics\.lyricfind\.com/lyrics/[a-z0-9\\-]+", html, re.I)
    return m.group(0) if m else ""


def _extract_lyricfind_lyrics(page: str) -> str:
    """
    Best-effort text extraction for LyricFind pages.
    """
    body = page or ""
    if not body:
        return ""
    # Remove scripts/styles for cleaner text scan.
    body = re.sub(r"<script.*?</script>", "", body, flags=re.I | re.S)
    body = re.sub(r"<style.*?</style>", "", body, flags=re.I | re.S)
    text = re.sub(r"<[^>]+>", "\n", body)
    text = re.sub(r"\r", "", text)
    lines = [ln.strip() for ln in text.split("\n")]
    lines = [ln for ln in lines if ln]
    # LyricFind pages often include a dense lyrics area; keep middling lines.
    out: list[str] = []
    for ln in lines:
        if len(ln) < 2:
            continue
        if ln.lower().startswith(("company", "legal", "about us", "contact us", "browse all songs")):
            continue
        if ln in {"Add Song", "Charts", "Languages", "Genres"}:
            continue
        out.append(ln)
    # compress and return a meaningful window
    if not out:
        return ""
    joined = "\n".join(out)
    joined = re.sub(r"\n{3,}", "\n\n", joined)
    return joined[:6000].strip()


def fetch_and_store_for_selection(selection: dict[str, str]) -> dict[str, Any]:
    """
    selection keys: section, id.
    Returns status row.
    """
    sec = str(selection.get("section") or "").strip().lower()
    hid = str(selection.get("id") or "").strip()
    if not sec or not hid:
        return {"ok": False, "reason": "invalid_selection", "section": sec, "id": hid}

    catalog = load_catalog()
    item = None
    for row in catalog.get(sec, []):
        if str(row.get("id") or "").strip() == hid:
            item = row
            break
    if not item:
        return {"ok": False, "reason": "song_not_found", "section": sec, "id": hid}

    if str(item.get("lyrics") or "").strip():
        return {"ok": True, "reason": "already_present", "section": sec, "id": hid, "title": item.get("title")}

    try:
        link = _resolve_link(item)
        lyrics = ""
        source_used = ""
        if link:
            page = _read_url(link)
            lyrics = extract_representative_text(page)
            source_used = link
        if not lyrics:
            lf = _search_lyricfind_link(str(item.get("title") or ""))
            if lf:
                page2 = _read_url(lf)
                lyrics2 = _extract_lyricfind_lyrics(page2)
                if lyrics2:
                    lyrics = lyrics2
                    source_used = lf
        if not lyrics:
            return {"ok": False, "reason": "no_lyrics_found", "section": sec, "id": hid, "title": item.get("title")}
        ok = update_lyrics(sec, hid, lyrics, source_link=source_used)
        if not ok:
            return {"ok": False, "reason": "save_failed", "section": sec, "id": hid, "title": item.get("title")}
        return {"ok": True, "reason": "fetched", "section": sec, "id": hid, "title": item.get("title"), "source": source_used}
    except (URLError, TimeoutError):
        return {"ok": False, "reason": "network_error", "section": sec, "id": hid, "title": item.get("title")}


def ensure_lyrics_for_song(section: str, hymn_id: str) -> bool:
    """
    Ensure a song has lyrics in local catalog; attempts fetch when missing.
    Returns True if lyrics exist after the check.
    """
    sec = (section or "").strip().lower()
    hid = (hymn_id or "").strip()
    if not sec or not hid:
        return False
    lib = load_catalog()
    for row in lib.get(sec, []):
        if str(row.get("id") or "").strip() == hid:
            if str(row.get("lyrics") or "").strip():
                return True
            break
    res = fetch_and_store_for_selection({"section": sec, "id": hid})
    if not res.get("ok"):
        return False
    lib2 = load_catalog()
    for row in lib2.get(sec, []):
        if str(row.get("id") or "").strip() == hid:
            return bool(str(row.get("lyrics") or "").strip())
    return False

