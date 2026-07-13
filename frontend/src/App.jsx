import { useMemo } from 'react';
import Header from './components/Header';
import Countdown from './components/Countdown';
import MessagesCard from './components/MessagesCard';
import Timeline from './components/Timeline';
import DvarTorah from './components/DvarTorah';
import ActionButtons from './components/ActionButtons';
import ShareImage from './components/ShareImage';
import UpcomingDays from './components/UpcomingDays';
import ZmanimPanel from './components/ZmanimPanel';
import YomTovBanner from './components/YomTovBanner';
import { LangProvider, useLang } from './i18n';
import { LocationProvider, useLocation } from './location';
import { getShabbatData, getUpcomingDays, getDayZmanim, getNextYomTov } from './lib/zmanim';
import curated from './data/curated.json';

function AppContent() {
  const { t } = useLang();
  const { location } = useLocation();

  // Times/parsha/molad are computed live, client-side, from @hebcal/core for the
  // selected location — no scraping, no stale data.json. Recomputes on change.
  // Curated (human-authored) fields are merged on top.
  const data = useMemo(() => {
    try {
      const live = getShabbatData(location);
      const merged = { ...curated, ...live };
      // Manual is_summer override wins over the auto-detected value (as before).
      if (curated.is_summer !== null && curated.is_summer !== undefined) {
        merged.is_summer = curated.is_summer;
      }
      return merged;
    } catch (e) {
      console.error('zmanim engine failed', e);
      return null;
    }
  }, [location]);

  const upcoming = useMemo(() => {
    try {
      return getUpcomingDays(location);
    } catch {
      return [];
    }
  }, [location]);

  const yomTov = useMemo(() => {
    try {
      return getNextYomTov(location);
    } catch {
      return null;
    }
  }, [location]);

  const zmanim = useMemo(() => {
    try {
      const day = data?.shabbat_date ? new Date(`${data.shabbat_date}T12:00:00`) : new Date();
      return getDayZmanim(location, day);
    } catch {
      return [];
    }
  }, [location, data]);

  const chagZmanim = useMemo(() => {
    try {
      return yomTov?.date ? getDayZmanim(location, new Date(`${yomTov.date}T12:00:00`)) : [];
    } catch {
      return [];
    }
  }, [location, yomTov]);

  if (!data) {
    return (
      <div className="web-container">
        <div className="error-card">
          <div className="main-title">{t('error')}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="web-container">
      <Header data={data} />
      <Countdown data={data} />
      <MessagesCard messages={data.messages} />
      <YomTovBanner yt={yomTov} zmanim={chagZmanim} />
      <UpcomingDays days={upcoming} />
      <Timeline data={data} />
      <ZmanimPanel zmanim={zmanim} />
      <DvarTorah data={data} />
      <ShareImage data={data} />
      <ActionButtons data={data} />
      <footer className="footer-shabbat">
        <span className="footer-orn">✦</span> {t('footer')} <span className="footer-orn">✦</span>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <LangProvider>
      <LocationProvider>
        <AppContent />
      </LocationProvider>
    </LangProvider>
  );
}
