import { sleep } from 'k6';
import { acquireSession, ensureFreshSession, verifySession, heartbeat, logoutLike } from '../helpers/auth.js';
import { churchForVu } from '../helpers/church.js';
import { sundayMassPipeline } from '../helpers/flows.js';
import { productionThresholds, softThresholds } from '../helpers/metrics.js';
import { writeReports } from '../helpers/report.js';
import { ALLOW_EXPENSIVE } from '../helpers/config.js';

export const options = {
  scenarios: {
    sunday_prep: {
      executor: 'constant-vus',
      vus: 50,
      duration: '15m',
      gracefulStop: '60s',
    },
  },
  // Strict duration gates only meaningful when expensive path is enabled and rate limits raised.
  thresholds: ALLOW_EXPENSIVE ? productionThresholds : softThresholds,
  summaryTrendStats: ['avg', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
};

export default function () {
  let session = acquireSession(__VU);
  if (session) {
    session = ensureFreshSession(session);
    verifySession(session.access_token);
  }

  const church = churchForVu();
  const token = session && session.access_token;

  if (token) {
    heartbeat(token, church);
  }

  // Login → Dashboard → Create Mass → Poster → PPT → Save History → Download → Logout
  sundayMassPipeline(token, church);

  logoutLike(session);
  sleep(2 + Math.random() * 3);
}

export function handleSummary(data) {
  return writeReports(data, 'sunday');
}
