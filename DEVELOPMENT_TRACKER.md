# Development Tracker

_Last updated: 2026-05-11_

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

## In Progress / Needs Monitoring

- [ ] Tune AI prompt quality per Gospel type (parables vs narrative scenes) for more consistent subject framing.
- [ ] Add clearer UI feedback when placeholder image is used (token/API/model failure reason).

## Next (Simple Priority)

- [ ] Add prayer database (currently fixed text/flow, not queryable yet).
- [ ] Add user accounts + church profiles.
- [ ] Add cloud storage/deployment pipeline (hosted environment + CI/CD).
- [ ] Add subscription/billing layer (if productized).
