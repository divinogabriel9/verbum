import { sleep } from 'k6';
import { acquireSession, ensureFreshSession, verifySession, heartbeat, logoutLike } from '../helpers/auth.js';
import { churchForVu, weightedRole } from '../helpers/church.js';
import {
  browseSongs,
  loadTodayReadings,
  mediaOfficerFlow,
  secretaryFlow,
} from '../helpers/flows.js';
import { softThresholds, productionThresholds } from '../helpers/metrics.js';
import { writeReports } from '../helpers/report.js';
import { ALLOW_EXPENSIVE } from '../helpers/config.js';

export const options = {
  scenarios: {
    peak_sunday: {
      executor: 'constant-vus',
      vus: 100,
      duration: '20m',
      gracefulStop: '60s',
    },
  },
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
  const role = weightedRole();

  if (token) heartbeat(token, church);

  if (role === 'media_officer') {
    mediaOfficerFlow(token, church);
  } else if (role === 'choir_leader') {
    browseSongs(token, church);
  } else if (role === 'secretary') {
    secretaryFlow(token, church);
  } else {
    loadTodayReadings(token, church);
  }

  logoutLike(session);
  sleep(1 + Math.random() * 2);
}

export function handleSummary(data) {
  return writeReports(data, 'peak');
}
