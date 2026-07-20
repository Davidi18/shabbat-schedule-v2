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
    remind: '🔔 תזכורת להדלקת נרות',
    install: '📲 התקן אפליקציה',
    upcoming: 'בקרוב',
    shareImg: '📸 שיתוף כתמונה',
    shareImgBusy: '⏳ מכין תמונה…',
    donate: '💝 תרומה לבית הכנסת',
    donateTitle: 'תרומה לקהילת אורות ישראל',
    donatePaybox: 'תרומה מהירה ב־PayBox',
    donateBank: 'או בהעברה בנקאית',
    bankLabel: 'בנק',
    branchLabel: 'סניף',
    accountLabel: 'חשבון',
    donateCopy: '📋 העתקת פרטי החשבון',
    donateCopied: '✓ הועתק!',
    donateCopyText: (b, br, acc) => `בנק ${b}, סניף ${br}, חשבון ${acc}`,
    close: 'סגירה',
    fastSubtitle: (weekday, hdate) => `יום ${weekday}, ${hdate}`,
    fastSunsetStart: 'שקיעה ותחילת הצום',
    fastArvitNight: (name) => `ערבית של ליל ${name}`,
    fastShacharit: 'שחרית',
    fastMincha: 'מנחה (עם טלית ותפילין)',
    fastMinchaPlain: 'מנחה',
    fastEnd: 'ערבית וסיום הצום',
    fastEndHavdalah: 'ערבית וסיום הצום, הבדלה על הכוס',
    fastDawnStart: 'עלות השחר ותחילת הצום',
    zmanimTitle: 'זמני היום (שבת)',
    z_alot: 'עלות השחר', z_misheyakir: 'משיכיר', z_netz: 'נץ החמה',
    z_sofShma: 'סוף זמן ק״ש', z_sofTfilla: 'סוף זמן תפילה', z_chatzot: 'חצות היום',
    z_minchaGedola: 'מנחה גדולה', z_plag: 'פלג המנחה', z_shkia: 'שקיעה', z_tzeit: 'צאת הכוכבים',
    ytLabel: 'החג הקרוב', ytCandles: 'הדלקת נרות', ytHavdalah: 'צאת החג', ytZmanim: 'זמני החג',
    timesNote: (city, mins) => `זמנים מחושבים ל${city} · הדלקת נרות ${mins} דק׳ לפני שקיעה`,
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
    remind: '🔔 Candle-lighting reminder',
    install: '📲 Install app',
    upcoming: 'Coming up',
    shareImg: '📸 Share as image',
    shareImgBusy: '⏳ Preparing…',
    donate: '💝 Donate',
    donateTitle: 'Support Orot Yisrael',
    donatePaybox: 'Quick donation via PayBox',
    donateBank: 'Or by bank transfer',
    bankLabel: 'Bank',
    branchLabel: 'Branch',
    accountLabel: 'Account',
    donateCopy: '📋 Copy account details',
    donateCopied: '✓ Copied!',
    donateCopyText: (b, br, acc) => `Bank ${b}, Branch ${br}, Account ${acc}`,
    close: 'Close',
    fastSubtitle: (weekday, hdate) => `${weekday} · ${hdate}`,
    fastSunsetStart: 'Sunset — fast begins',
    fastArvitNight: (name) => `Arvit — ${name} evening`,
    fastShacharit: 'Shacharit',
    fastMincha: 'Mincha (with tallit & tefillin)',
    fastMinchaPlain: 'Mincha',
    fastEnd: 'Arvit — fast ends',
    fastEndHavdalah: 'Arvit — fast ends, Havdalah',
    fastDawnStart: 'Dawn — fast begins',
    zmanimTitle: 'Daily zmanim (Shabbat)',
    z_alot: 'Dawn (Alot)', z_misheyakir: 'Misheyakir', z_netz: 'Sunrise (Netz)',
    z_sofShma: 'Latest Shema', z_sofTfilla: 'Latest Shacharit', z_chatzot: 'Midday (Chatzot)',
    z_minchaGedola: 'Mincha Gedola', z_plag: 'Plag HaMincha', z_shkia: 'Sunset (Shkia)', z_tzeit: 'Nightfall (Tzeit)',
    ytLabel: 'Next festival', ytCandles: 'Candle lighting', ytHavdalah: 'Festival ends', ytZmanim: 'Festival zmanim',
    timesNote: (city, mins) => `Times computed for ${city} · candle-lighting ${mins} min before sunset`,
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
    remind: '🔔 Rappel allumage',
    install: '📲 Installer l\'app',
    upcoming: 'À venir',
    shareImg: '📸 Partager en image',
    shareImgBusy: '⏳ Préparation…',
    donate: '💝 Faire un don',
    donateTitle: 'Soutenir Orot Israël',
    donatePaybox: 'Don rapide via PayBox',
    donateBank: 'Ou par virement bancaire',
    bankLabel: 'Banque',
    branchLabel: 'Agence',
    accountLabel: 'Compte',
    donateCopy: '📋 Copier les coordonnées',
    donateCopied: '✓ Copié !',
    donateCopyText: (b, br, acc) => `Banque ${b}, Agence ${br}, Compte ${acc}`,
    close: 'Fermer',
    fastSubtitle: (weekday, hdate) => `${weekday} · ${hdate}`,
    fastSunsetStart: 'Coucher du soleil — début du jeûne',
    fastArvitNight: (name) => `Arvit — veillée de ${name}`,
    fastShacharit: "Cha'harit",
    fastMincha: "Min'ha (avec talit et téfilines)",
    fastMinchaPlain: "Min'ha",
    fastEnd: 'Arvit — fin du jeûne',
    fastEndHavdalah: 'Arvit — fin du jeûne, Havdala',
    fastDawnStart: 'Aube — début du jeûne',
    zmanimTitle: 'Zmanim du jour (Chabbat)',
    z_alot: 'Aube (Alot)', z_misheyakir: 'Misheyakir', z_netz: 'Lever (Netz)',
    z_sofShma: 'Chéma limite', z_sofTfilla: 'Amida limite', z_chatzot: 'Midi (Hatsot)',
    z_minchaGedola: 'Min\'ha Guedola', z_plag: 'Plag HaMin\'ha', z_shkia: 'Coucher (Chkia)', z_tzeit: 'Tombée de la nuit',
    ytLabel: 'Prochaine fête', ytCandles: 'Allumage', ytHavdalah: 'Fin de la fête', ytZmanim: 'Zmanim de la fête',
    timesNote: (city, mins) => `Horaires calculés pour ${city} · allumage ${mins} min avant le coucher`,
  },
};

// The parsha name shown in the title, per language.
export function parshaName(lang, data) {
  return lang === 'he' ? data.parsha : (data.parsha_en || data.parsha);
}

// Weekday display name for a given English weekday key.
export function weekdayName(lang, weekdayEn) {
  return WEEKDAYS[lang]?.[weekdayEn] || weekdayEn;
}

function monthName(lang, monthEn) {
  return HEBREW_MONTHS[lang]?.[monthEn] || monthEn;
}

// Sub-title: auto "שבת מברכין חודש X" gets translated; manual text is shown as-is.
export function descriptionText(lang, data) {
  const desc = (data.description || '').trim();
  if (lang === 'he') return desc;
  // Only the auto-generated "שבת מברכין חודש X" line gets translated; a
  // custom gabbai-written description is shown verbatim in every language.
  const isAutoMevarchim = desc.startsWith('שבת מברכין');
  if (!isAutoMevarchim) return desc;
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
