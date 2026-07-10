import http from 'k6/http';
import { check, sleep } from 'k6';
import { BASE_URL, jsonHeaders, pickDate } from './lib/config.js';

const TOKEN = __ENV.SUPABASE_JWT || '';

export const options = {
  vus: 3,
  duration: '2m',
  thresholds: {
    http_req_failed: ['rate<0.1'],
    http_req_duration: ['p(95)<8000'],
  },
};

export function setup() {
  if (!TOKEN) {
    throw new Error(
      'Set SUPABASE_JWT to a short-lived test user token (staging recommended).',
    );
  }
}

export default function () {
  const res = http.post(
    `${BASE_URL}/api/preview`,
    JSON.stringify({
      date: pickDate(),
      readings_only: true,
      refresh: false,
    }),
    {
      headers: jsonHeaders(TOKEN),
      tags: { endpoint: 'preview' },
    },
  );
  check(res, {
    'preview not 5xx': (r) => r.status < 500,
    'preview not unauthorized': (r) => r.status !== 401,
  });
  sleep(5);
}
