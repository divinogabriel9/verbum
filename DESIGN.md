---
version: verbum-1
name: Verbum-design-system
reference-theme: cal.com
reference-path: .cursor/design-references/cal/DESIGN.md
typography-reference: apple.com
typography-path: .cursor/design-references/apple/DESIGN.md
overrides: .cursor/design-references/verbum-overrides.md
description: >-
  Verbum liturgy planning UI — light SaaS dashboard built on Cal.com patterns
  (white cards, Inter, calendar-friendly density) with Winter Berry
  accent (#a10f0d), grey canvas, and Mea Culpa wordmark. Home uses a 12-col bento grid.
  Read cal/DESIGN.md for component anatomy; apply verbum-overrides for brand colors.
---

# Verbum — Active DESIGN.md

> **Reference base:** [Cal.com](.cursor/design-references/cal/DESIGN.md) from [awesome-design-md](https://github.com/voltagent/awesome-design-md)  
> **Brand overrides:** [verbum-overrides.md](.cursor/design-references/verbum-overrides.md)

## 1. Visual theme & atmosphere

Calm, professional parish planning tool — not a dark IDE, not a marketing landing page. Light grey app canvas with white floating cards. Generous whitespace, readable scripture blocks, minimal chrome. Mood: **quiet confidence** (scheduling SaaS meets missalette clarity).

## 2. Color palette & roles

| Role | Token / hex | Use |
|------|-------------|-----|
| Canvas | `--bg` `#EEF2F6` | Page background behind cards |
| Surface | `--surface-solid` `#FFFFFF` | Header, cards |
| Ink | `--ink` `#15333D` | Titles, body |
| Muted | `--muted` `#5C6B75` | Secondary text, hints |
| Hairline | `--line` `#E2E8F0` | Borders, dividers |
| Primary CTA | `--good` `#a10f0d` | Create, active nav, links on scripture |
| On primary | `#FFFFFF` | Text on accent buttons |
| Card border | `--card-border` `#E4E9EF` | Bento cells |

Liturgical season may tint `--liturgical-accent` via `body[data-season]` — preserve berry accent for primary actions unless user sets custom accent.

## 3. Typography

**Reference:** [Apple.com](.cursor/design-references/apple/DESIGN.md) (awesome-design-md) for scale, tracking, and leading. **Stack:** SF Pro system fonts with Inter fallback. **Wordmark:** Mea Culpa only.

| Level | Token | Size | Weight | Leading / tracking |
|-------|-------|------|--------|-------------------|
| Wordmark | Mea Culpa | ~1.45rem | 400 | script |
| Page title | `--type-page-title` | 28px | 600 | 1.07 / tight |
| Section | `--type-section-title` | 21px | 600 | 1.24 / `-0.022em` |
| Card title | `--type-card-title` | 17px | 600 | 1.24 / `-0.022em` |
| Body | `--type-body` | 17px | 400 | 1.47 / `-0.022em` |
| Caption | `--type-helper` | 14px | 400–600 | 1.43 / `-0.016em` |
| Fine / nav | `--type-fine` | 12px | 400 | 1.0 / `-0.01em` |

Labels use **sentence case** (Apple caption-strong), not uppercase micro-type. Scripture may use `--leading-relaxed` (1.57).

## 4. Component stylings

### App header (two rows)

- Row 1: brand | search (pill, ⌘K) | liturgical pill + notifications + theme + account
- Row 2: nav tabs (underline active state) | berry **+ Create**
- Full width, flat bottom border — no floating pill header

### Bento card (`home-bento-grid`)

- Background white, 1px `--card-border`, `16px` radius, light shadow
- Head: icon square (berry tint) + title + optional action link
- Padding `24px`, gap `24px` on grid

### Buttons

- **Primary:** `--good` fill, white text, `8px` radius, `scale(0.97)` on press
- **Secondary / outline:** white fill, hairline border, berry text for liturgical actions
- **Nav:** color-only hover; active = berry text + 2px bottom rule

### Search

- Command palette dropdown under header input; pages + actions + songs

## 5. Layout principles

- Content max width: `1536px`, shared gutter: `clamp(20px, 3vw, 40px)`
- Home bento: 12 columns — gospel `span 7`, events `span 5`, readings `span 12`
- Readings row: 3 equal columns with vertical dividers
- 8px spacing base (`--space-1` … `--space-6`)

## 6. Depth & elevation

- Cards: subtle shadow `0 1px 2px …, 0 4px 14px …` on grey canvas
- No heavy drop shadows; prefer hairlines
- Modals: scrim + `scale(0.95)` enter (see emil-design-eng)

## 7. Do's and don'ts

### Do

- Use Cal.com card rhythm (rounded lg, soft surfaces) for new dashboard panels
- Keep berry accent sparse — actions and active states only
- Align header and main content to the same horizontal gutter
- Show full gospel text on Home without inner scrollers

### Don't

- Don't use Cursor orange / cream editorial palette (removed)
- Don't use Cal.com near-black `#111111` as primary — use `--good`
- Don't highlight the Verbum brand block as an active nav tab
- Don't stack nested grey cards (flat bento only)

## 8. Responsive behavior

- `≤960px`: bento stacks single column; search hidden on small screens (⌘K still works)
- Touch targets ≥40px for primary controls
- Nav scrolls horizontally on narrow viewports

## 9. Agent prompt guide

```
Polish this screen to match DESIGN.md (Verbum + Cal.com layout, Apple.com typography).
Keep --good berry CTAs (#a10f0d), Mea Culpa wordmark, grey canvas #EEF2F6.
17px body / 14px caption, negative tracking, system font stack. Follow emil-design-eng for motion.
Read cal/DESIGN.md for cards; apple/DESIGN.md for type scale.
```

**Quick colors:** canvas `#EEF2F6` · card `#FFFFFF` · ink `#15333D` · primary `#a10f0d` · border `#E4E9EF`
