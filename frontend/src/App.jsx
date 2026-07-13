import { useMemo } from 'react';
import Header from './components/Header';
import Countdown from './components/Countdown';
import MessagesCard from './components/MessagesCard';
import Timeline from './components/Timeline';
import DvarTorah from './components/DvarTorah';
import ActionButtons from './components/ActionButtons';
import { LangProvider, useLang } from './i18n';
import { getShabbatData } from './lib/zmanim';
import { getCommunity, DEFAULT_COMMUNITY } from './lib/communities';
import curated from './data/curated.json';

function AppContent() {
  const { t } = useLang();

  // Times/parsha/molad are computed live, client-side, from @hebcal/core — no
  // scraping, no stale data.json. Curated (human-authored) fields are merged on top.
  const data = useMemo(() => {
    try {
      const community = getCommunity(DEFAULT_COMMUNITY);
      const live = getShabbatData(community);
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
  }, []);

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
      <Timeline data={data} />
      <DvarTorah data={data} />
      <ActionButtons />
      <footer className="footer-shabbat">
        <span className="footer-orn">✦</span> {t('footer')} <span className="footer-orn">✦</span>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <LangProvider>
      <AppContent />
    </LangProvider>
  );
}
