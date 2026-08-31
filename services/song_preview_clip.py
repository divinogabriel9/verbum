"""Build a short chorus audio preview from a YouTube URL (superadmin tool)."""

from __future__ import annotations

import base64
import logging
import os
import re
import shutil
import subprocess
import sys
import tempfile
import threading
from pathlib import Path
from typing import Any, Callable, Optional

ProgressCb = Callable[[int, str], None]

from services.mass_text_format import parse_structured_lyric_sections_typed
from services.song_catalog import parse_youtube_video_id

logger = logging.getLogger(__name__)

PREVIEW_MIN_SEC = 5
PREVIEW_MAX_SEC = 10
PREVIEW_DEFAULT_SEC = 10
LISTEN_WINDOW_SEC = 120

_CHORUS_KINDS = frozenset({"chorus", "refrain"})
_VERSE_KINDS = frozenset({"verse", "stanza"})
_SKIP_CAPTION_RE = re.compile(
    r"^(?:\[?\s*(music|applause|cheering|instrumental|intro|outro|laughter|singing)\s*\]?|♪+)$",
    re.I,
)
_INLINE_CUE_RE = re.compile(
    r"\[(?:music|applause|cheering|instrumental|intro|outro|laughter|singing)\]|♪+",
    re.I,
)
_WORD_RE = re.compile(r"[a-z0-9']+")
_VTT_TS_RE = re.compile(
    r"(?:(\d{1,2}):)?(\d{1,2}):(\d{2})[\.,](\d{3})\s*-->",
)
_VTT_TAG_RE = re.compile(r"<[^>]+>")
_LANG_CODES = {
    "english": "en",
    "en": "en",
    "tagalog": "tl",
    "filipino": "fil",
    "fil": "fil",
    "tl": "tl",
    "latin": "la",
    "spanish": "es",
    "es": "es",
    "cebuano": "ceb",
    "bisaya": "ceb",
    "ilocano": "ilo",
    "korean": "ko",
    "italian": "it",
    "french": "fr",
    "portuguese": "pt",
    "german": "de",
}

_JOB_LOCK = threading.Lock()
_COOKIE_CACHE: Optional[Path] = None


def try_begin_preview_job() -> bool:
    return _JOB_LOCK.acquire(blocking=False)


def end_preview_job() -> None:
    try:
        _JOB_LOCK.release()
    except RuntimeError:
        pass


def clamp_preview_duration(value: Any) -> int:
    try:
        n = int(round(float(value)))
    except (TypeError, ValueError):
        n = PREVIEW_DEFAULT_SEC
    return max(PREVIEW_MIN_SEC, min(PREVIEW_MAX_SEC, n))


def chorus_lyrics_from_text(lyrics: str) -> str:
    blocks = parse_structured_lyric_sections_typed(lyrics or "")
    parts = [body for kind, body in blocks if kind in _CHORUS_KINDS]
    return "\n".join(parts).strip()


def first_verse_lyrics_from_text(lyrics: str) -> str:
    blocks = parse_structured_lyric_sections_typed(lyrics or "")
    for kind, body in blocks:
        if kind in _VERSE_KINDS and str(body or "").strip():
            return str(body).strip()
    for kind, body in blocks:
        if kind not in _CHORUS_KINDS | {"intro", "outro", "coda"} and str(body or "").strip():
            return str(body).strip()
    return str(lyrics or "").strip()


def pick_preview_lyric_target(lyrics: str) -> tuple[str, str]:
    """Return (lyric text, source) preferring chorus, then first verse."""
    chorus = chorus_lyrics_from_text(lyrics)
    if chorus:
        return chorus, "chorus"
    verse = first_verse_lyrics_from_text(lyrics)
    if verse:
        return verse, "verse"
    return "", "scan"


def _lang_code(language: str) -> str:
    key = str(language or "").strip().lower()
    return _LANG_CODES.get(key, "")


def _norm_words(text: str) -> list[str]:
    return _WORD_RE.findall(str(text or "").lower())


def lyric_phrases(text: str, size: int = 4) -> list[str]:
    words = _norm_words(text)
    if len(words) >= size:
        return [" ".join(words[i : i + size]) for i in range(0, len(words) - size + 1)]
    if len(words) >= 3:
        return [" ".join(words)]
    return []


def _usable_caption_text(text: str) -> str:
    raw = _INLINE_CUE_RE.sub(" ", str(text or ""))
    raw = _VTT_TAG_RE.sub(" ", raw)
    raw = re.sub(r"\s+", " ", raw).strip()
    if not raw or _SKIP_CAPTION_RE.match(raw):
        return ""
    return raw


def _snippets_to_captions(rows: Any) -> list[dict[str, Any]]:
    captions: list[dict[str, Any]] = []
    for row in rows or []:
        if hasattr(row, "start") or hasattr(row, "text"):
            start = float(getattr(row, "start", 0) or 0)
            text = str(getattr(row, "text", "") or "")
        elif isinstance(row, dict):
            start = float(row.get("start") or 0)
            text = str(row.get("text") or "")
        else:
            continue
        if text.strip():
            captions.append({"start": start, "text": text})
    return captions


def _fetch_listed_transcripts(video_id: str, langs: list[str]) -> list[dict[str, Any]]:
    try:
        from youtube_transcript_api import YouTubeTranscriptApi
    except Exception:
        return []
    listing = None
    try:
        listing = YouTubeTranscriptApi().list(video_id)
    except Exception:
        try:
            listing = YouTubeTranscriptApi.list_transcripts(video_id)
        except Exception:
            logger.debug("Could not list transcripts for %s", video_id, exc_info=True)
            return []
    wanted = [str(code).lower() for code in langs if code]
    ranked: list[Any] = []
    try:
        for transcript in listing:
            lang = str(getattr(transcript, "language_code", "") or "").lower()
            generated = bool(getattr(transcript, "is_generated", False))
            score = 0
            if any(lang == code or lang.startswith(code + "-") for code in wanted):
                score += 8
            if not generated:
                score += 4
            ranked.append((score, generated, transcript))
    except Exception:
        return []
    ranked.sort(key=lambda item: (-item[0], item[1]))
    for _score, _generated, transcript in ranked:
        try:
            fetched = transcript.fetch()
            captions = _snippets_to_captions(fetched)
            if captions:
                return captions
        except Exception:
            continue
        try:
            translated = transcript.translate("en").fetch()
            captions = _snippets_to_captions(translated)
            if captions:
                return captions
        except Exception:
            continue
    return []


def _fetch_captions(video_id: str, language: str = "") -> list[dict[str, Any]]:
    try:
        from youtube_transcript_api import YouTubeTranscriptApi
    except Exception:
        logger.info("youtube-transcript-api is not installed.")
        return []
    langs: list[str] = []
    code = _lang_code(language)
    if code:
        langs.append(code)
    for extra in ("en", "en-US", "en-GB"):
        if extra not in langs:
            langs.append(extra)
    captions = _fetch_listed_transcripts(video_id, langs)
    if captions:
        return captions
    try:
        api = YouTubeTranscriptApi()
        fetched = api.fetch(video_id, languages=langs)
        captions = _snippets_to_captions(fetched)
        if captions:
            return captions
    except Exception:
        logger.debug("Transcript fetch() failed for %s", video_id, exc_info=True)
    try:
        fetched = YouTubeTranscriptApi.get_transcript(video_id, languages=langs)
        captions = _snippets_to_captions(fetched)
        if captions:
            return captions
    except Exception:
        logger.info("No captions for YouTube id %s", video_id)
    return captions


def match_lyric_start(
    captions: list[dict[str, Any]],
    lyric_text: str,
    duration_sec: int,
    *,
    min_score: float = 0.18,
) -> Optional[float]:
    """Find the first caption where a sung lyric phrase appears.

    Uses consecutive word phrases so a title card like "We Are Called" cannot
    match a chorus line such as "We are called to act with justice".
    ``min_score`` is kept for callers; phrase hits win over bag-of-words.
    """
    if not captions or not _norm_words(lyric_text):
        return None
    for size in (5, 4):
        phrases = set(lyric_phrases(lyric_text, size))
        if not phrases:
            continue
        window = max(float(duration_sec), 16.0)
        for i, cap in enumerate(captions):
            if not _usable_caption_text(str(cap.get("text") or "")):
                continue
            start = float(cap.get("start") or 0)
            blob: list[str] = []
            for later in captions[i:]:
                later_start = float(later.get("start") or 0)
                if later_start > start + window:
                    break
                usable = _usable_caption_text(str(later.get("text") or ""))
                if usable:
                    blob.append(usable)
            hay = " ".join(_norm_words(" ".join(blob)))
            if any(phrase in hay for phrase in phrases):
                return max(0.0, start)
    lyric_words = set(_norm_words(lyric_text))
    if len(lyric_words) < 8:
        return None
    window = max(float(duration_sec), 14.0)
    best_start: Optional[float] = None
    best_score = 0.0
    for i, cap in enumerate(captions):
        if not _usable_caption_text(str(cap.get("text") or "")):
            continue
        start = float(cap.get("start") or 0)
        blob: list[str] = []
        for later in captions[i:]:
            later_start = float(later.get("start") or 0)
            if later_start > start + window:
                break
            usable = _usable_caption_text(str(later.get("text") or ""))
            if usable:
                blob.append(usable)
        words = set(_norm_words(" ".join(blob)))
        if not words:
            continue
        score = len(lyric_words & words) / max(1, len(lyric_words))
        if score > best_score:
            best_score = score
            best_start = start
    if best_score < max(0.42, min_score) or best_start is None:
        return None
    return max(0.0, best_start)


def match_chorus_start(
    captions: list[dict[str, Any]],
    chorus_text: str,
    duration_sec: int,
) -> Optional[float]:
    return match_lyric_start(captions, chorus_text, duration_sec)


def match_words_to_lyrics(words: list[dict[str, Any]], lyric_text: str) -> Optional[float]:
    """Return start time of the first 4-word lyric phrase in a timed word list."""
    timed = [
        (max(0.0, float(row.get("start") or 0)), str(row.get("text") or row.get("word") or ""))
        for row in words
        if row
    ]
    seq: list[tuple[float, str]] = []
    for start, text in timed:
        for word in _norm_words(text):
            seq.append((start, word))
    if len(seq) < 3:
        return None
    for size in (5, 4):
        phrases = set(lyric_phrases(lyric_text, size))
        if not phrases:
            continue
        for i in range(0, len(seq) - size + 1):
            joined = " ".join(word for _start, word in seq[i : i + size])
            if joined in phrases:
                return seq[i][0]
    if len(_norm_words(lyric_text)) < 4:
        phrases = set(lyric_phrases(lyric_text, 3))
        for i in range(0, len(seq) - 2):
            joined = " ".join(word for _start, word in seq[i : i + 3])
            if joined in phrases:
                return seq[i][0]
    return None


def _scan_first_sung_caption(captions: list[dict[str, Any]]) -> Optional[float]:
    """First real lyric line, skipping title cards that sit on the intro."""
    for cap in captions:
        text = _usable_caption_text(str(cap.get("text") or ""))
        words = _norm_words(text)
        if len(words) < 4:
            continue
        start = max(0.0, float(cap.get("start") or 0))
        if start < 4.0:
            continue
        return start
    return None


def _lyric_targets(lyrics: str) -> list[tuple[str, str]]:
    chorus = chorus_lyrics_from_text(lyrics)
    verse = first_verse_lyrics_from_text(lyrics)
    targets: list[tuple[str, str]] = []
    if chorus:
        targets.append((chorus, "chorus"))
    if verse and verse != chorus:
        targets.append((verse, "verse"))
    if lyrics and not targets:
        targets.append((str(lyrics).strip(), "scan"))
    return targets


def resolve_preview_start(
    *,
    captions: list[dict[str, Any]],
    lyrics: str,
    duration_sec: int,
) -> tuple[Optional[float], str]:
    """Match sung lyric phrases in captions. Returns (start, method) or (None, start)."""
    for text, source in _lyric_targets(lyrics):
        hit = match_lyric_start(captions, text, duration_sec)
        if hit is None:
            first_lines = "\n".join(text.splitlines()[:3])
            if first_lines.strip() and first_lines.strip() != text:
                hit = match_lyric_start(captions, first_lines, duration_sec)
        if hit is not None:
            return hit, source
    scanned = _scan_first_sung_caption(captions)
    if scanned is not None:
        return scanned, "scan"
    return None, "start"


def resolve_preview_start_from_words(
    words: list[dict[str, Any]],
    lyrics: str,
) -> tuple[Optional[float], str]:
    for text, source in _lyric_targets(lyrics):
        hit = match_words_to_lyrics(words, text)
        if hit is not None:
            return hit, source if source != "scan" else "words"
    seq = [(float(row.get("start") or 0), w) for row in words for w in _norm_words(str(row.get("text") or row.get("word") or ""))]
    if len(seq) >= 4:
        for start, _word in seq:
            if start >= 4.0:
                return start, "words"
    return None, "start"


def parse_vtt_captions(text: str) -> list[dict[str, Any]]:
    captions: list[dict[str, Any]] = []
    current_start: Optional[float] = None
    lines: list[str] = []

    def flush() -> None:
        nonlocal current_start, lines
        if current_start is None:
            lines = []
            return
        body = _usable_caption_text(" ".join(lines))
        if body:
            captions.append({"start": current_start, "text": body})
        current_start = None
        lines = []

    for raw in str(text or "").splitlines():
        line = raw.strip()
        if not line or line.upper().startswith("WEBVTT") or line.startswith("NOTE") or line.startswith("KIND") or line.startswith("LANGUAGE"):
            continue
        stamp = _VTT_TS_RE.search(line)
        if stamp:
            flush()
            hours = int(stamp.group(1) or 0)
            minutes = int(stamp.group(2) or 0)
            seconds = int(stamp.group(3) or 0)
            millis = int(stamp.group(4) or 0)
            current_start = hours * 3600 + minutes * 60 + seconds + millis / 1000.0
            continue
        if re.fullmatch(r"\d+", line):
            continue
        lines.append(_VTT_TAG_RE.sub(" ", line))
    flush()
    return captions


def _collect_vtt_captions(dest_dir: Path) -> list[dict[str, Any]]:
    hits: list[Path] = sorted(dest_dir.glob("*.vtt"))
    for path in hits:
        try:
            captions = parse_vtt_captions(path.read_text(encoding="utf-8", errors="ignore"))
        except Exception:
            continue
        if captions:
            return captions
    return []


def _run(cmd: list[str], *, timeout: int) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        cmd,
        check=False,
        capture_output=True,
        text=True,
        timeout=timeout,
    )


def _pick_downloaded_source(dest_dir: Path) -> Path:
    hits = [
        p
        for p in dest_dir.glob("source.*")
        if p.is_file()
        and p.suffix.lower() not in {".part", ".ytdl", ".temp", ".vtt", ".srt", ".json"}
    ]
    if not hits:
        raise RuntimeError("Download finished but no audio file was written.")
    hits.sort(key=lambda p: p.stat().st_mtime, reverse=True)
    return hits[0]


def _yt_dlp_cookiefile() -> Optional[str]:
    """Optional Netscape cookies for YouTube on datacenter IPs (Render, etc.)."""
    global _COOKIE_CACHE

    explicit = (os.environ.get("YTDLP_COOKIES_FILE") or "").strip()
    if explicit:
        path = Path(explicit).expanduser()
        if path.is_file():
            return str(path)
        logger.warning("YTDLP_COOKIES_FILE is set but not readable: %s", explicit)
        return None

    b64 = (os.environ.get("YTDLP_COOKIES_B64") or "").strip()
    if not b64:
        return None

    if _COOKIE_CACHE is not None and _COOKIE_CACHE.is_file():
        return str(_COOKIE_CACHE)

    try:
        content = base64.b64decode(b64, validate=True)
    except Exception:
        logger.warning("YTDLP_COOKIES_B64 is not valid base64.")
        return None
    if not content.strip():
        logger.warning("YTDLP_COOKIES_B64 decoded to empty content.")
        return None

    dest = Path(tempfile.gettempdir()) / "verbum_ytdlp_cookies.txt"
    try:
        dest.write_bytes(content)
    except OSError as exc:
        logger.warning("Could not write yt-dlp cookies file: %s", exc)
        return None
    _COOKIE_CACHE = dest
    return str(dest)


def _yt_dlp_download_error_hint(err: str) -> str:
    lowered = err.lower()
    if "sign in to confirm" in lowered or "not a bot" in lowered:
        if not _yt_dlp_cookiefile():
            return (
                err[:180]
                + " On Render/datacenter hosts, export YouTube cookies from your browser "
                "and set YTDLP_COOKIES_B64 in Render env (see .env.example)."
            )
    return err[:240]


def _yt_dlp_js_runtimes() -> dict[str, dict[str, str]]:
    """Prefer Deno (yt-dlp default), then Node — required for modern YouTube formats."""
    runtimes: dict[str, dict[str, str]] = {}
    for name in ("deno", "node"):
        path = shutil.which(name)
        if path:
            runtimes[name] = {"path": path}
    return runtimes


def _download_audio_attempts() -> list[dict[str, Any]]:
    """Ordered yt-dlp option overlays — YouTube CDN often 403s android_sdkless/vr URLs."""
    attempts: list[dict[str, Any]] = []
    if _yt_dlp_cookiefile():
        attempts.append(
            {
                "extractor_args": {
                    "youtube": {"player_client": ["web"]},
                },
            }
        )
    attempts.extend(
        [
        {
            "extractor_args": {
                "youtube": {"player_client": ["default", "-android_sdkless"]},
            },
        },
        {
            "extractor_args": {
                "youtube": {"player_client": ["android"]},
            },
        },
        {
            "extractor_args": {
                "youtube": {"player_client": ["mediaconnect"]},
            },
        },
        {},
        {
            "extractor_args": {
                "youtube": {
                    "player_client": ["ios"],
                    "formats": ["missing_pot"],
                },
            },
            "format": "ba[protocol=m3u8_native]/b[protocol=m3u8_native]/bestaudio/best",
        },
        ]
    )
    return attempts


def _download_audio(
    youtube_url: str,
    dest_dir: Path,
    progress_cb: Optional[ProgressCb] = None,
) -> Path:
    out_tmpl = str(dest_dir / "source.%(ext)s")
    last_pct = {"n": -1}

    def hook(payload: dict[str, Any]) -> None:
        if not progress_cb or payload.get("status") != "downloading":
            return
        total = float(payload.get("total_bytes") or payload.get("total_bytes_estimate") or 0)
        got = float(payload.get("downloaded_bytes") or 0)
        pct = int(got * 100 / total) if total > 0 else 0
        pct = max(0, min(100, pct))
        if pct == last_pct["n"]:
            return
        last_pct["n"] = pct
        progress_cb(pct, "download")

    try:
        import yt_dlp
    except Exception:
        yt_dlp = None  # type: ignore[assignment]

    js_runtimes = _yt_dlp_js_runtimes()
    cookiefile = _yt_dlp_cookiefile()
    if not js_runtimes:
        logger.warning(
            "No JS runtime (deno/node) found for yt-dlp; YouTube downloads may 403. "
            "Install Node.js or Deno: https://github.com/yt-dlp/yt-dlp/wiki/EJS"
        )
    if not cookiefile:
        logger.info(
            "No YTDLP cookies configured; YouTube may block datacenter IPs. "
            "Set YTDLP_COOKIES_B64 on Render if preview fetch fails."
        )

    if yt_dlp is not None:
        last_err: Optional[BaseException] = None
        for attempt in _download_audio_attempts():
            for stale in dest_dir.glob("source.*"):
                try:
                    stale.unlink(missing_ok=True)
                except OSError:
                    pass
            opts: dict[str, Any] = {
                "format": "bestaudio/best",
                "outtmpl": out_tmpl,
                "noplaylist": True,
                "quiet": True,
                "noprogress": True,
                "progress_hooks": [hook],
                "writesubtitles": True,
                "writeautomaticsub": True,
                "subtitleslangs": ["en", "en-orig", "en-US"],
                "subtitlesformat": "vtt",
                "postprocessors": [{"key": "FFmpegExtractAudio", "preferredcodec": "m4a"}],
                "remote_components": {"ejs:github"},
            }
            if js_runtimes:
                opts["js_runtimes"] = js_runtimes
            if cookiefile:
                opts["cookiefile"] = cookiefile
            opts.update(attempt)
            try:
                with yt_dlp.YoutubeDL(opts) as ydl:
                    ydl.download([youtube_url])
                return _pick_downloaded_source(dest_dir)
            except Exception as exc:
                last_err = exc
                logger.info(
                    "yt-dlp attempt failed (%s): %s",
                    attempt.get("extractor_args") or "default",
                    str(exc)[:180],
                )
                continue
        raise RuntimeError(
            _yt_dlp_download_error_hint(str(last_err)) if last_err else "Could not download audio."
        ) from last_err

    js_flags: list[str] = []
    for name, meta in js_runtimes.items():
        path = (meta or {}).get("path") or name
        js_flags.extend(["--js-runtimes", f"{name}:{path}"])
    last_cli_err = ""
    for attempt in _download_audio_attempts():
        for stale in dest_dir.glob("source.*"):
            try:
                stale.unlink(missing_ok=True)
            except OSError:
                pass
        fmt = str(attempt.get("format") or "bestaudio/best")
        cmd = [
            sys.executable,
            "-m",
            "yt_dlp",
            "-f",
            fmt,
            "-x",
            "--audio-format",
            "m4a",
            "--write-auto-sub",
            "--sub-lang",
            "en,en-orig,en-US",
            "--convert-subs",
            "vtt",
            "--no-playlist",
            "--no-progress",
            "--remote-components",
            "ejs:github",
            *js_flags,
            "-o",
            out_tmpl,
        ]
        if cookiefile:
            cmd.extend(["--cookies", cookiefile])
        extractor = attempt.get("extractor_args") or {}
        yt_args = (extractor.get("youtube") or {}) if isinstance(extractor, dict) else {}
        client = yt_args.get("player_client") if isinstance(yt_args, dict) else None
        if client:
            cmd.extend(["--extractor-args", "youtube:player_client=" + ",".join(client)])
        cmd.append(youtube_url)
        try:
            proc = _run(cmd, timeout=120)
        except subprocess.TimeoutExpired as exc:
            raise RuntimeError("YouTube download timed out.") from exc
        if proc.returncode == 0:
            return _pick_downloaded_source(dest_dir)
        last_cli_err = (proc.stderr or proc.stdout or "yt-dlp failed").strip()
        logger.info("yt-dlp CLI attempt failed: %s", last_cli_err.splitlines()[-1][:180] if last_cli_err else "unknown")
    raise RuntimeError(
        _yt_dlp_download_error_hint(last_cli_err.splitlines()[-1] if last_cli_err else "")
        if last_cli_err
        else "Could not download audio."
    )


def _cut_preview(src: Path, dest: Path, *, start_sec: float, duration_sec: int) -> None:
    ffmpeg = shutil.which("ffmpeg")
    if not ffmpeg:
        raise RuntimeError("ffmpeg is not installed on this server.")
    cmd = [
        ffmpeg,
        "-y",
        "-i",
        str(src),
        "-ss",
        f"{max(0.0, start_sec):.3f}",
        "-t",
        str(duration_sec),
        "-vn",
        "-ac",
        "2",
        "-ar",
        "44100",
        "-b:a",
        "128k",
        str(dest),
    ]
    try:
        proc = _run(cmd, timeout=45)
    except subprocess.TimeoutExpired as exc:
        raise RuntimeError("Audio cut timed out.") from exc
    if proc.returncode != 0 or not dest.is_file() or dest.stat().st_size < 400:
        err = (proc.stderr or proc.stdout or "ffmpeg failed").strip()
        raise RuntimeError(err.splitlines()[-1][:240] if err else "Could not cut the preview clip.")


def _extract_listen_clip(src: Path, dest: Path, *, seconds: int = LISTEN_WINDOW_SEC) -> None:
    ffmpeg = shutil.which("ffmpeg")
    if not ffmpeg:
        raise RuntimeError("ffmpeg is not installed on this server.")
    cmd = [
        ffmpeg,
        "-y",
        "-i",
        str(src),
        "-t",
        str(max(30, int(seconds))),
        "-vn",
        "-ac",
        "1",
        "-ar",
        "16000",
        "-b:a",
        "64k",
        str(dest),
    ]
    proc = _run(cmd, timeout=40)
    if proc.returncode != 0 or not dest.is_file() or dest.stat().st_size < 400:
        err = (proc.stderr or proc.stdout or "ffmpeg failed").strip()
        raise RuntimeError(err.splitlines()[-1][:240] if err else "Could not prepare audio for word detection.")


def _openai_api_key() -> str:
    key = (os.environ.get("OPENAI_API_KEY") or "").strip()
    if key:
        return key
    try:
        from services.env_config import load_project_dotenv

        load_project_dotenv()
    except Exception:
        pass
    return (os.environ.get("OPENAI_API_KEY") or "").strip()


def transcribe_audio_words(audio_path: Path) -> list[dict[str, Any]]:
    """Detect timed words in audio via OpenAI Whisper. Empty if unavailable."""
    key = _openai_api_key()
    if not key or not audio_path.is_file():
        return []
    try:
        from openai import OpenAI
    except Exception:
        logger.info("openai is not installed; skipping spoken-word detection.")
        return []
    client = OpenAI(api_key=key)
    result = None
    try:
        with audio_path.open("rb") as fh:
            result = client.audio.transcriptions.create(
                model="whisper-1",
                file=fh,
                response_format="verbose_json",
                timestamp_granularities=["word"],
            )
    except Exception:
        try:
            with audio_path.open("rb") as fh:
                result = client.audio.transcriptions.create(
                    model="whisper-1",
                    file=fh,
                    response_format="verbose_json",
                )
        except Exception:
            logger.info("Whisper word detection failed for %s", audio_path.name, exc_info=True)
            return []
    if result is None:
        return []
    words: list[dict[str, Any]] = []
    raw_words = getattr(result, "words", None) or (result.get("words") if isinstance(result, dict) else None)
    for row in raw_words or []:
        if hasattr(row, "word") or hasattr(row, "start"):
            text = str(getattr(row, "word", "") or getattr(row, "text", "") or "")
            start = float(getattr(row, "start", 0) or 0)
        elif isinstance(row, dict):
            text = str(row.get("word") or row.get("text") or "")
            start = float(row.get("start") or 0)
        else:
            continue
        if _norm_words(text):
            words.append({"start": start, "text": text})
    if words:
        return words
    segments = getattr(result, "segments", None) or (result.get("segments") if isinstance(result, dict) else None)
    for row in segments or []:
        if hasattr(row, "text") or hasattr(row, "start"):
            text = str(getattr(row, "text", "") or "")
            start = float(getattr(row, "start", 0) or 0)
        elif isinstance(row, dict):
            text = str(row.get("text") or "")
            start = float(row.get("start") or 0)
        else:
            continue
        usable = _usable_caption_text(text)
        if usable:
            words.append({"start": start, "text": usable})
    return words


def build_preview_clip(
    *,
    youtube_url: str,
    lyrics: str = "",
    language: str = "",
    duration_sec: int = PREVIEW_DEFAULT_SEC,
    start_sec: Optional[float] = None,
    dest_path: Path,
    progress_cb: Optional[ProgressCb] = None,
) -> dict[str, Any]:
    """Download audio, find first sung lyrics, write dest_path as mp3."""
    def report(pct: int, stage: str) -> None:
        if progress_cb:
            progress_cb(max(0, min(100, int(pct))), stage)

    video_id = parse_youtube_video_id(youtube_url)
    if not video_id:
        raise RuntimeError("Enter a valid YouTube URL.")
    duration = clamp_preview_duration(duration_sec)
    watch_url = "https://www.youtube.com/watch?v=" + video_id
    method = "manual"
    resolved_start: Optional[float] = None
    if start_sec is not None:
        resolved_start = max(0.0, float(start_sec))
    _, lyric_source = pick_preview_lyric_target(lyrics)
    report(6, "starting")
    captions: list[dict[str, Any]] = []
    if resolved_start is None:
        report(10, "captions")
        captions = _fetch_captions(video_id, language)
        resolved_start, method = resolve_preview_start(
            captions=captions,
            lyrics=lyrics,
            duration_sec=duration,
        )
    dest_path.parent.mkdir(parents=True, exist_ok=True)
    report(18, "download")
    with tempfile.TemporaryDirectory(prefix="verbum_yt_") as tmp:
        tmp_dir = Path(tmp)

        def on_download(pct: int, _stage: str) -> None:
            report(18 + int(pct * 0.58), "download")

        src = _download_audio(watch_url, tmp_dir, progress_cb=on_download)
        if resolved_start is None:
            vtt_captions = _collect_vtt_captions(tmp_dir)
            if vtt_captions:
                captions = vtt_captions
                resolved_start, method = resolve_preview_start(
                    captions=captions,
                    lyrics=lyrics,
                    duration_sec=duration,
                )
        if resolved_start is None:
            report(82, "words")
            probe = tmp_dir / "listen.mp3"
            try:
                _extract_listen_clip(src, probe)
                words = transcribe_audio_words(probe)
            except Exception:
                logger.info("Spoken-word probe failed", exc_info=True)
                words = []
            if words:
                resolved_start, word_method = resolve_preview_start_from_words(words, lyrics)
                if resolved_start is not None:
                    method = "words" if word_method in {"scan", "start", "words"} else word_method
        if resolved_start is None:
            resolved_start = 0.0
            method = "start"
        resolved_start = max(0.0, float(resolved_start))
        report(90, "cutting")
        _cut_preview(src, dest_path, start_sec=resolved_start, duration_sec=duration)
    report(96, "saving")
    return {
        "youtube_id": video_id,
        "youtube_url": watch_url,
        "start_sec": round(resolved_start, 2),
        "duration_sec": duration,
        "method": method,
        "lyric_source": lyric_source,
        "has_chorus": lyric_source == "chorus",
        "basename": dest_path.name,
    }
