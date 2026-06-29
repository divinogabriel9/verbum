# 19 · Figma-Ready Component Specification

> A spec to rebuild System A as a Figma library (variables + components + variants). Values from
> [`02_design_tokens.md`](02_design_tokens.md) and [`03_component_library.md`](03_component_library.md).

---

## 1. Figma Variables (collections)

Create one variable collection **"Verbum Tokens"** with modes: **Light · Dark · OLED**.

### Color (mode-aware)
| Variable | Light | Dark | OLED |
|---|---|---|---|
| `color/canvas` | #EEF2F6 | #121212 | #000000 |
| `color/surface` | #FFFFFF | #1c1c1c | #0a0a0a |
| `color/surface-2` | #F8FAFC | #242424 | #111111 |
| `color/card-border` | #E4E9EF | #2e2e2e | #1a1a1a |
| `color/line` | #E2E8F0 | #393939 | #222222 |
| `color/ink` | #15333D | #fafafa | #fafafa |
| `color/muted` | #5C6B75 | #b4b4b4 | #b4b4b4 |
| `color/primary` | #a10f0d | #d45250 | #d45250 |
| `color/primary-active` | #7a0b0a | #a10f0d | #a10f0d |
| `color/on-primary` | #FFFFFF | #1c1c1c | #1c1c1c |
| `color/glow` | #d45250 | #d45250 | #d45250 |
| `color/success` | #166534 | #4ADE80 | #4ADE80 |
| `color/warn` | #B45309 | #B45309 | #B45309 |
| `color/danger` | #9B3D4E | #9B3D4E | #9B3D4E |

### Number (single mode)
| Variable | Value |
|---|---|
| `space/1…7` | 4, 8, 12, 16, 24, 32, 48 |
| `radius/sm` `radius/md` `radius/lg` `radius/pill` | 8, 8, 12, 999 |
| `size/btn` `size/btn-sm` `size/input` `size/header` | 40, 32, 44, 65 |
| `container/max` | 1536 |
| `gutter/min` `gutter/max` | 20, 40 |

### Typography styles
| Style | Font | Size | Weight | Tracking | Leading |
|---|---|---|---|---|---|
| Display | SF Pro Display / Inter | 34 | 600 | -0.015em | 1.07 |
| Page title | SF Pro Display | 28 | 600 | -0.015em | 1.07 |
| Section title | SF Pro Display | 21 | 600 | -0.022em | 1.24 |
| Card title | SF Pro Display | 17 | 600 | -0.022em | 1.24 |
| Body | SF Pro Text / Inter | 17 | 400 | -0.022em | 1.47 |
| Caption/Label | SF Pro Text | 14 | 400/600 | -0.016em | 1.43 |
| Fine | SF Pro Text | 12 | 400/600 | -0.01em | 1.43 |
| Scripture | SF Pro Text | 17 | 400 | -0.022em | 1.57 |
| Wordmark | Playfair Display Italic | ~23 | 500 | -0.03em | — |

### Effect styles
| Style | Value |
|---|---|
| `shadow/card-rest` | 0 1px 2px rgba(0,0,0,.04), 0 1px 3px rgba(0,0,0,.03) |
| `shadow/card-hover` | 0 2px 4px rgba(0,0,0,.04), 0 12px 28px rgba(0,0,0,.08) |
| `shadow/dropdown` | 0 4px 12px rgba(21,51,61,.08), 0 12px 28px rgba(21,51,61,.06) |
| `blur/header-glass` | Background blur 24 |
| `blur/scrim` | Background blur 12 + fill rgba(21,51,61,.48) |

---

## 2. Components & variants

### Button
- **Variants (properties):** `Type` = Primary / Secondary / Ghost / Danger / Create; `Size` = Sm(32) / Md(40) / Xl(44); `State` = Default / Hover / Pressed / Disabled / Focus; `Icon` = None / Leading / Trailing.
- Fill: Primary `color/primary` + `on-primary`; Secondary `surface` + `card-border` + `ink`; Ghost transparent + border.
- Radius `radius/md`; padding `space/4 → space/5`; text Caption 500/600.

### Card
- **Variants:** `Type` = Panel / Bento / Metric / Reading / Theme / Template / Song-plan / Event / News; `State` = Rest / Hover.
- Fill `surface`, border `card-border` 1px, radius `radius/lg`, padding `space/5`; Hover effect `shadow/card-hover` + transform note (-4y, 1.006).

### Input / Select
- **Variants:** `Type` = Text / Date / Search / Textarea / Select; `State` = Default / Focus / Disabled / Error.
- Height `size/input`, radius `radius/md`, border `card-border`; Focus = primary-tint border + 3px ring; Select adds chevron (rotate on open).

### Dropdown / Menu
- Panel: `surface`, `line` border, `radius/md`, `shadow/dropdown`; items 10×12 padding, hover `ink 4%`, active `primary 8%` + 600.
- **Variants:** Default / Pill / Account (icon column) / Search (grouped).

### Modal / Dialog
- **Variants:** `Size` = Standard(480) / Receipt(600) / Reading(900); `State` = Closed / Open.
- Scrim `blur/scrim`; box radius `radius/lg`, padding `space/5`; enter scale 0.95→1.

### Tabs (segmented)
- Pill container (`surface-2` 28%) + inner buttons; `State` per button: Default / Hover / Selected (surface + 600 + light shadow).

### Stepper
- **Variants:** step `State` = Complete / Current / Upcoming; horizontal; current uses `glow`.

### Toast / Banner
- Toast: `surface` card, radius `radius/md`, padding `space/3 space/4`; `Type` = Success / Error / Info.
- Banner: full-width contextual (membership states).

### Chips / Badge
- Chip (removable) + Badge (status); Pill radius; lyric-type colors as a sub-set (verse/chorus/bridge/response).

### Avatar
- `Size` = sm/md/lg; `State` = Image / Placeholder; radius `radius/md`.

### Skeleton / Loader
- Skeleton block (shimmer), Stat skeleton, full-screen loader (scrim + status).

---

## 3. Frames to design (screens)
Home · Song Library · Theme Lab · Mass Builder (each step) · Calendar · Posters · History ·
Collections · Templates · Settings (Church / Appearance) · **Radio (new)** · Auth.
Plus shared: App header, Sidebar, Bottom nav + More sheet, Toast.
Each in **Light + Dark**, with **loading / empty / error / success / limit-reached** states.

## 4. Naming & structure
- Components: `Button`, `Card`, `Input`, `Select`, `Menu`, `Modal`, `Tabs`, `Stepper`, `Toast`, `Chip`, `Avatar`, `Skeleton`.
- Use **Auto Layout** with the spacing variables; bind every fill/stroke/radius/text to a variable (no raw values).
- Build the 12-col Home bento and the Mass Builder setup bento as layout grids (gutter 20–40, gap 24).

## 5. Code Connect hint
Map Figma components → CSS classes for design-to-code parity:
`Button → .primary/.secondary/.ghost/.danger` · `Card → .panel/.flow-bento-cell` · `Input → input/.field` ·
`Select → .vb-select` · `Menu → .vb-dropdown-panel` · `Modal → .modal-box` · `Tabs → .flow-builder-tabs` ·
`Stepper → .mass-builder-stepper` · `Toast → .toast`.
