import { useLang } from '../i18n';

// A quiet heads-up for the next festival (its entry candle-lighting + ending),
// shown only when a chag is near. Keeps the app Shabbat-first, chag-aware.
export default function YomTovBanner({ yt }) {
  const { t, lang } = useLang();
  if (!yt) return null;
  const name = lang === 'he' ? yt.he : yt.en;

  return (
    <div className="yt-banner">
      <span className="yt-ico" aria-hidden="true">🕯️</span>
      <div className="yt-body">
        <div className="yt-label">{t('ytLabel')} · <b>{name}</b></div>
        <div className="yt-times">
          <span>{t('ytCandles')} <b>{yt.candles}</b></span>
          {yt.havdalah && <span> · {t('ytHavdalah')} <b>{yt.havdalah}</b></span>}
        </div>
      </div>
    </div>
  );
}
