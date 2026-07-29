import { SharedArray } from 'k6/data';
import exec from 'k6/execution';

const churches = new SharedArray('churches', function () {
  return JSON.parse(open('../data/churches.json'));
});

const songs = new SharedArray('songs', function () {
  return [JSON.parse(open('../data/songs.json'))];
});

function randInt(max) {
  return Math.floor(Math.random() * max);
}

function pick(arr) {
  if (!arr || !arr.length) return null;
  return arr[randInt(arr.length)];
}

function shuffleCopy(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = randInt(i + 1);
    const t = a[i];
    a[i] = a[j];
    a[j] = t;
  }
  return a;
}

/**
 * Unique church persona per VU iteration — mutates song picks / date lightly
 * so no two iterations are identical even if the same church row is reused.
 */
export function churchForVu() {
  const vu = exec.vu.idInTest;
  const iter = exec.vu.iterationInScenario;
  const base = churches[(vu + iter * 17) % churches.length];
  const catalog = songs[0];

  const sections = ['entrance', 'offertory', 'communion', 'recessional', 'meditation'];
  const songPick = {};
  for (const sec of sections) {
    const pool = catalog[sec] || [];
    const key =
      sec === 'communion'
        ? iter % 2 === 0
          ? 'communion_1'
          : 'communion_2'
        : sec;
    if (sec === 'communion') {
      songPick.communion_1 = pick(pool) && pick(pool).id;
      songPick.communion_2 = pick(pool) && pick(pool).id;
    } else if (sec === 'meditation') {
      if (Math.random() < 0.4 && pool.length) {
        songPick.meditation = pick(pool).id;
      }
    } else {
      songPick[sec] = pool.length ? pick(pool).id : base.songs[sec];
    }
  }

  // jitter mass date within ±21 days of fixture date
  const d = new Date(`${base.mass_date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + (randInt(43) - 21));
  const massDate = d.toISOString().slice(0, 10);

  const celebrant = pick(base.celebrants) || base.celebrants[0];
  const role =
    ['media_officer', 'choir_leader', 'secretary', 'priest'][randInt(4)];

  return Object.assign({}, base, {
    mass_date: massDate,
    celebrant,
    preferred_role: role,
    songs: Object.assign({}, base.songs, songPick),
    run_seed: `${vu}-${iter}-${massDate}-${celebrant}-${songPick.entrance}`,
  });
}

export function weightedRole() {
  const r = Math.random();
  if (r < 0.4) return 'media_officer';
  if (r < 0.65) return 'choir_leader';
  if (r < 0.85) return 'secretary';
  return 'priest';
}

export function yearMonthFromDate(iso) {
  const [y, m] = iso.split('-');
  return { year: Number(y), month: Number(m) };
}

export function randomSongIds(n) {
  const catalog = songs[0];
  const all = [];
  for (const sec of Object.keys(catalog)) {
    for (const row of catalog[sec]) {
      all.push({ section: sec === 'communion' ? 'communion' : sec, id: row.id, title: row.title });
    }
  }
  return shuffleCopy(all).slice(0, n);
}

export function churchCount() {
  return churches.length;
}
