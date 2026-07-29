import { sleep } from 'k6';
import { acquireSession, ensureFreshSession, verifySession, heartbeat, logoutLike } from '../helpers/auth.js';
import { churchForVu, weightedRole } from '../helpers/church.js';
import {
  browseSongs,
  loadCalendar,
  loadDashboard,
  loadTodayReadings,
  secretaryFlow,
  sundayMassPipeline,
} from '../helpers/flows.js';
import { softThresholds } from '../helpers/metrics.js';
import { writeReports } from '../helpers/report.js';

/**
 * Soak — 50 churches for 8 hours.
 * Steady realistic mix to expose memory / connection / Redis growth.
 */
export const options = {
  scenarios: {
    soak: {
      executor: 'constant-vus',
      vus: 50,
      duration: '8h',
      gracefulStop: '2m',
    },
  },
  thresholds: softThresholds,
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
  const role = weightedRole();

  if (token) heartbeat(token, church);

  loadDashboard(token, church);

  if (role === 'media_officer') {
    // Sparse expensive work during soak (every ~10th iteration opportunistic)
    if (__ITER % 10 === 0) {
      sundayMassPipeline(token, church);
    } else {
      loadCalendar(token, church);
    }
  } else if (role === 'choir_leader') {
    browseSongs(token, church);
  } else if (role === 'secretary') {
    secretaryFlow(token, church);
  } else {
    loadTodayReadings(token, church);
  }

  logoutLike(session);
  // Think time keeps sustained but not pathological QPS
  sleep(5 + Math.random() * 10);
}

export function handleSummary(data) {
  return writeReports(data, 'soak');
}
