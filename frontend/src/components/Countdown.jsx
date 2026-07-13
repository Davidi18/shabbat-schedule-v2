import { useState, useEffect } from 'react';
import { useLang, formatRemaining } from '../i18n';

function atTime(baseDate, timeStr) {
  const d = new Date(baseDate);
  const [h, m] = timeStr.split(':').map(Number);
  d.setHours(h, m, 0, 0);
  return d;
}

// Returns { mode: 'before' | 'during', target: Date }
function getShabbatState(candles, havdalah, now) {
  const day = now.getDay(); // 0=Sunday ... 5=Friday, 6=Saturday
  if (day === 5) {
    const candleTime = atTime(now, candles);
    if (now < candleTime) return { mode: 'before', target: candleTime };
    const nextDay = new Date(now);
    nextDay.setDate(now.getDate() + 1);
    return { mode: 'during', target: atTime(nextDay, havdalah) };
  }
  if (day === 6) {
    const havdalahTime = atTime(now, havdalah);
    if (now < havdalahTime) return { mode: 'during', target: havdalahTime };
    const nextFriday = new Date(now);
    nextFriday.setDate(now.getDate() + 6);
    return { mode: 'before', target: atTime(nextFriday, candles) };
  }
  const friday = new Date(now);
  friday.setDate(now.getDate() + ((5 - day + 7) % 7));
  return { mode: 'before', target: atTime(friday, candles) };
}

export default function Countdown({ data }) {
  const { t, lang } = useLang();
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(id);
  }, []);

  if (!data.candles || !data.havdalah) return null;

  const { mode, target } = getShabbatState(data.candles, data.havdalah, now);
  const remaining = target - now;
  if (remaining <= 0) return null;

  return (
    <div className="countdown-chip">
      <span className="cd-label"><span className="anim-candle" aria-hidden="true">🕯️</span> {mode === 'during' ? t('cdDuring') : t('cdBefore')}</span>
      <span className="cd-value">{formatRemaining(lang, remaining)}</span>
    </div>
  );
}
