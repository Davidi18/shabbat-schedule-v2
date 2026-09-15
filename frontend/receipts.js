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
const MAX_AMOUNT = 1000000;

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

const isDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
const clean = (s, max) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

export function listReceipts() {
  const db = read();
  // Newest first: the book is read from the end far more often than the start.
  return db.receipts.slice().sort((a, b) => b.number - a.number);
}

export function createReceipt({ type, name, amount, date, note }, user) {
  if (!TYPES.includes(type)) return { error: 'סוג הקבלה אינו תקין' };
  const donor = clean(name, 80);
  if (!donor) return { error: 'חסר שם' };
  const sum = parseAmount(amount);
  if (sum === null) return { error: 'הסכום אינו תקין' };
  const day = isDate(date) ? date : new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' });

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

