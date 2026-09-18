import { useEffect, useState } from 'react';
import { useLang, weekdayName } from '../i18n';

// Rosh Hashana schedule — erev plus the two days of the chag, each its own
// labeled section so the days aren't confused. It replaces the weekly Shabbat
// timeline while the chag is upcoming or under way, because a two-day yom tov
// has no motzaei-Shabbat in the middle and the ordinary card would describe
// the wrong evening entirely.
//
// Times come from lib/zmanim.js getRoshHashana: zmanim recomputed for this
// year, prayer times per the community's customary structure. Included in the
// print flyer.
export default function RoshHashana({ rosh, omitFromPrint }) {
  const { t, lang } = useLang();

  // Re-check every minute so a tab left open drops the card once the chag ends.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(id);
  }, []);

  if (!rosh || !rosh.rows?.length) return null;
  if (rosh.end_at && new Date(rosh.end_at) <= now) return null;

  const name = rosh[lang] || rosh.en;
  // The year reads as gematriya in Hebrew and as a number elsewhere.
  const year = lang === 'he' ? rosh.year_he : rosh.year_num;

  // A row with no time (kiddush, tashlich, the drasha) is a standing part of
  // the day, not an appointment — it reads as a note rather than a clock line.
  const renderRows = (rows) => (
    <div className="tl-items">
      {rows.map((row, i) => (row.note ? (
        <div key={`${row.key}-${i}`} className="note-text">{t(row.key, name)}</div>
      ) : (
        <div key={`${row.key}-${i}`} className="tl-item">
          <span className="time">{row.time}</span>
          <span className="desc">{t(row.key, name)}</span>
        </div>
      )))}
    </div>
  );

  const section = (day, headKey, weekdayEn) => {
    const rows = rosh.rows.filter((r) => r.day === day);
    if (!rows.length) return null;
    return (
      <section className="tl-section">
        <h4 className="fast-day-head">{t(headKey, weekdayName(lang, weekdayEn))}</h4>
        {renderRows(rows)}
      </section>
    );
  };

  return (
    <div className={'timeline-card fast-card rh-card' + (omitFromPrint ? ' print-omit' : '')}>
      <h3 className="section-header">
        {name} <span className="fast-sub">· {year}</span>
      </h3>
      {section('erev', 'rhErevSection', rosh.erev_weekday_en)}
      {section('day1', 'rhDay1Section', rosh.day1_weekday_en)}
      {section('day2', 'rhDay2Section', rosh.day2_weekday_en)}
    </div>
  );
}
