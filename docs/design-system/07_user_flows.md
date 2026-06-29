# 07 · User Flows

> Source: `REDESIGN_INTEGRATION_CONTRACT.md`, `STITCH_DESIGN_BRIEF.md` (Mass Builder 7-step), routing JS.
> Each flow: **Entry → Decision points → Validation → Exit → Edge cases → Failure → Recovery.**

---

## 1. Creating a Sunday Mass (the core flow)

**Entry:** `+ Create → PPTX` (or sidebar Mass Builder, or Calendar "use this date", or legacy `/media/presentation`).

**Steps (live 5-step stepper / target 7-step wizard):**
1. **Basics / Mass Details** — pick date (auto-loads readings + season + color), choose celebrant (searchable picker; empty state → add celebrant), optional co-celebrant.
2. **Order of the Mass** — penitential act, Kyrie, Gloria, Creed (Nicene/Apostles'), Our Father (English/Malay/Tagalog/Visaya/Korean), Lamb of God. Defaults pre-selected to the most common option.
3. **Readings & Psalm** — review auto-loaded readings; choose psalm refrain (detected list or custom), gospel acclamation (detected or custom), gospel quote for poster/title (select sentence or custom).
4. **Stewardship & Notices** — collection (currency PHP/KRW/MYR + date label + amount), food sponsors (chips), sign-of-peace message (+ optional breath line), divider image, announcement images.
5. **Posters & Branding** — LOTW + LOTE poster pickers (4 each), AI poster toggle (backend + style + quota) OR liturgical template, branding toggles (logo/name/footer), export-PDF toggle.
6. **Song Plan** — language filter, hymn layout (single/dual), per-section slots (Entrance/Offertory/Communion 1/2/Meditation/Recessional + custom), recommendations (mood-based, refresh/add), add custom song, progress meter + gospel-mood tip.
7. **Summary & Receipt** — review grouped choices with per-group "Edit" links, estimated slide count, **Generate**.

**Decision points:** AI poster vs liturgical template; Creed/Our-Father language; custom vs detected psalm/gospel; songs per section; layout.

**Validation:** date required (drives everything); celebrant required; quota checked before AI poster (`GET /api/image-quota`); song slots optional but progress meter nudges completion; inline validation per step.

**Exit:** Generate → full-screen loader (status message) → receipt modal with downloads (ZIP/PPTX/PDF/poster/social). "Regenerate" available.

**Edge cases:** no celebrants yet → add-celebrant path; readings not found for date; quota limit reached → AI poster disabled with limit-reached hint; large uploads.

**Failure:** `POST /api/generate` error → error state in loader/receipt, downloads not shown.

**Recovery:** edit any step via "Edit" link or stepper; retry generate; regenerate PPTX only (`/api/regenerate-pptx`).

---

## 2. Selecting readings
**Entry:** auto on date pick (Builder/Home/Calendar) via `POST /api/preview` / `GET /api/readings/{date}`.
**Decisions:** accept auto readings; override psalm refrain / gospel acclamation / gospel quote (detected vs custom).
**Validation:** custom text fields optional; refrain index must be valid.
**Exit:** readings populate sidebar cards + slides.
**Edge/Failure:** missing readings for date → empty preview cards + status. **Recovery:** pick another date or enter custom overrides.

---

## 3. Choosing celebrants
**Entry:** Basics step → celebrant picker (`celebrant-picker-trigger`).
**Decisions:** pick existing vs add new; add co-celebrant.
**Validation:** main celebrant expected for a complete deck.
**Exit:** selection stored (hidden `celebrant`), shown on title slide.
**Edge:** empty list (`celebrant-picker-empty`) → add via Settings → Church or inline "add a new celebrant".
**Failure/Recovery:** add fails → status; re-add. Managed in Settings → Church (`settings-celebrant-list`).

---

## 4. Theme selection
**Entry:** Design → Theme Lab (`/design/theme-lab`).
**Decisions:** pick/apply a theme; render real deck.
**Validation:** none blocking.
**Exit:** theme applied to generation; preview grid renders.
**Edge:** grid hidden until generated; **Failure:** refresh error → status. **Recovery:** retry refresh.

---

## 5. Template selection (PPTX import)
**Entry:** Design → Templates (superadmin).
**Decisions:** which `.pptx` to import.
**Validation:** must be `.pptx`; superadmin only.
**Exit:** extracted theme tokens available.
**Edge/Failure:** wrong file type / parse error → status. **Recovery:** re-upload.

---

## 6. Song selection
**Entry:** Builder → Song Plan tab, or Library/Collections.
**Decisions:** per-section song; language filter; layout single/dual; accept recommendation or add custom.
**Validation:** slots optional; progress meter reflects completeness.
**Exit:** songs attached to plan → lyric slides.
**Edge:** no catalog match → add custom song; recommendations empty. **Failure:** catalog fetch fail → empty state. **Recovery:** refresh, search, or add manually.

---

## 7. Preview
**Entry:** date selected (Builder) or Theme Lab.
**Decisions:** accept preview or adjust inputs.
**Exit:** preview informs final generation (estimated slide count).
**Edge/Failure:** preview error → status. **Recovery:** adjust + retry.

---

## 8. Generation
**Entry:** Generate (dock / inline / summary).
**Process:** validate inputs/quota → full-screen loader with human status → build deck/posters/PDF.
**Exit:** receipt modal with download links.
**Edge:** partial outputs (PDF optional, AI poster quota); large decks slower. **Failure:** `/api/generate` error → error state. **Recovery:** edit + regenerate; regenerate PPTX only.

---

## 9. History
**Entry:** Media → History.
**Decisions:** re-download a past file.
**Exit:** file downloaded.
**Edge:** empty (no prior downloads) → empty state; browser-local only (cleared with storage).
**Failure/Recovery:** stale link → regenerate via Builder.

---

## 10. Settings
**Entry:** account menu / sidebar → Settings.
**Sub-flows:**
- **Church:** edit name (hint-guided), upload logo, branding toggles, manage celebrants, (admin) approve/reject submissions.
- **Appearance:** theme, dark variant, visual style, accent + reset, news toggles, nav-tab visibility, radio stations, (admin) Gemini key.
**Validation:** name length limits (`input-limits.js`); logo file type/size; admin-only fields gated.
**Exit:** preferences persist, applied app-wide.
**Edge:** logo locked (409) for non-eligible; **Failure:** save error → status. **Recovery:** retry; admin fields hidden if not admin.

---

## 11. Subscription / Membership
**Entry:** membership banner on Home (`home-membership-banner`) reflecting state (pending/approved); admin approvals in Settings → Church.
**Decisions (admin):** approve/reject membership, song, priest submissions.
**Validation:** auth tiers — public / opt / session / member / admin; when auth disabled, all fall back to anonymous.
**Exit:** approved members unlock member-gated actions (generate, uploads, saved posters).
**Edge:** auth disabled (no Supabase) → everything anonymous; pending member sees banner + limited access.
**Failure:** 401/403 on member/admin endpoints → prompt sign-in / show restricted state. **Recovery:** sign in, await approval, or contact admin.

> Note: there is **no paid billing screen** in the codebase. "Subscription" maps to **membership/approval**, not payments. A billing flow would be a **`[RECOMMENDATION]`** / future module.

---

## Cross-cutting flow rules
- **Auth bearer headers** auto-attach via `postJSON()` + a fetch interceptor for `/api/files/` download anchors — keep downloads as `/api/files/...` links.
- **Toasts** confirm success/error for async actions (`#toast-stack`).
- **Quota** is checked before any AI image action; limit-reached disables the control with a clear hint.
- **Every list/flow has an empty state and a recovery path.**
