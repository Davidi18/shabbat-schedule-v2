// Tiny zero-dependency server: serves the built PWA (dist/) AND a small API
// backed by JSON files on a persistent volume (DATA_DIR). Gabbaim sign in at
// /admin.html with their own account; roles decide what each may reach.
//
//   GET  /api/content        → current community content, public (falls back to
//                              the bundled default shipped in dist/data.json)
//   GET  /api/dvar           → this week's automatic halacha (Arukh HaShulchan
//                              via Sefaria, deterministic per week, disk-cached)
//   POST /api/auth/login     → sign in, sets the session cookie
//   POST /api/auth/logout    → sign out, revokes the session
//   GET  /api/auth/me        → the signed-in account
//   POST /api/auth/password  → change your own password
//   POST /api/content        → save content            (role: content)
//   GET/POST /api/receipts   → the receipt book        (role: receipts)
//   GET/POST /api/users      → accounts and roles      (role: admin)
//   GET  /api/archive        → past special-day schedules (role: content)
//   anything else under /api → 404
//   everything else          → static file from dist/, SPA fallback to index.html
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { upcomingShabbatKey, fetchWeeklyDvar } from './dvar.js';
import {
  initAuth, login, logout, userFromRequest, sessionTokenOf, sessionCookie, clearCookie,
  clientAddr, can, publicUser, listUsers, createUser, updateUser, deleteUser, ROLES,
  changeOwnPassword, startSession,
} from './auth.js';
import { initReceipts, listReceipts, createReceipt, voidReceipt } from './receipts.js';
import { initArchive, maybeCapture, listArchive, SOURCES } from './archive.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;
const DIST = path.join(__dirname, 'dist');
const DATA_DIR = process.env.DATA_DIR || '/data';
const DATA_FILE = path.join(DATA_DIR, 'content.json');
const SEED_FILE = path.join(DIST, 'data.json'); // bundled default content

// Accounts live on the data volume. On a site that has none yet, the password
// the gabbai already uses becomes the first admin account (see auth.js).
initAuth(DATA_DIR);
initReceipts(DATA_DIR);
// Loads the zmanim engine for capturing special days. It never throws: if the
// engine cannot load, the archive serves what it already holds.
await initArchive(DATA_DIR, __dirname);

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

function readSeed() {
  try {
    if (fs.existsSync(SEED_FILE)) return JSON.parse(fs.readFileSync(SEED_FILE, 'utf8'));
  } catch { /* ignore */ }
  return {};
}

function readContent() {
  try {
    if (fs.existsSync(DATA_FILE)) return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch { /* fall through to seed */ }
  return readSeed();
}

// Weekly fields are written for a specific Shabbat and expire after it; the
// save stamps `saved_for` with that Shabbat's date. Once it passes, these
// fields fall back to the bundled defaults (shiur topic returns to its
// default, description/messages/kidush go empty). is_summer persists.
const WEEKLY = ['description', 'shiur_topic', 'messages', 'kidush', 'shiur_by_rav'];

function effectiveContent() {
  const content = readContent();
  const week = upcomingShabbatKey();
  if (!content.saved_for || content.saved_for < week) {
    const seed = readSeed();
    for (const k of WEEKLY) content[k] = seed[k] ?? '';
  }
  return content;
}

function writeContent(obj) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(obj, null, 2) + '\n', 'utf8');
}

// Only these fields are gabbai-editable; everything else is computed live.
// (dvar_torah is no longer editable — it rotates automatically via /api/dvar.)
const EDITABLE = ['shiur_topic', 'shiur_by_rav', 'messages', 'kidush', 'description', 'is_summer', 'cholim', 'mincha_shabbat'];

// Normalize the prayer-for-the-sick list to an array of trimmed, non-empty
// strings (capped) — it arrives from the admin page as a JSON array.
function cleanCholim(v) {
  if (!Array.isArray(v)) return [];
  return v.map((x) => String(x || '').trim()).filter(Boolean).slice(0, 100);
}

// ── Weekly automatic dvar torah ─────────────────────────────────────────
// Cached on the data volume so Sefaria is hit at most once per week (per
// container). In-flight promise is shared so concurrent requests don't stampede.
const DVAR_FILE = path.join(DATA_DIR, 'dvar.json');
let dvarInflight = null;

async function getDvar() {
  const week = upcomingShabbatKey();
  try {
    if (fs.existsSync(DVAR_FILE)) {
      const cached = JSON.parse(fs.readFileSync(DVAR_FILE, 'utf8'));
      if (cached.week === week && cached.dvar_torah) return cached;
    }
  } catch { /* refetch below */ }

  if (!dvarInflight) {
    dvarInflight = fetchWeeklyDvar(week).finally(() => { dvarInflight = null; });
  }
  const fresh = await dvarInflight;
  if (fresh) {
    try {
      fs.mkdirSync(DATA_DIR, { recursive: true });
      fs.writeFileSync(DVAR_FILE, JSON.stringify(fresh, null, 2) + '\n', 'utf8');
    } catch { /* cache write is best-effort */ }
    return fresh;
  }
  // Sefaria unreachable: serve last week's cached se'if rather than nothing.
  try {
    if (fs.existsSync(DVAR_FILE)) return JSON.parse(fs.readFileSync(DVAR_FILE, 'utf8'));
  } catch { /* ignore */ }
  return null;
}

// A cross-site form can send urlencoded or multipart, never application/json,
// so insisting on JSON keeps another origin from acting as a signed-in gabbai
// on the strength of the cookie alone.
function jsonRequest(req) {
  return String(req.headers['content-type'] || '').toLowerCase().startsWith('application/json');
}

function sendJSON(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = ''; let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > 256 * 1024) { reject(new Error('too large')); req.destroy(); return; }
      data += c;
    });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

function serveStatic(req, res) {
  const urlPath = decodeURIComponent((req.url.split('?')[0]) || '/');
  let rel = urlPath === '/' ? 'index.html' : urlPath.replace(/^\/+/, '');
  let filePath = path.join(DIST, rel);
  // Prevent path traversal outside dist.
  if (!filePath.startsWith(DIST)) { res.writeHead(403); res.end('Forbidden'); return; }
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    // A request for a FILE must 404, never fall back to the SPA shell. A deploy
    // empties dist and rebuilds it, so a request landing in that window used to
    // be answered with index.html — HTML, status 200 — under a .js URL. The
    // browser refuses it ("Expected a JavaScript-or-Wasm module script"), paints
    // nothing, and the service worker precaches the error page under the bundle's
    // URL, so that device stays blank long after the deploy finished.
    if (path.extname(rel)) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end('Not found');
      return;
    }
    filePath = path.join(DIST, 'index.html'); // SPA fallback — routes only
  }
  const ext = path.extname(filePath).toLowerCase();
  const headers = { 'Content-Type': MIME[ext] || 'application/octet-stream' };
  const base = path.basename(filePath);
  if (base === 'sw.js' || base === 'index.html') headers['Cache-Control'] = 'no-cache';
  // Everything under assets/ carries a content hash in its name, so it can be
  // cached forever — a new build means a new URL.
  else if (filePath.startsWith(path.join(DIST, 'assets'))) headers['Cache-Control'] = 'public, max-age=31536000, immutable';
  fs.readFile(filePath, (err, buf) => {
    if (err) { res.writeHead(500); res.end('Server error'); return; }
    res.writeHead(200, headers);
    res.end(buf);
  });
}

const server = http.createServer(async (req, res) => {
  const url = (req.url || '/').split('?')[0];

  if (url === '/api/content' && req.method === 'GET') {
    // Every page view passes through here, which makes it the natural moment
    // to notice a special day on the page. Throttled to once an hour.
    maybeCapture();
    return sendJSON(res, 200, effectiveContent());
  }

  if (url === '/api/dvar' && req.method === 'GET') {
    const dvar = await getDvar();
    return sendJSON(res, dvar ? 200 : 503, dvar || { error: 'unavailable' });
  }

  // ── Accounts ──────────────────────────────────────────────────────────
  if (url === '/api/auth/login' && req.method === 'POST') {
    if (!jsonRequest(req)) return sendJSON(res, 415, { error: 'expected application/json' });
    try {
      const { username, password } = JSON.parse(await readBody(req) || '{}');
      const result = login(username, password, clientAddr(req));
      if (result.error) return sendJSON(res, result.retry_after ? 429 : 401, { error: result.error });
      res.setHeader('Set-Cookie', sessionCookie(req, result.token));
      return sendJSON(res, 200, { user: result.user });
    } catch { return sendJSON(res, 400, { error: 'bad request' }); }
  }

  if (url === '/api/auth/logout' && req.method === 'POST') {
    logout(sessionTokenOf(req));
    res.setHeader('Set-Cookie', clearCookie(req));
    return sendJSON(res, 200, { ok: true });
  }

  if (url === '/api/auth/password' && req.method === 'POST') {
    const me = userFromRequest(req);
    if (!me) return sendJSON(res, 401, { error: 'unauthorized' });
    if (!jsonRequest(req)) return sendJSON(res, 415, { error: 'expected application/json' });
    try {
      const { current, next } = JSON.parse(await readBody(req) || '{}');
      const result = changeOwnPassword(me.id, current, next);
      if (result.error) return sendJSON(res, 400, { error: result.error });
      // The change dropped every session, this one included. Hand this
      // browser a new one so the gabbai isn't thrown out of the screen.
      res.setHeader('Set-Cookie', sessionCookie(req, startSession(me.id)));
      return sendJSON(res, 200, { ok: true });
    } catch (e) { return sendJSON(res, 400, { error: String(e.message || e) }); }
  }

  if (url === '/api/auth/me' && req.method === 'GET') {
    const user = userFromRequest(req);
    if (!user) return sendJSON(res, 401, { error: 'unauthorized' });
    return sendJSON(res, 200, { user: publicUser(user), roles_available: ROLES });
  }

  // ── Receipt book ──────────────────────────────────────────────────────
  if (url === '/api/receipts') {
    const me = userFromRequest(req);
    if (!me) return sendJSON(res, 401, { error: 'unauthorized' });
    if (!can(me, 'receipts')) return sendJSON(res, 403, { error: 'forbidden' });

    if (req.method === 'GET') {
      return sendJSON(res, 200, { receipts: listReceipts() });
    }
    if (req.method === 'POST') {
      if (!jsonRequest(req)) return sendJSON(res, 415, { error: 'expected application/json' });
      try {
        const body = JSON.parse(await readBody(req) || '{}');
        let result;
        if (body.action === 'create') result = createReceipt(body, me);
        else if (body.action === 'void') result = voidReceipt(body.number, body.reason, me);
        else return sendJSON(res, 400, { error: 'unknown action' });
        if (result.error) return sendJSON(res, 400, { error: result.error });
        return sendJSON(res, 200, { ...result, receipts: listReceipts() });
      } catch (e) { return sendJSON(res, 400, { error: String(e.message || e) }); }
    }
    return sendJSON(res, 405, { error: 'method not allowed' });
  }

  // ── Archive of special days ───────────────────────────────────────────
  if (url === '/api/archive' && req.method === 'GET') {
    const me = userFromRequest(req);
    if (!me) return sendJSON(res, 401, { error: 'unauthorized' });
    if (!can(me, 'content')) return sendJSON(res, 403, { error: 'forbidden' });
    return sendJSON(res, 200, { entries: listArchive(), sources: SOURCES });
  }

  // ── User management (admins only) ─────────────────────────────────────
  if (url === '/api/users') {
    const me = userFromRequest(req);
    if (!me) return sendJSON(res, 401, { error: 'unauthorized' });
    if (!can(me, 'admin')) return sendJSON(res, 403, { error: 'forbidden' });

    if (req.method === 'GET') return sendJSON(res, 200, { users: listUsers() });

    if (req.method === 'POST') {
      if (!jsonRequest(req)) return sendJSON(res, 415, { error: 'expected application/json' });
      try {
        const body = JSON.parse(await readBody(req) || '{}');
        // One endpoint, an explicit action, so the admin page needs no verbs
        // the old browsers in the community might mishandle.
        let result;
        if (body.action === 'create') result = createUser(body);
        else if (body.action === 'update') result = updateUser(body.id, body, me.id);
        else if (body.action === 'delete') result = deleteUser(body.id, me.id);
        else return sendJSON(res, 400, { error: 'unknown action' });
        if (result.error) return sendJSON(res, 400, { error: result.error });
        return sendJSON(res, 200, { ...result, users: listUsers() });
      } catch (e) { return sendJSON(res, 400, { error: String(e.message || e) }); }
    }
    return sendJSON(res, 405, { error: 'method not allowed' });
  }

  if (url === '/api/content' && req.method === 'POST') {
    const me = userFromRequest(req);
    if (!me) return sendJSON(res, 401, { error: 'unauthorized' });
    if (!can(me, 'content')) return sendJSON(res, 403, { error: 'forbidden' });
    if (!jsonRequest(req)) return sendJSON(res, 415, { error: 'expected application/json' });
    try {
      const incoming = JSON.parse(await readBody(req) || '{}');
      const current = effectiveContent();
      const next = { ...current };
      for (const k of EDITABLE) {
        if (!(k in incoming)) continue;
        if (k === 'cholim') next[k] = cleanCholim(incoming[k]);
        else if (k === 'shiur_by_rav') next[k] = incoming[k] !== false; // default on
        // A time or nothing; anything else would print as nonsense.
        else if (k === 'mincha_shabbat') {
          const t = String(incoming[k] || '').trim();
          next[k] = /^\d{1,2}:\d{2}$/.test(t) ? t : '';
        }
        else next[k] = incoming[k];
      }
      next.saved_for = upcomingShabbatKey(); // weekly fields are for this Shabbat
      writeContent(next);
      return sendJSON(res, 200, { ok: true, content: next });
    } catch (e) { return sendJSON(res, 400, { error: String(e.message || e) }); }
  }

  // An unmatched /api/ path is a mistake, never a page. Falling through to the
  // static handler answered it with the SPA shell instead: /api/login, removed
  // with the shared password, was still replying 200 and a page of HTML, which
  // reads like a successful sign-in to anything checking the status code.
  if (url.startsWith('/api/')) return sendJSON(res, 404, { error: 'not found' });

  return serveStatic(req, res);
});

server.listen(PORT, () => console.log(`shabbat-schedule listening on ${PORT}, data at ${DATA_FILE}`));
