# 12 · UI Audit

> Findings from reading the real codebase. Severity: 🔴 high · 🟠 medium · 🟡 low.
> Each finding: what · where · impact · recommendation.

---

## A. Duplicate / conflicting design systems 🔴

**A1. Two parallel design languages.**
- **System A (canonical):** `verbum-design-system.css` + inline `index.html` — SF Pro/Inter/Playfair, berry `#a10f0d`, grey canvas, hairline depth.
- **System B (divergent):** `mass_builder_wizard.css` (compiled Tailwind) + `mass_builder_wizard.html` — Bricolage Grotesque/Hanken Grotesk/JetBrains Mono, salmon `#ffb4a9` on dark `#1e100e`, Material-3 tonal token names (`on-primary`, `surface-variant`, `outline-variant`).
- **Impact:** Two visual identities; the wizard prototype is off-brand and risks leaking Material aesthetics into the product.
- **Recommendation:** Treat System A as the only source of truth. Either retire `mass_builder_wizard.*` or rebuild it in System A tokens. Remove Bricolage/Hanken/JetBrains from any in-app path.

**A2. Mobile builder is a third variant.** `mass_builder_mobile.html` (76KB) — verify it uses System A; if it inherits wizard tokens, fold it in.

---

## B. Duplicated components / token definitions 🟠

**B1. Token duplication across files.** Spacing, radius, motion, and color tokens are defined **both** in inline `:root` (`index.html`) **and** `verbum-design-system.css` (and again in `emil-motion.css`). DRY risk: edits in one place silently overridden by another (load order).
- **Recommendation:** Single canonical token file (`verbum-tokens.css`) imported first; remove duplicates from inline + motion file.

**B2. Button families overlap.** `.primary/.secondary/.ghost/.mini/.danger` **and** `.uiverse-btn` (+`--orange/--generate/--sm/.btn-xl`) **and** `.btn-create` **and** `.pill`. The uiverse buttons are legacy markup forcibly flattened with many `!important` overrides.
- **Recommendation:** Migrate uiverse markup to plain `.primary/.secondary`; delete the override block.

**B3. Card classes proliferate.** `.panel/.tool-card/.admin-card/.metric/.flow-bento-cell/.home-bento-cell/.cal-reading-card/.theme-card-wrap/.mass-song-plan-card` all share one anatomy but are styled in long selector lists.
- **Recommendation:** One `.card` base + modifiers; the content cards become layout variants only.

**B4. Dropdown duplication.** `.vb-dropdown-*`, `.global-search-*`, and `.app-menu-*` share identical item styling (co-declared). Fine today, but tightly coupled.
- **Recommendation:** Keep the shared selector but document it as one component ("Menu/Dropdown list").

---

## C. Radius inconsistencies 🔴

**C1. `--radius-md` / `--radius-lg` conflict between files.**
- Inline `index.html`: `--radius-md:12px; --radius-lg:16px`.
- `verbum-design-system.css` (loaded after): `--radius-md:8px; --radius-lg:12px`.
- **Effective:** 8/12. The 12/16 inline values are dead but misleading.
- **Recommendation:** Pick one (recommend 8/12/16 = sm/md/lg) and define once.

**C2. Tailwind/wizard radii** (`rounded-lg 8px`, `rounded-xl 12px`, `rounded-2xl 16px`, `rounded-3xl 24px`) introduce a parallel radius vocabulary. Consolidate with C1.

---

## D. Spacing inconsistencies 🟠

**D1. Mixed spacing sources.** Canonical uses `--space-*` (4px base); Tailwind utilities use `0.25rem` steps; some inline values use raw px (e.g., `8px 12px`, `10px 12px`, `4px 8px`).
- **Recommendation:** Replace raw px in component CSS with `--space-*` tokens.

**D2. Gap values vary by tier** (16/20/24px bento) — intentional but undocumented as a token. Promote to `--grid-gap-sm/md/lg`.

---

## E. Typography inconsistencies 🟠

**E1. "Mea Culpa" wordmark not loaded.** `DESIGN.md`/`AGENTS.md` say the wordmark is Mea Culpa, but only Inter + Playfair Display are loaded; the wordmark renders Playfair Display italic (salmon `#ffb4a9` on landing).
- **Recommendation:** Update docs to reflect Playfair Display italic, or actually load Mea Culpa.

**E2. Off-brand font families in System B** (Bricolage/Hanken/JetBrains) — see A1.

**E3. Uppercase micro-labels persist** despite the sentence-case rule: `.song-composer-catalog-label`, `.song-composer-recent__title`, `.vb-dropdown-group-label`, `.global-search-group-label` use `text-transform: uppercase` with `letter-spacing`. (Note: a later override sets some group labels to `text-transform:none` — partial fix.)
- **Recommendation:** Finish converting all group labels to sentence case.

**E4. Wordmark salmon `#ffb4a9`** differs from the app's berry — landing-only, but worth aligning the wordmark color across surfaces.

---

## F. Color inconsistencies 🟠

**F1. Success == primary berry.** `--design-success` and `--good` both `#a10f0d`; there is **no distinct success green** for status (ordinary-time green exists only for the calendar indicator).
- **Recommendation:** Introduce a semantic success green token (e.g., `#166534` reusing the ordinary green) for true success states; keep berry for brand/CTA.

**F2. Hardcoded hex in lyric-block type chips.** `.lyric-block.type-verse/.chorus/.bridge/.response` use raw hex (`#c4b5fd`, `#e0a8c0`, `#a8cfc2`, `#d8bc78`) plus separate dark-mode mixes and `rgba()` item hovers.
- **Recommendation:** Tokenize as `--type-verse/chorus/bridge/response` (+ on-color) for theming.

**F3. Danger token spread.** `--danger`, `--design-error`, `--bad` all `#9b3d4e` — three names, one value.
- **Recommendation:** One token `--danger`; alias the rest.

**F4. Accent vs liturgical-accent vs good.** `--accent`, `--liturgical-accent`, `--good`, `--color-primary` mostly equal berry but used interchangeably. Document the intended hierarchy (brand → CTA → season tint).

---

## G. Shadow inconsistencies 🟠

**G1. Two shadow philosophies.** Inline `index.html` defines real `--shadow-light/medium/large`, but `verbum-design-system.css` overrides them to `none` and uses the `--apple-card-*` shadows instead. Components reference both vocabularies (e.g., `.modal-box box-shadow: var(--shadow-large)` → resolves to `none`).
- **Recommendation:** Standardize on the Apple shadow tokens; give modals a real elevation token (modals currently have no shadow in light mode, only scrim).

**G2. Wizard/Tailwind shadows** (`shadow-2xl`, `0 20px 50px rgba(0,0,0,0.5)`) are heavy and off-brand (System B).

---

## H. Accessibility issues 🟠 / 🟡

- 🟠 **No skip-link / landmark roles** (`<main>/<nav>`) confirmed in markup.
- 🟠 **Field errors rely on status text/toast**, not `aria-invalid`/`aria-describedby`.
- 🟡 **Small icon-only controls** (28px search clear) below 40px hit area.
- 🟡 **Success color ambiguity** (no green/icon) — meaning leans on berry.
- 🟡 Verify muted-on-`surface-2` and placeholder contrast at AA.
(Positives: excellent `prefers-reduced-motion` coverage; focus rings present; aria-expanded/selected used.)

---

## I. UX problems 🟠

**I1. 5-step (live) vs 7-step (brief) Mass Builder mismatch.** Documentation/design intent diverges from implementation.
- **Recommendation:** Decide the canonical step count and align stepper + summary.

**I2. Missing `/radio` page.** Route + JS IDs exist; no page container → blank/non-functional route.
- **Recommendation:** Author the page (IDs already specified in the contract).

**I3. ID-coupled fragility.** ~23.5k-line SPA binds by `id`; renames silently break features.
- **Recommendation:** Strategy B — `data-action`/`data-field` + event delegation.

**I4. AI quota discoverability.** Quota hint only appears in-context; users may not know the daily limit until they try.
- **Recommendation:** Surface remaining quota proactively (see [`13_improvement_opportunities.md`](13_improvement_opportunities.md)).

---

## J. Technical debt 🔴 / 🟠

| Item | Severity | Note |
|---|---|---|
| Single 23.5k-line `index.html` with inline JS + CSS | 🔴 | Extract JS into `static/js/` modules; CSS into token + component files |
| `!important` override blocks (uiverse, group labels, pill selects) | 🟠 | Symptom of fighting legacy markup; remove by migrating markup |
| Dead/duplicated tokens (radius 12/16, real shadows) | 🟠 | Confusing; resolve via single token file |
| Two Tailwind builds (landing + wizard) + hand-written CSS | 🟠 | Pick one styling strategy for the app shell |
| Hardcoded hex in components | 🟠 | Tokenize for theming |
| `mass_builder_wizard.*` + `mass_builder_mobile.*` parallel templates | 🔴 | Reconcile to one builder in System A |

---

## K. Consolidation summary (what to merge)

1. **Tokens** → one `verbum-tokens.css` (kill inline + motion-file duplicates; resolve radius/shadow conflicts).
2. **Buttons** → `.primary/.secondary/.ghost/.mini/.danger` only; retire `.uiverse-btn`.
3. **Cards** → one `.card` base + content modifiers.
4. **Selects/menus** → one Menu/Dropdown component (`vb-dropdown` family).
5. **Design language** → retire System B (wizard/mobile) or rebuild in System A.
6. **Status colors** → distinct success green; single `--danger`; tokenized lyric-type colors.

See [`21_consistency_audit.md`](21_consistency_audit.md) for per-screen scores and the roadmap to 100/100.
