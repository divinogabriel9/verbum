"""
Text-to-image for Gospel-themed sacred art (posters and hero panels).

A *short* visual scene line comes from :mod:`services.gospel_visual_prompt` (like “Jesus on the water”,
derived from the Gospel opening — not the poster quote). Style comes from ``data/styles.json``.

Primary path: OpenAI ``gpt-image-1`` when ``OPENAI_API_KEY`` is set (see ``/generate-image`` in ``server.py``).
Fallback: Hugging Face ``Tongyi-MAI/Z-Image-Turbo`` when ``HF_TOKEN`` / ``HUGGINGFACE_API_TOKEN`` is set.
Without any provider (or on total failure), writes a soft gradient placeholder so layout still works.

HF-only options: ``HF_INFERENCE_PROVIDER``, ``HF_DIFFUSION_NEGATIVE_PROMPT`` (ignored for OpenAI).
"""

from __future__ import annotations

import base64
import binascii
import json
import logging
import os
import re
from io import BytesIO
from pathlib import Path
from typing import Any, Optional
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from openai import OpenAI

from services.ai_styles import resolve_ai_image_style, style_prompt_fragment
from services.gospel_visual_prompt import build_visual_scene_line

logger = logging.getLogger(__name__)

_PROJECT_ROOT = Path(__file__).resolve().parents[1]
_IMAGES_DIR = _PROJECT_ROOT / "outputs" / "images"

# Fixed image model for InferenceClient and legacy HTTP (Tongyi-MAI only).
_DEFAULT_DIFFUSION_MODEL = "Tongyi-MAI/Z-Image-Turbo"

# Used when ``HF_DIFFUSION_NEGATIVE_PROMPT`` is not set — reduces empty / abstract hero panels.
_DEFAULT_NEGATIVE = (
    "solid color only, flat gradient background, abstract wallpaper, empty scene, "
    "no people, no faces, distant unreadable silhouettes only, modern UI, "
    "text, letters, words, typography, captions, subtitles, speech bubbles, "
    "Bible verse written on image, scripture text overlay, title card, "
    "misspelled words, garbled text, movie poster text, watermark, logo, "
    "deformed hands, extra limbs, low quality, blurry"
)


def build_hf_image_prompt(
    gospel_reference: str,
    style: str,
    *,
    visual_scene_line: str,
) -> str:
    """
    Full diffusion prompt: short visual beat + citation + no-text constraints + style.

    ``visual_scene_line`` should read like a plain scene caption (no quoted dialogue).
    """
    ref = (gospel_reference or "the Gospel").strip()
    v = " ".join((visual_scene_line or "").split()).rstrip(" ,.;")
    if len(v) > 170:
        v = v[:169].rsplit(" ", 1)[0].rstrip(" ,.;")
    if not v:
        v = f"a key moment from {ref}"
    base = (
        f"{v}. Biblical narrative painting inspired by {ref}, ancient Near East setting, "
        "robed human figures, clear faces and gestures, wide cinematic shot, environmental storytelling, "
        "purely visual illustration with no readable words in the frame, "
        "absolutely no text anywhere, no letters, no captions, no Bible verse overlay, "
        "no speech bubbles, no subtitles, no watermark, no logo, no UI"
    )
    resolved = resolve_ai_image_style(style)
    frag = style_prompt_fragment(resolved)
    if frag:
        return f"{base}, {frag}"
    return base


def _resolved_negative_prompt() -> str:
    """Env override, or built-in default when the variable is absent."""
    if "HF_DIFFUSION_NEGATIVE_PROMPT" not in os.environ:
        return _DEFAULT_NEGATIVE
    return os.environ["HF_DIFFUSION_NEGATIVE_PROMPT"].strip()


def _slug_ref(gospel_reference: str) -> str:
    s = re.sub(r"[^a-zA-Z0-9]+", "_", (gospel_reference or "scene").strip())[:60].strip("_")
    return s or "scene"


def _is_binary_image_magic(data: bytes) -> bool:
    if len(data) < 12:
        return False
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return True
    if data.startswith(b"\xff\xd8\xff"):
        return True
    if data.startswith(b"RIFF") and len(data) > 12 and data[8:12] == b"WEBP":
        return True
    return False


def _b64_decode_loose(s: str) -> Optional[bytes]:
    s = (s or "").strip()
    if not s:
        return None
    if "," in s and "base64" in s[:40].lower():
        s = s.split(",", 1)[-1].strip()
    try:
        return base64.b64decode(s, validate=False)
    except (binascii.Error, ValueError):
        return None


def _walk_for_b64_strings(obj: Any, out: list[str]) -> None:
    if isinstance(obj, str) and len(obj) > 200 and re.match(r"^[A-Za-z0-9+/=\s]+$", obj[:500]):
        out.append(obj.replace("\n", "").replace(" ", ""))
    elif isinstance(obj, dict):
        for v in obj.values():
            _walk_for_b64_strings(v, out)
    elif isinstance(obj, list):
        for v in obj:
            _walk_for_b64_strings(v, out)


def _decode_hf_image_bytes(raw: bytes) -> Optional[bytes]:
    """
    Normalize HF inference responses to raw image bytes.

    Handles:
    - Raw PNG / JPEG / WebP bytes
    - JSON error payloads (returns None)
    - JSON wrappers with base64 image fields (HF / router variants)
    """
    if _is_binary_image_magic(raw):
        return raw
    try:
        text = raw.decode("utf-8")
    except UnicodeDecodeError:
        return None
    text = text.strip()
    if not text.startswith("{") and not text.startswith("["):
        return None
    try:
        payload: Any = json.loads(text)
    except json.JSONDecodeError:
        return None

    candidates: list[str] = []
    if isinstance(payload, dict):
        for key in ("image", "images", "output", "data", "generated_image"):
            val = payload.get(key)
            if isinstance(val, str) and len(val) > 80:
                candidates.append(val)
            elif isinstance(val, list) and val and isinstance(val[0], str):
                candidates.extend(val[:3])
        _walk_for_b64_strings(payload, candidates)
    elif isinstance(payload, list) and payload:
        _walk_for_b64_strings(payload, candidates)

    for s in candidates:
        decoded = _b64_decode_loose(s)
        if decoded and _is_binary_image_magic(decoded):
            return decoded
    return None


def _write_raster_as_png(data: bytes, out_path: Path) -> bool:
    """Validate bytes as an image and re-save as PNG (RGB) for downstream Pillow use."""
    try:
        from PIL import Image
    except ImportError:
        return False
    try:
        im = Image.open(BytesIO(data))
        im.load()
        im = im.convert("RGB")
        out_path.parent.mkdir(parents=True, exist_ok=True)
        im.save(out_path, format="PNG", optimize=True)
        return True
    except OSError:
        return False


def _write_placeholder(path: Path, gospel_reference: str) -> None:
    """Deterministic soft gradient when API is unavailable or decoding fails."""
    try:
        from PIL import Image as PILImage
        from PIL import ImageDraw as PILImageDraw
    except ImportError:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(b"")
        return

    path.parent.mkdir(parents=True, exist_ok=True)
    w, h = 1024, 1024
    img = PILImage.new("RGB", (w, h), (32, 36, 48))
    dr = PILImageDraw.Draw(img)
    for i in range(h):
        t = i / max(h - 1, 1)
        r = int(40 + t * 80)
        g = int(50 + t * 70)
        b = int(90 + t * 60)
        dr.line([(0, i), (w, i)], fill=(r, g, b))
    ref = (gospel_reference or "")[:80]
    if ref:
        try:
            from PIL import ImageFont

            font = ImageFont.load_default()
            dr.text((24, 24), "Poster art (placeholder)", fill=(240, 235, 220), font=font)
            dr.text((24, 48), ref, fill=(200, 195, 180), font=font)
        except OSError:
            pass
    img.save(path, format="PNG", optimize=True)


def _save_pil_as_png_rgb(image: Any, out_path: Path) -> bool:
    """Persist a PIL-style image as RGB PNG for downstream layout code."""
    try:
        im = image
        if hasattr(im, "convert"):
            im = im.convert("RGB")
        out_path.parent.mkdir(parents=True, exist_ok=True)
        im.save(out_path, format="PNG", optimize=True)
        return True
    except Exception:
        return False


def _generate_with_inference_client(
    prompt: str,
    out_path: Path,
    *,
    token: str,
    model: str,
    negative: str,
    provider: str,
) -> bool:
    """``InferenceClient(provider=…).text_to_image`` → PNG. Returns False on failure."""
    try:
        from huggingface_hub import InferenceClient
    except ImportError:
        logger.warning("HF InferenceClient unavailable (install huggingface_hub).")
        return False
    try:
        client = InferenceClient(provider=provider, api_key=token)
        if negative:
            try:
                image = client.text_to_image(prompt, model=model, negative_prompt=negative)
            except TypeError:
                image = client.text_to_image(prompt, model=model)
        else:
            image = client.text_to_image(prompt, model=model)
        return _save_pil_as_png_rgb(image, out_path)
    except Exception as exc:
        logger.warning("HF InferenceClient text_to_image failed (provider=%s): %s", provider, exc)
        return False


def _generate_with_legacy_http(
    prompt: str,
    out_path: Path,
    *,
    token: str,
    model: str,
    negative: str,
) -> bool:
    """POST to ``api-inference.huggingface.co`` (classic serverless inference)."""
    url = f"https://api-inference.huggingface.co/models/{model}"
    payload: dict[str, Any] = {"inputs": prompt}
    if negative:
        payload["parameters"] = {"negative_prompt": negative}

    raw: bytes = b""
    try:
        data = json.dumps(payload).encode("utf-8")
        req = Request(
            url,
            data=data,
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
            },
            method="POST",
        )
        try:
            with urlopen(req, timeout=180) as resp:
                raw = resp.read()
        except HTTPError as exc:
            raw = exc.read() or b""
            try:
                snippet = raw[:400].decode("utf-8", errors="replace")
            except Exception:
                snippet = repr(raw[:200])
            logger.warning("HF legacy HTTP status=%s body_prefix=%s", getattr(exc, "code", "?"), snippet)

        candidates: list[bytes] = []
        if raw:
            candidates.append(raw)
        decoded = _decode_hf_image_bytes(raw)
        if decoded:
            candidates.append(decoded)

        for blob in candidates:
            if blob and _write_raster_as_png(blob, out_path):
                return True
        return False
    except (URLError, OSError, TimeoutError, ValueError):
        return False


_PLACEHOLDER_MAX_BYTES = 24_000  # Real gpt-image-1 PNGs are typically much larger.

POSTER_WIDTH = 1080
POSTER_HEIGHT = 1920
# Closest portrait size supported by gpt-image-1; resized to 1080×1920 on save.
_OPENAI_PORTRAIT_API_SIZE = "1024x1536"


def _require_openai_api_key() -> None:
    if not (os.environ.get("OPENAI_API_KEY") or "").strip():
        raise RuntimeError("OPENAI_API_KEY is not set.")


def _decode_openai_images_generate_result(result: Any) -> bytes:
    """Extract raw image bytes from ``client.images.generate()`` response."""
    if not result.data:
        raise RuntimeError("OpenAI returned no image data.")
    item = result.data[0]
    if getattr(item, "b64_json", None):
        try:
            return base64.b64decode(item.b64_json)
        except (binascii.Error, ValueError) as exc:
            raise RuntimeError("OpenAI returned invalid image data.") from exc
    if getattr(item, "url", None):
        with urlopen(item.url, timeout=120) as resp:
            return resp.read()
    raise RuntimeError("OpenAI returned no image bytes (b64_json or url).")


def generate_openai_poster(
    prompt: str,
    *,
    output_path: Path | str | None = None,
) -> Path:
    """
    Generate a poster with OpenAI ``gpt-image-1``.

    Uses modern SDK syntax::

        client = OpenAI()
        client.images.generate(...)

    ``OPENAI_API_KEY`` must be set in the environment (never hardcoded).
    Decodes the base64 payload, saves a 1080×1920 PNG, and returns the file path.
    """
    from PIL import Image

    _require_openai_api_key()
    out_path = Path(output_path) if output_path else _PROJECT_ROOT / "poster.png"
    out_path.parent.mkdir(parents=True, exist_ok=True)
    if out_path.is_file():
        out_path.unlink()

    client = OpenAI()
    result = client.images.generate(
        model="gpt-image-1",
        prompt=prompt,
        size=_OPENAI_PORTRAIT_API_SIZE,
    )
    raw = _decode_openai_images_generate_result(result)

    with Image.open(BytesIO(raw)) as im:
        poster = im.convert("RGB").resize(
            (POSTER_WIDTH, POSTER_HEIGHT),
            Image.Resampling.LANCZOS,
        )
        poster.save(out_path, format="PNG", optimize=True)

    if not hero_image_is_real(out_path):
        raise RuntimeError(
            "OpenAI poster image was too small or invalid. "
            "Check OPENAI_API_KEY, billing, and model access (gpt-image-1)."
        )
    logger.info("OpenAI poster saved path=%s bytes=%s", out_path, out_path.stat().st_size)
    return out_path.resolve()


def hero_image_is_real(path: Path) -> bool:
    """Reject gradient placeholders and empty/corrupt hero files."""
    if not path.is_file():
        return False
    if path.stat().st_size < _PLACEHOLDER_MAX_BYTES:
        return False
    try:
        from PIL import Image

        with Image.open(path) as im:
            im.load()
            w, h = im.size
        return w >= 512 and h >= 512
    except OSError:
        return False


def _generate_with_openai(
    prompt: str,
    out_path: Path,
    *,
    size: str = "1024x1024",
) -> None:
    """Generate a PNG via OpenAI Images API (``gpt-image-1``). Raises on failure."""
    _require_openai_api_key()

    out_path.parent.mkdir(parents=True, exist_ok=True)
    if out_path.is_file():
        out_path.unlink()

    try:
        client = OpenAI()
        result = client.images.generate(
            model="gpt-image-1",
            prompt=prompt,
            size=size,
        )
    except Exception as exc:
        raise RuntimeError(f"OpenAI image API error: {exc}") from exc

    raw = _decode_openai_images_generate_result(result)
    if not _write_raster_as_png(raw, out_path):
        raise RuntimeError("Could not decode OpenAI image bytes as a PNG.")

    if not hero_image_is_real(out_path):
        raise RuntimeError(
            "OpenAI image was too small or invalid — not using a placeholder. "
            "Check your API key, billing, and model access (gpt-image-1)."
        )


def generate_sacred_illustration(
    gospel_reference: str,
    *,
    out_path: Optional[Path] = None,
    style: str = "cinematic",
    visual_scene_line: Optional[str] = None,
    require_openai: bool = False,
    openai_size: str = "1024x1024",
) -> Path:
    """
    Generate sacred art and save a PNG locally.

    Uses OpenAI ``gpt-image-1`` when ``OPENAI_API_KEY`` is set; otherwise Hugging Face if configured.
    On missing credentials or failure, writes a gradient placeholder unless ``require_openai=True``,
    in which case an exception is raised (no placeholder).

    Pass ``visual_scene_line`` — a short, plain description of the Gospel *moment* (no poster quote).
    If omitted, a minimal line is derived from the citation only.
    """
    try:
        from dotenv import load_dotenv

        load_dotenv()
    except ImportError:
        pass

    _IMAGES_DIR.mkdir(parents=True, exist_ok=True)
    slug = _slug_ref(gospel_reference)
    resolved_style = resolve_ai_image_style(style)
    if out_path is None:
        out_path = _IMAGES_DIR / f"gospel_scene_{slug}_{resolved_style}.png"

    openai_key = (os.environ.get("OPENAI_API_KEY") or "").strip()
    token = (os.environ.get("HUGGINGFACE_API_TOKEN") or os.environ.get("HF_TOKEN") or "").strip()
    provider = (os.environ.get("HF_INFERENCE_PROVIDER") or "fal-ai").strip().lower()
    if provider in ("", "auto"):
        provider = "fal-ai"

    model = _DEFAULT_DIFFUSION_MODEL

    vline = (visual_scene_line or "").strip()
    if not vline:
        vline = build_visual_scene_line("", gospel_reference, "")
    prompt = build_hf_image_prompt(gospel_reference, resolved_style, visual_scene_line=vline)
    negative = _resolved_negative_prompt()
    prompt_preview = (prompt[:200] + "…") if len(prompt) > 200 else prompt

    if openai_key:
        logger.info(
            "OpenAI sacred image attempt model=gpt-image-1 prompt_preview=%r",
            prompt_preview,
        )
        try:
            _generate_with_openai(prompt, out_path, size=openai_size)
            logger.info(
                "OpenAI sacred image saved output=%s (%s bytes) gospel=%s style=%s",
                out_path,
                out_path.stat().st_size,
                gospel_reference,
                resolved_style,
            )
            return out_path
        except Exception as exc:
            if require_openai:
                raise
            logger.warning("OpenAI sacred image failed: %s", exc)

    if require_openai:
        raise RuntimeError(
            "OpenAI image generation is required but OPENAI_API_KEY is missing."
        )

    if not openai_key and not token:
        logger.warning(
            "Sacred image: using gradient placeholder (set OPENAI_API_KEY or HF_TOKEN). "
            "output=%s gospel=%s style=%s",
            out_path,
            gospel_reference,
            resolved_style,
        )
        _write_placeholder(out_path, gospel_reference)
        return out_path

    if not token:
        if require_openai:
            raise RuntimeError(
                "OpenAI image generation failed and no Hugging Face token is configured."
            )
        logger.warning(
            "Sacred image: using gradient placeholder (OpenAI failed). "
            "output=%s gospel=%s style=%s",
            out_path,
            gospel_reference,
            resolved_style,
        )
        _write_placeholder(out_path, gospel_reference)
        return out_path

    logger.info(
        "HF sacred image attempt model=%s prompt_preview=%r",
        model,
        prompt_preview,
    )

    if provider == "fal-ai":
        if _generate_with_inference_client(
            prompt, out_path, token=token, model=model, negative=negative, provider="fal-ai"
        ):
            return out_path
        if _generate_with_legacy_http(prompt, out_path, token=token, model=model, negative=negative):
            return out_path
    elif provider in ("hf-inference", "legacy", "serverless"):
        if _generate_with_legacy_http(prompt, out_path, token=token, model=model, negative=negative):
            return out_path
    else:
        if _generate_with_inference_client(
            prompt, out_path, token=token, model=model, negative=negative, provider=provider
        ):
            return out_path

    logger.warning(
        "HF sacred image: using gradient placeholder (all inference attempts failed). "
        "provider=%s model=%s output=%s gospel=%s",
        provider,
        model,
        out_path,
        gospel_reference,
    )
    _write_placeholder(out_path, gospel_reference)
    return out_path
