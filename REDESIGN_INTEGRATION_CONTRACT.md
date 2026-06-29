# Redesign Integration Contract

This document is the wiring contract between the existing app logic and any new design
(Stitch, Figma, hand-built). The whole app is a single-page app served from
`templates/index.html` (~23.5k lines) with **inline vanilla JS** that binds to the DOM
**by element `id`** and a handful of `data-*` attributes.

> **Golden rule:** the JS finds elements with `const $ = (id) => document.getElementById(id)`.
> If the new design renames or drops an `id` listed here, that feature **silently stops working**
> (most lookups are guarded by `if (el)`, so there is no error — it just does nothing).
> Keep every `id` and `data-*` attribute below, or refactor the JS to match.

---

## How to use this with Stitch

Stitch produces **static UI only** (HTML/CSS or Figma). It does not connect to the backend.
The integration is a separate step you (or the agent) do after the design comes back:

1. Design each **screen** in Stitch using the "What to tell Stitch" notes per screen below.
2. When the markup comes back, re-apply the **required `id`s, `data-*` attributes, and
   container hooks** from this doc onto the new elements.
3. Keep the routing skeleton: every screen must be a `<section class="page" data-route="…">`.
4. Test against the **API reference** at the bottom (request/response field names must match).

There are two integration strategies:

- **Strategy A — Preserve IDs (fastest):** keep all the exact `id`s/`data-*` from this doc on
  the new markup. No JS changes. Most mechanical, least risk.
- **Strategy B — Decouple (cleaner long-term):** refactor the inline JS to bind via
  `data-action` / `data-field` + event delegation, then future redesigns only need `data-*`.
  More upfront work; recommended if you redesign often.

---

## 1. Global architecture & shared contract

### Routing (History API, client-side)
- Every screen is `<section class="page" data-route="/…">`. `applyRouteState()` toggles `.active`
  on the matching page by **`data-route` equality**. `showRoute(route)` is the navigate function.
- `routeMeta` is the source of truth for valid routes; `legacyRoutes` redirects old paths.
- Aliases: `/media/presentation` → `/mass/builder`; `/lyrics-dashboard` → `/library/songs`;
  `/theme-dashboard` → `/design/theme-lab`; `/mass-flow-dashboard` → `/mass/builder`.
- `settings-page` is special-cased to match **both** `/settings/church` and `/settings/app`.

**The 10 page containers (must be preserved):**

| `id` | `data-route` | Screen |
|---|---|---|
| `home-page` | `/home` | Home dashboard |
| `lyrics-page` | `/library/songs` | Song library + lyrics editor |
| `theme-page` | `/design/theme-lab` | Theme Lab |
| `flow-page` | `/mass/builder` | Mass Builder (most complex) |
| `calendar-page` | `/mass/calendar` | Liturgical calendar |
| `posters-page` | `/media/posters` | Posters / media |
| `history-page` | `/media/history` | Downloads history (local only) |
| `collections-page` | `/library/collections` | Collections hub |
| `templates-page` | `/design/templates` | PPTX theme import |
| `settings-page` | *(matches `/settings/church` + `/settings/app`)* | Settings |

> ⚠️ **`/radio` has NO page container.** A nav link + route exist, but there is no
> `<section class="page" data-route="/radio">`. The JS references `radio-page-*` IDs that
> don't exist in the markup. **The redesign should author a `/radio` page** (or the route
> renders an empty body). Today "radio" only exists as the header pill player (`live-radio-*`).

### Navigation attributes (preserve on all nav links)
- `data-route` — target route (required for SPA links)
- `data-route-prefix`, `data-route-exclude` — active-state matching
- `data-nav-tab` — visibility group (`home/radio/calendar/mass/library/media/design`)
- Nav links are bound in one pass via `bindSpaRouteLink` across the sidebar, bottom nav,
  "more" sheet, settings sub-nav, account menu, and `#route-switcher` (the desktop "Jump to" select).

### Other global `data-*` contracts (preserve the attribute + value vocabulary)
| Attribute | Values | Used by |
|---|---|---|
| `data-create` | `pptx`, `event`, `poster`, `song`, `collection` | Sidebar "Create" menu |
| `data-add-type` | `verse`, `chorus`, `bridge`, `response` | Lyrics quick-add buttons |
| `data-action` | `type`, `move-up`, `move-down`, `duplicate`, `delete`, `text` | Lyrics structured block controls |
| `data-mass-step-target` | `basics`, `stewardship`, `readings`, `media`, `songs` | Mass Builder stepper |
| `data-flow-tab` / `data-flow-panel` | `setup`, `songs` | Mass Builder inner tabs |
| `data-poster-picker` / `data-target` | `flow-lotw-poster`, `flow-lote-poster` | Poster pickers |
| `data-ewtn-radio-id` | station ids | Settings radio list |
| `data-nav-tab` / `data-nav-tab-toggle` | tab ids | Tab visibility toggles |
| `data-settings-panel` | `church`, `appearance` | Settings sub-panels |
| `data-target` | excerpt ids | Calendar / readings "read more" |

### Global helpers (don't rename in markup)
- Toasts render into `#toast-stack`.
- Auth bearer headers auto-attach via the `postJSON()` wrapper and a `fetch` interceptor for
  `<a href^="/api/files/">` download links — keep file download links as `/api/files/...` anchors.

### Persistent header (present on every route)
Key IDs: `app-header`, `topbar-title`, `topbar-breadcrumb`, `topbar-route-desc`,
`app-global-search` (+ `global-search-panel`, `global-search-list`, `global-search-empty`),
live radio pill (`live-radio-pill`, `live-radio-play-btn`, `live-radio-settings-btn`,
`live-radio-menu-btn`, `live-radio-panel`, `live-radio-prev`, `live-radio-next`,
`live-radio-panel-play`, `live-radio-art`, `live-radio-audio`),
liturgical indicator (`liturgical-indicator-btn`, `liturgical-indicator-panel`),
notifications (`notif-toggle-btn`, `notif-panel`, `notif-badge`, `notification-feed`,
`btn-clear-notifications`), `theme-toggle-btn`,
account menu (`account-menu-btn`, `account-menu-panel`, `account-sign-in-link`,
`account-sign-up-link`, `account-sign-out-btn`, `account-settings-link`),
and the Mass Builder stepper (`mass-builder-stepper`, `mass-builder-stepper-list`,
shown only on `/mass/builder`).

---

## 2. Screen-by-screen contract

For each screen: **Selects** (dropdowns), **Key interactive IDs**, **Dynamic regions** (JS fills
these via fetch — design them as empty containers), and **Endpoints** it calls.

### 2.1 Home — `#home-page` (`/home`)
- **Selects:** none.
- **Key interactive IDs:** `btn-home-create-event`, `btn-home-news-refresh`, `home-gospel-card`,
  reading cards `home-reading1-card` / `home-reading2-card` / `home-psalm-card`.
- **Dynamic regions:** `home-membership-banner`; reflection (`home-reflection-bg`,
  `home-reflection-verse`, `home-reflection-ref`, `home-reflection-text`, `home-reflection-date`,
  `home-reflection-credit`); WYD (`home-wyd-list`, `home-wyd-countdown`, `home-wyd-status`);
  Sunday gospel (`home-gospel-quote`, `home-gospel-ref`, `home-sunday-label`);
  events (`home-events-board`, `home-events-empty`); readings tiles (`home-reading1-ref`/`-excerpt`,
  `home-reading2-ref`/`-excerpt`, `home-psalm-ref`/`-excerpt`); news (`home-news-list`,
  `home-news-status`, `home-news-panel-head`).
- **Modals (siblings):** `home-event-modal` (+ `-backdrop`/`-close`/`-cancel`/`-save`,
  `home-event-modal-name`, `home-event-date-trigger`, `home-event-date-popover`,
  `home-event-date-cal`, `home-event-date-start`, `home-event-date-end`, `home-event-modal-time`),
  `home-news-expand-modal` (+ `home-news-expand-list`/`-foot`/`-scroll`),
  `reading-expand-modal` (+ `reading-expand-title`/`-ref`/`-body`).
- **Endpoints:** `GET /api/readings/{date}`, `GET /api/gospel-image/{date}`,
  `GET /api/catholic-news`, `GET /api/wyd-news`.
- **Tell Stitch:** dashboard with reflection hero, Sunday readings cards, events board, news feed,
  "create event" CTA. States: loading, empty events, news collapsed/expanded.

### 2.2 Song Library — `#lyrics-page` (`/library/songs`)
- **Selects:** `lyrics-save-language` (English/Tagalog/Latin/Mix),
  `lyrics-save-section` (entrance/offertory/communion/recessional/meditation).
- **Key interactive IDs:** `song-catalog-search`, `song-catalog-search-clear`,
  `lyrics-drop-zone`, `lyrics-file`, `song-composer-collapse-btn`, `lyrics-save-title`,
  `lyrics-save-author`, `lyrics-input`, `btn-lyrics-focus-meta`, `btn-analyze-lyrics`,
  `btn-save-lyrics`, `btn-clear-lyrics`, `btn-normalize-lyrics`; quick-add buttons via `data-add-type`.
- **Dynamic regions:** `song-catalog-root`, `song-composer-recent-list`, `lyrics-block-list`
  (structured editor; node controls use `data-action`), `lyrics-structured-meta`,
  `lyrics-word-stats`, `lyrics-analyze-hint`, `lyrics-detected`, `lyrics-status`.
- **Modals:** `song-metadata-modal`, `song-delete-modal`.
- **Endpoints:** `GET /api/catalog/songs?lite=1`, `GET /api/catalog/songs/{section}/{id}`,
  `POST /api/lyrics/save`, `PATCH /api/catalog/songs/{section}/{id}`,
  `DELETE /api/catalog/songs/{section}/{id}`.
- **Tell Stitch:** two-pane: searchable catalog list + lyrics composer with a structured
  block editor (verse/chorus/bridge), metadata fields, analyze/save actions.

### 2.3 Theme Lab — `#theme-page` (`/design/theme-lab`)
- **Selects:** none.
- **Key interactive IDs:** `btn-ppt-preview-refresh`.
- **Dynamic regions:** `theme-live-preview`, `ppt-preview-grid` (hidden until filled),
  `ppt-preview-status`, `theme-status`.
- **Endpoints:** `POST /api/ppt-preview/refresh`.
- **Tell Stitch:** live slide preview + a rendered-deck thumbnail grid + a "render actual deck" action.

### 2.4 Mass Builder — `#flow-page` (`/mass/builder`) — most complex
- **Inner tabs:** `flow-tab-setup` (`data-flow-tab="setup"`, panel `flow-panel-setup`) and
  `flow-tab-songs` (`data-flow-tab="songs"`, panel `flow-panel-songs`).
- **Stepper:** header `mass-builder-stepper` / `mass-builder-stepper-list`, 5 steps with
  `data-mass-step-target` = `basics`/`stewardship`/`readings`/`media`/`songs`, scrolling to
  anchors `mass-step-target-basics`, `mass-step-target-stewardship`, `mass-step-target-readings`,
  `mass-step-target-media`, and panel `flow-panel-songs`. **Keep these anchor IDs.**
- **Setup selects:** `flow-collection-currency` (PHP/KRW/MYR), `flow-penitential-choice`,
  `flow-kyrie-choice`, `flow-gloria-choice`, `flow-creed-choice`, `flow-our-father-choice`,
  `flow-lamb-choice`, `flow-psalm-refrain`, `flow-gospel-sentence`, `flow-openai-poster-style`.
- **Setup inputs/buttons:** `mass-date`; celebrant picker (`celebrant-picker-trigger`,
  `celebrant-picker-panel`, `celebrant-list`, `celebrant-picker-empty`, hidden `celebrant`),
  `co-celebrant`; `flow-collection-date`, `flow-collection-amount`; peace
  (`flow-peace-btn`, `flow-peace-message`, `flow-peace-breath-text`); `flow-psalm-custom`,
  `flow-gospel-custom`; sponsors (`flow-food-sponsor-input`, `btn-flow-food-add`, hidden
  `flow-food-sponsors`, list `flow-food-sponsors-list`); poster pickers
  (`data-poster-picker` with `data-target="flow-lotw-poster"`/`"flow-lote-poster"`, hidden inputs
  `flow-lotw-poster`/`flow-lote-poster`); checkboxes `flow-use-openai-poster`,
  `flow-use-gemini-poster`, `flow-export-pdf`; uploads `flow-divider-poster` (+ `flow-divider-status`),
  `flow-announcement-posters` (+ `flow-announcement-status`); quota hint `flow-ai-quota-hint`.
- **Song-plan panel:** select `mass-song-plan-lang`; hymn layout radios `name="flow-hymn-layout"`
  (single/dual); regions `mass-song-plan`, `flow-song-count`, `mass-summary-song-total`,
  `flow-reading-loaded`, `mass-summary-progress`/`-fill`, `mass-summary-gospel-tip-text`,
  `mass-summary-recs`, `mass-summary-mood-picks`; buttons `mass-summary-toggle`,
  `mass-summary-recs-refresh`, `mass-summary-recs-add`, `mass-song-add-custom`,
  `btn-load-flow-inline`, `btn-generate-flow-inline`.
- **Floating dock:** `flow-dock-actions` with `btn-load-flow`, `btn-generate-flow`.
- **Downloads (hidden anchors):** `flow-downloads-host`, `download-row`, `dl-zip`, `dl-pptx`,
  `dl-pdf`, `dl-poster`, `dl-poster-ppt`.
- **Overlays/modals:** `mass-gen-loader` (+ `mass-gen-loader-msg`), `mass-gen-receipt-modal`.
- **Readings sidebar:** `flow-reading1-card`/`-ref`/`-body`, `flow-psalm-preview-card`/
  `flow-psalm-ref`/`flow-psalm-body`, `flow-reading2-*`, `flow-gospel-preview-card`/
  `flow-gospel-ref`/`flow-gospel-body`.
- **Endpoints:** `POST /api/preview`, `GET /api/readings/{date}`, `GET /api/catalog/songs?lite=1`,
  `GET /api/image-quota`, `GET /api/poster-exists`, `POST /api/upload/mass-divider`,
  `POST /api/upload/announcement-slide`, `POST /api/generate`, `POST /api/regenerate-pptx`.
- **Tell Stitch:** a guided builder with a 5-step progress stepper, a Setup form (date, celebrant,
  liturgy choices, stewardship, media uploads, AI poster options) and a Songs tab (per-section song
  slots, recommendations, language filter), plus a sticky generate dock and a result receipt modal.

### 2.5 Liturgical Calendar — `#calendar-page` (`/mass/calendar`)
- **Selects:** none.
- **Key interactive IDs:** `cal-prev`, `cal-next`, `btn-cal-use-date`, `btn-cal-generate`;
  "read more" toggles via `data-target`.
- **Dynamic regions:** `cal-month-label`, `cal-dow-row`, `cal-grid`, `cal-month-status`,
  `cal-detail` (`cal-detail-date`/`-title`/`-season`/`-color`), reading cards
  `cal-gospel-ref`/`-excerpt`, `cal-psalm-ref`/`-excerpt`, `cal-reading1-ref`/`-excerpt`,
  `cal-reading2-ref`/`-excerpt`.
- **Endpoints:** `GET /api/calendar/month?year=&month=`, `GET /api/readings/{date}`.
- **Tell Stitch:** month grid with prev/next, day detail panel (season/color), readings preview,
  "use this date" / "generate" actions.

### 2.6 Posters / Media — `#posters-page` (`/media/posters`)
- **Selects:** `poster-openai-poster-style`, `poster-template`.
- **Key interactive IDs:** `poster-mass-date`, `poster-celebrant`, `poster-gospel-quote`,
  `poster-include-social`, `poster-use-openai-poster`, `poster-use-gemini-poster`,
  `saved-poster-upload`, `btn-poster-sync`, `btn-poster-generate`.
- **Dynamic regions:** `poster-ai-quota-hint`, `poster-status`, `saved-poster-status`,
  `saved-poster-list`, live preview `poster-live-preview` (`poster-prev-kicker`/`-title`/
  `-quote`/`-meta`), download anchors `poster-dl-png`, `poster-dl-169`, `poster-dl-zip`.
- **Endpoints:** `GET /api/saved-posters`, `POST /api/upload/saved-poster`,
  `DELETE /api/saved-posters/{name}`, `GET /api/image-quota`, `GET /api/poster-exists`,
  `POST /api/generate`.
- **Tell Stitch:** poster generator with live preview, AI vs liturgical template choice,
  quota hint, saved-poster gallery with upload/delete, download buttons.

### 2.7 Downloads History — `#history-page` (`/media/history`)
- **Dynamic region:** `history-list` (browser-local only; no network).
- **Tell Stitch:** a list/grid of past downloads with re-download links. No backend.

### 2.8 Collections — `#collections-page` (`/library/collections`)
- **Key interactive IDs:** `btn-collections-open-library`, `btn-collections-open-builder`,
  `collections-catalog-search`.
- **Dynamic regions:** `collections-recent-songs`, `collections-catalog-root`.
- **Endpoints:** `GET /api/catalog/songs?lite=1`.
- **Tell Stitch:** a hub linking to library/builder + a recent-songs and searchable catalog view.

### 2.9 Templates (PPTX import) — `#templates-page` (`/design/templates`)
- **Key interactive IDs:** `template-pptx-upload`, `btn-analyze-template-pptx`,
  `template-analyze-status`.
- **Endpoints:** `POST /api/design/analyze-template` (multipart `file`, superadmin).
- **Tell Stitch:** a drag-drop .pptx uploader with analysis result/status. (Superadmin only.)

### 2.10 Settings — `#settings-page` (`/settings/church` + `/settings/app`)
Two panels toggled via `data-settings-panel` (`church` / `appearance`).

**Church (`settings-panel-church`):**
- IDs: `church-logo-avatar` (+ `-img`/`-placeholder`), `settings-church-name`
  (+ `settings-church-name-hint`, `settings-church-logo-hint`), `church-logo`, `btn-upload-logo`,
  branding checkboxes `flow-include-church-logo`, `flow-include-church-name`, `flow-hide-footer`,
  celebrants (`settings-celebrant-list`, `settings-celebrant-new`, `btn-settings-celebrant-add`),
  `btn-submit-parish-name`, `btn-save-community-api`, `settings-church-status`, `logo-status`.
- Superadmin: `settings-admin-memberships`, `settings-admin-pending-list`,
  `settings-admin-pending-songs`, `settings-admin-pending-priests`, `settings-admin-status`.
- Endpoints: `GET/POST /api/community`, `POST /api/community/profile`,
  `POST /api/community/submit-parish`, `POST /api/submissions/priest`, `POST /api/upload-logo`,
  `GET /api/admin/memberships/pending`, `POST /api/admin/memberships/{id}/approve|reject`,
  `GET /api/admin/submissions/songs/pending`, `GET /api/admin/submissions/priests/pending`,
  `POST /api/admin/submissions/{kind}/{id}/approve|reject`.

**Appearance (`settings-panel-app`):**
- Radio groups: `name="theme-preference"` (light/dark/oled/system),
  `name="toggle-dark-preference"` (dark/oled), `name="visual-style"`
  (missalette/parchment/midnight).
- Accent: `.accent-swatch` (`data-accent`/`data-accent-glow`/`data-accent-default`),
  `app-accent-color`, `btn-reset-accent`.
- Gemini key (superadmin): `settings-gemini-api-key`, `btn-save-gemini-api-key`,
  `settings-gemini-api-key-hint`, `settings-gemini-status`.
- Home news toggles: `settings-home-news-enabled`, `settings-home-news-vatican`,
  `settings-home-news-cna`.
- Nav tabs: `settings-nav-tabs-list` (checkboxes via `data-nav-tab-toggle`).
- EWTN radio: `settings-live-radio`, `settings-radio-list` (`data-ewtn-radio-id`),
  `settings-radio-status`.
- Buttons: `btn-app-open-mass`, `btn-app-open-theme`.
- Endpoints: `GET/POST /api/settings/gemini-api-key`, `GET /api/ewtn/radio`.

---

## 3. Full API reference

Auth tiers: **public** (none) · **opt** (`optional_session`, never blocks) ·
**session** (`require_session_when_auth`, 401 if no session) ·
**member** (`require_approved_membership`, 401/403) · **admin** (`require_superadmin`, 403).
When auth is disabled (no Supabase), all tiers fall back to anonymous.

### Mass generation
| Method + Path | Request | Response keys | Auth |
|---|---|---|---|
| `POST /api/preview` | `{date, readings_only=false}` | `ok, error, title, gospel_reference, season, lectionary_cycle, liturgical_color{color_name,hex,season,rgb}, gospel_text_length, sentences, sentence_count, quote_attribution, songs_by_section, gospel_quote, default_song_selections, estimated_slide_count, first_reading_reference, first_reading_excerpt, second_reading_reference, second_reading_excerpt, psalm_text, psalm_reference, psalm_refrains, gospel_text` | public |
| `POST /api/generate` | `GenerateBody` (below) | `ok, title, gospel_reference, slide_excerpt, gospel_quote, liturgical_color{...}, selected_songs, slide_count, export_stem, pptx_url?, pdf_url?, pdf_message?, poster_url?, poster_ppt_url?, ai_poster_urls{}, zip_url?` | member |
| `POST /api/regenerate-pptx` | `GenerateBody` | `ok, slide_count, export_stem, pptx_url, title` | member |
| `POST /api/ppt-preview/refresh` | — | `ok, mode(image|text), slides[], message` | member |

**`GenerateBody`** (shared by generate + regenerate):
```
date: str (YYYY-MM-DD)
celebrant: str
co_celebrant: str = ""
sentence_index: int? (>=0)
poster_template: str = "liturgical_color"   # | classic_white
include_social_exports: bool = false
export_pdf: bool = false
include_gospel_art: bool = true
include_ai_mass_poster: bool = false
ai_poster_backend: str = "openai"           # openai | gemini
ai_poster_style: str = "cinematic"
reuse_existing_poster: bool = false
community_name: str?
songs: SongSelection?
custom_theme: dict?
divider_poster_basename: str?
lotw_poster: str = "lotw1"                   # lotw1..lotw4
lote_poster: str = "lote1"                   # lote1..lote4
announcement_basenames: list[str] = []
mass_collection_amount: str?
mass_collection_currency: str? = "PHP"       # PHP | KRW | MYR
mass_collection_date_label: str?
food_sponsors: list[str] = []
psalm_text_override: str?
psalm_refrain_index: int? (>=0)
psalm_response_override: str?
gospel_quote_override: str?
hymn_typography: dict?
include_church_logo: bool = false
include_church_name: bool = false
include_footer: bool = true
hymn_lyric_overrides: dict[str, dict[str,str]]?    # {section: {song_id: lyrics}}
hymn_layout_overrides: dict[str, dict[str,str]]?   # {section: {song_id: "single"|"dual"}}
creed_choice: str = "nicene"                 # nicene | apostles
our_father_choice: str = "english"           # english | malay | tagalog | visaya | korean
hymn_lyrics_layout: str = "single"           # single | dual
```
**`SongSelection`** (the `songs` field):
```
entrance, offertory, communion_1, communion_2, recessional, meditation: str?  (each optional)
extra_sections: list[ExtraSongSection]?      # ExtraSongSection = {label: str, song_id: str}
```

### Posters / media / AI images
| Method + Path | Request | Response | Auth |
|---|---|---|---|
| `POST /generate-image` | `{prompt}` | `{image (base64), path}` | member |
| `GET /api/image-quota` | — | `{limit, used, remaining, resets_on, timezone, allowed}` | opt |
| `GET /api/poster-exists` | query `date`, `style="cinematic"` | `{exists}` | public |
| `POST /api/upload/mass-divider` | multipart `file` | `{ok, basename, url}` | member |
| `POST /api/upload/announcement-slide` | multipart `file` | `{ok, basename, url}` | member |
| `POST /api/upload/saved-poster` | multipart `file` | `{ok, basename, url}` | member |
| `GET /api/saved-posters` | — | `{ok, posters[]{basename,url}}` | member |
| `DELETE /api/saved-posters/{basename}` | path `basename` | `{ok}` | member |
| `POST /api/design/analyze-template` | multipart `file` (.pptx) | theme tokens (`ok` + fields) | admin |

### Songs / library
| Method + Path | Request | Response | Auth |
|---|---|---|---|
| `GET /api/catalog/songs` | query `lite=true`; header `If-None-Match` | lite: raw JSON + `ETag` (304 if match); full: `{ok, catalog}` | session |
| `GET /api/catalog/songs/{section}/{hymn_id}` | path | `{ok, section, song{id,title,author,language,lyrics,gospel_moods}}` | session |
| `PATCH /api/catalog/songs/{section}/{hymn_id}` | `{title?,author?,lyrics?,language?,gospel_moods?}` | `{ok,...}` | admin |
| `DELETE /api/catalog/songs/{section}/{hymn_id}` | path | `{ok}` | admin |
| `POST /api/songs/refresh` | `{date, section, current_ids=[]}` | `{ok, section, songs}` | admin |
| `POST /api/songs/refresh-all` | `{date, current_ids={}}` | `{ok, songs_by_section}` | admin |
| `POST /api/songs/import` | `{entrance[], offertory[], communion[], recessional[]}` | `{ok,...}` | admin |
| `POST /api/songs/import-list` | `{songs:[{title, language="English", mass_part=[]}]}` | `{ok,...}` | admin |
| `POST /api/songs/fetch-lyrics` | `{selections:[{section,id}]}` | `{ok, updated, skipped, results[]}` | admin |
| `POST /api/lyrics/save` | `{title, lyrics, sections=[], language="English", author=""}` | `{ok,...}` | session |

### Community / parish
| Method + Path | Request | Response | Auth |
|---|---|---|---|
| `GET /api/community` | — | `{ok, community_name, celebrant_names, logo_url, + membership}` | session |
| `POST /api/community` | `{community_name}` | same as GET | session |
| `POST /api/community/submit-parish` | `{community_name}` | same as GET (503 if not signed in) | session |
| `POST /api/community/profile` | `{community_name?, celebrant_names?}` | same as GET (400 if no fields) | member |
| `POST /api/submissions/priest` | `{name}` | admin: `{ok, celebrant_names, ...}`; else submission result | session |
| `POST /api/upload-logo` | multipart `file` | `{ok, logo_url, message, + membership}` (409 if locked) | session |

### Settings
| Method + Path | Request | Response | Auth |
|---|---|---|---|
| `GET /api/settings/gemini-api-key` | — | `{configured, key_hint}` | public |
| `POST /api/settings/gemini-api-key` | `{api_key}` | `{ok, configured, key_hint, key_format_warning}` | admin |

### Admin / approvals (all admin)
`GET /api/admin/memberships/pending` → `{ok, pending}` ·
`POST /api/admin/memberships/{user_id}/approve|reject` → `{ok, church_profile}` ·
`GET /api/admin/submissions/songs/pending` → `{ok, pending}` ·
`POST /api/admin/submissions/songs/{id}/approve|reject` ·
`GET /api/admin/submissions/priests/pending` → `{ok, pending}` ·
`POST /api/admin/submissions/priests/{id}/approve|reject`.

### News / radio / calendar / readings
| Method + Path | Request | Response | Auth |
|---|---|---|---|
| `GET /api/catholic-news` | query `vatican=true, cna=true, limit=6, offset=0, max_age_days=3` | `{ok, items[], errors[]}` | public |
| `GET /api/wyd-news` | query `limit=6` | `{ok, items, errors, event_start, event_end, location, days_until, official_url}` | public |
| `GET /api/ewtn/radio` | — | radio catalog payload | public |
| `GET /api/calendar/month` | query `year`, `month` (required) | calendar month payload (400 on bad input) | public |
| `GET /api/readings/{date}` | path `YYYY-MM-DD` | readings snapshot (`ok` + readings; `Cache-Control`) | opt |
| `GET /api/gospel-image/{date}` | path | `{ok, + image fields}` | public |

### Auth / files / health
| Method + Path | Response | Auth |
|---|---|---|
| `GET /api/auth/config` | Supabase config payload | public |
| `GET /api/auth/me` | `{authenticated, auth_enabled, user_id, email, first_name, last_name, image_url, role, profile, church_profile, membership, supabase_error?}` | opt |
| `GET /sign-in`, `GET /sign-up` | `auth.html` (503 if auth disabled) | public |
| `GET /api/files/media/{path}`, `/api/files/uploads/{path}`, `/api/files/preview/{filename}` | `FileResponse` | session |
| `GET /health` | `{status:"ok"}` | public |
| `GET /api/input-limits` | int map of field length limits | public |

---

## 4. Stitch handoff checklist

Per screen, hand Stitch:
- [ ] Screenshot(s) of the current screen + each state (loading / empty / error / "limit reached").
- [ ] The screen's purpose and the list of controls (from §2).
- [ ] Real sample content (song titles, poster cards, readings) so layouts are realistic.
- [ ] Your brand/theme direction (see `.cursor/skills/design-system` + `brand` tokens).

When integrating the returned design:
- [ ] Wrap each screen in `<section class="page" data-route="/…">`.
- [ ] Re-apply every required `id` from §2 (or refactor JS — Strategy B).
- [ ] Preserve the `data-*` vocabulary from §1.
- [ ] Keep file downloads as `<a href="/api/files/…">` anchors.
- [ ] Author the missing `/radio` page if you want that route to render.
- [ ] Verify each screen's endpoints still return the field names in §3.

## 5. Known structural gaps to fix during redesign
1. **No `/radio` page** — author it (IDs `radio-page-layout`, `radio-page-list`, `radio-page-play`,
   `radio-page-prev`, `radio-page-next`, `radio-page-station-title`, `radio-page-art`,
   `radio-page-channel-pos`, `radio-page-status` are already referenced by JS).
2. **Single 23.5k-line file** — consider extracting inline JS into `static/js/` modules during
   the redesign so the new markup and logic aren't in one file.
3. **ID-coupling fragility** — Strategy B (`data-action`/`data-field` + delegation) removes the
   "rename an id → silent breakage" risk for future redesigns.
