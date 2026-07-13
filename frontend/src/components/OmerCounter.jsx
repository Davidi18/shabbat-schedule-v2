import { useLang } from '../i18n';

// Sefirat HaOmer counter — only rendered in season.
export default function OmerCounter({ omer }) {
  const { lang } = useLang();
  if (!omer) return null;
  return (
    <div className="omer-chip">
      <span className="omer-ico" aria-hidden="true">🌾</span>
      <span>{lang === 'he' ? omer.he : omer.en}</span>
    </div>
  );
}
