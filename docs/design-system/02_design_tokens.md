# 02 · Design Tokens

> Extracted verbatim from inline `:root` in `templates/index.html` (lines ~40–144) and
> `static/css/verbum-design-system.css` (lines 8–149), `static/css/emil-motion.css`, and the
> dark/OLED/visual-style overrides. This is **System A (Verbum)** — the canonical system.
> System B (wizard) tokens are listed separately in §13 and in [`16_tailwind_mapping.md`](16_tailwind_mapping.md), marked non-canonical.

All values below are real. Where a conventional token is absent, it's marked **`[RECOMMENDATION]`**.

---

## 1. Color tokens

### 1.1 Brand / accent

| Token | Light | Dark | Used by |
|---|---|---|---|
| `--accent` / `--liturgical-accent` | `#a10f0d` | `#a10f0d` | Primary brand "Winter Berry"; active states, links on scripture |
| `--good` / `--color-primary` | `#a10f0d` | `#d45250` | **Primary CTA fill** (`.primary`, `.btn-create`) |
| `--color-primary-active` | `#7a0b0a` | `#a10f0d` | Primary button hover/active |
| `--liturgical-glow` | `#d45250` | `#d45250` | Focus glow, stepper active, indicator hover |
| `--on-primary` / `--on-accent` | `#FFFFFF` | `#1c1c1c` (on-primary) / `#FFFFFF` (on-accent) | Text on accent fills |
| `--accent-2` / `--liturgical-secondary` | `#788898` | `#788898` | Secondary slate accent |
| `--accent-3` | `#C1A3A1` | — | Tertiary mauve accent (rare) |
| `--liturgical-ordinary` | `#166534` | — | Ordinary-time green (calendar indicator) |
| `--liturgical-ordinary-glow` | `#4ADE80` | — | Ordinary-time glow |

> **Primary** = berry `#a10f0d`. **Secondary** = `--secondary`/outline buttons use surface + hairline (there is no dedicated secondary *color* token; secondary = neutral white button). **Accent** = `--liturgical-accent` (season-tintable).

### 1.2 Status / semantic

| Token | Light | Dark | Used by |
|---|---|---|---|
| **Success** | `--design-success` `#a10f0d` *(aliases to primary)*; `.lyrics-analyze-hint.ok` uses `--design-success` | `#a10f0d` | Success hints. **Note:** success == primary berry (no distinct green for status). |
| **Warning** | `--warn` `#B45309` | `#B45309` | Warnings (amber) |
| **Danger / Error** | `--danger` `#9B3D4E`; `--design-error` `#9b3d4e`; `--bad` `#9b3d4e` | same | `.danger` buttons, error hints, sign-out icon |

> ⚠️ **Inconsistency:** "success" reuses the brand berry rather than a green. Documented as-is; a true success green is a **`[RECOMMENDATION]`** (see [`12_ui_audit.md`](12_ui_audit.md)).

### 1.3 Background / surface / card

| Token | Light | Dark | OLED | Used by |
|---|---|---|---|---|
| `--bg` (Canvas) | `#EEF2F6` | `#121212` | `#000000` | Page background behind cards |
| `--bg-top` | `#F8FAFC` | `#1c1c1c` | `#000000` | Top gradient origin |
| `--surface` | `#FFFFFF` | `#1c1c1c` | `#0a0a0a` | Header, cards |
| `--surface-2` | `#F8FAFC` | `#242424` | `#111111` | Subtle fills, hover, pills |
| `--surface-solid` | `#FFFFFF` | `#2e2e2e` | `#161616` | Solid card/control fills |
| `--card-border` (Card) | `#E4E9EF` | `#2e2e2e` | `#1a1a1a` | Bento/card borders |

### 1.4 Border / divider

| Token | Light | Dark | OLED | Used by |
|---|---|---|---|---|
| `--line` (Border) | `#E2E8F0` | `#393939` | `#222222` | Borders, dividers (`.settings-divider`, `.account-menu-divider`) |
| `--line-soft` (Divider) | `#EDF2F7` | `#2e2e2e` | `#1a1a1a` | Soft inner dividers |
| `--design-hairline-strong` | `#e4e9ef` | `#393939` | `#222222` | Secondary-button border |

### 1.5 Text

| Token | Light | Dark | Used by |
|---|---|---|---|
| `--ink` (Text) | `#15333D` | `#fafafa` | Titles, body |
| `--muted` (Muted Text) | `#5C6B75` | `#b4b4b4` | Secondary text, hints, captions |
| `--ink-subtle` | `#6A7A84` | `#898989` | Tertiary / placeholder-ish |

### 1.6 Interaction-state colors (derived, not standalone tokens)

The system **derives** hover/pressed/focus/disabled from base tokens via `color-mix()` rather than dedicated tokens:

| State | How it's expressed | Example |
|---|---|---|
| **Hover** (cards) | border → `color-mix(in srgb, var(--ink) 12%, var(--card-border))` + lift | `.tool-card:hover` |
| **Hover** (neutral btn) | `background: var(--surface-2)`; border → `--line` | `.secondary:hover` |
| **Hover** (menu item) | `color-mix(in srgb, var(--ink) 4%, var(--surface-solid))` | `.vb-dropdown-item:hover` |
| **Pressed / active** | `transform: scale(0.97)` (buttons), `scale(0.99)` (menu items) | `emil-motion.css` |
| **Focus** | `box-shadow: 0 0 0 3px color-mix(in srgb, var(--liturgical-accent) 12%, transparent)` + border tint | inputs |
| **Focus-visible** (custom) | `outline: 2px solid color-mix(in srgb, var(--good) 45%, transparent)` + 2px offset | `.vb-select__trigger` |
| **Disabled** | `opacity: 0.5` (`.uiverse-btn.is-disabled`) / `0.55` (`.vb-select__trigger:disabled`) | buttons/selects |
| **Selected/active item** | `color-mix(in srgb, var(--good) 8%, var(--surface-solid))` + `font-weight 600` | dropdown items |

> **`[RECOMMENDATION]`** Promote these to named tokens (`--state-hover-bg`, `--state-pressed-scale`, `--focus-ring`, `--disabled-opacity`) for consistency.

### 1.7 Overlay / scrim

| Token | Light | Dark | OLED |
|---|---|---|---|
| `--app-scrim` | `rgba(21,51,61,0.48)` | `rgba(0,0,0,0.72)` | `rgba(0,0,0,0.88)` |
| `--app-blur` | `12px` | — | — |

---

## 2. Typography tokens

### 2.1 Font families

| Token | Value | Used by |
|---|---|---|
| `--font` | `-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Inter", "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif` | Body / UI |
| `--font-display` | `-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Inter", "Segoe UI", system-ui, sans-serif` | Headings, titles |
| `--brand-font-flow` | `"Playfair Display", Georgia, serif` | Wordmark "flow" accent (italic) |
| `--brand-font-liturgy` | `"Times New Roman", Times, "Liberation Serif", serif` | Liturgical/brand serif accents |

Web fonts loaded in `index.html`: **Inter** (400/500/600) + **Playfair Display** (italic 400/500). Landing page additionally loads Material Symbols Outlined (landing only).

> ⚠️ `DESIGN.md`/`AGENTS.md` reference a "Mea Culpa" wordmark font, but it is **not loaded**. The wordmark actually renders in **Playfair Display italic**. Documented as-is (see [`12_ui_audit.md`](12_ui_audit.md)).

### 2.2 Type scale (Apple.com rhythm)

| Token | Size | px | Weight | Use |
|---|---|---|---|---|
| `--type-display` | `2.125rem` | 34px | 600 | Display / largest hero |
| `--type-page-title` / `--text-xl` | `1.75rem` | 28px | 600 | Page titles, hero h2 |
| `--type-section-title` / `--text-lg` | `1.3125rem` | 21px | 600 | Section headings |
| `--type-card-title` | `1.0625rem` | 17px | 600 | Card titles |
| `--type-body` / `--text-base` | `1.0625rem` | 17px | 400 | Body, inputs, menu items |
| `--type-helper` / `--type-caption` / `--text-sm` | `0.875rem` | 14px | 400–600 | Captions, hints, labels, nav |
| `--type-fine` / `--text-xs` | `0.75rem` | 12px | 400–600 | Fine print, eyebrows, group labels |
| `--type-micro` | `0.625rem` | 10px | — | Micro (rare) |

### 2.3 Weights

`400` (body), `500` (primary CTA text, nav, pills), `600` (titles, labels, secondary CTAs), `650/700` (occasional emphasis in composer/recent items). No weights ≥ 800 in canonical system.

### 2.4 Letter spacing (tracking) — all negative (Apple)

| Token | Value | Use |
|---|---|---|
| `--tracking-display` | `-0.015em` | Display/page title |
| `--tracking-title` | `-0.022em` | Section titles |
| `--tracking-body` | `-0.022em` | Body, card titles |
| `--tracking-caption` | `-0.016em` | Captions, labels |
| `--tracking-fine` | `-0.01em` | Fine print, eyebrows |

### 2.5 Line heights (leading)

| Token | Value | Use |
|---|---|---|
| `--leading-display` | `1.07` | Display/page title |
| `--leading-tight` | `1.24` | Titles, labels |
| `--leading-body` | `1.47` | Body |
| `--leading-caption` | `1.43` | Captions |
| `--leading-relaxed` | `1.57` | Scripture / reading text |

---

## 3. Spacing scale (4px base)

| Token | Value | Alias | Common use |
|---|---|---|---|
| `--space-1` | 4px | `--space-xs` | Tight gaps, icon insets |
| `--space-2` | 8px | `--space-sm` | Button gaps, label margin, pill padding |
| `--space-3` | 12px | — | Input padding-x, list item padding |
| `--space-4` | 16px | `--space-md` | Field gaps, metric padding, accordion body |
| `--space-5` | 24px | `--space-lg` | **Card padding (`--card-padding`)**, page gap, layout gap |
| `--space-6` | 32px | `--space-xl` | Hero padding-x, section spacing |
| `--space-7` | 48px | — | Large section spacing |

---

## 4. Radius scale

| Token | Light value | Notes | Use |
|---|---|---|---|
| `--radius-sm` | 8px | (DS file: 8px; inline index: 8px) | Cells, tabs inner, chips, search |
| `--radius-md` | 12px inline / **8px in DS file** ⚠️ | **Conflict** between files | Buttons, inputs, modals-md |
| `--radius-lg` / `--radius` | 16px inline / **12px in DS file** ⚠️ | **Conflict** | Cards, modals, panels |
| `--radius-pill` | 999px / 9999px | | Pills, toggle chips, round buttons |

> ⚠️ **Radius conflict:** `index.html` inline sets `--radius-md:12px; --radius-lg:16px`, while `verbum-design-system.css` overrides `--radius-md:8px; --radius-lg:12px` (loaded *after* inline). Effective live values = **8/12**. See [`12_ui_audit.md`](12_ui_audit.md).

---

## 5. Elevation / shadow scale

The canonical system is **hairline-first**. `verbum-design-system.css` sets most shadows to `none`; depth comes from borders + Apple hover lift.

| Token | Light (DS file) | Light (inline index) | Dark |
|---|---|---|---|
| `--shadow-light` | `none` | `0 1px 2px rgba(21,51,61,.04), 0 1px 3px rgba(21,51,61,.05)` | none |
| `--shadow-medium` | `none` | `0 2px 6px …, 0 8px 20px …` | none |
| `--shadow-large` | `none` | `0 4px 12px …, 0 16px 36px …` | none |
| `--apple-card-shadow-rest` | `0 1px 2px rgba(0,0,0,.04), 0 1px 3px rgba(0,0,0,.03)` | — | `none` |
| `--apple-card-shadow-hover` | `0 2px 4px …, 0 12px 28px rgba(0,0,0,.08)` | — | `0 0 0 1px …` (ring) |
| `--vb-dropdown-shadow` | `0 4px 12px rgba(21,51,61,.08), 0 12px 28px rgba(21,51,61,.06)` | — | `0 8px 24px rgba(0,0,0,.48)` |

Apple hover-lift tokens: `--apple-card-hover-lift: -4px`, `--apple-card-hover-scale: 1.006`, `--apple-card-hover-duration: 320ms`, `--apple-card-hover-ease: cubic-bezier(0.25,0.1,0.25,1)`.

---

## 6. Opacity

| Use | Value |
|---|---|
| Disabled button | `0.5` |
| Disabled select | `0.55` |
| Refreshing panel | `0.94` |
| Skeleton shimmer | `0.5 → 0.82 → 0.5` |
| Chevron icon | `0.8` |
| **`[RECOMMENDATION]`** named tokens | `--opacity-disabled`, `--opacity-muted` |

---

## 7. Animation durations

| Token | Value | Use |
|---|---|---|
| `--motion-duration-micro` | 100ms | Press feedback, active scale |
| `--motion-duration-fast` / `--transition-fast` | 150ms | Hover, color/border transitions |
| `--motion-duration-base` / `--transition-base` | 200ms | Dropdowns, content enter, base transitions |
| `--motion-duration-modal` | 260ms | Modal enter |
| `--motion-duration-exit` | 120ms | Exit/collapse |
| `--motion-duration-slow` | 280ms | Slow transitions |
| `--apple-card-hover-duration` | 320ms | Card hover lift |
| Skeleton shimmer | 1.1s | `emil-shimmer` loop |
| Refresh spin | 0.75s | `emil-refresh-spin` |

## 8. Transition curves (easing)

| Token | Value | Use |
|---|---|---|
| `--ease-out` / `--motion-ease-out` | `cubic-bezier(0.23, 1, 0.32, 1)` | Enter/exit (default) |
| `--ease-in-out` / `--motion-ease-in-out` | `cubic-bezier(0.77, 0, 0.175, 1)` | Symmetric morphs |
| `--ease-drawer` | `cubic-bezier(0.32, 0.72, 0, 1)` | Drawers/sheets |
| `--ease-hover` / `--motion-ease-hover` | `cubic-bezier(0.25, 0.1, 0.25, 1)` | Hover color/bg |

---

## 9. Container widths & layout tokens

| Token | Value | Use |
|---|---|---|
| `--content-max` | `1536px` | App shell max width |
| `--ui-card-width` | `min(480px, 100%)` | Standard modal width |
| `--ui-card-width-receipt` | `min(600px, 100%)` | Receipt modal |
| `--ui-card-width-reading` | `900px` | Reading expand modal |
| `--layout-gutter` | `clamp(20px, 3vw, 40px)` | Shared horizontal gutter (header + content) |
| `--layout-gap` | `var(--space-5)` (24px) | Grid/section gap |
| `--header-height` | `65px` | App header |
| `--app-header-offset` | `calc(header-stack + safe-top)` | Sticky scroll offset |
| `--app-sidebar-width` | `72px` | Collapsed sidebar |
| `--app-sidebar-expanded-width` | `220px` | Expanded sidebar |
| `--sidebar-gap` | `16px` | Sidebar spacing |
| Wizard-only: `--container-max` (Tailwind) | `1440px` | System B max (non-canonical) |

---

## 10. Responsive breakpoints

Extracted from `@media` rules across CSS (canonical app + DS + bento doc):

| Breakpoint | Source | Behavior |
|---|---|---|
| `≤ 720px` | `verbum-design-system.css` | Song composer single column |
| `≤ 768px` | `emil-motion.css`, wizard `md:` | Mobile; composer stacks; Tailwind `md` start |
| `≤ 960px` | `DESIGN.md` | Bento → single column; header search hidden (⌘K still works) |
| `≥ 1024px` | `BENTO_GRID_REDESIGN.md`, Tailwind `lg:` | 2-col bento / setup grid; sidebar layout |
| `≥ 1440px` | bento doc, wizard `container-max` | Larger gap (24px); desktop tier |
| `≥ 1536px` | `--content-max` | App shell ceiling |

> **`[RECOMMENDATION]`** Breakpoints are scattered (720/768/960/1024/1440). Consolidate to a 4-tier scale: `sm 768`, `md 1024`, `lg 1440`, `xl 1536`. See [`04_layout_system.md`](04_layout_system.md).

---

## 11. Grid system

- **App shell:** content max `1536px`, shared gutter `clamp(20px,3vw,40px)`.
- **Home bento:** 12-column grid — gospel `span 7`, events `span 5`, readings `span 12` (3 equal sub-columns with vertical dividers). Gap `--layout-gap` (24px).
- **Mass Builder setup:** responsive bento — `repeat(auto-fit, minmax(320px,1fr))` mobile → `repeat(2,1fr)` at 1024px; gap 16/20/24px by tier.
- **Liturgy parts:** `repeat(3, minmax(0,1fr))`.
- **Song composer:** `minmax(0,2fr) minmax(0,1fr)`.

---

## 12. Component dimension tokens

| Token | Value | Use |
|---|---|---|
| `--btn-height` | 40px | Standard button / `.primary/.secondary/.ghost` min-height |
| `--btn-height-sm` | 32px | `.mini`, pills, small actions |
| `--btn-padding-x` | 18px | Button horizontal padding |
| `--input-height` | 44px | Inputs, selects, `.vb-select__trigger` |
| `--tab-height` | 36px | Tabs (actual `.flow-builder-tabs button` ≈ 30px inner) |
| `--card-padding` | 24px (`--space-5`) | Card/panel padding |
| `--topbar-chip-height` | 36px | Header notif/theme/round chips |
| `--app-header-nav-height` | 44px | Header nav row |
| Big CTA `.btn-xl` | 44px | Large primary actions |

### Icon sizes

| Context | Size |
|---|---|
| Nav icons | 15×15px |
| Menu item icons | 18×18px |
| Liturgical indicator icon | 16×16px |
| Select chevron | 14×14px |
| Search clear button | 28×28px |
| Tailwind/wizard icon utilities | `h-3/w-3` (12px) … `h-8/w-8` (32px) |

### Avatar sizes

| Context | Size |
|---|---|
| Church logo avatar (`church-logo-avatar`) | square, `--radius-md` (see `03_component_library.md`) |
| Account menu icon column | 18px grid column |
| **`[RECOMMENDATION]`** define avatar scale | `xs 24 / sm 32 / md 40 / lg 56 / xl 72` |

---

## 13. System B (Wizard) tokens — NON-CANONICAL

Documented for completeness; **do not use for new work.** Source: `build/tailwind/wizard.config.js`, `static/css/mass_builder_wizard.css`.

| Role | Value |
|---|---|
| primary | `#ffb4a9` (salmon) |
| on-primary | `#690002` |
| primary-container | `#a10f0d` |
| surface / background | `#1e100e` (dark brown) |
| on-surface | `#f9dcd8` |
| surface-variant | `#42312e` |
| outline | `#aa8984` |
| soft-white | `#F5F5F7` |
| deep-charcoal | `#121212` |
| muted-crimson | `rgba(161,15,13,0.15)` |
| Fonts | Bricolage Grotesque (headline/display), Hanken Grotesk (body), JetBrains Mono (label-caps) |
| Spacing extras | `margin-edge 40px`, `gutter 24px`, `container-max 1440px` |

This palette is **Material 3 (M3) tonal** in structure and conflicts with the canonical berry-on-grey system. See [`12_ui_audit.md`](12_ui_audit.md) for the consolidation plan.

---

## 14. AI image style presets (content token, `data/styles.json`)

Not visual UI tokens, but part of the product's design vocabulary for generated gospel imagery:
`cinematic`, `realistic`, `renaissance`, `stained_glass`, `modern`.
