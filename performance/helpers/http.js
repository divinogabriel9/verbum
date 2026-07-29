import http from 'k6/http';
import { check } from 'k6';
import { BASE_URL } from './config.js';
import {
  checkPassRate,
  errors,
  rateLimited,
  successes,
} from './metrics.js';

http.setResponseCallback(http.expectedStatuses(200, 201, 204, 304, 429));

export function authHeaders(token, extra) {
  const headers = Object.assign(
    { Accept: 'application/json', 'Content-Type': 'application/json' },
    extra || {},
  );
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

export function absoluteUrl(pathOrUrl) {
  if (!pathOrUrl) return '';
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  if (pathOrUrl.startsWith('/')) return `${BASE_URL}${pathOrUrl}`;
  return `${BASE_URL}/${pathOrUrl}`;
}

/**
 * @param {object} opts
 * @param {string} opts.method
 * @param {string} opts.path
 * @param {object} [opts.body]
 * @param {string} [opts.token]
 * @param {object} [opts.tags]
 * @param {import('k6/metrics').Trend} [opts.trend]
 * @param {number} [opts.timeout]
 * @param {function} [opts.validate]
 */
export function apiRequest(opts) {
  const method = (opts.method || 'GET').toUpperCase();
  const url = absoluteUrl(opts.path);
  const tags = Object.assign({ endpoint: 'api' }, opts.tags || {});
  const params = {
    headers: authHeaders(opts.token, opts.headers),
    tags,
    timeout: opts.timeout || '120s',
  };

  let res;
  if (method === 'GET') {
    res = http.get(url, params);
  } else if (method === 'DELETE') {
    res = http.del(url, null, params);
  } else {
    const body =
      opts.body === undefined || opts.body === null
        ? null
        : typeof opts.body === 'string'
          ? opts.body
          : JSON.stringify(opts.body);
    res = http.request(method, url, body, params);
  }

  if (opts.trend) {
    opts.trend.add(res.timings.duration);
  }

  if (res.status === 429) {
    rateLimited.add(1);
  }

  const ok =
    typeof opts.validate === 'function'
      ? opts.validate(res)
      : (res.status >= 200 && res.status < 300) ||
        res.status === 304 ||
        res.status === 429;

  const checks = check(res, {
    [`${tags.name || method + ' ' + opts.path} ok`]: () => ok,
  });
  checkPassRate.add(checks);
  if (ok) successes.add(1);
  else errors.add(1);

  return res;
}

export function getJson(path, token, tags, trend) {
  return apiRequest({
    method: 'GET',
    path,
    token,
    tags,
    trend,
    validate: (r) =>
      r.status === 429 ||
      r.status === 304 ||
      (r.status >= 200 && r.status < 300),
  });
}

export function postJson(path, body, token, tags, trend, validate) {
  return apiRequest({
    method: 'POST',
    path,
    body,
    token,
    tags,
    trend,
    validate,
  });
}
