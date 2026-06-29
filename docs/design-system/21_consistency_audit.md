# 21 · Design System Consistency Audit & Roadmap to 100/100

> Final deliverable. Every screen scored **0–100** for adherence to the canonical **System A** identity,
> with reasons, then a roadmap to a perfect 100/100 **without changing the visual identity**.

Scoring rubric (100 pts): **Tokens 25** (color/type/space/radius/shadow all tokenized & correct) ·
**Components 20** (uses documented components, no bespoke duplicates) · **Layout 15** (grid, gutter,
spacing rhythm) · **States 15** (loading/empty/error/success + limit-reached) · **Accessibility 15**
(targets, focus, aria, contrast, reduced-motion) · **Voice/Copy 10** (sentence case, kind, verb-first).

---

## Per-screen scores

| # | Screen | Score | Why |
|---|---|---:|---|
| 1 | **Home** (`/home`) | **88** | Exemplary System A: bento, hairline cards, berry CTA, skeletons, empty states, reduced-motion. Minor: success-color ambiguity, landmark/aria gaps, some uppercase micro-labels. |
| 2 | **Song Library** (`/library/songs`) | **80** | Strong composer + accessible `vb-select`. Deductions: hardcoded lyric-type hex (not tokenized), uppercase catalog/recent labels, very large composer (maintainability), field-error aria. |
| 3 | **Theme Lab** (`/design/theme-lab`) | **82** | Clean, minimal, correct tokens. Deductions: empty/hidden grid state could be friendlier; status aria; sparse a11y labeling. |
| 4 | **Mass Builder** (`/mass/builder`) | **72** | Most complex; mostly System A (bento, stepper, dock, receipt). Deductions: **5-step live vs 7-step brief mismatch**, `.uiverse-btn` legacy buttons with `!important`, raw-px spacing, many selects need consistent labeling, quota discoverability. |
| 5 | **Calendar** (`/mass/calendar`) | **84** | Month grid + day detail in System A; season color via icon+label+bar (good a11y). Deductions: keyboard grid nav verification, loading/empty polish. |
| 6 | **Posters** (`/media/posters`) | **80** | Live preview + gallery + quota states present. Deductions: limit-reached/empty polish, duplicate AI-poster logic with Builder, status aria. |
| 7 | **History** (`/media/history`) | **78** | Simple, on-brand list. Deductions: empty-state consistency, minimal a11y labeling, no loading (local) is fine but re-download affordance could be clearer. |
| 8 | **Collections** (`/library/collections`) | **79** | Hub of cards + catalog reuse. Deductions: thin empty states, overlaps Library (clarify purpose), a11y. |
| 9 | **Templates** (`/design/templates`) | **74** | Utilitarian by design (admin). Deductions: drag-drop a11y/fallback, result-state styling, intentionally bare. |
| 10 | **Settings — Church** (`/settings/church`) | **81** | Tokenized forms, avatar, moderation lists. Deductions: field-error aria, moderation list empty states, dense admin area. |
| 11 | **Settings — Appearance** (`/settings/app`) | **83** | Theme/accent/style controls are core to the system and consistent. Deductions: radio-group labeling, radio-station list states, masked key a11y. |
| 12 | **Radio** (`/radio`) | **15** | **Structural gap: no page exists.** Route + JS IDs reference a non-existent container. Near-zero until authored. |
| 13 | **Auth** (`/sign-in`,`/sign-up`) | **76** | Themed, aurora bg, works. Deductions: separate styling path, verify token alignment + a11y. |
| 14 | **Mass Builder — Wizard prototype** (`mass_builder_wizard.*`) | **30** | **Off-brand System B**: salmon-on-dark, Bricolage/Hanken/JetBrains, Material tonal, heavy shadows. Functionally a prototype; fails the identity test. |
| 15 | **Mass Builder — Mobile** (`mass_builder_mobile.*`) | **55** | Mobile variant; needs verification it uses System A tokens (suspected System-B leakage). Provisional. |
| — | **Landing** (`landing.html`) | **n/a** | Marketing page, intentionally separate aesthetic (shares Inter/Playfair). Excluded from in-app consistency scoring. |

### Aggregate
- **Canonical in-app screens (1–11, 13):** average ≈ **80/100** — a genuinely strong, coherent system.
- **Including the gap + System B (12, 14, 15):** average drops to ≈ **68/100**.
- **Headline:** the canonical app is ~80; the score is dragged down by (a) the missing `/radio` page and (b) the divergent wizard/mobile builder. Fixing those two plus mechanical token cleanup reaches the 90s quickly.

---

## Why points are lost (system-wide themes)
1. **Two design systems** (A vs B wizard/mobile) — biggest single drag. (−)
2. **Missing `/radio` page** — a whole route at ~15. (−)
3. **Token conflicts** — radius 8/12 vs 12/16, real shadows vs `none`, duplicate token definitions. (−)
4. **Hardcoded hex** — lyric-type colors, danger aliases — break theming purity. (−)
5. **Legacy `.uiverse-btn`** with `!important` overrides — component duplication. (−)
6. **A11y gaps** — landmarks, skip-link, field-error aria, small hit areas, success color ambiguity. (−)
7. **5-step vs 7-step Builder** mismatch — IA/intent divergence. (−)
8. **Uppercase micro-labels** persisting against the sentence-case rule. (−)

---

## Roadmap to 100/100 (identity unchanged)

> No pixels of the canonical look change — this is consolidation, completion, and accessibility.

### Phase 1 — Stop the bleeding (System unification) → target avg ~85
1. **Decide System A is canonical** (done in this doc). Freeze System B.
2. **Rebuild the Mass Builder wizard + mobile in System A tokens** (or retire the standalone wizard and use the in-app `/mass/builder`). Removes the salmon/serif/mono identity. *(Screens 4/14/15 jump.)*
3. **Author the `/radio` page** in System A using the existing `live-radio-*` logic + specced IDs. *(Screen 12: 15→85.)*

### Phase 2 — Token hygiene → target avg ~90
4. **Single token file** (`verbum-tokens.css`), imported first; delete inline + motion-file duplicates.
5. **Resolve conflicts:** one radius scale (8/12/16 sm/md/lg), one shadow philosophy (Apple tokens; give modals a real elevation token), one `--danger`.
6. **Tokenize hardcoded hex** (lyric-block verse/chorus/bridge/response + on-colors).
7. **Add a semantic success green** (`#166534`) distinct from brand berry.

### Phase 3 — Component consolidation → target avg ~93
8. **Retire `.uiverse-btn`**: migrate markup to `.primary/.secondary`; delete `!important` override block.
9. **One `.card` base** + content modifiers; collapse the card-class list.
10. **One Menu/Dropdown component** (unify `vb-dropdown`/`global-search`/`app-menu`).
11. **Build a canonical Switch** in System A; replace Tailwind peer switches.
12. **Finish sentence-casing** all group/micro labels.

### Phase 4 — Accessibility to AA-complete → target avg ~97
13. Add `<main>/<nav>/<header>` landmarks, a **skip-link**, and `aria-current` on active nav/step.
14. Associate field errors via `aria-invalid`/`aria-describedby`; don't rely on toast alone.
15. Bump icon-only controls to a 40px hit area; pair status colors with icon/word.
16. Verify AA contrast for muted-on-`surface-2`, placeholders, warn/danger text in all themes; test 200% zoom reflow.

### Phase 5 — Flow & polish → target 100
17. **Reconcile the Mass Builder to one canonical step model** (recommend 7-step with editable summary + persistent readings sidebar) and align the stepper/summary.
18. **Per-step completion badges**, **live slide-count**, **proactive quota chip** (discoverability without identity change).
19. **Consistent empty-state component** across events/celebrants/posters/songs/history/search.
20. **Decouple JS from `id`s** (Strategy B: `data-action`/`data-field` + delegation) so future redesigns can't silently break — protecting the 100 over time.

### Definition of 100/100
Every in-app screen: tokens-only styling (no raw hex/px, no conflicts), only documented components,
correct grid/spacing rhythm, all five states designed, AA accessibility with landmarks + reduced motion,
sentence-case kind copy — **and one coherent identity** with no System-B remnants and no missing routes.

---

## Tracking table (fill as phases complete)

| Screen | Now | After P1 | After P2 | After P3 | After P4 | Target |
|---|---:|---:|---:|---:|---:|---:|
| Home | 88 | 90 | 94 | 96 | 99 | 100 |
| Song Library | 80 | 82 | 90 | 94 | 98 | 100 |
| Theme Lab | 82 | 84 | 90 | 94 | 98 | 100 |
| Mass Builder | 72 | 84 | 90 | 94 | 97 | 100 |
| Calendar | 84 | 86 | 92 | 95 | 99 | 100 |
| Posters | 80 | 84 | 90 | 94 | 98 | 100 |
| History | 78 | 80 | 88 | 93 | 98 | 100 |
| Collections | 79 | 82 | 89 | 94 | 98 | 100 |
| Templates | 74 | 76 | 86 | 92 | 98 | 100 |
| Settings · Church | 81 | 83 | 90 | 94 | 99 | 100 |
| Settings · Appearance | 83 | 85 | 91 | 95 | 99 | 100 |
| Radio | 15 | 85 | 90 | 94 | 99 | 100 |
| Auth | 76 | 80 | 88 | 93 | 98 | 100 |
| Builder (mobile) | 55 | 85 | 91 | 95 | 99 | 100 |

> The fastest gains are Phase 1 (unify System B + author `/radio`) and Phase 2 (token hygiene): together they lift the aggregate from ~68 to ~90 without touching the canonical visual identity.
