"""
Church Media Generator — minimal web UI + JSON API.

Run from project root:
  cd church_media_generator && uvicorn server:app --reload --host 127.0.0.1 --port 8000
"""

from __future__ import annotations

import io
import os
import re
import shutil
import subprocess
import uuid
import zipfile
from pathlib import Path
from typing import Any, Optional

from dotenv import load_dotenv
from fastapi import FastAPI, File, HTTPException, Request, UploadFile
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel, Field

load_dotenv()

from pipeline import (
    GenerationResult,
    PreviewPayload,
    fetch_preview,
    generate_mass_media,
    refresh_all_song_sections,
    refresh_song_section,
)
from services.community_config import (
    LOGO_RELATIVE,
    get_community_name,
    logo_file_absolute,
    update_community,
    uploads_dir,
)
from services.hymn_library import get_hymn
from services.lyrics_fetcher import fetch_and_store_for_selection
from services.ppt_preview_render import render_ppt_preview_pngs
from services.ppt_template_analyze import analyze_pptx_theme
from services.song_catalog import (
    catalog_for_api,
    delete_catalog_song,
    import_song_rows,
    import_titles,
    save_lyrics_song,
    update_catalog_song,
)

# Optional outputs produced alongside mass_poster.png (Phase 3)
_BUNDLE_OPTIONAL = (
    "gospel_moment.png",
    "mass_poster_16x9.png",
    "mass_poster_instagram_square.png",
    "mass_poster_instagram_story.png",
    "mass_poster_open_graph.png",
)

_PROJECT = Path(__file__).resolve().parent
_OUTPUT_DIR = _PROJECT / "outputs"
_OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
_PREVIEW_DIR = _OUTPUT_DIR / "preview_slides"
_PREVIEW_DIR.mkdir(parents=True, exist_ok=True)

_UPLOAD_DIR = uploads_dir()
_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
_MASS_ASSET_DIR = _UPLOAD_DIR / "mass_assets"
_MASS_ASSET_DIR.mkdir(parents=True, exist_ok=True)
_SAVED_POSTER_DIR = _UPLOAD_DIR / "saved_posters"
_SAVED_POSTER_DIR.mkdir(parents=True, exist_ok=True)

_ALLOWED_LOGO_TYPES = frozenset(
    ("image/png", "image/jpeg", "image/webp", "image/gif", "image/x-png", "image/jpg")
)
_MAX_LOGO_BYTES = 2_500_000
_MAX_ASSET_BYTES = 8_000_000
_ALLOWED_IMAGE_TYPES = _ALLOWED_LOGO_TYPES

_BUNDLE_NAME = "mass_bundle.zip"


def _resolve_child_file(parent: Path, basename: str) -> Optional[Path]:
    base = Path(basename or "").name
    if not base or base != basename.strip():
        return None
    cand = (parent / base).resolve()
    try:
        cand.relative_to(parent.resolve())
    except ValueError:
        return None
    return cand if cand.is_file() else None


async def _save_uploaded_image(file: UploadFile, dest_dir: Path, *, prefix: str) -> str:
    ctype = (file.content_type or "").split(";")[0].strip().lower()
    if ctype not in _ALLOWED_IMAGE_TYPES:
        raise HTTPException(status_code=400, detail="Use a PNG, JPEG, WebP, or GIF image.")
    raw = await file.read()
    if len(raw) > _MAX_ASSET_BYTES:
        raise HTTPException(status_code=400, detail="Image too large (max about 8 MB).")
    dest_dir.mkdir(parents=True, exist_ok=True)
    orig = Path(file.filename or "upload").name
    ext = Path(orig).suffix.lower()
    if ext not in {".png", ".jpg", ".jpeg", ".webp", ".gif"}:
        ext = ".png"
    name = f"{prefix}_{uuid.uuid4().hex}{ext}"
    out = dest_dir / name
    out.write_bytes(raw)
    return name


def _ai_poster_download_urls() -> dict[str, str]:
    """Stable URLs under ``/media/posters/`` for Hugging Face layout exports."""
    base = _OUTPUT_DIR / "posters"
    out: dict[str, str] = {}
    mapping = {
        "instagram": "mass_poster_instagram.png",
        "story": "mass_poster_story.png",
        "facebook": "mass_poster_facebook.png",
    }
    for key, fname in mapping.items():
        p = base / fname
        if p.is_file():
            out[key] = f"/media/posters/{fname}"
    return out


def _latest_pptx_path() -> Optional[Path]:
    """Most recently modified deck in ``outputs/`` (supports stem-based filenames)."""
    cands = [p for p in _OUTPUT_DIR.glob("*.pptx") if p.is_file()]
    if not cands:
        return None
    return max(cands, key=lambda p: p.stat().st_mtime)


def _write_mass_bundle_zip(result: GenerationResult) -> None:
    """Pack generated PPT, posters, stem-based social PNGs, gospel art, and optional extras."""
    out = _OUTPUT_DIR / _BUNDLE_NAME
    entries: list[tuple[Path, str]] = []
    for attr in ("pptx_path", "poster_path", "poster_ppt_path"):
        p = getattr(result, attr, None)
        if p and Path(p).is_file():
            pp = Path(p)
            entries.append((pp, pp.name))
    if result.poster_path:
        parent = Path(result.poster_path).parent
        stem = Path(result.poster_path).stem
        for child in sorted(parent.glob(f"{stem}_*.png")):
            if child.is_file() and all(o[0] != child for o in entries):
                entries.append((child, child.name))
    if result.export_stem:
        g = _OUTPUT_DIR / f"{result.export_stem}_gospel_moment.png"
        if g.is_file() and all(o[0] != g for o in entries):
            entries.append((g, g.name))
    post_dir = _OUTPUT_DIR / "posters"
    if post_dir.is_dir():
        for child in sorted(post_dir.glob("*.png")):
            if child.is_file() and all(o[0] != child for o in entries):
                entries.append((child, f"posters/{child.name}"))
    for name in _BUNDLE_OPTIONAL:
        p = _OUTPUT_DIR / name
        if p.is_file() and all(o[0] != p for o in entries):
            entries.append((p, name))
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as zf:
        for path, arc in entries:
            zf.write(path, arcname=arc)


app = FastAPI(title="Verbum · LiturgyFlow")
templates = Jinja2Templates(directory=str(_PROJECT / "templates"))
_STATIC_DIR = _PROJECT / "static"
_STATIC_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/static", StaticFiles(directory=str(_STATIC_DIR)), name="static")
app.mount("/media", StaticFiles(directory=str(_OUTPUT_DIR)), name="media")
app.mount("/uploads", StaticFiles(directory=str(_UPLOAD_DIR)), name="uploads")
app.mount("/preview", StaticFiles(directory=str(_PREVIEW_DIR)), name="preview")


def _preview_to_json(p: PreviewPayload) -> dict[str, Any]:
    lc = p.liturgical_color
    liturgical: Optional[dict[str, Any]] = None
    if lc:
        liturgical = {
            "color_name": lc.get("color_name"),
            "hex": lc.get("hex"),
            "season": lc.get("season"),
            "rgb": list(lc.get("rgb", ())),
        }
    return {
        "ok": p.ok,
        "error": p.error,
        "title": p.title,
        "gospel_reference": p.gospel_reference,
        "season": p.season,
        "lectionary_cycle": p.lectionary_cycle,
        "liturgical_color": liturgical,
        "gospel_text_length": p.gospel_text_length,
        "sentences": p.sentences,
        "sentence_count": len(p.sentences),
        "quote_attribution": p.quote_attribution,
        "songs_by_section": p.songs_by_section,
        "gospel_quote": p.gospel_quote,
        "default_song_selections": p.default_song_selections,
        "estimated_slide_count": p.estimated_slide_count,
        "first_reading_reference": p.first_reading_reference,
        "first_reading_excerpt": p.first_reading_excerpt,
        "second_reading_reference": p.second_reading_reference,
        "second_reading_excerpt": p.second_reading_excerpt,
        "psalm_text": p.psalm_text,
        "gospel_text": p.gospel_text,
    }


class SongSelection(BaseModel):
    entrance: Optional[str] = None
    offertory: Optional[str] = None
    communion_1: Optional[str] = None
    communion_2: Optional[str] = None
    recessional: Optional[str] = None
    meditation: Optional[str] = None


class CommunityNameBody(BaseModel):
    community_name: str = Field(..., min_length=1, max_length=240)


class PreviewBody(BaseModel):
    date: str = Field(..., min_length=8, description="YYYY-MM-DD")


class GenerateBody(BaseModel):
    date: str = Field(..., min_length=8)
    celebrant: str = Field(..., min_length=1, max_length=200)
    sentence_index: Optional[int] = Field(None, ge=0)
    poster_template: str = Field(
        "liturgical_color",
        description="liturgical_color | classic_white",
    )
    include_social_exports: bool = Field(True)
    include_gospel_art: bool = Field(True)
    include_ai_mass_poster: bool = Field(
        False,
        description="Use OpenAI gpt-image-1 for primary parish posters (requires OPENAI_API_KEY).",
    )
    ai_poster_style: str = Field(
        "cinematic",
        max_length=64,
        description="OpenAI hero art style key from data/styles.json (5 presets).",
    )
    community_name: Optional[str] = Field(None, max_length=240)
    songs: Optional[SongSelection] = None
    custom_theme: Optional[dict[str, Any]] = None
    divider_poster_basename: Optional[str] = Field(
        None,
        max_length=200,
        description="Basename of a file previously uploaded to mass_assets/.",
    )
    announcement_basenames: list[str] = Field(default_factory=list)
    mass_collection_amount: Optional[str] = Field(None, max_length=120)
    mass_collection_date_label: Optional[str] = Field(None, max_length=240)
    food_sponsors: list[str] = Field(default_factory=list)
    psalm_text_override: Optional[str] = Field(None, max_length=12000)
    gospel_quote_override: Optional[str] = Field(
        None,
        max_length=2000,
        description="Exact Gospel line for slides; overrides sentence_index when non-empty.",
    )


class RefreshSongsBody(BaseModel):
    date: str = Field(..., min_length=8, description="YYYY-MM-DD")
    section: str = Field(..., min_length=3, max_length=40)
    current_ids: list[str] = Field(default_factory=list)


class RefreshAllSongsBody(BaseModel):
    date: str = Field(..., min_length=8, description="YYYY-MM-DD")
    current_ids: dict[str, list[str]] = Field(default_factory=dict)


class ImportSongsBody(BaseModel):
    entrance: list[str] = Field(default_factory=list)
    offertory: list[str] = Field(default_factory=list)
    communion: list[str] = Field(default_factory=list)
    recessional: list[str] = Field(default_factory=list)


class SongRowBody(BaseModel):
    title: str = Field(..., min_length=1, max_length=240)
    language: str = Field("English", max_length=40)
    mass_part: list[str] = Field(default_factory=list)


class ImportSongRowsBody(BaseModel):
    songs: list[SongRowBody] = Field(default_factory=list)


class LyricsSelectionBody(BaseModel):
    section: str = Field(..., min_length=3, max_length=40)
    id: str = Field(..., min_length=1, max_length=160)


class FetchLyricsBody(BaseModel):
    selections: list[LyricsSelectionBody] = Field(default_factory=list)


class SaveLyricsBody(BaseModel):
    title: str = Field(..., min_length=1, max_length=240)
    lyrics: str = Field(..., min_length=1)
    sections: list[str] = Field(default_factory=list)
    language: str = Field("English", max_length=40)
    author: str = Field("", max_length=240)


class CatalogSongPatchBody(BaseModel):
    title: Optional[str] = Field(None, max_length=240)
    author: Optional[str] = Field(None, max_length=240)
    lyrics: Optional[str] = None
    language: Optional[str] = Field(None, max_length=40)


class GenerateImageBody(BaseModel):
    prompt: str = Field(..., min_length=1, max_length=4000)


class GenerateImageResponse(BaseModel):
    image: str
    path: str


def _resolve_soffice_bin() -> Optional[str]:
    custom = shutil.which("soffice")
    if custom:
        return custom
    mac_bin = "/Applications/LibreOffice.app/Contents/MacOS/soffice"
    if Path(mac_bin).is_file():
        return mac_bin
    return None


def _extract_ppt_text_slides(ppt: Path) -> list[dict[str, Any]]:
    try:
        from pptx import Presentation
    except ImportError:
        return []
    prs = Presentation(str(ppt))
    slides: list[dict[str, Any]] = []
    for idx, slide in enumerate(prs.slides):
        lines: list[str] = []
        for shape in slide.shapes:
            if getattr(shape, "has_text_frame", False):
                txt = (shape.text or "").strip()
                if txt:
                    lines.append(txt)
        slides.append({"index": idx + 1, "text": "\n\n".join(lines)[:2000]})
    return slides


@app.post("/api/ppt-preview/refresh")
def api_ppt_preview_refresh() -> dict[str, Any]:
    """Render PPT slides to PNG images for in-app visual preview."""
    ppt = _latest_pptx_path()
    if not ppt or not ppt.is_file():
        return {"ok": True, "mode": "text", "slides": [], "message": "Generate deck first."}
    soffice = _resolve_soffice_bin()
    if not soffice:
        return {
            "ok": True,
            "mode": "text",
            "slides": _extract_ppt_text_slides(ppt),
            "message": "Install LibreOffice for exact image preview. Showing text fallback.",
        }

    for p in _PREVIEW_DIR.glob("*"):
        if p.is_file():
            p.unlink(missing_ok=True)

    png_paths, pdf_msg = render_ppt_preview_pngs(ppt, _PREVIEW_DIR, soffice_bin=soffice)
    if not png_paths:
        return {
            "ok": True,
            "mode": "text",
            "slides": _extract_ppt_text_slides(ppt),
            "message": (pdf_msg or "Could not render slide images.") + " Showing text fallback.",
        }

    ts = int(png_paths[0].stat().st_mtime) if png_paths else 0
    slides = [
        {
            "index": i + 1,
            "image_url": f"/preview/{f.name}?t={ts}&v={i}",
        }
        for i, f in enumerate(png_paths)
    ]
    msg = pdf_msg or ""
    if not msg.strip():
        msg = "Full-deck preview (PDF rasterization)."
    return {"ok": True, "mode": "image", "slides": slides, "message": msg}


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/generate-image", response_model=GenerateImageResponse)
def generate_image(body: GenerateImageBody) -> GenerateImageResponse:
    import base64

    from generators.ai_image_generator import generate_openai_poster

    if not (os.getenv("OPENAI_API_KEY") or "").strip():
        raise HTTPException(status_code=503, detail="OPENAI_API_KEY is not configured.")

    prompt = body.prompt.strip()
    if not prompt:
        raise HTTPException(status_code=400, detail="prompt is required.")

    poster_path = _OUTPUT_DIR / "poster.png"
    try:
        saved = generate_openai_poster(prompt, output_path=poster_path)
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Image generation failed: {exc}") from exc

    raw = saved.read_bytes()
    return GenerateImageResponse(
        image=base64.b64encode(raw).decode("ascii"),
        path=str(saved),
    )


@app.get("/api/community")
def api_community() -> dict[str, Any]:
    logo_exists = logo_file_absolute().is_file()
    return {
        "community_name": get_community_name(),
        "logo_url": "/uploads/community_logo.png" if logo_exists else None,
    }


@app.post("/api/community")
def api_set_community_name(body: CommunityNameBody) -> dict[str, Any]:
    update_community(community_name=body.community_name.strip())
    return {"ok": True, "community_name": get_community_name()}


@app.post("/api/upload-logo")
async def api_upload_logo(file: UploadFile = File(...)) -> dict[str, Any]:
    ctype = (file.content_type or "").split(";")[0].strip().lower()
    if ctype not in _ALLOWED_LOGO_TYPES:
        raise HTTPException(
            status_code=400,
            detail="Use a PNG, JPEG, WebP, or GIF image.",
        )
    raw = await file.read()
    if len(raw) > _MAX_LOGO_BYTES:
        raise HTTPException(status_code=400, detail="Image must be at most about 2.5 MB.")

    try:
        from PIL import Image
    except ImportError as exc:
        raise HTTPException(status_code=500, detail="Pillow is required for image upload.") from exc

    try:
        im = Image.open(io.BytesIO(raw))
        im.load()
    except OSError as exc:
        raise HTTPException(status_code=400, detail="Could not read image file.") from exc

    if im.mode in ("RGBA", "LA") or (im.mode == "P" and "transparency" in getattr(im, "info", {})):
        im = im.convert("RGBA")
    else:
        im = im.convert("RGB")

    _UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    out_path = logo_file_absolute()
    im.save(out_path, format="PNG", optimize=True)

    update_community(logo_path=LOGO_RELATIVE)
    return {
        "ok": True,
        "logo_url": "/uploads/community_logo.png",
        "message": "Logo saved. It will appear on the next generated poster.",
    }


@app.post("/api/upload/mass-divider")
async def api_upload_mass_divider(file: UploadFile = File(...)) -> dict[str, Any]:
    name = await _save_uploaded_image(file, _MASS_ASSET_DIR, prefix="divider")
    return {"ok": True, "basename": name, "url": f"/uploads/mass_assets/{name}"}


@app.post("/api/upload/announcement-slide")
async def api_upload_announcement_slide(file: UploadFile = File(...)) -> dict[str, Any]:
    name = await _save_uploaded_image(file, _MASS_ASSET_DIR, prefix="announce")
    return {"ok": True, "basename": name, "url": f"/uploads/mass_assets/{name}"}


@app.post("/api/upload/saved-poster")
async def api_upload_saved_poster(file: UploadFile = File(...)) -> dict[str, Any]:
    name = await _save_uploaded_image(file, _SAVED_POSTER_DIR, prefix="poster")
    return {"ok": True, "basename": name, "url": f"/uploads/saved_posters/{name}"}


@app.get("/api/saved-posters")
def api_list_saved_posters() -> dict[str, Any]:
    if not _SAVED_POSTER_DIR.is_dir():
        return {"ok": True, "posters": []}
    rows = []
    for p in sorted(_SAVED_POSTER_DIR.iterdir(), key=lambda x: x.stat().st_mtime, reverse=True):
        if p.is_file() and p.suffix.lower() in {".png", ".jpg", ".jpeg", ".webp", ".gif"}:
            rows.append({"basename": p.name, "url": f"/uploads/saved_posters/{p.name}"})
    return {"ok": True, "posters": rows}


@app.delete("/api/saved-posters/{basename}")
def api_delete_saved_poster(basename: str) -> dict[str, Any]:
    p = _resolve_child_file(_SAVED_POSTER_DIR, basename)
    if not p:
        raise HTTPException(status_code=404, detail="Poster not found.")
    p.unlink(missing_ok=True)
    return {"ok": True}


@app.get("/api/catalog/songs")
def api_catalog_songs() -> dict[str, Any]:
    return {"ok": True, "catalog": catalog_for_api()}


@app.get("/api/catalog/songs/{section}/{hymn_id:path}")
def api_get_catalog_song(section: str, hymn_id: str) -> dict[str, Any]:
    row = get_hymn(section.strip().lower(), hymn_id)
    if not row:
        raise HTTPException(status_code=404, detail="Song not found.")
    return {
        "ok": True,
        "section": section.strip().lower(),
        "song": {
            "id": str(row.get("id") or ""),
            "title": str(row.get("title") or ""),
            "author": str(row.get("author") or ""),
            "language": str(row.get("language") or "English"),
            "lyrics": str(row.get("lyrics") or ""),
        },
    }


@app.patch("/api/catalog/songs/{section}/{hymn_id:path}")
def api_patch_catalog_song(section: str, hymn_id: str, body: CatalogSongPatchBody) -> dict[str, Any]:
    res = update_catalog_song(
        section=section,
        hymn_id=hymn_id,
        title=body.title,
        author=body.author,
        lyrics=body.lyrics,
        language=body.language,
    )
    if not res.get("ok"):
        raise HTTPException(status_code=400, detail=res.get("error") or "Update failed.")
    return res


@app.delete("/api/catalog/songs/{section}/{hymn_id:path}")
def api_delete_catalog_song(section: str, hymn_id: str) -> dict[str, Any]:
    res = delete_catalog_song(section=section, hymn_id=hymn_id)
    if not res.get("ok"):
        raise HTTPException(status_code=400, detail=res.get("error") or "Delete failed.")
    return res


@app.post("/api/design/analyze-template")
async def api_design_analyze_template(file: UploadFile = File(...)) -> dict[str, Any]:
    ctype = (file.content_type or "").split(";")[0].strip().lower()
    if ctype not in {
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "application/octet-stream",
    } and not (file.filename or "").lower().endswith(".pptx"):
        raise HTTPException(status_code=400, detail="Upload a .pptx file.")
    raw = await file.read()
    if len(raw) > 25_000_000:
        raise HTTPException(status_code=400, detail="Presentation too large.")
    tmp = _UPLOAD_DIR / f"_analyze_{uuid.uuid4().hex}.pptx"
    try:
        tmp.write_bytes(raw)
        result = analyze_pptx_theme(tmp)
    finally:
        tmp.unlink(missing_ok=True)
    if not result.get("ok"):
        raise HTTPException(status_code=400, detail=result.get("error") or "Analysis failed.")
    return result


@app.get("/", response_class=HTMLResponse)
def index(request: Request) -> Any:
    # Starlette 0.28+: (request, name, context); request is injected into the template context.
    return templates.TemplateResponse(
        request,
        "index.html",
        {"title": "Verbum · LiturgyFlow"},
    )


@app.get("/home", response_class=HTMLResponse)
@app.get("/mass/builder", response_class=HTMLResponse)
@app.get("/mass/calendar", response_class=HTMLResponse)
@app.get("/media/posters", response_class=HTMLResponse)
@app.get("/media/presentation", response_class=HTMLResponse)
@app.get("/media/history", response_class=HTMLResponse)
@app.get("/library/songs", response_class=HTMLResponse)
@app.get("/library/collections", response_class=HTMLResponse)
@app.get("/design/theme-lab", response_class=HTMLResponse)
@app.get("/design/templates", response_class=HTMLResponse)
@app.get("/settings/church", response_class=HTMLResponse)
@app.get("/settings/app", response_class=HTMLResponse)
@app.get("/lyrics-dashboard", response_class=HTMLResponse)
@app.get("/theme-dashboard", response_class=HTMLResponse)
@app.get("/mass-flow-dashboard", response_class=HTMLResponse)
def dashboard(request: Request) -> Any:
    return templates.TemplateResponse(
        request,
        "index.html",
        {"title": "Verbum · LiturgyFlow"},
    )


@app.post("/api/preview")
def api_preview(body: PreviewBody) -> Any:
    p = fetch_preview(body.date.strip())
    return _preview_to_json(p)


@app.post("/api/generate")
def api_generate(body: GenerateBody) -> Any:
    song_map = body.songs.model_dump(exclude_none=True) if body.songs else None
    divider_path = None
    if body.divider_poster_basename and str(body.divider_poster_basename).strip():
        divider_path = _resolve_child_file(_MASS_ASSET_DIR, str(body.divider_poster_basename).strip())
    ann_paths: list[Path] = []
    for raw in body.announcement_basenames or []:
        bn = str(raw).strip()
        if not bn:
            continue
        p = _resolve_child_file(_MASS_ASSET_DIR, bn)
        if p:
            ann_paths.append(p)
        if len(ann_paths) >= 24:
            break
    sponsors = [str(s).strip() for s in (body.food_sponsors or []) if str(s).strip()][:24]
    psalm_override = (body.psalm_text_override or "").strip() or None
    gospel_override = (body.gospel_quote_override or "").strip() or None
    result = generate_mass_media(
        body.date.strip(),
        body.celebrant.strip(),
        sentence_index=body.sentence_index,
        poster_template=body.poster_template,
        include_social_exports=body.include_social_exports,
        include_gospel_art=body.include_gospel_art,
        include_ai_mass_poster=body.include_ai_mass_poster,
        ai_poster_style=body.ai_poster_style.strip() or "cinematic",
        community_name=body.community_name.strip() if body.community_name else None,
        song_selections=song_map,
        custom_theme=body.custom_theme,
        divider_poster_path=divider_path,
        announcement_image_paths=ann_paths or None,
        mass_collection_amount=body.mass_collection_amount.strip() if body.mass_collection_amount else None,
        mass_collection_date_label=body.mass_collection_date_label.strip()
        if body.mass_collection_date_label
        else None,
        food_sponsors=sponsors or None,
        psalm_text_override=psalm_override,
        gospel_quote_override=gospel_override,
    )
    if not result.ok:
        raise HTTPException(status_code=400, detail=result.error or "Generation failed.")
    _write_mass_bundle_zip(result)
    zip_ready = (_OUTPUT_DIR / _BUNDLE_NAME).is_file()
    lc = result.liturgical_color
    liturgical_payload: Optional[dict[str, Any]] = None
    if lc:
        liturgical_payload = {
            "color_name": lc.get("color_name"),
            "hex": lc.get("hex"),
            "season": lc.get("season"),
            "rgb": list(lc.get("rgb", ())),
        }
    poster_ppt = result.poster_ppt_path
    ppt_url = f"/media/{result.pptx_path.name}" if result.pptx_path and result.pptx_path.is_file() else None
    poster_url = f"/media/{result.poster_path.name}" if result.poster_path and result.poster_path.is_file() else None
    poster_ppt_url = (
        f"/media/{poster_ppt.name}" if poster_ppt and Path(poster_ppt).is_file() else None
    )
    payload: dict[str, Any] = {
        "ok": True,
        "title": result.title,
        "gospel_reference": result.gospel_reference,
        "slide_excerpt": result.slide_line_preview,
        "gospel_quote": result.gospel_quote,
        "liturgical_color": liturgical_payload,
        "selected_songs": result.selected_songs,
        "slide_count": result.slide_count,
        "export_stem": result.export_stem,
    }
    if ppt_url:
        payload["pptx_url"] = ppt_url
    if poster_url:
        payload["poster_url"] = poster_url
    if poster_ppt_url:
        payload["poster_ppt_url"] = poster_ppt_url
    payload["ai_poster_urls"] = _ai_poster_download_urls()
    return {
        **payload,
        **(
            {"zip_url": f"/media/{_BUNDLE_NAME}"}
            if zip_ready
            else {}
        ),
    }


@app.post("/api/songs/refresh")
def api_refresh_songs(body: RefreshSongsBody) -> dict[str, Any]:
    sec = body.section.strip().lower()
    if sec not in {"entrance", "offertory", "communion", "recessional", "meditation"}:
        raise HTTPException(status_code=400, detail="Invalid section.")
    songs = refresh_song_section(
        date=body.date.strip(),
        section=sec,
        current_ids=[str(x) for x in (body.current_ids or [])],
        limit=10,
    )
    return {"ok": True, "section": sec, "songs": songs}


@app.post("/api/songs/refresh-all")
def api_refresh_all_songs(body: RefreshAllSongsBody) -> dict[str, Any]:
    songs = refresh_all_song_sections(
        date=body.date.strip(),
        current_ids=body.current_ids or {},
        limit=10,
    )
    return {"ok": True, "songs_by_section": songs}


@app.post("/api/songs/import")
def api_import_songs(body: ImportSongsBody) -> dict[str, Any]:
    summary = import_titles(
        {
            "entrance": body.entrance,
            "offertory": body.offertory,
            "communion": body.communion,
            "recessional": body.recessional,
        }
    )
    return {"ok": True, **summary}


@app.post("/api/songs/import-list")
def api_import_song_rows(body: ImportSongRowsBody) -> dict[str, Any]:
    summary = import_song_rows([s.model_dump() for s in body.songs])
    return {"ok": True, **summary}


@app.post("/api/songs/fetch-lyrics")
def api_fetch_lyrics(body: FetchLyricsBody) -> dict[str, Any]:
    if not body.selections:
        return {"ok": True, "updated": 0, "skipped": 0, "results": []}
    results = [fetch_and_store_for_selection({"section": s.section, "id": s.id}) for s in body.selections]
    updated = sum(1 for r in results if r.get("ok") and r.get("reason") == "fetched")
    skipped = len(results) - updated
    return {"ok": True, "updated": updated, "skipped": skipped, "results": results}


@app.post("/api/lyrics/save")
def api_save_lyrics(body: SaveLyricsBody) -> dict[str, Any]:
    result = save_lyrics_song(
        title=body.title,
        lyrics=body.lyrics,
        sections=body.sections,
        language=body.language,
        author=body.author,
    )
    if not result.get("ok"):
        raise HTTPException(status_code=400, detail=result.get("error") or "Could not save lyrics.")
    return result
