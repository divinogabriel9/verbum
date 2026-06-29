# 16 · Tailwind Mapping

> Tailwind is used in **two non-canonical places**: the marketing `landing.css` and the divergent
> `mass_builder_wizard.css` (built from `build/tailwind/wizard.config.js` + `wizard.input.css`).
> The **canonical app shell does NOT use Tailwind** — it uses hand-written CSS + design tokens.
> This file maps the Tailwind utilities to the canonical System A tokens so anything built in Tailwind
> can be brought back in line. **Goal: migrate Tailwind output → System A tokens.**

Build commands (`package.json`):
- `npm run build:wizard-css` → `static/css/mass_builder_wizard.css`
- `npm run build:landing-css` → `static/css/landing.css`

---

## 1. Colors (wizard config → canonical token)

| Tailwind name (System B) | Value | Canonical System A equivalent |
|---|---|---|
| `primary` | `#ffb4a9` (salmon) | ➡️ `--good` `#a10f0d` (berry) — **System B is off-brand** |
| `on-primary` | `#690002` | ➡️ `--on-primary` `#FFFFFF` |
| `primary-container` | `#a10f0d` | = `--accent` (only token that matches) |
| `on-primary-container` | `#ffada2` | ➡️ derive from berry |
| `surface` / `background` | `#1e100e` | ➡️ `--surface` `#FFFFFF` (light) / `#1c1c1c` (dark) |
| `on-surface` | `#f9dcd8` | ➡️ `--ink` |
| `surface-variant` | `#42312e` | ➡️ `--surface-2` |
| `on-surface-variant` | `#e3beb9` | ➡️ `--muted` |
| `outline` | `#aa8984` | ➡️ `--line` |
| `outline-variant` | `#5b403d` | ➡️ `--line-soft` |
| `soft-white` | `#F5F5F7` | ➡️ `--surface-2`/canvas |
| `deep-charcoal` | `#121212` | ➡️ dark `--bg` |
| `muted-crimson` | `rgba(161,15,13,0.15)` | ➡️ `color-mix(--good 15%, transparent)` |

> ⚠️ The wizard palette is **Material-3 tonal on a dark brown surface** — it does not match the canonical berry-on-grey identity. Remap every utility above to the canonical token before reuse.

## 2. Spacing

| Tailwind | Value | Canonical |
|---|---|---|
| `p-3 / px-3 / py-3` | 0.75rem (12px) | `--space-3` |
| `p-4` | 1rem (16px) | `--space-4` |
| `p-5` | 1.25rem (20px) | (between `--space-4` and `--space-5`) ⚠️ off-grid; prefer 16 or 24 |
| `p-6` | 1.5rem (24px) | `--space-5` |
| `p-8` | 2rem (32px) | `--space-6` |
| `gap-1/2/3/4/6/8` | 4/8/12/16/24/32px | `--space-1/2/3/4/5/6` |
| `space-y-*` | 0.125–3rem | map to `--space-*` |
| `px-gutter` | 24px | gutter min |
| `px-margin-edge` | 40px | gutter max (`clamp(20,3vw,40)`) |

## 3. Radius

| Tailwind | Value | Canonical |
|---|---|---|
| `rounded` | 4px | (below scale — avoid) |
| `rounded-lg` | 8px | `--radius-sm`/`--radius-md` |
| `rounded-xl` | 12px | `--radius-lg` |
| `rounded-2xl` | 16px | (inline `--radius-lg` legacy) |
| `rounded-3xl` | 24px | (off scale) |
| `rounded-full` | 9999px | `--radius-pill` |

## 4. Shadow

| Tailwind | Value | Canonical |
|---|---|---|
| `shadow-2xl` | `0 25px 50px -12px rgba(0,0,0,.25)` | ➡️ **too heavy**; use `--apple-card-shadow-hover` |
| `shadow-[0_20px_50px_rgba(0,0,0,.5)]` | heavy | ➡️ remove (System A is hairline-first) |

## 5. Typography

| Tailwind | Value | Canonical |
|---|---|---|
| `font-headline-lg/md`, `display-xl` | Bricolage Grotesque, Georgia, serif | ➡️ `--font-display` (SF Pro/Inter) |
| `font-body-lg/md` | Hanken Grotesk, system-ui | ➡️ `--font` |
| `font-label-caps` | JetBrains Mono | ➡️ `--font` (no mono labels in System A) |
| `text-5xl/6xl` | 48/60px | ➡️ cap at `--type-display` 34px (System A is restrained) |
| `text-4xl` | 36px | near `--type-display` |
| `text-2xl` | 24px | between section/page title |
| `text-xl` | 20px | ≈ `--type-section-title` (21px) |
| `text-lg` | 18px | ≈ `--type-card-title` (17px) |
| `text-base`(implied) | 16px | ➡️ `--type-body` is 17px |
| `text-sm` | 14px | `--type-helper` |
| `text-xs` | 12px | `--type-fine` |
| `text-[9/10/11/14px]` | arbitrary | ➡️ snap to scale |
| `tracking-wider/widest/[0.2em]` | positive | ➡️ System A uses **negative** tracking |
| `uppercase` | — | ➡️ avoid (sentence case rule) |
| `leading-relaxed` | 1.625 | ≈ `--leading-relaxed` (1.57) |
| `leading-tight` | 1.25 | ≈ `--leading-tight` (1.24) |

## 6. Animations

| Tailwind | Value | Canonical |
|---|---|---|
| `transition`/`-colors`/`-transform`/`-opacity` | `cubic-bezier(0.4,0,0.2,1)` 150ms | ➡️ use `--ease-hover`/`--ease-out`, `--motion-duration-fast` |
| `duration-200` | 200ms | `--motion-duration-base` |
| `ease-in-out` | `cubic-bezier(0.4,0,0.2,1)` | ➡️ `--ease-in-out` |
| `active:scale-[0.98]` | scale 0.98 | ≈ press (System A uses 0.97/0.99) |
| `transition-all` | all | ➡️ **forbidden**; use explicit properties |

## 7. Containers & layout

| Tailwind | Value | Canonical |
|---|---|---|
| `max-w-container-max` | 1440px | ➡️ `--content-max` 1536px |
| `grid-cols-12` | 12 cols | Home bento (matches) |
| `w-[240px]`, `md:ml-[240px]` | 240px sidebar | ≈ `--app-sidebar-expanded-width` (220px) ⚠️ off by 20 |
| `backdrop-blur-md` | 12px | `--app-blur` / header glass |

## 8. Responsive breakpoints (Tailwind defaults used)

| Tailwind | Min-width | Canonical tier |
|---|---|---|
| `md:` | 768px | mobile→tablet |
| `lg:` | 1024px | tablet→desktop |
| (no `xl:` observed) | — | add 1440/1536 |

---

## Migration rule
> Any Tailwind-built screen reused inside the app **must** have its utilities remapped to the
> System A tokens above. Salmon→berry, dark-brown surface→white/grey, serif/mono fonts→system stack,
> heavy shadows→hairline, positive tracking→negative, `transition-all`→explicit. After remapping,
> the screen should be indistinguishable from hand-written System A CSS.
