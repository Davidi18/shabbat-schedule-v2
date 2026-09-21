/* eslint-disable react-refresh/only-export-components */
// The language provider and the helpers that read the translation tables.
// The tables themselves live in lib/strings.js, where plain Node can reach
// them without React.
import { createContext, useContext, useEffect, useState } from 'react';
import { WEEKDAYS, HEBREW_MONTHS, translations } from './lib/strings.js';

export const LANGS = ['he', 'en', 'fr'];

// Re-exported for anything that already imports it from here.
export { translations };

// The parsha name shown in the title, per language.
export function parshaName(lang, data) {
  return lang === 'he' ? data.parsha : (data.parsha_en || data.parsha);
}

// The page headline. Normally "שבת קודש פרשת X"; a yom tov that replaces the
// weekly Shabbat (Rosh Hashana) supplies its own title key instead.
export function headlineTitle(t, lang, data) {
  if (data.title_key) return t(data.title_key, ...(data.title_args || []));
  return t('mainTitle', parshaName(lang, data));
}

// Weekday display name for a given English weekday key.
export function weekdayName(lang, weekdayEn) {
  return WEEKDAYS[lang]?.[weekdayEn] || weekdayEn;
}

function monthName(lang, monthEn) {
  return HEBREW_MONTHS[lang]?.[monthEn] || monthEn;
}

// Sub-title: auto "שבת מברכין חודש X" gets translated; manual text is shown as-is.
function mevarchimText(lang, data) {
  const monthEn = data.molad_parts?.month_en;
  const month = monthEn ? monthName(lang, monthEn) : '';
  if (lang === 'en') return month ? `Shabbat Mevarchim — Chodesh ${month}` : 'Shabbat Mevarchim';
  return month ? `Chabbat Mevarkhim — 'Hodech ${month}` : 'Chabbat Mevarkhim';
}

export function descriptionText(lang, data) {
  const desc = (data.description || '').trim();
  // Hebrew shows the computed line as-is; a gabbai-written description is
  // shown verbatim in every language.
  if (lang === 'he' || data.description_manual) return desc;
  // Rebuild the auto parts per language: special Shabbat name + mevarchim.
  const parts = [];
  if (data.special_shabbat_en || data.special_shabbat_he) {
    parts.push(data.special_shabbat_en || data.special_shabbat_he);
  }
  if (data.mevarchim) parts.push(mevarchimText(lang, data));
  if (parts.length) return parts.join(' · ');
  // Fallback for older data shapes: translate the auto-mevarchim Hebrew line.
  if (!desc.startsWith('שבת מברכין')) return desc;
  return mevarchimText(lang, data);
}

// Molad line; Hebrew uses the pre-formatted string from data.json,
// other languages are built from molad_parts (falling back to the Hebrew string).
export function moladText(lang, data) {
  const p = data.molad_parts;
  if (lang === 'he' || !p || !p.weekday_en || !p.time) return data.molad || '';
  const wd = (key) => WEEKDAYS[lang][key] || key;
  const rcDays = (p.rosh_chodesh_weekdays_en || []).map(wd);
  if (lang === 'en') {
    let line = `The molad will be on ${wd(p.weekday_en)} at ${p.time} and ${p.chalakim} chalakim`;
    if (rcDays.length) line += `; Rosh Chodesh on ${rcDays.join(' and ')}`;
    return line;
  }
  let line = `Le molad sera ${wd(p.weekday_en)} à ${p.time} et ${p.chalakim} 'halakim`;
  if (rcDays.length) line += ` ; Roch 'Hodech ${rcDays.join(' et ')}`;
  return line;
}

export function formatRemaining(lang, ms) {
  const totalMinutes = Math.floor(ms / 60000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  const parts = [];
  if (lang === 'he') {
    if (days > 0) parts.push(days === 1 ? 'יום אחד' : `${days} ימים`);
    if (hours > 0) parts.push(hours === 1 ? 'שעה אחת' : `${hours} שעות`);
    parts.push(minutes === 1 ? 'דקה אחת' : `${minutes} דקות`);
  } else if (lang === 'en') {
    if (days > 0) parts.push(days === 1 ? '1 day' : `${days} days`);
    if (hours > 0) parts.push(hours === 1 ? '1 hour' : `${hours} hours`);
    parts.push(minutes === 1 ? '1 minute' : `${minutes} minutes`);
  } else {
    if (days > 0) parts.push(days === 1 ? '1 jour' : `${days} jours`);
    if (hours > 0) parts.push(hours === 1 ? '1 heure' : `${hours} heures`);
    parts.push(minutes === 1 ? '1 minute' : `${minutes} minutes`);
  }
  return parts.join(' · ');
}

const LangContext = createContext(null);

export function LangProvider({ children }) {
  const [lang, setLang] = useState(() => {
    try {
      const saved = localStorage.getItem('lang');
      return LANGS.includes(saved) ? saved : 'he';
    } catch {
      return 'he';
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('lang', lang);
    } catch {
      // localStorage unavailable (private mode) — language just won't persist
    }
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'he' ? 'rtl' : 'ltr';
    document.title = translations[lang].pageTitle;
  }, [lang]);

  const t = (key, ...args) => {
    const value = translations[lang][key] ?? translations.he[key];
    return typeof value === 'function' ? value(...args) : value;
  };

  return (
    <LangContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LangContext.Provider>
  );
}

export function useLang() {
  return useContext(LangContext);
}
