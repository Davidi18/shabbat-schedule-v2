import { createContext, useContext, useEffect, useState } from 'react';

export const LANGS = ['he', 'en', 'fr'];

const WEEKDAYS = {
  he: {
    Sunday: 'ראשון', Monday: 'שני', Tuesday: 'שלישי', Wednesday: 'רביעי',
    Thursday: 'חמישי', Friday: 'שישי', Saturday: 'שבת',
  },
  en: {
    Sunday: 'Sunday', Monday: 'Monday', Tuesday: 'Tuesday', Wednesday: 'Wednesday',
    Thursday: 'Thursday', Friday: 'Friday', Saturday: 'Shabbat',
  },
  fr: {
    Sunday: 'dimanche', Monday: 'lundi', Tuesday: 'mardi', Wednesday: 'mercredi',
    Thursday: 'jeudi', Friday: 'vendredi', Saturday: 'Chabbat',
  },
};

// Keyed by Hebcal's English month spelling (from the molad memo).
const HEBREW_MONTHS = {
  en: {
    Nisan: 'Nisan', Iyyar: 'Iyar', Sivan: 'Sivan', Tamuz: 'Tammuz', Av: 'Av',
    Elul: 'Elul', Tishrei: 'Tishrei', Cheshvan: 'Cheshvan', Kislev: 'Kislev',
    Tevet: 'Tevet', "Sh'vat": 'Shevat', Adar: 'Adar', 'Adar I': 'Adar I', 'Adar II': 'Adar II',
  },
  fr: {
    Nisan: 'Nissan', Iyyar: 'Iyar', Sivan: 'Sivan', Tamuz: 'Tamouz', Av: 'Av',
    Elul: 'Eloul', Tishrei: 'Tichri', Cheshvan: "'Hechvan", Kislev: 'Kislev',
    Tevet: 'Tévet', "Sh'vat": 'Chevat', Adar: 'Adar', 'Adar I': 'Adar I', 'Adar II': 'Adar II',
  },
};

export const translations = {
  he: {
    pageTitle: 'זמני השבת - קהילת אורות ישראל',
    mainTitle: (parsha) => `שבת קודש פרשת ${parsha || 'השבוע'}`,
    candles: 'הדלקת נרות',
    havdalah: 'צאת השבת',
    candlesFull: 'הדלקת נרות שבת',
    erevShabbat: 'ערב שבת',
    shabbatDay: 'שבת קודש',
    motzash: 'מוצאי שבת',
    minchaErev: 'מנחה, קבלת שבת וערבית',
    shacharit: 'שחרית ומוסף',
    kidsPrayer: 'תפילת ילדים',
    orotStudy: 'לימוד בספר "אורות"',
    minchaShabbat: 'מנחה של שבת',
    arvitMotzash: 'ערבית של מוצאי שבת',
    shiurNote: (topic) => `שיעור מאת הרב נתנאל ב${topic} לאחר התפילה`,
    halachaBtn: 'הלכה לשבת',
    print: '🖨️ הדפס / שמור כ-PDF',
    share: '📤 שיתוף',
    footer: 'שבת שלום!',
    error: 'שגיאה בטעינת נתונים',
    cdBefore: 'שבת נכנסת בעוד',
    cdDuring: 'שבת שלום! צאת השבת בעוד',
  },
  en: {
    pageTitle: 'Shabbat Times - Orot Yisrael Community',
    mainTitle: (parsha) => (parsha ? `Shabbat Parashat ${parsha}` : 'Shabbat Kodesh'),
    candles: 'Candle lighting',
    havdalah: 'Shabbat ends',
    candlesFull: 'Shabbat candle lighting',
    erevShabbat: 'Erev Shabbat',
    shabbatDay: 'Shabbat Day',
    motzash: 'Motzaei Shabbat',
    minchaErev: 'Mincha, Kabbalat Shabbat & Arvit',
    shacharit: 'Shacharit & Musaf',
    kidsPrayer: "Children's prayer",
    orotStudy: 'Study session in "Orot"',
    minchaShabbat: 'Shabbat Mincha',
    arvitMotzash: 'Arvit (after Shabbat)',
    shiurNote: (topic) => `Shiur by Rav Netanel (${topic}) after services`,
    halachaBtn: 'Halacha for Shabbat',
    print: '🖨️ Print / Save as PDF',
    share: '📤 Share',
    footer: 'Shabbat Shalom!',
    error: 'Error loading data',
    cdBefore: 'Shabbat begins in',
    cdDuring: 'Shabbat Shalom! Shabbat ends in',
  },
  fr: {
    pageTitle: 'Horaires du Chabbat - Communauté Orot Israël',
    mainTitle: (parsha) => (parsha ? `Chabbat Paracha ${parsha}` : 'Chabbat Kodech'),
    candles: 'Allumage des bougies',
    havdalah: 'Sortie de Chabbat',
    candlesFull: 'Allumage des bougies de Chabbat',
    erevShabbat: 'Veille de Chabbat',
    shabbatDay: 'Jour de Chabbat',
    motzash: 'Samedi soir',
    minchaErev: "Min'ha, Kabbalat Chabbat et Arvit",
    shacharit: "Cha'harit et Moussaf",
    kidsPrayer: 'Office des enfants',
    orotStudy: 'Étude du livre « Orot »',
    minchaShabbat: "Min'ha de Chabbat",
    arvitMotzash: 'Arvit de fin de Chabbat',
    shiurNote: (topic) => `Cours du Rav Netanel (${topic}) après l'office`,
    halachaBtn: 'Halakha pour Chabbat',
    print: '🖨️ Imprimer / Enregistrer en PDF',
    share: '📤 Partager',
    footer: 'Chabbat Chalom !',
    error: 'Erreur de chargement des données',
    cdBefore: 'Le Chabbat commence dans',
    cdDuring: 'Chabbat Chalom ! Fin du Chabbat dans',
  },
};

// The parsha name shown in the title, per language.
export function parshaName(lang, data) {
  return lang === 'he' ? data.parsha : (data.parsha_en || data.parsha);
}

function monthName(lang, monthEn) {
  return HEBREW_MONTHS[lang]?.[monthEn] || monthEn;
}

// Sub-title: auto "שבת מברכין חודש X" gets translated; manual text is shown as-is.
export function descriptionText(lang, data) {
  const desc = (data.description || '').trim();
  if (lang === 'he') return desc;
  const isMevarchim = data.mevarchim || desc.startsWith('שבת מברכין');
  if (!isMevarchim) return desc;
  const monthEn = data.molad_parts?.month_en;
  const month = monthEn ? monthName(lang, monthEn) : '';
  if (lang === 'en') return month ? `Shabbat Mevarchim — Chodesh ${month}` : 'Shabbat Mevarchim';
  return month ? `Chabbat Mevarkhim — 'Hodech ${month}` : 'Chabbat Mevarkhim';
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
