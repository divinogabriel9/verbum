import { sleep } from 'k6';
import { acquireSession, ensureFreshSession, verifySession, logoutLike } from '../helpers/auth.js';
import { churchForVu } from '../helpers/church.js';
import {
  browseSongs,
  chaosCancel,
  chaosRefresh,
  chaosRetryDownload,
  loadCalendar,
  loadDashboard,
  loadTodayReadings,
  maybeDiscover,
} from '../helpers/flows.js';
import { softThresholds } from '../helpers/metrics.js';
import { writeReports } from '../helpers/report.js';
import { KNOWN_ROUTES } from '../helpers/discover.js';

/**
 * Chaos — up to 1000 virtual churches with cancel / refresh / retry / reconnect.
 * Avoids mass /api/generate at this scale (would destroy AI quota + Render).
 */
export const options = {
  scenarios: {
    chaos: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 200 },
        { duration: '3m', target: 500 },
        { duration: '5m', target: 1000 },
        { duration: '5m', target: 1000 },
        { duration: '3m', target: 200 },
        { duration: '2m', target: 0 },
      ],
      gracefulRampDown: '1m',
    },
  },
  thresholds: {
    checks: ['rate>0.7'],
    http_req_failed: ['rate<0.35'],
    liturgyflow_check_pass: ['rate>0.7'],
  },
  summaryTrendStats: ['avg', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
};

export default function () {
  let session = acquireSession(__VU);
  if (session) {
    session = ensureFreshSession(session);
    if (Math.random() < 0.5) {
      verifySession(session.access_token);
    }
  }

  const church = churchForVu();
  let token = session && session.access_token;

  const action = Math.random();
  if (action < 0.2) {
    chaosCancel(token, church);
  } else if (action < 0.4) {
    chaosRefresh(token, church);
  } else if (action < 0.55) {
    chaosRetryDownload(token, church);
  } else if (action < 0.7) {
    // disconnect / reconnect
    logoutLike(session);
    session = acquireSession(__VU);
    token = session && session.access_token;
    loadDashboard(token, church);
  } else if (action < 0.85) {
    // repeat requests
    loadTodayReadings(token, church);
    loadTodayReadings(token, church);
  } else {
    loadCalendar(token, church);
    browseSongs(token, church);
    maybeDiscover(
      token,
      KNOWN_ROUTES.map((r) => r.path),
    );
  }

  logoutLike(session);
  sleep(Math.random() * 0.8);
}

export function handleSummary(data) {
  return writeReports(data, 'chaos');
}
