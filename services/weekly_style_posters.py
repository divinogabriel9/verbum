"""Weekly shared AI style posters — one hero per visual style for the Sunday.

Generated once (shared Supabase cache + local disk), reused by every parish.
"""

from __future__ import annotations

import logging
import re
from datetime import date, timedelta
from pathlib import Path
from typing import Any, Optional

from services.ai_styles import load_visual_styles, resolve_ai_image_style

logger = logging.getLogger(__name__)

_ISO = re.compile(r"^\d{4}-\d{2}-\d{2}$")

# Fixed weekly picker set (matches Mass Builder style options minus "auto").
WEEKLY_STYLE_IDS: tuple[str, ...] = (
    "cinematic",
    "realistic",
    "renaissance",
    "stained_glass",
    "modern",
)


def sunday_for_mass_date(iso: str) -> str:
    """Return the Sunday ISO date for the Mass week containing ``iso``."""
    d = date.fromisoformat(iso.strip())
    # Monday=0 … Sunday=6 → back to Sunday
    sunday = d - timedelta(days=(d.weekday() + 1) % 7)
    return sunday.isoformat()


def normalize_mass_date(iso: str) -> Optional[str]:
    raw = (iso or "").strip()
    if not _ISO.fullmatch(raw):
        return None
    try:
        date.fromisoformat(raw)
    except ValueError:
        return None
    return raw


def weekly_style_ids() -> list[str]:
    styles = load_visual_styles()
    out: list[str] = []
    for sid in WEEKLY_STYLE_IDS:
        key = resolve_ai_image_style(sid)
        if key in styles and key not in out:
            out.append(key)
    if not out:
        out = [resolve_ai_image_style("cinematic")]
    return out


def weekly_style_label(style_id: str) -> str:
    styles = load_visual_styles()
    key = resolve_ai_image_style(style_id)
    vs = styles.get(key)
    if vs and getattr(vs, "label", None):
        return str(vs.label)
    return key.replace("_", " ").title()


def local_hero_path(output_dir: Path, *, sunday: str, style: str) -> Path:
    resolved = resolve_ai_image_style(style)
    return Path(output_dir) / "images" / f"{sunday}_{resolved}_hero.png"


def style_ready(*, sunday: str, style: str, output_dir: Path) -> bool:
    path = local_hero_path(output_dir, sunday=sunday, style=style)
    if path.is_file():
        return True
    try:
        from services.ai_hero_cache import shared_hero_exists

        return bool(shared_hero_exists(date=sunday, style=style))
    except Exception:
        return False


def resolve_hero_file(*, sunday: str, style: str, output_dir: Path) -> Optional[Path]:
    from services.ai_hero_cache import resolve_cached_hero_path

    path = local_hero_path(output_dir, sunday=sunday, style=style)
    return resolve_cached_hero_path(path, date=sunday, style=style)


def signed_or_proxy_thumb_url(*, sunday: str, style: str) -> str:
    """Prefer a signed Supabase URL; fall back to app proxy path."""
    resolved = resolve_ai_image_style(style)
    proxy = f"/api/weekly-style-posters/image?date={sunday}&style={resolved}"
    try:
        from services.ai_hero_cache import shared_cache_ready, shared_hero_relative_path
        from services.storage_assets import signed_service_asset_url

        if shared_cache_ready():
            remote = shared_hero_relative_path(sunday, resolved)
            url = signed_service_asset_url(path=remote, expires_in=3600)
            if url:
                return url
    except Exception:
        logger.debug("weekly poster signed URL failed for %s %s", sunday, style, exc_info=True)
    return proxy


def catalog_for_date(iso: str, *, output_dir: Path) -> dict[str, Any]:
    mass = normalize_mass_date(iso)
    if not mass:
        return {"ok": False, "error": "invalid_date", "items": []}
    sunday = sunday_for_mass_date(mass)
    items: list[dict[str, Any]] = []
    for sid in weekly_style_ids():
        ready = style_ready(sunday=sunday, style=sid, output_dir=output_dir)
        items.append(
            {
                "id": sid,
                "label": weekly_style_label(sid),
                "ready": ready,
                "thumb_url": signed_or_proxy_thumb_url(sunday=sunday, style=sid) if ready else "",
                "proxy_url": f"/api/weekly-style-posters/image?date={sunday}&style={sid}",
            }
        )
    return {
        "ok": True,
        "date": mass,
        "sunday": sunday,
        "items": items,
        "ready_count": sum(1 for it in items if it["ready"]),
        "total": len(items),
    }


def ensure_weekly_heroes(
    iso: str,
    *,
    output_dir: Path,
    image_backend: str = "openai",
    max_generate: int = 5,
) -> dict[str, Any]:
    """Generate missing shared heroes for the Sunday of ``iso`` (up to ``max_generate``)."""
    mass = normalize_mass_date(iso)
    if not mass:
        return {"ok": False, "error": "invalid_date", "generated": [], "skipped": []}
    sunday = sunday_for_mass_date(mass)
    generated: list[str] = []
    skipped: list[str] = []
    errors: list[dict[str, str]] = []

    from generators.ai_poster_generator import ensure_ai_hero
    from services.lectionary_service import get_liturgical_data

    data = get_liturgical_data(sunday) or {}
    title = str(data.get("title") or "Sunday Mass").replace(" Celebration", "").strip() or "Sunday Mass"
    gospel_ref = str(data.get("gospel_reference") or "Gospel").strip()
    gospel_text = str(data.get("gospel_text") or "").strip()
    gospel_quote = str(data.get("gospel_slide_quote") or "").strip() or gospel_text[:280]
    season_key = str(data.get("season") or "ordinary_time")

    try:
        from core.liturgical_calendar import get_liturgical_color

        lit = get_liturgical_color(sunday) or {}
        season_key = str(lit.get("season") or season_key or "ordinary_time")
    except Exception:
        pass

    for sid in weekly_style_ids():
        if len(generated) >= max_generate:
            skipped.append(sid)
            continue
        if style_ready(sunday=sunday, style=sid, output_dir=output_dir):
            skipped.append(sid)
            continue
        try:
            ensure_ai_hero(
                sunday,
                style=sid,
                reuse_existing_hero=True,
                gospel_quote=gospel_quote,
                gospel_reference=gospel_ref,
                liturgical_title=title,
                gospel_text=gospel_text,
                season_key=season_key,
                image_backend=image_backend,
            )
            generated.append(sid)
        except Exception as exc:
            logger.warning("weekly hero ensure failed %s %s: %s", sunday, sid, exc)
            errors.append({"style": sid, "error": str(exc)[:200]})

    return {
        "ok": True,
        "sunday": sunday,
        "generated": generated,
        "skipped": skipped,
        "errors": errors,
        "catalog": catalog_for_date(mass, output_dir=output_dir),
    }
