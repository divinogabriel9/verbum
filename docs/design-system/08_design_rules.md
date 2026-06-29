# 08 · Design Rules (strict)

> Enforceable rules derived from the canonical System A implementation. "Always/Never" are binding.
> Token names refer to [`02_design_tokens.md`](02_design_tokens.md).

---

## Buttons
- Buttons **must always** be ≥ `--btn-height` (40px) tall (32px only for `.mini`), use `--radius-md`, `--type-helper` text, and `inline-flex` centered content.
- There **must always be exactly one `.primary` (berry) button per screen** — the single loudest action.
- Primary **must always** use `--good`/`--color-primary` fill + `--on-primary` text; hover → `--color-primary-active`.
- Secondary/ghost **must always** be neutral (white/transparent + hairline border); **never** a second berry fill competing with the primary.
- Buttons **must always** press with `scale(0.97)` (`--motion-duration-micro`) and show a focus ring.
- Destructive actions **must always** use `.danger` (danger-tinted) and confirm before irreversible effects.
- Buttons **never** carry decorative gradients, glows, or drop shadows (`box-shadow: none`).

## Cards
- Cards **always** use white `--surface`, `1px var(--card-border)`, `--radius-lg`, padding `--card-padding` (24px), and hairline depth.
- Cards **always** lift on hover via the Apple tokens (`translateY(-4px) scale(1.006)`, 320ms) — and **never** with heavy shadows.
- Cards **never** nest inside other grey cards (flat bento only).
- Card titles **always** `--type-card-title` (17px/600); supporting text `--type-helper` muted.

## Typography
- Typography **never** uses uppercase label micro-type — labels are **sentence case** 600.
- Type **always** uses the documented scale + **negative tracking** (`--tracking-*`); **never** ad-hoc font sizes.
- Body **always** `--type-body` (17px) / `--leading-body` (1.47); scripture uses `--leading-relaxed` (1.57).
- Headings **always** use `--font-display`; body uses `--font`. **Never** introduce a new font family (Bricolage/Hanken/JetBrains are System B and off-brand).
- Weights **never** exceed 700 in the canonical app.

## Dialogs / overlays
- Dialogs **should** scale in from `scale(0.95) translateY(8px)` at center origin (260ms), over `--app-scrim` + `blur(--app-blur)`.
- Dialogs **always** trap focus, close on `Esc`/backdrop, and return focus to the trigger.
- Dialog widths **always** come from `--ui-card-width*` tokens (480/600/900).
- Popovers/sheets **always** scale from their trigger origin (not viewport center).

## Spacing
- Spacing **must always** be a multiple of the 4px scale (`--space-1…7`); **never** arbitrary px.
- Card padding **always** `--space-5` (24px); list items `--space-3 --space-4`; field rhythm `--space-4`.
- Header and main content **always** align to the same `--layout-gutter`.

## Animations
- Animations **should** be ≤ 300ms, ease-**out** on enter/exit, and use the documented curves; **never** ease-in on UI, **never** `transition: all`.
- Motion **always** animates opacity/transform (and explicit properties) — **never** layout-thrashing properties.
- All motion **must** collapse under `prefers-reduced-motion: reduce`.

## Icons
- Icons **must** be sized from the documented set (nav 15px, menu 18px, indicator 16px, chevron 14px) and inherit `currentColor`.
- Icons **never** carry their own accent color except status (danger/sign-out) — they follow text color.
- Icons **never** decorate; they clarify an action or status.

## Lists
- Lists **always** define an **empty state** (events, celebrants, history, search, recents).
- List items **always** use `--radius-md` (or `--radius-sm` compact) and `--space-3 --space-4` padding.
- Selected/active rows **always** use the `--good 8%` mix + weight 600 convention.

## Forms
- Forms **should** use 44px (`--input-height`) controls, hairline borders, `--radius-md`, and a berry-tinted focus ring.
- Labels **always** sit above the field, sentence case, `--type-helper` 600, `margin-bottom --space-2`.
- Selects **should** prefer `.vb-select` (accessible custom) with a native fallback; **never** an unstyled native select for primary choices.
- Forms **always** enforce input limits (`input-limits.js`) and show inline validation/hints.

## Progressive disclosure
- Reveal complexity **step-by-step** (wizard steps, expandable cards, "read more"); **never** show every advanced option at once.
- Defaults **always** pre-fill the most common option so a beginner can proceed without choices.
- Advanced/admin controls **only** appear for the relevant role.

## Color discipline
- **No more than two accent colors** on screen at once (berry + one season tint).
- Berry is **only** for primary actions + active states — **never** decorative fills/backgrounds.
- Success/warn/danger **only** for genuine status; **never** as decoration.
- **No unnecessary gradients.** Gradients appear only where functionally needed (e.g., reflection-image overlay) — never as button/card decoration.

## Visual noise
- **No decorative UI.** Every element earns its place by clarifying content or enabling an action.
- **No visual noise:** no badges/chips/icons that don't convey state; no redundant borders inside cards; no competing shadows.
- Whitespace is a feature — when in doubt, add space, not chrome.

## Theming
- All colors **must** be tokenized so the four themes (light/dark/OLED/system) + visual styles (missalette/parchment/midnight) and user accent stay correct.
- **Never** hardcode hex in components — reference tokens (the lyric-block type chips are the documented exception and should be tokenized — see [`12_ui_audit.md`](12_ui_audit.md)).

## The one-primary-CTA law
> Each screen has exactly **one** berry primary action. Everything else is secondary/ghost/neutral. If two actions feel equally important, the design is wrong — pick one.
