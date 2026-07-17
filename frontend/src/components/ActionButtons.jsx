import { useEffect, useState } from 'react';
import { useLang } from '../i18n';

// UTC timestamp for an .ics field (basic form, "…Z").
function icsStamp(iso) {
  return new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

// A downloadable calendar event for candle-lighting, with a reminder alarm 30
// min before. Opening it adds a native reminder that fires even when the app is
// closed — reliable across iOS/Android/desktop, no backend needed.
function buildIcs({ candlesIso, title }) {
  const dt = icsStamp(candlesIso);
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Orot Yisrael//Shabbat Times//HE',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:candles-${dt}@shabbat-schedule`,
    `DTSTAMP:${dt}`,
    `DTSTART:${dt}`,
    `DTEND:${dt}`,
    `SUMMARY:${title}`,
    'BEGIN:VALARM',
    'TRIGGER:-PT30M',
    'ACTION:DISPLAY',
    `DESCRIPTION:${title}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}

export default function ActionButtons({ data, children }) {
  const { t } = useLang();
  const [installEvt, setInstallEvt] = useState(null);

  // Capture the install prompt so we can offer an in-app "Install" button.
  useEffect(() => {
    const onPrompt = (e) => { e.preventDefault(); setInstallEvt(e); };
    window.addEventListener('beforeinstallprompt', onPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);

  const handleShare = async () => {
    const url = window.location.href;
    const title = document.title;
    if (navigator.share) {
      try { await navigator.share({ title, url }); } catch { /* cancelled */ }
    } else {
      window.open(`https://wa.me/?text=${encodeURIComponent(`${title}\n${url}`)}`, '_blank', 'noopener');
    }
  };

  const handleReminder = () => {
    if (!data?.candles_dt) return;
    const title = `${t('candlesFull')} ${data.candles}`;
    const blob = new Blob([buildIcs({ candlesIso: data.candles_dt, title })], {
      type: 'text/calendar;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'candle-lighting.ics';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handleInstall = async () => {
    if (!installEvt) return;
    installEvt.prompt();
    try { await installEvt.userChoice; } catch { /* dismissed */ }
    setInstallEvt(null);
  };

  return (
    <div className="action-row">
      {children}
      {data?.candles_dt && (
        <button onClick={handleReminder} className="btn-action btn-remind">
          {t('remind')}
        </button>
      )}
      {installEvt && (
        <button onClick={handleInstall} className="btn-action btn-install">
          {t('install')}
        </button>
      )}
      <button onClick={() => window.print()} className="btn-action btn-print">
        {t('print')}
      </button>
      <button onClick={handleShare} className="btn-action btn-share">
        {t('share')}
      </button>
    </div>
  );
}
