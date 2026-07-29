import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Counter } from 'k6/metrics';
import { BASE_URL } from './config.js';
import { checkPassRate, errors, rateLimited, successes } from './metrics.js';

export const practicePageLoad = new Trend('practice_page_load', true);
export const practiceApiLoad = new Trend('practice_api_load', true);
export const practiceUnlock = new Trend('practice_unlock', true);
export const practiceLyricsRefresh = new Trend('practice_lyrics_refresh', true);
export const practiceQrLoad = new Trend('practice_qr_load', true);
export const practiceWrongPin = new Counter('practice_wrong_pin');
export const practiceUnlockedOk = new Counter('practice_unlocked_ok');
export const practiceCancelled = new Counter('practice_cancelled');
export const practiceReconnects = new Counter('practice_reconnects');
export const practiceSpamRefresh = new Counter('practice_spam_refresh');

/**
 * Simulate distinct choir phones (local/dev): spoof X-Forwarded-For per VU.
 * On Render the middleware keys by TCP peer IP, so all VUs still share one NAT —
 * raise RATE_LIMIT_* or use STRESS_SPOOF_IP=0 accordingly.
 */
export function guestClientHeaders(vuId, extra) {
  const spoof = (__ENV.STRESS_SPOOF_IP || '1') !== '0';
  const headers = Object.assign(
    {
      Accept: 'application/json, text/html, */*',
      'User-Agent': `LiturgyFlow-PracticeStress/1.0 (choir-guest; vu=${vuId})`,
    },
    extra || {},
  );
  if (spoof) {
    // Spread across a private /16 so each VU looks like a different phone network
    const a = 10;
    const b = 40 + (vuId % 200);
    const c = Math.floor(vuId / 200) % 250;
    const d = 1 + (vuId % 250);
    headers['X-Forwarded-For'] = `${a}.${b}.${c}.${d}`;
  }
  return headers;
}

function jarFromResponse(res) {
  // k6 cookie jar is automatic per VU when using default; also parse Set-Cookie for explicit Cookie header
  const raw = res.headers['Set-Cookie'] || res.headers['set-cookie'];
  if (!raw) return '';
  const parts = Array.isArray(raw) ? raw : [raw];
  return parts
    .map((c) => String(c).split(';')[0].trim())
    .filter(Boolean)
    .join('; ');
}

export function openPracticePage(token, vuId) {
  const res = http.get(`${BASE_URL}/practice/${encodeURIComponent(token)}`, {
    headers: guestClientHeaders(vuId, { Accept: 'text/html' }),
    tags: { endpoint: 'practice_page', name: 'practice_html' },
    timeout: '30s',
  });
  practicePageLoad.add(res.timings.duration);
  const ok = check(res, {
    'practice page not 5xx': (r) => r.status < 500,
    'practice page 200/429': (r) => r.status === 200 || r.status === 429,
  });
  checkPassRate.add(ok);
  if (res.status === 429) rateLimited.add(1);
  if (ok) successes.add(1);
  else errors.add(1);
  return res;
}

export function fetchPracticeApi(token, vuId, cookieHeader) {
  const headers = guestClientHeaders(vuId);
  if (cookieHeader) headers.Cookie = cookieHeader;
  const res = http.get(`${BASE_URL}/api/practice/${encodeURIComponent(token)}`, {
    headers,
    tags: { endpoint: 'practice_api', name: 'practice_snapshot' },
    timeout: '30s',
  });
  practiceApiLoad.add(res.timings.duration);
  if (res.status === 429) rateLimited.add(1);
  const ok = check(res, {
    'practice api not 5xx': (r) => r.status < 500,
    'practice api reachable': (r) =>
      r.status === 200 || r.status === 404 || r.status === 429,
  });
  checkPassRate.add(ok);
  if (ok) successes.add(1);
  else errors.add(1);
  return res;
}

export function unlockPractice(token, pin, vuId) {
  const res = http.post(
    `${BASE_URL}/api/practice/${encodeURIComponent(token)}/unlock`,
    JSON.stringify({ pin: String(pin || '') }),
    {
      headers: guestClientHeaders(vuId, { 'Content-Type': 'application/json' }),
      tags: { endpoint: 'practice_unlock', name: 'practice_pin_unlock' },
      timeout: '30s',
    },
  );
  practiceUnlock.add(res.timings.duration);
  if (res.status === 429) rateLimited.add(1);
  const ok = check(res, {
    'unlock not 5xx': (r) => r.status < 500,
  });
  checkPassRate.add(ok);
  if (res.status >= 200 && res.status < 300) {
    practiceUnlockedOk.add(1);
    successes.add(1);
  } else if (res.status === 401) {
    practiceWrongPin.add(1);
    successes.add(1); // expected path when probing wrong PIN
  } else if (res.status === 429) {
    successes.add(1);
  } else {
    errors.add(1);
  }
  return {
    res,
    cookie: jarFromResponse(res),
  };
}

export function fetchPracticeQr(token, vuId) {
  const res = http.get(`${BASE_URL}/api/practice/qr/${encodeURIComponent(token)}`, {
    headers: guestClientHeaders(vuId, { Accept: 'image/*,*/*' }),
    tags: { endpoint: 'practice_qr', name: 'practice_qr' },
    timeout: '30s',
    responseType: 'none',
  });
  practiceQrLoad.add(res.timings.duration);
  const ok = check(res, {
    'qr not 5xx': (r) => r.status < 500,
  });
  checkPassRate.add(ok);
  if (ok) successes.add(1);
  else errors.add(1);
  return res;
}

/**
 * Full guest rehearsal session (no LiturgyFlow account):
 * open page → fetch API → unlock if needed → refresh lyrics → optional QR.
 */
export function guestChoirSession(token, pin, vuId) {
  openPracticePage(token, vuId);
  sleep(0.2 + Math.random() * 0.5);

  let snapshot = fetchPracticeApi(token, vuId, '');
  let body = null;
  try {
    body = snapshot.status === 200 ? snapshot.json() : null;
  } catch (e) {
    body = null;
  }

  const needsPin = Boolean(body && body.requires_pin);
  if (needsPin && pin) {
    if (Math.random() < 0.08) {
      unlockPractice(token, '000000', vuId);
      sleep(0.3);
    }
    const unlocked = unlockPractice(token, pin, vuId);
    // Prefer Set-Cookie from unlock; k6 VU cookie jar also keeps it for later GETs
    const cookie = unlocked.cookie || '';
    sleep(0.2 + Math.random() * 0.4);
    snapshot = fetchPracticeApi(token, vuId, cookie);
    try {
      body = snapshot.status === 200 ? snapshot.json() : body;
    } catch (e) {
      /* keep prior */
    }
  }

  const refreshes = 1 + Math.floor(Math.random() * 3);
  for (let i = 0; i < refreshes; i += 1) {
    sleep(0.5 + Math.random() * 1.5);
    const started = Date.now();
    const again = fetchPracticeApi(token, vuId, '');
    practiceLyricsRefresh.add(Date.now() - started);
    if (again.status === 200) {
      try {
        const j = again.json();
        check(again, {
          'lyrics unlocked or pin gate': () =>
            j.requires_pin === true || Array.isArray(j.songs),
        });
      } catch (e) {
        /* ignore */
      }
    }
  }

  if (Math.random() < 0.25) {
    fetchPracticeQr(token, vuId);
  }

  // Soft reconnect as a "new phone": clear cookies then reopen
  if (Math.random() < 0.15) {
    try {
      http.cookieJar().clear(BASE_URL);
    } catch (e) {
      /* older k6 */
    }
    openPracticePage(token, vuId);
    fetchPracticeApi(token, vuId, '');
  }

  return { body };
}

/**
 * Chaos guest: cancel, mash refresh, drop Wi-Fi (clear cookies), reopen.
 * Still no LiturgyFlow account — public practice link only.
 */
export function chaosGuestChoirSession(token, pin, vuId) {
  const roll = Math.random();

  if (roll < 0.15) {
    practiceCancelled.add(1);
    try {
      http.get(`${BASE_URL}/api/practice/${encodeURIComponent(token)}`, {
        headers: guestClientHeaders(vuId),
        timeout: '1ms',
        tags: { endpoint: 'practice_chaos', name: 'cancel_fetch' },
      });
    } catch (e) {
      /* expected */
    }
    sleep(0.1 + Math.random() * 0.3);
    openPracticePage(token, vuId);
    fetchPracticeApi(token, vuId, '');
    return;
  }

  if (roll < 0.3) {
    practiceSpamRefresh.add(1);
    openPracticePage(token, vuId);
    for (let i = 0; i < 3 + Math.floor(Math.random() * 4); i += 1) {
      fetchPracticeApi(token, vuId, '');
      sleep(0.05 + Math.random() * 0.15);
    }
    return;
  }

  if (roll < 0.45) {
    guestChoirSession(token, pin, vuId);
    practiceReconnects.add(1);
    try {
      http.cookieJar().clear(BASE_URL);
    } catch (e) {
      /* ignore */
    }
    sleep(0.2);
    openPracticePage(token, vuId);
    const snap = fetchPracticeApi(token, vuId, '');
    if (snap.status === 200) {
      try {
        const j = snap.json();
        if (j.requires_pin && pin) {
          unlockPractice(token, pin, vuId);
          fetchPracticeApi(token, vuId, '');
        }
      } catch (e) {
        /* ignore */
      }
    }
    return;
  }

  guestChoirSession(token, pin, vuId);
}

