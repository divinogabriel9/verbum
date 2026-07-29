import { sleep } from 'k6';
import { acquireSession, ensureFreshSession, verifySession, heartbeat, logoutLike } from '../helpers/auth.js';
import { churchForVu, weightedRole } from '../helpers/church.js';
import {
  browseSongs,
  loadDashboard,
  loadCalendar,
  loadTodayReadings,
  mediaOfficerFlow,
  secretaryFlow,
} from '../helpers/flows.js';
import { softThresholds } from '../helpers/metrics.js';
import { writeReports } from '../helpers/report.js';

/**
 * Launch Day — 30 minute ramp:
 * 0 → 50 → 100 → 200 → 300 → 500 → 300 → 100 → 0
 */
export const options = {
  scenarios: {
    launch_day: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 50 },
        { duration: '3m', target: 100 },
        { duration: '4m', target: 200 },
        { duration: '4m', target: 300 },
        { duration: '5m', target: 500 },
        { duration: '4m', target: 300 },
        { duration: '4m', target: 100 },
        { duration: '4m', target: 0 },
      ],
      gracefulRampDown: '1m',
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
    // At launch scale, only a fraction hit expensive generate
    if (Math.random() < 0.15) {
      mediaOfficerFlow(token, church);
    } else {
      loadCalendar(token, church);
      browseSongs(token, church);
    }
  } else if (role === 'choir_leader') {
    browseSongs(token, church);
  } else if (role === 'secretary') {
    secretaryFlow(token, church);
  } else {
    loadTodayReadings(token, church);
  }

  logoutLike(session);
  sleep(0.5 + Math.random() * 1.5);
}

export function handleSummary(data) {
  return writeReports(data, 'launch');
}
