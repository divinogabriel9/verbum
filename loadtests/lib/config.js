import http from 'k6/http';

http.setResponseCallback(http.expectedStatuses(200, 201, 204, 429));

export const BASE_URL = __ENV.BASE_URL || 'http://127.0.0.1:8000';

export const SAMPLE_DATES = [
  '2026-07-06',
  '2026-07-13',
  '2026-07-20',
  '2026-08-03',
  '2026-08-10',
];

export function pickDate() {
  return SAMPLE_DATES[Math.floor(Math.random() * SAMPLE_DATES.length)];
}

export function jsonHeaders(token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

/** 2xx success, or 429 when probing rate limits from one client IP. */
export function isOkOrRateLimited(res) {
  return (res.status >= 200 && res.status < 300) || res.status === 429;
}
