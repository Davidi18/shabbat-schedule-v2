import { useEffect, useState } from 'react';
import { useLang, weekdayName } from '../i18n';

const LOCALE = { he: 'he-IL', en: 'en-GB', fr: 'fr-FR' };

function shortDate(iso, lang) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString(LOCALE[lang] || 'he-IL', {
    day: 'numeric', month: 'numeric',
  });
}

// Upcoming fast-day schedule (Tisha B'Av, minor fasts) — appears automatically
// in the week before the fast and disappears once it ends. Times come from
// lib/zmanim.js getFastDay: zmanim computed for this year, prayer times per the
// community's customary structure. Included in the print flyer.
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
  const weekday = weekdayName(lang, fast.weekdayEn);
  const subtitle = lang === 'he'
    ? t('fastSubtitle', weekday, fast.he_date)
    : t('fastSubtitle', weekday, shortDate(fast.date, lang));

  return (
    <div className="timeline-card fast-card">
      <section className="tl-section">
        <h3 className="section-header">{name} <span className="fast-sub">· {subtitle}</span></h3>
        <div className="tl-items">
          {fast.rows.map((row) => (
            <div key={row.key} className="tl-item">
              <span className="time">{row.time}</span>
              <span className="desc">{t(row.key, name)}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
