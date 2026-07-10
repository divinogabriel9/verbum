import http from 'k6/http';
import { check, sleep } from 'k6';
import { BASE_URL, isOkOrRateLimited, pickDate } from './lib/config.js';

export const options = {
  stages: [
    { duration: '1m', target: 10 },
    { duration: '3m', target: 30 },
    { duration: '1m', target: 0 },
  ],
  thresholds: {
    http_req_failed: ['rate<0.05'],
    http_req_duration: ['p(95)<2000'],
    'http_req_duration{endpoint:readings}': ['p(95)<3000'],
  },
};

export default function () {
  const date = pickDate();

  const readings = http.get(`${BASE_URL}/api/readings/${date}`, {
    tags: { endpoint: 'readings' },
  });
  check(readings, {
    'readings ok or rate limited': (r) => isOkOrRateLimited(r),
    'readings has ok': (r) => {
      if (r.status === 429) return true;
      try {
        return r.json('ok') === true;
      } catch {
        return false;
      }
    },
  });

  const calendar = http.get(`${BASE_URL}/api/calendar/month?year=2026&month=7`, {
    tags: { endpoint: 'calendar' },
  });
  check(calendar, {
    'calendar ok or rate limited': (r) => isOkOrRateLimited(r),
  });

  const flags = http.get(`${BASE_URL}/api/feature-flags`, {
    tags: { endpoint: 'flags' },
  });
  check(flags, {
    'feature-flags ok or rate limited': (r) => isOkOrRateLimited(r),
  });

  sleep(Math.random() * 2 + 1);
}
