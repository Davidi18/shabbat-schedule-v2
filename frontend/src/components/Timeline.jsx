import { calculateMincha, calculateMinchaShabbat, calculateOrot, calculateArvit } from '../utils/timeCalc';
import { useLang, moladText } from '../i18n';

function Item({ time, label, icon, iconAnim, highlight }) {
  return (
    <div className={highlight ? 'tl-item highlight' : 'tl-item'}>
      <span className="time">{time}</span>
      {icon && <span className={`tl-icon ${iconAnim || ''}`} aria-hidden="true">{icon}</span>}
      <span className="desc">{label}</span>
    </div>
  );
}

export default function Timeline({ data }) {
  const { t, lang } = useLang();
  const isSummer = data.is_summer === true;
  const minchaErev = calculateMincha(data.candles);
  const minchaShabbat = calculateMinchaShabbat(data);
  const orot = calculateOrot(minchaShabbat);
  const arvit = calculateArvit(data.havdalah);
  const molad = moladText(lang, data);

  const infoText = data.kidush?.trim()
    ? data.kidush
    : data.shiur_topic?.trim()
      ? t('shiurNote', data.shiur_topic)
      : null;
  const infoIsBold = !!(data.kidush?.trim());

  return (
    <div className="timeline-card">
      <section className="tl-section">
        <h3 className="section-header">{t('erevShabbat')}</h3>
        <div className="tl-items">
          <Item time={data.candles} label={t('candlesFull')} icon="🕯️" iconAnim="anim-candle" highlight />
          <Item time={minchaErev} label={t('minchaErev')} />
        </div>
      </section>

      <section className="tl-section">
        <h3 className="section-header">{t('shabbatDay')}</h3>
        <div className="tl-items">
          <Item time={isSummer ? '8:00' : '7:45'} label={t('shacharit')} />
          {molad && (
            <div className="molad-note">
              <span className="molad-moon" aria-hidden="true">🌒</span>
              <span>{molad}</span>
            </div>
          )}
          <Item time={isSummer ? '9:30' : '9:15'} label={t('kidsPrayer')} />
          {infoText && (
            <div className="note-text" style={{ fontWeight: infoIsBold ? 'bold' : 'normal' }}>
              {infoText}
            </div>
          )}
          <Item time={orot} label={t('orotStudy')} />
          <Item time={minchaShabbat} label={t('minchaShabbat')} />
        </div>
      </section>

      <section className="tl-section">
        <h3 className="section-header">{t('motzash')}</h3>
        <div className="tl-items">
          <Item time={arvit} label={t('arvitMotzash')} />
          <Item time={data.havdalah} label={t('havdalah')} icon="✨" iconAnim="anim-stars" highlight />
        </div>
      </section>
    </div>
  );
}
