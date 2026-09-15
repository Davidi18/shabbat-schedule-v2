// Accounts, sessions and roles for the admin area.
//
// Replaces the single shared GABBAI_PASSWORD: each gabbai gets their own
// account, so access can be granted and revoked per person and the roles
// decide which parts of the admin screen they see.
//
// Everything here is built on node:crypto — no dependencies to keep current.
//   passwords  scrypt with a per-user salt; never stored or logged in the clear
//   sessions   32 random bytes in an HttpOnly cookie, so page scripts (and any
//              XSS) cannot read it, unlike the old localStorage key. Only the
//              SHA-256 of the token is written to disk, so a leaked sessions
//              file cannot be replayed.
//   throttle   failed logins back off, per username and per address.
//
// Roles are enforced on the server for every endpoint. The admin page also
// hides what you may not use, but that is a courtesy, not the control.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64 };
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // a week, refreshed on use
const SESSION_COOKIE = 'sid';

// Every role that exists. 'admin' implies all of them (see can()).
export const ROLES = ['admin', 'content', 'receipts'];

let dataDir = '/data';
export function initAuth(dir) {
  dataDir = dir;
  ensureBootstrapUser();
}

const usersFile = () => path.join(dataDir, 'users.json');
const sessionsFile = () => path.join(dataDir, 'sessions.json');

function readJSON(file, fallback) {
  try {
    if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch { /* fall through to the default */ }
  return fallback;
}

function writeJSON(file, obj) {
  fs.mkdirSync(dataDir, { recursive: true });
  // Write beside the target and rename, so a crash mid-write cannot leave a
  // truncated accounts file and lock everyone out.
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2) + '\n', 'utf8');
  fs.renameSync(tmp, file);
}

const readUsers = () => readJSON(usersFile(), { users: [] });
const writeUsers = (db) => writeJSON(usersFile(), db);
const readSessions = () => readJSON(sessionsFile(), {});
const writeSessions = (s) => writeJSON(sessionsFile(), s);

// ── Passwords ───────────────────────────────────────────────────────────
function hashPassword(password, salt) {
  return crypto.scryptSync(password, salt, SCRYPT.keylen, {
    N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p,
    // scrypt needs roughly 128 * N * r bytes; the default cap is below that.
    maxmem: 256 * SCRYPT.N * SCRYPT.r,
  }).toString('hex');
}

export function setPassword(user, password) {
  const salt = crypto.randomBytes(16).toString('hex');
  user.salt = salt;
  user.hash = hashPassword(password, salt);
  user.updated_at = new Date().toISOString();
}

function passwordMatches(user, password) {
  if (!user || !user.salt || !user.hash) return false;
  const attempt = Buffer.from(hashPassword(password, user.salt), 'hex');
  const stored = Buffer.from(user.hash, 'hex');
  if (attempt.length !== stored.length) return false;
  return crypto.timingSafeEqual(attempt, stored);
}

// A password that is at least plausible. Length carries far more than a
// character-class rule does, so that is what we ask for.
export function passwordProblem(password) {
  if (typeof password !== 'string' || password.length < 8) {
    return 'הסיסמה חייבת להיות באורך 8 תווים לפחות';
  }
  if (password.length > 200) return 'הסיסמה ארוכה מדי';
  return null;
}

export function usernameProblem(username) {
  if (typeof username !== 'string' || !/^[a-z0-9._-]{3,32}$/i.test(username)) {
    return 'שם משתמש: 3 עד 32 תווים, אותיות באנגלית, ספרות, נקודה, מקף או קו תחתון';
  }
  return null;
}

// ── Accounts ────────────────────────────────────────────────────────────
// The password the gabbai already knows becomes a real account on first boot,
// so switching to accounts never locks anyone out of a live site.
function ensureBootstrapUser() {
  const db = readUsers();
  if (db.users.length) return;
  const password = process.env.GABBAI_PASSWORD || '';
  if (!password) {
    console.warn('auth: no users and no GABBAI_PASSWORD — nobody can sign in yet');
    return;
  }
  const user = {
    id: newId(),
    username: process.env.ADMIN_USERNAME || 'gabbai',
    name: 'גבאי',
    roles: ['admin'],
    disabled: false,
    created_at: new Date().toISOString(),
  };
  setPassword(user, password);
  db.users.push(user);
  writeUsers(db);
  console.log(`auth: created first admin "${user.username}" from GABBAI_PASSWORD — change the password and add real accounts`);
}

const newId = () => 'u_' + crypto.randomBytes(9).toString('base64url');

const findByName = (db, username) =>
  db.users.find((u) => u.username.toLowerCase() === String(username || '').toLowerCase());

// What the browser is allowed to know about an account.
export const publicUser = (u) => ({
  id: u.id, username: u.username, name: u.name, roles: u.roles, disabled: !!u.disabled,
});

export function listUsers() {
  return readUsers().users.map(publicUser);
}

export function createUser({ username, name, password, roles }) {
  const uProblem = usernameProblem(username);
  if (uProblem) return { error: uProblem };
  const pProblem = passwordProblem(password);
  if (pProblem) return { error: pProblem };
  const db = readUsers();
  if (findByName(db, username)) return { error: 'שם המשתמש כבר קיים' };
  const user = {
    id: newId(),
    username,
    name: String(name || username).trim().slice(0, 60),
    roles: cleanRoles(roles),
    disabled: false,
    created_at: new Date().toISOString(),
  };
  setPassword(user, password);
  db.users.push(user);
  writeUsers(db);
  return { user: publicUser(user) };
}

export function updateUser(id, { name, password, roles, disabled }, actingUserId) {
  const db = readUsers();
  const user = db.users.find((u) => u.id === id);
  if (!user) return { error: 'המשתמש לא נמצא' };

  if (password !== undefined && password !== '') {
    const problem = passwordProblem(password);
    if (problem) return { error: problem };
    setPassword(user, password);
    // Every existing session of that account dies with the old password.
    revokeUserSessions(id);
  }
  if (name !== undefined) user.name = String(name).trim().slice(0, 60);
  if (roles !== undefined) {
    // Never let the last admin demote themselves into a locked-out site.
    const next = cleanRoles(roles);
    if (user.roles.includes('admin') && !next.includes('admin') && countAdmins(db) <= 1) {
      return { error: 'זה המנהל האחרון — אי אפשר להסיר ממנו את ההרשאה' };
    }
    user.roles = next;
  }
  if (disabled !== undefined) {
    if (disabled && user.id === actingUserId) return { error: 'אי אפשר לנטרל את החשבון שלך' };
    if (disabled && user.roles.includes('admin') && countAdmins(db) <= 1) {
      return { error: 'זה המנהל האחרון — אי אפשר לנטרל אותו' };
    }
    user.disabled = !!disabled;
    if (user.disabled) revokeUserSessions(id);
  }
  user.updated_at = new Date().toISOString();
  writeUsers(db);
  return { user: publicUser(user) };
}

export function deleteUser(id, actingUserId) {
  if (id === actingUserId) return { error: 'אי אפשר למחוק את החשבון שלך' };
  const db = readUsers();
  const user = db.users.find((u) => u.id === id);
  if (!user) return { error: 'המשתמש לא נמצא' };
  if (user.roles.includes('admin') && countAdmins(db) <= 1) {
    return { error: 'זה המנהל האחרון — אי אפשר למחוק אותו' };
  }
  db.users = db.users.filter((u) => u.id !== id);
  writeUsers(db);
  revokeUserSessions(id);
  return { ok: true };
}

const countAdmins = (db) => db.users.filter((u) => u.roles.includes('admin') && !u.disabled).length;
const cleanRoles = (roles) => {
  const list = Array.isArray(roles) ? roles.filter((r) => ROLES.includes(r)) : [];
  return [...new Set(list)];
};

// 'admin' is not a role alongside the others so much as a role above them.
export function can(user, role) {
  if (!user) return false;
  return user.roles.includes('admin') || user.roles.includes(role);
}

// ── Login throttle ──────────────────────────────────────────────────────
// In memory: a restart clears it, which is acceptable — the cost of a restart
// to an attacker is far higher than the cost of the reset to us.
const attempts = new Map();
const THROTTLE_AFTER = 5;
const THROTTLE_MAX_MS = 15 * 60 * 1000;

function throttleWaitMs(keyStr) {
  const rec = attempts.get(keyStr);
  if (!rec || rec.count < THROTTLE_AFTER) return 0;
  const over = rec.count - THROTTLE_AFTER;
  const delay = Math.min(THROTTLE_MAX_MS, 1000 * 2 ** over);
  const waited = Date.now() - rec.last;
  return waited >= delay ? 0 : delay - waited;
}

function noteFailure(keyStr) {
  const rec = attempts.get(keyStr) || { count: 0, last: 0 };
  rec.count += 1;
  rec.last = Date.now();
  attempts.set(keyStr, rec);
}

const clearFailures = (keyStr) => attempts.delete(keyStr);

// ── Sessions ────────────────────────────────────────────────────────────
const tokenHash = (token) => crypto.createHash('sha256').update(token).digest('hex');

function pruneSessions(sessions) {
  const now = Date.now();
  let changed = false;
  for (const [k, s] of Object.entries(sessions)) {
    if (!s || s.expires_at < now) { delete sessions[k]; changed = true; }
  }
  return changed;
}

function createSession(userId) {
  const token = crypto.randomBytes(32).toString('base64url');
  const sessions = readSessions();
  pruneSessions(sessions);
  sessions[tokenHash(token)] = {
    user_id: userId,
    created_at: Date.now(),
    expires_at: Date.now() + SESSION_TTL_MS,
  };
  writeSessions(sessions);
  return token;
}

function revokeUserSessions(userId) {
  const sessions = readSessions();
  let changed = false;
  for (const [k, s] of Object.entries(sessions)) {
    if (s.user_id === userId) { delete sessions[k]; changed = true; }
  }
  if (changed) writeSessions(sessions);
}

export function login(username, password, addr) {
  const nameKey = 'u:' + String(username || '').toLowerCase();
  const addrKey = 'a:' + (addr || '?');
  const wait = Math.max(throttleWaitMs(nameKey), throttleWaitMs(addrKey));
  if (wait > 0) return { error: 'יותר מדי ניסיונות. נסה שוב בעוד ' + Math.ceil(wait / 1000) + ' שניות', retry_after: Math.ceil(wait / 1000) };

  const db = readUsers();
  const user = findByName(db, username);
  // Hash even when the user does not exist, so the reply takes the same time
  // either way and cannot be used to discover which usernames are real.
  const ok = passwordMatches(user || { salt: 'x'.repeat(32), hash: '0'.repeat(128) }, String(password || ''));
  if (!user || !ok || user.disabled) {
    noteFailure(nameKey);
    noteFailure(addrKey);
    return { error: 'שם משתמש או סיסמה שגויים' };
  }
  clearFailures(nameKey);
  clearFailures(addrKey);
  return { token: createSession(user.id), user: publicUser(user) };
}

export function logout(token) {
  if (!token) return;
  const sessions = readSessions();
  delete sessions[tokenHash(token)];
  writeSessions(sessions);
}

// The signed-in user for a request, or null. Extends a session that is in use,
// so an active gabbai is not signed out mid-edit.
export function userFromRequest(req) {
  const token = cookieValue(req, SESSION_COOKIE);
  if (!token) return null;
  const sessions = readSessions();
  const hash = tokenHash(token);
  const session = sessions[hash];
  if (!session || session.expires_at < Date.now()) {
    if (pruneSessions(sessions)) writeSessions(sessions);
    return null;
  }
  const db = readUsers();
  const user = db.users.find((u) => u.id === session.user_id);
  if (!user || user.disabled) return null;
  // Refresh only once an hour, so a busy editor doesn't rewrite the file on
  // every keystroke-triggered save.
  if (session.expires_at - Date.now() < SESSION_TTL_MS - 60 * 60 * 1000) {
    session.expires_at = Date.now() + SESSION_TTL_MS;
    writeSessions(sessions);
  }
  return user;
}

// ── Cookies ─────────────────────────────────────────────────────────────
export function cookieValue(req, name) {
  const header = req.headers.cookie;
  if (!header) return null;
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    if (part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return null;
}

// Secure is set only on https, or a local http session could never sign in.
// Behind Cloudflare the original scheme arrives in x-forwarded-proto.
function isHttps(req) {
  const proto = req.headers['x-forwarded-proto'];
  if (proto) return String(proto).split(',')[0].trim() === 'https';
  return !!req.socket.encrypted;
}

export function sessionCookie(req, token) {
  const parts = [
    `${SESSION_COOKIE}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    // Strict would drop the cookie when arriving from an external link, which
    // is how a gabbai opens the page from a WhatsApp message.
    'SameSite=Lax',
    `Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`,
  ];
  if (isHttps(req)) parts.push('Secure');
  return parts.join('; ');
}

export function clearCookie(req) {
  const parts = [`${SESSION_COOKIE}=`, 'Path=/', 'HttpOnly', 'SameSite=Lax', 'Max-Age=0'];
  if (isHttps(req)) parts.push('Secure');
  return parts.join('; ');
}

export const sessionTokenOf = (req) => cookieValue(req, SESSION_COOKIE);

// The address to throttle on. Cloudflare puts the real client in cf-connecting-ip;
// x-forwarded-for is next, and its first entry is the client.
export function clientAddr(req) {
  const cf = req.headers['cf-connecting-ip'];
  if (cf) return String(cf).trim();
  const xff = req.headers['x-forwarded-for'];
  if (xff) return String(xff).split(',')[0].trim();
  return req.socket.remoteAddress || '?';
}
