# 17 · Assets Inventory

> Extracted from `static/` and `data/reference/`. Paths are repo-relative.

---

## 1. Logos & brand

| Asset | Path | Use |
|---|---|---|
| LiturgyFlow logo | `static/brand/liturgyflow-logo.png` | Brand mark |
| App icon | `static/brand/app-icon.png`, `app-icon-source.png` | App/PWA icon |
| Apple touch icon | `static/brand/apple-touch-icon.png` | iOS home screen |
| Favicons | `static/brand/favicon.ico`, `favicon-32x32.png`, `favicon-192x192.png` | Browser tab / PWA |

**Wordmark:** rendered in **Playfair Display italic** (not an image; `--brand-font-flow`). Salmon `#ffb4a9` on landing; berry context in app. (Note: docs reference "Mea Culpa" but it isn't loaded — see [`12_ui_audit.md`](12_ui_audit.md).)

## 2. Icons

**Nav / UI icons** (`static/icons/`) — provided as **both PNG and SVG** (SVG preferred for crispness):

| Icon | Formats |
|---|---|
| home | `home.svg`, `home.png` |
| calendar | `calendar.png` |
| mass | `mass.svg`, `mass.png` |
| library | `library.svg`, `library.png` |
| media | `media.svg`, `media.png` |
| design | `design.svg`, `design.png` |
| settings | `settings.svg`, `settings.png` |
| notifications | `notifications.png` |
| chevron | `chevron.svg` |

- Sizes in use: nav 15px, menu 18px, indicator 16px, chevron 14px (see [`02_design_tokens.md §12`](02_design_tokens.md)).
- **`[RECOMMENDATION]`** Ship every icon as SVG (calendar/notifications are PNG-only) and adopt a single inline-SVG icon system inheriting `currentColor`. Landing additionally uses **Material Symbols Outlined** (web font) — keep that to landing only.

## 3. Illustrations & images

| Asset | Path | Use |
|---|---|---|
| Landing hero | `static/images/landing/hero.png` | Marketing hero |
| Landing steps | `static/images/landing/step-calendar.png`, `step-typography.png` | Feature steps |
| Landing testimonial | `static/images/landing/testimonial.png` | Social proof |
| News placeholder | `static/images/news-no-image-placeholder.png`, `…-dark.png` | News card fallback (light/dark) |
| WYD image | `static/images/wyd-seoul-2027.jpg` | World Youth Day card |

## 4. Poster templates

**Liturgy of the Word / Eucharist poster sets** (4 each):

| Set | Path |
|---|---|
| LOTW (Word) | `static/images/posters/lotw1.png` … `lotw4.png` |
| LOTE (Eucharist) | `static/images/posters/lote1.png` … `lote4.png` |
| Duplicates | `data/reference/posters/lotw1–4.png`, `lote1–4.png` |

Selected via poster pickers (`data-poster-picker`, `data-target=flow-lotw/lote-poster`).

## 5. Theme font previews

`static/images/theme/arial.png`, `arialblack.png`, `georgia.png`, `poppins.png` — used in Theme Lab's font preview list.

## 6. Fonts

| Font | Source | Use |
|---|---|---|
| **System stack** (SF Pro via `-apple-system`) | OS | Primary UI/body/headings (`--font`, `--font-display`) |
| **Inter** | Google Fonts (400/500/600) | Fallback UI font (app + landing) |
| **Playfair Display** | Google Fonts (italic 400/500) | Wordmark / serif accent |
| **Material Symbols Outlined** | Google Fonts | Landing icons only |
| **Poppins-Bold.ttf** | `data/reference/fonts/` | PPTX deck generation (server-side, not web UI) |
| Bricolage Grotesque / Hanken Grotesk / JetBrains Mono | wizard config | **System B only — off-brand, do not use in app** |

## 7. SVGs

- `static/icons/*.svg` (home, mass, library, media, design, settings, chevron).
- Inline SVGs in `index.html` for menu/account icons (18px, `currentColor`).
- **`[RECOMMENDATION]`** Build a shared SVG sprite / inline icon set.

## 8. Generated / output assets (ephemeral)

- `outputs/` — generated decks/posters/zips. **Ephemeral on Render** — never relied upon to persist (use Supabase storage). Not design assets.
- `data/reference/*.pptx` — server-side slide templates (creed, gloria, kyrie, our-father, sign-of-peace, etc.) used by the PPTX generator, not web UI.

## 9. Brand asset rules
- Logo on white/canvas only; maintain clear space ≥ logo height.
- Favicons/app icons are the fixed app-icon accent (not season-tinted).
- Poster sets are content templates — keep the 4×4 grid and naming (`lotw1–4`, `lote1–4`).
- **`[RECOMMENDATION]`** Create a single `/static/brand/` source-of-truth with SVG logo + icon set, and document min sizes + clear space.
