import { useLang } from '../i18n';

// Collapsible full daily zmanim (GRA) for the Shabbat day at the selected
// location — dawn to nightfall. On-theme: these are the halachic day-markers.
export default function ZmanimPanel({ zmanim }) {
  const { t } = useLang();
  if (!zmanim || !zmanim.length) return null;

  return (
    <details className="zmanim-panel">
      <summary className="zmanim-summary">
        <span>📿 {t('zmanimTitle')}</span>
        <span className="zmanim-caret" aria-hidden="true">▾</span>
      </summary>
      <div className="zmanim-list">
        {zmanim.map((z) => (
          <div key={z.key} className="zmanim-row">
            <span className="zmanim-name">{t(`z_${z.key}`)}</span>
            <span className="zmanim-time">{z.time}</span>
          </div>
        ))}
      </div>
    </details>
  );
}
