# 13 · Improvement Opportunities

> Improvements that **do not change the visual identity** (calm, light, berry-on-grey, Apple-grade).
> Ordered by impact. Each: problem → improvement → why it's safe.

---

## 1. Reducing clicks

1. **Auto-advance the wizard after a date is chosen.** Picking a date already loads readings/season; jump focus to the next decision automatically. *Safe: no new UI, just flow.*
2. **One-tap "smart defaults" Mass.** A "Quick generate" path that pre-fills every step with defaults + recommended songs, so a rushed user reaches the receipt in 2–3 clicks. *Safe: uses existing controls/defaults.*
3. **Inline celebrant add.** Let users add a celebrant directly from the picker empty state without leaving for Settings. *Safe: reuses the add control.*
4. **Persist last-used choices** (celebrant, currency, layout, branding toggles) as defaults. *Safe: invisible until it saves a click.*
5. **Calendar "Use this date" → land directly on the relevant builder step**, not the top. *Safe: deep-link refinement.*

## 2. Reducing cognitive load

1. **Per-step completion badges** on the stepper/cards (incomplete/complete) so users always know what's left. *Safe: tiny status dot in existing card head.*
2. **Collapse rarely-used options behind "Advanced".** Custom psalm/gospel overrides, second AI backend — hide until needed. *Safe: progressive disclosure already a principle.*
3. **Show the estimated slide count live** as choices change (not only on summary). *Safe: existing data.*
4. **Group the 6 liturgy dropdowns visually** with section labels and sensible defaults pre-selected. *Safe: layout only.*

## 3. Improving discoverability

1. **Proactive AI quota chip** in the header/Media step ("3 of 5 images left today") instead of only a hint after action. *Safe: uses `/api/image-quota`.*
2. **First-run command-palette hint** ("Press ⌘K to jump anywhere"). *Safe: dismissible coachmark.*
3. **Surface "Recommendations" earlier** in the song plan with a clear "why" (gospel mood). *Safe: existing panel.*
4. **Expose the missing `/radio` page** so the header pill has a home. *Safe: fills a known gap.*

## 4. Improving onboarding

1. **Empty-state guidance everywhere** with one clear action (events, celebrants, posters, songs) — already partly present; make consistent. *Safe: copy + one button.*
2. **A 3-step "first Mass" checklist** on Home for new parishes (add parish name → add a celebrant → build your first Mass). *Safe: a dismissible card in the bento.*
3. **Inline examples** in the lyrics composer (sample verse/chorus) so the structured editor isn't intimidating. *Safe: placeholder content.*

## 5. Improving the wizard flow

1. **Reconcile to one canonical step model** (recommend the 7-step with an editable summary) and keep the persistent readings sidebar from step 3. *Safe: structural clarity, same components.*
2. **Sticky "Continue" mirrors the generate dock** so forward motion is always one tap. *Safe: reuses dock pattern.*
3. **Validation as gentle gating** (disable Continue with a reason tooltip) rather than errors after the fact. *Safe: existing controls.*
4. **"Edit" links on the summary** that scroll-and-highlight the target field. *Safe: anchor + highlight.*

## 6. Improving mobile experience

1. **Make the generate dock thumb-reachable** and always visible on mobile builder. *Safe: sticky dock already exists.*
2. **One step per screen on mobile** with a slim progress bar, instead of long scroll. *Safe: stepper already present.*
3. **Bottom-sheet pickers** for selects on mobile (native-feeling). *Safe: matches the More-sheet pattern.*
4. **Verify `mass_builder_mobile.html` uses System A tokens** so mobile matches desktop. *Safe: consistency fix.*

## 7. Improving accessibility (non-visual)

1. Add `<main>/<nav>` landmarks, a skip-link, and `aria-current` on active nav/step.
2. Associate field errors with `aria-describedby`/`aria-invalid`.
3. Bump icon-only controls (search clear) to a 40px hit area via padding.
4. Pair status colors with an icon/word (especially success, which currently == berry).
*All invisible to sighted users — identity unchanged.*

## 8. Improving consistency (mechanical)

1. **Single token file**; resolve radius/shadow conflicts (see [`12_ui_audit.md`](12_ui_audit.md)).
2. **Retire `.uiverse-btn`** by migrating markup to `.primary/.secondary`.
3. **One `.card` base** + modifiers.
4. **Tokenize hardcoded hex** (lyric-block types, danger aliases).
5. **Retire/rebuild System B** (wizard/mobile) in System A.
*These change code, not the look — pixels stay the same, the system gets coherent.*

---

## Quick-win shortlist (high impact, low risk)
- Proactive quota chip · per-step completion badges · live slide-count · inline celebrant add · persist last-used defaults · single token file · landmarks + skip-link.
