"""Resolve deploy / git version for health checks and UI."""

from __future__ import annotations

import os
import subprocess
from functools import lru_cache
from pathlib import Path
from typing import Any

_PROJECT = Path(__file__).resolve().parents[1]
_BUILD_VERSION_FILE = _PROJECT / ".build-version"


def _clean(value: str | None) -> str:
    return (value or "").strip()


def _short_sha(sha: str) -> str:
    sha = _clean(sha)
    if not sha:
        return ""
    return sha[:7] if len(sha) >= 7 else sha


def _read_build_file() -> str:
    try:
        if not _BUILD_VERSION_FILE.is_file():
            return ""
        text = _BUILD_VERSION_FILE.read_text(encoding="utf-8")
        return _clean(text.splitlines()[0] if text else "")
    except OSError:
        return ""


def _git_rev_parse() -> str:
    try:
        out = subprocess.check_output(
            ["git", "rev-parse", "HEAD"],
            cwd=str(_PROJECT),
            stderr=subprocess.DEVNULL,
            timeout=2,
        )
        return _clean(out.decode("utf-8", errors="ignore"))
    except Exception:
        return ""


@lru_cache(maxsize=1)
def get_version_info() -> dict[str, Any]:
    """Return version fields for the running process (stable per deploy)."""
    explicit = _clean(os.environ.get("APP_VERSION"))
    commit = (
        _clean(os.environ.get("RENDER_GIT_COMMIT"))
        or _clean(os.environ.get("GIT_COMMIT"))
        or _clean(os.environ.get("SOURCE_VERSION"))
        or _read_build_file()
        or _git_rev_parse()
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
    elif _read_build_file():
        source = "build_file"
    elif short:
        source = "git"
    else:
        source = "fallback"

    return {
        "version": label,
        "app_version": explicit or label,
        "git_commit": commit or None,
        "git_commit_short": short or None,
        "git_branch": branch or None,
        "source": source,
    }


def get_app_version() -> str:
    return str(get_version_info().get("version") or "dev")
