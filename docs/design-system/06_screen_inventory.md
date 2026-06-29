# 06 · Screen Inventory

> Source: `REDESIGN_INTEGRATION_CONTRACT.md §2`, `STITCH_DESIGN_BRIEF.md`, markup in `templates/index.html`.
> Every screen the app renders. For each: Purpose · Primary action · Secondary actions · Components ·
> User goal · Inputs · Outputs · Error/Loading/Empty states · Accessibility · Visual hierarchy ·
> Navigation destination · Dependencies.

Global states to design for **every** screen: **loading (skeleton) · empty · error · success**, plus
**limit-reached** wherever the AI image quota applies. Persistent shell (header + nav + toasts) on all.

---

## 0. App shell (persistent, every screen)
- **Purpose:** Identity, global search, status, theme, account, navigation.
- **Primary action:** **+ Create** (berry CTA).
- **Secondary:** global search (⌘K), radio pill, season indicator, notifications, theme toggle, account menu.
- **Components:** header (frosted), sidebar/bottom nav, command palette, toast stack, Mass Builder stepper (only on `/mass/builder`).
- **Dependencies:** `/api/auth/me`, `/api/auth/config`, `/api/ewtn/radio`, season state.

---

## 1. Home — `#home-page` (`/home`)
- **Purpose:** Calm overview of today + upcoming Sunday + parish life.
- **Primary action:** Create event (`btn-home-create-event`) / tap a reading to expand.
- **Secondary:** refresh news (`btn-home-news-refresh`), expand news, open reading modal.
- **Components:** reflection hero (bg image + verse), upcoming-Sunday gospel card, 3 reading tiles, events board, news feed (collapsible), membership banner, event modal, reading expand modal, news expand modal.
- **User goal:** Orient; jump into building or reading.
- **Inputs:** event name/date-range/time (modal); news refresh.
- **Outputs:** rendered reflection, readings, events, news.
- **States:** loading (skeletons on reflection/readings/news), empty (no events → `home-events-empty`; news empty), error (fetch fail → status text), success (content + stagger reveal).
- **A11y:** reading tiles are buttons (`aria-`), modals trap focus, news refresh has loading state.
- **Visual hierarchy:** reflection hero (largest) → Sunday gospel → readings → events → news → banner.
- **Nav destination:** reading modal; event modal; Create → Builder/Library.
- **Dependencies:** `GET /api/readings/{date}`, `/api/gospel-image/{date}`, `/api/catholic-news`, `/api/wyd-news`.

## 2. Song Library + lyrics editor — `#lyrics-page` (`/library/songs`)
- **Purpose:** Browse/search songs; compose & structure lyrics.
- **Primary action:** Save lyrics (`btn-save-lyrics`).
- **Secondary:** analyze (`btn-analyze-lyrics`), normalize, clear, focus metadata, quick-add blocks (`data-add-type`), upload `.txt` (drag-drop `lyrics-drop-zone`), edit/delete (modals).
- **Components:** catalog (searchable list + clear), recent-edited list, composer (title/author, language select, section select, free-text area, structured block editor with verse/chorus/bridge/response blocks, reorder/duplicate/delete via `data-action`), word/stats readout, detected-structure hint, metadata modal, delete-confirm modal.
- **User goal:** Add/refine a song for use in the Mass.
- **Inputs:** title, author, language (English/Tagalog/Latin/Mix), section (entrance/offertory/communion/recessional/meditation), lyrics text/blocks, `.txt` file.
- **Outputs:** saved song; analyzed structure.
- **States:** loading (catalog), empty (no songs / no search results), error (save fail → `lyrics-status` / hint `.error`), success (`.ok` hint, toast).
- **A11y:** structured blocks keyboard-operable; selects accessible (`vb-select`); drag-drop has button fallback (file input).
- **Visual hierarchy:** two-pane: catalog (left) → composer (right, dominant).
- **Nav destination:** stays on page; feeds songs into Builder.
- **Dependencies:** `GET /api/catalog/songs?lite=1`, `GET/PATCH/DELETE /api/catalog/songs/{section}/{id}`, `POST /api/lyrics/save`.

## 3. Theme Lab — `#theme-page` (`/design/theme-lab`)
- **Purpose:** Preview slide theme; render a real deck thumbnail grid.
- **Primary action:** Render actual deck / refresh preview (`btn-ppt-preview-refresh`).
- **Secondary:** none significant.
- **Components:** live simulated slide (`theme-live-preview`), rendered-deck thumbnail grid (hidden until generated), status line.
- **User goal:** Validate how slides will look.
- **Inputs:** current theme state.
- **Outputs:** preview slides; status.
- **States:** loading (rendering), empty (grid hidden pre-generation), error (status), success (grid filled).
- **A11y:** status `aria-live`; thumbnails labeled.
- **Visual hierarchy:** live preview → thumbnail grid → status.
- **Dependencies:** `POST /api/ppt-preview/refresh`.

## 4. Mass Builder — `#flow-page` (`/mass/builder`) — ★ most complex
- **Purpose:** Guided creation of the full Mass package.
- **Primary action:** **Generate full Mass package** (`btn-generate-flow` / `-inline`).
- **Secondary:** load readings & songs (`btn-load-flow`/`-inline`), step navigation, recommendations refresh/add, add custom song, uploads, poster pickers, regenerate.
- **Components:** header stepper (5 steps), inner tabs (Setup/Songs), setup bento cards (Basics, Readings, Stewardship, Media), celebrant picker, many `vb-select`s, food-sponsor chips, poster pickers (LOTW/LOTE ×4), AI poster toggles + style + quota hint, uploads (divider/announcements), song-plan slots + language filter + hymn layout radios + recommendations + progress meter + gospel-mood tip, persistent readings sidebar, sticky generate dock, full-screen loader, receipt modal, hidden download anchors.
- **User goal:** Produce a complete, correct Mass deck (+ posters/PDF).
- **Inputs:** date, celebrant/co-celebrant, liturgy choices (penitential/Kyrie/Gloria/Creed/Our Father/Lamb/psalm refrain/gospel sentence + custom), stewardship (currency/date/amount/sponsors/peace message), media (posters, AI toggles, style, uploads, PDF), songs per section, layout, language.
- **Outputs:** receipt with ZIP/PPTX/PDF/poster/social download links; estimated slide count.
- **States:** loading (readings load, generation full-screen loader w/ status), empty (no celebrants → picker empty, no readings yet), error (generation fail, validation), success (receipt modal), **limit-reached** (AI quota disables AI poster, `flow-ai-quota-hint`).
- **A11y:** stepper `aria-current`; selects accessible; loader/receipt `aria-live`/dialog; readings sidebar landmarks; uploads labeled.
- **Visual hierarchy:** stepper → current step content → readings sidebar → sticky generate dock.
- **Nav destination:** receipt downloads; "Edit" jumps to steps; generation overlay.
- **Dependencies:** `POST /api/preview`, `GET /api/readings/{date}`, `GET /api/catalog/songs?lite=1`, `GET /api/image-quota`, `GET /api/poster-exists`, `POST /api/upload/mass-divider`, `/api/upload/announcement-slide`, `POST /api/generate`, `POST /api/regenerate-pptx`.

## 5. Liturgical Calendar — `#calendar-page` (`/mass/calendar`)
- **Purpose:** Browse the liturgical year; inspect a day's readings/season.
- **Primary action:** Use this date (`btn-cal-use-date`).
- **Secondary:** generate (`btn-cal-generate`), prev/next month, "read more" expand.
- **Components:** month grid (`cal-grid`), weekday row, month status line, day-detail panel (date/title/season/color), reading preview cards (gospel/psalm/1st/2nd).
- **User goal:** Pick the right Sunday and confirm readings/season.
- **Inputs:** month navigation, day selection.
- **Outputs:** day detail + readings; feeds date to Builder.
- **States:** loading (month), empty (no detail until a day picked), error (status), success.
- **A11y:** grid keyboard nav, day labels, prev/next labeled.
- **Visual hierarchy:** month grid → day detail → readings.
- **Nav destination:** "use this date" → Builder; "generate" → generation.
- **Dependencies:** `GET /api/calendar/month?year=&month=`, `GET /api/readings/{date}`.

## 6. Posters / Media — `#posters-page` (`/media/posters`)
- **Purpose:** Generate/manage posters & social images.
- **Primary action:** Generate poster (`btn-poster-generate`).
- **Secondary:** sync (`btn-poster-sync`), upload saved poster, delete, download (PNG/16:9/ZIP).
- **Components:** inputs (date, celebrant, gospel quote, include-social toggle), AI vs template choice (two AI backends + style select, quota hint, limit-reached; or `poster-template` select), live preview (kicker/title/quote/meta), saved-poster gallery (upload/delete + status), download anchors.
- **User goal:** Produce a poster for the Mass/event.
- **Inputs:** date, celebrant, quote, toggles, style, uploaded images.
- **Outputs:** preview + downloadable files; saved gallery.
- **States:** loading (generating), empty (no saved posters), error (status), success, **limit-reached** (`poster-ai-quota-hint`).
- **A11y:** preview labeled, gallery items have delete labels, quota status `aria-live`.
- **Visual hierarchy:** inputs → choice → live preview → gallery → downloads.
- **Dependencies:** `GET /api/saved-posters`, `POST /api/upload/saved-poster`, `DELETE /api/saved-posters/{name}`, `GET /api/image-quota`, `/api/poster-exists`, `POST /api/generate`.

## 7. Downloads History — `#history-page` (`/media/history`)
- **Purpose:** Re-download previously generated files (browser-local only).
- **Primary action:** Re-download a file.
- **Components:** `history-list` (rows: filename, timestamp, link).
- **States:** empty (friendly empty state), success (list). No network/loading/error.
- **A11y:** links labeled.
- **Visual hierarchy:** simple list/grid.
- **Dependencies:** none (localStorage).

## 8. Collections — `#collections-page` (`/library/collections`)
- **Purpose:** Hub linking library + builder; recent songs; searchable catalog.
- **Primary action:** Open Library (`btn-collections-open-library`) / Open Builder (`btn-collections-open-builder`).
- **Secondary:** search catalog (`collections-catalog-search`).
- **Components:** quick-link cards, recent-songs strip, catalog view.
- **States:** loading (catalog), empty (no songs/results), success.
- **A11y:** quick links are buttons/links.
- **Dependencies:** `GET /api/catalog/songs?lite=1`.

## 9. Templates (PPTX import) — `#templates-page` (`/design/templates`) — superadmin
- **Purpose:** Import a `.pptx` to extract a theme.
- **Primary action:** Analyze template (`btn-analyze-template-pptx`).
- **Components:** drag-drop uploader (`template-pptx-upload`), analyze button, status/result area (`template-analyze-status`).
- **States:** idle, analyzing (loading), error, success (extracted theme).
- **A11y:** drop zone has file-input fallback; status `aria-live`. Utilitarian by design.
- **Dependencies:** `POST /api/design/analyze-template` (multipart, admin).

## 10. Settings — `#settings-page` (`/settings/church` + `/settings/app`)
Two panels via `data-settings-panel`.

### 10a. Church (`settings-panel-church`)
- **Purpose:** Parish identity, branding, celebrants; admin approvals.
- **Primary action:** Save parish (`btn-submit-parish-name` / `btn-save-community-api`).
- **Secondary:** upload logo, add/manage celebrants, branding toggles, admin approve/reject.
- **Components:** logo avatar + upload, name field + hint, branding checkboxes (logo/name/footer), celebrants list, admin moderation lists (memberships/songs/priests).
- **States:** loading, empty (no celebrants/pending), error (status), success.
- **A11y:** labeled fields, moderation actions labeled.
- **Dependencies:** `/api/community*`, `/api/upload-logo`, `/api/submissions/priest`, `/api/admin/*`.

### 10b. Appearance (`settings-panel-app`)
- **Purpose:** Theme, visual style, accent, news/nav toggles, radio; admin AI key.
- **Primary action:** Save preference / save Gemini key (admin).
- **Secondary:** pick theme/dark-variant/visual-style, accent swatches + reset, news toggles, nav-tab toggles, radio station list, quick open Builder/Theme.
- **Components:** radio groups (theme-preference, toggle-dark-preference, visual-style), accent swatches (`.accent-swatch`) + `app-accent-color` + reset, news toggles, nav-tab checkbox list, EWTN radio list + status, masked Gemini key input (admin).
- **States:** loading (radio list), empty, error, success.
- **A11y:** radio groups, swatch buttons labeled, masked input.
- **Dependencies:** `GET/POST /api/settings/gemini-api-key`, `GET /api/ewtn/radio`.

## 11. Radio — `/radio` ⚠ MISSING page
- **Purpose:** Full radio browser (today only the header pill exists).
- **Status:** **No `<section class="page" data-route="/radio">` exists.** JS references `radio-page-*` IDs.
- **`[RECOMMENDATION]`** Author it: station list/browser, now-playing (title + art), play/prev/next, channel position, status line. Match header pill styling.
- **Dependencies:** `GET /api/ewtn/radio`.

## 12. Auth — `auth.html` (`/sign-in`, `/sign-up`)
- **Purpose:** Sign in / sign up (Supabase).
- **Components:** auth form, aurora background (`auth-aurora-bg.js`), theme support.
- **States:** loading, error (auth disabled → 503), success.
- **Dependencies:** `GET /api/auth/config`, Supabase.

## 13. Landing — `landing.html` (marketing)
- **Purpose:** Public marketing page (separate aesthetic, Inter + Playfair + Material Symbols).
- **Note:** Marketing energy lives here, **not** inside the app. Out of scope for in-app consistency but shares Inter/Playfair type family.
