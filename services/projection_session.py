"""Phone remote-control sessions for Mass slideshow projection.

Projector creates a short-lived token; the phone scans a QR and sends commands.
Freeze lets the operator browse slides on the phone without changing the screen.
"""

from __future__ import annotations

import secrets
import threading
import time
from dataclasses import dataclass, field
from typing import Any, Optional

_SESSION_TTL_S = 6 * 60 * 60  # 6 hours
_MAX_SESSIONS = 40

_lock = threading.Lock()
_sessions: dict[str, "ProjectionSession"] = {}


@dataclass
class ProjectionSession:
    token: str
    created_at: float
    updated_at: float
    index: int = 0  # 0-based projected slide
    total: int = 0
    blank: bool = False
    frozen: bool = False
    fullscreen: bool = False
    preview_index: int = 0  # 0-based remote browse cursor
    slide_names: list[str] = field(default_factory=list)  # preview_slides filenames
    pptx_name: str = ""
    command_seq: int = 0
    pending: list[dict[str, Any]] = field(default_factory=list)

    def touch(self) -> None:
        self.updated_at = time.time()

    def to_public(self) -> dict[str, Any]:
        return {
            "token": self.token,
            "index": self.index,
            "total": self.total,
            "blank": self.blank,
            "frozen": self.frozen,
            "fullscreen": self.fullscreen,
            "preview_index": self.preview_index,
            "pptx_name": self.pptx_name,
            "command_seq": self.command_seq,
            "updated_at": self.updated_at,
            "remote_url_path": f"/projection/{self.token}",
            "slide_count": len(self.slide_names) or self.total,
        }


def _purge_locked(now: Optional[float] = None) -> None:
    ts = time.time() if now is None else now
    dead = [k for k, s in _sessions.items() if ts - s.updated_at > _SESSION_TTL_S]
    for k in dead:
        _sessions.pop(k, None)
    if len(_sessions) <= _MAX_SESSIONS:
        return
    ordered = sorted(_sessions.items(), key=lambda kv: kv[1].updated_at)
    for k, _ in ordered[: max(0, len(_sessions) - _MAX_SESSIONS)]:
        _sessions.pop(k, None)


def create_session(
    *,
    total: int,
    index: int = 0,
    slide_names: Optional[list[str]] = None,
    pptx_name: str = "",
) -> ProjectionSession:
    with _lock:
        _purge_locked()
        token = secrets.token_urlsafe(10)
        while token in _sessions:
            token = secrets.token_urlsafe(10)
        now = time.time()
        total_n = max(0, int(total or 0))
        idx = max(0, min(int(index or 0), max(0, total_n - 1)))
        session = ProjectionSession(
            token=token,
            created_at=now,
            updated_at=now,
            index=idx,
            total=total_n,
            preview_index=idx,
            slide_names=[str(n) for n in (slide_names or []) if str(n).strip()],
            pptx_name=str(pptx_name or "").strip(),
        )
        _sessions[token] = session
        return session


def get_session(token: str) -> Optional[ProjectionSession]:
    key = (token or "").strip()
    if not key:
        return None
    with _lock:
        _purge_locked()
        session = _sessions.get(key)
        if not session:
            return None
        if time.time() - session.updated_at > _SESSION_TTL_S:
            _sessions.pop(key, None)
            return None
        return session


def update_projector_state(
    token: str,
    *,
    index: Optional[int] = None,
    total: Optional[int] = None,
    blank: Optional[bool] = None,
    frozen: Optional[bool] = None,
    fullscreen: Optional[bool] = None,
    preview_index: Optional[int] = None,
    slide_names: Optional[list[str]] = None,
    pptx_name: Optional[str] = None,
) -> Optional[ProjectionSession]:
    with _lock:
        session = _sessions.get((token or "").strip())
        if not session:
            return None
        if total is not None:
            session.total = max(0, int(total))
        if index is not None and session.total:
            session.index = max(0, min(int(index), session.total - 1))
        elif index is not None:
            session.index = max(0, int(index))
        if blank is not None:
            session.blank = bool(blank)
        if frozen is not None:
            session.frozen = bool(frozen)
            if not session.frozen:
                session.preview_index = session.index
        if fullscreen is not None:
            session.fullscreen = bool(fullscreen)
        if preview_index is not None and session.total:
            session.preview_index = max(0, min(int(preview_index), session.total - 1))
        elif preview_index is not None:
            session.preview_index = max(0, int(preview_index))
        if slide_names is not None:
            session.slide_names = [str(n) for n in slide_names if str(n).strip()]
        if pptx_name is not None:
            session.pptx_name = str(pptx_name or "").strip()
        session.touch()
        return session


def enqueue_command(token: str, action: str, **payload: Any) -> Optional[ProjectionSession]:
    """Queue a remote command and apply freeze/preview locally when possible."""
    action_key = (action or "").strip().lower().replace("-", "_")
    with _lock:
        session = _sessions.get((token or "").strip())
        if not session:
            return None
        session.command_seq += 1
        cmd = {"id": session.command_seq, "action": action_key, **payload}

        # Apply remote-only cursor changes immediately so the phone UI feels instant.
        if action_key in {"preview_next", "preview_prev", "preview_jump"} or (
            session.frozen and action_key in {"next", "prev", "jump"}
        ):
            if action_key in {"next", "preview_next"}:
                if session.total:
                    session.preview_index = min(session.total - 1, session.preview_index + 1)
            elif action_key in {"prev", "preview_prev"}:
                session.preview_index = max(0, session.preview_index - 1)
            elif action_key in {"jump", "preview_jump"}:
                try:
                    target = int(payload.get("index", session.preview_index))
                except (TypeError, ValueError):
                    target = session.preview_index
                if session.total:
                    session.preview_index = max(0, min(target, session.total - 1))
                else:
                    session.preview_index = max(0, target)
            if session.frozen or action_key.startswith("preview_"):
                # Frozen / preview-only browse stays on the phone.
                if action_key == "next":
                    cmd["action"] = "preview_next"
                elif action_key == "prev":
                    cmd["action"] = "preview_prev"
                elif action_key == "jump":
                    cmd["action"] = "preview_jump"
                session.pending.append(cmd)
                session.touch()
                return session

        if action_key == "freeze_on":
            session.frozen = True
            session.preview_index = session.index
        elif action_key == "freeze_off":
            session.frozen = False
            session.preview_index = session.index
        elif action_key == "freeze_toggle":
            session.frozen = not session.frozen
            if session.frozen:
                session.preview_index = session.index
            else:
                session.preview_index = session.index
        elif action_key == "blank_on":
            session.blank = True
        elif action_key == "blank_off":
            session.blank = False
        elif action_key == "blank_toggle":
            session.blank = not session.blank
        elif action_key == "fullscreen_on":
            session.fullscreen = True
        elif action_key == "fullscreen_off":
            session.fullscreen = False
        elif action_key == "fullscreen_toggle":
            session.fullscreen = not session.fullscreen
        elif action_key == "next" and not session.frozen:
            if session.total:
                session.index = min(session.total - 1, session.index + 1)
            session.preview_index = session.index
            session.blank = False
        elif action_key == "prev" and not session.frozen:
            session.index = max(0, session.index - 1)
            session.preview_index = session.index
            session.blank = False
        elif action_key == "jump" and not session.frozen:
            try:
                target = int(payload.get("index", session.index))
            except (TypeError, ValueError):
                target = session.index
            if session.total:
                session.index = max(0, min(target, session.total - 1))
            else:
                session.index = max(0, target)
            session.preview_index = session.index
            session.blank = False
        elif action_key == "go_live":
            session.frozen = False
            session.index = session.preview_index
            session.blank = False
            cmd["index"] = session.index

        session.pending.append(cmd)
        session.touch()
        return session


def drain_commands(token: str, after_seq: int = 0) -> list[dict[str, Any]]:
    with _lock:
        session = _sessions.get((token or "").strip())
        if not session:
            return []
        out = [c for c in session.pending if int(c.get("id") or 0) > int(after_seq or 0)]
        if out:
            keep_from = int(out[-1].get("id") or 0)
            session.pending = [c for c in session.pending if int(c.get("id") or 0) > keep_from]
            session.touch()
        return out


def slide_filename(token: str, index_0based: int) -> Optional[str]:
    session = get_session(token)
    if not session:
        return None
    names = session.slide_names
    if 0 <= index_0based < len(names):
        return names[index_0based]
    # Fallback naming convention used by ppt_preview_render.
    n = index_0based + 1
    if session.total and not (1 <= n <= session.total):
        return None
    return f"slide_{n:04d}.jpg"
