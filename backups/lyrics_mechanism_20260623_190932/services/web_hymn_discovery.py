"""Discover extra hymn suggestions from the web and cache full lyrics locally."""

from __future__ import annotations

import hashlib
import json
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.error import URLError
from urllib.parse import quote_plus
from urllib.request import Request, urlopen

_PROJECT_ROOT = Path(__file__).resolve().parents[1]
_CACHE_PATH = _PROJECT_ROOT / "data" / "web_hymn_cache.json"
_H_API = "https://hymnary.org/api/scripture?reference="
_USER_AGENT = "church-media-generator/1.0"
_HTTP_TIMEOUT_S = 4.5


def _read_json_url(url: str) -> dict[str, Any]:
    req = Request(url, headers={"User-Agent": _USER_AGENT})
    with urlopen(req, timeout=_HTTP_TIMEOUT_S) as resp:  # nosec B310 - trusted read-only URL
        raw = resp.read().decode("utf-8", errors="replace")
    data = json.loads(raw)
    return data if isinstance(data, dict) else {}


def _read_text_url(url: str) -> str:
    req = Request(url, headers={"User-Agent": _USER_AGENT})
    with urlopen(req, timeout=_HTTP_TIMEOUT_S) as resp:  # nosec B310 - trusted read-only URL
        return resp.read().decode("utf-8", errors="replace")


def _normalize_title(title: str) -> str:
    t = re.sub(r"\s+", " ", (title or "").strip())
    return t


def _title_to_id(title: str) -> str:
    digest = hashlib.md5(title.lower().encode("utf-8")).hexdigest()[:10]  # nosec B324 - non-crypto id
    slug = re.sub(r"[^a-z0-9]+", "_", title.lower()).strip("_")
    slug = slug[:36] if slug else "hymn"
    return f"web_{slug}_{digest}"


def extract_representative_text(page_text: str) -> str:
    """
    Parse hymnary text page content converted to plain text.
    We read lines after "Representative Text" and stop at source/info sections.
    """
    text = page_text or ""
    if not text:
        return ""
    idx = text.find("Representative Text")
    if idx < 0:
        return ""
    lines = text[idx:].splitlines()[1:]
    out: list[str] = []
    for ln in lines:
        line = ln.strip()
        if not line:
            if out:
                out.append("")
            continue
        if line.startswith(("## ", "### ", "#### ")):
            break
        if line.startswith(("Ancient & Modern", "Text Information", "Author:", "^ top")):
            break
        # Accept stanza-like lines only.
        if re.match(r"^\d+\s+", line):
            out.append(line)
            continue
        if out and not line.startswith(("Printable scores:", "Audio files:", "Song available")):
            out.append(line)
    cleaned = "\n".join(out).strip()
    return re.sub(r"\n{3,}", "\n\n", cleaned)


def _season_sections(season_key: str) -> tuple[str, ...]:
    sk = (season_key or "").strip().lower()
    if sk in {"lent", "advent"}:
        return ("entrance", "offertory", "communion")
    if sk in {"easter", "christmas"}:
        return ("entrance", "communion", "recessional")
    return ("entrance", "offertory", "communion", "recessional")


def _load_cache() -> dict[str, Any]:
    if not _CACHE_PATH.is_file():
        return {"items": []}
    try:
        data = json.loads(_CACHE_PATH.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return {"items": []}
    if not isinstance(data, dict):
        return {"items": []}
    if not isinstance(data.get("items"), list):
        data["items"] = []
    return data


def _save_cache(data: dict[str, Any]) -> None:
    _CACHE_PATH.parent.mkdir(parents=True, exist_ok=True)
    _CACHE_PATH.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")


def discover_hymns_for_readings(
    *,
    gospel_reference: str,
    season_key: str,
    max_candidates: int = 20,
    fetch_lyrics_count: int = 8,
) -> dict[str, list[dict[str, str]]]:
    """
    Pull extra song titles/lyrics from Hymnary by scripture reference.
    Returns items by section with id/title only and stores full lyrics in cache.
    """
    ref = (gospel_reference or "").strip()
    if not ref:
        return {}

    try:
        feed = _read_json_url(_H_API + quote_plus(ref))
    except (URLError, TimeoutError, json.JSONDecodeError, ValueError):
        return {}

    rows: list[dict[str, str]] = []
    seen_titles: set[str] = set()
    for key, val in feed.items():
        item = val if isinstance(val, dict) else {}
        title = _normalize_title(str(item.get("title") or key or ""))
        text_link = str(item.get("text link") or "").strip()
        if not title or not text_link:
            continue
        low = title.lower()
        if low in seen_titles:
            continue
        seen_titles.add(low)
        rows.append({"title": title, "text_link": text_link})
        if len(rows) >= max_candidates:
            break

    if not rows:
        return {}

    sections = _season_sections(season_key)
    cache = _load_cache()
    items: list[dict[str, Any]] = [x for x in cache.get("items", []) if isinstance(x, dict)]
    by_id: dict[str, dict[str, Any]] = {str(x.get("id") or ""): x for x in items}

    now = datetime.now(timezone.utc).isoformat()
    picked: list[dict[str, str]] = []
    for idx, row in enumerate(rows):
        title = row["title"]
        hid = _title_to_id(title)
        ent = by_id.get(hid)
        if ent is None:
            ent = {
                "id": hid,
                "title": title,
                "language": "",
                "lyrics": "",
                "source": "hymnary",
                "text_link": row["text_link"],
                "sections": list(sections),
                "seasons": ["all", season_key],
                "updated_at": now,
            }
            by_id[hid] = ent
        else:
            ent["title"] = title
            ent["language"] = str(ent.get("language") or "")
            ent["source"] = "hymnary"
            ent["text_link"] = row["text_link"]
            ent["sections"] = list(sections)
            ent["updated_at"] = now

        # Hydrate lyrics for first few candidates so selected items can render full text.
        if idx < fetch_lyrics_count and not str(ent.get("lyrics") or "").strip():
            try:
                page_text = _read_text_url(row["text_link"])
                rep = extract_representative_text(page_text)
                if rep:
                    ent["lyrics"] = rep
            except (URLError, TimeoutError):
                pass

        picked.append(
            {
                "id": hid,
                "title": title,
                "language": str(ent.get("language") or ""),
                "has_lyrics": bool(str(ent.get("lyrics") or "").strip()),
            }
        )

    cache["items"] = list(by_id.values())
    try:
        _save_cache(cache)
    except OSError:
        pass

    out: dict[str, list[dict[str, str]]] = {sec: [] for sec in sections}
    for i, song in enumerate(picked):
        sec = sections[i % len(sections)]
        out[sec].append(song)
    return out

