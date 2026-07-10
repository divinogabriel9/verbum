# k6 load tests (LiturgyFlow / Verbum)

[Grafana k6](https://grafana.com/docs/k6/latest/) scripts for smoke, load, stress, and spike testing. Defaults target the local dev server (`http://127.0.0.1:8000`).

## Install k6

```bash
brew install k6
```

Or run via Docker:

```bash
docker run --rm -i -e BASE_URL=http://host.docker.internal:8000 grafana/k6 run - <loadtests/smoke.js
```

## Quick start

With uvicorn running locally:

```bash
npm run loadtest:smoke
npm run loadtest:load
```

Against staging or production (read-only scripts only on prod):

```bash
BASE_URL=https://your-service.onrender.com npm run loadtest:load
```

## Scripts

| Script | Purpose | Safe for prod? |
|--------|---------|----------------|
| `smoke.js` | Single VU health check | Yes |
| `load-readings.js` | Dashboard-shaped read traffic | Yes (watch rate limits) |
| `stress.js` | Ramp 50→150 VUs on readings | Staging preferred |
| `spike.js` | Burst homepage + readings | Staging preferred |
| `preview-auth.js` | `POST /api/preview` (expensive tier) | **Staging only** |

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `BASE_URL` | `http://127.0.0.1:8000` | Target origin |
| `SUPABASE_JWT` | — | Required for `preview-auth.js` |

## Rate limits

Production enables sliding-window limits (`services/rate_limit.py`). Expect `429` responses when a single IP exceeds:

- **api**: 120 req / 60s (`/api/readings`, calendar, flags)
- **expensive**: 20 req / 60s (`/api/preview`, `/api/generate`, uploads, AI)
- **default**: 300 req / 60s (HTML pages)

`/health` is exempt. High VU counts from one machine share one client IP, so 429s are expected before the app itself is saturated. Scripts treat `429` as acceptable for that reason.

To measure raw app capacity (without rate limits), restart the server locally with:

```bash
RATE_LIMIT_ENABLED=0 uvicorn server:app --reload --host 127.0.0.1 --port 8000
```

## Do not load-test on production

Avoid hammering these without a dedicated staging env and mocked AI keys:

- `POST /api/generate`
- `POST /generate-image`
- Upload endpoints

They trigger CPU-heavy PPTX builds and paid AI API calls.

## Save results

```bash
k6 run --summary-trend-stats="avg,p(95),p(99),max" \
  --out json=loadtests/results/run.json \
  loadtests/stress.js
```

Results under `loadtests/results/` are gitignored.

## npm scripts

```bash
npm run loadtest:smoke
npm run loadtest:load
npm run loadtest:stress
npm run loadtest:spike
npm run loadtest:preview   # requires SUPABASE_JWT
```
