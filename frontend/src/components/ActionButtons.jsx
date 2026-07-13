import { useLang } from '../i18n';

export default function ActionButtons() {
  const { t } = useLang();

  const handleShare = async () => {
    const url = window.location.href;
    const title = document.title;
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
      } catch {
        // user cancelled the share sheet
      }
    } else {
      window.open(
        `https://wa.me/?text=${encodeURIComponent(`${title}\n${url}`)}`,
        '_blank',
        'noopener'
      );
    }
  };

  return (
    <div className="action-row">
      <button onClick={() => window.print()} className="btn-action btn-print">
        {t('print')}
      </button>
      <button onClick={handleShare} className="btn-action btn-share">
        {t('share')}
      </button>
    </div>
  );
}
