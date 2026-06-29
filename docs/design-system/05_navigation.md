# 05 · Navigation & Information Architecture

> Source: `REDESIGN_INTEGRATION_CONTRACT.md §1`, routing JS in `templates/index.html`
> (`applyRouteState`, `showRoute`, `routeMeta`, `legacyRoutes`, `bindSpaRouteLink`).

The whole app is a **client-side SPA** (History API). Every screen is
`<section class="page" data-route="/…">`; `applyRouteState()` toggles `.active` on the matching
page by `data-route`. **The routing skeleton must stay intact.**

---

## 1. Information architecture

```
LiturgyFlow
├── Home  /home                         (dashboard)
├── Mass
│   ├── Mass Builder  /mass/builder     (★ core flow)
│   └── Calendar      /mass/calendar
├── Library
│   ├── Song Library  /library/songs    (+ lyrics editor)
│   └── Collections   /library/collections
├── Media
│   ├── Posters       /media/posters
│   └── History       /media/history     (browser-local)
├── Design
│   ├── Theme Lab     /design/theme-lab
│   └── Templates     /design/templates  (superadmin)
├── Radio  /radio                        (⚠ route exists, NO page container — gap)
└── Settings
    ├── Church        /settings/church
    └── Appearance    /settings/app
```

Top-level **nav groups** (`data-nav-tab`): `home · radio · calendar · mass · library · media · design`.
Some tabs are user-toggleable (Media, Calendar, Design) via Settings → Appearance.

## 2. The 10 page containers (must preserve)

| `id` | `data-route` | Screen |
|---|---|---|
| `home-page` | `/home` | Home dashboard |
| `lyrics-page` | `/library/songs` | Song library + lyrics editor |
| `theme-page` | `/design/theme-lab` | Theme Lab |
| `flow-page` | `/mass/builder` | Mass Builder |
| `calendar-page` | `/mass/calendar` | Liturgical calendar |
| `posters-page` | `/media/posters` | Posters / media |
| `history-page` | `/media/history` | Downloads history |
| `collections-page` | `/library/collections` | Collections hub |
| `templates-page` | `/design/templates` | PPTX theme import |
| `settings-page` | `/settings/church` + `/settings/app` | Settings (special-cased to match both) |

## 3. Navigation hierarchy

- **Primary navigation:** desktop left sidebar (icon → expandable labels) + header nav tabs; mobile bottom tab bar.
- **Secondary navigation:** settings sub-nav (`.settings-sidebar-link`, `data-settings-panel`), Mass Builder inner tabs (Setup/Songs), in-page anchors.
- **Tertiary / utility:** account menu, "Create" menu, command palette (⌘K global search), desktop "Jump to" route switcher (`#route-switcher`), mobile "More" sheet.
- All nav links bound in one pass via `bindSpaRouteLink` across sidebar, bottom nav, More sheet, settings sub-nav, account menu, and route switcher.

### Nav link attributes (preserve)
`data-route` (target) · `data-route-prefix` / `data-route-exclude` (active matching) · `data-nav-tab` (visibility group).

### "Create" menu (`data-create`)
Values: `pptx` (→ Mass Builder), `event` (→ Home event modal), `poster` (→ Posters), `song` (→ Library), `collection` (→ Collections).

## 4. Wizard flow (Mass Builder)

The Mass Builder is the spine of the product. Two representations exist:

- **Live implementation (canonical):** a **5-step stepper** + two inner tabs (Setup / Songs) + sticky generate dock.
  Steps via `data-mass-step-target`: `basics → stewardship → readings → media → songs`, scrolling to anchors
  `mass-step-target-{basics,stewardship,readings,media}` and panel `flow-panel-songs`.
- **Brief / target design:** a **7-step wizard** (`STITCH_DESIGN_BRIEF.md`): Mass Details → Order of the Mass → Readings & Psalm → Stewardship & Notices → Posters & Branding → Song Plan → Summary & Receipt, with Back/Continue + a final editable summary.

> ⚠️ **Discrepancy to resolve:** 5-step live vs 7-step brief. Treat the **5-step live stepper as current truth**; the 7-step is the intended evolution. See [`07_user_flows.md`](07_user_flows.md) and [`12_ui_audit.md`](12_ui_audit.md).

**Stepper behavior:** clicking a step scrolls/navigates to that step's content; current step highlighted with `--stepper-active` glow; the stepper appears only on `/mass/builder`. Generate becomes available at the end (dock + inline).

## 5. Back behavior

- **History API:** browser Back/Forward traverse the SPA route stack (`showRoute` pushes state).
- **Modals/sheets:** `Esc` and backdrop click close; do not add a history entry (they overlay the current route).
- **Wizard:** "Back/Continue" (target design) moves between steps without leaving `/mass/builder`; "Edit" links on the summary jump back to a specific step.
- **Settings panels:** switching church/appearance updates the route (`/settings/church` ↔ `/settings/app`).

## 6. Deep links

- Every route is bookmarkable/shareable (e.g. `/mass/calendar`, `/library/songs`).
- **Legacy aliases** (`legacyRoutes` redirect): `/media/presentation` → `/mass/builder`; `/lyrics-dashboard` → `/library/songs`; `/theme-dashboard` → `/design/theme-lab`; `/mass-flow-dashboard` → `/mass/builder`.
- Selecting a date deep-links readings/season state into Home, Builder, and Calendar.

## 7. Screen relationships

- **Home** → reading modal, event modal, news expand; links into Builder/Library via Create.
- **Calendar** → "use this date" feeds Mass Builder; "generate" jumps to generation.
- **Library** ↔ **Collections** ↔ **Mass Builder** (songs flow into the song plan).
- **Theme Lab** / **Templates** → feed custom themes into PPTX generation.
- **Posters** shares AI-image quota + poster logic with the Builder's Media step.
- **Settings** governs nav-tab visibility, themes, accent, radio, branding used everywhere.

## 8. Primary vs secondary navigation summary

| Level | Surface | Examples |
|---|---|---|
| Primary | Sidebar / header tabs / bottom bar | Home, Mass, Library, Media, Design |
| Secondary | Inner tabs, sub-nav | Builder Setup/Songs, Settings Church/Appearance |
| Utility | Menus, palette, float | Create menu, ⌘K, Jump-to, More sheet, account |

## 9. Future scalability

- **Author the missing `/radio` page** (IDs already referenced by JS: `radio-page-layout/list/play/prev/next/station-title/art/channel-pos/status`).
- **Decouple JS from IDs** (Strategy B: `data-action`/`data-field` + delegation) so future redesigns don't silently break.
- Nav groups already support toggling tabs — supports adding modules (e.g., Announcements, Bulletins) without restructuring.
- Consider a breadcrumb beyond the header title for deeper sub-screens as modules grow.
