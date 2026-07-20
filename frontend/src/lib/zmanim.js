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

import { HebrewCalendar, Location, Molad, HDate, Zmanim, flags, gematriya } from '@hebcal/core';

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

  // Special Shabbat from the calendar (שבת נחמו, שבת הגדול, שקלים…), shown as
  // the subtitle; combined with Shabbat Mevarchim when both apply.
  const specialEvt = events.find(
    (e) => (e.getFlags() & flags.SPECIAL_SHABBAT) && sameGregDay(e.getDate().greg(), satGreg),
  );
  const special_shabbat_he = specialEvt ? stripNikud(specialEvt.render('he')) : '';
  const special_shabbat_en = specialEvt ? specialEvt.render('en') : '';

  const descParts = [];
  if (special_shabbat_he) descParts.push(special_shabbat_he);
  if (mev) descParts.push(`שבת מברכין חודש ${mev.monthHe}`);
  const description = descParts.join(' · ');

  // Civil (YYYY-MM-DD) date of Shabbat/Saturday in the location's timezone.
  const satCivil = new Date(target.eventTime).toLocaleDateString('en-CA', { timeZone: community.tz });

  return {
    parsha,
    parsha_en,
    description,
    special_shabbat_he,
    special_shabbat_en,
    molad: moladInfo.molad,
    molad_parts: moladInfo.molad_parts,
    mevarchim: !!mev,
    candles,
    havdalah,
    // Precise UTC instants (ISO) for calendar reminders / countdown.
    candles_dt: candleEvt ? candleEvt.eventTime.toISOString() : null,
    havdalah_dt: target.eventTime.toISOString(),
    is_summer: detectIsSummer(friGreg, community.tz),
    // Civil date of Shabbat (Saturday) in the location's timezone.
    shabbat_date: satCivil,
    // Hebrew date of Shabbat, e.g. "כ״ז בְּתַמּוּז תשפ״ו".
    hebrew_date: new HDate(new Date(`${satCivil}T12:00:00Z`)).renderGematriya(),
  };
}

// ── Upcoming special days (holidays / Rosh Chodesh / fasts / special Shabbatot)
// Stays true to the app: things the community prepares for BEFORE they arrive.
const SPECIAL_MASK =
  flags.CHAG | flags.ROSH_CHODESH | flags.MINOR_FAST | flags.MAJOR_FAST |
  flags.SPECIAL_SHABBAT | flags.CHANUKAH_CANDLES;
// hebcal lumps all civic days into MODERN_HOLIDAY (Jabotinsky/Herzl/Rabin/…).
// A religious-Zionist community only marks these four — the rest is noise.
const KEEP_MODERN = new Set(["Yom HaShoah", "Yom HaZikaron", "Yom HaAtzma'ut", 'Yom Yerushalayim']);

// Calendar (wall-clock) date of a local-midnight Date as YYYY-MM-DD.
// NOT toISOString(): that converts to UTC, which rolls local midnight back to
// the previous day anywhere east of Greenwich (e.g. all of Israel).
function localIsoDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function getUpcomingDays(community, now = new Date(), daysAhead = 60) {
  const loc = locationOf(community);
  const start = new Date(now.getTime());
  const end = new Date(now.getTime() + daysAhead * 86400000);
  const events = HebrewCalendar.calendar({
    start, end, location: loc, il: community.il,
  });

  const todayIso = localIsoDate(now);
  const seen = new Set();
  const out = [];
  for (const ev of events) {
    const f = ev.getFlags();
    const keep = (f & SPECIAL_MASK) ||
      ((f & flags.MODERN_HOLIDAY) && KEEP_MODERN.has(ev.getDesc()));
    if (!keep) continue;
    const hd = ev.getDate();
    const greg = hd.greg();
    const iso = localIsoDate(greg);
    // "Coming up" means strictly future — today's event is already here.
    if (iso <= todayIso) continue;
    const he = ev.render('he');
    const key = `${iso}|${he}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      date: iso,
      // Short Hebrew date, e.g. "י״ז בְּתַמּוּז" → "י״ז תמוז".
      he_date: `${gematriya(hd.getDate())} ${HEB_MONTHS[hd.getMonthName()] || hd.getMonthName()}`,
      weekdayEn: EN_WEEKDAYS[greg.getDay()],
      he: stripNikud(he),
      en: ev.render('en'),
      isChag: !!(ev.getFlags() & flags.CHAG),
      isFast: !!(ev.getFlags() & (flags.MINOR_FAST | flags.MAJOR_FAST)),
    });
  }
  return out;
}

// ── Full daily zmanim (GRA) for a location + date, elevation-aware.
// The Shabbat-relevant set: dawn → nightfall.
export function getDayZmanim(community, date = new Date()) {
  const loc = locationOf(community);
  const z = new Zmanim(loc, date, !!community.useElevation);
  const fmt = (fn) => {
    try {
      const d = fn();
      return d ? d.toLocaleTimeString('en-GB', {
        timeZone: community.tz, hour: '2-digit', minute: '2-digit', hour12: false,
      }) : '--:--';
    } catch { return '--:--'; }
  };
  return [
    { key: 'alot', time: fmt(() => z.alotHaShachar()) },
    { key: 'misheyakir', time: fmt(() => z.misheyakir()) },
    { key: 'netz', time: fmt(() => z.sunrise()) },
    { key: 'sofShma', time: fmt(() => z.sofZmanShma()) },
    { key: 'sofTfilla', time: fmt(() => z.sofZmanTfilla()) },
    { key: 'chatzot', time: fmt(() => z.chatzot()) },
    { key: 'minchaGedola', time: fmt(() => z.minchaGedola()) },
    { key: 'plag', time: fmt(() => z.plagHaMincha()) },
    { key: 'shkia', time: fmt(() => z.shkiah()) },
    { key: 'tzeit', time: fmt(() => z.tzeit()) },
  ];
}

// ── Next Yom Tov (festival) heads-up — the chag the community prepares for.
// Returns the upcoming festival's entry candle-lighting + its ending havdalah,
// or null when no festival is near. Regular Shabbatot are skipped.
export function getNextYomTov(community, now = new Date(), daysAhead = 40) {
  const loc = locationOf(community);
  const end = new Date(now.getTime() + daysAhead * 86400000);
  const events = HebrewCalendar.calendar({
    start: now, end, location: loc,
    candlelighting: true, candleLightingMins: community.candleMins,
    il: community.il, useElevation: !!community.useElevation,
  });

  const candles = events.filter((e) => e.getDesc() === 'Candle lighting' && e.eventTime && e.eventTime >= now);
  for (const ce of candles) {
    const nextDay = ce.getDate().add(1, 'd');
    const chag = events.find((e) => (e.getFlags() & flags.CHAG) && sameGregDay(e.getDate().greg(), nextDay.greg()));
    if (!chag) continue; // this candle-lighting is a regular Shabbat, not a festival
    const hav = events.find((e) => e.getDesc() === 'Havdalah' && e.eventTime && e.eventTime > ce.eventTime);
    return {
      he: stripNikud(chag.render('he')),
      en: chag.render('en'),
      date: localIsoDate(nextDay.greg()),
      candles: fmtTime(ce.eventTime, community.tz),
      havdalah: hav ? fmtTime(hav.eventTime, community.tz) : null,
    };
  }
  return null;
}

// ── Next fast day (Tisha B'Av / minor fasts) with the community's schedule.
// The structure mirrors the community's printed Tisha B'Av flyer, but every
// zman is recomputed for the current year:
//   Tisha B'Av — fast begins at sunset of erev; Arvit (Eicha) at nightfall
//   (+~25 min when erev is Shabbat, time to get home); Shacharit 8:00;
//   Mincha 20 min before the fast begins (rounded down to :05).
//   All fasts — Mincha 35 min before sunset (rounded down to :05; with
//   tallit & tefillin on 9 Av); Arvit and fast end together at sunset + 25
//   (rounded up to the minute; Havdalah wording on a Sunday).
//   Minor fasts begin at dawn and have no eve-Arvit or fixed Shacharit.
// Yom Kippur is excluded (a Yom Tov — covered by the chag banner); so is
// Ta'anit Bechorot (firstborn only).
const roundUp5 = (d) => new Date(Math.ceil(d.getTime() / 300000) * 300000);
const floor5 = (d) => new Date(Math.floor(d.getTime() / 300000) * 300000);
const addMin = (d, m) => new Date(d.getTime() + m * 60000);

export function getFastDay(community, now = new Date(), daysAhead = 7) {
  const loc = locationOf(community);
  const start = new Date(now.getTime() - 86400000); // catch a fast already underway
  const end = new Date(now.getTime() + daysAhead * 86400000);
  const events = HebrewCalendar.calendar({
    start, end, location: loc,
    candlelighting: true, candleLightingMins: community.candleMins,
    il: community.il, useElevation: !!community.useElevation,
  });

  const fasts = events.filter((e) => {
    const f = e.getFlags();
    if (!(f & (flags.MAJOR_FAST | flags.MINOR_FAST))) return false;
    if (e.eventTime) return false; // timed "Fast begins/ends" events carry the same flags
    const d = e.getDesc();
    return d !== 'Yom Kippur' && d !== "Ta'anit Bechorot" && !d.startsWith('Erev');
  });

  for (const fast of fasts) {
    const hd = fast.getDate();
    const dayGreg = hd.greg();
    // Timed begin/end events hebcal attaches to this fast (fall back to Zmanim).
    const tied = (desc) => events.find((e) => e.getDesc() === desc && e.eventTime &&
      (e.linkedEvent ? e.linkedEvent.getDesc() === fast.getDesc()
        : Math.abs(e.getDate().abs() - hd.abs()) <= 1));
    const begins = tied('Fast begins');
    const zDay = new Zmanim(loc, dayGreg, !!community.useElevation);
    const sunsetDay = zDay.shkiah();
    // Arvit + fast end together: sunset + 25 (reproduces the community's
    // flyers year over year; fmtTime truncates the seconds).
    const endTime = addMin(sunsetDay, 25);
    if (endTime < now) continue; // this fast is over — look further ahead

    const tz = community.tz;
    const major = !!(fast.getFlags() & flags.MAJOR_FAST);
    const rows = [];

    let erevWeekdayEn = null;
    if (major) {
      const erevGreg = hd.add(-1, 'd').greg();
      erevWeekdayEn = EN_WEEKDAYS[erevGreg.getDay()];
      const zErev = new Zmanim(loc, erevGreg, !!community.useElevation);
      const sunsetErev = begins ? begins.eventTime : zErev.shkiah();
      // Mincha ~20 min before the fast begins.
      rows.push({ key: 'fastMinchaPlain', day: 'erev', time: fmtTime(floor5(addMin(sunsetErev, -20)), tz) });
      rows.push({ key: 'fastSunsetStart', day: 'erev', time: fmtTime(sunsetErev, tz) });
      // Arvit (Eicha) shortly after sunset; after Shabbat wait for nightfall +25.
      const afterShabbat = erevGreg.getDay() === 6;
      const arvit = afterShabbat
        ? roundUp5(addMin(zErev.tzeit(), 25))
        : roundUp5(addMin(sunsetErev, 15));
      rows.push({ key: 'fastArvitNight', day: 'erev', time: fmtTime(arvit, tz) });
      rows.push({ key: 'fastShacharit', day: 'day', time: '8:00' });
    } else {
      rows.push({ key: 'fastDawnStart', day: 'day', time: fmtTime(begins ? begins.eventTime : zDay.alotHaShachar(), tz) });
    }
    // Mincha ~35 min before sunset, on a :05 mark (tallit & tefillin on 9 Av).
    rows.push({ key: major ? 'fastMincha' : 'fastMinchaPlain', day: 'day', time: fmtTime(floor5(addMin(sunsetDay, -35)), tz) });
    rows.push({ key: dayGreg.getDay() === 0 ? 'fastEndHavdalah' : 'fastEnd', day: 'day', time: fmtTime(endTime, tz) });

    return {
      he: stripNikud(fast.render('he')),
      en: fast.render('en'),
      date: localIsoDate(dayGreg),
      he_date: `${gematriya(hd.getDate())} ${HEB_MONTHS[hd.getMonthName()] || hd.getMonthName()}`,
      weekdayEn: EN_WEEKDAYS[dayGreg.getDay()],
      erev_weekday_en: erevWeekdayEn,
      major,
      rows,
      // Exact instant the fast ends — the card hides itself past this moment.
      end_at: endTime.toISOString(),
    };
  }
  return null;
}

// ── Sefirat HaOmer — the day count during the Omer (Pesach→Shavuot), else null.
export function getOmer(community, now = new Date()) {
  const loc = locationOf(community);
  const evs = HebrewCalendar.calendar({ start: now, end: now, location: loc, il: community.il, omer: true });
  const o = evs.find((e) => e.getFlags() & flags.OMER_COUNT);
  if (!o) return null;
  return { day: o.omer, he: stripNikud(o.render('he')), en: o.render('en') };
}
