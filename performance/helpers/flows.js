import http from 'k6/http';
import { check, sleep } from 'k6';
import { ALLOW_AI_POSTER, ALLOW_EXPENSIVE, AUTO_DISCOVER, BASE_URL } from './config.js';
import {
  absoluteUrl,
  apiRequest,
  getJson,
  postJson,
} from './http.js';
import {
  aiGeneration,
  calendarLoad,
  cancelledReqs,
  checkPassRate,
  dashboardLoad,
  downloadSpeed,
  historySave,
  posterGeneration,
  pptGeneration,
  readingsLoad,
  songSearch,
} from './metrics.js';
import { yearMonthFromDate, randomSongIds } from './church.js';
import { discoverGetEndpoints, filterSafePublicGets } from './discover.js';

export function loadDashboard(token, church) {
  const home = getJson(
    '/home',
    token,
    { endpoint: 'page', name: 'dashboard_home' },
    dashboardLoad,
  );
  getJson(
    '/api/feature-flags',
    token,
    { endpoint: 'api', name: 'feature_flags' },
  );
  getJson(
    `/api/readings/${church.mass_date}?refresh=false`,
    token,
    { endpoint: 'api', name: 'readings' },
    readingsLoad,
  );
  getJson(
    '/api/platform/announcement',
    token,
    { endpoint: 'api', name: 'announcement' },
  );
  if (token) {
    getJson('/api/auth/me', token, { endpoint: 'auth', name: 'auth_me_dash' });
    getJson('/api/image-quota', token, { endpoint: 'api', name: 'image_quota' });
  }
  return home;
}

export function loadCalendar(token, church) {
  const { year, month } = yearMonthFromDate(church.mass_date);
  return getJson(
    `/api/calendar/month?year=${year}&month=${month}`,
    token,
    { endpoint: 'api', name: 'calendar_month' },
    calendarLoad,
  );
}

export function loadTodayReadings(token, church) {
  const res = getJson(
    `/api/readings/${church.mass_date}`,
    token,
    { endpoint: 'api', name: 'priest_readings' },
    readingsLoad,
  );
  getJson(
    `/api/gospel-image/${church.mass_date}`,
    token,
    { endpoint: 'api', name: 'gospel_image' },
  );
  // preview is expensive-tier; use readings_only and only when authenticated or public policy allows
  if (token || ALLOW_EXPENSIVE) {
    postJson(
      '/api/preview',
      {
        date: church.mass_date,
        readings_only: true,
        refresh: false,
        mass_language: church.mass_language || 'english',
      },
      token,
      { endpoint: 'expensive', name: 'preview_readings' },
      readingsLoad,
      (r) =>
        r.status === 401 ||
        r.status === 403 ||
        r.status === 429 ||
        (r.status >= 200 && r.status < 300),
    );
  }
  return res;
}

export function browseSongs(token, church) {
  const list = getJson(
    '/api/catalog/songs?lite=true',
    token,
    { endpoint: 'api', name: 'catalog_songs' },
    songSearch,
  );
  getJson(
    '/api/catalog/songs/whats-new',
    token,
    { endpoint: 'api', name: 'catalog_whats_new' },
    songSearch,
  );
  getJson(
    '/library/songs',
    token,
    { endpoint: 'page', name: 'library_songs_page' },
  );
  getJson(
    '/library/collections',
    token,
    { endpoint: 'page', name: 'library_collections_page' },
  );

  const picks = randomSongIds(3);
  for (const song of picks) {
    if (!token) break;
    getJson(
      `/api/catalog/songs/${encodeURIComponent(song.section)}/${encodeURIComponent(song.id)}`,
      token,
      { endpoint: 'api', name: 'catalog_song_detail' },
      songSearch,
    );
    sleep(0.1 + Math.random() * 0.4);
  }
  return list;
}

export function secretaryFlow(token, church) {
  loadCalendar(token, church);
  getJson('/mass/calendar', token, { endpoint: 'page', name: 'mass_calendar_page' });
  getJson('/today', token, { endpoint: 'page', name: 'today_page' });
  getJson(
    `/api/mass/smart-defaults?date=${church.mass_date}`,
    token,
    { endpoint: 'api', name: 'smart_defaults' },
  );
}

/**
 * Create / prepare mass → generate PPT (optional AI) → download → "history".
 * Returns URLs from generate when successful.
 */
export function sundayMassPipeline(token, church) {
  loadDashboard(token, church);
  sleep(0.3 + Math.random() * 0.7);

  // Create mass / builder surface
  getJson('/mass/builder', token, { endpoint: 'page', name: 'mass_builder' });
  postJson(
    '/api/preview',
    {
      date: church.mass_date,
      readings_only: false,
      refresh: false,
      mass_language: church.mass_language || 'english',
    },
    token,
    { endpoint: 'expensive', name: 'preview_full' },
    readingsLoad,
    (r) =>
      r.status === 401 ||
      r.status === 403 ||
      r.status === 429 ||
      (r.status >= 200 && r.status < 300),
  );

  sleep(0.5 + Math.random());

  let generateResult = null;
  if (ALLOW_EXPENSIVE) {
    const useAi = ALLOW_AI_POSTER && Math.random() < 0.35;
    const body = {
      date: church.mass_date,
      celebrant: church.celebrant,
      community_name: church.name,
      poster_template: church.theme || 'liturgical_color',
      include_social_exports: false,
      include_gospel_art: Boolean(church.include_gospel_art),
      include_ai_mass_poster: useAi,
      ai_poster_backend: church.ai_poster_backend || 'openai',
      ai_poster_style: church.ai_poster_style || 'cinematic',
      reuse_existing_poster: true,
      divider_style: church.divider_style || 'divider1',
      lotw_poster: church.lotw_poster || 'lotw1',
      lote_poster: church.lote_poster || 'lote1',
      creed_choice: church.creed_choice || 'nicene',
      our_father_choice: church.our_father_choice || 'english',
      mass_language: church.mass_language || 'english',
      include_church_logo: Boolean(church.include_church_logo),
      include_church_name: Boolean(church.include_church_name),
      songs: {
        entrance: church.songs.entrance || null,
        offertory: church.songs.offertory || null,
        communion_1: church.songs.communion_1 || null,
        communion_2: church.songs.communion_2 || null,
        recessional: church.songs.recessional || null,
        meditation: church.songs.meditation || null,
      },
    };

    const started = Date.now();
    const res = postJson(
      '/api/generate',
      body,
      token,
      { endpoint: 'expensive', name: 'generate_mass' },
      null,
      (r) =>
        r.status === 401 ||
        r.status === 403 ||
        r.status === 429 ||
        (r.status >= 200 && r.status < 300),
    );
    const elapsed = Date.now() - started;
    pptGeneration.add(elapsed);
    if (useAi) {
      aiGeneration.add(elapsed);
      posterGeneration.add(elapsed);
    } else {
      posterGeneration.add(elapsed);
    }

    if (res.status >= 200 && res.status < 300) {
      try {
        generateResult = res.json();
      } catch (e) {
        generateResult = null;
      }
    }
  } else {
    // Safe substitute: guest demo generate (PPT only, rate-limited) OR poster-exists probe
    getJson(
      `/api/poster-exists?date=${church.mass_date}&style=${encodeURIComponent(church.ai_poster_style || 'cinematic')}`,
      token,
      { endpoint: 'api', name: 'poster_exists' },
      posterGeneration,
    );
    const demo = postJson(
      '/api/demo-generate',
      {
        date: church.mass_date,
        celebrant: church.celebrant,
        our_father_choice: church.our_father_choice || 'english',
        songs: {
          entrance: church.songs.entrance || null,
          offertory: church.songs.offertory || null,
          communion_1: church.songs.communion_1 || null,
          recessional: church.songs.recessional || null,
        },
      },
      null,
      { endpoint: 'expensive', name: 'demo_generate' },
      pptGeneration,
      (r) =>
        r.status === 429 ||
        r.status === 400 ||
        (r.status >= 200 && r.status < 300),
    );
    if (demo.status >= 200 && demo.status < 300) {
      try {
        generateResult = demo.json();
      } catch (e) {
        generateResult = null;
      }
    }
  }

  // Save history — server records generate in admin/storage; client history is SPA.
  // We exercise history page + community profile touch as "save".
  const histStarted = Date.now();
  getJson('/media/history', token, { endpoint: 'page', name: 'history_page' });
  if (token) {
    postJson(
      '/api/community/profile',
      {
        community_name: church.name,
        celebrant_names: church.celebrants || [church.celebrant],
      },
      token,
      { endpoint: 'api', name: 'community_profile_save' },
      historySave,
      (r) =>
        r.status === 401 ||
        r.status === 403 ||
        r.status === 429 ||
        (r.status >= 200 && r.status < 300),
    );
  }
  historySave.add(Date.now() - histStarted);

  // Download PPT / poster if URLs present
  if (generateResult) {
    const pptx = generateResult.pptx_url || generateResult.poster_ppt_url;
    const poster = generateResult.poster_url;
    for (const u of [pptx, poster]) {
      if (!u) continue;
      const url = absoluteUrl(u);
      const dl = http.get(url, {
        tags: { endpoint: 'download', name: 'download_asset' },
        timeout: '60s',
        responseType: 'none',
      });
      downloadSpeed.add(dl.timings.duration);
      const ok = check(dl, {
        'download not 5xx': (r) => r.status < 500,
      });
      checkPassRate.add(ok);
    }
  }

  return generateResult;
}

export function mediaOfficerFlow(token, church) {
  sundayMassPipeline(token, church);
}

/** Chaos helpers **/
export function chaosCancel(token, church) {
  cancelledReqs.add(1);
  // Abort-style: issue request with 1ms timeout so k6 cancels
  try {
    http.get(`${BASE_URL}/api/readings/${church.mass_date}`, {
      timeout: '1ms',
      tags: { endpoint: 'chaos', name: 'cancel_readings' },
    });
  } catch (e) {
    cancelledReqs.add(0);
  }
}

export function chaosRefresh(token, church) {
  loadDashboard(token, church);
  loadCalendar(token, church);
}

export function chaosRetryDownload(token, church) {
  const probe = getJson(
    `/api/poster-exists?date=${church.mass_date}&style=cinematic`,
    token,
    { endpoint: 'chaos', name: 'retry_poster_probe' },
  );
  // retry same call
  getJson(
    `/api/poster-exists?date=${church.mass_date}&style=cinematic`,
    token,
    { endpoint: 'chaos', name: 'retry_poster_probe_2' },
  );
  return probe;
}

export function maybeDiscover(token, knownPaths, extrasFromSetup) {
  if (!AUTO_DISCOVER) return [];
  const extras =
    extrasFromSetup && extrasFromSetup.length
      ? extrasFromSetup
      : filterSafePublicGets(discoverGetEndpoints(), knownPaths);
  // Probe at most one lightweight path per call to avoid OpenAPI storm
  if (extras.length && Math.random() < 0.15) {
    const p = extras[Math.floor(Math.random() * Math.min(extras.length, 8))];
    // Skip known heavy or binary-ish prefixes
    if (
      !p.includes('/files/') &&
      !p.includes('/admin/') &&
      p.startsWith('/api/')
    ) {
      getJson(p, token, { endpoint: 'discover', name: 'auto_discovered' });
    }
  }
  return extras;
}
