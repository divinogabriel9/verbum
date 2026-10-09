"""Weekly shared AI style posters — one hero per visual style for the Sunday.

Generated once (shared Supabase cache + local disk), reused by every parish.
"""

from __future__ import annotations

import logging
import re
import time
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


def clear_local_weekly_style(*, sunday: str, style: str, output_dir: Path) -> None:
    """Remove local hero + UI derivatives so a force regenerate cannot reuse stale files."""
    hero = local_hero_path(output_dir, sunday=sunday, style=style)
    for path in (
        hero,
        ui_thumb_path(hero, max_w=720),
        ui_thumb_path(hero, max_w=1600),
    ):
        try:
            if path.is_file():
                path.unlink()
        except OSError:
            logger.debug("weekly local clear failed for %s", path, exc_info=True)

def resolve_hero_file(*, sunday: str, style: str, output_dir: Path) -> Optional[Path]:
    from services.ai_hero_cache import resolve_cached_hero_path

    path = local_hero_path(output_dir, sunday=sunday, style=style)
    return resolve_cached_hero_path(path, date=sunday, style=style)


def shared_ui_thumb_relative_path(date: str, style: str) -> str:
    iso = (date or "").strip()
    resolved = resolve_ai_image_style(style)
    return f"shared/ai-heroes/{iso}_{resolved}_hero_ui720.webp"


def shared_ui_card_relative_path(date: str, style: str) -> str:
    iso = (date or "").strip()
    resolved = resolve_ai_image_style(style)
    return f"shared/ai-heroes/{iso}_{resolved}_hero_ui1600.webp"


def try_upload_shared_ui_thumb(thumb_path: Path, *, date: str, style: str, max_w: int = 720) -> bool:
    if not thumb_path.is_file():
        return False
    try:
        from services.ai_hero_cache import shared_cache_ready
        from services.storage_assets import upload_shared_asset

        if not shared_cache_ready():
            return False
        remote = (
            shared_ui_card_relative_path(date, style)
            if int(max_w) >= 1200
            else shared_ui_thumb_relative_path(date, style)
        )
        upload_shared_asset(
            relative_path=remote,
            raw=thumb_path.read_bytes(),
            content_type="image/webp",
            upsert=True,
        )
        return True
    except Exception:
        logger.debug("weekly UI thumb upload failed", exc_info=True)
        return False


def signed_or_proxy_thumb_url(*, sunday: str, style: str) -> str:
    """UI thumb URL safe for ``<img src>`` (signed when possible).

    Bearer tokens are not sent on raw image tags, so prefer signed Supabase URLs.
    Fall back to the auth-gated app proxy (JS hydrates those via fetch).

    Never return the full hero as a "thumb" — home CTA and pickers expect a small WebP.
    """
    resolved = resolve_ai_image_style(style)
    proxy = f"/api/weekly-style-posters/image?date={sunday}&style={resolved}&variant=thumb"
    try:
        from services.ai_hero_cache import shared_cache_ready
        from services.storage_assets import shared_asset_exists, signed_service_asset_url

        if shared_cache_ready():
            thumb_remote = shared_ui_thumb_relative_path(sunday, resolved)
            if shared_asset_exists(relative_path=thumb_remote):
                url = signed_service_asset_url(path=thumb_remote, expires_in=3600)
                if url:
                    return url
    except Exception:
        logger.debug("weekly poster signed URL failed for %s %s", sunday, style, exc_info=True)
    return proxy


def ui_thumb_path(hero_path: Path, *, max_w: int = 720) -> Path:
    return hero_path.with_name(f"{hero_path.stem}_ui{int(max_w)}.webp")


def ensure_ui_thumb(
    hero_path: Path,
    *,
    max_w: int = 720,
    sunday: str = "",
    style: str = "",
    quality: int = 70,
) -> Path:
    """Create/return a WebP beside the hero for UI use (picker or CTA card)."""
    thumb = ui_thumb_path(hero_path, max_w=max_w)
    created = False
    try:
        if thumb.is_file() and thumb.stat().st_mtime >= hero_path.stat().st_mtime:
            pass
        else:
            from PIL import Image

            with Image.open(hero_path) as im:
                rgb = im.convert("RGB")
                w, h = rgb.size
                if w > max_w:
                    nh = int(round(h * (max_w / float(w))))
                    rgb = rgb.resize((max_w, nh), Image.Resampling.LANCZOS)
                thumb.parent.mkdir(parents=True, exist_ok=True)
                # method=2 is much faster than 4 — home CTA first paint depends on this.
                rgb.save(thumb, "WEBP", quality=int(quality), method=2)
            created = True
    except Exception:
        logger.debug("weekly UI thumb failed for %s", hero_path, exc_info=True)
        return hero_path
    if (created or thumb.is_file()) and sunday and style:
        try_upload_shared_ui_thumb(thumb, date=sunday, style=style, max_w=max_w)
    return thumb if thumb.is_file() else hero_path


def resolve_ui_thumb_file(
    *,
    sunday: str,
    style: str,
    output_dir: Path,
    max_w: int = 720,
    quality: int = 70,
) -> Optional[Path]:
    """Prefer an existing/shared UI WebP; only fall back to full-hero conversion."""
    resolved = resolve_ai_image_style(style)
    hero_local = local_hero_path(output_dir, sunday=sunday, style=resolved)
    thumb_local = ui_thumb_path(hero_local, max_w=max_w)
    hero = hero_local if hero_local.is_file() else resolve_hero_file(
        sunday=sunday, style=resolved, output_dir=output_dir
    )
    if thumb_local.is_file():
        # Rebuild when the hero is newer (regenerate left a stale shared/local WebP).
        try:
            if hero is not None and hero.is_file() and thumb_local.stat().st_mtime < hero.stat().st_mtime:
                out = ensure_ui_thumb(
                    hero, sunday=sunday, style=resolved, max_w=max_w, quality=quality
                )
                return out if out.is_file() else thumb_local
        except OSError:
            pass
        return thumb_local
    try:
        from services.ai_hero_cache import shared_cache_ready
        from services.storage_assets import download_service_asset

        if shared_cache_ready():
            remote = (
                shared_ui_card_relative_path(sunday, resolved)
                if int(max_w) >= 1200
                else shared_ui_thumb_relative_path(sunday, resolved)
            )
            raw = download_service_asset(path=remote)
            if raw:
                thumb_local.parent.mkdir(parents=True, exist_ok=True)
                thumb_local.write_bytes(raw)
                if thumb_local.is_file():
                    # If hero is newer than the downloaded shared thumb, rebuild.
                    try:
                        if (
                            hero is not None
                            and hero.is_file()
                            and thumb_local.stat().st_mtime < hero.stat().st_mtime
                        ):
                            out = ensure_ui_thumb(
                                hero,
                                sunday=sunday,
                                style=resolved,
                                max_w=max_w,
                                quality=quality,
                            )
                            return out if out.is_file() else thumb_local
                    except OSError:
                        pass
                    return thumb_local
    except Exception:
        logger.debug("shared UI thumb download failed for %s %s", sunday, style, exc_info=True)
    if hero is None or not hero.is_file():
        return None
    out = ensure_ui_thumb(hero, sunday=sunday, style=resolved, max_w=max_w, quality=quality)
    return out if out.is_file() else None


def resolve_ui_card_file(*, sunday: str, style: str, output_dir: Path) -> Optional[Path]:
    """Sharp home-CTA WebP (~1600px) — much smaller than full PNG, not blurry on the card."""
    return resolve_ui_thumb_file(
        sunday=sunday,
        style=style,
        output_dir=output_dir,
        max_w=1600,
        quality=84,
    )


def rebuild_ui_derivatives(*, sunday: str, style: str, output_dir: Path) -> None:
    """Force-rebuild picker/CTA WebPs from the current hero and upsert shared copies.

    Needed after regenerate: local thumbs are cleared, but stale shared WebPs would
    otherwise be re-downloaded and keep showing the old artwork.
    """
    resolved = resolve_ai_image_style(style)
    hero = resolve_hero_file(sunday=sunday, style=resolved, output_dir=output_dir)
    if hero is None or not hero.is_file():
        return
    for max_w, quality in ((720, 70), (1600, 84)):
        thumb = ui_thumb_path(hero, max_w=max_w)
        try:
            if thumb.is_file():
                thumb.unlink()
        except OSError:
            logger.debug("weekly UI rebuild unlink failed for %s", thumb, exc_info=True)
        ensure_ui_thumb(
            hero,
            sunday=sunday,
            style=resolved,
            max_w=max_w,
            quality=quality,
        )


def _with_cache_bust(url: str, bust: str) -> str:
    """Append ``v=`` only to same-origin proxy URLs — never mutate signed HTTPS URLs."""
    raw = (url or "").strip()
    if not raw or not bust:
        return raw
    if not raw.startswith("/api/"):
        return raw
    sep = "&" if "?" in raw else "?"
    if f"{sep}v=" in raw or raw.endswith(f"v={bust}") or f"?v=" in raw:
        return raw
    return f"{raw}{sep}v={bust}"


def signed_or_proxy_card_url(*, sunday: str, style: str) -> str:
    """Home CTA / large preview URL — prefer signed 1600 WebP, else auth proxy."""
    resolved = resolve_ai_image_style(style)
    proxy = f"/api/weekly-style-posters/image?date={sunday}&style={resolved}&variant=card"
    try:
        from services.ai_hero_cache import shared_cache_ready
        from services.storage_assets import shared_asset_exists, signed_service_asset_url

        if shared_cache_ready():
            card_remote = shared_ui_card_relative_path(sunday, resolved)
            if shared_asset_exists(relative_path=card_remote):
                url = signed_service_asset_url(path=card_remote, expires_in=3600)
                if url:
                    return url
    except Exception:
        logger.debug("weekly card signed URL failed for %s %s", sunday, style, exc_info=True)
    return proxy


def full_or_proxy_hero_url(*, sunday: str, style: str) -> str:
    """Prefer a signed Supabase URL for full heroes; fall back to app proxy."""
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
        # Local-only readiness for the catalog — shared-cache HEAD checks and signed
        # URL minting made Extras feel stuck on every Step 6 visit.
        ready = local_hero_path(output_dir, sunday=sunday, style=sid).is_file()
        proxy = f"/api/weekly-style-posters/image?date={sunday}&style={sid}&variant=thumb"
        card_proxy = f"/api/weekly-style-posters/image?date={sunday}&style={sid}&variant=card"
        full_proxy = f"/api/weekly-style-posters/image?date={sunday}&style={sid}"
        items.append(
            {
                "id": sid,
                "label": weekly_style_label(sid),
                "ready": ready,
                "thumb_url": proxy if ready else "",
                "card_url": card_proxy if ready else "",
                "proxy_url": proxy,
                "full_url": full_proxy if ready else "",
            }
        )
    versions: dict[str, Any] = {}
    try:
        from services.weekly_poster_versions import versions_payload

        versions = versions_payload(output_dir, sunday=sunday)
    except Exception:
        logger.debug("weekly versions payload failed for %s", sunday, exc_info=True)
        versions = {
            "ok": True,
            "sunday": sunday,
            "active_version": 0,
            "versions": [],
            "sundays": [],
        }
    return {
        "ok": True,
        "date": mass,
        "sunday": sunday,
        "items": items,
        "ready_count": sum(1 for it in items if it["ready"]),
        "total": len(items),
        "versions": versions,
    }


def _normalize_style_filter(styles: Optional[list[str] | tuple[str, ...] | str]) -> list[str]:
    """Return requested weekly style ids (subset of the fixed weekly set), or []."""
    allowed = weekly_style_ids()
    raw: list[str] = []
    if isinstance(styles, str):
        raw = [styles]
    elif isinstance(styles, (list, tuple)):
        raw = [str(s) for s in styles]
    out: list[str] = []
    for item in raw:
        key = resolve_ai_image_style((item or "").strip())
        if key in allowed and key not in out:
            out.append(key)
    return out


def ensure_weekly_heroes(
    iso: str,
    *,
    output_dir: Path,
    image_backend: str = "openai",
    max_generate: int = 5,
    force: bool = False,
    styles: Optional[list[str] | tuple[str, ...] | str] = None,
    version: Optional[int] = None,
    new_version: bool = False,
    overwrite_only: bool = False,
) -> dict[str, Any]:
    """Generate shared heroes for the Sunday of ``iso`` (up to ``max_generate``).

    When ``new_version`` / ``force`` is true, skip cache hits and (unless
    ``overwrite_only``) allocate a versioned set (v1, v2, …).
    ``overwrite_only`` is for prompt tests: regenerate selected styles in place
    without creating a new version row.
    Pass ``styles`` to generate only those style ids (enables 1/N client progress).
    """
    mass = normalize_mass_date(iso)
    if not mass:
        return {"ok": False, "error": "invalid_date", "generated": [], "skipped": []}
    sunday = sunday_for_mass_date(mass)
    generated: list[str] = []
    skipped: list[str] = []
    errors: list[dict[str, str]] = []
    wanted = _normalize_style_filter(styles)
    queue = wanted or weekly_style_ids()
    overwrite_only = bool(overwrite_only)
    regenerate = bool(force or new_version or overwrite_only)
    # Prompt-test / in-place path: rewrite active heroes — do not allocate a new vN.
    allocate_version = bool(new_version) or (bool(force) and not overwrite_only)
    version_no: Optional[int] = None
    try:
        version_no = int(version) if version is not None else None
    except (TypeError, ValueError):
        version_no = None

    from generators.ai_poster_generator import ensure_ai_hero
    from services.lectionary_service import get_liturgical_data
    from services.weekly_poster_versions import (
        begin_new_version,
        ensure_baseline_version_from_active,
        load_manifest,
        record_style_in_version,
        versions_payload,
    )

    # Preserve any existing active set as v1 before the first "new version" run.
    ensure_baseline_version_from_active(
        output_dir, sunday=sunday, allow_download=bool(regenerate)
    )
    # In-place regenerate: default to the active version so archives stay in sync.
    if overwrite_only and version_no is None:
        try:
            version_no = int(load_manifest(output_dir, sunday=sunday).get("active_version") or 0) or None
        except Exception:
            version_no = None
    # Allocate a version only once per batch — client must reuse ``version`` on later styles.
    if allocate_version and version_no is None:
        begun = begin_new_version(output_dir, sunday=sunday)
        version_no = int(begun.get("version") or 1)
    elif allocate_version and version_no is not None:
        # Continue an in-flight batch: keep the target version row without reallocating.
        from services.weekly_poster_versions import load_manifest, save_manifest

        manifest = load_manifest(output_dir, sunday=sunday)
        versions = list(manifest.get("versions") or [])
        if not any(int(v.get("version") or 0) == int(version_no) for v in versions):
            from datetime import datetime, timezone

            from services.weekly_poster_versions import format_version_label

            versions.append(
                {
                    "version": int(version_no),
                    "created_at": datetime.now(timezone.utc)
                    .replace(microsecond=0)
                    .isoformat()
                    .replace("+00:00", "Z"),
                    "label": format_version_label(int(version_no), []),
                    "styles": [],
                    "status": "generating",
                }
            )
            manifest["versions"] = versions
            save_manifest(output_dir, sunday=sunday, manifest=manifest)
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

    for sid in queue:
        if len(generated) >= max_generate:
            skipped.append(sid)
            continue
        if not regenerate and style_ready(sunday=sunday, style=sid, output_dir=output_dir):
            skipped.append(sid)
            continue
        try:
            if regenerate:
                clear_local_weekly_style(sunday=sunday, style=sid, output_dir=output_dir)
            ensure_ai_hero(
                sunday,
                style=sid,
                reuse_existing_hero=not regenerate,
                gospel_quote=gospel_quote,
                gospel_reference=gospel_ref,
                liturgical_title=title,
                gospel_text=gospel_text,
                season_key=season_key,
                image_backend=image_backend,
            )
            generated.append(sid)
            # New-version batches and in-place overwrites both update the version archive.
            if version_no and (allocate_version or overwrite_only):
                record_style_in_version(
                    output_dir,
                    sunday=sunday,
                    version=int(version_no),
                    style=sid,
                    prune_copies=not overwrite_only,
                )
        except Exception as exc:
            logger.warning("weekly hero ensure failed %s %s: %s", sunday, sid, exc)
            errors.append({"style": sid, "error": str(exc)[:200]})

    # Rebuild UI derivatives for freshly generated heroes so shared thumbs match.
    for sid in generated:
        try:
            rebuild_ui_derivatives(sunday=sunday, style=sid, output_dir=output_dir)
        except Exception:
            logger.debug("weekly UI rebuild failed %s %s", sunday, sid, exc_info=True)

    # Warm any styles that were already ready (no generate this call).
    for sid in queue:
        if sid in generated:
            continue
        try:
            resolve_ui_thumb_file(sunday=sunday, style=sid, output_dir=output_dir)
            resolve_ui_card_file(sunday=sunday, style=sid, output_dir=output_dir)
        except Exception:
            logger.debug("weekly UI asset warm failed %s %s", sunday, sid, exc_info=True)

    # First-time fill (no version requested): snapshot as v1 when the full set is ready.
    if not regenerate:
        ready_all = all(
            style_ready(sunday=sunday, style=sid, output_dir=output_dir)
            for sid in weekly_style_ids()
        )
        if ready_all:
            ensure_baseline_version_from_active(
                output_dir, sunday=sunday, allow_download=False
            )
    elif allocate_version and version_no:
        from services.weekly_poster_versions import finalize_version, version_complete

        # Activate even for partial sets so Extras unlocks after generating 1+ styles.
        finalize_version(
            output_dir,
            sunday=sunday,
            version=int(version_no),
            styles=list(generated) or list(queue),
            activate=True,
        )
        if version_complete(output_dir, sunday=sunday, version=int(version_no)):
            from services.weekly_poster_versions import promote_version_to_active

            try:
                promote_version_to_active(
                    output_dir,
                    sunday=sunday,
                    version=int(version_no),
                    sync_shared=False,
                )
            except Exception:
                logger.debug(
                    "weekly partial/full promote skipped %s v%s",
                    sunday,
                    version_no,
                    exc_info=True,
                )
    elif overwrite_only and version_no and generated:
        from services.weekly_poster_versions import finalize_version

        # Keep the same version row; refresh its style list / label after in-place remakes.
        # Do not prune sibling styles that still match the previous version.
        finalize_version(
            output_dir,
            sunday=sunday,
            version=int(version_no),
            styles=list(generated),
            activate=True,
            prune_copies=False,
        )

    catalog = catalog_for_date(mass, output_dir=output_dir)
    if generated:
        # Prefer auth-gated proxy URLs with a bust so the client always hydrates
        # fresh local bytes (signed URLs must not be mutated — it breaks the signature).
        bust = str(int(time.time()))
        touch = set(generated)
        for item in catalog.get("items") or []:
            if not isinstance(item, dict):
                continue
            sid = str(item.get("id") or "")
            if sid not in touch:
                continue
            proxy = f"/api/weekly-style-posters/image?date={sunday}&style={sid}&variant=thumb"
            card_proxy = f"/api/weekly-style-posters/image?date={sunday}&style={sid}&variant=card"
            full_proxy = f"/api/weekly-style-posters/image?date={sunday}&style={sid}"
            item["thumb_url"] = _with_cache_bust(proxy, bust)
            item["card_url"] = _with_cache_bust(card_proxy, bust)
            item["proxy_url"] = _with_cache_bust(proxy, bust)
            item["full_url"] = _with_cache_bust(full_proxy, bust)

    versions = versions_payload(output_dir, sunday=sunday)
    return {
        "ok": True,
        "sunday": sunday,
        "generated": generated,
        "skipped": skipped,
        "errors": errors,
        "force": bool(force),
        "new_version": bool(new_version),
        "overwrite_only": bool(overwrite_only),
        "version": version_no if (allocate_version or overwrite_only) else None,
        "styles": list(queue),
        "catalog": catalog,
        "versions": versions,
    }
