// Tiny zero-dependency server: serves the built PWA (dist/) AND a small content
// API backed by a JSON file on a persistent volume (DATA_DIR). The gabbai edits
// content via /admin.html with a password (GABBAI_PASSWORD) — no code, no tokens.
//
//   GET  /api/content        → current community content (falls back to the
//                              bundled default shipped in dist/data.json)
//   POST /api/content        → save content (requires header x-admin-key)
//   POST /api/login          → validate the gabbai password
//   everything else          → static file from dist/, SPA fallback to index.html
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;
const DIST = path.join(__dirname, 'dist');
const DATA_DIR = process.env.DATA_DIR || '/data';
const DATA_FILE = path.join(DATA_DIR, 'content.json');
const SEED_FILE = path.join(DIST, 'data.json'); // bundled default content
const ADMIN_KEY = process.env.GABBAI_PASSWORD || '';

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

function readContent() {
  try {
    if (fs.existsSync(DATA_FILE)) return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch { /* fall through to seed */ }
  try {
    if (fs.existsSync(SEED_FILE)) return JSON.parse(fs.readFileSync(SEED_FILE, 'utf8'));
  } catch { /* ignore */ }
  return {};
}

function writeContent(obj) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(obj, null, 2) + '\n', 'utf8');
}

// Only these fields are gabbai-editable; everything else is computed live.
const EDITABLE = ['shiur_topic', 'messages', 'kidush', 'dvar_torah', 'dvar_source', 'is_summer'];

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
    filePath = path.join(DIST, 'index.html'); // SPA fallback
  }
  const ext = path.extname(filePath).toLowerCase();
  const headers = { 'Content-Type': MIME[ext] || 'application/octet-stream' };
  const base = path.basename(filePath);
  if (base === 'sw.js' || base === 'index.html') headers['Cache-Control'] = 'no-cache';
  fs.readFile(filePath, (err, buf) => {
    if (err) { res.writeHead(500); res.end('Server error'); return; }
    res.writeHead(200, headers);
    res.end(buf);
  });
}

const server = http.createServer(async (req, res) => {
  const url = (req.url || '/').split('?')[0];

  if (url === '/api/content' && req.method === 'GET') {
    return sendJSON(res, 200, readContent());
  }

  if (url === '/api/login' && req.method === 'POST') {
    try {
      const { password } = JSON.parse(await readBody(req) || '{}');
      if (ADMIN_KEY && password === ADMIN_KEY) return sendJSON(res, 200, { ok: true });
      return sendJSON(res, 401, { ok: false });
    } catch { return sendJSON(res, 400, { ok: false }); }
  }

  if (url === '/api/content' && req.method === 'POST') {
    try {
      // Auth key travels in the JSON body (not an HTTP header) so a non-ASCII
      // password (e.g. Hebrew) works — headers can't carry chars outside latin1.
      const { _key, ...incoming } = JSON.parse(await readBody(req) || '{}');
      if (!ADMIN_KEY || _key !== ADMIN_KEY) return sendJSON(res, 401, { error: 'unauthorized' });
      const current = readContent();
      const next = { ...current };
      for (const k of EDITABLE) if (k in incoming) next[k] = incoming[k];
      writeContent(next);
      return sendJSON(res, 200, { ok: true, content: next });
    } catch (e) { return sendJSON(res, 400, { error: String(e.message || e) }); }
  }

  return serveStatic(req, res);
});

server.listen(PORT, () => console.log(`shabbat-schedule listening on ${PORT}, data at ${DATA_FILE}`));
