import { useEffect, useState } from 'react';
import { useLang, weekdayName } from '../i18n';

const LOCALE = { he: 'he-IL', en: 'en-GB', fr: 'fr-FR' };

function shortDate(iso, lang) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString(LOCALE[lang] || 'he-IL', {
    day: 'numeric', month: 'numeric',
  });
}

// Upcoming fast-day schedule (Tisha B'Av, minor fasts) — appears automatically
// in the week before the fast and disappears the moment it ends. Times come
// from lib/zmanim.js getFastDay: zmanim computed for this year, prayer times
// per the community's customary structure. The eve and the fast day itself are
// rendered as separate labeled sections so the two days aren't confused.
// Included in the print flyer.
export default function FastDay({ fast }) {
  const { t, lang } = useLang();

  // Re-check every minute so a tab left open drops the card once the fast ends.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(id);
  }, []);

  if (!fast || !fast.rows?.length) return null;
  if (fast.end_at && new Date(fast.end_at) <= now) return null;

  const name = lang === 'he' ? fast.he : fast.en;
  const hdate = lang === 'he' ? fast.he_date : shortDate(fast.date, lang);
  const erevRows = fast.rows.filter((r) => r.day === 'erev');
  const dayRows = fast.rows.filter((r) => r.day !== 'erev');

  const renderRows = (rows) => (
    <div className="tl-items">
      {rows.map((row) => (
        <div key={row.key} className="tl-item">
          <span className="time">{row.time}</span>
          <span className="desc">{t(row.key, name)}</span>
        </div>
      ))}
    </div>
  );

  return (
    <div className="timeline-card fast-card">
      <h3 className="section-header">{name} <span className="fast-sub">· {hdate}</span></h3>
      {erevRows.length > 0 && (
        <section className="tl-section">
          <h4 className="fast-day-head">{t('fastErevSection', weekdayName(lang, fast.erev_weekday_en))}</h4>
          {renderRows(erevRows)}
        </section>
      )}
      <section className="tl-section">
        <h4 className="fast-day-head">{t('fastDaySection', weekdayName(lang, fast.weekdayEn))}</h4>
        {renderRows(dayRows)}
      </section>
    </div>
  );
}
