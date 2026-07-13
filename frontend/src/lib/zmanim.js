// Client-side zmanim engine — replaces the legacy Python/Playwright scraper.
//
// Given a community profile (lib/communities.js) and a reference time, it computes
// the upcoming Shabbat's candle-lighting, havdalah, parsha, molad and Shabbat-
// Mevarchim info entirely offline via @hebcal/core. The returned object matches the
// exact shape the existing components/i18n already consume, so nothing downstream
// changes: { parsha, parsha_en, description, molad, molad_parts, mevarchim,
//            candles, havdalah, is_summer }.
//
// Curated, human-authored fields (dvar_torah, shiur_topic, messages, …) are NOT
// computed here — they come from src/data/curated.json and are merged in App.

import { HebrewCalendar, Location, Molad, flags } from '@hebcal/core';

const EN_WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const HEB_WEEKDAYS = {
  Sunday: 'ראשון', Monday: 'שני', Tuesday: 'שלישי', Wednesday: 'רביעי',
  Thursday: 'חמישי', Friday: 'שישי', Saturday: 'שבת',
};
const HEB_MONTHS = {
  Nisan: 'ניסן', Iyyar: 'אייר', Sivan: 'סיון', Tamuz: 'תמוז', Av: 'אב', Elul: 'אלול',
  Tishrei: 'תשרי', Cheshvan: 'חשון', Kislev: 'כסלו', Tevet: 'טבת', "Sh'vat": 'שבט',
  Adar: 'אדר', 'Adar I': 'אדר א׳', 'Adar II': 'אדר ב׳',
};

const stripNikud = (s) => (s || '').replace(/[֑-ׇ]/g, '');
const pad2 = (n) => String(n).padStart(2, '0');

function locationOf(c) {
  return new Location(
    c.lat, c.lng, c.il, c.tz,
    c.cityEn || c.en || c.cityHe || c.he,
    c.cc || (c.il ? 'IL' : 'US'),
    c.geonameid, c.elevation || 0,
  );
}

function fmtTime(date, tz) {
  return date.toLocaleTimeString('en-GB', {
    timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false,
  });
}

// Local wall-clock UTC-offset (minutes) for a tz at a given instant.
function tzOffsetMin(date, tz) {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
  const p = dtf.formatToParts(date).reduce((a, x) => { a[x.type] = x.value; return a; }, {});
  const asUTC = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return (asUTC - date.getTime()) / 60000;
}

// DST (Israeli "summer time") active on the given instant — mirrors scrape.py's
// detect_is_summer: compares the tz offset now vs. January (standard time).
function detectIsSummer(date, tz) {
  const jan = new Date(Date.UTC(date.getUTCFullYear(), 0, 1, 12, 0, 0));
  return tzOffsetMin(date, tz) > tzOffsetMin(jan, tz);
}

const sameGregDay = (a, b) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

// Upcoming Rosh Chodesh within a week after the given Shabbat → the month being
// blessed (Shabbat Mevarchim). Elul does NOT bless Tishrei, so that case is
// excluded. Returns null when the Shabbat is not Shabbat Mevarchim.
function findMevarchim(satHD) {
  let firstDay = null;
  for (let i = 1; i <= 7; i++) {
    const d = satHD.add(i, 'd');
    if (d.getDate() === 1) { firstDay = d; break; }
  }
  if (!firstDay) return null;
  const monthEn = firstDay.getMonthName();
  if (monthEn === 'Tishrei') return null; // Elul does not bless Tishrei

  // Rosh Chodesh can be 1 or 2 days (a preceding 30th).
  const rcHDs = [];
  const prev = firstDay.add(-1, 'd');
  if (prev.getDate() === 30) rcHDs.push(prev);
  rcHDs.push(firstDay);

  return {
    monthEn,
    monthHe: HEB_MONTHS[monthEn] || monthEn,
    year: firstDay.getFullYear(),
    monthNum: firstDay.getMonth(),
    rcWeekdaysEn: rcHDs.map((d) => EN_WEEKDAYS[d.greg().getDay()]),
    rcGreg: rcHDs.map((d) => d.greg()),
  };
}

function roshChodeshHe(rcWeekdaysEn) {
  const names = rcWeekdaysEn.map((en) => HEB_WEEKDAYS[en]).filter(Boolean);
  if (!names.length) return '';
  if (names.length === 1) return names[0] === 'שבת' ? 'ראש חודש בשבת' : `ראש חודש ביום ${names[0]}`;
  return `ראש חודש בימים ${names[0]} ו${names[1]}`;
}

function buildMolad(mev) {
  const molad = new Molad(mev.year, mev.monthNum);
  const dow = molad.getDow();
  const weekdayEn = EN_WEEKDAYS[dow];
  const time = `${molad.getHour()}:${pad2(molad.getMinutes())}`;
  const chalakim = molad.getChalakim();

  const molad_parts = {
    month_en: mev.monthEn,
    month_he: mev.monthHe,
    weekday_en: weekdayEn,
    time,
    chalakim,
    rosh_chodesh_weekdays_en: mev.rcWeekdaysEn,
  };

  let line = `המולד יהיה ביום ${HEB_WEEKDAYS[weekdayEn]}, בשעה ${time} ו-${chalakim} חלקים`;
  const rc = roshChodeshHe(mev.rcWeekdaysEn);
  if (rc) line += `, ${rc}`;

  return { molad: line, molad_parts };
}

/**
 * Compute the upcoming Shabbat's live times for a community.
 * @param {object} community - a profile from lib/communities.js
 * @param {Date} [now] - reference instant (defaults to real now)
 * @returns {object} data in the shape the UI consumes (no curated fields)
 */
export function getShabbatData(community, now = new Date()) {
  const loc = locationOf(community);
  const start = new Date(now.getTime() - 2 * 86400000);
  const end = new Date(now.getTime() + 13 * 86400000);

  const events = HebrewCalendar.calendar({
    start, end, location: loc,
    candlelighting: true,
    candleLightingMins: community.candleMins,
    il: community.il,
    sedrot: true,
    useElevation: !!community.useElevation,
  });

  const havdalahEvents = events.filter((e) => e.getDesc() === 'Havdalah' && e.eventTime);
  // The Shabbat we care about: the next one whose havdalah hasn't passed yet.
  const target =
    havdalahEvents.find((e) => e.eventTime.getTime() >= now.getTime()) ||
    havdalahEvents[havdalahEvents.length - 1];

  if (!target) return { candles: '--:--', havdalah: '--:--', parsha: 'שבת שלום', parsha_en: 'Shabbat' };

  const satHD = target.getDate();
  const satGreg = satHD.greg();
  const friGreg = satHD.add(-1, 'd').greg();

  const candleEvt = events.find(
    (e) => e.getDesc() === 'Candle lighting' && e.eventTime && sameGregDay(e.getDate().greg(), friGreg),
  );
  const parshaEvt = events.find(
    (e) => (e.getFlags() & flags.PARSHA_HASHAVUA) && sameGregDay(e.getDate().greg(), satGreg),
  );

  const candles = candleEvt ? fmtTime(candleEvt.eventTime, community.tz) : '--:--';
  const havdalah = fmtTime(target.eventTime, community.tz);

  let parsha = 'שבת שלום';
  let parsha_en = 'Shabbat';
  if (parshaEvt) {
    parsha = stripNikud(parshaEvt.render('he')).replace(/^פרשת\s*/, '').trim();
    parsha_en = parshaEvt.render('en').replace(/^Parashat\s*/, '').trim();
  }

  const mev = findMevarchim(satHD);
  const moladInfo = mev ? buildMolad(mev) : { molad: '', molad_parts: null };
  const description = mev ? `שבת מברכין חודש ${mev.monthHe}` : '';

  return {
    parsha,
    parsha_en,
    description,
    molad: moladInfo.molad,
    molad_parts: moladInfo.molad_parts,
    mevarchim: !!mev,
    candles,
    havdalah,
    is_summer: detectIsSummer(friGreg, community.tz),
    shabbat_date: satGreg.toISOString().slice(0, 10),
  };
}
