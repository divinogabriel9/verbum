"""
Hugging Face Inference API helper: text-to-image for Gospel-themed sacred art.

A *short* visual scene line comes from :mod:`services.gospel_visual_prompt` (like “Jesus on the water”,
derived from the Gospel opening — not the poster quote). Style comes from ``data/styles.json``.
The final HF ``inputs`` string is ``visual_scene + framing + style_fragment``.

Requires ``HUGGINGFACE_API_TOKEN`` or ``HF_TOKEN`` in the environment for live calls.
Without a token (or on API failure), writes a soft gradient placeholder so layout still works
(that gradient is not the model output — set a token and check the server log if generation fails).
If ``HF_DIFFUSION_NEGATIVE_PROMPT`` is unset, a default negative prompt reduces empty / abstract images.

Primary path: ``huggingface_hub.InferenceClient`` with ``provider="fal-ai"`` (same token as ``HF_TOKEN``).
Override with ``HF_INFERENCE_PROVIDER=hf-inference`` to use the legacy serverless HTTP API instead.
Image model is fixed to ``Tongyi-MAI/Z-Image-Turbo`` (no Stable Diffusion).

HF responses vary: raw ``image/png`` bytes, or JSON with base64 fields — see ``_decode_hf_image_bytes``.
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


def generate_sacred_illustration(
    gospel_reference: str,
    *,
    out_path: Optional[Path] = None,
    style: str = "cinematic",
    visual_scene_line: Optional[str] = None,
) -> Path:
    """
    Generate sacred art via Hugging Face and save a PNG locally.

    By default uses ``InferenceClient(provider="fal-ai")`` (see ``HF_TOKEN`` / ``HUGGINGFACE_API_TOKEN``).
    Set ``HF_INFERENCE_PROVIDER=hf-inference`` to use only the legacy HTTP inference API.

    Pass ``visual_scene_line`` — a short, plain description of the Gospel *moment* (no poster quote).
    If omitted, a minimal line is derived from the citation only.

    If ``HF_DIFFUSION_NEGATIVE_PROMPT`` is unset, a built-in negative prompt discourages
    empty gradients, on-image text, and figure-less abstracts.

    On missing token, import errors, or total failure, writes a gradient placeholder instead.
    """
    _IMAGES_DIR.mkdir(parents=True, exist_ok=True)
    slug = _slug_ref(gospel_reference)
    resolved_style = resolve_ai_image_style(style)
    if out_path is None:
        out_path = _IMAGES_DIR / f"gospel_scene_{slug}_{resolved_style}.png"

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

    logger.info(
        "HF sacred image attempt model=%s prompt_preview=%r",
        model,
        (prompt[:200] + "…") if len(prompt) > 200 else prompt,
    )

    if not token:
        logger.warning(
            "HF sacred image: using gradient placeholder (set HF_TOKEN or HUGGINGFACE_API_TOKEN). "
            "output=%s gospel=%s style=%s",
            out_path,
            gospel_reference,
            resolved_style,
        )
        _write_placeholder(out_path, gospel_reference)
        return out_path

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
