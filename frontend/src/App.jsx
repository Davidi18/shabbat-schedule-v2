import { useMemo, useState, useEffect } from 'react';
import Header from './components/Header';
import Countdown from './components/Countdown';
import MessagesCard from './components/MessagesCard';
import Timeline from './components/Timeline';
import DvarTorah from './components/DvarTorah';
import ActionButtons from './components/ActionButtons';
import ShareImage from './components/ShareImage';
import Donations from './components/Donations';
import UpcomingDays from './components/UpcomingDays';
import ZmanimPanel from './components/ZmanimPanel';
import OmerCounter from './components/OmerCounter';
import { LangProvider, useLang } from './i18n';
import { LocationProvider, useLocation } from './location';
import { locationLabel } from './lib/communities';
import FastDay from './components/FastDay';
import { getShabbatData, getUpcomingDays, getDayZmanim, getOmer, getFastDay } from './lib/zmanim';
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

  // The dvar torah rotates automatically (server picks a weekly Arukh HaShulchan
  // se'if via Sefaria) — it is not gabbai-edited. Bundled curated text remains
  // the offline/first-paint fallback until this resolves.
  const [dvar, setDvar] = useState(null);

  // Reference instant for every computation below. Refreshed whenever the page
  // is shown again (and hourly), so a PWA resumed days later recomputes for
  // today instead of the date captured at mount.
  const [now, setNow] = useState(() => new Date());

  // Refetch on mount AND whenever the page is shown again. Phones keep the PWA
  // suspended for days; without this, resuming it paints last week's content
  // until the user pulls to refresh.
  useEffect(() => {
    let alive = true;
    const load = () => {
      setNow(new Date());
      fetch('/api/content', { cache: 'no-store' })
        .then((r) => (r.ok ? r.json() : null))
        .then((live) => { if (alive && live && typeof live === 'object') setContent({ ...curated, ...live }); })
        .catch(() => {});
      fetch('/api/dvar', { cache: 'no-store' })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => { if (alive && d?.dvar_torah) setDvar(d); })
        .catch(() => {});
    };
    load();
    const onShow = () => { if (document.visibilityState === 'visible') load(); };
    document.addEventListener('visibilitychange', onShow);
    window.addEventListener('pageshow', onShow);
    const id = setInterval(load, 3600000); // hourly, for a tab left open
    return () => {
      alive = false;
      clearInterval(id);
      document.removeEventListener('visibilitychange', onShow);
      window.removeEventListener('pageshow', onShow);
    };
  }, []);

  // Times/parsha/molad are computed live, client-side, from @hebcal/core for the
  // selected location — no scraping, no stale data.json. Recomputes on change.
  // Curated (human-authored) fields are merged on top.
  const data = useMemo(() => {
    try {
      const live = getShabbatData(location, now);
      const merged = { ...content, ...live };
      // Manual is_summer override wins over the auto-detected value (as before).
      if (content.is_summer !== null && content.is_summer !== undefined) {
        merged.is_summer = content.is_summer;
      }
      // A gabbai-written description overrides the computed one (שבת נחמו,
      // שבת מברכין…); the flag tells i18n to show it verbatim, untranslated.
      if (content.description && content.description.trim()) {
        merged.description = content.description.trim();
        merged.description_manual = true;
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
  }, [location, content, dvar, now]);

  const upcoming = useMemo(() => {
    try {
      return getUpcomingDays(location, now);
    } catch {
      return [];
    }
  }, [location, now]);

  const zmanim = useMemo(() => {
    try {
      const day = data?.shabbat_date ? new Date(`${data.shabbat_date}T12:00:00`) : new Date();
      return getDayZmanim(location, day);
    } catch {
      return [];
    }
  }, [location, data]);

  const omer = useMemo(() => {
    try {
      return getOmer(location, now);
    } catch {
      return null;
    }
  }, [location, now]);

  const fastDay = useMemo(() => {
    try {
      return getFastDay(location, now);
    } catch {
      return null;
    }
  }, [location, now]);

  if (!data) {
    return (
      <div className="web-container">
        <div className="error-card">
          <div className="main-title">{t('error')}</div>
        </div>
      </div>
    );
  }

  // Chronology: a fast that falls before the upcoming Shabbat is shown above
  // the Shabbat timeline; otherwise below it.
  const fastBeforeShabbat = !!(fastDay && data.shabbat_date && fastDay.date < data.shabbat_date);

  // Don't repeat this week's Shabbat in the "coming up" strip — it's the main
  // subject of the page already (e.g. a special Shabbat named in the header).
  const upcomingDays = upcoming.filter((d) => d.date !== data.shabbat_date);

  return (
    <div className="web-container">
      <Header data={data} />
      <Countdown data={data} />
      <MessagesCard messages={data.messages} />
      <OmerCounter omer={omer} />
      <UpcomingDays days={upcomingDays} />
      {fastBeforeShabbat && <FastDay fast={fastDay} />}
      <Timeline data={data} />
      {!fastBeforeShabbat && <FastDay fast={fastDay} />}
      <ZmanimPanel zmanim={zmanim} />
      <DvarTorah data={data} />
      <ActionButtons data={data}>
        <ShareImage data={data} />
        <Donations />
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
