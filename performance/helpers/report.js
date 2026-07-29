/**
 * k6 handleSummary — writes JSON, HTML, CSV under performance/reports/.
 */
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.1.0/index.js';

const metricProps = (data, name) => {
  const m = data.metrics && data.metrics[name];
  if (!m || !m.values) return null;
  return m.values;
};

const fmt = (n, digits) => {
  if (n === undefined || n === null || Number.isNaN(n)) return '';
  return Number(n).toFixed(digits);
};

const csvEscape = (v) => {
  const s = String(v === undefined || v === null ? '' : v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
};

const buildCsv = (data) => {
  const rows = [['metric', 'avg', 'med', 'p90', 'p95', 'p99', 'max', 'count', 'rate']];
  const names = Object.keys(data.metrics || {}).sort();
  for (let i = 0; i < names.length; i += 1) {
    const name = names[i];
    const v = metricProps(data, name);
    if (!v) continue;
    rows.push([
      name,
      fmt(v.avg, 3),
      fmt(v.med, 3),
      fmt(v['p(90)'], 3),
      fmt(v['p(95)'], 3),
      fmt(v['p(99)'], 3),
      fmt(v.max, 3),
      v.count !== undefined ? v.count : v.passes !== undefined ? v.passes : '',
      v.rate !== undefined ? fmt(v.rate, 6) : '',
    ]);
  }
  return `${rows.map((r) => r.map(csvEscape).join(',')).join('\n')}\n`;
};

const buildHtml = (data, scenarioName) => {
  const metrics = [
    'http_req_duration',
    'http_req_failed',
    'checks',
    'dashboard_load',
    'calendar_load',
    'song_search',
    'poster_generation',
    'ppt_generation',
    'download_speed',
    'history_save',
    'readings_load',
    'ai_generation',
    'auth_latency',
    'liturgyflow_errors',
    'liturgyflow_successes',
    'liturgyflow_rate_limited',
  ];

  let cards = '';
  for (let i = 0; i < metrics.length; i += 1) {
    const name = metrics[i];
    const v = metricProps(data, name);
    if (!v) continue;
    const p95 = v['p(95)'] !== undefined ? `${fmt(v['p(95)'], 1)}ms` : '';
    const avg = v.avg !== undefined ? `${fmt(v.avg, 1)}ms` : '';
    const rate = v.rate !== undefined ? `${fmt(v.rate * 100, 2)}%` : '';
    const count = v.count !== undefined ? String(v.count) : '';
    const primary = p95 || rate || count || avg || '-';
    cards += `<div class="card"><h3>${name}</h3><p class="val">${primary}</p><p class="sub">avg ${avg || '-'} · count ${count || '-'}</p></div>`;
  }

  let threshRows = '';
  const thresh = data.thresholds || {};
  const threshKeys = Object.keys(thresh);
  for (let i = 0; i < threshKeys.length; i += 1) {
    const k = threshKeys[i];
    const ok = thresh[k] && thresh[k].ok;
    threshRows += `<tr><td>${k}</td><td class="${ok ? 'ok' : 'fail'}">${ok ? 'PASS' : 'FAIL'}</td></tr>`;
  }

  let consoleBlock = '';
  try {
    consoleBlock = textSummary(data, { indent: ' ', enableColors: false });
  } catch (e) {
    consoleBlock = String(e);
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<title>LiturgyFlow k6 - ${scenarioName}</title>
<style>
  :root { --bg:#0f1419; --card:#1a2332; --text:#e7ecf3; --muted:#8b9bb4; --ok:#3ecf8e; --fail:#f07178; }
  body { font-family: "IBM Plex Sans", system-ui, sans-serif; background:var(--bg); color:var(--text); margin:0; padding:2rem; }
  h1 { font-weight:600; letter-spacing:-.02em; }
  .meta { color:var(--muted); margin-bottom:2rem; }
  .grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(180px,1fr)); gap:1rem; }
  .card { background:var(--card); border-radius:12px; padding:1rem 1.1rem; }
  .card h3 { margin:0; font-size:.75rem; text-transform:uppercase; letter-spacing:.06em; color:var(--muted); }
  .val { font-size:1.45rem; margin:.35rem 0; font-variant-numeric:tabular-nums; }
  .sub { margin:0; font-size:.8rem; color:var(--muted); }
  table { width:100%; border-collapse:collapse; margin-top:2rem; background:var(--card); border-radius:12px; overflow:hidden; }
  th, td { text-align:left; padding:.65rem 1rem; border-bottom:1px solid #243044; font-size:.9rem; }
  .ok { color:var(--ok); } .fail { color:var(--fail); }
  pre { background:var(--card); padding:1rem; border-radius:12px; overflow:auto; font-size:.75rem; }
</style>
</head>
<body>
  <h1>LiturgyFlow performance - ${scenarioName}</h1>
  <p class="meta">Generated ${new Date().toISOString()} · k6 summary</p>
  <div class="grid">${cards}</div>
  <h2>Thresholds</h2>
  <table><thead><tr><th>Threshold</th><th>Result</th></tr></thead><tbody>${threshRows || '<tr><td colspan="2">None</td></tr>'}</tbody></table>
  <h2>Console summary</h2>
  <pre>${consoleBlock}</pre>
</body>
</html>`;
};

export function writeReports(data, scenarioName) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const base = `performance/reports/${scenarioName}-${stamp}`;
  const latest = `performance/reports/${scenarioName}`;

  const summaryJson = JSON.stringify(data, null, 2);
  const html = buildHtml(data, scenarioName);
  const csv = buildCsv(data);
  let consoleText = '';
  try {
    consoleText = textSummary(data, { indent: ' ', enableColors: false });
  } catch (e) {
    consoleText = String(e);
  }

  const files = {};
  files[`${latest}-summary.json`] = summaryJson;
  files[`${latest}-summary.html`] = html;
  files[`${latest}-metrics.csv`] = csv;
  files[`${latest}-console.txt`] = consoleText;
  files[`${base}-summary.json`] = summaryJson;
  files[`${base}-summary.html`] = html;
  files[`${base}-metrics.csv`] = csv;
  return files;
}
