"""Resolve deploy / git version for health checks and UI."""

from __future__ import annotations

import os
import subprocess
from datetime import datetime, timezone
from functools import lru_cache
from pathlib import Path
from typing import Any

_PROJECT = Path(__file__).resolve().parents[1]
_BUILD_VERSION_FILE = _PROJECT / ".build-version"
_BUILD_TIME_FILE = _PROJECT / ".build-time"


def _clean(value: str | None) -> str:
    return (value or "").strip()


def _short_sha(sha: str) -> str:
    sha = _clean(sha)
    if not sha:
        return ""
    return sha[:7] if len(sha) >= 7 else sha


def _read_first_line(path: Path) -> str:
    try:
        if not path.is_file():
            return ""
        text = path.read_text(encoding="utf-8")
        return _clean(text.splitlines()[0] if text else "")
    except OSError:
        return ""


def _git_output(*args: str) -> str:
    try:
        out = subprocess.check_output(
            ["git", *args],
            cwd=str(_PROJECT),
            stderr=subprocess.DEVNULL,
            timeout=2,
        )
        return _clean(out.decode("utf-8", errors="ignore"))
    except Exception:
        return ""


def _normalize_iso(raw: str) -> str:
    """Return UTC ISO-8601 with Z, or empty if unparseable."""
    value = _clean(raw)
    if not value:
        return ""
    try:
        if value.endswith("Z"):
            dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
        elif "T" in value:
            dt = datetime.fromisoformat(value)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
        else:
            # "2026-07-12 13:46:11 +0900" / unix-ish fallbacks
            for fmt in ("%Y-%m-%d %H:%M:%S %z", "%Y-%m-%d %H:%M:%S"):
                try:
                    dt = datetime.strptime(value, fmt)
                    if dt.tzinfo is None:
                        dt = dt.replace(tzinfo=timezone.utc)
                    break
                except ValueError:
                    dt = None  # type: ignore[assignment]
            else:
                return ""
            if dt is None:
                return ""
        return dt.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    except Exception:
        return ""


def _format_display(iso: str) -> str:
    normalized = _normalize_iso(iso)
    if not normalized:
        return ""
    dt = datetime.fromisoformat(normalized.replace("Z", "+00:00"))
    return dt.strftime("%Y-%m-%d %H:%M UTC")


def _resolve_built_at() -> tuple[str, str]:
    """Return (iso_utc, source) for when this build/commit was made."""
    candidates: list[tuple[str, str]] = [
        (_clean(os.environ.get("APP_BUILD_TIME")), "app_build_time"),
        (_clean(os.environ.get("BUILD_TIMESTAMP")), "build_timestamp"),
        (_read_first_line(_BUILD_TIME_FILE), "build_file"),
        (_git_output("log", "-1", "--format=%cI"), "git_commit"),
    ]
    for raw, source in candidates:
        iso = _normalize_iso(raw)
        if iso:
            return iso, source
    return "", ""


@lru_cache(maxsize=1)
def get_version_info() -> dict[str, Any]:
    """Return version fields for the running process (stable per deploy)."""
    explicit = _clean(os.environ.get("APP_VERSION"))
    commit = (
        _clean(os.environ.get("RENDER_GIT_COMMIT"))
        or _clean(os.environ.get("GIT_COMMIT"))
        or _clean(os.environ.get("SOURCE_VERSION"))
        or _read_first_line(_BUILD_VERSION_FILE)
        or _git_output("rev-parse", "HEAD")
    )
    if not commit and explicit:
        # APP_VERSION alone may be a commit SHA from an older deploy setup.
        commit = explicit

    short = _short_sha(commit)
    branch = _clean(os.environ.get("RENDER_GIT_BRANCH")) or _clean(os.environ.get("GIT_BRANCH"))

    if explicit and short and explicit.lower() not in {commit.lower(), short.lower()}:
        label = f"{explicit} ({short})"
    elif explicit:
        label = explicit
    elif short:
        label = short
    else:
        label = "dev"

    if _clean(os.environ.get("RENDER_GIT_COMMIT")):
        source = "render"
    elif explicit:
        source = "app_version"
    elif _read_first_line(_BUILD_VERSION_FILE):
        source = "build_file"
    elif short:
        source = "git"
    else:
        source = "fallback"

    built_at, built_at_source = _resolve_built_at()
    built_at_display = _format_display(built_at) if built_at else ""

    return {
        "version": label,
        "app_version": explicit or label,
        "git_commit": commit or None,
        "git_commit_short": short or None,
        "git_branch": branch or None,
        "source": source,
        "built_at": built_at or None,
        "built_at_display": built_at_display or None,
        "built_at_source": built_at_source or None,
    }


def get_app_version() -> str:
    return str(get_version_info().get("version") or "dev")
