import http from 'k6/http';
import { check, sleep } from 'k6';
import { BASE_URL, isOkOrRateLimited, pickDate } from './lib/config.js';

export const options = {
  stages: [
    { duration: '2m', target: 50 },
    { duration: '3m', target: 100 },
    { duration: '2m', target: 150 },
    { duration: '2m', target: 0 },
  ],
  thresholds: {
    http_req_failed: ['rate<0.15'],
    http_req_duration: ['p(99)<5000'],
  },
};

export default function () {
  const res = http.get(`${BASE_URL}/api/readings/${pickDate()}`, {
    tags: { endpoint: 'readings' },
  });
  check(res, {
    'not server error': (r) => r.status < 500,
    'ok or rate limited': (r) => isOkOrRateLimited(r),
  });
  sleep(0.5);
}
