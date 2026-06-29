# 09 · Accessibility

> Source: focus/aria patterns in `verbum-design-system.css`, `emil-motion.css`, inline CSS,
> and ARIA usage in `templates/index.html`. Marked `[RECOMMENDATION]` where the codebase is silent.

Target conformance: **WCAG 2.1 AA** across all four themes (light/dark/OLED/system) and visual styles.

---

## 1. Touch targets
- Primary controls ≥ **40px** (`--btn-height`); inputs/selects **44px** (`--input-height`); header chips 36px.
- `DESIGN.md` + bento doc require **≥40–44px** touch targets on mobile.
- Search clear button 28px (small but inside a 36–44px field). **`[RECOMMENDATION]`** bump small icon-only controls to a 40px hit area via padding.

## 2. Keyboard support
- All interactive elements are real `<button>`/`<a>`/`<input>`/`<select>` (focusable by default).
- `.vb-select` custom dropdown: `aria-expanded`, arrow/Enter/Esc handling, `focus-visible` 2px outline.
- Tabs use `aria-selected`; stepper buttons focusable; menus keyboard-navigable.
- Modals: `Esc` closes; focus should trap and return to trigger.
- **`[RECOMMENDATION]`** Add a visible "Skip to content" link and verify focus order across the SPA route changes.

## 3. Contrast
- Ink `#15333D` on white / canvas `#EEF2F6` → strong AA+.
- Muted `#5C6B75` on white → AA for body/secondary text.
- Berry `#a10f0d` + white text → AA (large/UI). Dark mode primary shifts to `#d45250` with dark `--on-primary`.
- Dark mode explicitly re-asserts `--muted` for `.muted/.status/label` to stay readable (inline CSS).
- **`[RECOMMENDATION]`** Audit muted-on-`--surface-2` and placeholder (`--ink-subtle`) combos for 4.5:1; verify warn `#B45309` and danger `#9B3D4E` text contrast.

## 4. Focus states
- Inputs: border tint + `0 0 0 3px color-mix(--liturgical-accent 12%, transparent)` ring (`outline:none` replaced by ring).
- Custom select: `outline: 2px solid color-mix(--good 45%, transparent)` + 2px offset on `focus-visible`.
- Composer/recent items: `focus-visible` border + tint.
- Rule: **never remove focus affordance without an equal replacement** (the codebase replaces outline with a ring — acceptable).

## 5. Screen reader support
- Status regions use `aria-live` (auth gate `role="status" aria-live="polite"`, news/generation status).
- Toggles/menus expose `aria-expanded`, `aria-controls`; tabs `aria-selected`; account header email labeled.
- Decorative icons use `aria-hidden="true"` + empty `alt` (e.g., liturgical indicator icon).
- **`[RECOMMENDATION]`** Ensure every dynamic region (`home-events-board`, `mass-song-plan`, receipt) announces updates; add `role="dialog"`/`aria-modal` audit; label all icon-only buttons.

## 6. Semantic structure
- Headings follow the type scale (`h1–h6` styled via `--font-display`); use them in order.
- Each screen is a `<section class="page">` landmark; lists use real list semantics where possible.
- Labels are real `<label>` elements associated with controls.
- **`[RECOMMENDATION]`** Add `<main>`, `<nav>`, `<header>` landmarks and `aria-current` on active nav/step.

## 7. Motion reduction
- `@media (prefers-reduced-motion: reduce)` is honored across `emil-motion.css`, `verbum-design-system.css`, and inline CSS:
  - Card hover lifts → none; shimmer/stagger/spin → none; refresh opacity stays 1; press transform removed; scroll-behavior auto.
- This is a **strong, consistent** implementation — keep it for every new animated component.

## 8. Color-blindness considerations
- Meaning is **not conveyed by color alone**: liturgical season uses an icon + label + color bar (not just color); selected states add weight 600 + background, not just color.
- Lyric-block types use color **and** a text label (verse/chorus/bridge/response).
- **`[RECOMMENDATION]`** Verify status (success/warn/danger) always pairs an icon or text with color; success currently == berry (no green) which avoids red/green confusion but is ambiguous — add an icon/word.

## 9. Large-text support
- Base `html { font-size: 100% }` and `rem`-based type scale respect browser/OS text scaling.
- Negative tracking + relaxed leading keep text legible when scaled.
- **`[RECOMMENDATION]`** Test 200% zoom for layout reflow (bento, sticky dock, header) and ensure no clipped text; verify `clamp()` gutters don't crowd content at large text.

## 10. Forms & errors
- Inline hints (`.lyrics-analyze-hint.ok/.error`, status lines) and toasts convey validation.
- **`[RECOMMENDATION]`** Associate errors with fields via `aria-describedby`/`aria-invalid`; don't rely on toast alone for field-level errors.

## Accessibility checklist (per new component)
- [ ] Real semantic element + label
- [ ] ≥40px target
- [ ] AA contrast in all themes
- [ ] Visible focus (ring or outline)
- [ ] Keyboard operable (Tab/Enter/Esc/arrows)
- [ ] `aria-*` for state (expanded/selected/current/live)
- [ ] Honors `prefers-reduced-motion`
- [ ] Meaning not by color alone
