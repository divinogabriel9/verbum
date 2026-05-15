import re

from services.usccb_client import USCCB_BROWSER_HEADERS, get_usccb_soup

# Backward compatibility with older imports
_DEFAULT_HEADERS = USCCB_BROWSER_HEADERS


def fetch_gospel_text(usccb_url: str):
    """Extract Gospel body text from a USCCB daily readings HTML page."""
    try:
        soup, _http = get_usccb_soup(usccb_url.strip())
        if soup is None:
            return None

        gospel_header = None
        for h in soup.find_all(["h2", "h3", "h4"]):
            if "Gospel" in h.get_text():
                gospel_header = h
                break

        if not gospel_header:
            return None

        parts = []
        for p in gospel_header.find_all_next("p", limit=50):
            t = p.get_text(" ", strip=True)
            if not t:
                continue
            if "Copyright" in t or "Confraternity of Christian Doctrine" in t:
                break
            if re.match(r"^Get the Daily Readings", t, re.I):
                break
            if "USCCB" in t and len(t) < 160:
                break
            parts.append(t)

        if len(parts) == 0:
            addr = gospel_header.find_next("div", class_="address")
            if addr and addr.a and addr.a.get("href"):
                return _fetch_gospel_from_pericope(addr.a["href"])

            return None

        return " ".join(parts)

    except Exception:
        return None


def _fetch_gospel_from_pericope(href: str):
    """Fallback: follow the pericope link (e.g. .../bible/john/16?29)."""
    try:
        soup, _http = get_usccb_soup((href or "").strip())
        if soup is None:
            return None
        parts = []
        for p in soup.find_all("p", limit=45):
            t = p.get_text(" ", strip=True)
            if len(t) < 30:
                continue
            if "Copyright" in t or "USCCB" in t and len(t) < 200:
                break
            parts.append(t)
        return " ".join(parts) if parts else None
    except Exception:
        return None
