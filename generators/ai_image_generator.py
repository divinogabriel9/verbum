"""
Text-to-image for Gospel-themed sacred art (posters and hero panels).

Hero images are **presentation backgrounds only**: no readable text, clean safe zones
for PowerPoint overlays. Prompts follow the church poster designer brief in
:func:`build_church_poster_background_prompt`.

Primary path: OpenAI ``gpt-image-2`` when ``OPENAI_API_KEY`` is set.
Fallback: Hugging Face ``Tongyi-MAI/Z-Image-Turbo`` when configured.
"""

from __future__ import annotations

import base64
import binascii
import json
import logging
import os
import re
import time
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
    "readable text, letters, words, typography, captions, subtitles, speech bubbles, "
    "Bible verse written on image, scripture text overlay, title card, fake poster text, "
    "misspelled words, garbled text, movie poster text, watermark, logo, UI, "
    "solid color only, flat gradient background, abstract wallpaper, empty scene, "
    "deformed hands, extra limbs, low quality, blurry"
)

_STYLE_LABELS: dict[str, str] = {
    "cinematic": "Cinematic",
    "realistic": "Realistic",
    "renaissance": "Renaissance",
    "stained_glass": "Stained Glass",
    "modern": "Modern",
}

_STYLE_BEHAVIOR: dict[str, str] = {
    "cinematic": (
        "dramatic movie-like lighting, cinematic composition, volumetric light, "
        "emotional atmosphere, epic worship visuals"
    ),
    "realistic": (
        "realistic biblical environment, natural lighting, authentic textures, "
        "detailed scenery, believable human proportions"
    ),
    "renaissance": (
        "classical renaissance painting, rich religious oil-painting aesthetic, "
        "dramatic shadows, sacred artistic composition, cathedral-quality artwork"
    ),
    "stained_glass": (
        "church stained glass window style, colorful segmented glass patterns, "
        "glowing cathedral lighting, ornate sacred design, luminous mosaic aesthetic"
    ),
    "modern": (
        "modern church social-media aesthetic, minimal layered composition, soft gradients, "
        "subtle depth, clean premium worship branding"
    ),
}

_COMPOSITION_RULES_FULL_BLEED = (
    "16:9 PowerPoint widescreen landscape, ultra high quality, presentation-ready, "
    "full-bleed edge-to-edge biblical scene filling the entire frame, "
    "rich detail corner to corner, no empty margins, no letterboxing, "
    "subject centered with cinematic depth, emotionally uplifting worship atmosphere"
)

_COMPOSITION_RULES_WITH_TEXT = _COMPOSITION_RULES_FULL_BLEED  # unused; kept for import stability

_NO_TEXT_RULES = (
    "Do NOT generate readable text, letters, numbers, captions, subtitles, or watermarks. "
    "Do NOT render church logos, crests, seals, insignia, or parish branding. "
    "Pure background illustration only — no typography and no logos anywhere in the image."
)


def _clip(text: str, limit: int) -> str:
    t = " ".join((text or "").split()).strip()
    if len(t) <= limit:
        return t
    return t[: limit - 1].rsplit(" ", 1)[0].rstrip(" ,.;")


def _infer_storytelling_mood(
    *,
    sunday_title: str,
    gospel_reference: str,
    gospel_text: str,
    scripture_quote: str,
    season_key: str,
) -> str:
    """Pick visual storytelling guidance from Gospel theme and liturgical season."""
    blob = " ".join(
        [
            (sunday_title or "").lower(),
            (gospel_reference or "").lower(),
            (gospel_text or "")[:600].lower(),
            (scripture_quote or "")[:400].lower(),
            (season_key or "").lower().replace("_", " "),
        ]
    )

    if any(
        k in blob
        for k in (
            "resurrection",
            " risen ",
            "risen ",
            "empty tomb",
            "easter",
            "alleluia",
            "ascension",
            "pentecost",
        )
    ) or season_key in ("easter", "pentecost"):
        return (
            "Resurrection Gospel mood: radiant heavenly light, victorious atmosphere, "
            "glowing sky, uplifting composition, hope and triumph"
        )

    if season_key in ("lent", "advent") or any(
        k in blob for k in ("repent", "fast", "desert", "temptation", "passion", "cross", "suffer")
    ):
        return (
            "Lent or repentance mood: solemn lighting, liturgical atmosphere, "
            "minimalist emotional composition, symbolic light emerging from darkness"
        )

    if any(
        k in blob
        for k in (
            "heal",
            "blind",
            "lame",
            "paralytic",
            "mercy",
            "forgiv",
            "compassion",
            "bless",
            "comfort",
            "weep",
            "touch",
        )
    ):
        return (
            "Healing or mercy Gospel mood: compassionate emotional framing, "
            "soft divine lighting, peaceful atmosphere, gentle warmth"
        )

    if any(
        k in blob
        for k in (
            "disciples",
            "apostles",
            "journey",
            "road",
            "follow",
            "sent ",
            "mission",
            "boat",
            "sea",
            "walk",
            "teach",
        )
    ):
        return (
            "Disciples or journey Gospel mood: cinematic storytelling scenery, "
            "movement and direction, emotional environment, narrative depth"
        )

    return (
        "Sunday Gospel mood: sacred biblical storytelling, reverent worship atmosphere, "
        "clear focal moment, divine light guiding the scene"
    )


def build_church_poster_background_prompt(
    *,
    style: str,
    visual_scene_line: str = "",
    season_key: str = "",
) -> str:
    """
    Build a visual-only diffusion prompt for a Gospel poster background.

    No scripture quotes, titles, or references are sent — text is composited in Python afterward.
    """
    resolved = resolve_ai_image_style(style)
    style_label = _STYLE_LABELS.get(resolved, resolved.replace("_", " ").title())
    style_behavior = _STYLE_BEHAVIOR.get(resolved) or style_prompt_fragment(resolved)

    scene = _clip(visual_scene_line, 220)
    if not scene:
        scene = "a reverent biblical moment from the Sunday Gospel"

    mood = _infer_storytelling_mood(
        sunday_title="",
        gospel_reference="",
        gospel_text="",
        scripture_quote="",
        season_key=(season_key or "").strip().lower(),
    )

    parts = [
        "Generate a cinematic biblical illustration BACKGROUND for a church presentation slide.",
        _NO_TEXT_RULES,
        f"STYLE: {style_label}. {style_behavior}.",
        f"Main scene to paint: {scene}.",
        mood + ".",
        _COMPOSITION_RULES_FULL_BLEED + ".",
        "Focus on visual storytelling and worship atmosphere.",
    ]
    return " ".join(parts)


def build_hf_image_prompt(
    gospel_reference: str,
    style: str,
    *,
    visual_scene_line: str,
    sunday_title: str = "",
    scripture_quote: str = "",
    gospel_text: str = "",
    season_key: str = "",
) -> str:
    """Full diffusion prompt — visual scene line only (legacy HF callers may pass unused kwargs)."""
    del gospel_reference, sunday_title, scripture_quote, gospel_text
    return build_church_poster_background_prompt(
        style=style,
        visual_scene_line=visual_scene_line,
        season_key=season_key,
    )


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


def fit_image_file_to_size(path: Path, size: tuple[int, int]) -> None:
    """Center-crop to aspect ratio, then resize to exact pixel dimensions (e.g. 1920×1080)."""
    from PIL import Image

    tw, th = size
    if tw < 1 or th < 1:
        return
    target_ar = tw / th
    with Image.open(path) as im:
        im = im.convert("RGB")
        w, h = im.size
        cur_ar = w / max(h, 1)
        if cur_ar > target_ar:
            new_w = max(1, int(h * target_ar))
            x0 = (w - new_w) // 2
            im = im.crop((x0, 0, x0 + new_w, h))
        elif cur_ar < target_ar:
            new_h = max(1, int(w / target_ar))
            y0 = (h - new_h) // 2
            im = im.crop((0, y0, w, y0 + new_h))
        if im.size != (tw, th):
            im = im.resize((tw, th), Image.Resampling.LANCZOS)
        im.save(path, format="PNG", optimize=True)


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


_PLACEHOLDER_MAX_BYTES = 24_000  # Real OpenAI image PNGs are typically much larger.

POSTER_WIDTH = 1080
POSTER_HEIGHT = 1920
# PowerPoint widescreen (16:9) — matches ``generators.poster.types.PPT_SIZE``.
WIDESCREEN_16_9 = (1920, 1080)
# gpt-image-2 landscape (1920×1088 — both dims ÷16); cropped to 1920×1080 after generation.
_OPENAI_WIDESCREEN_API_SIZE = "1920x1088"
_OPENAI_WIDESCREEN_API_SIZE_LEGACY = "1536x1024"
# gpt-image-2 portrait (1088×1920, 16-aligned); legacy uses 1024×1536.
_OPENAI_PORTRAIT_API_SIZE = "1088x1920"
_OPENAI_PORTRAIT_API_SIZE_LEGACY = "1024x1536"


def _openai_image_model() -> str:
    return (os.environ.get("OPENAI_IMAGE_MODEL") or "gpt-image-2").strip() or "gpt-image-2"


def _openai_image_quality() -> str:
    q = (os.environ.get("OPENAI_IMAGE_QUALITY") or "high").strip().lower() or "high"
    return q if q in ("low", "medium", "high") else "high"


def _openai_widescreen_api_size() -> str:
    if _openai_image_model() == "gpt-image-2":
        return _OPENAI_WIDESCREEN_API_SIZE
    return _OPENAI_WIDESCREEN_API_SIZE_LEGACY


def _openai_portrait_api_size() -> str:
    if _openai_image_model() == "gpt-image-2":
        return _OPENAI_PORTRAIT_API_SIZE
    return _OPENAI_PORTRAIT_API_SIZE_LEGACY


def _openai_images_generate(client: OpenAI, *, prompt: str, size: str) -> Any:
    """Call ``client.images.generate`` with model, size, and quality for the active GPT Image model."""
    kwargs: dict[str, Any] = {
        "model": _openai_image_model(),
        "prompt": prompt,
        "size": size,
        "quality": _openai_image_quality(),
    }
    return client.images.generate(**kwargs)


def _require_openai_api_key() -> None:
    if not (os.environ.get("OPENAI_API_KEY") or "").strip():
        raise RuntimeError("OPENAI_API_KEY is not set.")


_GEMINI_IMAGE_MODEL_DEFAULT = "gemini-2.5-flash-image"
_GEMINI_IMAGE_MODEL_FALLBACKS = (
    "gemini-2.5-flash-image",
    "gemini-3.1-flash-image",
    "gemini-3-pro-image",
)
_RETIRED_GEMINI_IMAGE_MODELS = frozenset(
    {
        "gemini-2.0-flash-preview-image-generation",
        "models/gemini-2.0-flash-preview-image-generation",
    }
)


def _gemini_image_model() -> str:
    models = _gemini_image_models_to_try()
    return models[0]


def _gemini_image_models_to_try() -> list[str]:
    configured = (os.environ.get("GEMINI_IMAGE_MODEL") or "").strip()
    if configured.startswith("models/"):
        configured = configured[len("models/") :]
    if configured in _RETIRED_GEMINI_IMAGE_MODELS:
        configured = ""

    out: list[str] = []
    if configured:
        out.append(configured)
    for model in _GEMINI_IMAGE_MODEL_FALLBACKS:
        if model not in out:
            out.append(model)
    return out or [_GEMINI_IMAGE_MODEL_DEFAULT]


def _require_gemini_api_key() -> None:
    try:
        from services.env_config import get_gemini_api_key

        if not get_gemini_api_key():
            raise RuntimeError("GEMINI_API_KEY is not set.")
    except ImportError:
        if not (os.environ.get("GEMINI_API_KEY") or "").strip():
            raise RuntimeError("GEMINI_API_KEY is not set.")


def _gemini_aspect_ratio_for_size(size: str) -> str:
    """Map OpenAI-style WxH strings to Gemini aspect ratio labels."""
    m = re.match(r"^(\d+)x(\d+)$", (size or "").strip())
    if not m:
        return "16:9"
    w, h = int(m.group(1)), int(m.group(2))
    if w <= 0 or h <= 0:
        return "16:9"
    ratio = w / h
    if ratio > 1.45:
        return "16:9"
    if ratio < 0.72:
        return "9:16"
    if ratio < 0.85:
        return "3:4"
    if ratio > 1.15:
        return "4:3"
    return "1:1"


def _extract_gemini_image_bytes(response: Any) -> bytes:
    parts: list[Any] = []
    if getattr(response, "parts", None):
        parts = list(response.parts)
    else:
        candidates = getattr(response, "candidates", None) or []
        if candidates:
            content = getattr(candidates[0], "content", None)
            parts = list(getattr(content, "parts", None) or [])

    for part in parts:
        inline = getattr(part, "inline_data", None)
        if inline is None:
            continue
        data = getattr(inline, "data", None)
        if isinstance(data, (bytes, bytearray)) and data:
            return bytes(data)
        if isinstance(data, str) and data.strip():
            decoded = _b64_decode_loose(data)
            if decoded:
                return decoded
        as_image = getattr(part, "as_image", None)
        if callable(as_image):
            try:
                img = as_image()
                buf = BytesIO()
                img.save(buf, format="PNG")
                return buf.getvalue()
            except Exception:
                pass
    raise RuntimeError("Gemini returned no image data.")


def _gemini_retry_seconds(exc: Exception) -> int | None:
    msg = str(exc)
    m = re.search(r"retry in (\d+(?:\.\d+)?)\s*s", msg, re.I)
    if m:
        return min(120, max(1, int(float(m.group(1)))))
    return None


def _gemini_error_user_message(exc: Exception, *, model: str = "") -> str:
    msg = str(exc)
    label = model or "image model"
    if "429" in msg or "RESOURCE_EXHAUSTED" in msg:
        if "limit: 0" in msg:
            return (
                f"Gemini has no free-tier quota for {label} on this API key. "
                "Image generation usually needs a Google AI Studio key (starts with AIza…) "
                "with billing enabled: https://aistudio.google.com/apikey"
            )
        retry = _gemini_retry_seconds(exc)
        if retry:
            return (
                f"Gemini rate limit reached. Wait about {retry} seconds and try again, "
                "or enable billing for higher limits: https://ai.dev/rate-limit"
            )
        return (
            "Gemini API quota exceeded. Check usage at https://ai.dev/rate-limit "
            "or enable billing in Google AI Studio."
        )
    if any(x in msg for x in ("401", "403", "API key not valid", "PERMISSION_DENIED")):
        return (
            "Invalid Gemini API key. Create one at https://aistudio.google.com/apikey "
            "(usually starts with AIza…) and save it in Settings."
        )
    if "404" in msg or "NOT_FOUND" in msg:
        return f"Gemini model {label} is not available for your API key."
    return f"Gemini image generation failed ({label}): {exc}"


def _generate_with_gemini(
    prompt: str,
    out_path: Path,
    *,
    size: str = "1920x1080",
) -> None:
    """Generate a PNG via Gemini image models using the same prompt as OpenAI."""
    _require_gemini_api_key()
    try:
        from google import genai
        from google.genai import types
    except ImportError as exc:
        raise RuntimeError(
            "google-genai is required for Gemini image generation. "
            "Install with: pip install google-genai"
        ) from exc

    try:
        from services.env_config import get_gemini_api_key, load_gemini_dotenv

        load_gemini_dotenv()
        api_key = get_gemini_api_key()
    except ImportError:
        api_key = (os.environ.get("GEMINI_API_KEY") or "").strip()

    out_path.parent.mkdir(parents=True, exist_ok=True)
    if out_path.is_file():
        out_path.unlink()

    client = genai.Client(api_key=api_key)
    aspect_ratio = _gemini_aspect_ratio_for_size(size)
    last_exc: Exception | None = None
    response = None
    used_model = ""

    def _call_model(model: str) -> Any:
        return client.models.generate_content(
            model=model,
            contents=prompt,
            config=types.GenerateContentConfig(
                response_modalities=["IMAGE"],
                image_config=types.ImageConfig(aspect_ratio=aspect_ratio),
            ),
        )

    for model in _gemini_image_models_to_try():
        try:
            response = _call_model(model)
            used_model = model
            break
        except Exception as exc:
            last_exc = exc
            msg = str(exc)
            if "404" in msg or "NOT_FOUND" in msg:
                logger.warning("Gemini model %s unavailable, trying fallback", model)
                continue
            if ("429" in msg or "RESOURCE_EXHAUSTED" in msg) and "limit: 0" not in msg:
                retry_s = _gemini_retry_seconds(exc)
                if retry_s and retry_s <= 90:
                    logger.info("Gemini rate limited on %s, retrying in %ss", model, retry_s)
                    time.sleep(retry_s)
                    try:
                        response = _call_model(model)
                        used_model = model
                        break
                    except Exception as retry_exc:
                        raise RuntimeError(
                            _gemini_error_user_message(retry_exc, model=model)
                        ) from retry_exc
            raise RuntimeError(_gemini_error_user_message(exc, model=model)) from exc

    if response is None:
        raise RuntimeError(
            "Gemini image API error: no supported image model worked. "
            f"Last error: {last_exc}"
        ) from last_exc

    raw = _extract_gemini_image_bytes(response)
    if not _write_raster_as_png(raw, out_path):
        raise RuntimeError("Could not decode Gemini image bytes as a PNG.")

    if not hero_image_is_real(out_path):
        raise RuntimeError(
            "Gemini image was too small or invalid — not using a placeholder. "
            "Check your API key, billing, and model access "
            f"({used_model or _gemini_image_model()})."
        )


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
    Generate a poster with OpenAI GPT Image (default ``gpt-image-2``).

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
    result = _openai_images_generate(
        client,
        prompt=prompt,
        size=_openai_portrait_api_size(),
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
            "Check OPENAI_API_KEY, billing, and model access "
            f"({_openai_image_model()})."
        )
    logger.info(
        "OpenAI poster saved path=%s bytes=%s model=%s",
        out_path,
        out_path.stat().st_size,
        _openai_image_model(),
    )
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
    """Generate a PNG via OpenAI Images API (default ``gpt-image-2``). Raises on failure."""
    _require_openai_api_key()

    out_path.parent.mkdir(parents=True, exist_ok=True)
    if out_path.is_file():
        out_path.unlink()

    try:
        client = OpenAI()
        result = _openai_images_generate(client, prompt=prompt, size=size)
    except Exception as exc:
        raise RuntimeError(f"OpenAI image API error: {exc}") from exc

    raw = _decode_openai_images_generate_result(result)
    if not _write_raster_as_png(raw, out_path):
        raise RuntimeError("Could not decode OpenAI image bytes as a PNG.")

    if not hero_image_is_real(out_path):
        raise RuntimeError(
            "OpenAI image was too small or invalid — not using a placeholder. "
            "Check your API key, billing, and model access "
            f"({_openai_image_model()})."
        )


def generate_sacred_illustration(
    gospel_reference: str,
    *,
    out_path: Optional[Path] = None,
    style: str = "cinematic",
    visual_scene_line: Optional[str] = None,
    require_openai: bool = False,
    image_backend: str = "auto",
    openai_size: str = "1024x1024",
    output_size: Optional[tuple[int, int]] = None,
    sunday_title: str = "",
    scripture_quote: str = "",
    gospel_text: str = "",
    season_key: str = "",
) -> Path:
    """
    Generate a Gospel poster **background** PNG (no baked-in text or logos).

    Pass ``visual_scene_line`` — a short plain description of the Gospel moment (not a poster quote).
    ``gospel_text`` / ``sunday_title`` are used only to derive a scene line when none is provided.

    ``image_backend``: ``auto`` (OpenAI, then Gemini, then HF), ``openai``, or ``gemini``.
    ``require_openai`` is kept for compatibility; when true, forces OpenAI-only unless
    ``image_backend`` is ``gemini``.
    """
    try:
        from services.env_config import get_gemini_api_key, load_gemini_dotenv, load_project_dotenv

        load_project_dotenv()
        load_gemini_dotenv()
    except ImportError:
        pass

    backend = (image_backend or "auto").strip().lower()
    if require_openai and backend == "auto":
        backend = "openai"

    _IMAGES_DIR.mkdir(parents=True, exist_ok=True)
    slug = _slug_ref(gospel_reference)
    resolved_style = resolve_ai_image_style(style)
    if out_path is None:
        out_path = _IMAGES_DIR / f"gospel_scene_{slug}_{resolved_style}.png"

    openai_key = (os.environ.get("OPENAI_API_KEY") or "").strip()
    gemini_key = ""
    try:
        from services.env_config import get_gemini_api_key

        gemini_key = get_gemini_api_key()
    except ImportError:
        gemini_key = (os.environ.get("GEMINI_API_KEY") or "").strip()

    token = (os.environ.get("HUGGINGFACE_API_TOKEN") or os.environ.get("HF_TOKEN") or "").strip()
    provider = (os.environ.get("HF_INFERENCE_PROVIDER") or "fal-ai").strip().lower()
    if provider in ("", "auto"):
        provider = "fal-ai"

    model = _DEFAULT_DIFFUSION_MODEL

    vline = (visual_scene_line or "").strip()
    if not vline:
        vline = build_visual_scene_line(sunday_title, gospel_reference, gospel_text or "")
    prompt = build_church_poster_background_prompt(
        style=resolved_style,
        visual_scene_line=vline,
        season_key=season_key,
    )
    negative = _resolved_negative_prompt()
    prompt_preview = (prompt[:200] + "…") if len(prompt) > 200 else prompt

    def _try_openai() -> bool:
        if not openai_key:
            return False
        logger.info(
            "OpenAI sacred image attempt model=%s prompt_preview=%r",
            _openai_image_model(),
            prompt_preview,
        )
        try:
            _generate_with_openai(prompt, out_path, size=openai_size)
            if output_size:
                fit_image_file_to_size(out_path, output_size)
            logger.info(
                "OpenAI sacred image saved output=%s (%s bytes) gospel=%s style=%s",
                out_path,
                out_path.stat().st_size,
                gospel_reference,
                resolved_style,
            )
            return True
        except Exception as exc:
            logger.warning("OpenAI sacred image failed: %s", exc)
            return False

    def _try_gemini(*, required: bool = False) -> bool:
        if not gemini_key:
            if required:
                raise RuntimeError("GEMINI_API_KEY is not set. Add it in Settings → AI integrations.")
            return False
        logger.info(
            "Gemini sacred image attempt model=%s prompt_preview=%r",
            _gemini_image_model(),
            prompt_preview,
        )
        try:
            _generate_with_gemini(prompt, out_path, size=openai_size)
            if output_size:
                fit_image_file_to_size(out_path, output_size)
            logger.info(
                "Gemini sacred image saved output=%s (%s bytes) gospel=%s style=%s",
                out_path,
                out_path.stat().st_size,
                gospel_reference,
                resolved_style,
            )
            return True
        except Exception as exc:
            logger.warning("Gemini sacred image failed: %s", exc)
            if required:
                raise
            return False

    if backend == "openai":
        if _try_openai():
            return out_path
        raise RuntimeError(
            "OpenAI image generation failed. Check OPENAI_API_KEY, billing, and model access."
        )

    if backend == "gemini":
        _try_gemini(required=True)
        return out_path

    if openai_key and _try_openai():
        return out_path

    if gemini_key and _try_gemini():
        return out_path

    if require_openai:
        raise RuntimeError(
            "OpenAI image generation is required but OPENAI_API_KEY is missing."
        )

    if not openai_key and not gemini_key and not token:
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
