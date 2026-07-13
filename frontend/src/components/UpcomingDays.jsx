import { useLang } from '../i18n';

const LOCALE = { he: 'he-IL', en: 'en-GB', fr: 'fr-FR' };

function shortDate(iso, lang) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString(LOCALE[lang] || 'he-IL', {
    day: 'numeric', month: 'numeric',
  });
}

// A quiet "coming up" strip: holidays / Rosh Chodesh / fasts / special Shabbatot
// the community prepares for. Stays true to the app — awareness before the day.
export default function UpcomingDays({ days }) {
  const { t, lang } = useLang();
  if (!days || !days.length) return null;
  const items = days.slice(0, 6);

  return (
    <section className="upcoming" aria-label={t('upcoming')}>
      <div className="upcoming-title">
        <span className="up-orn" aria-hidden="true">✦</span> {t('upcoming')}
      </div>
      <div className="upcoming-strip">
        {items.map((d, i) => (
          <div
            key={`${d.date}-${i}`}
            className={`up-chip${d.isChag ? ' up-chag' : ''}${d.isFast ? ' up-fast' : ''}`}
          >
            <span className="up-name">{lang === 'he' ? d.he : d.en}</span>
            <span className="up-date">{shortDate(d.date, lang)}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
