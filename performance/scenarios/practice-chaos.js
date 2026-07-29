import { sleep } from 'k6';
import http from 'k6/http';
import { check } from 'k6';
import { BASE_URL, STRESS_EMAIL, STRESS_PASSWORD, envSummary } from '../helpers/config.js';
import { acquireSession, ensureFreshSession } from '../helpers/auth.js';
import { chaosGuestChoirSession } from '../helpers/practice.js';
import { writeReports } from '../helpers/report.js';
import { randomSongIds } from '../helpers/church.js';

/**
 * Choir practice CHAOS — ~1000 phones, NO LiturgyFlow accounts.
 *
 * Ramp: 0 → 200 → 500 → 1000 → hold → drain
 * Behaviors: cancel, spam refresh, unlock+reconnect, normal lyric practice.
 *
 * Env:
 *   PRACTICE_TOKEN / PRACTICE_PIN  (or STRESS_EMAIL/PASSWORD to create in setup)
 *   PRACTICE_VUS                   (default 1000)
 *   PRACTICE_HOLD                  (default 5m at peak)
 *   STRESS_SPOOF_IP=1              (default — distinct IPs locally)
 */
const VUS = Number(__ENV.PRACTICE_VUS || 1000);
const HOLD = __ENV.PRACTICE_HOLD || '5m';

// Faster climb when PRACTICE_FAST_RAMP=1 (good for local / short holds)
const FAST = (__ENV.PRACTICE_FAST_RAMP || '0') === '1';

export const options = {
  scenarios: {
    practice_chaos: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: FAST
        ? [
            { duration: '30s', target: Math.min(200, VUS) },
            { duration: '45s', target: Math.min(500, VUS) },
            { duration: '45s', target: VUS },
            { duration: HOLD, target: VUS },
            { duration: '45s', target: 0 },
          ]
        : [
            { duration: '1m', target: Math.min(200, VUS) },
            { duration: '2m', target: Math.min(500, VUS) },
            { duration: '2m', target: VUS },
            { duration: HOLD, target: VUS },
            { duration: '2m', target: Math.min(200, VUS) },
            { duration: '1m', target: 0 },
          ],
      gracefulRampDown: '1m',
    },
  },
  thresholds: {
    checks: ['rate>0.7'],
    http_req_failed: ['rate<0.35'],
    liturgyflow_check_pass: ['rate>0.7'],
    practice_page_load: ['p(95)<8000'],
    practice_api_load: ['p(95)<8000'],
  },
  summaryTrendStats: ['avg', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
};

function createGuestShare(accessToken) {
  const deviceId = `chaos-device-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const pin = String(100000 + Math.floor(Math.random() * 900000));
  const picks = randomSongIds(5);
  const songs = picks.map((s, i) => ({
    slot_key: ['entrance', 'offertory', 'communion', 'recessional', 'meditation'][i] || `slot_${i}`,
    slot_label: s.section || 'Song',
    section: s.section || 'entrance',
    hymn_id: s.id,
    title: s.title || s.id,
    author: 'Chaos Test',
    language: 'English',
    lyrics:
      `Verse 1\nChaos rehearsal lyrics for ${s.title || s.id}.\n\n` +
      `Chorus\nA thousand voices, one song.\n\nVerse 2\nPractice makes perfect.`,
  }));

  const massDate = new Date();
  massDate.setUTCDate(massDate.getUTCDate() + ((7 - massDate.getUTCDay()) % 7 || 7));

  const res = http.post(
    `${BASE_URL}/api/practice/share`,
    JSON.stringify({
      mass_date: massDate.toISOString().slice(0, 10),
      mass_title: 'k6 Choir Chaos — 1000 guests',
      parish_name: 'Chaos Test Parish',
      celebrant: 'Fr. Chaos',
      songs,
      ttl_days: 1,
      optional_pin: pin,
    }),
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Practice-Device-Id': deviceId,
      },
      tags: { endpoint: 'practice_create', name: 'chaos_setup_share' },
      timeout: '60s',
    },
  );

  if (!(res.status >= 200 && res.status < 300)) {
    throw new Error(
      `Failed to create practice share (${res.status}): ${String(res.body).slice(0, 400)}`,
    );
  }
  const body = res.json();
  return { token: body.token, pin: body.pin || pin, created: true };
}

export function setup() {
  const env = envSummary();
  let token = (__ENV.PRACTICE_TOKEN || '').trim();
  let pin = (__ENV.PRACTICE_PIN || '').trim();
  let created = false;

  if (!token) {
    // Prefer local create via Python-backed share if no auth — handled by runner script.
    // If credentials exist, create via API.
    if (STRESS_EMAIL && STRESS_PASSWORD) {
      let session = acquireSession(1);
      if (!session || !session.access_token) {
        throw new Error('Auth failed creating chaos practice share.');
      }
      session = ensureFreshSession(session);
      const share = createGuestShare(session.access_token);
      token = share.token;
      pin = share.pin;
      created = true;
    } else {
      throw new Error(
        'Set PRACTICE_TOKEN + PRACTICE_PIN, or STRESS_EMAIL/PASSWORD to auto-create a share.',
      );
    }
  }

  const warm = http.get(`${BASE_URL}/api/practice/${encodeURIComponent(token)}`, {
    tags: { endpoint: 'practice_api', name: 'chaos_warm' },
    timeout: '20s',
  });
  check(warm, { 'chaos warm ok': (r) => r.status === 200 || r.status === 429 });

  console.log(
    `practice-chaos ready: vus=${VUS} hold=${HOLD} token=${token.slice(0, 8)}… created=${created}`,
  );

  return { env, token, pin, created, vus: VUS, hold: HOLD, warm_status: warm.status };
}

export default function (data) {
  chaosGuestChoirSession(data.token, data.pin, __VU);
  // Choir members don't spam endlessly — short think time between chaos loops
  sleep(0.3 + Math.random() * 1.2);
}

export function handleSummary(data) {
  return writeReports(data, 'practice-chaos');
}
