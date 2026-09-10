import { useLang, headlineTitle, descriptionText } from '../i18n';
import LanguageToggle from './LanguageToggle';

export default function Header({ data }) {
  const { t, lang } = useLang();
  const description = descriptionText(lang, data);

  return (
    <header className="hero">
      <div className="hero-top">
        <span className="bsd">בס"ד</span>
        <LanguageToggle />
        <img
          src="logo.jpg"
          alt="Logo"
          className="logo-img"
          onError={(e) => { e.target.style.display = 'none'; }}
        />
      </div>

      <div className="hero-body">
        <h1 className="main-title">{headlineTitle(t, lang, data)}</h1>
        <div className="hero-ornament" aria-hidden="true">✦</div>
        {description && <div className="sub-title">{description}</div>}
        <div className="key-times">
          <span className="key-chip"><span className="anim-candle" aria-hidden="true">🕯️</span> {t('candles')} <b className="key-time">{data.candles}</b></span>
          <span className="key-chip"><span className="anim-stars" aria-hidden="true">✨</span> {t(data.end_label_key || 'havdalah')} <b className="key-time">{data.havdalah}</b></span>
        </div>
      </div>
    </header>
  );
}
