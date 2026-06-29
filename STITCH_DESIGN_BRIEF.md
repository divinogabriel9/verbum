# Stitch Design Brief — LiturgyFlow

A design-only brief safe to paste into Stitch (or any external design tool). It describes
**what each screen does, the controls on it, and the states to design** — with no API endpoints,
request/response schemas, auth details, or internal architecture.

---

## Product

**LiturgyFlow** — a web app for Catholic parishes to plan Mass, generate slide decks (PPTX) and
posters, manage a song/lyrics library, browse the liturgical calendar and daily readings, and
read Catholic news. Desktop-first with a responsive mobile layout (sidebar on desktop, bottom
tab bar + "More" sheet on mobile).

### Design direction
- Reverent, calm, modern. Clean typography, generous spacing, soft cards.
- Theme support: **light, dark, OLED, and system**; plus visual styles **missalette / parchment /
  midnight**; a user-selectable **accent color**.
- Palette: warm, sacred neutrals (ivory/parchment, deep charcoal/midnight) with a liturgical
  accent (gold or seasonal violet/green/red). Typography: a refined serif for headings paired with
  a clean sans for body/UI. Soft shadows, rounded cards, calm motion.

### Global shell (persistent on every screen)
- **Top header:** page title + breadcrumb + short route description; global search; a compact
  live‑radio player pill (play, prev/next, station art, settings); a liturgical season indicator
  with a countdown; a notifications bell with badge + panel; light/dark theme toggle; and an
  account menu (sign in / sign up / settings / sign out).
- **Navigation:** desktop left sidebar with a "Create" menu (new PPTX, event, poster, song,
  collection); mobile bottom nav with an overflow "More" sheet; a desktop "Jump to" screen
  selector. Some tabs are optional/toggleable (Media, Calendar, Design).
- **Toasts:** transient success/error notifications.

### States to design for every screen
Loading (skeletons), empty, error, and success. Where a daily AI image limit applies, also a
clear **"limit reached"** state.

---

## Screens

### 1. Home (dashboard)
A welcoming overview. Sections:
- **Today's reflection hero** — verse + reference + short reflection text over a Gospel-matched
  background image; date and image credit.
- **Upcoming Sunday** — Gospel quote + reference + Sunday label.
- **Sunday readings tiles** — First Reading, Second Reading, Responsorial Psalm (reference +
  excerpt; tappable to expand in a modal).
- **Events board** — list of parish events; empty state; a "Create event" button (opens a modal
  with name, date range via a calendar popover, and time).
- **News feed** — world Catholic headlines, collapsible/expandable, with a refresh control.
- **Membership banner** — contextual state banner (e.g., pending/approved).

### 2. Song Library (+ lyrics editor)
Two-pane layout:
- **Catalog (left):** searchable song list with clear-search; recently edited songs.
- **Composer (right):** title + author fields, language dropdown
  (English/Tagalog/Latin/Mix), section dropdown (entrance/offertory/communion/recessional/
  meditation), a free-text lyrics area, and a **structured block editor** (verse/chorus/bridge/
  response blocks that can be reordered, duplicated, deleted, and retyped). Quick-add buttons for
  block types. Drag‑and‑drop `.txt` upload. Actions: analyze, normalize, save, clear. Plus a
  word/stats readout and detected-structure hint.
- **Modals:** edit song metadata; confirm delete.

### 3. Theme Lab
A design preview workspace:
- A **live simulated slide** preview reflecting the current theme.
- A **rendered-deck thumbnail grid** (hidden until generated) with a "render actual deck" action
  and status text.

### 4. Mass Builder (most important, most complex)
A guided builder with a **5-step progress stepper**: Basics → Stewardship → Readings → Media →
Songs. Two inner tabs: **Setup** and **Songs**, plus a sticky bottom **generate dock**.

- **Setup tab:**
  - *Basics:* Mass date, celebrant picker (searchable, with a panel/list and empty state),
    co-celebrant.
  - *Liturgy choices (dropdowns):* penitential act, Kyrie, Gloria, Creed, Our Father, Lamb of God,
    Psalm refrain, Gospel sentence (plus custom overrides for psalm/gospel).
  - *Stewardship:* collection currency (PHP/KRW/MYR), date label, amount; a "sign of peace" message
    composer; food sponsors (add chips to a list).
  - *Media:* poster pickers (two themed sets), AI‑poster toggles (two backends) with a style
    dropdown and a **daily quota hint** (incl. limit‑reached state), divider image upload,
    announcement images upload, and an export‑PDF toggle.
- **Songs tab:**
  - Per-section **song plan slots**, a language filter dropdown, a hymn layout choice
    (single/dual), a recommendations panel (refresh + add), add-custom-song, song count + progress
    meter, and a Gospel-mood tip.
- **Readings sidebar:** First Reading, Psalm, Second Reading, and Gospel preview cards
  (reference + body).
- **Generate flow:** load + generate actions (in the dock and inline), a full-screen generation
  loader with status message, and a **result receipt modal** summarizing what was produced with
  download links (ZIP, PPTX, PDF, posters).

### 5. Liturgical Calendar
- A **month grid** with prev/next navigation, weekday header row, and a month status line.
- A **day detail panel:** date, title, liturgical season, and season color, plus readings preview
  cards (Gospel, Psalm, First Reading, Second Reading) with "read more" expansion.
- Actions: "use this date" and "generate".

### 6. Posters / Media
A poster generator:
- Inputs: Mass date, celebrant, Gospel quote, include-social toggle.
- Choice between **AI poster** (two backends + a style dropdown, with a daily quota hint and
  limit‑reached state) and a **liturgical template** dropdown.
- A **live poster preview** (kicker, title, quote, meta).
- A **saved-poster gallery** with upload and delete, plus status text.
- Download buttons (PNG, 16:9, ZIP).

### 7. Downloads History
A simple list/grid of the user's previously generated downloads with re-download links. Empty
state when there's nothing yet. (Local to the browser.)

### 8. Collections (hub)
A landing hub with: quick links to open the Library and the Mass Builder, a recent-songs strip,
and a searchable catalog view.

### 9. Templates (PPTX theme import)
A drag-and-drop **.pptx uploader** with an analyze action and a result/status area. (Power-user /
admin screen — keep it utilitarian.)

### 10. Settings
Two sub-panels with a settings sub-nav:
- **Church profile:** parish logo (avatar + upload), parish name (with hint text), branding
  toggles (include logo / include name / footer), a celebrants list (add/manage), and submit/save
  actions. *(An approvals area appears for admins — list of pending memberships, song submissions,
  and priest submissions, with approve/reject; design it as a clean moderation list.)*
- **Appearance:** theme preference (light/dark/OLED/system), dark-mode variant (dark/OLED), visual
  style (missalette/parchment/midnight), accent-color swatches + reset, home-news toggles,
  optional nav-tab toggles, and a live-radio station list with status. *(An AI key field appears
  for admins — design as a standard secured settings input with a save button and masked hint.)*

### 11. Radio (to be designed — currently missing)
A full radio screen: a station **list/browser**, a **now-playing** area (station title + art),
**play / prev / next** controls, channel position, and a status line. (Today radio only exists as
the small header pill; this screen needs to be created.)

---

## Handoff notes for Stitch
- Design **each screen as its own frame**, plus the shared **header** and **navigation** (desktop
  sidebar + mobile bottom nav + "More" sheet) as reusable components.
- Provide **light and dark** variants.
- Include the **states** listed above (loading / empty / error / success / limit‑reached).
- Use realistic sample content (real song titles, readings text, poster mockups) so layouts feel
  true to production.

---

## Per-screen Stitch prompts (paste-ready)

Each block below is a self-contained prompt. Paste one at a time into Stitch. They all assume the
shared shell + design direction above; restate them in the first prompt or keep them pinned.

### Prompt 0 — Design system + app shell
> Design a calm, reverent web app called **LiturgyFlow** for Catholic parishes. Establish a design
> system: warm sacred neutrals (ivory/parchment + deep charcoal/midnight), a liturgical accent
> (gold, with seasonal violet/green/red variants), a refined serif for headings + clean sans for
> body, soft shadows, rounded cards. Provide **light and dark** themes. Then design the **app
> shell**: a top header with page title + breadcrumb, global search, a compact live-radio player
> pill (play/prev/next + station art + settings), a liturgical-season indicator with countdown, a
> notifications bell with badge + panel, a theme toggle, and an account menu. Add a desktop left
> sidebar with a "Create" menu (PPTX, event, poster, song, collection) and a mobile bottom tab bar
> with an overflow "More" sheet. Include a toast notification component.

### Prompt 1 — Home dashboard
> Design the **Home dashboard**. Include: a "today's reflection" hero (verse, reference, short
> reflection over a soft Gospel-themed background image, with date + image credit); an "upcoming
> Sunday" card (Gospel quote + reference); three readings tiles (First Reading, Second Reading,
> Responsorial Psalm — reference + excerpt, tappable to expand); an events board with an empty
> state and a "Create event" button; a collapsible Catholic news feed with refresh; and a
> contextual membership banner. Show loading skeletons and empty states.

### Prompt 2 — Song Library + lyrics editor
> Design a **Song Library** screen with a two-pane layout. Left: a searchable song catalog with a
> clear-search control and a "recently edited" list. Right: a lyrics composer with title + author
> fields, a language dropdown (English/Tagalog/Latin/Mix), a section dropdown
> (entrance/offertory/communion/recessional/meditation), a free-text lyrics area, and a structured
> block editor where verse/chorus/bridge/response blocks can be reordered, duplicated, deleted, and
> edited, with quick-add buttons. Include drag-and-drop .txt upload, analyze/normalize/save/clear
> actions, and a word-count/structure hint. Add modals for editing song metadata and confirming
> deletion.

### Prompt 3 — Theme Lab
> Design a **Theme Lab** workspace showing a live simulated slide preview that reflects the current
> theme, plus a rendered-deck thumbnail grid (with an empty/hidden state before generation), a
> "render actual deck" button, and a status line.

### Prompt 4 — Mass Builder (7-step wizard)
> Design a **Mass Builder** as a guided **7-step wizard** with a horizontal progress stepper at the
> top, a "Back / Continue" footer, and a sticky "Generate" action that activates on the final step.
> Each step asks a focused set of questions (see the full step-by-step questions in the
> "Mass Builder — 7-step wizard" section of this brief). The 7 steps are:
> **1) Mass Details** (date, celebrant, co-celebrant),
> **2) Order of the Mass** (penitential act, Kyrie, Gloria, Creed, Our Father, Lamb of God),
> **3) Readings & Psalm** (auto-loaded readings preview + psalm refrain + Gospel acclamation +
> Gospel quote selection, each with a custom override),
> **4) Stewardship & Notices** (collection currency/date/amount, food sponsors, sign-of-peace
> message, divider + announcement image uploads),
> **5) Posters & Branding** (two themed poster pickers, AI-poster toggle with backend + style +
> daily quota hint/limit-reached state OR a liturgical template, church logo/name/footer toggles,
> export-PDF toggle),
> **6) Song Plan** (language filter, single/dual hymn layout, per-section song slots — Entrance,
> Offertory, Communion 1, Communion 2, Meditation, Recessional, plus add-custom-section — a
> mood-based recommendations panel with refresh/add, and a song-count progress meter),
> **7) Summary & Receipt** — an editable review of every choice grouped by step, each group with an
> "Edit" link that jumps back to that step; show an estimated slide count; the primary "Generate"
> button triggers a full-screen loader with status, then a final receipt with download links
> (ZIP, PPTX, PDF, posters, social).
> Keep a readings sidebar/preview (First Reading, Psalm, Second Reading, Gospel) visible from
> step 3 onward. Design loading, empty, error, and limit-reached states.

### Prompt 5 — Liturgical Calendar
> Design a **Liturgical Calendar** screen: a month grid with prev/next navigation, a weekday header
> row, and a month status line; a day-detail panel showing date, title, liturgical season and
> season color, plus readings preview cards (Gospel, Psalm, First Reading, Second Reading) with
> "read more" expansion; and "use this date" + "generate" actions.

### Prompt 6 — Posters / Media
> Design a **Poster generator** screen. Inputs: Mass date, celebrant, Gospel quote, an
> include-social toggle. Provide a choice between an AI poster (two backends + a style dropdown,
> with a daily quota hint and limit-reached state) and a liturgical template dropdown. Show a live
> poster preview (kicker, title, quote, meta), a saved-poster gallery with upload + delete and
> status text, and download buttons (PNG, 16:9, ZIP).

### Prompt 7 — Downloads History
> Design a **Downloads History** screen: a clean list/grid of previously generated files with
> re-download links and timestamps, plus a friendly empty state.

### Prompt 8 — Collections hub
> Design a **Collections** hub: quick-link cards to open the Song Library and the Mass Builder, a
> recent-songs strip, and a searchable catalog view.

### Prompt 9 — Templates (PPTX import)
> Design a utilitarian **PPTX theme import** screen: a drag-and-drop .pptx uploader, an "analyze"
> button, and a result/status area showing extracted theme details.

### Prompt 10 — Settings
> Design a **Settings** screen with a sub-nav and two panels. Church profile: parish logo (avatar +
> upload), parish name with hint text, branding toggles (include logo / include name / footer), a
> celebrants list (add/manage), save actions, and a clean moderation list for admins (pending
> memberships, song submissions, priest submissions with approve/reject). Appearance: theme
> preference (light/dark/OLED/system), dark-mode variant, visual style
> (missalette/parchment/midnight), accent-color swatches + reset, home-news toggles, optional
> nav-tab toggles, a live-radio station list with status, and a secured settings input (masked,
> with save) for admins.

### Prompt 11 — Radio (new screen)
> Design a **Radio** screen: a station list/browser, a now-playing area (station title + art),
> play/prev/next controls, channel position, and a status line. Match the compact header radio
> player's styling but as a full page.

---

## Mass Builder — 7-step wizard (step-by-step questions)

This is the full questionnaire to hand Stitch for the Mass Builder. Six question steps, then a
seventh editable summary/receipt step. Each item lists the **question**, the **input type**, and
**options** where fixed. Design every step with Back / Continue, a progress stepper, and inline
validation. The Generate action only appears (enabled) on Step 7.

### Step 1 — Mass Details
The basics that everything else is built from.
- **What date is this Mass?** — date picker. *(Selecting a date auto-loads that day's readings,
  liturgical season, and color, shown from Step 3 onward.)*
- **Who is the main celebrant?** — searchable picker from the parish celebrant list, with an empty
  state and an "add a new celebrant" option.
- **Any co-celebrant(s)?** — optional text input.
- *Display only:* parish/community name and the detected liturgical season + color for the date.

### Step 2 — Order of the Mass
The sung/spoken ordinary parts. All dropdowns; default each to the most common option.
- **Penitential Act?** — dropdown (e.g., Form A / Form B / Form C).
- **Kyrie (Lord, have mercy)?** — dropdown (e.g., English / Greek / Sung setting).
- **Gloria?** — dropdown (e.g., Spoken / Sung / Omit during Advent–Lent).
- **Creed?** — dropdown: **Nicene** / **Apostles'**.
- **Our Father?** — dropdown: **English** / **Malay** / **Tagalog** / **Visaya** / **Korean**.
- **Lamb of God (Agnus Dei)?** — dropdown (e.g., English / Latin / Sung setting).

### Step 3 — Readings & Psalm
Readings auto-load from the date; this step is review + a few choices. Keep the readings preview
sidebar (First Reading, Psalm, Second Reading, Gospel) visible.
- **First Reading** — preview card (reference + text), read-only.
- **Responsorial Psalm refrain** — dropdown of detected refrains, **or** a "write a custom
  refrain" text field. Optional: a custom psalm response override.
- **Second Reading** — preview card, read-only.
- **Gospel** — preview card, read-only.
- **Gospel acclamation / sentence?** — dropdown of detected options, **or** a custom text field.
- **Gospel quote for the poster & title slide** — choose one sentence from the Gospel (selectable
  list), **or** type a custom quote.

### Step 4 — Stewardship & Notices
Optional parish updates and inserts.
- **Add a collection / stewardship update?** — currency dropdown (**PHP** / **KRW** / **MYR**), a
  date label, and an amount field.
- **Food sponsors / donors to thank?** — add multiple names as chips into a list (removable).
- **Sign of peace message?** — short message composer, plus an optional "breath / pause" line.
- **Upload a Mass divider image?** — image upload with status + thumbnail.
- **Upload announcement slide(s)?** — multi-image upload with status + thumbnails.

### Step 5 — Posters & Branding
How the visuals and branding look.
- **Liturgy of the Word poster** — pick from a set of themed options (4 thumbnails).
- **Liturgy of the Eucharist poster** — pick from a set of themed options (4 thumbnails).
- **Generate an AI Mass poster?** — toggle. When on: choose a backend (two options), a style
  dropdown, and show a **daily quota hint** with a clear **limit-reached** state that disables it.
  When off: choose a **liturgical template** from a dropdown instead.
- **Branding** — toggles: include church logo, include church name, show footer.
- **Also export a PDF?** — toggle.

### Step 6 — Song Plan
Build the hymn selection per part of the Mass.
- **Song language preference?** — language filter dropdown.
- **Hymn lyrics layout?** — choice: **single** column / **dual** column.
- **Choose songs per section** — a slot for each, each with search/select from the catalog,
  language tag, and a clear/replace control:
  - Entrance
  - Offertory
  - Communion 1
  - Communion 2
  - Meditation
  - Recessional
  - **+ Add another section** (custom label + song)
- **Recommendations** — a mood/Gospel-based suggestion panel with refresh and "add" actions.
- **Add a custom song** not in the catalog.
- *Display:* a song-count + completion progress meter and a Gospel-mood tip.

### Step 7 — Summary & Receipt (editable)
A single review screen confirming everything before generating.
- Show grouped summary cards, one per earlier step, each with an **"Edit"** link that jumps back to
  that step:
  - **Mass Details** — date, season/color, celebrant, co-celebrant.
  - **Order of the Mass** — penitential act, Kyrie, Gloria, Creed, Our Father, Lamb of God.
  - **Readings & Psalm** — psalm refrain, Gospel acclamation, chosen Gospel quote.
  - **Stewardship & Notices** — collection, sponsors, sign-of-peace message, uploaded
    divider/announcements (thumbnails).
  - **Posters & Branding** — selected posters, AI/template choice + style, branding toggles, PDF
    export.
  - **Song Plan** — the full per-section song list and layout/language.
- Show an **estimated slide count**.
- Primary action: **Generate** → full-screen loader with a status message → a final **receipt**
  with download links (ZIP, PPTX, PDF, posters, and social exports). Include a "regenerate" option.
