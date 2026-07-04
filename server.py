"""
Church Media Generator — minimal web UI + JSON API.

Run from project root:
  cd church_media_generator && uvicorn server:app --reload --host 127.0.0.1 --port 8000
"""

from __future__ import annotations

import io
import logging
import os
import re
import shutil
import subprocess
import tempfile
import uuid
import zipfile
from pathlib import Path
from typing import Any, Optional

from fastapi import Depends, FastAPI, File, Header, HTTPException, Request, UploadFile
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse, Response
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel, Field, model_validator

from services.env_config import load_project_dotenv

load_project_dotenv()

logger = logging.getLogger("server")

from services.calendar_month import fetch_calendar_month
from services.catholic_news import fetch_catholic_headlines
from services.catholic_radio import radio_catalog

from pipeline import (
    GenerationResult,
    PreviewPayload,
    fetch_preview,
    generate_mass_media,
    regenerate_mass_pptx,
    refresh_all_song_sections,
    refresh_song_section,
)
from services.community_config import (
    LOGO_RELATIVE,
    get_celebrant_names,
    get_community_name,
    load_community,
    logo_file_absolute,
    update_community,
    uploads_dir,
)
from services.gospel_mood import gospel_moods_for_song
from services.hymn_library import get_hymn
from services.lyrics_fetcher import fetch_and_store_for_selection
from services.ppt_preview_render import convert_pptx_to_pdf, render_ppt_preview_pngs
from services.ppt_template_analyze import analyze_pptx_theme
from services.song_catalog import (
    catalog_for_api,
    catalog_lite_response,
    delete_catalog_song,
    import_song_rows,
    import_titles,
    save_lyrics_song,
    update_catalog_song,
)
from services.auth_config import auth_enabled, invite_contact_email, supabase_enabled
from services.api_security import (
    AuthSession,
    optional_session,
    register_security_middleware,
    require_approved_membership,
    require_session_when_auth,
    require_superadmin,
)
from services.membership_config import (
    can_edit_logo,
    is_superadmin_user,
    membership_payload,
    parish_name_is_locked,
)
from services.pending_submissions import submit_pending_priest, submit_pending_song
from services.user_church_context import get_church_profile_context
from services.readings_snapshot import readings_snapshot, warm_readings_for_date
from services.image_generation_quota import (
    get_quota_status,
    reserve_daily_image_generation,
    resolve_subject,
)
from services.input_limits import public_limits
from services import input_limits as L
from services.input_validation import (
    check_hymn_layout_overrides,
    check_hymn_overrides,
    check_string_list,
)
from services.private_files import (
    media_file_url,
    media_type_for,
    preview_file_url,
    resolve_under_root,
    upload_file_url,
)
from services.storage_assets import (
    delete_user_asset,
    download_user_asset,
    list_user_assets,
    signed_asset_url,
    storage_ready,
    upload_user_asset,
)
from routes.admin import register_admin_routes
from routes.auth import register_auth_routes
from routes.parish import register_parish_routes

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


def _safe_storage_leaf(basename: str, *, folder: str) -> str:
    base = Path(basename or "").name
    if not base or base != basename.strip():
        raise HTTPException(status_code=400, detail="Invalid asset name.")
    return f"{folder.strip('/')}/{base}"


def _materialize_storage_asset(
    session: Optional[AuthSession], storage_path: str, *, suffix: str = ".png"
) -> Optional[Path]:
    if not session or not storage_ready(session.token):
        return None
    key = (storage_path or "").strip()
    if not key:
        return None
    try:
        raw = download_user_asset(access_token=session.token, path=key)
    except Exception:
        return None
    tmp = tempfile.NamedTemporaryFile(prefix="verbum_asset_", suffix=suffix, delete=False)
    tmp.write(raw)
    tmp.flush()
    tmp.close()
    return Path(tmp.name)


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
    """Private URLs for Hugging Face layout exports."""
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
            out[key] = media_file_url(f"posters/{fname}")
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
    if result.include_social_exports and result.poster_path:
        parent = Path(result.poster_path).parent
        stem = Path(result.poster_path).stem
        for child in sorted(parent.glob(f"{stem}_*.png")):
            if child.is_file() and all(o[0] != child for o in entries):
                entries.append((child, child.name))
        post_dir = _OUTPUT_DIR / "posters"
        if post_dir.is_dir():
            for child in sorted(post_dir.glob("*.png")):
                if child.is_file() and all(o[0] != child for o in entries):
                    entries.append((child, f"posters/{child.name}"))
    if result.export_stem:
        g = _OUTPUT_DIR / f"{result.export_stem}_gospel_moment.png"
        if g.is_file() and all(o[0] != g for o in entries):
            entries.append((g, g.name))
    if result.include_social_exports:
        for name in _BUNDLE_OPTIONAL:
            p = _OUTPUT_DIR / name
            if p.is_file() and all(o[0] != p for o in entries):
                entries.append((p, name))
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as zf:
        for path, arc in entries:
            zf.write(path, arcname=arc)


app = FastAPI(title="LiturgyFlow")
app.add_middleware(GZipMiddleware, minimum_size=1000)
templates = Jinja2Templates(directory=str(_PROJECT / "templates"))
_STATIC_DIR = _PROJECT / "static"
_STATIC_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/static", StaticFiles(directory=str(_STATIC_DIR)), name="static")


@app.get("/favicon.ico", include_in_schema=False)
def favicon() -> FileResponse:
    return FileResponse(
        _STATIC_DIR / "brand" / "favicon.ico",
        media_type="image/vnd.microsoft.icon",
    )

register_auth_routes(app, templates)
register_admin_routes(app)
register_parish_routes(app)
register_security_middleware(app)


@app.get("/api/files/media/{file_path:path}")
def api_serve_media_file(
    file_path: str,
    _session: Optional[AuthSession] = Depends(require_session_when_auth),
) -> FileResponse:
    path = resolve_under_root(_OUTPUT_DIR, file_path)
    return FileResponse(path, media_type=media_type_for(path), filename=path.name)


@app.get("/api/files/uploads/{file_path:path}")
def api_serve_upload_file(
    file_path: str,
    _session: Optional[AuthSession] = Depends(require_session_when_auth),
) -> FileResponse:
    path = resolve_under_root(_UPLOAD_DIR, file_path)
    return FileResponse(path, media_type=media_type_for(path), filename=path.name)


@app.get("/api/files/preview/{filename}")
def api_serve_preview_file(
    filename: str,
    _session: Optional[AuthSession] = Depends(require_session_when_auth),
) -> FileResponse:
    path = resolve_under_root(_PREVIEW_DIR, filename)
    return FileResponse(path, media_type=media_type_for(path), filename=path.name)


@app.on_event("startup")
def _bootstrap_superadmin_roles() -> None:
    if supabase_enabled():
        try:
            from services.supabase_client import bootstrap_superadmin_roles_from_env

            count = bootstrap_superadmin_roles_from_env()
            if count:
                print(f"[Verbum] Promoted {count} profile(s) to superadmin from SUPERADMIN_EMAILS.")
        except Exception as exc:
            print(f"[Verbum] Superadmin bootstrap skipped: {exc}")

    import threading
    from datetime import date, timedelta

    def _upcoming_sunday_iso() -> str:
        today = date.today()
        days = (6 - today.weekday()) % 7
        return (today + timedelta(days=days)).isoformat()

    def _warm() -> None:
        try:
            warm_readings_for_date(_upcoming_sunday_iso())
        except Exception as exc:
            print(f"[Verbum] Readings warm-up skipped: {exc}")
        try:
            from services.song_catalog import catalog_lite_response

            catalog_lite_response()
        except Exception as exc:
            print(f"[Verbum] Catalog warm-up skipped: {exc}")

    threading.Thread(target=_warm, daemon=True).start()


def _sync_church_profile_to_supabase(
    session: Optional[AuthSession],
    *,
    community_name: Optional[str] = None,
    logo_path: Optional[str] = None,
    celebrant_names: Optional[list[str]] = None,
) -> dict[str, Any]:
    if not session or not supabase_enabled():
        raise HTTPException(status_code=503, detail="Sign in is required to save church profile.")
    try:
        from services.supabase_client import upsert_church_profile
        from services.user_church_context import set_church_profile

        saved = upsert_church_profile(
            session.user.user_id,
            community_name=community_name,
            logo_path=logo_path,
            celebrant_names=celebrant_names,
            access_token=session.token,
        )
        set_church_profile(saved)
        return saved
    except HTTPException:
        raise
    except Exception as exc:
        detail = str(exc).strip() or "Could not save church profile to Supabase."
        raise HTTPException(status_code=502, detail=detail) from exc


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
        "psalm_verses": p.psalm_verses,
        "psalm_reference": p.psalm_reference,
        "psalm_refrains": p.psalm_refrains,
        "gospel_text": p.gospel_text,
        "readings_complete": p.readings_complete,
    }


class ExtraSongSection(BaseModel):
    label: str = Field(..., min_length=1, max_length=L.SECTION_LABEL)
    song_id: str = Field(..., min_length=1, max_length=L.SONG_ID)


class SongSelection(BaseModel):
    entrance: Optional[str] = None
    offertory: Optional[str] = None
    communion_1: Optional[str] = None
    communion_2: Optional[str] = None
    recessional: Optional[str] = None
    meditation: Optional[str] = None
    extra_sections: Optional[list[ExtraSongSection]] = Field(
        None,
        max_length=L.MAX_EXTRA_SONG_SECTIONS,
        description="User-added Mass song sections (custom labels) beyond the five defaults.",
    )


class CommunityNameBody(BaseModel):
    community_name: str = Field(..., min_length=1, max_length=L.CHURCH_NAME)


class CommunityProfileBody(BaseModel):
    community_name: Optional[str] = Field(None, min_length=1, max_length=L.CHURCH_NAME)
    celebrant_names: Optional[list[str]] = Field(
        None,
        max_length=L.MAX_CELEBRANTS,
        description="Saved Mass celebrant names for the in-app picker.",
    )

    @model_validator(mode="after")
    def _validate_celebrant_names(self) -> CommunityProfileBody:
        if self.celebrant_names is not None:
            self.celebrant_names = check_string_list(
                self.celebrant_names,
                field="celebrant_names",
                max_items=L.MAX_CELEBRANTS,
                item_max_len=L.CELEBRANT_NAME,
            )
        return self


class GeminiApiKeyBody(BaseModel):
    api_key: str = Field(..., min_length=8, max_length=L.API_KEY)


class PreviewBody(BaseModel):
    date: str = Field(..., min_length=8, description="YYYY-MM-DD")
    readings_only: bool = Field(
        False,
        description="Skip hymn recommendations and web hymn discovery for faster readings-only UI.",
    )
    refresh: bool = Field(
        False,
        description="Bypass in-memory cache and retry live lectionary fetch.",
    )


class GenerateBody(BaseModel):
    date: str = Field(..., min_length=8)
    celebrant: str = Field(..., min_length=1, max_length=L.CELEBRANT_NAME)
    co_celebrant: str = Field(
        "",
        max_length=L.CELEBRANT_NAME,
        description="Optional co-celebrant name shown on the Mass divider; omitted when blank.",
    )
    sentence_index: Optional[int] = Field(None, ge=0)
    poster_template: str = Field(
        "liturgical_color",
        description="liturgical_color | classic_white",
    )
    include_social_exports: bool = Field(
        False,
        description="When true, also export 1080×1350 feed PNG and Instagram/Story/OG variants.",
    )
    export_pdf: bool = Field(
        False,
        description="When true, also export a PDF of the generated deck (served alongside the .pptx).",
    )
    include_gospel_art: bool = Field(True)
    include_ai_mass_poster: bool = Field(
        False,
        description="Use AI (OpenAI or Gemini) for primary parish posters.",
    )
    ai_poster_backend: str = Field(
        "openai",
        description="openai | gemini — which API generates the hero art when include_ai_mass_poster is true.",
    )
    ai_poster_style: str = Field(
        "cinematic",
        max_length=L.AI_POSTER_STYLE,
        description="OpenAI hero art style key from data/styles.json (5 presets).",
    )
    reuse_existing_poster: bool = Field(
        False,
        description="Reuse the cached hero art for this date+style instead of re-calling the AI image API.",
    )
    community_name: Optional[str] = Field(None, max_length=L.CHURCH_NAME)
    songs: Optional[SongSelection] = None
    custom_theme: Optional[dict[str, Any]] = None
    divider_poster_basename: Optional[str] = Field(
        None,
        max_length=L.FILE_BASENAME,
        description="Basename of a file previously uploaded to mass_assets/.",
    )
    lotw_poster: str = Field(
        "lotw1",
        max_length=16,
        description="Liturgy of the Word divider poster design: lotw1 | lotw2 | lotw3 | lotw4.",
    )
    lote_poster: str = Field(
        "lote1",
        max_length=16,
        description="Liturgy of the Eucharist divider poster design: lote1 | lote2 | lote3 | lote4.",
    )
    announcement_basenames: list[str] = Field(default_factory=list)
    mass_collection_amount: Optional[str] = Field(None, max_length=L.COLLECTION_AMOUNT)
    mass_collection_currency: Optional[str] = Field(
        "PHP",
        description="Mass collection currency: PHP | KRW | MYR",
        max_length=L.CURRENCY_CODE,
    )
    mass_collection_date_label: Optional[str] = Field(None, max_length=L.COLLECTION_DATE_LABEL)
    food_sponsors: list[str] = Field(default_factory=list)
    psalm_text_override: Optional[str] = Field(None, max_length=L.PSALM_FULL)
    psalm_refrain_index: Optional[int] = Field(None, ge=0)
    psalm_response_override: Optional[str] = Field(
        None,
        max_length=L.PSALM_REFRAIN,
        description="Manual responsorial-psalm refrain; used when psalm_text_override is empty.",
    )
    gospel_quote_override: Optional[str] = Field(
        None,
        max_length=L.GOSPEL_QUOTE,
        description="Exact Gospel line for slides; overrides sentence_index when non-empty.",
    )
    hymn_typography: Optional[dict[str, Any]] = Field(
        None,
        description="Per-section hymn slide typography: entrance, communion, default, etc.",
    )
    include_church_logo: bool = Field(
        False,
        description="When false, omit parish logo from PowerPoint slides.",
    )
    include_church_name: bool = Field(
        False,
        description="When false, omit parish / community name from PowerPoint slides.",
    )
    include_footer: bool = Field(
        True,
        description="Developer option: when false, omit the bottom community/section footer tag from every slide.",
    )
    hymn_lyric_overrides: Optional[dict[str, dict[str, str]]] = Field(
        None,
        description="Per-section hymn lyric text overrides: { entrance: { song_id: lyrics } }.",
    )
    hymn_layout_overrides: Optional[dict[str, dict[str, str]]] = Field(
        None,
        description="Per-song hymn slide layout overrides: { entrance: { song_id: 'single'|'dual' } }.",
    )
    creed_choice: str = Field(
        "nicene",
        description="Creed for the Mass deck: nicene | apostles (only one is included).",
    )
    our_father_choice: str = Field(
        "english",
        description="Our Father language: english | malay | tagalog | visaya | korean.",
    )
    hymn_lyrics_layout: str = Field(
        "single",
        description="Hymn slide layout: single (1 block/slide) | dual (2 blocks/slide).",
    )

    @model_validator(mode="after")
    def _validate_generate_lists(self) -> GenerateBody:
        self.food_sponsors = check_string_list(
            self.food_sponsors,
            field="food_sponsors",
            max_items=L.MAX_FOOD_SPONSORS,
            item_max_len=L.FOOD_SPONSOR,
        ) or []
        self.announcement_basenames = check_string_list(
            self.announcement_basenames,
            field="announcement_basenames",
            max_items=L.MAX_ANNOUNCEMENT_IMAGES,
            item_max_len=L.FILE_BASENAME,
        ) or []
        self.hymn_lyric_overrides = check_hymn_overrides(self.hymn_lyric_overrides)
        self.hymn_layout_overrides = check_hymn_layout_overrides(self.hymn_layout_overrides)
        lotw = str(self.lotw_poster or "").strip().lower()
        self.lotw_poster = lotw if lotw in {"lotw1", "lotw2", "lotw3", "lotw4"} else "lotw1"
        lote = str(self.lote_poster or "").strip().lower()
        self.lote_poster = lote if lote in {"lote1", "lote2", "lote3", "lote4"} else "lote1"
        return self


class RefreshSongsBody(BaseModel):
    date: str = Field(..., min_length=8, description="YYYY-MM-DD")
    section: str = Field(..., min_length=3, max_length=L.SECTION_KEY)
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
    title: str = Field(..., min_length=1, max_length=L.SONG_TITLE)
    language: str = Field("English", max_length=L.LANGUAGE)
    mass_part: list[str] = Field(default_factory=list)


class ImportSongRowsBody(BaseModel):
    songs: list[SongRowBody] = Field(default_factory=list, max_length=L.MAX_IMPORT_SONG_ROWS)


class LyricsSelectionBody(BaseModel):
    section: str = Field(..., min_length=3, max_length=L.SECTION_KEY)
    id: str = Field(..., min_length=1, max_length=L.SONG_ID)


class FetchLyricsBody(BaseModel):
    selections: list[LyricsSelectionBody] = Field(default_factory=list)


class SaveLyricsBody(BaseModel):
    title: str = Field(..., min_length=1, max_length=L.SONG_TITLE)
    lyrics: str = Field(..., min_length=1, max_length=L.LYRICS_FULL)
    sections: list[str] = Field(default_factory=list)
    language: str = Field("English", max_length=L.LANGUAGE)
    author: str = Field("", max_length=L.SONG_AUTHOR)


class PriestSubmissionBody(BaseModel):
    name: str = Field(..., min_length=1, max_length=L.CELEBRANT_NAME)


class CatalogSongPatchBody(BaseModel):
    title: Optional[str] = Field(None, max_length=L.SONG_TITLE)
    author: Optional[str] = Field(None, max_length=L.SONG_AUTHOR)
    lyrics: Optional[str] = Field(None, max_length=L.LYRICS_FULL)
    language: Optional[str] = Field(None, max_length=L.LANGUAGE)
    gospel_moods: Optional[list[str]] = Field(
        None,
        max_length=L.MAX_GOSPEL_MOODS,
        description="Gospel mood tags: triumphant, solemn, mercy, journey, reverent.",
    )


class GenerateImageBody(BaseModel):
    prompt: str = Field(..., min_length=1, max_length=L.AI_PROMPT)


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
def api_ppt_preview_refresh(
    _session: Optional[AuthSession] = Depends(require_approved_membership),
) -> dict[str, Any]:
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
            "image_url": preview_file_url(f.name) + f"?t={ts}&v={i}",
        }
        for i, f in enumerate(png_paths)
    ]
    msg = pdf_msg or ""
    if not msg.strip():
        msg = "Full-deck preview (PDF rasterization)."
    return {"ok": True, "mode": "image", "slides": slides, "message": msg}


@app.get("/api/input-limits")
def api_input_limits() -> dict[str, int]:
    return public_limits()


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/image-quota")
def api_image_quota(
    request: Request,
    session: Optional[AuthSession] = Depends(optional_session),
) -> dict[str, Any]:
    subject = resolve_subject(session, request)
    return get_quota_status(subject)


@app.get("/api/poster-exists")
def api_poster_exists(date: str, style: str = "cinematic") -> dict[str, bool]:
    """Report whether a cached AI hero already exists for this date + style.

    Used by the UI to offer reusing a previously generated Sunday poster
    instead of re-calling (and re-paying for) the AI image API.
    """
    from services.ai_styles import resolve_ai_image_style

    iso = (date or "").strip()
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", iso):
        return {"exists": False}
    resolved_style = resolve_ai_image_style((style or "cinematic").strip())
    hero_path = _OUTPUT_DIR / "images" / f"{iso}_{resolved_style}_hero.png"
    return {"exists": hero_path.is_file()}


def _enforce_ai_image_quota(
    session: Optional[AuthSession],
    request: Request,
    *,
    source: str,
) -> dict[str, Any]:
    subject = resolve_subject(session, request)
    return reserve_daily_image_generation(subject, source=source)


@app.post("/generate-image", response_model=GenerateImageResponse)
def generate_image(
    body: GenerateImageBody,
    request: Request,
    session: Optional[AuthSession] = Depends(require_approved_membership),
) -> GenerateImageResponse:
    import base64

    from generators.ai_image_generator import generate_openai_poster

    if not (os.getenv("OPENAI_API_KEY") or "").strip():
        raise HTTPException(status_code=503, detail="OPENAI_API_KEY is not configured.")

    prompt = body.prompt.strip()
    if not prompt:
        raise HTTPException(status_code=400, detail="prompt is required.")

    _enforce_ai_image_quota(session, request, source="generate-image")

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


def _community_api_payload(session: Optional[AuthSession] = None) -> dict[str, Any]:
    profile = load_community()
    logo_exists = logo_file_absolute().is_file()
    celebrants = profile.get("celebrant_names")
    if not isinstance(celebrants, list):
        celebrants = get_celebrant_names()
    church_ctx = get_church_profile_context()
    user = session.user if session else None
    membership = membership_payload(church_ctx, user=user)
    logo_url: Optional[str] = None
    storage_logo = str((church_ctx or {}).get("logo_path") or "").strip()
    if session and storage_ready(session.token) and storage_logo:
        try:
            logo_url = signed_asset_url(access_token=session.token, path=storage_logo)
        except Exception:
            logo_url = None
    if not logo_url and logo_exists:
        logo_url = upload_file_url("community_logo.png")
    return {
        "ok": True,
        "community_name": get_community_name(),
        "celebrant_names": celebrants,
        "logo_url": logo_url,
        **membership,
    }


@app.get("/api/community")
def api_community(
    session: Optional[AuthSession] = Depends(require_session_when_auth),
) -> dict[str, Any]:
    return _community_api_payload(session)


@app.post("/api/community")
def api_set_community_name(
    body: CommunityNameBody,
    session: Optional[AuthSession] = Depends(require_session_when_auth),
) -> dict[str, Any]:
    return api_submit_parish_name(body, session)


@app.post("/api/community/submit-parish")
def api_submit_parish_name(
    body: CommunityNameBody,
    session: Optional[AuthSession] = Depends(require_session_when_auth),
) -> dict[str, Any]:
    if not session or not supabase_enabled():
        raise HTTPException(status_code=503, detail="Sign in is required to submit parish name.")
    from services.supabase_client import submit_parish_name

    saved = submit_parish_name(
        session.user.user_id,
        body.community_name.strip(),
        access_token=session.token,
    )
    from services.user_church_context import set_church_profile

    set_church_profile(saved)
    return _community_api_payload(session)


@app.post("/api/community/profile")
def api_set_community_profile(
    body: CommunityProfileBody,
    session: Optional[AuthSession] = Depends(require_approved_membership),
) -> dict[str, Any]:
    kwargs: dict[str, Any] = {}
    church_ctx = get_church_profile_context()
    if body.community_name is not None and not parish_name_is_locked(church_ctx):
        kwargs["community_name"] = body.community_name.strip()
    if body.celebrant_names is not None:
        kwargs["celebrant_names"] = body.celebrant_names
    if not kwargs:
        raise HTTPException(status_code=400, detail="No profile fields to update.")
    if session and supabase_enabled():
        _sync_church_profile_to_supabase(
            session,
            community_name=kwargs.get("community_name"),
            celebrant_names=kwargs.get("celebrant_names"),
        )
    else:
        update_community(**kwargs)
    return _community_api_payload(session)


@app.get("/api/settings/gemini-api-key")
def api_get_gemini_api_key_status() -> dict[str, Any]:
    from services.env_config import gemini_api_key_configured, gemini_api_key_hint

    configured = gemini_api_key_configured()
    hint = gemini_api_key_hint() if configured else None
    return {"configured": configured, "key_hint": hint}


@app.post("/api/settings/gemini-api-key")
def api_save_gemini_api_key(
    body: GeminiApiKeyBody,
    _session: Optional[AuthSession] = Depends(require_superadmin),
) -> dict[str, Any]:
    from services.env_config import gemini_api_key_hint, save_gemini_api_key

    try:
        save_gemini_api_key(body.api_key.strip())
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {
        "ok": True,
        "configured": True,
        "key_hint": gemini_api_key_hint(),
        "key_format_warning": (
            None
            if body.api_key.strip().startswith("AIza")
            else (
                "This key does not look like a standard Google AI Studio key (AIza…). "
                "Image generation may fail with quota errors."
            )
        ),
    }


@app.post("/api/upload-logo")
async def api_upload_logo(
    file: UploadFile = File(...),
    session: Optional[AuthSession] = Depends(require_session_when_auth),
) -> dict[str, Any]:
    if session and supabase_enabled():
        church_ctx = get_church_profile_context()
        if not can_edit_logo(church_ctx):
            raise HTTPException(
                status_code=409,
                detail="Parish logo is locked and cannot be changed.",
            )
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

    logo_url = upload_file_url("community_logo.png")
    if session and supabase_enabled():
        raw_png = out_path.read_bytes()
        stored = upload_user_asset(
            user_id=session.user.user_id,
            access_token=session.token,
            relative_path="logo/community_logo.png",
            raw=raw_png,
            content_type="image/png",
            upsert=True,
        )
        _sync_church_profile_to_supabase(session, logo_path=stored.path)
        logo_url = stored.signed_url
        church_ctx = get_church_profile_context()
        if parish_name_is_locked(church_ctx) and not (church_ctx or {}).get("logo_locked_at"):
            from services.supabase_client import lock_church_logo

            lock_church_logo(session.user.user_id, access_token=session.token)
    else:
        update_community(logo_path=LOGO_RELATIVE)
    out: dict[str, Any] = {
        "ok": True,
        "logo_url": logo_url,
        "message": "Logo saved. It will appear on the next generated poster.",
    }
    if session:
        out.update(membership_payload(get_church_profile_context(), user=session.user))
    return out


@app.post("/api/upload/mass-divider")
async def api_upload_mass_divider(
    file: UploadFile = File(...),
    session: Optional[AuthSession] = Depends(require_approved_membership),
) -> dict[str, Any]:
    name = await _save_uploaded_image(file, _MASS_ASSET_DIR, prefix="divider")
    url = upload_file_url(f"mass_assets/{name}")
    if session and storage_ready(session.token):
        raw = (_MASS_ASSET_DIR / name).read_bytes()
        stored = upload_user_asset(
            user_id=session.user.user_id,
            access_token=session.token,
            relative_path=f"mass_assets/{name}",
            raw=raw,
            content_type=(file.content_type or "image/png"),
            upsert=True,
        )
        url = stored.signed_url
    return {"ok": True, "basename": name, "url": url}


@app.post("/api/upload/announcement-slide")
async def api_upload_announcement_slide(
    file: UploadFile = File(...),
    session: Optional[AuthSession] = Depends(require_approved_membership),
) -> dict[str, Any]:
    name = await _save_uploaded_image(file, _MASS_ASSET_DIR, prefix="announce")
    url = upload_file_url(f"mass_assets/{name}")
    if session and storage_ready(session.token):
        raw = (_MASS_ASSET_DIR / name).read_bytes()
        stored = upload_user_asset(
            user_id=session.user.user_id,
            access_token=session.token,
            relative_path=f"mass_assets/{name}",
            raw=raw,
            content_type=(file.content_type or "image/png"),
            upsert=True,
        )
        url = stored.signed_url
    return {"ok": True, "basename": name, "url": url}


@app.post("/api/upload/saved-poster")
async def api_upload_saved_poster(
    file: UploadFile = File(...),
    session: Optional[AuthSession] = Depends(require_approved_membership),
) -> dict[str, Any]:
    name = await _save_uploaded_image(file, _SAVED_POSTER_DIR, prefix="poster")
    url = upload_file_url(f"saved_posters/{name}")
    if session and storage_ready(session.token):
        raw = (_SAVED_POSTER_DIR / name).read_bytes()
        stored = upload_user_asset(
            user_id=session.user.user_id,
            access_token=session.token,
            relative_path=f"saved_posters/{name}",
            raw=raw,
            content_type=(file.content_type or "image/png"),
            upsert=True,
        )
        url = stored.signed_url
    return {"ok": True, "basename": name, "url": url}


@app.get("/api/saved-posters")
def api_list_saved_posters(
    session: Optional[AuthSession] = Depends(require_approved_membership),
) -> dict[str, Any]:
    if session and storage_ready(session.token):
        rows = list_user_assets(
            user_id=session.user.user_id,
            access_token=session.token,
            prefix="saved_posters",
        )
        posters = [
            {"basename": row["name"], "url": row["url"] or ""}
            for row in rows
            if Path(str(row.get("name") or "")).suffix.lower() in {".png", ".jpg", ".jpeg", ".webp", ".gif"}
        ]
        posters.sort(key=lambda r: r["basename"], reverse=True)
        return {"ok": True, "posters": posters}
    if not _SAVED_POSTER_DIR.is_dir():
        return {"ok": True, "posters": []}
    rows = []
    for p in sorted(_SAVED_POSTER_DIR.iterdir(), key=lambda x: x.stat().st_mtime, reverse=True):
        if p.is_file() and p.suffix.lower() in {".png", ".jpg", ".jpeg", ".webp", ".gif"}:
            rows.append({"basename": p.name, "url": upload_file_url(f"saved_posters/{p.name}")})
    return {"ok": True, "posters": rows}


@app.delete("/api/saved-posters/{basename}")
def api_delete_saved_poster(
    basename: str,
    session: Optional[AuthSession] = Depends(require_approved_membership),
) -> dict[str, Any]:
    if session and storage_ready(session.token):
        rel = _safe_storage_leaf(basename, folder="saved_posters")
        delete_user_asset(
            user_id=session.user.user_id,
            access_token=session.token,
            relative_path=rel,
        )
        return {"ok": True}
    p = _resolve_child_file(_SAVED_POSTER_DIR, basename)
    if not p:
        raise HTTPException(status_code=404, detail="Poster not found.")
    p.unlink(missing_ok=True)
    return {"ok": True}


@app.get("/api/catalog/songs")
def api_catalog_songs(
    lite: bool = True,
    if_none_match: Optional[str] = Header(None, alias="If-None-Match"),
    _session: Optional[AuthSession] = Depends(require_session_when_auth),
) -> Response:
    if lite:
        body, etag = catalog_lite_response()
        headers = {
            "Cache-Control": "private, max-age=300",
            "ETag": etag,
            "Vary": "Authorization",
        }
        if if_none_match and if_none_match.strip() == etag:
            return Response(status_code=304, headers=headers)
        return Response(content=body, media_type="application/json", headers=headers)
    payload = {
        "ok": True,
        "catalog": catalog_for_api(include_inferred_moods=True),
    }
    return JSONResponse(payload, headers={"Cache-Control": "private, max-age=120"})


@app.get("/api/catalog/songs/{section}/{hymn_id:path}")
def api_get_catalog_song(
    section: str,
    hymn_id: str,
    _session: Optional[AuthSession] = Depends(require_session_when_auth),
) -> JSONResponse:
    row = get_hymn(section.strip().lower(), hymn_id)
    if not row:
        raise HTTPException(status_code=404, detail="Song not found.")
    payload = {
        "ok": True,
        "section": section.strip().lower(),
        "song": {
            "id": str(row.get("id") or ""),
            "title": str(row.get("title") or ""),
            "author": str(row.get("author") or ""),
            "language": str(row.get("language") or "English"),
            "lyrics": str(row.get("lyrics") or ""),
            "gospel_moods": gospel_moods_for_song(row),
        },
    }
    return JSONResponse(payload, headers={"Cache-Control": "private, max-age=300"})


@app.patch("/api/catalog/songs/{section}/{hymn_id:path}")
def api_patch_catalog_song(
    section: str,
    hymn_id: str,
    body: CatalogSongPatchBody,
    _session: Optional[AuthSession] = Depends(require_superadmin),
) -> dict[str, Any]:
    res = update_catalog_song(
        section=section,
        hymn_id=hymn_id,
        title=body.title,
        author=body.author,
        lyrics=body.lyrics,
        language=body.language,
        gospel_moods=body.gospel_moods,
    )
    if not res.get("ok"):
        raise HTTPException(status_code=400, detail=res.get("error") or "Update failed.")
    return res


@app.delete("/api/catalog/songs/{section}/{hymn_id:path}")
def api_delete_catalog_song(
    section: str,
    hymn_id: str,
    _session: Optional[AuthSession] = Depends(require_superadmin),
) -> dict[str, Any]:
    res = delete_catalog_song(section=section, hymn_id=hymn_id)
    if not res.get("ok"):
        raise HTTPException(status_code=400, detail=res.get("error") or "Delete failed.")
    return res


@app.post("/api/design/analyze-template")
async def api_design_analyze_template(
    file: UploadFile = File(...),
    _session: Optional[AuthSession] = Depends(require_superadmin),
) -> dict[str, Any]:
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
    # Public marketing landing page. Signed-in visitors are bounced to /home
    # client-side (see landing.html); the app itself lives at /home and friends.
    return templates.TemplateResponse(
        request,
        "landing.html",
        {
            "title": "LiturgyFlow",
            "auth_enabled": auth_enabled(),
            "invite_contact_email": invite_contact_email(),
        },
    )


@app.get("/home", response_class=HTMLResponse)
@app.get("/radio", response_class=HTMLResponse)
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
@app.get("/settings/team", response_class=HTMLResponse)
@app.get("/superadmin", response_class=HTMLResponse)
@app.get("/lyrics-dashboard", response_class=HTMLResponse)
@app.get("/theme-dashboard", response_class=HTMLResponse)
@app.get("/mass-flow-dashboard", response_class=HTMLResponse)
def dashboard(request: Request) -> Any:
    return templates.TemplateResponse(
        request,
        "index.html",
        {"title": "LiturgyFlow", "auth_enabled": auth_enabled()},
    )


@app.get("/api/catholic-news")
def api_catholic_news(
    vatican: bool = True,
    cna: bool = True,
    limit: int = 6,
    offset: int = 0,
    max_age_days: int = 3,
) -> Any:
    """Headlines from Vatican News and Catholic News Agency RSS (fresh each request)."""
    cap = max(1, min(int(limit), 15))
    off = max(0, int(offset))
    age = max(0, min(int(max_age_days), 14))
    return fetch_catholic_headlines(
        include_vatican=vatican,
        include_cna=cna,
        max_items=cap,
        offset=off,
        max_age_days=age,
    )


@app.get("/api/wyd-news")
def api_wyd_news(limit: int = 6) -> Any:
    """World Youth Day Seoul 2027 announcements (official site) plus countdown metadata."""
    from datetime import date

    from services.wyd_news import fetch_wyd_announcements

    cap = max(1, min(int(limit), 15))
    errors: list[str] = []

    # Primary source: the official WYD announcement board (server-rendered).
    items: list[Any] = []
    try:
        items = fetch_wyd_announcements(limit=cap)
    except Exception as exc:  # pragma: no cover - defensive
        errors.append(f"WYD site: {exc}")

    # Fallback: keyword-filtered Catholic news if the official board is empty.
    if not items:
        feed = fetch_catholic_headlines(
            include_vatican=True,
            include_cna=True,
            max_items=cap,
            offset=0,
            max_age_days=0,
            keywords=["world youth day", "wyd", "seoul 2027", "jornada mundial"],
        )
        items = feed.get("items", [])
        errors.extend(feed.get("errors", []))

    event_start = date(2027, 8, 3)
    event_end = date(2027, 8, 8)
    days_until = (event_start - date.today()).days
    return {
        "ok": bool(items) or not errors,
        "items": items,
        "errors": errors,
        "event_start": event_start.isoformat(),
        "event_end": event_end.isoformat(),
        "location": "Seoul, South Korea",
        "days_until": days_until,
        "official_url": "https://wydseoul.org/en",
    }


@app.get("/api/ewtn/radio")
def api_ewtn_radio() -> Any:
    """Catholic live radio stations (EWTN feeds + curated networks)."""
    return radio_catalog()


@app.get("/api/calendar/month")
def api_calendar_month(year: int, month: int) -> Any:
    """Lightweight per-day summaries for the liturgical calendar grid."""
    try:
        return fetch_calendar_month(year, month)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.get("/api/readings/{date}")
def api_readings(
    date: str,
    refresh: bool = False,
    _session: Optional[AuthSession] = Depends(optional_session),
) -> JSONResponse:
    """Fast lectionary readings for dashboard cards (no song discovery).

    Public liturgical data — anonymous-friendly, mirroring ``POST /api/preview``
    so the home dashboard loads readings before/without sign-in.
    """
    payload, from_cache = readings_snapshot(date.strip(), force_refresh=refresh)
    if not payload.get("ok"):
        raise HTTPException(
            status_code=400,
            detail=payload.get("error") or "Unable to load readings.",
        )
    complete = bool(payload.get("readings_complete"))
    max_age = 3600 if from_cache and complete else 15
    return JSONResponse(
        payload,
        headers={"Cache-Control": f"private, max-age={max_age}"},
    )


@app.get("/api/gospel-image/{date}")
def api_gospel_image(date: str) -> JSONResponse:
    """Gospel-matched background image (Openverse / Creative Commons) for the home card."""
    from services.gospel_image_search import fetch_gospel_background

    payload = fetch_gospel_background(date.strip())
    max_age = 21600 if payload.get("ok") else 300
    return JSONResponse(payload, headers={"Cache-Control": f"public, max-age={max_age}"})


@app.post("/api/preview")
def api_preview(body: PreviewBody) -> Any:
    p = fetch_preview(
        body.date.strip(),
        readings_only=body.readings_only,
        force_refresh=body.refresh,
    )
    return _preview_to_json(p)


@app.post("/api/generate")
def api_generate(
    body: GenerateBody,
    request: Request,
    session: Optional[AuthSession] = Depends(require_approved_membership),
) -> Any:
    song_map = body.songs.model_dump(exclude_none=True) if body.songs else None
    temp_assets: list[Path] = []
    divider_path = None
    if body.divider_poster_basename and str(body.divider_poster_basename).strip():
        raw_divider = str(body.divider_poster_basename).strip()
        divider_path = _resolve_child_file(_MASS_ASSET_DIR, raw_divider)
        if not divider_path and session and storage_ready(session.token):
            key = _safe_storage_leaf(raw_divider, folder="mass_assets")
            divider_path = _materialize_storage_asset(session, f"{session.user.user_id}/{key}")
            if divider_path:
                temp_assets.append(divider_path)
    ann_paths: list[Path] = []
    for raw in body.announcement_basenames or []:
        bn = str(raw).strip()
        if not bn:
            continue
        p = _resolve_child_file(_MASS_ASSET_DIR, bn)
        if not p and session and storage_ready(session.token):
            key = _safe_storage_leaf(bn, folder="mass_assets")
            p = _materialize_storage_asset(session, f"{session.user.user_id}/{key}")
            if p:
                temp_assets.append(p)
        if p:
            ann_paths.append(p)
        if len(ann_paths) >= 24:
            break
    sponsors = [str(s).strip() for s in (body.food_sponsors or []) if str(s).strip()][:24]
    psalm_override = (body.psalm_text_override or "").strip() or None
    gospel_override = (body.gospel_quote_override or "").strip() or None

    if body.include_ai_mass_poster:
        backend = (body.ai_poster_backend or "openai").strip().lower()
        _enforce_ai_image_quota(
            session,
            request,
            source=f"mass-poster:{backend}",
        )

    try:
        result = generate_mass_media(
            body.date.strip(),
            body.celebrant.strip(),
            co_celebrant=(body.co_celebrant or "").strip(),
            sentence_index=body.sentence_index,
            poster_template=body.poster_template,
            include_social_exports=body.include_social_exports,
            include_gospel_art=body.include_gospel_art,
            include_ai_mass_poster=body.include_ai_mass_poster,
            ai_poster_backend=(body.ai_poster_backend or "openai").strip().lower(),
            ai_poster_style=body.ai_poster_style.strip() or "cinematic",
            reuse_existing_poster=body.reuse_existing_poster,
            community_name=body.community_name.strip() if body.community_name else None,
            song_selections=song_map,
            custom_theme=body.custom_theme,
            divider_poster_path=divider_path,
            lotw_poster=body.lotw_poster,
            lote_poster=body.lote_poster,
            announcement_image_paths=ann_paths or None,
            mass_collection_amount=body.mass_collection_amount.strip() if body.mass_collection_amount else None,
            mass_collection_date_label=body.mass_collection_date_label.strip()
            if body.mass_collection_date_label
            else None,
            mass_collection_currency=body.mass_collection_currency.strip().upper()
            if body.mass_collection_currency
            else "PHP",
            food_sponsors=sponsors or None,
            psalm_text_override=psalm_override,
            psalm_refrain_index=body.psalm_refrain_index,
            psalm_response_override=(body.psalm_response_override or "").strip() or None,
            gospel_quote_override=gospel_override,
            hymn_typography=body.hymn_typography,
            include_church_logo=body.include_church_logo,
            include_church_name=body.include_church_name,
            include_footer=body.include_footer,
            hymn_lyric_overrides=body.hymn_lyric_overrides,
            creed_choice=body.creed_choice,
            our_father_choice=body.our_father_choice,
            hymn_lyrics_layout=body.hymn_lyrics_layout,
            hymn_layout_overrides=body.hymn_layout_overrides,
        )
    finally:
        for p in temp_assets:
            p.unlink(missing_ok=True)
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
    ppt_url = media_file_url(result.pptx_path.name) if result.pptx_path and result.pptx_path.is_file() else None
    poster_url = media_file_url(result.poster_path.name) if result.poster_path and result.poster_path.is_file() else None
    poster_ppt_url = (
        media_file_url(poster_ppt.name) if poster_ppt and Path(poster_ppt).is_file() else None
    )
    zip_url = media_file_url(_BUNDLE_NAME) if zip_ready else None

    pdf_url: Optional[str] = None
    pdf_message = ""
    pdf_path: Optional[Path] = None
    if body.export_pdf and result.pptx_path and result.pptx_path.is_file():
        soffice = _resolve_soffice_bin()
        if soffice:
            pdf_path = convert_pptx_to_pdf(result.pptx_path, _OUTPUT_DIR, soffice_bin=soffice)
            if pdf_path and pdf_path.is_file():
                pdf_url = media_file_url(pdf_path.name)
            else:
                pdf_message = "Could not render the PDF; the PowerPoint is still available."
        else:
            pdf_message = "Install LibreOffice to export a PDF; the PowerPoint is available."
    if session and storage_ready(session.token):
        upload_items: list[tuple[str, Path, str]] = []
        if result.pptx_path and result.pptx_path.is_file():
            upload_items.append(("pptx_url", result.pptx_path, "application/vnd.openxmlformats-officedocument.presentationml.presentation"))
        if result.poster_path and result.poster_path.is_file():
            upload_items.append(("poster_url", result.poster_path, "image/png"))
        if poster_ppt and Path(poster_ppt).is_file():
            upload_items.append(("poster_ppt_url", Path(poster_ppt), "application/vnd.openxmlformats-officedocument.presentationml.presentation"))
        bundle = _OUTPUT_DIR / _BUNDLE_NAME
        if bundle.is_file():
            upload_items.append(("zip_url", bundle, "application/zip"))
        if pdf_path and pdf_path.is_file():
            upload_items.append(("pdf_url", pdf_path, "application/pdf"))
        for key, file_path, ctype in upload_items:
            rel = f"generated/{result.export_stem or 'latest'}/{file_path.name}"
            try:
                stored = upload_user_asset(
                    user_id=session.user.user_id,
                    access_token=session.token,
                    relative_path=rel,
                    raw=file_path.read_bytes(),
                    content_type=ctype,
                    upsert=True,
                )
            except Exception:
                # Keep the local media URL for this file rather than failing the
                # whole generation when one upload is rejected (e.g. an
                # unsupported MIME type in the storage bucket policy).
                logger.warning(
                    "Storage upload failed for %s; serving local URL instead.", file_path.name
                )
                continue
            if key == "pptx_url":
                ppt_url = stored.signed_url
            elif key == "poster_url":
                poster_url = stored.signed_url
            elif key == "poster_ppt_url":
                poster_ppt_url = stored.signed_url
            elif key == "zip_url":
                zip_url = stored.signed_url
            elif key == "pdf_url":
                pdf_url = stored.signed_url
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
    if pdf_url:
        payload["pdf_url"] = pdf_url
    if pdf_message:
        payload["pdf_message"] = pdf_message
    if poster_url:
        payload["poster_url"] = poster_url
    if poster_ppt_url:
        payload["poster_ppt_url"] = poster_ppt_url
    payload["ai_poster_urls"] = _ai_poster_download_urls()
    if session and supabase_enabled():
        try:
            from services.supabase_client import record_generation

            record_generation(
                session.user.user_id,
                mass_date=body.date.strip(),
                celebrant=body.celebrant.strip(),
                output_summary={
                    "title": result.title,
                    "slide_count": result.slide_count,
                    "export_stem": result.export_stem,
                },
                access_token=session.token,
            )
        except Exception:
            pass
    out = {**payload}
    if zip_url:
        out["zip_url"] = zip_url
    return out


@app.post("/api/regenerate-pptx")
def api_regenerate_pptx(
    body: GenerateBody,
    session: Optional[AuthSession] = Depends(require_approved_membership),
) -> Any:
    """Rebuild the Mass PowerPoint with current hymn typography (overwrites existing .pptx)."""
    song_map = body.songs.model_dump(exclude_none=True) if body.songs else None
    temp_assets: list[Path] = []
    divider_path = None
    if body.divider_poster_basename and str(body.divider_poster_basename).strip():
        raw_divider = str(body.divider_poster_basename).strip()
        divider_path = _resolve_child_file(_MASS_ASSET_DIR, raw_divider)
        if not divider_path and session and storage_ready(session.token):
            key = _safe_storage_leaf(raw_divider, folder="mass_assets")
            divider_path = _materialize_storage_asset(session, f"{session.user.user_id}/{key}")
            if divider_path:
                temp_assets.append(divider_path)
    ann_paths: list[Path] = []
    for raw in body.announcement_basenames or []:
        bn = str(raw).strip()
        if not bn:
            continue
        p = _resolve_child_file(_MASS_ASSET_DIR, bn)
        if not p and session and storage_ready(session.token):
            key = _safe_storage_leaf(bn, folder="mass_assets")
            p = _materialize_storage_asset(session, f"{session.user.user_id}/{key}")
            if p:
                temp_assets.append(p)
        if p:
            ann_paths.append(p)
        if len(ann_paths) >= 24:
            break
    sponsors = [str(s).strip() for s in (body.food_sponsors or []) if str(s).strip()][:24]
    psalm_override = (body.psalm_text_override or "").strip() or None
    gospel_override = (body.gospel_quote_override or "").strip() or None
    try:
        result = regenerate_mass_pptx(
            body.date.strip(),
            body.celebrant.strip(),
            co_celebrant=(body.co_celebrant or "").strip(),
            sentence_index=body.sentence_index,
            song_selections=song_map,
            custom_theme=body.custom_theme,
            hymn_typography=body.hymn_typography,
            divider_poster_path=divider_path,
            lotw_poster=body.lotw_poster,
            lote_poster=body.lote_poster,
            announcement_image_paths=ann_paths or None,
            mass_collection_amount=body.mass_collection_amount.strip()
            if body.mass_collection_amount
            else None,
            mass_collection_date_label=body.mass_collection_date_label.strip()
            if body.mass_collection_date_label
            else None,
            mass_collection_currency=body.mass_collection_currency.strip().upper()
            if body.mass_collection_currency
            else "PHP",
            food_sponsors=sponsors or None,
            psalm_text_override=psalm_override,
            psalm_refrain_index=body.psalm_refrain_index,
            psalm_response_override=(body.psalm_response_override or "").strip() or None,
            gospel_quote_override=gospel_override,
            include_church_logo=body.include_church_logo,
            include_church_name=body.include_church_name,
            include_footer=body.include_footer,
            hymn_lyric_overrides=body.hymn_lyric_overrides,
            creed_choice=body.creed_choice,
            our_father_choice=body.our_father_choice,
            hymn_lyrics_layout=body.hymn_lyrics_layout,
            hymn_layout_overrides=body.hymn_layout_overrides,
        )
    finally:
        for p in temp_assets:
            p.unlink(missing_ok=True)
    if not result.ok:
        raise HTTPException(status_code=400, detail=result.error or "PowerPoint rebuild failed.")
    ppt_url = (
        media_file_url(result.pptx_path.name)
        if result.pptx_path and result.pptx_path.is_file()
        else None
    )
    if session and storage_ready(session.token) and result.pptx_path and result.pptx_path.is_file():
        stored = upload_user_asset(
            user_id=session.user.user_id,
            access_token=session.token,
            relative_path=f"generated/{result.export_stem or 'latest'}/{result.pptx_path.name}",
            raw=result.pptx_path.read_bytes(),
            content_type="application/vnd.openxmlformats-officedocument.presentationml.presentation",
            upsert=True,
        )
        ppt_url = stored.signed_url
    return {
        "ok": True,
        "slide_count": result.slide_count,
        "export_stem": result.export_stem,
        "pptx_url": ppt_url,
        "title": result.title,
    }


@app.post("/api/songs/refresh")
def api_refresh_songs(
    body: RefreshSongsBody,
    _session: Optional[AuthSession] = Depends(require_superadmin),
) -> dict[str, Any]:
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
def api_refresh_all_songs(
    body: RefreshAllSongsBody,
    _session: Optional[AuthSession] = Depends(require_superadmin),
) -> dict[str, Any]:
    songs = refresh_all_song_sections(
        date=body.date.strip(),
        current_ids=body.current_ids or {},
        limit=10,
    )
    return {"ok": True, "songs_by_section": songs}


@app.post("/api/songs/import")
def api_import_songs(
    body: ImportSongsBody,
    _session: Optional[AuthSession] = Depends(require_superadmin),
) -> dict[str, Any]:
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
def api_import_song_rows(
    body: ImportSongRowsBody,
    _session: Optional[AuthSession] = Depends(require_superadmin),
) -> dict[str, Any]:
    summary = import_song_rows([s.model_dump() for s in body.songs])
    return {"ok": True, **summary}


@app.post("/api/songs/fetch-lyrics")
def api_fetch_lyrics(
    body: FetchLyricsBody,
    _session: Optional[AuthSession] = Depends(require_superadmin),
) -> dict[str, Any]:
    if not body.selections:
        return {"ok": True, "updated": 0, "skipped": 0, "results": []}
    results = [fetch_and_store_for_selection({"section": s.section, "id": s.id}) for s in body.selections]
    updated = sum(1 for r in results if r.get("ok") and r.get("reason") == "fetched")
    skipped = len(results) - updated
    return {"ok": True, "updated": updated, "skipped": skipped, "results": results}


@app.post("/api/lyrics/save")
def api_save_lyrics(
    body: SaveLyricsBody,
    session: Optional[AuthSession] = Depends(require_session_when_auth),
) -> dict[str, Any]:
    if auth_enabled() and session and not is_superadmin_user(session.user):
        result = submit_pending_song(
            session,
            title=body.title,
            lyrics=body.lyrics,
            sections=body.sections,
            language=body.language,
            author=body.author,
        )
        if not result.get("ok"):
            raise HTTPException(status_code=400, detail=result.get("error") or "Could not submit song.")
        return result
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


@app.post("/api/submissions/priest")
def api_submit_priest(
    body: PriestSubmissionBody,
    session: Optional[AuthSession] = Depends(require_session_when_auth),
) -> dict[str, Any]:
    if not session:
        raise HTTPException(status_code=401, detail="Sign in required.")
    if is_superadmin_user(session.user):
        from services import community_store

        names = community_store.append_celebrant_name(body.name.strip())
        if supabase_enabled():
            from services.pending_submissions import sync_celebrants_to_supabase_profiles

            sync_celebrants_to_supabase_profiles()
        else:
            update_community(celebrant_names=names)
        payload = _community_api_payload(session)
        return {"ok": True, "celebrant_names": names, **payload}
    result = submit_pending_priest(session, name=body.name)
    if not result.get("ok"):
        raise HTTPException(status_code=400, detail=result.get("error") or "Could not submit priest.")
    return result
