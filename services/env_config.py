"""Load project ``.env`` and ``.env.gemini`` from the repo root."""

from __future__ import annotations

import os
from pathlib import Path

_PROJECT_ROOT = Path(__file__).resolve().parents[1]
_ENV_PATH = _PROJECT_ROOT / ".env"
_GEMINI_ENV_PATH = _PROJECT_ROOT / ".env.gemini"


def gemini_env_path() -> Path:
    return _GEMINI_ENV_PATH


def load_gemini_dotenv() -> None:
    """Load ``.env.gemini`` (Gemini API key and related vars)."""
    try:
        from dotenv import load_dotenv
    except ImportError:
        return
    if _GEMINI_ENV_PATH.is_file():
        load_dotenv(_GEMINI_ENV_PATH, override=True)


def load_project_dotenv() -> None:
    """Load ``.env`` next to ``server.py``; project file wins over shell env."""
    try:
        from dotenv import load_dotenv
    except ImportError:
        return
    if _ENV_PATH.is_file():
        load_dotenv(_ENV_PATH, override=True)
    else:
        load_dotenv(override=True)
    load_gemini_dotenv()


def get_gemini_api_key() -> str:
    load_gemini_dotenv()
    return (os.environ.get("GEMINI_API_KEY") or "").strip()


def gemini_api_key_configured() -> bool:
    return bool(get_gemini_api_key())


def _parse_env_lines(text: str) -> dict[str, str]:
    out: dict[str, str] = {}
    for line in text.splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if "=" not in line:
            continue
        key, _, value = line.partition("=")
        out[key.strip()] = value.strip()
    return out


def save_gemini_api_key(api_key: str) -> None:
    """Persist ``GEMINI_API_KEY`` to ``.env.gemini``, preserving other keys."""
    key = (api_key or "").strip()
    if not key:
        raise ValueError("Gemini API key is required.")

    existing: dict[str, str] = {}
    if _GEMINI_ENV_PATH.is_file():
        existing = _parse_env_lines(_GEMINI_ENV_PATH.read_text(encoding="utf-8"))

    existing["GEMINI_API_KEY"] = key
    if "GEMINI_IMAGE_MODEL" not in existing:
        existing["GEMINI_IMAGE_MODEL"] = "gemini-2.5-flash-image"
    elif existing.get("GEMINI_IMAGE_MODEL") in (
        "gemini-2.0-flash-preview-image-generation",
        "models/gemini-2.0-flash-preview-image-generation",
    ):
        existing["GEMINI_IMAGE_MODEL"] = "gemini-2.5-flash-image"

    lines = [f"{k}={v}" for k, v in existing.items()]
    _GEMINI_ENV_PATH.write_text("\n".join(lines) + "\n", encoding="utf-8")
    os.environ["GEMINI_API_KEY"] = key


def gemini_api_key_hint() -> str | None:
    """Last four characters of the stored key, for settings UI."""
    key = get_gemini_api_key()
    if len(key) < 4:
        return None
    return key[-4:]


def gemini_sdk_available() -> bool:
    try:
        from google import genai  # noqa: F401

        return True
    except ImportError:
        return False
