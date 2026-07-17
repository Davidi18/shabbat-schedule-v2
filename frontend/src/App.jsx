import { useMemo, useState, useEffect } from 'react';
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
import OmerCounter from './components/OmerCounter';
import { LangProvider, useLang } from './i18n';
import { LocationProvider, useLocation } from './location';
import { locationLabel } from './lib/communities';
import { getShabbatData, getUpcomingDays, getDayZmanim, getNextYomTov, getOmer } from './lib/zmanim';
import curated from './data/curated.json';

function AppContent() {
  const { t, lang } = useLang();
  const { location } = useLocation();

  // Human-authored content (shiur topic, community messages, dvar torah, is_summer)
  // lives in a runtime-fetched /data.json that the gabbai edits via /admin.html.
  // A commit there auto-deploys, so edits go live with no code change. We start
  // from the bundled defaults (so the app works offline / on first paint) and
  // overlay the live file once it loads. Network-first, cache-safe fallback.
  const [content, setContent] = useState(curated);
  useEffect(() => {
    let alive = true;
    fetch('/api/content', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((live) => { if (alive && live && typeof live === 'object') setContent({ ...curated, ...live }); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  // The dvar torah rotates automatically (server picks a weekly Arukh HaShulchan
  // se'if via Sefaria) — it is not gabbai-edited. Bundled curated text remains
  // the offline/first-paint fallback until this resolves.
  const [dvar, setDvar] = useState(null);
  useEffect(() => {
    let alive = true;
    fetch('/api/dvar', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (alive && d?.dvar_torah) setDvar(d); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  // Times/parsha/molad are computed live, client-side, from @hebcal/core for the
  // selected location — no scraping, no stale data.json. Recomputes on change.
  // Curated (human-authored) fields are merged on top.
  const data = useMemo(() => {
    try {
      const live = getShabbatData(location);
      const merged = { ...content, ...live };
      // Manual is_summer override wins over the auto-detected value (as before).
      if (content.is_summer !== null && content.is_summer !== undefined) {
        merged.is_summer = content.is_summer;
      }
      // A gabbai-written description overrides the computed one (שבת מברכין…).
      if (content.description && content.description.trim()) {
        merged.description = content.description.trim();
      }
      // Weekly automatic dvar torah wins over any stale saved/bundled text.
      if (dvar?.dvar_torah) {
        merged.dvar_torah = dvar.dvar_torah;
        merged.dvar_source = dvar.dvar_source || '';
      }
      return merged;
    } catch (e) {
      console.error('zmanim engine failed', e);
      return null;
    }
  }, [location, content, dvar]);

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

  const omer = useMemo(() => {
    try {
      return getOmer(location);
    } catch {
      return null;
    }
  }, [location]);

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
      <OmerCounter omer={omer} />
      <YomTovBanner yt={yomTov} zmanim={chagZmanim} />
      <UpcomingDays days={upcoming} />
      <Timeline data={data} />
      <ZmanimPanel zmanim={zmanim} />
      <DvarTorah data={data} />
      <ActionButtons data={data}>
        <ShareImage data={data} />
      </ActionButtons>
      <footer className="footer-shabbat">
        <span className="footer-orn">✦</span> {t('footer')} <span className="footer-orn">✦</span>
      </footer>
      <div className="times-note">
        {t('timesNote', locationLabel(location, lang), location.candleMins)}
      </div>
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
