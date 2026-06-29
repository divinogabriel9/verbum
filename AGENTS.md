# Project context for AI agents

> Read this first. It tells you what this app is, how it's built, and the rules that keep it working. It applies to both Cursor's Agent and the local `coder-agent` (qwen2.5-coder) running through Open WebUI.

## What this app is

**LiturgyFlow** (product name; deploy/repo name **Verbum**, repo `github.com/divinogabriel9/verbum`) is a **Catholic Mass media generator**. A parish picks a date; the app pulls the correct liturgical readings and produces ready-to-use media:

- **PowerPoint Mass decks** (readings, psalm, gospel, hymn lyrics slides, branding) via `python-pptx`.
- **Posters & social images** (square / story / OG) — classic and liturgical-color templates.
- **AI gospel imagery** — generated from the day's Gospel via Hugging Face (`Tongyi-MAI/Z-Image-Turbo`), OpenAI, or Gemini (`gemini-2.5-flash-image`), with style presets.
- **Liturgical intelligence** — lectionary Year A/B/C, season colors, hymn library, gospel-mood song recommendations, parish/community branding.

## Stack

- **Backend:** Python + **FastAPI** served by **uvicorn**. Entry: `server.py` (`app`). Shared generation logic in `pipeline.py`; CLI entry in `main.py`.
- **Frontend:** server-rendered **Jinja2** templates + **vanilla JS** (no framework) + **Tailwind CSS** (built via npm scripts, not a JS app).
- **Data/infra:** **Supabase** (auth, storage, DB), **Redis / Render Key Value** (cache + rate limiting), local JSON/SQLite caches (`readings_cache.json`, etc.).
- **Deploy:** **Render** (Docker, `render.yaml`), health check `/health`.

## Layout

| Path | Role |
|---|---|
| `server.py` | FastAPI app: routes, JSON API, auth, file serving (~1800 lines) |
| `pipeline.py` | Orchestrates generation (used by both web + CLI) |
| `main.py` | CLI entry point |
| `core/` | `lectionary.py`, `liturgical_calendar.py` (calendar/readings engine) |
| `api/` | `liturgical_api.py` |
| `routes/` | `admin.py`, `auth.py` route registration |
| `services/` | ~40 modules: auth/security, supabase, redis, image quota, hymn library, gospel mood/visual/quotes, lectionary, prayers, rate limiting, input validation, etc. |
| `generators/` | `powerpoint.py`, `poster_generator.py`, `ai_image_generator.py`, `ai_poster_generator.py`, `gospel_visual.py`, `deck_template.py` |
| `templates/` | `index.html` (main SPA), `landing.html`, `auth.html`, `mass_builder_wizard.html`, `mass_builder_mobile.html` |
| `static/` | `css/`, `js/`, `brand/`, `icons/`, `images/` |
| `data/` | styles, hymn/song catalogs, presets |
| `outputs/` | generated decks/posters/zips (ephemeral) |
| `design-system/`, `stitch/`, `supabase/` | design tokens, Stitch design exports, Supabase config |

## Run locally

```bash
# backend (port 8000 — already in use by this app, do not reuse it)
uvicorn server:app --reload --host 127.0.0.1 --port 8000

# tailwind (only when editing styles)
npm run watch:wizard-css
npm run watch:landing-css
```

## What we're building right now

A **UI redesign** of the Mass Builder into a step-by-step **wizard** (`templates/mass_builder_wizard.html`, `static/js/mass_builder_wizard.js`, `static/css/mass_builder_wizard.css`) plus a mobile variant. Design briefs: `STITCH_DESIGN_BRIEF.md`, `BENTO_GRID_REDESIGN.md`. Wiring rules: `REDESIGN_INTEGRATION_CONTRACT.md`.

## Critical rules — DO NOT break these

1. **The main app (`templates/index.html`) is a single-page app (~23.5k lines) with inline vanilla JS that binds to the DOM by element `id`** (`const $ = (id) => document.getElementById(id)`). Most lookups are guarded by `if (el)`, so a renamed/removed `id` causes the feature to **silently stop working** with no error. When touching markup, **preserve every `id` and `data-*` attribute** documented in `REDESIGN_INTEGRATION_CONTRACT.md`.
2. **Routing** is client-side: every screen is `<section class="page" data-route="/…">`. Keep the routing skeleton intact.
3. **Render filesystem is ephemeral** — never rely on `outputs/` or local writes persisting across deploys/restarts. Use Supabase storage / DB / Redis for anything that must survive.
4. **Bind HTTP servers to `0.0.0.0:$PORT`** in production (Render injects `$PORT`).
5. **Secrets** come from env vars (`OPENAI_API_KEY`, `GEMINI_API_KEY`, `SUPABASE_*`, `REDIS_URL`, `SUPERADMIN_EMAILS`). Never hardcode or commit them. Local dev loads `.env*` via `services/env_config.py`.
6. **Read before you edit.** Inspect the real file with the filesystem tool; never guess paths, function names, or API field shapes — match the existing code and the API reference in `REDESIGN_INTEGRATION_CONTRACT.md`.

## Conventions

- Python: type hints, `from __future__ import annotations`, dataclasses for payloads, module logger via `logging.getLogger(__name__)`.
- Keep changes minimal and scoped; don't add narration comments.
- New service logic → `services/`; new media output logic → `generators/`; new HTTP routes → `routes/` or `server.py`.
