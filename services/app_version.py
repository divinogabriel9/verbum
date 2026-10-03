"""Resolve product release version plus deploy/git identity for health and UI.

Product versioning (file: VERSION at repo root):
  - Format: MAJOR.MINOR starting at 1.0 (e.g. 1.0, 1.1, 2.0)
  - Minor bump (1.0 → 1.1): incremental / non-breaking updates
  - Major bump (1.x → 2.0): only when explicitly requested as a major update

APP_VERSION env may override the VERSION file when it looks like MAJOR.MINOR.
Git SHAs remain separate (git_commit*) and are not used as the public label.
"""

from __future__ import annotations

import os
import re
import subprocess
from datetime import datetime, timezone
from functools import lru_cache
from pathlib import Path
from typing import Any

_PROJECT = Path(__file__).resolve().parents[1]
_VERSION_FILE = _PROJECT / "VERSION"
_BUILD_VERSION_FILE = _PROJECT / ".build-version"
_BUILD_TIME_FILE = _PROJECT / ".build-time"
_RELEASE_RE = re.compile(r"^\d+\.\d+$")


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


def _is_release_version(value: str) -> bool:
    return bool(_RELEASE_RE.match(_clean(value)))


def _resolve_release_version() -> tuple[str, str]:
    """Return (MAJOR.MINOR, source). Defaults to 1.0 if nothing is set."""
    env_ver = _clean(os.environ.get("APP_VERSION"))
    if _is_release_version(env_ver):
        return env_ver, "app_version"
    file_ver = _read_first_line(_VERSION_FILE)
    if _is_release_version(file_ver):
        return file_ver, "version_file"
    return "1.0", "fallback"


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
    release, release_source = _resolve_release_version()

    env_ver = _clean(os.environ.get("APP_VERSION"))
    # Legacy: APP_VERSION sometimes held a commit SHA instead of a release label.
    legacy_sha = env_ver if env_ver and not _is_release_version(env_ver) else ""

    commit = (
        _clean(os.environ.get("RENDER_GIT_COMMIT"))
        or _clean(os.environ.get("GIT_COMMIT"))
        or _clean(os.environ.get("SOURCE_VERSION"))
        or _read_first_line(_BUILD_VERSION_FILE)
        or legacy_sha
        or _git_output("rev-parse", "HEAD")
    )

    short = _short_sha(commit)
    branch = _clean(os.environ.get("RENDER_GIT_BRANCH")) or _clean(os.environ.get("GIT_BRANCH"))

    if _clean(os.environ.get("RENDER_GIT_COMMIT")):
        commit_source = "render"
    elif legacy_sha:
        commit_source = "app_version"
    elif _read_first_line(_BUILD_VERSION_FILE):
        commit_source = "build_file"
    elif short:
        commit_source = "git"
    else:
        commit_source = "fallback"

    built_at, built_at_source = _resolve_built_at()
    built_at_display = _format_display(built_at) if built_at else ""

    return {
        "version": release,
        "app_version": release,
        "release_source": release_source,
        "git_commit": commit or None,
        "git_commit_short": short or None,
        "git_branch": branch or None,
        "source": release_source,
        "commit_source": commit_source,
        "built_at": built_at or None,
        "built_at_display": built_at_display or None,
        "built_at_source": built_at_source or None,
    }


def get_app_version() -> str:
    return str(get_version_info().get("version") or "1.0")
