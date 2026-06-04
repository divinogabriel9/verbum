"""Load project ``.env`` from the repo root (overrides stale shell exports)."""

from __future__ import annotations

from pathlib import Path

_PROJECT_ROOT = Path(__file__).resolve().parents[1]
_ENV_PATH = _PROJECT_ROOT / ".env"


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
