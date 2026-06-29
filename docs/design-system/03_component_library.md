# 03 · Component Library

> Reverse-engineered from `static/css/verbum-design-system.css`, inline styles in `templates/index.html`,
> `static/css/emil-motion.css`, and the wiring in `REDESIGN_INTEGRATION_CONTRACT.md`.
> Every component below is **System A (Verbum)**. For each: Purpose · Variants · States · Sizes · Spacing/Padding · Radius · Typography · Icons · Interactions · Accessibility.

Shared defaults (apply unless overridden): radius from §radius scale, transitions `150ms var(--ease-hover)`,
press `scale(0.97)`, focus ring `0 0 0 3px color-mix(--liturgical-accent 12%, transparent)`,
`prefers-reduced-motion` collapses all transforms.

---

## 1. Buttons

CSS classes: `.primary`, `.secondary`, `.ghost`, `.mini`, `.danger`, `.btn-create`, `.btn-xl`, `.uiverse-btn` (+ `--orange/--generate/--sm/.btn-xl`), `.pill`.

- **Purpose:** Trigger actions. Exactly **one `.primary` per screen** (the loudest action).
- **Variants:**
  - `.primary` — berry fill, white text. The single main CTA.
  - `.secondary` — white surface, hairline `--design-hairline-strong` border, ink text.
  - `.ghost` / `.mini` — transparent, hairline border; `.mini` is the compact size.
  - `.danger` — danger-tinted fill (`color-mix(--danger 8%, surface)`), danger text + border.
  - `.btn-create` — header "Create" CTA; berry/`--good` fill, no border.
  - `.btn-xl` — large primary (44px), used for big commitments (generate).
  - `.uiverse-btn` — legacy nested-markup button **flattened** to match DS; `--orange/--generate` paint the accent fill; `.is-disabled` for disabled.
  - `.pill` / `.song-filter-row button` — segmented filter chips (see §5 Pills/Tabs).
- **States:** rest / hover (primary→`--color-primary-active`; neutral→`--surface-2`) / active `scale(0.97)` / disabled `opacity .5, cursor not-allowed` / focus ring.
- **Sizes:** default `--btn-height` 40px; small `.mini`/`--sm` 32px (`--btn-height-sm`); xl 44px.
- **Padding:** `0 var(--btn-padding-x)` (18px); small `0 var(--space-3)`; xl `0 var(--space-5)`.
- **Radius:** `--radius-md` (8px); `.btn-xl` `--radius-md`.
- **Typography:** `--type-helper` (14px), weight 500 (primary) / 600 (secondary/ghost), `line-height 1.2`, tracking `--tracking-caption`.
- **Icons:** optional leading icon, 15–18px, inline-flex centered, gap `--space-2`.
- **Interactions:** hover lift `translateY(-1px)` (non-uiverse), press `scale(0.97)`.
- **Accessibility:** ≥40px target; real `<button>`; disabled removes pointer; focus-visible ring.

## 2. Cards

CSS: `.panel`, `.tool-card`, `.admin-card`, `.metric`, `.flow-bento-cell`, `.home-bento-cell`, `.cal-reading-card`, `.theme-card-wrap`, `.mass-song-plan-card`, `.snapshot-tile`.

- **Purpose:** Group related content on the grey canvas.
- **Variants:** content panel (`.panel`/`.tool-card`), admin card, metric (stat tile), bento cell, reading card, theme card, song-plan card.
- **States:** rest (`--apple-card-shadow-rest`) / hover (lift `translateY(-4px) scale(1.006)`, border → `color-mix(--ink 12%, --card-border)`, `--apple-card-shadow-hover`, `z-index:1`) / active (some cards `translateY(-2px) scale(0.992)`).
- **Sizes:** fluid (grid-driven). Metric padding `--space-4`.
- **Padding:** `--card-padding` (24px); metric/snapshot `--space-4` (16px).
- **Radius:** `--radius-lg` (12px effective); metric/snapshot `--radius-md`.
- **Typography:** card title `--type-card-title` (17px/600); body `--type-helper` muted.
- **Border:** `1px var(--card-border)`, no glass blur, `box-shadow: var(--shadow-light)` (≈none light, none dark).
- **Interactions:** Apple hover lift (320ms). Dark mode swaps shadow for a 1px ring.
- **Accessibility:** decorative hover only; reduced-motion removes transform.

## 3. Dialogs / Modals

CSS: `.modal`, `.modal-box`, `.ui-overlay`/`.ui-card`, `.ui-overlay__backdrop`, `.mass-gen-receipt-modal`, `reading-expand-modal`, `home-event-modal`, `song-metadata-modal`, `song-delete-modal`.

- **Purpose:** Focused tasks/confirmations over a scrim.
- **Variants:** standard (`--ui-card-width` 480px), receipt (600px), reading (900px), confirm-delete (compact).
- **States:** closed (`scale(0.95) translateY(8px)`, hidden) / open (`scale(1) translateY(0)`); backdrop fades.
- **Padding:** `.modal` wrapper `--space-4`; `.modal-box` `--space-5` (24px).
- **Radius:** `--radius-lg`.
- **Backdrop:** `--app-scrim` + `blur(--app-blur)` (12px).
- **Typography:** title `--type-section-title`/card-title; body `--type-body`.
- **Interactions:** center-origin scale-in 260ms `--ease-out`; close on backdrop click / `Esc` / close button.
- **Accessibility:** `role="dialog"`, focus trap, `aria-modal`, returns focus to trigger; backdrop click closable.

## 4. Bottom Sheets / Drawers

CSS: mobile "More" sheet, `.song-preview-panel__sheet`, sidebar drawer.

- **Purpose:** Mobile overflow nav ("More"), song preview, and side panels.
- **Variants:** mobile More sheet (bottom), song preview sheet (`--ease-drawer`), liturgical/notification popovers (top-anchored).
- **States:** hidden (translate off-axis + `scale(0.96)`) / open.
- **Easing:** `--ease-drawer cubic-bezier(0.32,0.72,0,1)`.
- **Padding:** head `--space-4 --space-5`; body `--space-4 --space-5 --space-5`.
- **Accessibility:** scrim, swipe/`Esc` dismiss, focus management, `aria-expanded` on trigger.

## 5. Tabs & Segmented controls

CSS: `.flow-builder-tabs` (+ `button[aria-selected]`), `.song-filter-row`, settings sub-nav `.settings-sidebar-link`.

- **Purpose:** Switch sub-views (Mass Builder Setup/Songs), filter lists, settings panels.
- **Variants:** pill segmented (`.flow-builder-tabs`: pill container, 2px padding, inner buttons `--radius-sm`), text sub-nav (settings), filter chips.
- **States:** rest (muted) / hover (ink + `--surface-solid`) / selected (`aria-selected="true"`: ink, weight 600, `--surface-solid` bg, light shadow).
- **Sizes:** inner button min-height 30px, padding `4px 12px`.
- **Typography:** `--type-helper` (14px), weight 500 → 600 active.
- **Accessibility:** `role="tab"`/`aria-selected`; `data-flow-tab`/`data-flow-panel` couple tab↔panel.

## 6. Inputs (text / textarea / date / file / search)

CSS: global `input/textarea/select`, `.song-composer-search-wrap input`, `.field`.

- **Purpose:** Free-form entry.
- **Variants:** text, date, file, search (with leading icon + clear button), textarea (resize-vertical), color.
- **States:** rest (hairline border) / focus (border → `color-mix(--liturgical-accent 40%, border)` + 3px ring) / disabled / placeholder (`--ink-subtle`/muted).
- **Sizes:** `--input-height` 44px; composer search 36px.
- **Padding:** `--space-2 --space-3` (8/12px); search adds `2.5rem` left for icon.
- **Radius:** `--radius-md`.
- **Typography:** `--type-body` (17px), `--leading-body`, `--tracking-body`.
- **Label:** `<label>` `--type-helper` 600, sentence case, `margin-bottom --space-2`.
- **Field spacing:** `.field margin-bottom --space-4`; `.field-grid gap --space-4`.
- **Accessibility:** associated `<label>`; visible focus ring; 44px target; `input-limits.js` enforces max lengths.

## 7. Checkboxes

CSS: native `input[type=checkbox]` with `accent-color: var(--liturgical-accent)`; branding/news/nav-tab toggles.

- **Purpose:** Multi-select / boolean options (include logo, news sources, nav-tab visibility).
- **Variants:** standalone checkbox + label; list of toggleable nav tabs (`data-nav-tab-toggle`).
- **States:** unchecked / checked (berry accent) / disabled / focus outline.
- **Accessibility:** real inputs, label association, keyboard toggle.

## 8. Switches (toggle)

CSS (System B / landing & wizard use Tailwind peer pattern): `.peer-checked:bg-primary` + `after:` knob; canonical app uses checkboxes/radios more than switches.

- **Purpose:** On/off settings (e.g., AI poster, export PDF, footer).
- **Variants:** Tailwind peer switch (track + sliding `after` knob, `translate-x-full` on check). **`[RECOMMENDATION]`**: define a single canonical switch component in System A tokens (current switches lean on Tailwind/System B styling).
- **States:** off / on (berry track) / disabled (`opacity-30`).
- **Sizes:** track `w-11 h-6`, knob `w-5 h-5`.
- **Accessibility:** `role="switch"` or checkbox + `aria-checked`; 44px hit area recommended.

## 9. Radio buttons

CSS: `name="theme-preference"`, `name="toggle-dark-preference"`, `name="visual-style"`, `name="flow-hymn-layout"`; `.theme-pref-option`.

- **Purpose:** Single-choice from a small set (theme, dark variant, visual style, hymn layout single/dual).
- **Variants:** native radio + label; styled `.theme-pref-option` card (`padding --space-3 --space-4`, `--radius-md`, weight 500).
- **States:** unselected / selected / focus.
- **Accessibility:** grouped by `name`, arrow-key navigation, labels clickable.

## 10. Dropdowns / Selects

CSS: `.vb-select` (custom), `.vb-dropdown-panel`, `.vb-dropdown-list/item`, `.app-menu-panel`, native `select`.

- **Purpose:** Choose one option (language, section, liturgy parts, currency, poster style, account menu).
- **Variants:**
  - **`.vb-select`** — custom accessible select: hidden native `.vb-select__native` + `.vb-select__trigger` (44px, chevron rotates 180° open) + `.vb-select__panel` (`.vb-dropdown-panel`). Modifiers: `--sm` (40px), `--pill` (compact colored chip used for lyric block type with verse/chorus/bridge/response color coding), `--drop-up`, `--wide`, `--right`.
  - **`.app-menu-panel`** — account/create menus; items with icon column + hint.
  - Native `select` — fallback, same input styling.
- **States:** trigger rest / hover (border darkens) / expanded (`aria-expanded`, berry ring) / active `scale(0.99)` / disabled (`opacity .55`); items: hover (`--ink 4%` mix), active/selected (`--good 8%` mix + 600), pressed `scale(0.99)`.
- **Panel:** `--radius-md`, `1px var(--line)`, `--vb-dropdown-shadow`, max-height `min(360px,52vh)` (wide `440px/62vh`); enter `scale(0.98) translateY(-4px) → scale(1)` 200ms.
- **Typography:** trigger `--type-body`; group label `0.65rem` 700 uppercase muted; item `--type-body`; hint `--type-helper` muted.
- **Accessibility:** `role="listbox"/"option"`, `aria-expanded`, `aria-selected`, keyboard (↑↓/Enter/Esc), focus-visible 2px outline, native fallback preserves form semantics.

## 11. Date Picker & Calendar

CSS: `.event-date-popover`, `.event-date-cal`, `.cal-grid`, `.cal-cell`, `.cal-dow-row`; native `input[type=date]` (`mass-date`, `poster-mass-date`).

- **Purpose:** Pick a Mass/event date; browse the liturgical month.
- **Variants:**
  - Native date input (Mass date, poster date) — `--input-height`, hairline, `--radius-md`.
  - **Event date popover** (`home-event-date-popover`) — calendar grid in a top-left-origin popover with start/end range.
  - **Liturgical calendar month grid** (`cal-grid`) — weekday header row (`cal-dow-row`), day cells (`cal-cell` `--radius-sm`), prev/next (`cal-prev`/`cal-next`), month status line.
- **States:** day rest / hover / selected / today / out-of-month / season-colored.
- **Accessibility:** keyboard grid navigation, `aria-label` per day, prev/next buttons labeled.

## 12. Stepper / Progress (wizard)

CSS: `mass-builder-stepper`, `mass-builder-stepper-list`, `--stepper-active: var(--liturgical-glow)`; `data-mass-step-target`.

- **Purpose:** Show/scrub the Mass Builder steps (Basics → Stewardship → Readings → Media → Songs; brief docs describe a 7-step variant — see [`05_navigation.md`](05_navigation.md)).
- **Variants:** horizontal stepper in header (shown only on `/mass/builder`).
- **States:** complete / current (`--stepper-active` glow) / upcoming; each step is a button scrolling to its anchor.
- **Accessibility:** buttons with labels, `aria-current` for active step, keyboard focusable.

## 13. Progress indicators

CSS: `mass-summary-progress`/`-fill`, `flow-song-count`, `mass-summary-song-total`; full-screen `mass-gen-loader` + `-msg`.

- **Purpose:** Song-plan completion meter; generation status.
- **Variants:** linear fill meter (song plan); full-screen generation loader (scrim + status message); refresh spinner (`emil-refresh-spin`).
- **States:** 0–100% fill; loader visible/hidden with live status text.
- **Accessibility:** `role="progressbar"` recommended; loader uses `aria-live` status.

## 14. Badges & chips

CSS: `.song-composer-recent-item__badge`, food-sponsor chips (`flow-food-sponsors-list`), filter pills, lyric-block type chips.

- **Purpose:** Status / category labels and removable tokens.
- **Variants:** static badge (uppercase fine, accent text), removable chip (sponsor names), filter pill, colored lyric-type chip (verse=violet, chorus=pink, bridge=green, response=gold).
- **Sizes:** badge `0.65rem` 700; pill `--btn-height-sm`.
- **Radius:** pill `--radius-md`; chips `--radius-pill` for `--pill` selects.
- **Accessibility:** removable chips have a labeled delete control.

## 15. Toast / Snackbar / Banner

CSS: `.toast`, `#toast-stack`, `home-membership-banner`.

- **Toast/Snackbar:** transient success/error. Render into `#toast-stack`. Enter `translateY(8px) scale(0.96) → 0`, 200ms `--ease-hover`. Padding `--space-3 --space-4`, `--radius-md`, weight 500. `.toast__close` micro transition. Accessibility: `aria-live="polite"`, auto-dismiss + manual close.
- **Banner:** `home-membership-banner` — contextual inline banner (pending/approved membership). Full-width card-style, dismissible/contextual.

## 16. Avatar

CSS: `church-logo-avatar` (+ `-img`/`-placeholder`), account menu icon column.

- **Purpose:** Parish logo / identity.
- **Variants:** image avatar, placeholder (initials/icon), upload control (`btn-upload-logo`).
- **Radius:** `--radius-md` (square-rounded).
- **States:** empty (placeholder) / set (image) / uploading (status `logo-status`).
- **Accessibility:** `alt` text, upload button labeled.

## 17. Timeline

- **Status:** No dedicated timeline component exists in canonical CSS. The closest analog is the **liturgical countdown** (`liturgical-countdown-item__label`) and the calendar month grid.
- **`[RECOMMENDATION]`** If a timeline is needed (e.g., Mass schedule, event history), build it on the card + hairline-divider system with `--space-4` vertical rhythm and berry node markers. Marked as a future component in [`18_future_components.md`](18_future_components.md).

## 18. Loading & Skeleton

CSS: `.emil-skeleton`, `emil-shimmer`, `.emil-stagger-enter`, `.is-refreshing`, `mass-gen-loader`.

- **Skeleton:** `background: color-mix(--muted 16%, --surface-2)`, `emil-shimmer 1.1s` opacity loop, `--radius-sm`.
- **Stagger enter:** content fades+scales in (`emil-content-enter`, opacity + `scale(0.98) translateY(4px)`).
- **Refresh state:** panel `opacity 0.94` + `pointer-events:none`; refresh icon spins.
- **Full-screen loader:** scrim + status message for generation.
- **Accessibility:** reduced-motion disables shimmer/stagger/spin; `aria-busy`/`aria-live` for status.

## 19. Search

CSS: `app-global-search` (+ `global-search-panel/list/empty/item`), `song-catalog-search`, `collections-catalog-search`, `.song-composer-search-wrap`.

- **Purpose:** Global command palette (⌘K), catalog search.
- **Variants:** header global search (dropdown of pages + actions + songs, grouped), inline catalog search (with clear button), composer search.
- **States:** empty / typing / results (grouped) / no results (`global-search-empty`).
- **Interactions:** ⌘K to open; clear button appears when text present.
- **Accessibility:** `role="combobox"/listbox`, keyboard nav, group labels, empty-state message.

## 20. Content-specific cards (the product's "card zoo")

All inherit the base **Card** anatomy (§2). They differ by content layout only.

| Card | Class / IDs | Purpose | Key fields |
|---|---|---|---|
| **Preview card** (reading) | `.reading-preview-card`, `flow-reading1-card`/`-ref`/`-body` | Show a reading reference + excerpt | ref (label), body (relaxed leading) |
| **Reading card** (calendar/home) | `.cal-reading-card`, `home-reading1-card`, `home-psalm-card` | Tappable reading tile | ref + excerpt, "read more" → modal |
| **Theme card** | `.theme-card-wrap`, `.theme-card-actions` | Choose/manage a slide theme | preview, actions (apply/delete `.danger-theme-del`) |
| **Template card** | poster pickers `data-poster-picker`, `data-target` | Pick LOTW/LOTE poster (4 thumbnails each) | thumbnail, selected state |
| **Mass card / song-plan card** | `.mass-song-plan-card` (`__title/__meta/__part`) | A song slot in the plan | title, section/part, language meta |
| **Reading sidebar cards** | `flow-gospel-preview-card` etc. | Persistent readings sidebar in builder | gospel/psalm/1st/2nd |
| **Song card** | catalog rows in `song-catalog-root`, `song-composer-recent-item` | Library list / recent | title, meta, badge |
| **Celebrant card** | `celebrant-list`, `settings-celebrant-list__item` | Pick/manage celebrant | name; add/empty state |
| **History card** | `history-list` rows | Past download | filename, timestamp, re-download link |
| **Event card** | `home-events-board` rows | Parish event | name, date range, time; empty state |
| **News card** | `home-news-list` rows | Catholic headline | title, source, link; refresh |
| **Metric** | `.metric` (`strong` + `span`) | Stat tile | value (ink 600), label (caption) |

For each: padding `--card-padding` (tiles `--space-4`), `--radius-lg`, hairline border, Apple hover lift, title `--type-card-title`, meta `--type-helper` muted. "Read more" toggles use `data-target` → expand modal. Accessibility: tappable cards are buttons/links with labels; lists have empty states.

---

## Component checklist (coverage)

Buttons ✓ · Cards ✓ · Dialogs ✓ · Bottom sheets ✓ · Tabs ✓ · Navigation ([`05`](05_navigation.md)) · Inputs ✓ · Checkboxes ✓ · Switches ✓ · Radios ✓ · Dropdowns ✓ · Date picker ✓ · Calendar ✓ · Stepper ✓ · Progress ✓ · Badges ✓ · Toast ✓ · Snackbar ✓ · Banner ✓ · Avatar ✓ · Timeline (recommendation) · Loading ✓ · Skeleton ✓ · Search ✓ · Preview/Theme/Template/Mass/Reading/Song/Celebrant/History cards ✓
