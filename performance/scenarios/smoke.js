import { sleep } from 'k6';
import { envSummary } from '../helpers/config.js';
import { acquireSession, ensureFreshSession, verifySession, logoutLike } from '../helpers/auth.js';
import { churchForVu, churchCount } from '../helpers/church.js';
import { loadDashboard, loadCalendar, maybeDiscover } from '../helpers/flows.js';
import { softThresholds } from '../helpers/metrics.js';
import { writeReports } from '../helpers/report.js';
import { inventorySummary, KNOWN_ROUTES } from '../helpers/discover.js';
import { getJson } from '../helpers/http.js';

export const options = {
  scenarios: {
    smoke_churches: {
      executor: 'constant-vus',
      vus: 10,
      duration: '5m',
      gracefulStop: '30s',
    },
  },
  thresholds: softThresholds,
  summaryTrendStats: ['avg', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
};

export function setup() {
  const env = envSummary();
  const health = getJson('/health', null, { endpoint: 'exempt', name: 'health' });
  const inv = inventorySummary();
  return {
    env,
    health_ok: health.status === 200,
    churches: churchCount(),
    inventory: inv,
    discover_paths: inv.sample_new || [],
  };
}

export default function (data) {
  let session = acquireSession(__VU);
  if (session) {
    session = ensureFreshSession(session);
    verifySession(session.access_token);
  }
  const church = churchForVu();
  const token = session && session.access_token;

  loadDashboard(token, church);
  loadCalendar(token, church);
  maybeDiscover(
    token,
    KNOWN_ROUTES.map((r) => r.path),
    data && data.discover_paths,
  );

  logoutLike(session);
  sleep(1 + Math.random());
}

export function handleSummary(data) {
  return writeReports(data, 'smoke');
}
