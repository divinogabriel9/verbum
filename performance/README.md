# LiturgyFlow production k6 performance suite

Simulates **virtual churches** (1 VU ≈ 1 parish workplace), not bare HTTP spam.

> Stack note: LiturgyFlow is **FastAPI + Jinja2 SPA + Supabase Auth + Redis**, hosted on Render — not React/Vite/Clerk. Scripts target real routes in `server.py` / `routes/`.

## Layout

```
performance/
  data/
    churches.json     # 320 randomized parish personas
    songs.json        # IDs from data/hymn_library.json
  helpers/
    config.js         # BASE_URL, auth env, expensive flags
    metrics.js        # Trends + thresholds
    http.js           # Tagged HTTP + checks
    auth.js           # Supabase password/refresh + token pool
    church.js         # Per-VU persona + weighted roles
    flows.js          # Dashboard, calendar, songs, Sunday pipeline, chaos
    practice.js       # Guest choir practice (no account)
    discover.js       # OpenAPI + known route inventory
    report.js         # summary.json/html/csv/console
  scenarios/
    smoke.js          # 10 churches × 5m
    sunday.js         # 50 churches Sunday prep
    peak.js           # 100 churches weighted roles
    launch.js         # 30m ramp to 500
    soak.js           # 50 churches × 8h
    chaos.js          # ramp to 1000 cancel/retry/reconnect
    practice.js       # anonymous choir phones on /practice/{token}
  reports/            # generated outputs (gitignored contents)
```

## Environment

| Variable | Required | Purpose |
|----------|----------|---------|
| `BASE_URL` | no | Default `http://127.0.0.1:8000` |
| `SUPABASE_URL` | for login | Auth password grant |
| `SUPABASE_ANON_KEY` or `SUPABASE_PUBLISHABLE_KEY` | for login | Supabase apikey |
| `STRESS_EMAIL` / `STRESS_PASSWORD` | optional | Approved parish user |
| `STRESS_TOKENS` | optional | Comma-separated access JWTs (pool) |
| `STRESS_ALLOW_EXPENSIVE` | optional | `1` = call `POST /api/generate` |
| `STRESS_ALLOW_AI_POSTER` | optional | `1` = AI poster inside generate |
| `STRESS_AUTO_DISCOVER` | optional | Default on — probe new OpenAPI GETs |
| `PRACTICE_TOKEN` | for practice | Guest share token from “Let’s practice” |
| `PRACTICE_PIN` | for practice | 6-digit PIN for that share |
| `PRACTICE_VUS` | optional | Concurrent guest phones (default 50) |
| `PRACTICE_DURATION` | optional | Steady phase duration (default `5m`) |
| `STRESS_SPOOF_IP` | optional | Default `1` — distinct `X-Forwarded-For` per VU (local) |

**Never** commit tokens or passwords. Pass them on the command line or a local untracked env file.

### Safe vs expensive

Without `STRESS_ALLOW_EXPENSIVE=1`, Sunday/media flows use:

- `/api/preview` (when allowed)
- `/api/demo-generate` (guest PPT, IP rate-limited)
- `/api/poster-exists`
- pages + readings + catalog

With expensive enabled against **staging only**, they call authenticated `/api/generate` (optionally AI).

Raise or disable rate limits for capacity tests locally:

```bash
RATE_LIMIT_ENABLED=0 uvicorn server:app --reload --host 127.0.0.1 --port 8000
```

## Run

```bash
npm run stress:smoke
npm run stress:sunday
npm run stress:peak
npm run stress:launch
npm run stress:soak
npm run stress:chaos
npm run stress:practice
npm run stress:practice-chaos
```

### Guest choir practice (no account)

```bash
# Existing share link
PRACTICE_TOKEN=… PRACTICE_PIN=123456 PRACTICE_VUS=80 npm run stress:practice

# 1000 phones chaos (cancel / spam refresh / reconnect / open lyrics)
# Share credentials live in performance/reports/.practice_chaos_env after setup,
# or pass PRACTICE_TOKEN + PRACTICE_PIN yourself.
PRACTICE_VUS=1000 PRACTICE_HOLD=5m PRACTICE_FAST_RAMP=1 npm run stress:practice-chaos
```

Guest flow: open `/practice/{token}` → API snapshot → PIN unlock → lyrics refresh → optional QR. No Bearer token on guest requests. Reports: `performance/reports/practice-*` and `practice-chaos-*`.

**Note:** PIN unlock uses expensive hashing on the server. At ~1000 concurrent first unlocks, expect CPU spikes and some timeouts — that *is* part of the chaos signal.

Local multi-phone rate limits work best with `STRESS_SPOOF_IP=1` (default). On Render, all VUs share one client IP — raise `RATE_LIMIT_PRACTICE_*` or disable limits for capacity runs.

Examples:

```bash
BASE_URL=http://127.0.0.1:8000 npm run stress:smoke

BASE_URL=https://staging.example.com \
  SUPABASE_URL=$SUPABASE_URL \
  SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY \
  STRESS_EMAIL=you@parish.test \
  STRESS_PASSWORD='…' \
  STRESS_ALLOW_EXPENSIVE=1 \
  npm run stress:sunday
```

Short overrides (dev):

```bash
k6 run --vus 5 --duration 1m performance/scenarios/smoke.js
```

## Reports

Each run writes under `performance/reports/`:

- `{scenario}-summary.json`
- `{scenario}-summary.html`
- `{scenario}-metrics.csv`
- `{scenario}-console.txt`
- timestamped copies of the same

## Peak role mix

| Weight | Role | Behavior |
|--------|------|----------|
| 40% | Media officer | Full Sunday mass pipeline |
| 25% | Choir leader | Catalog search + lyrics + collections |
| 20% | Secretary | Calendar + smart-defaults + schedule pages |
| 15% | Priest | Readings + gospel image + preview |

## Custom metrics

`poster_generation`, `ppt_generation`, `dashboard_load`, `calendar_load`, `song_search`, `download_speed`, `history_save`, plus `auth_latency`, `readings_load`, `ai_generation`, error/rate-limit counters.

Practice-specific: `practice_page_load`, `practice_api_load`, `practice_unlock`, `practice_lyrics_refresh`, `practice_qr_load`, `practice_wrong_pin`, `practice_unlocked_ok`.
