# LiturgyFlow Design System — Single Source of Truth

> Reverse-engineered from the existing implementation (`templates/`, `static/css/`, `static/js/`, `data/`).
> Everything documented here was **extracted from real code**. Where a token, component, or pattern is
> missing in the codebase, it is explicitly marked **`[RECOMMENDATION]`** and follows an industry-standard default.

LiturgyFlow (deploy/repo name **Verbum**) is a Catholic Mass media generator: parishes pick a date and the
app produces ready-to-use PowerPoint decks, posters, AI gospel imagery, and a song/lyrics library — built on
liturgical-calendar intelligence (Year A/B/C, season colors, hymn library).

## How to read this folder

| File | What it covers |
|---|---|
| [`01_brand.md`](01_brand.md) | Philosophy, personality, principles, voice, anti-patterns |
| [`02_design_tokens.md`](02_design_tokens.md) | Every color / type / spacing / radius / motion token + where used |
| [`03_component_library.md`](03_component_library.md) | Every reusable component, variants, states, a11y |
| [`04_layout_system.md`](04_layout_system.md) | Page layout, grid, containers, responsive behavior |
| [`05_navigation.md`](05_navigation.md) | IA, routing, wizard flow, back behavior |
| [`06_screen_inventory.md`](06_screen_inventory.md) | Every screen with purpose, states, dependencies |
| [`07_user_flows.md`](07_user_flows.md) | Every workflow: entry → decisions → validation → exit |
| [`08_design_rules.md`](08_design_rules.md) | Strict do/don't rules |
| [`09_accessibility.md`](09_accessibility.md) | Targets, keyboard, contrast, focus, reduced motion |
| [`10_motion.md`](10_motion.md) | Animation philosophy, timing, curves |
| [`11_copywriting.md`](11_copywriting.md) | Voice, tone, microcopy rules |
| [`12_ui_audit.md`](12_ui_audit.md) | Duplicates, inconsistencies, debt + recommendations |
| [`13_improvement_opportunities.md`](13_improvement_opportunities.md) | Non-identity-changing improvements |
| [`14_ai_prompt.md`](14_ai_prompt.md) | Master prompt for any AI generating UI |
| [`15_component_inventory.md`](15_component_inventory.md) | Component → file → props → reuse decisions |
| [`16_tailwind_mapping.md`](16_tailwind_mapping.md) | Tailwind utilities → tokens |
| [`17_assets.md`](17_assets.md) | Icons, images, fonts, logos, SVGs |
| [`18_future_components.md`](18_future_components.md) | Recommended future components |
| [`19_figma_export.md`](19_figma_export.md) | Figma-ready component spec |
| [`20_stitch_reference.md`](20_stitch_reference.md) | **The Design Bible for Stitch AI** |
| [`21_consistency_audit.md`](21_consistency_audit.md) | Per-screen 0–100 scores + roadmap to 100 |

## Critical context for anyone editing this product

1. **There are currently TWO design languages in the codebase.** This is the single biggest finding.
   - **System A — "Verbum" (canonical):** the live app shell (`templates/index.html` + `static/css/verbum-design-system.css`). SF Pro / Inter / Playfair Display, **berry `#a10f0d`**, grey canvas `#EEF2F6`, white cards, hairline borders, no heavy shadows.
   - **System B — "Wizard" (divergent prototype):** `templates/mass_builder_wizard.html` + `static/css/mass_builder_wizard.css` (compiled Tailwind). Bricolage Grotesque / Hanken Grotesk / JetBrains Mono, **salmon `#ffb4a9` on a dark `#1e100e` surface**, Material-style token names.
   - **All new design work must use System A (Verbum).** System B is treated as a non-canonical experiment in this documentation. See [`12_ui_audit.md`](12_ui_audit.md).

2. **The main app is one ~23.5k-line SPA** (`templates/index.html`) with inline vanilla JS that binds by element `id`. Renaming/removing an `id` silently breaks features. The wiring contract lives in the repo root at `REDESIGN_INTEGRATION_CONTRACT.md`.

3. **Whitespace is a feature.** Calm, minimal, premium, beginner-friendly. Inspired by Apple, Linear, Arc, Notion, Stripe. Never Material Design clutter.
