import http from 'k6/http';
import { SharedArray } from 'k6/data';
import { BASE_URL } from './config.js';

/**
 * Static inventory of known LiturgyFlow FastAPI routes (kept in sync with server.py).
 * Used as baseline; OpenAPI discovery extends this at runtime.
 */
export const KNOWN_ROUTES = new SharedArray('known_routes', function () {
  return [
    { method: 'GET', path: '/health', tier: 'exempt' },
    { method: 'GET', path: '/api/feature-flags', tier: 'api' },
    { method: 'GET', path: '/api/platform/announcement', tier: 'api' },
    { method: 'GET', path: '/api/input-limits', tier: 'api' },
    { method: 'GET', path: '/api/calendar/month', tier: 'api' },
    { method: 'GET', path: '/api/readings/{date}', tier: 'api' },
    { method: 'GET', path: '/api/gospel-image/{date}', tier: 'api' },
    { method: 'GET', path: '/api/poster-exists', tier: 'api' },
    { method: 'GET', path: '/api/catholic-news', tier: 'api' },
    { method: 'GET', path: '/api/wyd-news', tier: 'api' },
    { method: 'GET', path: '/api/ewtn/radio', tier: 'api' },
    { method: 'GET', path: '/api/auth/config', tier: 'auth' },
    { method: 'GET', path: '/api/auth/me', tier: 'auth' },
    { method: 'POST', path: '/api/auth/heartbeat', tier: 'auth' },
    { method: 'POST', path: '/api/preview', tier: 'expensive' },
    { method: 'POST', path: '/api/generate', tier: 'expensive' },
    { method: 'POST', path: '/api/demo-generate', tier: 'expensive' },
    { method: 'POST', path: '/api/regenerate-pptx', tier: 'expensive' },
    { method: 'POST', path: '/generate-image', tier: 'expensive' },
    { method: 'GET', path: '/api/catalog/songs', tier: 'api' },
    { method: 'GET', path: '/api/catalog/songs/whats-new', tier: 'api' },
    { method: 'GET', path: '/api/catalog/songs/{section}/{hymn_id}', tier: 'api' },
    { method: 'GET', path: '/api/practice/{token}', tier: 'practice' },
    { method: 'POST', path: '/api/practice/{token}/unlock', tier: 'practice' },
    { method: 'GET', path: '/api/practice/qr/{token}', tier: 'practice' },
    { method: 'GET', path: '/practice/{token}', tier: 'practice_page' },
    { method: 'POST', path: '/api/practice/share', tier: 'practice' },
    { method: 'GET', path: '/api/saved-posters', tier: 'expensive' },
    { method: 'GET', path: '/api/saved-media', tier: 'expensive' },
    { method: 'GET', path: '/api/community', tier: 'api' },
    { method: 'POST', path: '/api/community/profile', tier: 'api' },
    { method: 'GET', path: '/api/mass/smart-defaults', tier: 'api' },
    { method: 'GET', path: '/api/image-quota', tier: 'api' },
    { method: 'GET', path: '/api/practice/shares/recent', tier: 'api' },
    { method: 'GET', path: '/home', tier: 'default' },
    { method: 'GET', path: '/today', tier: 'default' },
    { method: 'GET', path: '/mass/builder', tier: 'default' },
    { method: 'GET', path: '/mass/calendar', tier: 'default' },
    { method: 'GET', path: '/media/history', tier: 'default' },
    { method: 'GET', path: '/library/songs', tier: 'default' },
    { method: 'GET', path: '/library/collections', tier: 'default' },
  ];
});

const UNSAFE_PREFIXES = [
  '/api/admin/',
  '/api/internal/',
  '/api/upload',
  '/api/upload-logo',
  '/api/upload-avatar',
  '/generate-image',
  '/api/generate',
  '/api/regenerate-pptx',
  '/api/design/',
  '/api/songs/import',
  '/api/lyrics/',
  '/api/submissions/',
  '/api/parish/team',
  '/api/practice/share',
];

let cachedOpenApiPaths = null;

/**
 * Pull FastAPI OpenAPI schema (default /openapi.json) and list paths.
 * Falls back to KNOWN_ROUTES when docs are disabled.
 */
export function discoverGetEndpoints() {
  if (cachedOpenApiPaths) return cachedOpenApiPaths;

  const res = http.get(`${BASE_URL}/openapi.json`, {
    tags: { endpoint: 'discover', name: 'openapi' },
    timeout: '20s',
  });

  const paths = [];
  if (res.status === 200) {
    try {
      const schema = res.json();
      const p = schema.paths || {};
      for (const path of Object.keys(p)) {
        const methods = p[path] || {};
        if (methods.get || methods.GET) {
          paths.push(path);
        }
      }
    } catch (e) {
      // ignore parse errors
    }
  }

  if (!paths.length) {
    for (const r of KNOWN_ROUTES) {
      if (r.method === 'GET') paths.push(r.path);
    }
  }

  cachedOpenApiPaths = paths;
  return paths;
}

export function filterSafePublicGets(paths, knownPaths) {
  const known = new Set(knownPaths || KNOWN_ROUTES.map((r) => r.path));
  const out = [];
  for (const path of paths) {
    if (known.has(path)) continue;
    if (path.includes('{')) continue;
    let unsafe = false;
    for (const pref of UNSAFE_PREFIXES) {
      if (path.startsWith(pref)) {
        unsafe = true;
        break;
      }
    }
    if (unsafe) continue;
    if (!path.startsWith('/api/') && path !== '/health') continue;
    out.push(path);
  }
  return out;
}

export function inventorySummary() {
  const discovered = discoverGetEndpoints();
  return {
    known_routes: KNOWN_ROUTES.length,
    openapi_get_paths: discovered.length,
    sample_new: filterSafePublicGets(discovered).slice(0, 20),
  };
}
