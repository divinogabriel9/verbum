# 18 · Future Components

> Recommended additions that fit the existing calm, light, berry-on-grey, Apple-grade language.
> Each: purpose · why it fits · built from (existing tokens/components). All marked `[RECOMMENDATION]`.

---

## 1. Switch (canonical) `[RECOMMENDATION]`
- **Purpose:** Standardize on/off toggles (AI poster, export PDF, footer, news, nav-tab visibility).
- **Why it fits:** Toggles currently lean on Tailwind/System-B styling; a System-A switch removes that dependency.
- **Built from:** `--good` track when on, `--surface-2` off, knob `--surface`, `--radius-pill`, 150ms ease-hover, `role="switch"`, 40px hit area.

## 2. Timeline / schedule `[RECOMMENDATION]`
- **Purpose:** Mass schedule, generation history with dates, liturgical-year overview.
- **Why it fits:** Extends the card + hairline-divider system; complements the calendar.
- **Built from:** vertical hairline rail, berry node dots, `--space-4` rhythm, card content per node.

## 3. Stat / KPI tile (formalized) `[RECOMMENDATION]`
- **Purpose:** Parish dashboard metrics (Masses built, songs in library, images left today).
- **Why it fits:** `.metric` exists informally; formalize as a documented component.
- **Built from:** `.metric` (value `--ink` 600 + caption muted), Apple hover lift.

## 4. Quota meter chip `[RECOMMENDATION]`
- **Purpose:** Persistent "N of M AI images left today" in header/Media.
- **Why it fits:** Surfaces existing `/api/image-quota`; improves discoverability (see [`13`](13_improvement_opportunities.md)).
- **Built from:** pill + tiny linear meter, warn color near limit, `aria-live`.

## 5. Inline field validation (form-field component) `[RECOMMENDATION]`
- **Purpose:** Field + label + hint + error in one accessible unit.
- **Why it fits:** Standardizes the scattered `.field`/hint/status patterns.
- **Built from:** `.field`, `<label>`, helper `--type-helper` muted, error `--danger` + `aria-describedby`/`aria-invalid`.

## 6. Empty-state block `[RECOMMENDATION]`
- **Purpose:** Consistent empty states (events, celebrants, posters, songs, history, search).
- **Why it fits:** Empty states exist but vary; one component ensures icon + one-line copy + one action.
- **Built from:** centered card, muted icon, `--type-body` line, single `.primary`/`.secondary` action.

## 7. Coachmark / first-run hint `[RECOMMENDATION]`
- **Purpose:** Onboarding nudges (⌘K hint, first-Mass checklist).
- **Why it fits:** Calm, dismissible; supports beginner-friendly goal.
- **Built from:** popover (trigger-origin scale-in), dismissible, no scrim.

## 8. Segmented "Quick vs Custom" toggle for the Mass Builder `[RECOMMENDATION]`
- **Purpose:** Offer a 2–3 click "smart defaults" path alongside the full wizard.
- **Why it fits:** Reduces clicks; reuses `.flow-builder-tabs` pattern.
- **Built from:** segmented control + pre-filled defaults.

## 9. Confirmation dialog (standard) `[RECOMMENDATION]`
- **Purpose:** Unify destructive confirmations (delete song/poster/celebrant) — today `song-delete-modal` is bespoke.
- **Built from:** compact modal (`--ui-card-width` smaller), `.danger` primary, clear consequence copy.

## 10. Status badge set `[RECOMMENDATION]`
- **Purpose:** Per-step completion (incomplete/in-progress/complete), membership states.
- **Built from:** badge + status color (introduce success green) + icon; meaning never by color alone.

## 11. Bottom-sheet select (mobile) `[RECOMMENDATION]`
- **Purpose:** Native-feeling option pickers on mobile.
- **Built from:** `vb-select` data + the existing More-sheet drawer pattern (`--ease-drawer`).

## 12. `/radio` page components `[RECOMMENDATION]` (also a structural gap)
- **Purpose:** Full radio browser (station list, now-playing, transport, channel position, status).
- **Built from:** card list + the existing `live-radio-*` player logic; IDs already specced in the contract.

---

### Selection principle
Only add a component when **two or more screens** need it and it can't be composed from existing
parts. Every new component must ship with: tokens-only styling, all states, a11y, reduced-motion
fallback, and an entry in [`03_component_library.md`](03_component_library.md).
