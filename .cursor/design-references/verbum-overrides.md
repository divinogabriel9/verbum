# Verbum overrides (apply on top of active DESIGN.md)

These tokens **win** over the reference theme (currently Cal.com) for church/liturgy product identity.

## Brand

| Token | Value | Role |
|-------|-------|------|
| `--good` / liturgical accent | `#a10f0d` | Primary actions, active nav, scripture refs |
| `--brand-font` | Mea Culpa | Wordmark “Verbum” only |
| `--font` | Apple system stack + Inter fallback | All UI and body (see Typography) |
| `--ink` | `#15333D` | Headings and primary text |
| `--bg` | `#EEF2F6` | App canvas (grey, not pure white) |
| `--surface-solid` | `#FFFFFF` | Cards, header |
| `--card-border` | `#E4E9EF` | Card hairlines |

## Typography (Apple.com reference)

Type **rhythm** follows [apple/DESIGN.md](apple/DESIGN.md) from awesome-design-md. Colors and layout stay Cal.com + Verbum.

| Level | Size | Weight | Tracking / leading |
|-------|------|--------|-------------------|
| Page title | 28px (`--type-page-title`) | 600 | display leading, tight tracking |
| Section / tagline | 21px (`--type-section-title`) | 600 | tight |
| Card title / body strong | 17px (`--type-card-title`) | 600 | `-0.022em`, 1.24 |
| Body | 17px (`--type-body`) | 400 | `-0.022em`, 1.47 |
| Caption / helper | 14px (`--type-helper`) | 400–600 | `-0.016em`, 1.43 |
| Fine / nav | 12px (`--type-fine`) | 400 | `-0.01em` |
| Wordmark | Mea Culpa ~1.45rem | 400 | script only |

**Font stack:** `-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Inter", …`

- Use **sentence-case labels** (not shouty uppercase micro-labels)
- Antialiased body text; negative letter-spacing on 14–17px UI copy
- Scripture blocks may use slightly looser leading (`--leading-relaxed`)

## Liturgical season

Season ribbons (`data-season` on `body`) may shift `--liturgical-accent` / `--liturgical-glow`. Do not replace berry accent on primary CTAs unless user enables custom accent in Appearance settings.

## Layout (home dashboard)

- 12-column bento: gospel 7 / events 5, readings full width
- Header: two rows (brand + search + utilities, then nav + Create)
- Active nav: berry underline only — no pill on brand
- Motion: follow `.cursor/skills/emil-design-eng/` (≤300ms, ease-out)

## Do not import from reference themes

- Cal.com near-black primary buttons → use `--good` berry for Verbum CTAs
- Apple Action Blue `#0066cc` → keep Verbum berry CTAs
- Cal Sans / Linear Display → use Apple system stack + Mea Culpa wordmark only
- Dark-first Linear canvas → Verbum default is light mode
