import { sleep } from 'k6';
import http from 'k6/http';
import { check } from 'k6';
import { BASE_URL, STRESS_EMAIL, STRESS_PASSWORD, envSummary } from '../helpers/config.js';
import { acquireSession, ensureFreshSession } from '../helpers/auth.js';
import { guestChoirSession } from '../helpers/practice.js';
import { softThresholds } from '../helpers/metrics.js';
import { writeReports } from '../helpers/report.js';
import { randomSongIds } from '../helpers/church.js';

/**
 * Choir practice — guests WITHOUT LiturgyFlow accounts.
 *
 * Simulates many phones opening /practice/{token}, unlocking with PIN,
 * reading lyrics, refreshing, and reconnecting.
 *
 * Env:
 *   PRACTICE_TOKEN   — existing share token (preferred)
 *   PRACTICE_PIN     — 6-digit PIN (required if share is PIN-locked)
 *   PRACTICE_VUS     — concurrent guests (default 50)
 *   PRACTICE_DURATION — e.g. 5m, 10m (default 5m)
 *   STRESS_SPOOF_IP  — "1" (default) spoof X-Forwarded-For per VU (local)
 *
 * If PRACTICE_TOKEN is unset but STRESS_EMAIL/PASSWORD are set, setup()
 * creates a temporary share as an authenticated parish user, then guests
 * use only the public token+PIN (no account on the guest path).
 */
const VUS = Number(__ENV.PRACTICE_VUS || 50);
const DURATION = __ENV.PRACTICE_DURATION || '5m';

function parseDurationSeconds(raw) {
  const s = String(raw || '').trim();
  const m = s.match(/^(\d+(?:\.\d+)?)(ms|s|m|h)?$/i);
  if (!m) return 300;
  const n = Number(m[1]);
  const u = (m[2] || 's').toLowerCase();
  if (u === 'ms') return n / 1000;
  if (u === 'm') return n * 60;
  if (u === 'h') return n * 3600;
  return n;
}

const steadySecs = parseDurationSeconds(DURATION);
const rampIn = Math.min(30, Math.max(5, Math.floor(steadySecs / 6)));
const midSecs = Math.min(60, Math.max(5, Math.floor(steadySecs / 3)));
const rampOut = Math.min(30, Math.max(5, Math.floor(steadySecs / 6)));

export const options = {
  scenarios: {
    choir_guests: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: `${rampIn}s`, target: Math.min(10, VUS) },
        { duration: `${midSecs}s`, target: Math.min(Math.ceil(VUS / 2), VUS) },
        { duration: DURATION, target: VUS },
        { duration: `${rampOut}s`, target: 0 },
      ],
      gracefulRampDown: '30s',
    },
  },
  thresholds: Object.assign({}, softThresholds, {
    practice_page_load: ['p(95)<3000'],
    practice_api_load: ['p(95)<2000'],
    practice_unlock: ['p(95)<3000'],
    http_req_failed: ['rate<0.2'],
  }),
  summaryTrendStats: ['avg', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
};

function createGuestShare(accessToken) {
  const deviceId = `stress-device-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const pin = String(100000 + Math.floor(Math.random() * 900000));
  const picks = randomSongIds(4);
  const songs = picks.map((s, i) => ({
    slot_key: ['entrance', 'offertory', 'communion', 'recessional'][i] || `slot_${i}`,
    slot_label: s.section || 'Song',
    section: s.section || 'entrance',
    hymn_id: s.id,
    title: s.title || s.id,
    author: 'Stress Test',
    language: 'English',
    lyrics:
      `Verse 1\nStress test lyrics for ${s.title || s.id}.\n\n` +
      `Chorus\nSing praise, sing praise.\n\nVerse 2\nAnother line for rehearsal.`,
  }));

  const massDate = new Date();
  massDate.setUTCDate(massDate.getUTCDate() + ((7 - massDate.getUTCDay()) % 7 || 7));
  const dateStr = massDate.toISOString().slice(0, 10);

  const res = http.post(
    `${BASE_URL}/api/practice/share`,
    JSON.stringify({
      mass_date: dateStr,
      mass_title: 'k6 Choir Practice Stress',
      parish_name: 'Stress Test Parish',
      celebrant: 'Fr. Stress Test',
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
      tags: { endpoint: 'practice_create', name: 'setup_create_share' },
      timeout: '60s',
    },
  );

  const ok = check(res, {
    'created practice share': (r) => r.status >= 200 && r.status < 300,
  });
  if (!ok) {
    throw new Error(
      `Failed to create practice share (${res.status}): ${String(res.body).slice(0, 400)}`,
    );
  }
  const body = res.json();
  return {
    token: body.token,
    pin: body.pin || pin,
    created: true,
    expires_at: body.expires_at,
  };
}

export function setup() {
  const env = envSummary();
  let token = (__ENV.PRACTICE_TOKEN || '').trim();
  let pin = (__ENV.PRACTICE_PIN || '').trim();
  let created = false;

  if (!token) {
    if (!STRESS_EMAIL || !STRESS_PASSWORD) {
      throw new Error(
        'Set PRACTICE_TOKEN (+ PRACTICE_PIN) for an existing share, ' +
          'or STRESS_EMAIL/STRESS_PASSWORD so setup can create one.',
      );
    }
    let session = acquireSession(1);
    if (!session || !session.access_token) {
      throw new Error('Could not authenticate to create a practice share.');
    }
    session = ensureFreshSession(session);
    const share = createGuestShare(session.access_token);
    token = share.token;
    pin = share.pin;
    created = true;
  }

  if (!pin || !/^\d{6}$/.test(pin)) {
    console.warn(
      'PRACTICE_PIN missing or not 6 digits — unlock steps will fail if the share requires a PIN.',
    );
  }

  // Warm check (anonymous)
  const warm = http.get(`${BASE_URL}/api/practice/${encodeURIComponent(token)}`, {
    tags: { endpoint: 'practice_api', name: 'setup_warm' },
    timeout: '20s',
  });

  return {
    env,
    token,
    pin,
    created,
    warm_status: warm.status,
    vus: VUS,
    duration: DURATION,
  };
}

export default function (data) {
  const token = data.token;
  const pin = data.pin;
  guestChoirSession(token, pin, __VU);
  // Think time between rehearsal loops
  sleep(1 + Math.random() * 3);
}

export function handleSummary(data) {
  return writeReports(data, 'practice');
}
