// The receipt book: acknowledgements for donations and membership dues.
//
// Numbers run in one unbroken sequence and are never reused, which is the
// whole point of a receipt book — a gap or a repeat means someone cannot
// account for money. So a receipt is never deleted, only voided: the number
// stays, carrying the reason it was cancelled.
//
// These are internal acknowledgements, not receipts for a tax credit under
// section 46 — that would need the amuta's number and its approval details,
// which the community has not supplied. The printed sheet says so plainly.
import fs from 'node:fs';
import path from 'node:path';

export const TYPES = ['donation', 'membership'];
// How the money arrived. Optional: a receipt issued before this existed, or
// one where it does not matter, simply has none.
export const METHODS = ['cash', 'paybox', 'bank'];
const MAX_AMOUNT = 1000000;

// The year a membership fee is for. Dues arrive in Elul for the year about to
// begin, so a payment in Elul counts toward the next Hebrew year; any other
// month counts toward the year it is in. Intl knows the Hebrew calendar, so
// this needs no library.
const HEB_YEAR_MONTH = new Intl.DateTimeFormat('en-u-ca-hebrew', { year: 'numeric', month: 'long' });
export function duesYearFor(isoDate) {
  const parts = HEB_YEAR_MONTH.formatToParts(new Date(isoDate + 'T12:00:00Z'));
  const year = +parts.find((p) => p.type === 'year').value;
  return parts.find((p) => p.type === 'month').value === 'Elul' ? year + 1 : year;
}
const isHebrewYear = (y) => Number.isInteger(y) && y >= 5700 && y <= 6000;

let dataDir = '/data';
export function initReceipts(dir) { dataDir = dir; }

const file = () => path.join(dataDir, 'receipts.json');

function read() {
  try {
    if (fs.existsSync(file())) {
      const db = JSON.parse(fs.readFileSync(file(), 'utf8'));
      if (Array.isArray(db.receipts)) return db;
    }
  } catch { /* start a fresh book rather than crash the site */ }
  return { next_number: 1, receipts: [] };
}

function write(db) {
  fs.mkdirSync(dataDir, { recursive: true });
  // Written beside the book and renamed, so a crash mid-write cannot leave a
  // truncated ledger and lose the numbering.
  const tmp = `${file()}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2) + '\n', 'utf8');
  fs.renameSync(tmp, file());
}

// Money to the agora, kept as a number so sums stay exact enough at these
// sizes and the page can format it however it likes.
function parseAmount(value) {
  const n = typeof value === 'number' ? value : Number(String(value ?? '').replace(/[^\d.]/g, ''));
  if (!Number.isFinite(n) || n <= 0) return null;
  if (n > MAX_AMOUNT) return null;
  return Math.round(n * 100) / 100;
}

// A real calendar day. Date.parse would accept the 31st of February and roll it
// on to March, printing a date on the receipt that never happened.
const isDate = (s) => {
  const m = typeof s === 'string' && s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return false;
  const dt = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return dt.getUTCFullYear() === +m[1] && dt.getUTCMonth() === +m[2] - 1 && dt.getUTCDate() === +m[3];
};
const clean = (s, max) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

export function listReceipts() {
  const db = read();
  // Newest first: the book is read from the end far more often than the start.
  return db.receipts.slice().sort((a, b) => b.number - a.number);
}

export function createReceipt({ type, name, amount, date, note, method, membership_year }, user) {
  if (!TYPES.includes(type)) return { error: 'סוג הקבלה אינו תקין' };
  const donor = clean(name, 80);
  if (!donor) return { error: 'חסר שם' };
  const sum = parseAmount(amount);
  if (sum === null) return { error: 'הסכום אינו תקין' };
  // No date means today. A date that was given but is not a real day is an
  // error — quietly putting today on it would print a date nobody chose.
  if (date && !isDate(date)) return { error: 'התאריך אינו תקין' };
  const day = date || new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' });
  if (method && !METHODS.includes(method)) return { error: 'אמצעי התשלום אינו תקין' };
  // Dues belong to a membership year. Given, it must be a plausible Hebrew
  // year; left out, it follows the payment date. Donations have none.
  let duesYear;
  if (type === 'membership') {
    if (membership_year !== undefined && membership_year !== null && membership_year !== '') {
      duesYear = Number(membership_year);
      if (!isHebrewYear(duesYear)) return { error: 'שנת החברות אינה תקינה' };
    } else {
      duesYear = duesYearFor(day);
    }
  }

  // Read and write with nothing awaited in between, so two gabbaim issuing at
  // the same moment cannot be handed the same number.
  const db = read();
  const receipt = {
    number: db.next_number,
    type,
    name: donor,
    amount: sum,
    date: day,
    note: clean(note, 140),
    method: method || '',
    ...(duesYear ? { membership_year: duesYear } : {}),
    issued_at: new Date().toISOString(),
    issued_by: user.id,
    issued_by_name: user.name,
    voided: false,
  };
  db.receipts.push(receipt);
  db.next_number += 1;
  write(db);
  return { receipt };
}

// Cancelling keeps the number and the original details, and records who
// cancelled it and why. Nothing leaves the book.
export function voidReceipt(number, reason, user) {
  const db = read();
  const receipt = db.receipts.find((r) => r.number === Number(number));
  if (!receipt) return { error: 'הקבלה לא נמצאה' };
  if (receipt.voided) return { error: 'הקבלה כבר מבוטלת' };
  receipt.voided = true;
  receipt.void_reason = clean(reason, 140);
  receipt.voided_at = new Date().toISOString();
  receipt.voided_by = user.id;
  receipt.voided_by_name = user.name;
  write(db);
  return { receipt };
}

