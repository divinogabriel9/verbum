# SECTION 13 — SECURITY (continued)

## Authentication (continued)

- JWT verification: ES256 via JWKS (newer Supabase projects) + HS256 fallback via `SUPABASE_JWT_SECRET`
- Bearer token extracted from `Authorization` header in `api_security.py`
- Auth context cached 90 seconds per token hash to reduce Supabase round-trips
- When `auth_enabled()` is false (missing env vars in local dev), all routes allow anonymous access
- When `auth_misconfigured()` (production flags set but Supabase not configured), returns **503** fail-closed
- Supabase session stored in browser `localStorage` under `sb-*-auth-token` keys
- `static/js/auth.js` patches `window.fetch` to attach Bearer token on all API calls

## Authorization

| Role | How determined | Capabilities |
|------|----------------|--------------|
| Anonymous | No JWT | Public routes only; blocked from generation when auth on |
| Member | `profiles.role = 'member'` + `membership_status = 'approved'` | Full app: generate, upload, edit church profile (within locks) |
| Pending member | `membership_status = 'pending'` | Can view, submit parish; **403 on generation** |
| Rejected member | `membership_status = 'rejected'` | Read-only; **403 on generation** |
| Superadmin | `profiles.role = 'superadmin'` OR email in `SUPERADMIN_EMAILS` | Bypass membership; admin APIs; catalog CRUD; song import |

Superadmin is **not** a separate Postgres role — it is an application-level `profiles.role` value, bootstrapped on server start from env var.

## Role System

- DB constraint: `profiles.role IN ('member', 'superadmin')`
- `profiles_guard_role` trigger blocks client JWT from escalating `role` to superadmin
- Only `service_role` JWT or existing superadmin can change roles
- `is_superadmin()` RPC is `SECURITY DEFINER`, executable only by `service_role`

## Session Management

- Stateless JWT sessions (no server-side session store)
- Token expiry handled by Supabase client SDK refresh
- `UserChurchMiddleware` loads church profile per request, clears in `finally` block
- `optional_session` vs `require_session_when_auth` vs `require_approved_membership` dependency chain

## Protected Routes

**Middleware-protected prefixes** (JWT required when auth on):
- `/api/files/*` (GET)
- `/api/catalog/songs*` (GET)
- `/api/readings/*` (GET)
- `/api/community` (GET)
- All mutating routes under: `/api/generate`, `/api/community`, `/api/admin/`, `/api/upload`, `/api/saved-posters`, `/api/songs/`, `/api/lyrics/`, `/api/submissions/`, `/api/design/`, `/generate-image`

## Validation

| Layer | Implementation |
|-------|----------------|
| Client | `VerbumInputLimits` — maxlength from `/api/input-limits` |
| Server Pydantic | `GenerateBody`, `PreviewBody`, `CommunityNameBody`, etc. in `server.py` |
| Server services | `input_validation.py` — hymn overrides, string lists |
| File uploads | MIME type whitelist, size limits (logo 2.5MB, assets 8MB, PPTX analyze 25MB) |
| Path traversal | `_resolve_child_file()`, `_safe_storage_leaf()` basename sanitization |
| Request body | `MAX_REQUEST_BODY_BYTES` = 12MB, checked in rate limit middleware |

## Sanitization

- Upload filenames stripped to basename via `Path().name`
- `resolve_under_root()` prevents directory traversal for file serving
- HTML templates use Jinja2 auto-escaping for server-rendered values
- Inline JS builds DOM via `textContent` in most paths; some `innerHTML` usage for dynamic catalog rendering (XSS risk if catalog data poisoned)

## Secrets

| Secret | Storage | Exposure |
|--------|---------|----------|
| `OPENAI_API_KEY` | Env var | Server only |
| `GEMINI_API_KEY` | Env var; superadmin can write `.env.gemini` | Server only; hint endpoint shows last 4 chars |
| `SUPABASE_SERVICE_ROLE_KEY` | Env var | Server only; bypasses RLS |
| `SUPABASE_JWT_SECRET` | Env var | Server only |
| `SUPABASE_PUBLISHABLE_KEY` | Env var | Exposed to browser via `/api/auth/config` (by design) |
| `SUPERADMIN_EMAILS` | Env var | Server only |
| `REDIS_URL` | Env var (Render injects) | Server only |

**Never hardcoded in source** — confirmed by `.env.example` pattern and `env_config.py` loader.

## Environment Variables (complete security-relevant list)

```
SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY, SUPABASE_JWT_SECRET
SUPERADMIN_EMAILS, APP_PUBLIC_URL
OPENAI_API_KEY, GEMINI_API_KEY, HUGGINGFACE_API_TOKEN
REDIS_URL, IMAGE_GENERATION_DAILY_LIMIT
RATE_LIMIT_ENABLED, RATE_LIMIT_*_MAX, RATE_LIMIT_*_WINDOW
MAX_REQUEST_BODY_BYTES, REQUIRE_AUTH, PRODUCTION
```

## Security Headers (SecurityHeadersMiddleware)

| Header | Value |
|--------|-------|
| `Content-Security-Policy` | Restrictive; `unsafe-inline` required for inline scripts/styles |
| `X-Content-Type-Options` | `nosniff` |
| `X-Frame-Options` | `DENY` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | camera/mic/geo disabled |
| `Cross-Origin-Opener-Policy` | `same-origin` |
| `Strict-Transport-Security` | `max-age=31536000` on HTTPS |

CSP allowlists: Supabase hosts, jsDelivr (Supabase SDK), Google Fonts, EWTN HLS streams.

## RLS (Row Level Security)

- All 4 public tables: `ENABLE ROW LEVEL SECURITY` + `FORCE ROW LEVEL SECURITY`
- `anon` role: `REVOKE ALL` — no anonymous DB access
- `authenticated`: own-row policies only
- `service_role`: bypasses RLS for admin operations
- Storage bucket: folder prefix must equal `auth.uid()`
- `church_profiles` DELETE policy dropped in migration 011
- Triggers guard membership status and lock columns from client modification

## Rate Limiting

| Tier | Default limit | Routes |
|------|---------------|--------|
| auth | 30/min | `/api/auth`, `/sign-in`, `/sign-up` |
| expensive | 20/min | generate, upload, regenerate, generate-image |
| api | 120/min | `/api/*` |
| default | 300/min | pages, static |

Redis-backed when `REDIS_URL` set; in-memory fallback per instance.

## Potential Vulnerabilities

| Risk | Severity | Evidence |
|------|----------|----------|
| **24k-line inline JS monolith** | Medium | Hard to audit; `innerHTML` in catalog rendering |
| **CSP `unsafe-inline`** | Medium | Required by architecture; XSS mitigation relies on no user HTML injection |
| **Ephemeral filesystem** | Medium | Generated files lost on restart; URLs may 404; no durable download links |
| **Auth disabled in dev** | Low | Full anonymous access if env vars missing — dangerous if deployed misconfigured |
| **`user_media_assets` table unused** | Low | Schema/app drift; no metadata audit trail for uploads |
| **Membership trigger vs app UPSERT tension** | Medium | `church_profiles_guard_membership_and_locks` may block user JWT updates to lock columns on existing rows |
| **Gemini key saved to filesystem** | Medium | `POST /api/settings/gemini-api-key` writes `.env.gemini` — ephemeral on Render, not persistent |
| **No CSRF tokens** | Low | Bearer token auth mitigates cookie CSRF; stateless API |
| **Rate limit token slicing** | Low | Uses last 24 chars of token for bucketing — collision unlikely but not cryptographic |
| **Superadmin via env email** | Medium | Bootstrap on every server start; typo grants admin |
| **No automated security tests** | Medium | Only `test_api.py`, `test_tongyi.py` exist |
| **Pending submissions in JSON files** | Medium | Not in Postgres; lost on redeploy if not backed up |
| **Single-instance rate limiting note** | Low | Documented in `.env.example`; mitigated by Redis on Render |

---

# SECTION 14 — PERFORMANCE

## Rendering

| Area | Assessment |
|------|------------|
| Initial page load | **Poor** — `index.html` is 24,616 lines with ~11.5k lines inline CSS + ~10k lines inline JS served as single document |
| Route transitions | **Good** — CSS class toggle, 130ms leave animation, no full reload |
| DOM binding | **Fragile** — 487 `id` lookups; guarded `if (el)` prevents crashes but silently drops features |
| Home bento | **Moderate** — multiple parallel API fetches on route enter |
| Catalog render | **Moderate** — full catalog re-rendered on search; lite mode helps initial load |

## Bundle Size

| Asset | Size concern |
|-------|-------------|
| `index.html` | **Critical** — entire app in one HTML file, no code splitting |
| `static/css/verbum-design-system.css` | ~2,074 lines — reasonable |
| `static/js/auth.js` | Moderate |
| `static/js/hls.min.js` | Third-party minified — loaded even if radio unused |
| `landing.html` + `landing.css` | Separate, Tailwind-minified — efficient |
| No webpack/vite bundle | No tree-shaking; no lazy loading of JS modules |

## Server Components / Client Components

Not applicable. Server sends complete HTML; all interactivity is client-side.

## Lazy Loading

| Feature | Lazy? |
|---------|-------|
| Route pages | **Yes** — hidden until `.active`; data fetched on `applyRouteState` |
| Song lyrics | **Yes** — lite catalog first, full lyrics on demand per song |
| PPT preview PNGs | **Yes** — generated on explicit refresh |
| Hymn library JSON | Loaded once, cached in memory |
| Master PPTX template | Loaded once per process, cached globally |
| Images | Standard browser lazy loading not systematically applied |

## Memoization

- Python: `@lru_cache` on `public_auth_config()`, `superadmin_emails()`
- Python: `_PREVIEW_CACHE` 600s TTL, `_master_template` global, `ai_styles._cache`
- JS: `songCatalogData`, `flowPreviewData` held in memory; no formal memoization library
- HTTP: ETag on lite catalog (`If-None-Match` → 304)

## Database Queries

| Query | Pattern |
|-------|---------|
| Supabase profile | 1-2 per authenticated request (cached 90s) |
| Lectionary | SQLite local read — fast |
| Generation history | Insert only; never queried by UI |
| Redis quota | 1-2 per AI generation |

No N+1 query problems visible; Supabase accessed via REST client, not ORM.

## Caching

| Cache | Hit rate potential | Invalidation |
|-------|-------------------|--------------|
| Lectionary SQLite | High (same Sunday dates) | Stale detection + `LECTIONARY_IGNORE_CACHE` |
| Preview 600s | High during builder session | TTL |
| Lite catalog ETag | High | File mtime |
| Client readings localStorage | Per-date | Manual |
| AI hero PNG | Per date+style | Deploy restart clears |
| Redis rate limit | Per-window | Auto-expire |

## Potential Bottlenecks

| Bottleneck | Impact | Evidence |
|------------|--------|----------|
| **PPTX generation** | High CPU, 5-30s | ~78 slides, master cloning, python-pptx |
| **PPT preview rasterization** | High CPU | PDF conversion + PNG render |
| **USCCB scrape on cache miss** | Network latency | External HTTP to bible.usccb.org |
| **AI image generation** | 10-90s | OpenAI/Gemini API latency; 90s Gemini timeout |
| **Single HTML download** | Slow first paint | 24k lines |
| **Render free tier spin-down** | 15-30s cold start | Free plan spins down after 15 min inactivity |
| **Ephemeral outputs** | User-facing 404s | Files lost on restart before download |
| **Inline JS parse time** | Main thread block | ~10k lines parsed on every `/home` load |
| **No CDN for static** | Moderate | Served from same uvicorn process via StaticFiles |

---

# SECTION 15 — CODE QUALITY

## Architecture — **5/10**

**Strengths:**
- Clear separation of `generators/`, `services/`, `routes/`, `core/`
- Shared `pipeline.py` for CLI and web avoids duplication
- Auth middleware stack is well-layered
- Supabase RLS is thorough with defense-in-depth triggers

**Weaknesses:**
- Entire frontend in one `index.html` file destroys modularity
- No frontend build pipeline for main app
- `api/liturgical_api.py` dead code (not mounted)
- `user_media_assets` table defined but unused
- `custom_theme` accepted but ignored — API/implementation drift
- Local JSON queues for pending submissions alongside Supabase

## Folder Organization — **7/10**

**Strengths:**
- `services/` well-decomposed (~52 focused modules)
- `generators/` separated from HTTP layer
- `supabase/migrations/` numbered chronologically
- `docs/design-system/` comprehensive design documentation

**Weaknesses:**
- `backups/` directory in repo
- `.cursor/skills/` and design references add noise
- `outputs/` and `uploads/` mixed ephemeral/runtime with repo

## Naming Consistency — **7/10**

- Python: consistent snake_case, type hints, `from __future__ import annotations`
- JS: camelCase variables, kebab-case CSS, `mw-` wizard prefix, `flow-` mass builder prefix
- Route paths: RESTful `/api/catalog/songs/{section}/{id}`
- Some legacy names: `lyrics-page` for song library, `flow-page` for mass builder

## Component Reuse — **4/10**

- CSS patterns reused well (bento cells, ui-overlay, vb-select)
- No JS component abstraction — copy-paste patterns in inline code
- Poster subsystem (`generators/poster/`) is well-factored
- PowerPoint generator has internal reuse but 4,602 lines in one file

## Technical Debt — **High**

| Item | Severity |
|------|----------|
| 24,616-line `index.html` | Critical |
| Missing `/radio` page | High |
| Missing global search markup | High |
| Settings sub-panel routing broken | High |
| Reflection hero markup missing | Medium |
| `DEVELOPMENT_TRACKER.md` stale (says auth not done) | Low |
| Theme analyzer output ignored | Medium |
| Dual wizard + legacy stepper navigation | Medium |
| No frontend tests | High |
| No CI/CD pipeline in repo | Medium |

## Duplicate Code

- Wizard and legacy panels duplicate Mass Builder field access
- `community_config.py` and `community_store.py` overlap (SQLite fallback vs Supabase)
- `services/liturgical_calendar.py` and `core/liturgical_calendar.py` — two calendar modules
- Gospel mood logic duplicated between `gospel_mood.py` and `ai_image_generator._infer_storytelling_mood`

## Unused Code

- `api/liturgical_api.py` — not imported by server
- `user_media_assets` table — no Python references
- `templates/index.html` references to `#home-reflection-*` — no DOM
- Global search JS — no HTML panel
- `/radio` route CSS/JS — no page section

## Refactoring Opportunities

1. Extract `index.html` JS into ES modules with a bundler (Vite/esbuild)
2. Extract `index.html` CSS into built stylesheet
3. Component-ize modals and page sections as template partials or web components
4. Split `powerpoint.py` into section-specific modules
5. Migrate pending submissions from JSON to Supabase tables
6. Wire `user_media_assets` or drop the table
7. Implement `data-settings-panel` routing
8. Add `/radio` page section or remove nav link

## Scalability — **5/10**

- Stateless API (JWT) — horizontally scalable in theory
- Redis rate limiting shared across instances on Render
- Ephemeral filesystem breaks multi-instance file serving
- SQLite lectionary cache is per-instance (divergent caches)
- Single Docker container on Render free tier
- No job queue for long-running generation (synchronous HTTP request)

## Maintainability — **4/10**

- Any ID rename silently breaks features (documented in AGENTS.md)
- `REDESIGN_INTEGRATION_CONTRACT.md` mitigates but is manual
- 52 service modules are maintainable; frontend is not
- Good type hints in Python; no TypeScript on frontend

### Category Scores Summary

| Category | Score /10 |
|----------|-----------|
| Architecture | 5 |
| Folder organization | 7 |
| Naming consistency | 7 |
| Component reuse | 4 |
| Technical debt management | 3 |
| Scalability | 5 |
| Maintainability | 4 |
| Test coverage | 2 |
| Documentation | 8 |
| Security posture | 7 |

---

# SECTION 16 — RELEASE READINESS

*Scenario: Public launch this Sunday.*

## What Is Production Ready

| Area | Status |
|------|--------|
| Core PPTX generation pipeline | ✅ Functional — master template cloning, hymn slides, readings, branding |
| USCCB lectionary fetch + cache | ✅ |
| Poster generation (classic + liturgical) | ✅ |
| AI poster generation (OpenAI primary) | ✅ With quota |
| Supabase auth sign-up/sign-in | ✅ |
| Membership approval workflow | ✅ |
| Rate limiting + security headers | ✅ |
| Render Docker deployment | ✅ `render.yaml` + Dockerfile + `/health` |
| Landing page | ✅ |
| Mass Builder wizard (7 steps) | 🟡 Functional but rough edges |
| Song library + lyrics editor | ✅ |
| Calendar view | ✅ |
| ZIP export bundle | ✅ |

## What Is Missing

| Gap | Launch blocker? |
|-----|-----------------|
| `/radio` page (nav dead-end) | Yes — visible nav link broken |
| Global search command palette | No — but advertised in design docs |
| Server-side generation history UI | No — table exists, no UI |
| Project/save-draft concept | No — must complete in one session |
| Persistent file storage for outputs | **Yes** — Render ephemeral FS loses files on restart |
| Email onboarding flow | Medium — depends on Supabase dashboard config |
| Billing/subscription | No — not needed for beta |
| Mobile QA on Mass Builder wizard | Medium — complex form on small screens |
| Prayer of Faithful generation | No — button may be non-functional |
| Collections as real entities | No |

## Critical Bugs to Fix

1. **`/radio` route renders empty page** — nav promises radio, no `#radio-page` markup
2. **Generated file 404 after deploy/restart** — outputs not persisted to Supabase Storage
3. **Settings church vs app panel both show** — `data-settings-panel` not wired in JS
4. **Reflection hero JS errors** — targets `#home-reflection-*` IDs that don't exist (silent no-op, but broken feature)
5. **Global search init binds to missing DOM** — potential JS error on init (needs verification; may be guarded)
6. **Membership lock trigger vs submit flow** — possible DB trigger blocking parish name lock on UPDATE path

## UX Improvements (pre-launch)

- Add loading skeletons consistently (partially implemented)
- Clear error message when AI falls back to gradient placeholder
- Disable or hide `/radio` nav until page exists
- Fix settings modal to show only church OR appearance panel
- Generation progress with estimated time
- Confirm before logo upload (one-time lock) — modal exists, verify flow
- Mobile: test wizard step navigation and song plan on 375px viewport
- Onboarding tooltip for first-time Mass Builder users

## Performance Improvements (pre-launch)

- Split `index.html` — even extracting JS/CSS to external files would help caching
- Add `Cache-Control` headers on static assets
- Persist generated files to Supabase Storage immediately after generation
- Consider async generation with polling (generation can exceed HTTP timeout on free tier)

## Security Improvements (pre-launch)

- Verify auth cannot be disabled in production Render env
- Audit `innerHTML` usage in catalog renderer for XSS
- Move pending submissions from JSON files to Supabase
- Add security headers verification test
- Review CSP tightening plan (nonces) for v1.1

## Accessibility Improvements (pre-launch)

- Wizard stepper needs `aria-current="step"` on all steps (partially done)
- Modal focus trap — verify all 15 modals
- Radio player needs accessible labels (partial)
- Color contrast on muted text against canvas — verify WCAG AA
- Keyboard navigation for song catalog
- `prefers-reduced-motion` — partially implemented

## Items That Can Wait Until v1.1

- Global command palette (⌘K)
- Reflection hero card on home
- PPT theme customization (re-enable `custom_theme`)
- Generation history server UI
- Prayer of Faithful AI generation
- Pollinations/FLUX image backend
- PDF export polish
- Hymn web discovery improvements
- CI/CD pipeline
- Frontend test suite
- Collections as first-class entities
- Multi-language UI (app is English-primary; hymns support Tagalog/Latin)

## Items That Should Wait Until v2.0

- Full frontend framework migration (React/Vue/Svelte)
- Real-time collaborative Mass planning
- Subscription/billing layer
- Multi-parish organization accounts
- Native mobile apps
- Offline/PWA mode
- Custom master template upload per parish
- Integration with parish management systems (PCP, Realm, etc.)
- Automated USCCB copyright licensing display
- Print missalette PDF export

---

# SECTION 17 — PRODUCT REVIEW

## Senior Software Engineer

**Strengths:**
- Impressive domain depth: lectionary cycles, gospel quote extraction, rite slide cloning, hymn dual-layout
- Auth/membership/RLS is thoughtfully designed with defense in depth
- Pipeline abstraction cleanly shares CLI and web paths
- AI architecture correctly separates hero generation from text compositing

**Weaknesses:**
- 24k-line `index.html` is a maintenance catastrophe waiting to happen
- No tests for the generation pipeline — the core value prop is untested
- Ephemeral filesystem on Render undermines the entire "download your deck" promise
- Synchronous generation in HTTP request will not scale

**Pain points:**
- Any UI change requires grep-ing 24k lines for ID collisions
- Cannot confidently refactor frontend without breaking silent bindings
- Deploy restarts lose user-generated files

**Suggestions:**
- Persist outputs to Supabase Storage before returning URLs
- Extract frontend into modules this quarter
- Add integration tests for `generate_mass_media()` with fixture data

## Product Designer

**Strengths:**
- Coherent design system (DESIGN.md, Cal.com base, berry accent)
- Bento home grid is modern and scannable
- 7-step wizard is the right mental model for Mass planning
- Typography scale is well-considered (Apple.com rhythm)

**Weaknesses:**
- Two navigation paradigms (wizard + legacy stepper) create confusion
- Settings modal doesn't switch panels — feels broken
- Radio nav link leads nowhere — trust-breaking
- Visual density on Mass Builder step 6 (Extras) is overwhelming

**Pain points:**
- No clear "you are here" progress in wizard on mobile
- Receipt modal is functional but not celebratory — missed delight moment
- Landing page promises features (Pricing, Community) that link to `#`

**Suggestions:**
- Remove or fix broken nav items before launch
- Simplify Extras step with progressive disclosure
- Add generation success animation/confetti moment
- Fix landing page placeholder links

## Startup CTO

**Strengths:**
- Fast time-to-market architecture: monolith, Supabase, Render free tier
- Clear monetization path: parish subscriptions, AI quota tiers, white-label
- Domain moat: liturgical intelligence is hard to replicate
- Deployable today with `render.yaml` Blueprint

**Weaknesses:**
- Frontend monolith is the #1 engineering velocity blocker
- No observability (logging, metrics, error tracking) evident in codebase
- Free tier Render will not survive real parish Sunday-morning traffic spike
- Single point of failure: one container does everything

**Pain points:**
- Cannot hire frontend dev and parallelize work on `index.html`
- No staging environment configuration in repo
- AI costs unbounded without tighter quota enforcement per parish

**Suggestions:**
- Upgrade Render plan before launch; add health monitoring
- Add Sentry or similar error tracking
- File storage to Supabase is non-negotiable for launch
- Plan frontend rewrite as Q3 initiative, not emergency

## Parish Secretary

**Strengths:**
- "Pick a date, get a deck" is exactly what I need
- Celebrant picker with saved names saves weekly typing
- Stewardship slides (collection, food sponsors) are parish-specific touches
- Membership approval prevents random users from generating under our parish name

**Weaknesses:**
- Too many options on first use — I don't know what LOTW/LOTE posters are
- If I close the browser before downloading, files may be gone
- Pending membership approval blocks me from generating — frustrating if admin is slow
- No way to save a half-finished Mass for next week

**Pain points:**
- I need this ready by Saturday 5pm; generation taking too long stresses me
- Song library doesn't have our parish's favorite hymns
- Can't easily share the deck with the priest for review before Sunday

**Suggestions:**
- "Quick start" mode: date + celebrant + generate with defaults
- Email me the download link when generation completes
- Allow saving draft Mass configurations
- Parish hymn import wizard

## Choir Leader

**Strengths:**
- Song plan with gospel mood recommendations is genuinely useful
- Hymn lyric slides in dual layout match how we project
- Language filter (EN/TL) matches our bilingual parish
- Lyric override per song for our custom verses

**Weaknesses:**
- Song library search is basic — no audio preview or CCLI numbers
- Can't reorder songs within a section easily
- No way to mark "we don't have lyrics for this" and exclude from deck
- Meditation song section easy to miss in wizard step 5

**Pain points:**
- I spend more time in song library than Mass Builder
- When lyrics are wrong in catalog, I don't know how to fix them permanently
- No printout of song list for choir rehearsal

**Suggestions:**
- Export song plan as PDF rehearsal sheet
- Show which songs lack lyrics before generation
- Allow choir members to suggest songs (submission flow exists but hidden)

## Priest

**Strengths:**
- Readings are correct for the liturgical date — builds trust
- Citation-only reading slides respect USCCB projection norms
- Creed choice (Nicene vs Apostles) handled correctly
- Our Father in multiple languages (English, Malay, Tagalog, Visaya, Korean)

**Weaknesses:**
- Cannot review the full deck before it's projected
- No way to add homily notes or intercessions from my draft
- AI gospel images may not match the theological tone I want
- Prayer of Faithful not generated from my text

**Pain points:**
- I want to see the Gospel slide quote before the secretary generates 78 slides
- Announcement slides require image upload — I have text, not graphics
- Penitential Act options need liturgical knowledge to choose

**Suggestions:**
- "Priest preview" mode: Gospel quote + readings summary before full generate
- Text-based announcement slide option
- Default liturgy choices based on season (e.g., Gloria omitted in Lent)

## First-time Volunteer

**Strengths:**
- Landing page clearly explains what the app does
- Wizard steps have clear titles (Mass Info → Review)
- Home dashboard orients me to upcoming Sunday
- Load readings button fetches everything automatically

**Weaknesses:**
- Overwhelmed by step 6 Extras — don't know what half the options mean
- "Generate full Mass package" sounds scary — afraid of breaking something
- Auth sign-up requires parish name I don't know if I'm authorized to provide
- No tutorial or guided tour

**Pain points:**
- I clicked Radio in the nav and got a blank page — thought app was broken
- Error messages are technical ("403 Approved parish membership required")
- Don't understand AI quota — think app is broken when AI poster disabled

**Suggestions:**
- First-run guided tour (5 tooltips)
- Plain-language error messages ("Ask your parish admin to approve your account")
- Default to simplest path: generate without AI, without extras
- Fix the Radio page

---

# SECTION 18 — FINAL SCORECARD

## Scores (1–100)

| Dimension | Score | Rationale |
|-----------|-------|-----------|
| **Architecture** | 58 | Solid backend separation undermined by frontend monolith and ephemeral storage |
| **Code Quality** | 52 | Good Python practices; frontend is unmaintainable at current size |
| **UI** | 72 | Coherent design system, modern bento layout, polished auth page; inconsistent on inner screens |
| **UX** | 55 | Powerful but overwhelming; broken routes; no onboarding; membership friction |
| **Accessibility** | 48 | Partial ARIA, reduced-motion support; no systematic audit; modal focus unverified |
| **Performance** | 45 | 24k HTML payload, synchronous generation, cold starts on free tier |
| **Security** | 71 | Strong RLS, middleware, rate limiting; CSP inline weakness; auth bootstrap risks |
| **Scalability** | 40 | Monolith + ephemeral FS + sync generation + free tier |
| **Maintainability** | 38 | ID-coupled 24k-line SPA is the primary drag |
| **Feature Completeness** | 68 | Core generation complete; radio, search, history UI, drafts missing |
| **Production Readiness** | 50 | Works in happy path; file persistence and broken routes block confident launch |
| **Innovation** | 78 | AI gospel imagery + liturgical intelligence + gospel mood hymns is genuinely novel |
| **Overall Product Score** | **58** | Strong core idea and backend; frontend and ops gaps prevent production confidence |

## 1. Would you ship this publicly today?

**No.** Not as a public launch.

The core generation engine is impressive and could serve a **closed beta** with known parishes today. A **public launch** would expose:
- Broken `/radio` navigation
- File downloads that 404 after any deploy/restart (Render ephemeral filesystem)
- Settings UI bugs
- No onboarding for non-technical parish volunteers
- Free-tier infrastructure that spins down and times out under real Sunday morning load

Ship to a **controlled beta** (5–10 parishes, upgraded Render plan, Supabase Storage for outputs) this week. Public launch needs 4–6 weeks of frontend and persistence work minimum.

## 2. Top 10 Improvements Before Launch

1. **Persist all generated outputs to Supabase Storage** before returning download URLs — eliminate ephemeral 404s
2. **Fix or remove `/radio` nav link** — add `#radio-page` markup or hide tab
3. **Fix settings sub-panel routing** — wire `data-settings-panel` to show church OR appearance
4. **Split `index.html`** — extract JS and CSS to cacheable external files (immediate perf win)
5. **Upgrade Render plan** — avoid spin-down and CPU timeout on generation
6. **Add error tracking** (Sentry) — visibility into production failures
7. **Quick-start generate path** — date + celebrant + defaults, skip 7 steps for returning users
8. **Plain-language membership errors** — replace 403 JSON with actionable UI guidance
9. **Add integration test** for `generate_mass_media()` — protect core value prop
10. **Fix landing page placeholder links** — remove or link Pricing/Community `#` hrefs

## 3. Top 20 Improvements for v1.1

1. Extract frontend into Vite + vanilla JS modules (or lightweight framework)
2. Implement global command palette (⌘K) with proper markup
3. Server-side generation history UI using `generation_history` table
4. Draft Mass configurations (save/resume in Supabase)
5. Email notification when generation completes with download link
6. Re-enable PPT custom theme from template analyzer
7. Prayer of Faithful text input + slide generation
8. Clear UI when AI poster uses placeholder fallback
9. Choir rehearsal PDF export (song list + lyrics)
10. Parish hymn bulk import wizard
11. Mobile Mass Builder QA pass and responsive fixes
12. Reflection hero card on home (add missing markup)
13. Async generation with job queue + progress polling
14. Migrate pending submissions from JSON to Supabase tables
15. Wire or drop `user_media_assets` table
16. CI/CD pipeline (GitHub Actions: lint, test, deploy)
17. Frontend test suite (Playwright E2E for generate flow)
18. Accessibility audit + WCAG AA fixes
19. Onboarding guided tour for first-time users
20. Pollinations/FLUX as additional free AI backend

## 4. What Could Make This the Best Catholic Mass Presentation Software Available?

1. **Liturgical trust as the moat** — Already strong: USCCB-correct readings, Year A/B/C, season colors, rite-accurate slide order. Double down: USCCB copyright compliance display, bishops' conference calendar integration, solemnity overrides, optional Latin/vernacular toggle per rite.

2. **Parish memory** — Save every Mass configuration, celebrant preferences, default hymns per season, announcement templates. Become the system of record, not a one-shot generator.

3. **Collaborative workflow** — Priest reviews Gospel quote and intercessions; choir leader fills song plan; secretary generates. Role-based permissions within a parish account.

4. **Best-in-class hymn intelligence** — CCLI integration, audio preview, pitch/tempo metadata, "your parish sang this 12 times" analytics, diocesan shared libraries.

5. **Reliable Sunday-morning operations** — Persistent storage, async generation, "generate by 6am Saturday" scheduling, email/SMS when ready, offline download PWA.

6. **Projection-native output** — Not just PPTX: ProPresenter export, EasyWorship, OpenLP, Ren'Py-style auto-advance scripts, confidence monitor view.

7. **AI with theological guardrails** — AI intercessions from Gospel themes reviewed by priest; AI imagery with diocesan style guide presets; never put AI-generated Scripture text on slides.

8. **Accessibility as feature** — Large-print missalette PDF, screen-reader bulletin, Braille-ready exports. No competitor does this.

9. **Multi-parish/diocesan licensing** — Chancery admin dashboard, shared hymn licensing, aggregate usage reporting.

10. **Open API for integrators** — Let parish websites pull "this Sunday's readings" widget, let Flocknote import the song plan, let livestream overlays pull the Gospel quote.

The foundation is real: the lectionary engine, master template cloning, and hymn lyric projection are further along than most competitors. The gap is **operational reliability** (persistent files, async jobs), **frontend engineering discipline**, and **collaborative parish workflow** — not the core liturgical logic.

---

*End of documentation. This document was produced from direct codebase analysis of the Verbum/LiturgyFlow repository as of 2026-07-02. Sections 1–12 and the beginning of Section 13 were provided in the prior response; Sections 13 (completed) through 18 are above.*
