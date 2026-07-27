import { useLang } from '../i18n';

// Prayer-for-the-sick list (רשימת חולים לתפילה). Persistent, gabbai-managed via
// /admin.html — names stay until removed, and are cached (NetworkFirst on
// /api/content) so the list is always visible, even offline.
export default function CholimCard({ names }) {
  const { t } = useLang();
  const list = (names || []).filter((n) => n && n.trim());
  if (!list.length) return null;

  return (
    <div className="cholim-card">
      <h3 className="cholim-title">
        <span aria-hidden="true">🙏</span> {t('cholimTitle')}
      </h3>
      <ul className="cholim-names">
        {list.map((name, i) => (
          <li key={`${name}-${i}`} className="cholim-name">{name}</li>
        ))}
      </ul>
      <div className="cholim-foot">{t('cholimFoot')}</div>
    </div>
  );
}
