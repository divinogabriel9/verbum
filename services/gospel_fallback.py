"""Fallback Gospel body text when USCCB HTML is unavailable (e.g. network block).

Uses bible-api.com (World English Bible). Not a substitute for the NABRE lectionary text;
for liturgical use, verify against bible.usccb.org.
"""

from __future__ import annotations

import re
import time

import requests


def gospel_reference_looks_like_citation_only(gospel_reference: str, gospel_text: str) -> bool:
    ref = (gospel_reference or "").strip()
    body = (gospel_text or "").strip()
    if not body:
        return True
    if ref and body == ref:
        return True
    if len(body) <= len(ref) + 40 and "." not in body:
        return True
    return False


def fetch_world_english_gospel(reference: str, *, max_attempts: int = 3) -> str | None:
    reference = (reference or "").strip()
    if not reference:
        return None
    if not re.match(r"^[0-9A-Za-zÀ-ÖØ-öø\s]+ +\d+", reference):
        return None

    path = reference.replace(" ", "+")
    url = f"https://bible-api.com/{path}"
    for attempt in range(max_attempts):
        try:
            response = requests.get(url, timeout=15)
            if response.status_code == 200:
                data = response.json()
                text = (data.get("text") or "").replace("\xa0", " ").strip()
                return text or None
            if response.status_code in (429, 500, 502, 503, 504) and attempt + 1 < max_attempts:
                time.sleep(0.5 * (2**attempt))
                continue
            return None
        except (requests.RequestException, ValueError):
            if attempt + 1 < max_attempts:
                time.sleep(0.5 * (2**attempt))
                continue
            return None
    return None
