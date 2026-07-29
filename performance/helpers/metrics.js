import { Trend, Counter, Rate } from 'k6/metrics';

export const posterGeneration = new Trend('poster_generation', true);
export const pptGeneration = new Trend('ppt_generation', true);
export const dashboardLoad = new Trend('dashboard_load', true);
export const calendarLoad = new Trend('calendar_load', true);
export const songSearch = new Trend('song_search', true);
export const downloadSpeed = new Trend('download_speed', true);
export const historySave = new Trend('history_save', true);
export const authLatency = new Trend('auth_latency', true);
export const readingsLoad = new Trend('readings_load', true);
export const aiGeneration = new Trend('ai_generation', true);

export const errors = new Counter('liturgyflow_errors');
export const successes = new Counter('liturgyflow_successes');
export const rateLimited = new Counter('liturgyflow_rate_limited');
export const cancelledReqs = new Counter('liturgyflow_cancelled');
export const checkPassRate = new Rate('liturgyflow_check_pass');

/** Default thresholds requested for production-grade gate. */
export const productionThresholds = {
  checks: ['rate>0.99'],
  http_req_failed: ['rate<0.01'],
  liturgyflow_check_pass: ['rate>0.99'],
  dashboard_load: ['p(95)<300'],
  // general API (tagged api) — measured via custom/API trends
  http_req_duration: ['p(95)<500'],
  'http_req_duration{endpoint:api}': ['p(95)<500'],
  poster_generation: ['p(95)<15000'],
  ppt_generation: ['p(95)<10000'],
  download_speed: ['p(95)<2000'],
};

/** Looser gates when rate limits / unauth are expected (smoke, chaos). */
export const softThresholds = {
  checks: ['rate>0.85'],
  http_req_failed: ['rate<0.15'],
  liturgyflow_check_pass: ['rate>0.85'],
  dashboard_load: ['p(95)<2000'],
  http_req_duration: ['p(95)<5000'],
  poster_generation: ['p(95)<30000'],
  ppt_generation: ['p(95)<30000'],
  download_speed: ['p(95)<8000'],
};
