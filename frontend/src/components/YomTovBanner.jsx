import { useLang } from '../i18n';

// Full chag card — shown only when a festival is near. Keeps the app Shabbat-
// first, chag-aware: the festival's entry candle-lighting, its ending, and (in a
// collapsible) the chag day's full zmanim. No fabricated chag tefillot — only
// what the engine computes exactly.
export default function YomTovBanner({ yt, zmanim }) {
  const { t, lang } = useLang();
  if (!yt) return null;
  const name = lang === 'he' ? yt.he : yt.en;

  return (
    <div className="yt-card">
      <div className="yt-head">
        <span className="yt-ico" aria-hidden="true">🕯️</span>
        <div className="yt-body">
          <div className="yt-label">{t('ytLabel')}</div>
          <div className="yt-name">{name}</div>
        </div>
      </div>

      <div className="yt-times">
        <div className="yt-time">
          <span className="yt-time-label">{t('ytCandles')}</span>
          <span className="yt-time-val">{yt.candles}</span>
        </div>
        {yt.havdalah && (
          <div className="yt-time">
            <span className="yt-time-label">{t('ytHavdalah')}</span>
            <span className="yt-time-val">{yt.havdalah}</span>
          </div>
        )}
      </div>

      {zmanim && zmanim.length > 0 && (
        <details className="yt-zmanim">
          <summary>📿 {t('ytZmanim')} <span className="yt-caret" aria-hidden="true">▾</span></summary>
          <div className="yt-zmanim-list">
            {zmanim.map((z) => (
              <div key={z.key} className="yt-zmanim-row">
                <span>{t(`z_${z.key}`)}</span>
                <span className="yt-zmanim-time">{z.time}</span>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
