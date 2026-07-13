import { useRef, useState } from 'react';
import html2canvas from 'html2canvas';
import { useLang, parshaName, descriptionText } from '../i18n';
import { useLocation } from '../location';
import { locationLabel } from '../lib/communities';

// "Share as image": renders a designed, off-screen card of the week's times and
// rasterizes it to a PNG the gabbai can drop straight into the community WhatsApp.
export default function ShareImage({ data }) {
  const { t, lang } = useLang();
  const { location } = useLocation();
  const cardRef = useRef(null);
  const [busy, setBusy] = useState(false);

  const share = async () => {
    if (!cardRef.current || busy) return;
    setBusy(true);
    try {
      if (document.fonts?.ready) await document.fonts.ready;
      const canvas = await html2canvas(cardRef.current, { scale: 2, backgroundColor: null, useCORS: true });
      const blob = await new Promise((res) => canvas.toBlob(res, 'image/png'));
      const file = new File([blob], 'shabbat-times.png', { type: 'image/png' });
      const title = `${t('mainTitle', parshaName(lang, data))} · ${locationLabel(location, lang)}`;

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'shabbat-times.png';
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
    } catch (e) {
      console.error('share image failed', e);
    } finally {
      setBusy(false);
    }
  };

  const description = descriptionText(lang, data);

  return (
    <>
      <button onClick={share} className="btn-action btn-shareimg" disabled={busy}>
        {busy ? t('shareImgBusy') : t('shareImg')}
      </button>

      {/* Off-screen render target (1080×1350, WhatsApp/status friendly). */}
      <div ref={cardRef} className="share-card" aria-hidden="true">
        <div className="sc-inner">
          <div className="sc-bsd">בס"ד</div>
          <div className="sc-community">{locationLabel(location, lang)}</div>
          <div className="sc-orn">✦ ✦ ✦</div>
          <div className="sc-title">{t('mainTitle', parshaName(lang, data))}</div>
          {description && <div className="sc-sub">{description}</div>}
          <div className="sc-dates">{data.hebrew_date}</div>

          <div className="sc-times">
            <div className="sc-time-block">
              <div className="sc-time-ico">🕯️</div>
              <div className="sc-time-label">{t('candles')}</div>
              <div className="sc-time-val">{data.candles}</div>
            </div>
            <div className="sc-divider" />
            <div className="sc-time-block">
              <div className="sc-time-ico">✨</div>
              <div className="sc-time-label">{t('havdalah')}</div>
              <div className="sc-time-val">{data.havdalah}</div>
            </div>
          </div>

          <div className="sc-footer">{t('footer')}</div>
        </div>
      </div>
    </>
  );
}
