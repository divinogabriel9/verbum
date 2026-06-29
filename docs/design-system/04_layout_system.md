# 04 · Layout System

> Source: inline `:root` + shell CSS in `templates/index.html`, `verbum-design-system.css`,
> `BENTO_GRID_REDESIGN.md`, `DESIGN.md §5`, responsive rules across CSS.

---

## 1. Page layout (app shell)

```
┌────────────────────────────────────────────────────────────┐
│  App header (fixed, frosted glass, 65px)                     │  ← --header-height
│  brand · global search (⌘K) · radio pill · season · notif ·  │
│  theme · account   ┊   nav tabs · + Create                   │
├──────────┬─────────────────────────────────────────────────┤
│ Sidebar  │  Main content (.dashboard / .page)               │
│ 72px →   │  max-width 1536px, centered, gutter clamp(20–40)  │
│ 220px    │  sections gap 24px                                │
│ (desktop)│                                                   │
└──────────┴─────────────────────────────────────────────────┘
   Mobile: sidebar → bottom tab bar + "More" sheet
```

- **Header:** fixed, `border-radius:0`, flat bottom border, frosted glass (`backdrop-filter: blur(24px) saturate(1.15)`), translucent `--app-header-glass-bg`. Two conceptual rows: brand/search/utilities, then nav tabs + Create.
- **Sidebar (desktop):** collapsed `--app-sidebar-width` 72px, expandable `--app-sidebar-expanded-width` 220px, gap `--sidebar-gap` 16px.
- **Main:** `.dashboard`/`.page` with top padding `calc(--app-header-offset + --layout-gap)`, gutter `--layout-gutter`, `scroll-padding-top: --app-header-offset` for anchored steps.

## 2. Container width

| Token | Value |
|---|---|
| App shell max | `--content-max` **1536px** |
| Modal standard | `min(480px,100%)` |
| Modal receipt | `min(600px,100%)` |
| Reading modal | `900px` |
| (System B wizard max) | 1440px — non-canonical |

## 3. Margins & gutters

- **Shared gutter** (header + content aligned): `--layout-gutter: clamp(20px, 3vw, 40px)`.
- Header and main content **must align to the same horizontal gutter** (`DESIGN.md` Do's).
- Page edge on Tailwind/landing: `px-gutter` 24px, `px-margin-edge` 40px.

## 4. Section spacing & vertical rhythm

- Page sections / grid gap: `--layout-gap` (24px).
- `.page.active gap: --space-5`; `#home-page.active gap: 0` (bento manages its own gap).
- Field rhythm: `.field margin-bottom --space-4`; `.panel-head margin-bottom --space-4`; `.settings-divider margin --space-5 0`.
- Card internal rhythm built on 4px scale (`--space-1…7`).
- Hero padding `--space-5 --space-6`.

## 5. Cards

- White surface, `1px var(--card-border)`, `--radius-lg`, padding `--card-padding` (24px), hairline depth + Apple hover lift. **Never nest grey cards.** See [`03_component_library.md §2`](03_component_library.md).

## 6. Lists

- List items (`.flow-input-list-item`, `.notification-item`): padding `--space-3 --space-4`, `--radius-md`.
- Compact list items (`.celebrant-settings-list__item`): `4px 8px`, `--radius-sm`.
- Dropdown lists: `padding 8px`, items `10px 12px`, `--radius-sm/8px`.
- Every list has a defined **empty state** (events, celebrants, history, search, recents).

## 7. Grid

- **Home bento:** 12-column. Gospel `span 7`, events `span 5`, readings `span 12` (3 equal sub-columns w/ vertical dividers). Gap 24px. Collapses to 1 column ≤960px.
- **Mass Builder setup bento:** `repeat(auto-fit, minmax(320px,1fr))` → `repeat(2,1fr)` @1024px; gaps 16/20/24 by tier.
- **Liturgy parts:** `repeat(3, minmax(0,1fr))`.
- **Song composer:** `minmax(0,2fr) minmax(0,1fr)` → 1fr on mobile.
- **Calendar:** 7-column month grid + weekday header row.

## 8. Flex usage

- Buttons, header clusters, tab bars, card heads, dropdown items, chip rows use flex (`align-items:center`, `gap` from spacing scale).
- `.actions/.inline-actions/.quick-actions gap: --space-2`.
- `.song-composer-head` space-between; wraps at ≤720px.

## 9. Sticky elements

- **App header:** fixed/sticky at top (frosted).
- **Mass Builder generate dock** (`flow-dock-actions`): sticky bottom floating dock (`.flow-dock-float`, `--radius-lg`, `--shadow-medium`).
- **Route jump float** (`.route-jump-float`): floating desktop "Jump to".
- `scroll-padding-top: --app-header-offset` keeps anchored steps below the fixed header.

## 10. Floating actions

- Generate dock + route-jump float are the only floating chrome.
- `.nav-pin-btn` pins the sidebar.
- **No Material FABs** (anti-pattern).

## 11. Responsive behavior

| Tier | Width | Layout |
|---|---|---|
| **Mobile** | ≤768px | Single column; sidebar → bottom tab bar + "More" sheet; header search hidden (⌘K works); composer/bento stack; touch targets ≥40px; nav scrolls horizontally |
| **Tablet** | 768–1024px | 2-col setup bento begins; sidebar may stay collapsed |
| **Desktop** | 1024–1440px | Full sidebar, 2-col bento, 12-col home grid |
| **Large desktop** | ≥1440–1536px | Larger gaps (24px), content capped at 1536px, centered |

- **Mobile nav:** bottom tab bar; overflow "More" sheet; tabs toggleable (Media/Calendar/Design optional via settings).
- **Tablet:** bento → 2 columns; readings sidebar may move below.
- **Desktop:** sidebar + main; persistent readings sidebar in Mass Builder.

> **`[RECOMMENDATION]`** Unify the scattered breakpoints (720/768/960/1024/1440) into 4 tiers: `sm 768 / md 1024 / lg 1440 / xl 1536`.

## 12. Z-index scale (observed)

| Layer | z-index |
|---|---|
| Card hover | 1 |
| Open select in bento cell | 2 |
| Lyric block open | 40 |
| Dropdown panel (pill) | 50 |
| Dropdown panel (default) | 60 |
| Tailwind layers | 30 / 40 / 60 / 70 |

> **`[RECOMMENDATION]`** Define a named z-index scale (`--z-card`, `--z-dropdown`, `--z-sticky`, `--z-modal`, `--z-toast`).
