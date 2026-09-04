"""Build a timed karaoke instrumental MP4 from YouTube audio + library lyrics."""

from __future__ import annotations

import logging
import re
import shutil
import subprocess
import tempfile
from pathlib import Path
from typing import Any, Optional

from services.mass_text_format import clean_lyrics_for_projection, parse_structured_lyric_sections_typed
from services.song_catalog import parse_youtube_video_id
from services.song_preview_clip import (
    ProgressCb,
    _download_audio,
    _norm_words,
    _openai_api_key,
    _run,
)

logger = logging.getLogger(__name__)

KARAOKE_WIDTH = 1280
KARAOKE_HEIGHT = 720
INTRO_PAD_SEC = 2.0
OUTRO_PAD_SEC = 2.0
MIN_LINE_SEC = 1.4
MAX_LINE_SEC = 8.0


def lyric_display_lines(lyrics: str) -> list[str]:
    """Flatten library lyrics into projection lines (no section labels)."""
    lines: list[str] = []
    for _kind, body in parse_structured_lyric_sections_typed(lyrics or ""):
        for raw in (body or "").splitlines():
            text = re.sub(r"\s+", " ", str(raw or "").strip())
            if text:
                lines.append(text)
    if lines:
        return lines
    cleaned = clean_lyrics_for_projection(lyrics or "")
    for raw in cleaned.splitlines():
        text = re.sub(r"\s+", " ", raw.strip())
        if text:
            lines.append(text)
    return lines


def _ffprobe_duration(path: Path) -> float:
    ffprobe = shutil.which("ffprobe")
    if not ffprobe or not path.is_file():
        return 0.0
    proc = _run(
        [
            ffprobe,
            "-v",
            "error",
            "-show_entries",
            "format=duration",
            "-of",
            "default=noprint_wrappers=1:nokey=1",
            str(path),
        ],
        timeout=30,
    )
    try:
        return max(0.0, float((proc.stdout or "").strip()))
    except (TypeError, ValueError):
        return 0.0


def _extract_audio_track(src: Path, dest: Path) -> Path:
    ffmpeg = shutil.which("ffmpeg")
    if not ffmpeg:
        raise RuntimeError("ffmpeg is not installed on this server.")
    cmd = [
        ffmpeg,
        "-y",
        "-i",
        str(src),
        "-vn",
        "-ac",
        "2",
        "-ar",
        "44100",
        "-b:a",
        "192k",
        str(dest),
    ]
    proc = _run(cmd, timeout=180)
    if proc.returncode != 0 or not dest.is_file() or dest.stat().st_size < 400:
        err = (proc.stderr or proc.stdout or "ffmpeg failed").strip()
        raise RuntimeError(err.splitlines()[-1][:240] if err else "Could not extract audio.")
    return dest


def transcribe_audio_segments(audio_path: Path) -> list[dict[str, Any]]:
    """Timed segments from Whisper (start/end/text). Empty if unavailable."""
    key = _openai_api_key()
    if not key or not audio_path.is_file():
        return []
    try:
        from openai import OpenAI
    except Exception:
        logger.info("openai is not installed; skipping karaoke transcription.")
        return []
    client = OpenAI(api_key=key)
    try:
        with audio_path.open("rb") as fh:
            result = client.audio.transcriptions.create(
                model="whisper-1",
                file=fh,
                response_format="verbose_json",
                timestamp_granularities=["segment", "word"],
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
            logger.info("Whisper karaoke transcription failed for %s", audio_path.name, exc_info=True)
            return []

    segments: list[dict[str, Any]] = []
    raw = getattr(result, "segments", None) or (result.get("segments") if isinstance(result, dict) else None)
    for row in raw or []:
        if hasattr(row, "text") or hasattr(row, "start"):
            text = str(getattr(row, "text", "") or "").strip()
            start = float(getattr(row, "start", 0) or 0)
            end = float(getattr(row, "end", start) or start)
        elif isinstance(row, dict):
            text = str(row.get("text") or "").strip()
            start = float(row.get("start") or 0)
            end = float(row.get("end") or start)
        else:
            continue
        if not text:
            continue
        if end <= start:
            end = start + MIN_LINE_SEC
        segments.append({"start": max(0.0, start), "end": max(0.0, end), "text": text})
    return segments


def _token_set(text: str) -> set[str]:
    return set(_norm_words(text))


def _overlap_score(a: str, b: str) -> float:
    ta = _token_set(a)
    tb = _token_set(b)
    if not ta or not tb:
        return 0.0
    inter = len(ta & tb)
    return inter / float(max(len(ta), len(tb)))


def align_lyric_lines(
    lines: list[str],
    *,
    duration_sec: float,
    whisper_segments: list[dict[str, Any]] | None = None,
) -> tuple[list[dict[str, Any]], str]:
    """
    Return ``(cues, method)`` where each cue is ``{text, start, end}``.
    One lyric line is shown at a time.
    """
    clean_lines = [re.sub(r"\s+", " ", str(ln or "").strip()) for ln in (lines or [])]
    clean_lines = [ln for ln in clean_lines if ln]
    if not clean_lines:
        raise RuntimeError("This song has no lyrics in the library to place on the video.")

    dur = max(float(duration_sec or 0), MIN_LINE_SEC * len(clean_lines) + INTRO_PAD_SEC + OUTRO_PAD_SEC)
    usable_start = min(INTRO_PAD_SEC, max(0.0, dur * 0.08))
    usable_end = max(usable_start + MIN_LINE_SEC, dur - OUTRO_PAD_SEC)
    window = max(MIN_LINE_SEC, usable_end - usable_start)

    segs = [s for s in (whisper_segments or []) if float(s.get("end") or 0) > float(s.get("start") or 0)]
    method = "even"
    raw_cues: list[dict[str, Any]] = []

    if segs and len(segs) >= max(2, len(clean_lines) // 4):
        used: set[int] = set()
        cursor = usable_start
        matched = 0
        for line in clean_lines:
            best_i = -1
            best_score = 0.0
            for i, seg in enumerate(segs):
                if i in used:
                    continue
                start = float(seg["start"])
                if start + 0.4 < cursor - 1.5:
                    continue
                score = _overlap_score(line, str(seg.get("text") or ""))
                score -= max(0.0, (start - cursor) * 0.01)
                if score > best_score:
                    best_score = score
                    best_i = i
            if best_i >= 0 and best_score >= 0.28:
                seg = segs[best_i]
                used.add(best_i)
                start = max(usable_start, float(seg["start"]))
                end = min(usable_end, float(seg["end"]))
                if end - start < MIN_LINE_SEC:
                    end = min(usable_end, start + MIN_LINE_SEC)
                if end - start > MAX_LINE_SEC:
                    end = start + MAX_LINE_SEC
                raw_cues.append({"text": line, "start": start, "end": end})
                cursor = end
                matched += 1
            else:
                raw_cues.append({"text": line, "start": -1.0, "end": -1.0})

        i = 0
        while i < len(raw_cues):
            if raw_cues[i]["start"] >= 0:
                i += 1
                continue
            prev_end = usable_start if i == 0 else float(raw_cues[i - 1]["end"])
            run = 1
            while i + run < len(raw_cues) and raw_cues[i + run]["start"] < 0:
                run += 1
            next_start = usable_end
            if i + run < len(raw_cues) and raw_cues[i + run]["start"] >= 0:
                next_start = float(raw_cues[i + run]["start"])
            span = max(MIN_LINE_SEC * run, next_start - prev_end)
            slot = span / float(run)
            for k in range(run):
                start = prev_end + slot * k
                end = min(next_start, start + max(MIN_LINE_SEC, min(MAX_LINE_SEC, slot)))
                raw_cues[i + k] = {"text": raw_cues[i + k]["text"], "start": start, "end": end}
            i += run
        method = "whisper_align" if matched >= max(1, len(clean_lines) // 3) else "hybrid"
    else:
        slot = window / float(len(clean_lines))
        for i, line in enumerate(clean_lines):
            start = usable_start + slot * i
            end = min(usable_end, start + max(MIN_LINE_SEC, min(MAX_LINE_SEC, slot * 0.95)))
            raw_cues.append({"text": line, "start": start, "end": end})
        method = "even"

    prev = usable_start
    cues: list[dict[str, Any]] = []
    for cue in raw_cues:
        start = max(prev, float(cue["start"]))
        end = max(start + MIN_LINE_SEC, float(cue["end"]))
        end = min(usable_end, end)
        if end <= start:
            end = min(usable_end, start + MIN_LINE_SEC)
        cues.append({"text": cue["text"], "start": round(start, 2), "end": round(end, 2)})
        prev = end
    return cues, method


def _ass_timestamp(sec: float) -> str:
    s = max(0.0, float(sec))
    h = int(s // 3600)
    m = int((s % 3600) // 60)
    rem = s - h * 3600 - m * 60
    return f"{h}:{m:02d}:{rem:05.2f}"


def _escape_ass_text(text: str) -> str:
    return (
        str(text or "")
        .replace("\\", "\\\\")
        .replace("{", "\\{")
        .replace("}", "\\}")
        .replace("\n", "\\N")
    )


def write_karaoke_ass(cues: list[dict[str, Any]], dest: Path, *, title: str = "") -> Path:
    """Write an ASS file that shows one lyric line at a time."""
    header = f"""[Script Info]
Title: {title or "Verbum karaoke"}
ScriptType: v4.00+
PlayResX: {KARAOKE_WIDTH}
PlayResY: {KARAOKE_HEIGHT}
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Karaoke,Arial,54,&H00FFFFFF,&H000000FF,&H00101010,&H80000000,-1,0,0,0,100,100,0,0,1,3,0,2,60,60,72,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    events: list[str] = []
    for cue in cues:
        text = _escape_ass_text(str(cue.get("text") or ""))
        if not text:
            continue
        start = _ass_timestamp(float(cue.get("start") or 0))
        end = _ass_timestamp(float(cue.get("end") or 0))
        events.append(f"Dialogue: 0,{start},{end},Karaoke,,0,0,0,,{text}")
    dest.write_text(header + "\n".join(events) + "\n", encoding="utf-8")
    return dest


def render_karaoke_mp4(
    *,
    audio_path: Path,
    ass_path: Path,
    dest_path: Path,
    duration_sec: float,
    progress_cb: Optional[ProgressCb] = None,
) -> Path:
    ffmpeg = shutil.which("ffmpeg")
    if not ffmpeg:
        raise RuntimeError("ffmpeg is not installed on this server.")
    dest_path.parent.mkdir(parents=True, exist_ok=True)
    if progress_cb:
        progress_cb(88, "rendering")
    # Escape ASS path for ffmpeg filter (Windows-safe-ish + colon escaping).
    ass_escaped = str(ass_path).replace("\\", "/").replace(":", "\\:").replace("'", "\\'")
    vf = f"ass='{ass_escaped}'"
    cmd = [
        ffmpeg,
        "-y",
        "-f",
        "lavfi",
        "-i",
        f"color=c=0x0B1220:s={KARAOKE_WIDTH}x{KARAOKE_HEIGHT}:d={max(1.0, duration_sec):.2f}",
        "-i",
        str(audio_path),
        "-vf",
        vf,
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-crf",
        "23",
        "-pix_fmt",
        "yuv420p",
        "-c:a",
        "aac",
        "-b:a",
        "192k",
        "-shortest",
        "-movflags",
        "+faststart",
        str(dest_path),
    ]
    proc = _run(cmd, timeout=600)
    if proc.returncode != 0 or not dest_path.is_file() or dest_path.stat().st_size < 1000:
        err = (proc.stderr or proc.stdout or "ffmpeg failed").strip()
        raise RuntimeError(err.splitlines()[-1][:240] if err else "Could not render karaoke video.")
    if progress_cb:
        progress_cb(96, "saving")
    return dest_path


def _encode_aac(ffmpeg: str, src: Path, dest: Path) -> bool:
    proc = _run(
        [
            ffmpeg,
            "-y",
            "-i",
            str(src),
            "-ac",
            "2",
            "-ar",
            "44100",
            "-c:a",
            "aac",
            "-b:a",
            "192k",
            str(dest),
        ],
        timeout=180,
    )
    return proc.returncode == 0 and dest.is_file() and dest.stat().st_size > 400


def _ensure_stereo_wav(audio_path: Path, dest_wav: Path) -> Path:
    """Normalize any source to stereo 44.1k WAV so vocal filters always see L/R."""
    ffmpeg = shutil.which("ffmpeg")
    if not ffmpeg:
        raise RuntimeError("ffmpeg is not installed on this server.")
    proc = _run(
        [
            ffmpeg,
            "-y",
            "-i",
            str(audio_path),
            "-ac",
            "2",
            "-ar",
            "44100",
            "-c:a",
            "pcm_s16le",
            str(dest_wav),
        ],
        timeout=180,
    )
    if proc.returncode != 0 or not dest_wav.is_file() or dest_wav.stat().st_size < 400:
        err = (proc.stderr or proc.stdout or "ffmpeg failed").strip()
        raise RuntimeError(err.splitlines()[-1][:240] if err else "Could not prepare stereo audio.")
    return dest_wav


def _remove_vocals(
    audio_path: Path,
    dest_path: Path,
    *,
    progress_cb: Optional[ProgressCb] = None,
) -> tuple[Path, str]:
    """
    Build an instrumental bed from a vocal mix.

    Prefers Demucs when installed; otherwise tries several ffmpeg mid/side
    karaoke filters. Never raises — falls back to the original mix.
    """
    def report(pct: int) -> None:
        if progress_cb:
            progress_cb(pct, "vocals")

    report(54)
    ffmpeg = shutil.which("ffmpeg")
    if not ffmpeg:
        raise RuntimeError("ffmpeg is not installed on this server.")

    work_dir = dest_path.parent
    stereo_wav = work_dir / "vocal_stereo.wav"
    try:
        _ensure_stereo_wav(audio_path, stereo_wav)
    except Exception:
        logger.info("Could not prepare stereo wav for vocal removal; copying original.", exc_info=True)
        shutil.copy2(audio_path, dest_path)
        report(62)
        return dest_path, "original"

    # Optional Demucs (heavy; only if already installed). Cap wait so jobs cannot hang here.
    demucs_bin = shutil.which("demucs")
    if demucs_bin:
        out_root = work_dir / "demucs_out"
        try:
            proc = _run(
                [
                    demucs_bin,
                    "--two-stems=vocals",
                    "-n",
                    "htdemucs",
                    "-o",
                    str(out_root),
                    str(stereo_wav),
                ],
                timeout=420,
            )
            if proc.returncode == 0:
                no_vocal = list(out_root.rglob("no_vocals.wav")) + list(out_root.rglob("no_vocals.mp3"))
                if no_vocal and _encode_aac(ffmpeg, no_vocal[0], dest_path):
                    report(62)
                    return dest_path, "demucs"
        except subprocess.TimeoutExpired:
            logger.warning("Demucs vocal removal timed out; falling back to ffmpeg.")
        except Exception:
            logger.info("Demucs vocal removal failed; falling back to ffmpeg.", exc_info=True)

    # Mid/side karaoke filters (center cancel). Order: stronger side-only first.
    filters = [
        ("ffmpeg_side", "pan=stereo|c0=c0-c1|c1=c1-c0,volume=1.6"),
        ("ffmpeg_center", "pan=stereo|c0=0.5*c0-0.5*c1|c1=0.5*c1-0.5*c0,volume=1.5"),
        ("ffmpeg_extrastereo", "extrastereo=m=2.5,volume=1.2"),
    ]
    bed_wav = work_dir / "bed.wav"
    for name, af in filters:
        try:
            if bed_wav.exists():
                bed_wav.unlink(missing_ok=True)
            if dest_path.exists():
                dest_path.unlink(missing_ok=True)
            proc = _run(
                [
                    ffmpeg,
                    "-y",
                    "-i",
                    str(stereo_wav),
                    "-af",
                    af,
                    "-ac",
                    "2",
                    "-ar",
                    "44100",
                    "-c:a",
                    "pcm_s16le",
                    str(bed_wav),
                ],
                timeout=180,
            )
            if proc.returncode != 0 or not bed_wav.is_file() or bed_wav.stat().st_size < 400:
                continue
            if _encode_aac(ffmpeg, bed_wav, dest_path):
                report(62)
                return dest_path, name
        except subprocess.TimeoutExpired:
            logger.warning("ffmpeg vocal filter timed out (%s)", name)
        except Exception:
            logger.info("ffmpeg vocal filter failed (%s)", name, exc_info=True)

    logger.warning("Vocal removal failed; using original mix as karaoke bed.")
    try:
        if not _encode_aac(ffmpeg, stereo_wav, dest_path):
            shutil.copy2(audio_path, dest_path)
    except Exception:
        shutil.copy2(audio_path, dest_path)
    report(62)
    return dest_path, "original"


def build_karaoke_instrumental(
    *,
    youtube_url: str = "",
    lyrics: str,
    title: str = "",
    dest_path: Path,
    source_video_path: Path | None = None,
    bed_video_path: Path | None = None,
    progress_cb: Optional[ProgressCb] = None,
) -> dict[str, Any]:
    """
    Karaoke path:
      sung audio → Whisper timing (library lyrics) → instrumental bed → lyric video.

    Prefer a linked instrumental MP4 as the bed when available. Otherwise strip
    vocals from the sung mix (ffmpeg center-cancel / Demucs). Uses audio-only
    YouTube download for the sung source (avoids flaky full-video formats).
    """
    def report(pct: int, stage: str) -> None:
        if progress_cb:
            progress_cb(max(0, min(100, int(pct))), stage)

    source_video = Path(source_video_path) if source_video_path else None
    if source_video and (not source_video.is_file() or source_video.stat().st_size < 1000):
        source_video = None
    bed_video = Path(bed_video_path) if bed_video_path else None
    if bed_video and (not bed_video.is_file() or bed_video.stat().st_size < 1000):
        bed_video = None
    # Never use the same file as both sung source and instrumental bed.
    if source_video and bed_video and source_video.resolve() == bed_video.resolve():
        if str(bed_video.name).lower().startswith("instrumental_"):
            source_video = None
        else:
            bed_video = None

    video_id = parse_youtube_video_id(youtube_url) if youtube_url else ""
    if not video_id and source_video:
        stem = source_video.stem
        m = re.search(r"([A-Za-z0-9_-]{6,})$", stem)
        video_id = m.group(1) if m else stem[:32]
    if not video_id and not source_video:
        raise RuntimeError("Paste a sung YouTube URL (with vocals), or link a downloaded vocal video first.")

    lines = lyric_display_lines(lyrics)
    if not lines:
        raise RuntimeError("Add lyrics to this song in the library before making a karaoke video.")

    watch_url = ("https://www.youtube.com/watch?v=" + video_id) if parse_youtube_video_id(youtube_url or "") else ""
    dest_path.parent.mkdir(parents=True, exist_ok=True)
    report(4, "starting")

    duration = 0.0
    cues: list[dict[str, Any]] = []
    method = "even"
    vocal_method = "none"
    reused_local = False

    with tempfile.TemporaryDirectory(prefix="verbum_karaoke_") as tmp:
        tmp_dir = Path(tmp)

        def on_download(pct: int, _stage: str) -> None:
            report(8 + int(pct * 0.32), "download")

        # 1) Sung mix for Whisper — prefer local file; else audio-only YouTube (not full MP4).
        if source_video is not None:
            reused_local = True
            report(10, "extract")
            vocal_audio = _extract_audio_track(source_video, tmp_dir / "vocal.m4a")
            report(36, "extract")
        else:
            report(8, "download")
            vocal_audio = _download_audio(
                watch_url or youtube_url, tmp_dir, progress_cb=on_download
            )

        duration = _ffprobe_duration(vocal_audio)
        if duration < 5:
            raise RuntimeError("Downloaded audio is too short to build a karaoke video.")

        # 2) Time library lyrics against the sung mix.
        report(40, "aligning")
        whisper_segments = transcribe_audio_segments(vocal_audio)
        cues, method = align_lyric_lines(
            lines, duration_sec=duration, whisper_segments=whisper_segments
        )

        # 3) Instrumental bed: linked instrumental video preferred, else strip vocals.
        report(54, "vocals")
        bed_path = tmp_dir / "bed.m4a"
        if bed_video is not None:
            try:
                bed_path = _extract_audio_track(bed_video, bed_path)
                vocal_method = "linked_instrumental"
                report(62, "vocals")
            except Exception:
                logger.info("Could not extract linked instrumental bed; stripping vocals.", exc_info=True)
                bed_path, vocal_method = _remove_vocals(
                    vocal_audio, bed_path, progress_cb=lambda pct, _s: report(pct, "vocals")
                )
        else:
            bed_path, vocal_method = _remove_vocals(
                vocal_audio, bed_path, progress_cb=lambda pct, _s: report(pct, "vocals")
            )

        bed_dur = _ffprobe_duration(bed_path)
        if bed_dur >= 5:
            # Keep lyric timeline on the sung length; trim/pad bed via -shortest at render.
            duration = max(duration, min(bed_dur, duration + 2.0))

        # 4) Render one-line-at-a-time lyric video on the instrumental bed.
        ass_path = tmp_dir / "lyrics.ass"
        write_karaoke_ass(cues, ass_path, title=title or "Karaoke")
        report(78, "rendering")
        render_karaoke_mp4(
            audio_path=bed_path,
            ass_path=ass_path,
            dest_path=dest_path,
            duration_sec=duration,
            progress_cb=lambda pct, stage: report(pct, stage),
        )

    return {
        "youtube_id": video_id,
        "youtube_url": watch_url or str(youtube_url or ""),
        "basename": dest_path.name,
        "bytes": dest_path.stat().st_size if dest_path.is_file() else 0,
        "duration_sec": round(duration, 2),
        "line_count": len(cues),
        "method": method,
        "vocal_removal": vocal_method,
        "reused_local_video": reused_local,
        "cues": cues,
    }
