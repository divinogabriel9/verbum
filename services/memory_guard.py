"""Process memory hygiene for small Render instances (OOM → Bad Gateway).

Heavy paths (Mass PPTX + LibreOffice preview) load multi‑MB Presentation
objects and rasterizers. Without release, RSS climbs until the platform
restarts the service.
"""

from __future__ import annotations

import gc
import logging
import os
import shutil
import tempfile
import threading
import time
from contextlib import contextmanager
from pathlib import Path
from typing import Iterator, Optional

logger = logging.getLogger(__name__)

# Only one LibreOffice / full-deck generate at a time — concurrent jobs OOM
# 512MB–1GB instances even when each job alone would fit.
_HEAVY_LOCK = threading.Semaphore(1)
_HEAVY_WAIT_S = float(os.environ.get("HEAVY_JOB_WAIT_S", "240") or "240")

_PROJECT_ROOT = Path(__file__).resolve().parents[1]
_OUTPUT_DIR = _PROJECT_ROOT / "outputs"


def is_constrained_host() -> bool:
    """True on Render / when MEMORY_CONSTRAINED=1."""
    if os.environ.get("MEMORY_CONSTRAINED", "").strip() in ("1", "true", "yes"):
        return True
    return bool(os.environ.get("RENDER") or os.environ.get("RENDER_EXTERNAL_URL"))


def rss_mb() -> Optional[float]:
    """Best-effort resident set size in MiB (Linux /proc or resource)."""
    try:
        with open("/proc/self/status", encoding="utf-8") as fh:
            for line in fh:
                if line.startswith("VmRSS:"):
                    parts = line.split()
                    if len(parts) >= 2:
                        return float(parts[1]) / 1024.0
    except OSError:
        pass
    try:
        import resource

        usage = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
        # macOS reports bytes; Linux reports KiB.
        if os.uname().sysname == "Darwin":
            return float(usage) / (1024.0 * 1024.0)
        return float(usage) / 1024.0
    except Exception:
        return None


def force_gc() -> None:
    try:
        gc.collect()
        gc.collect()
    except Exception:
        pass


def release_presentation_caches() -> None:
    try:
        from generators.powerpoint import clear_presentation_caches

        clear_presentation_caches()
    except Exception:
        logger.debug("clear_presentation_caches failed", exc_info=True)


def prune_preview_payload_cache() -> None:
    try:
        from pipeline import prune_preview_cache

        prune_preview_cache()
    except Exception:
        logger.debug("prune_preview_cache failed", exc_info=True)


def prune_platform_mem_cache() -> None:
    try:
        from services.platform_cache import prune_mem_cache

        prune_mem_cache()
    except Exception:
        logger.debug("prune_mem_cache failed", exc_info=True)


def prune_outputs(
    *,
    max_age_s: Optional[float] = None,
    keep_newest: int = 8,
) -> int:
    """Delete old generated artifacts under outputs/ (ephemeral Render disk)."""
    if max_age_s is None:
        max_age_s = float(os.environ.get("OUTPUTS_MAX_AGE_S", str(6 * 3600)) or str(6 * 3600))
    root = _OUTPUT_DIR
    if not root.is_dir():
        return 0
    now = time.time()
    removed = 0
    # Prefer age-based cleanup for bulky trees.
    for sub in ("images", "posters", "slideshow_media", "preview", "projection_decks"):
        folder = root / sub
        if not folder.is_dir():
            continue
        for path in folder.rglob("*"):
            if not path.is_file():
                continue
            try:
                if now - path.stat().st_mtime > max_age_s:
                    path.unlink(missing_ok=True)
                    removed += 1
            except OSError:
                continue
    # Keep only the newest PPTX/PDF/ZIP at the outputs root.
    artifacts: list[Path] = []
    for pattern in ("*.pptx", "*.pdf", "*.zip", "*_slideshow_cues.json"):
        artifacts.extend(p for p in root.glob(pattern) if p.is_file())
    artifacts.sort(key=lambda p: p.stat().st_mtime if p.exists() else 0, reverse=True)
    for path in artifacts[max(0, int(keep_newest)) :]:
        try:
            path.unlink(missing_ok=True)
            removed += 1
        except OSError:
            continue
    return removed


def cleanup_temp_profiles() -> int:
    """Remove leftover LibreOffice / preview temp dirs under /tmp."""
    removed = 0
    tmp = Path(tempfile.gettempdir())
    prefixes = ("lo-verbum-fonts-", "ppt-preview-", "ppt_pdf_", "verbum-")
    try:
        for path in tmp.iterdir():
            name = path.name
            if not any(name.startswith(p) for p in prefixes):
                continue
            # Keep the stable LO profile used on Linux.
            if name == "verbum-lo-user":
                continue
            try:
                if path.is_dir():
                    shutil.rmtree(path, ignore_errors=True)
                    removed += 1
                elif path.is_file():
                    path.unlink(missing_ok=True)
                    removed += 1
            except OSError:
                continue
    except OSError:
        pass
    return removed


def release_after_heavy_job(label: str = "") -> None:
    """Drop PPT caches, prune soft caches, and GC after a memory-heavy request."""
    before = rss_mb()
    release_presentation_caches()
    prune_preview_payload_cache()
    prune_platform_mem_cache()
    try:
        prune_outputs(keep_newest=6 if is_constrained_host() else 12)
    except Exception:
        logger.debug("prune_outputs failed", exc_info=True)
    force_gc()
    after = rss_mb()
    if before is not None and after is not None:
        logger.info(
            "memory release%s: %.0f → %.0f MiB RSS",
            f" ({label})" if label else "",
            before,
            after,
        )
    elif after is not None:
        logger.info("memory release%s: %.0f MiB RSS", f" ({label})" if label else "", after)


@contextmanager
def heavy_job(label: str = "job") -> Iterator[None]:
    """Serialize generate / LibreOffice work and always release caches afterward."""
    waited = False
    acquired = _HEAVY_LOCK.acquire(timeout=max(30.0, _HEAVY_WAIT_S))
    if not acquired:
        raise TimeoutError(
            f"Server is busy generating another deck. Retry in a minute ({label})."
        )
    try:
        yield
    finally:
        try:
            release_after_heavy_job(label)
        finally:
            _HEAVY_LOCK.release()


def preview_raster_scale(default: float = 1.25) -> float:
    """Lower DPI on constrained hosts to cut pypdfium2 peak RAM."""
    if is_constrained_host():
        try:
            return float(os.environ.get("PPT_PREVIEW_SCALE", "0.85") or "0.85")
        except ValueError:
            return 0.85
    return default
