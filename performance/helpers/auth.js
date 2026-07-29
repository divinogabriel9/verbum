import http from 'k6/http';
import { check } from 'k6';
import {
  BASE_URL,
  STRESS_EMAIL,
  STRESS_PASSWORD,
  STRESS_TOKENS,
  SUPABASE_ANON_KEY,
  SUPABASE_URL,
} from './config.js';
import { authLatency, checkPassRate, errors, successes } from './metrics.js';
import { getJson } from './http.js';

/**
 * Login via Supabase Auth password grant.
 * Returns { access_token, refresh_token, expires_at } or null.
 */
export function loginWithPassword(email, password) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return null;
  }
  const url = `${SUPABASE_URL}/auth/v1/token?grant_type=password`;
  const started = Date.now();
  const res = http.post(
    url,
    JSON.stringify({ email, password }),
    {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
      tags: { endpoint: 'auth', name: 'supabase_password_login' },
      timeout: '30s',
    },
  );
  authLatency.add(Date.now() - started);

  const ok = check(res, {
    'supabase login 200': (r) => r.status === 200,
  });
  checkPassRate.add(ok);

  if (!ok) {
    errors.add(1);
    return null;
  }
  successes.add(1);
  const body = res.json();
  return {
    access_token: body.access_token,
    refresh_token: body.refresh_token,
    expires_at: Date.now() + (Number(body.expires_in) || 3600) * 1000 - 60000,
    email,
  };
}

export function refreshAccessToken(refreshToken) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !refreshToken) {
    return null;
  }
  const url = `${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`;
  const started = Date.now();
  const res = http.post(
    url,
    JSON.stringify({ refresh_token: refreshToken }),
    {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
      tags: { endpoint: 'auth', name: 'supabase_refresh' },
      timeout: '30s',
    },
  );
  authLatency.add(Date.now() - started);
  if (res.status !== 200) {
    errors.add(1);
    return null;
  }
  successes.add(1);
  const body = res.json();
  return {
    access_token: body.access_token,
    refresh_token: body.refresh_token || refreshToken,
    expires_at: Date.now() + (Number(body.expires_in) || 3600) * 1000 - 60000,
  };
}

/**
 * Resolve a session for this VU:
 * 1) STRESS_TOKENS pool (indexed by VU)
 * 2) STRESS_EMAIL/PASSWORD password grant
 * 3) null (anonymous public routes only)
 */
export function acquireSession(vuId) {
  if (STRESS_TOKENS.length > 0) {
    const token = STRESS_TOKENS[(vuId - 1) % STRESS_TOKENS.length];
    return {
      access_token: token,
      refresh_token: null,
      expires_at: Date.now() + 55 * 60 * 1000,
      source: 'token_pool',
    };
  }
  if (STRESS_EMAIL && STRESS_PASSWORD) {
    const session = loginWithPassword(STRESS_EMAIL, STRESS_PASSWORD);
    if (session) {
      session.source = 'password';
      return session;
    }
  }
  return null;
}

export function ensureFreshSession(session) {
  if (!session || !session.access_token) return session;
  if (!session.expires_at || Date.now() < session.expires_at) {
    return session;
  }
  if (!session.refresh_token) {
    return acquireSession(__VU);
  }
  const refreshed = refreshAccessToken(session.refresh_token);
  if (!refreshed) return acquireSession(__VU);
  refreshed.source = session.source;
  refreshed.email = session.email;
  return refreshed;
}

export function verifySession(token) {
  if (!token) return false;
  const res = getJson('/api/auth/me', token, {
    endpoint: 'auth',
    name: 'auth_me',
  });
  if (res.status === 429) return true;
  try {
    return Boolean(res.json('authenticated'));
  } catch (e) {
    return false;
  }
}

export function heartbeat(token, church) {
  if (!token) return null;
  return http.post(
    `${BASE_URL}/api/auth/heartbeat`,
    JSON.stringify({
      timezone: church.timezone || 'UTC',
      preferred_language: church.language || 'english',
      region: church.country || '',
    }),
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      tags: { endpoint: 'auth', name: 'heartbeat' },
      timeout: '15s',
    },
  );
}

/** No server revoke on access tokens — drop local session state. */
export function logoutLike(session) {
  return {
    access_token: null,
    refresh_token: null,
    logged_out: true,
    previous: session && session.source,
  };
}
