# Stitch Master Prompt — LiturgyFlow (paste once)

> Copy **everything inside the code block below** into Stitch as a single prompt. It contains the full
> design system + every screen. If Stitch truncates or drifts, split at the `=== SCREEN N ===` markers
> and paste in batches, re-pasting the `DESIGN SYSTEM` block first each time.
> After export, re-apply the `id`/`data-*` hooks from `REDESIGN_INTEGRATION_CONTRACT.md` (Stitch outputs static UI only).

```
Design a complete web app called LiturgyFlow — a calm, light, premium tool that helps Catholic
parishes build a full Sunday Mass package (slide decks, posters, song lyrics). Tone: reverent,
minimal, focused, beginner-friendly. Feel like Apple, Linear, Arc, Notion, Stripe. NOT Material
Design, NOT an enterprise dashboard. Whitespace is a feature. Provide LIGHT and DARK variants for
every screen, and design loading (skeleton) / empty / error / success / "AI limit reached" states.

============================== DESIGN SYSTEM (apply to ALL screens) ==============================
COLORS (use only these — invent none):
  canvas #EEF2F6 · surface #FFFFFF · surface-2 #F8FAFC · card-border #E4E9EF · line #E2E8F0
  ink #15333D · muted #5C6B75 · primary/berry #a10f0d · primary-hover #7a0b0a · on-primary #FFFFFF
  glow #d45250 · success-green #166534 · warn #B45309 · danger #9B3D4E
  DARK: bg #121212 · surface #1c1c1c · ink #fafafa · muted #b4b4b4 · primary #d45250
  Berry #a10f0d is SACRED: use it ONLY for the single primary button + active states. Max two
  accent colors on screen (berry + one liturgical season tint, e.g. ordinary-time green #166534).

TYPOGRAPHY: system stack (SF Pro / Inter) for UI + headings; Playfair Display ITALIC only for the
  wordmark. Sizes px: 34 display / 28 page title / 21 section / 17 body / 14 caption+label / 12 fine.
  Weights 400 body, 600 titles/labels. NEGATIVE tracking (-0.022em body, -0.016em caption). Leading
  1.47 body, 1.57 scripture. Labels are SENTENCE CASE. Never ALL-CAPS, never positive tracking,
  never fonts >34px, never Bricolage/Hanken/JetBrains/Material fonts.

SPACING (4px scale only): 4·8·12·16·24·32·48. Card padding 24. Section gap 24. Field gap 16.
RADIUS: sm 8 · md 8 · lg 12 · pill 999.
SIZES: button 40 (sm 32, xl 44) · input/select 44 · header 65 · content max 1536 · gutter 20–40 ·
  sidebar 72→220.
DEPTH: white cards floating on grey canvas, 1px hairline borders, radius 12. Depth = hairlines +
  a SUBTLE hover lift (move up 4px, scale 1.006, ~320ms). NO heavy drop shadows. NO glows in light
  mode. Never nest grey cards.
MOTION: ≤300ms, ease-out (cubic-bezier(0.23,1,0.32,1)), press scale 0.97, modals scale from 0.95 at
  center over a blurred scrim, popovers scale from their trigger. Honor reduced motion.

COMPONENTS (use ONLY these; compose, never invent a new style):
  Button (Primary berry / Secondary white+hairline / Ghost / Danger / Create), Card, Input/Textarea/
  Date, Select+Dropdown (trigger 44px, chevron rotates open; compact "pill" colored variant), Menu
  (icon column + hint), Tabs/segmented (selected = white+600+light shadow), Modal (480/600/900),
  Bottom sheet, Stepper (current step glows), Progress meter + full-screen generation loader, Toast,
  contextual Banner, Badge/Chip (incl. removable chips), Avatar (rounded-square logo + upload),
  Skeleton/shimmer, Search (header command palette ⌘K + inline catalog search with clear), and
  content cards (Reading, Theme, Template/poster-picker, Song-plan slot, Song, Celebrant, History,
  Event, News, Metric) — all are the Card with different content.

HIERARCHY & UX: exactly ONE berry primary action per screen. Group + label controls; pre-select
  sensible defaults; reveal complexity progressively. Friendly empty states with one action. Kind,
  blame-free errors with a fix. Touch targets ≥40px, visible focus rings, AA contrast, meaning never
  by color alone.

APP SHELL (persistent on every screen): fixed frosted top header with brand wordmark, global search
  (⌘K), a compact live-radio player pill (play/prev/next + station art), a liturgical-season
  indicator with countdown, a notifications bell + panel, a theme toggle, an account menu, a berry
  "+ Create" button, and nav tabs. Desktop: left sidebar (72→220px). Mobile: bottom tab bar + a
  "More" overflow sheet. Include a toast component. Nav groups: Home · Mass (Builder, Calendar) ·
  Library (Songs, Collections) · Media (Posters, History) · Design (Theme Lab, Templates) · Radio ·
  Settings (Church, Appearance).

Use realistic liturgical sample content (not lorem ipsum): readings like "First Reading — Isaiah
55:1–3", Psalm refrain "The hand of the Lord feeds us…", Gospel "Matthew 14:13–21"; songs "Table of
Plenty / One Bread, One Body / Here I Am, Lord"; celebrant "Fr. Miguel Santos"; season "Ordinary
Time" (green); date "Sunday, 3 Aug — 18th Sunday in Ordinary Time".

Now design these screens, each as its own frame (light + dark + the states above):

=== SCREEN 1 — Home (dashboard) ===
A calm overview. Sections: a "today's reflection" hero (verse + reference + short reflection over a
soft Gospel-themed background image, with date + image credit); an "upcoming Sunday" gospel card
(quote + reference); three reading tiles (First Reading, Second Reading, Responsorial Psalm — ref +
excerpt, tappable to expand in a modal); an events board with an empty state and a berry "Create
event" button (modal: name, date range via calendar popover, time); a collapsible Catholic news feed
with a refresh control; and a contextual membership banner (pending/approved). Layout = a 12-column
bento (gospel ~7 cols, events ~5 cols, readings full-width as 3 columns with hairline dividers).
Primary action: Create event. States: skeleton loading, empty events, news collapsed/expanded.

=== SCREEN 2 — Song Library + lyrics editor ===
Two-pane. Left: a searchable song catalog (with clear-search) + a "recently edited" list. Right: a
lyrics composer with title + author fields, a language dropdown (English/Tagalog/Latin/Mix), a
section dropdown (entrance/offertory/communion/recessional/meditation), a free-text lyrics area, and
a STRUCTURED block editor where verse/chorus/bridge/response blocks can be reordered, duplicated,
deleted, and retyped — each block has a small colored type chip (verse=violet, chorus=pink,
bridge=green, response=gold) and the chip uses sentence case. Quick-add buttons for block types.
Drag-and-drop .txt upload. Actions: analyze, normalize, save, clear, plus a word-count/structure
hint. Modals: edit metadata, confirm delete. Primary action: Save lyrics.

=== SCREEN 3 — Theme Lab ===
A design preview workspace: a live SIMULATED slide preview reflecting the current theme, a
rendered-deck thumbnail grid (hidden/empty until generated), a "Render actual deck" button, and a
status line. Calm and minimal.

=== SCREEN 4 — Mass Builder (most important, most complex) ===
A guided wizard with a horizontal progress stepper at the top, a persistent readings sidebar (First
Reading, Psalm, Second Reading, Gospel preview cards) from the readings step onward, and a sticky
bottom "Generate full Mass package" dock. Steps (Back / Continue between them):
  1) Mass Details — date picker (choosing a date auto-loads readings, season + season color),
     searchable celebrant picker (with empty state + "add celebrant"), optional co-celebrant.
  2) Order of the Mass — dropdowns, each defaulted: Penitential Act, Kyrie, Gloria, Creed
     (Nicene/Apostles'), Our Father (English/Malay/Tagalog/Visaya/Korean), Lamb of God.
  3) Readings & Psalm — read-only reading preview cards; Psalm refrain dropdown OR custom field;
     Gospel acclamation dropdown OR custom; choose a Gospel quote (selectable sentence) OR custom.
  4) Stewardship & Notices — collection (currency PHP/KRW/MYR + date label + amount), food-sponsor
     chips (removable), sign-of-peace message (+ optional breath line), divider image upload,
     announcement images upload.
  5) Posters & Branding — two themed poster pickers (Liturgy of the Word + Liturgy of the Eucharist,
     4 thumbnails each), an AI-poster toggle (backend choice + style dropdown + a DAILY QUOTA HINT
     with a clear "limit reached" disabled state) OR a liturgical-template dropdown, branding toggles
     (include logo / include name / show footer), export-PDF toggle.
  6) Song Plan — language filter dropdown, hymn layout (single/dual column radios), per-section song
     slots (Entrance, Offertory, Communion 1, Communion 2, Meditation, Recessional, + add custom
     section), a mood/Gospel-based recommendations panel (refresh + add), add-custom-song, and a
     song-count completion progress meter + a Gospel-mood tip.
  7) Summary & Receipt — editable review grouped by step, each group with an "Edit" link that jumps
     back; show an estimated slide count; the berry "Generate" triggers a FULL-SCREEN loader with a
     human-readable status message, then a final RECEIPT modal with download buttons (ZIP, PPTX, PDF,
     posters, social) and a "regenerate" option.
States: skeleton, empty (no celebrants/readings), error (generation failed), success (receipt),
AI-quota limit reached (AI poster disabled with a clear hint).

=== SCREEN 5 — Liturgical Calendar ===
A month grid with prev/next navigation, a weekday header row, and a month status line; a day-detail
panel showing date, title, liturgical season + season color, plus reading preview cards (Gospel,
Psalm, First Reading, Second Reading) with "read more" expansion; and "Use this date" + "Generate"
actions.

=== SCREEN 6 — Posters / Media ===
A poster generator. Inputs: Mass date, celebrant, Gospel quote, include-social toggle. A choice
between an AI poster (two backends + a style dropdown, with a daily quota hint + limit-reached state)
and a liturgical-template dropdown. A live poster preview (kicker, title, quote, meta). A
saved-poster gallery with upload + delete and status text. Download buttons (PNG, 16:9, ZIP).

=== SCREEN 7 — Downloads History ===
A clean list/grid of previously generated files with re-download links + timestamps, and a friendly
empty state. (Browser-local; no loading spinner needed.)

=== SCREEN 8 — Collections hub ===
Quick-link cards to open the Song Library and the Mass Builder, a recent-songs strip, and a
searchable catalog view.

=== SCREEN 9 — Templates (PPTX import) ===
A utilitarian (admin) drag-and-drop .pptx uploader with an "Analyze" button and a result/status area
showing extracted theme details. Keep it bare and functional.

=== SCREEN 10 — Settings ===
A sub-nav with two panels.
  Church profile: parish logo (rounded-square avatar + upload), parish name field with hint text,
    branding toggles (include logo / include name / footer), a celebrants list (add/manage), save
    actions, and a clean admin MODERATION list (pending memberships, song submissions, priest
    submissions, each with approve/reject).
  Appearance: theme preference (light/dark/OLED/system), dark-mode variant (dark/OLED), visual style
    (missalette/parchment/midnight), accent-color swatches + reset, home-news toggles, optional
    nav-tab visibility toggles, a live-radio station list with status, and (admin) a masked,
    secured API-key input with a save button.

=== SCREEN 11 — Radio ===
A full radio screen (today it only exists as the header pill): a station list/browser, a now-playing
area (station title + art), play / prev / next controls, channel position, and a status line. Match
the header radio pill's styling but as a full page.

=== SCREEN 12 — Sign in / Sign up ===
A calm auth screen with email-based sign in / sign up, a soft animated background, and light + dark
variants. One berry primary action.

============================== GLOBAL DO / DON'T ==============================
DO: light grey canvas + white floating cards + hairline borders; one berry primary per screen;
sentence-case labels; system font + negative tracking; subtle hover lift; ≤300ms ease-out motion;
generous whitespace; every state in light + dark; ≥40px targets + visible focus + AA contrast.
DON'T: Material Design (FABs, elevation shadows, filled-tonal chips, ripples, uppercase chips);
salmon #ffb4a9, dark-brown surfaces, or serif/mono display fonts; more than two accent colors; berry
as decoration; decorative gradients/icons/glows; heavy shadows; nested grey cards; ALL-CAPS labels;
two competing primary buttons; inner-scrolled scripture on Home. Every screen must read as if designed
by ONE product team.
```
