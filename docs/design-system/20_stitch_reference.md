# 20 · Stitch AI Design Bible — LiturgyFlow

> **This is the single most important document.** It is a self-contained brief so Stitch AI (or any
> generative design tool) produces screens that perfectly match LiturgyFlow's canonical **System A**
> identity. Everything here is extracted from the real implementation. Pin this; restate the
> "Design System" block in your first Stitch prompt and keep it referenced for every screen.

---

## 0. Read me first
- Design **only** in **System A (Verbum)**: calm, light, premium, Apple/Linear/Arc/Notion/Stripe-grade.
- **Ignore** the existing `mass_builder_wizard.*` look (salmon-on-dark, serif Bricolage, mono labels) — it is off-brand and must not be reproduced.
- Whitespace is a feature. One berry CTA per screen. No Material Design. No clutter.

---

## 1. Design philosophy
LiturgyFlow helps non-technical parish volunteers build a complete Sunday Mass package (slides,
posters, songs) in minutes. The feeling must be **reverent, calm, focused, and reassuring** — a quiet,
premium parish tool. "Scheduling SaaS meets missalette clarity." Reduce anxiety; reward completion.

## 2. Visual language
- **Canvas:** light grey `#EEF2F6` (dark mode `#121212`).
- **Cards:** white `#FFFFFF`, 1px border `#E4E9EF`, radius 12px, padding 24px, floating on the canvas.
- **Depth:** hairline borders + a subtle Apple hover lift (move up 4px, scale 1.006, 320ms). **No heavy shadows. No glows in light mode.**
- **Accent (sacred):** berry red `#a10f0d` — used ONLY for the single primary action + active states. A liturgical-season tint (e.g., ordinary-time green `#166534`) may appear as a secondary accent. Max two accents on screen.
- **Type:** system stack (SF Pro / Inter). Headings = same family, 600 weight, **negative tracking**. Body 17px. Captions/labels 14px **sentence case**. Wordmark = Playfair Display italic.
- **Icons:** simple line icons inheriting text color, 15–18px. Never decorative.
- **Motion:** ≤300ms, ease-out, scale-from-0.95. Honor reduced motion.

### Exact palette (use these, invent nothing)
```
canvas #EEF2F6   surface #FFFFFF   surface-2 #F8FAFC   card-border #E4E9EF   line #E2E8F0
ink #15333D      muted #5C6B75     primary/berry #a10f0d  primary-hover #7a0b0a  on-primary #FFFFFF
glow #d45250     success-green #166534  warn #B45309   danger #9B3D4E
DARK: bg #121212  surface #1c1c1c  ink #fafafa  muted #b4b4b4  primary #d45250
```

## 3. Spacing & sizing (4px base — invent nothing)
```
space: 4 · 8 · 12 · 16 · 24 · 32 · 48
radius: sm 8 · md 8 · lg 12 · pill 999
card padding 24 · section gap 24 · field gap 16
button height 40 (sm 32, xl 44) · input/select height 44 · header 65
content max 1536 · gutter clamp(20–40) · sidebar 72→220
```

## 4. Components (use ONLY these; compose, never invent)
- **Button** — Primary (berry fill, one per screen), Secondary (white + hairline), Ghost, Danger (danger-tint), Create (berry, header). 40px, radius 8, sentence-case verb labels. Press scale 0.97.
- **Card** — white, hairline, radius 12, padding 24, hover lift. Never nest grey cards.
- **Input / Textarea / Date** — 44px, hairline, radius 8, label above (sentence case 600), berry-tint focus ring.
- **Select / Dropdown** — custom trigger (44px, chevron rotates open) + panel (white, hairline, soft dropdown shadow). Compact "pill" variant for colored tags.
- **Menu** — account/create/search menus: items with optional icon column + hint; hover tint, active = berry-8% + 600.
- **Tabs / Segmented control** — pill container with inner buttons; selected = white + 600 + light shadow.
- **Modal/Dialog** — center scale-in over a blurred scrim. Widths 480 / 600 (receipt) / 900 (reading).
- **Bottom sheet** — mobile "More" + song preview; slide up with drawer easing.
- **Stepper** — horizontal Mass-Builder progress; current step glows.
- **Progress meter** — linear fill (song plan) + full-screen generation loader with status text.
- **Toast** — top/edge, slide+scale in, auto-dismiss; success/error.
- **Banner** — contextual inline (membership pending/approved).
- **Badge / Chip** — status badge; removable chips (food sponsors); colored lyric-type chips.
- **Avatar** — parish logo (rounded square) + placeholder + upload.
- **Skeleton / Loading** — shimmer blocks; staggered content reveal.
- **Search** — header command palette (⌘K, grouped results) + inline catalog search with clear button.
- **Content cards** — Reading, Theme, Template (poster picker 4-thumb), Song-plan slot, Song, Celebrant, History, Event, News, Metric — all are the Card with different content layouts.

## 5. Hierarchy rules
- One **Primary** (berry) action per screen — the loudest element.
- Title (page/section) → primary content → supporting → secondary actions → status.
- Scripture/readings get the most breathing room (relaxed leading 1.57), never inner-scrolled on Home.
- Group related controls; pre-select sensible defaults; hide advanced behind progressive disclosure.

## 6. Layout system
- **Shell:** fixed frosted header (brand · search/⌘K · radio pill · season indicator · notifications · theme toggle · account · + Create · nav tabs). Desktop left sidebar (72→220px). Mobile bottom tab bar + "More" sheet.
- **Home:** 12-column bento — reflection hero, upcoming-Sunday gospel, 3 reading tiles, events board, news feed, membership banner.
- **Mass Builder:** stepper + step content + persistent readings sidebar + sticky bottom generate dock.
- **Content:** max 1536px, centered, shared gutter; section gap 24; cards float on grey.
- **Responsive:** ≤768 mobile (stack, bottom nav, hide header search), 1024 tablet (2-col), 1440+ desktop.

## 7. UX principles
- Beginner-first: defaults everywhere, friendly empty states with one action, kind blame-free errors with a fix.
- Reduce clicks: auto-load readings on date pick, recommendations, persisted defaults.
- Always design **loading (skeleton) / empty / error / success / AI-quota limit-reached** states.
- Reassure during long actions (generation): full-screen loader with human-readable status → a clear receipt with download buttons.

## 8. Navigation
Home · Mass (Builder, Calendar) · Library (Songs, Collections) · Media (Posters, History) ·
Design (Theme Lab, Templates) · Radio · Settings (Church, Appearance). Desktop sidebar + header tabs;
mobile bottom bar + More sheet; command palette (⌘K); "Create" menu (PPTX/event/poster/song/collection).

## 9. Component usage map (which screen uses what)
| Screen | Key components |
|---|---|
| Home | Reflection hero card, reading tiles, events board (+empty), news feed, banner, event modal, reading modal |
| Song Library | Two-pane: searchable catalog + lyrics composer with structured block editor, language/section selects, metadata + delete modals |
| Mass Builder | Stepper, segmented tabs, setup bento cards, selects, celebrant picker, poster pickers, AI toggles + quota, uploads, song-plan slots + recs + progress, readings sidebar, sticky dock, loader, receipt modal |
| Calendar | Month grid, day-detail panel, reading preview cards, use-date/generate |
| Posters | Inputs, AI vs template choice + quota, live preview, saved gallery (upload/delete), downloads |
| History | List of past downloads + empty state |
| Collections | Quick-link cards, recent strip, catalog |
| Templates | Drag-drop uploader + analyze + status (utilitarian) |
| Settings | Sub-nav, logo avatar + upload, branding toggles, celebrants list, theme/accent/style radios + swatches, radio list, admin moderation |
| Radio (new) | Station list, now-playing (title + art), play/prev/next, channel position, status |

## 10. Do ✓ / Don't ✗
**Do**
- ✓ Light grey canvas, white floating cards, hairline borders.
- ✓ Exactly one berry primary button per screen.
- ✓ Sentence-case labels; system font; negative tracking; 17px body.
- ✓ Subtle Apple hover lift; ≤300ms ease-out motion.
- ✓ Generous whitespace; group + label; progressive disclosure.
- ✓ Design every state (loading/empty/error/success/limit-reached), light + dark.
- ✓ Touch targets ≥40px; visible focus rings; AA contrast.

**Don't**
- ✗ Material Design (FABs, elevation shadows, filled-tonal chips, ripples, uppercase chips).
- ✗ Salmon `#ffb4a9`, dark-brown surfaces, Bricolage/Hanken/JetBrains fonts (System B).
- ✗ More than two accent colors; berry as decoration; decorative gradients/icons/glows.
- ✗ Heavy drop shadows; nested grey cards; dense dashboard clutter.
- ✗ ALL-CAPS labels; positive letter-spacing; fonts larger than 34px.
- ✗ Two competing primary buttons; inner-scrolled scripture on Home.

## 11. One-prompt starter for Stitch
> "Design [SCREEN] for **LiturgyFlow**, a calm, light, premium Catholic Mass tool. Light grey canvas
> `#EEF2F6`, white floating cards (1px border `#E4E9EF`, radius 12, padding 24), hairline depth +
> subtle hover lift, **no heavy shadows**. System font (SF Pro/Inter), 17px body, sentence-case 14px
> labels, negative tracking; wordmark in Playfair Display italic. Berry `#a10f0d` is the ONLY accent —
> use it for the single primary button and active states. Spacing on a 4px scale (4/8/12/16/24/32/48),
> buttons 40px, inputs 44px, radius 8/12/pill. Use only these components: Button, Card, Input, Select,
> Menu, Tabs, Modal, Stepper, Progress, Toast, Banner, Badge/Chip, Avatar, Skeleton, Search, and content
> cards. One primary CTA. Generous whitespace. No Material Design, no clutter, no gradients. Provide
> light + dark and loading/empty/error/success (+ AI-quota limit-reached) states. Calm, reverent,
> beginner-friendly, designed by one product team."

> Append the specific screen's entry from [`06_screen_inventory.md`](06_screen_inventory.md) and its flow from [`07_user_flows.md`](07_user_flows.md). For code integration afterward, re-apply the `id`/`data-*` hooks from `REDESIGN_INTEGRATION_CONTRACT.md`.

## 12. Sample content (use realistic liturgical content)
- Readings: "First Reading — Isaiah 55:1–3", Psalm refrain "The hand of the Lord feeds us…", Gospel "Matthew 14:13–21".
- Songs: "Table of Plenty", "One Bread, One Body", "Here I Am, Lord" (Entrance/Offertory/Communion/Recessional).
- Celebrant: "Fr. Miguel Santos"; Co-celebrant optional.
- Season: "Ordinary Time" (green), with date e.g. "Sunday, 3 Aug — 18th Sunday in Ordinary Time".
- Receipt downloads: ZIP · PPTX · PDF · Poster · Social.

> Realistic content makes layouts honest — use it, don't use lorem ipsum.
