// The archive of special-day schedules: fasts and festivals, as they were.
//
// Two stores, read together:
//   archive-seed.json  shipped with the code. Curated history — schedules
//                      transcribed from the community's printed sheets, and
//                      ones published before this archive existed. Reviewed
//                      in git like any other change.
//   <DATA_DIR>/archive.json
//                      captured by the server itself, going forward. While a
//                      special day is on the page, the server computes its
//                      schedule with the same engine the page uses and keeps
//                      the latest version; once the day has passed nothing
//                      recomputes it, so what remains is what was last shown.
//
// Entries are frozen as rendered Hebrew text, not as keys into the label
// tables, so renaming a row on the site later cannot rewrite the past.
// A curated entry always wins over a capture of the same occasion.
import fs from 'node:fs';
import path from 'node:path';

const HOUR = 60 * 60 * 1000;

let dataDir = '/data';
let seedFile = '';
let engine = null;
let lastCapture = 0;

// Where each entry came from, as the admin page says it.
export const SOURCES = {
  flyer: 'מהלוח המודפס',
  site: 'כפי שפורסם באתר',
};

export async function initArchive(dir, appDir) {
  dataDir = dir;
  seedFile = path.join(appDir, 'archive-seed.json');
  // The engine is the page's own, run here too. If it cannot be loaded the
  // archive still serves what it has; only capturing new days stops. It is not
  // allowed to take the site down with it.
  try {
    const z = await import('./src/lib/zmanim.js');
    const c = await import('./src/lib/communities.js');
    const s = await import('./src/lib/strings.js');
    engine = {
      getFastDay: z.getFastDay,
      getRoshHashana: z.getRoshHashana,
      community: c.getLocation(c.DEFAULT_LOCATION),
      he: s.translations.he,
      weekdays: s.WEEKDAYS.he,
    };
  } catch (e) {
    console.warn('archive: engine unavailable, capture disabled —', e.message);
  }
  captureNow();
}

const liveFile = () => path.join(dataDir, 'archive.json');

function readJSON(file) {
  try {
    if (file && fs.existsSync(file)) {
      const db = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (db && typeof db.entries === 'object') return db;
    }
  } catch { /* an unreadable archive is an empty one, not a crash */ }
  return { entries: {} };
}

function writeLive(db) {
  fs.mkdirSync(dataDir, { recursive: true });
  const tmp = `${liveFile()}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2) + '\n', 'utf8');
  fs.renameSync(tmp, liveFile());
}

// ── Freezing a schedule into text ───────────────────────────────────────
const slug = (s) => String(s).toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

function renderer(name) {
  const label = (key, arg) => {
    const v = engine.he[key];
    return typeof v === 'function' ? v(arg ?? name) : (v ?? key);
  };
  const row = (r) => (r.note
    ? { label: label(r.key), note: true }
    : { time: r.time, label: label(r.key) });
  const heading = (key, weekdayEn) => label(key, engine.weekdays[weekdayEn] || weekdayEn);
  return { row, heading };
}

export function snapshotFast(f) {
  const { row, heading } = renderer(f.he);
  const erev = f.rows.filter((r) => r.day === 'erev');
  const day = f.rows.filter((r) => r.day !== 'erev');
  const sections = [];
  if (erev.length) sections.push({ title: heading(f.erev_section_key || 'fastErevSection', f.erev_weekday_en), rows: erev.map(row) });
  sections.push({ title: heading(f.day_section_key || 'fastDaySection', f.weekdayEn), rows: day.map(row) });
  return {
    key: `${f.hyear}-${slug(f.en)}`,
    occasion: f.he,
    hyear: f.hyear,
    year_he: f.year_he,
    date: f.date,
    sections,
  };
}

export function snapshotRosh(r) {
  const { row, heading } = renderer(r.he);
  const section = (day, key, weekdayEn) => {
    const rows = r.rows.filter((x) => x.day === day);
    return rows.length ? { title: heading(key, weekdayEn), rows: rows.map(row) } : null;
  };
  return {
    key: `${r.year_num}-rosh-hashana`,
    occasion: r.he,
    hyear: r.year_num,
    year_he: r.year_he,
    date: r.date,
    sections: [
      section('erev', 'rhErevSection', r.erev_weekday_en),
      section('day1', 'rhDay1Section', r.day1_weekday_en),
      section('day2', 'rhDay2Section', r.day2_weekday_en),
    ].filter(Boolean),
  };
}

// What is on the page right now, as frozen entries.
export function snapshotsAt(now = new Date()) {
  if (!engine) return [];
  const out = [];
  try {
    const f = engine.getFastDay(engine.community, now);
    if (f && f.rows && f.rows.length) out.push(snapshotFast(f));
  } catch (e) { console.warn('archive: fast snapshot failed —', e.message); }
  try {
    const r = engine.getRoshHashana(engine.community, now);
    if (r) out.push(snapshotRosh(r));
  } catch (e) { console.warn('archive: rosh hashana snapshot failed —', e.message); }
  return out;
}

// ── Capturing ───────────────────────────────────────────────────────────
// Keeps the latest version of each special day currently on the page. It
// writes only when a schedule has actually changed, and keeps the moment it
// was first seen.
export function captureNow(now = new Date()) {
  const snaps = snapshotsAt(now);
  if (!snaps.length) return 0;
  const db = readJSON(liveFile());
  let changed = 0;
  for (const s of snaps) {
    const prev = db.entries[s.key];
    if (prev && JSON.stringify(prev.sections) === JSON.stringify(s.sections)) continue;
    db.entries[s.key] = {
      ...s,
      source: 'site',
      first_seen: prev?.first_seen || now.toISOString(),
      updated_at: now.toISOString(),
    };
    changed += 1;
  }
  if (changed) writeLive(db);
  return changed;
}

// Called on ordinary traffic; does real work at most once an hour, so a busy
// Friday costs nothing and a quiet week still gets seen.
export function maybeCapture() {
  const now = Date.now();
  if (now - lastCapture < HOUR) return;
  lastCapture = now;
  try { captureNow(); } catch (e) { console.warn('archive: capture failed —', e.message); }
}

// ── Reading ─────────────────────────────────────────────────────────────
export function listArchive() {
  const seed = readJSON(seedFile).entries;
  const live = readJSON(liveFile()).entries;
  const all = { ...live, ...seed };
  return Object.values(all).sort((a, b) => String(b.date).localeCompare(String(a.date)));
}
