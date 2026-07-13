import { useLang } from '../i18n';

function FlagIL() {
  return (
    <svg className="lang-flag" viewBox="0 0 640 480" aria-hidden="true">
      <rect width="640" height="480" fill="#fff" />
      <rect y="55" width="640" height="70" fill="#0038b8" />
      <rect y="355" width="640" height="70" fill="#0038b8" />
      <path d="M320 148l72 124H248z" fill="none" stroke="#0038b8" strokeWidth="26" />
      <path d="M320 332l72-124H248z" fill="none" stroke="#0038b8" strokeWidth="26" />
    </svg>
  );
}

function FlagUS() {
  return (
    <svg className="lang-flag" viewBox="0 0 640 480" aria-hidden="true">
      <rect width="640" height="480" fill="#fff" />
      {[0, 2, 4, 6, 8, 10, 12].map((i) => (
        <rect key={i} y={i * (480 / 13)} width="640" height={480 / 13} fill="#b22234" />
      ))}
      <rect width="256" height={480 * (7 / 13)} fill="#3c3b6e" />
    </svg>
  );
}

function FlagFR() {
  return (
    <svg className="lang-flag" viewBox="0 0 640 480" aria-hidden="true">
      <rect width="213.3" height="480" fill="#002395" />
      <rect x="213.3" width="213.4" height="480" fill="#fff" />
      <rect x="426.7" width="213.3" height="480" fill="#ed2939" />
    </svg>
  );
}

const OPTIONS = [
  { code: 'he', name: 'עברית', Flag: FlagIL },
  { code: 'en', name: 'English', Flag: FlagUS },
  { code: 'fr', name: 'Français', Flag: FlagFR },
];

export default function LanguageToggle() {
  const { lang, setLang } = useLang();
  return (
    <div className="lang-toggle" role="group" aria-label="Language">
      {OPTIONS.map(({ code, name, Flag }) => (
        <button
          key={code}
          type="button"
          className={lang === code ? 'lang-btn active' : 'lang-btn'}
          onClick={() => setLang(code)}
          aria-pressed={lang === code}
          aria-label={name}
          title={name}
          lang={code}
        >
          <Flag />
        </button>
      ))}
    </div>
  );
}
