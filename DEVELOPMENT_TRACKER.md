# Development Tracker

_Last updated: 2026-06-09 (Gemini poster + nav polish)_

## Done

- [x] Lectionary fetch + cache (SQLite) with Year A/B/C and season color logic.
- [x] Full Mass deck generation flow with hymn lyrics slides and community/church branding.
- [x] Poster generation (`classic_white` + `liturgical_color`) plus social exports (square/story/OG).
- [x] AI poster pipeline wired to Hugging Face (`Tongyi-MAI/Z-Image-Turbo`) with style presets from `data/styles.json`.
- [x] AI style option supported in CLI and API (`cinematic`, `renaissance`, `stained_glass`, `modern`, `realistic`).
- [x] AI hero file naming now includes date + style (example: `2026-05-24_cinematic_hero.png`).
- [x] Prompt flow improved for visual scenes (avoid quoted verse text; no on-image text intent).
- [x] AI poster download links exposed in web UI (`/media/posters/...`) alongside normal poster downloads.
- [x] PPT preview improved to support full deck thumbnails (PDF raster path + fallback text mode).
- [x] ZIP bundle includes generated outputs (PPT, posters, social assets, preview artifacts as available).
- [x] **2026-06-09** — Header nav row: 6 tabs evenly spaced; icon 15px + label 14px (`--type-helper`).
- [x] **2026-06-09** — Song Plan tab: two-column layout, gospel mood picks, custom sections (up to 10), typography tokens.
- [x] **2026-06-09** — `gospel_moods` tagging on hymn library + metadata modal + backend recommendations.
- [x] **2026-06-09** — Liturgical indicator panel: event section IDs, hide empty Ongoing/Upcoming, month filter.
- [x] **2026-06-09** — Gemini poster option in Mass setup (checkbox, mutually exclusive with OpenAI).
- [x] **2026-06-09** — Settings: Gemini API key input → saved to `.env.gemini` (`GET/POST /api/settings/gemini-api-key`).
- [x] **2026-06-09** — Gemini image gen via `google-genai` (`gemini-2.5-flash-image`), model fallbacks, 90s timeout, clear quota errors.

## In Progress / Needs Monitoring

- [ ] Gemini poster requires **Google AI Studio** key (`AIza…`); current `AQ.…` keys return quota `limit: 0`.
- [ ] Tune AI prompt quality per Gospel type (parables vs narrative scenes) for more consistent subject framing.
- [ ] Add clearer UI feedback when placeholder image is used (token/API/model failure reason).
- [ ] Re-sync liturgical panel HTML with JS (Sunday celebrations list) if still missing in template.

## Next (Simple Priority)

- [ ] Evaluate **Pollinations** or **HF FLUX** as a free image API backend (alternative to Gemini/OpenAI).
- [ ] Add prayer database (currently fixed text/flow, not queryable yet).
- [ ] Add user accounts + church profiles (partial: community DB exists; full auth not done).
- [ ] Add cloud storage/deployment pipeline (hosted environment + CI/CD).
- [ ] Add subscription/billing layer (if productized).
