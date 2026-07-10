import http from 'k6/http';
import { check, sleep } from 'k6';
import { BASE_URL, isOkOrRateLimited, pickDate } from './lib/config.js';

export const options = {
  stages: [
    { duration: '30s', target: 10 },
    { duration: '10s', target: 100 },
    { duration: '1m', target: 100 },
    { duration: '30s', target: 10 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    http_req_failed: ['rate<0.2'],
    http_req_duration: ['p(95)<4000'],
  },
};

export default function () {
  const home = http.get(`${BASE_URL}/`, { tags: { endpoint: 'home' } });
  check(home, { 'home not 5xx': (r) => r.status < 500 });

  const readings = http.get(`${BASE_URL}/api/readings/${pickDate()}`, {
    tags: { endpoint: 'readings' },
  });
  check(readings, {
    'readings not 5xx': (r) => r.status < 500,
    'readings ok or rate limited': (r) => isOkOrRateLimited(r),
  });

  sleep(Math.random() + 0.5);
}
