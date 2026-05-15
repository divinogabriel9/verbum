"""
Rule-based hymn suggestions from liturgical season (calendar key) and lectionary cycle.

Data file: data/hymn_suggestions.json — edit freely for your repertoire.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

_PROJECT_ROOT = Path(__file__).resolve().parents[1]
_DATA_PATH = _PROJECT_ROOT / "data" / "hymn_suggestions.json"


def _load_data() -> dict[str, Any]:
    if not _DATA_PATH.is_file():
        return {"by_season": {}, "by_cycle": {}}
    try:
        return json.loads(_DATA_PATH.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return {"by_season": {}, "by_cycle": {}}


def recommend_hymns(
    *,
    season_key: str,
    lectionary_cycle: str,
    limit: int = 10,
) -> list[dict[str, str]]:
    """
    Return suggestions as {\"title\": str, \"source\": \"season\"|\"cycle\"}.

    season_key: machine key from liturgical calendar (e.g. advent, christmas, lent).
    lectionary_cycle: A, B, or C.
    """
    data = _load_data()
    by_season: dict[str, list[str]] = data.get("by_season") or {}
    by_cycle: dict[str, list[str]] = data.get("by_cycle") or {}

    sk = (season_key or "").strip().lower().replace(" ", "_")
    lc = (lectionary_cycle or "").strip().upper()[:1]

    out: list[dict[str, str]] = []
    seen: set[str] = set()

    for title in by_season.get(sk, []) or []:
        t = str(title).strip()
        if t and t.lower() not in seen:
            seen.add(t.lower())
            out.append({"title": t, "source": "season"})
            if len(out) >= limit:
                return out[:limit]

    if lc and lc in ("A", "B", "C"):
        for title in by_cycle.get(lc, []) or []:
            t = str(title).strip()
            if t and t.lower() not in seen:
                seen.add(t.lower())
                out.append({"title": t, "source": "cycle"})
                if len(out) >= limit:
                    return out[:limit]

    for title in by_season.get("ordinary_time", []) or []:
        t = str(title).strip()
        if sk != "ordinary_time" and t and t.lower() not in seen:
            seen.add(t.lower())
            out.append({"title": t, "source": "season_fallback"})
            if len(out) >= limit:
                break

    return out[:limit]
