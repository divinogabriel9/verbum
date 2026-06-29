# 01 · Brand & Design Philosophy

> Source of truth: `DESIGN.md`, `AGENTS.md`, `static/css/verbum-design-system.css`, inline `:root` in `templates/index.html`.

LiturgyFlow / Verbum is a **Catholic Mass media generator**. The product helps parishes — often run by
non-technical volunteers — produce a complete, reverent Sunday Mass package (slides, posters, song lyrics)
in minutes. The brand must therefore feel **sacred but approachable, premium but calm, powerful but beginner-friendly.**

---

## 1. Design philosophy

> "Quiet confidence — scheduling SaaS meets missalette clarity." (`DESIGN.md §1`)

The interface is a **light, professional parish planning tool** — *not* a dark IDE, *not* a marketing
landing page, *not* an enterprise dashboard. It is a light grey app canvas (`#EEF2F6`) with white
floating cards, generous whitespace, readable scripture blocks, and minimal chrome.

The aesthetic lineage is explicit and codified in code comments:

- **Layout & color:** Cal.com (white cards, calendar-friendly density, soft surfaces).
- **Typography rhythm:** Apple.com (SF Pro scale, negative tracking, 17px body).
- **Motion:** Emil Kowalski's animation principles (`static/css/emil-motion.css`).
- **Brand accent:** "Winter Berry" `#a10f0d` (liturgical red), applied sparingly.

## 2. Personality

| Trait | How it shows up in the product |
|---|---|
| **Reverent** | Liturgical red accent, scripture given breathing room, season-aware coloring |
| **Calm** | Grey canvas, hairline borders instead of shadows, ≤300ms motion |
| **Modern** | System font stack, flat cards, command palette (⌘K), bento grids |
| **Premium** | Apple-style hover lift on cards, precise tracking, restrained palette |
| **Approachable** | Sentence-case labels, plain language, one primary action per screen |
| **Efficient** | Auto-loaded readings, recommendations, stepper-guided builder, deep links |

## 3. Design principles

1. **Whitespace is a feature.** Density never beats clarity. Stacking nested grey cards is forbidden — flat bento only.
2. **One primary action per screen.** The berry CTA is the single loudest element on any view.
3. **Berry is sacred — spend it sparingly.** Accent = primary actions + active states only. Never decorative.
4. **Hairlines over shadows.** Depth comes from 1px borders and subtle Apple-style hover lift, not drop shadows (light mode rest shadow is near-invisible; dark mode has none).
5. **Progressive disclosure.** The Mass Builder reveals complexity step-by-step; details hide until expanded.
6. **Readable scripture above all.** Reading text uses relaxed leading (1.57) and never sits in an inner scroller on Home.
7. **System-native typography.** SF Pro on Apple devices, Inter fallback — the UI should feel like it belongs to the OS.
8. **Season awareness, not season chaos.** The liturgical season may tint a secondary accent, but berry remains primary unless the user sets a custom accent.

## 4. Emotional goals

The user should feel **peaceful and focused**, never overwhelmed. Generating a Mass deck is a
spiritually significant, time-pressured task (often Saturday night before Sunday). The UI should reduce
anxiety: clear progress, reassuring copy, forgiving validation, and a satisfying "receipt" at the end.

- **Before generation:** confident, in control, guided.
- **During generation:** reassured (full-screen loader with human-readable status).
- **After generation:** rewarded (a clean receipt with download links).

## 5. Brand voice

- **Warm, plain, pastoral.** Speak like a helpful sacristan, not a SaaS growth team.
- **Sentence case** everywhere (Apple caption-strong), not SHOUTING UPPERCASE micro-type.
- **Encouraging, never clinical.** "Load readings & songs", "Generate full Mass package".
- **Reverent about content, casual about chrome.** Scripture references are formatted precisely; UI hints are conversational.
- Full guidance in [`11_copywriting.md`](11_copywriting.md).

## 6. UX goals

- A first-time volunteer can produce a complete Mass deck **without training**.
- Every destructive or expensive action (delete, generate, AI image) is **clearly previewed** and reversible or quota-aware.
- The same mental model works on **desktop (sidebar) and mobile (bottom nav + More sheet)**.
- **Deep links** make every screen and the Mass Builder steps shareable/bookmarkable.

## 7. Accessibility philosophy

Accessibility is a baseline, not a feature. (Detail in [`09_accessibility.md`](09_accessibility.md).)

- WCAG AA contrast on text in **all four themes** (light, dark, OLED, system) and visual styles (missalette/parchment/midnight).
- Touch targets ≥ 40px for primary controls (44px input height is the standard).
- Visible focus rings: berry/season-tinted 3px ring on inputs, 2px outline on custom controls.
- **`prefers-reduced-motion` is fully honored** — all hover lifts, shimmers, and stagger reveals collapse.
- Semantic HTML: `aria-expanded`, `aria-selected`, `aria-controls`, `aria-live` are used on real controls.

## 8. Consistency rules

- Use the documented tokens ([`02_design_tokens.md`](02_design_tokens.md)) — never raw hex, px, or ad-hoc durations.
- Use the documented components ([`03_component_library.md`](03_component_library.md)) — never invent a new button or card style.
- Cards: white surface, `1px var(--card-border)`, `--radius-lg` (16px), `--card-padding` (24px).
- Buttons: `--btn-height` (40px), `--radius-md`, `font-weight 500–600`, berry fill for primary only.
- Inputs: `--input-height` (44px), `--radius-md`, hairline border, berry-tinted focus ring.
- One accent family at a time. The berry + one season tint is the maximum.

## 9. Anti-patterns (do NOT do these)

- ❌ Material Design (elevation shadows, FAB ripples, filled-tonal buttons, uppercase chips).
- ❌ Enterprise dashboard clutter (dense data tables, multi-toolbar chrome, nested panels).
- ❌ Cursor orange / cream editorial palette (explicitly removed — `DESIGN.md §7`).
- ❌ Cal.com near-black `#111111` as a primary — always use berry `--good`.
- ❌ Highlighting the Verbum wordmark as an active nav tab.
- ❌ Stacked nested grey cards.
- ❌ Heavy drop shadows or glows on light mode.
- ❌ Gradients as decoration, more than two accent colors, decorative icons.
- ❌ Uppercase label micro-type (use sentence case).

## 10. What the interface should NEVER look like

- A **dark developer tool** (the canonical app is light-first; dark is a respectful option, not the identity).
- A **Material admin console** with a colored app bar, FABs, and chips.
- A **busy SaaS dashboard** with sparkline widgets crammed edge-to-edge.
- A **flashy marketing page** inside the app (that energy lives only on `landing.html`).
- The **divergent wizard prototype** (`mass_builder_wizard.html`): salmon-on-charcoal, serif Bricolage headings, mono labels. This is explicitly *off-brand* for the canonical product and must not be propagated. See [`12_ui_audit.md`](12_ui_audit.md).

**One-line brand test:** *If it doesn't feel like a calm, light, Apple-grade parish tool with a single sacred-red action, it's wrong.*
