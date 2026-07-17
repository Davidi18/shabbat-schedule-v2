// Weekly "halacha for Shabbat" picker — the server-side successor of the old
// scrape.py automation. Picks one se'if from Arukh HaShulchan, Orach Chaim,
// Hilchot Shabbat (simanim 242–344) via the Sefaria API. The pick is seeded by
// the upcoming Shabbat's date, so it is deterministic: every visitor (and every
// server restart) gets the same se'if for a given week, and it rotates weekly.

const SIMAN_RANGE = [242, 344];
const EXCLUDED_SIMANIM = new Set([280]);

// Keep quoted se'ifim short and readable.
const MIN_LEN = 250;
const MAX_LEN = 750;

// Curated Hebrew topic headings for Orach Chaim, Hilchot Shabbat (242–344).
// Sefaria stores no per-siman title, so this static map feeds the "מקור"
// context line. A siman missing here simply shows no heading.
const SIMAN_TITLES = {
  242: 'הכנת צרכי שבת וכבודה',
  243: 'נתינת מלאכה לאינו יהודי',
  244: 'עשיית מלאכה על ידי אינו יהודי',
  245: 'ישראל ואינו יהודי שהם שותפים',
  246: 'השאלה והשכרה לאינו יהודי',
  247: 'שילוח אגרת ביד אינו יהודי',
  248: 'היוצא בשיירא ובספינה',
  249: 'דברים האסורים בערב שבת',
  250: 'הכנת צרכי סעודה לשבת',
  251: 'עשיית מלאכה בערב שבת',
  252: 'מלאכות המותרות להתחיל בערב שבת',
  253: 'שהיית וחזרת התבשיל על הכירה',
  254: 'צליה ואפיה סמוך לחשכה',
  255: 'הדלקת אש והטמנה סמוך לחשכה',
  256: 'זמן איסור מלאכה בערב שבת',
  257: 'דיני הטמנה',
  258: 'הטמנה על גבי דבר שאין מוסיף הבל',
  259: 'הטמנה בדבר המוסיף הבל',
  260: 'דברים שצריך לעשות בערב שבת',
  261: 'בין השמשות ותוספת שבת',
  262: 'כבוד שבת במלבושים ובהצעת המיטות',
  263: 'על מי חלה חובת הדלקת נר שבת',
  264: 'הפתילות והשמנים הכשרים לנר שבת',
  265: 'דינים שונים בהדלקת הנר',
  266: 'מי שקדש עליו היום בדרך',
  267: 'סדר תפילת ליל שבת',
  268: 'דיני תפילת שבת',
  269: 'מנהג הקידוש בבית הכנסת',
  270: 'אמירת במה מדליקין',
  271: 'קידוש היום על היין',
  272: 'על איזה יין מקדשים',
  273: 'שאין קידוש אלא במקום סעודה',
  274: 'בציעת הפת בשבת',
  275: 'מה שאסור לעשות לאור הנר',
  276: 'הנאה מנר שהדליקו אינו יהודי',
  277: 'שלא לטלטל את הנר',
  278: 'כיבוי הנר מפני החולה',
  279: 'טלטול הנר בשבת',
  281: 'סדר תפילת שחרית של שבת',
  282: 'קריאת התורה בשבת',
  283: 'תפילת מוסף של שבת',
  284: 'הפטרה וברכותיה',
  285: 'שנים מקרא ואחד תרגום',
  286: 'זמן תפילת מוסף',
  287: 'ניחום אבלים וביקור חולים בשבת',
  288: 'איסור תענית בשבת',
  289: 'סדר הקידוש והסעודה ביום',
  290: 'לעסוק בתורה ובסעודה ביום השבת',
  291: 'דין סעודה שלישית',
  292: 'תפילת מנחה בשבת',
  293: 'תפילת ערבית במוצאי שבת',
  294: 'הבדלה בתפילה',
  295: 'שאין מבדילין קודם צאת הכוכבים',
  296: 'סדר הבדלה על הכוס',
  297: 'דיני בשמים בהבדלה',
  298: 'דיני נר של הבדלה',
  299: 'דברים האסורים עד שיבדיל',
  300: 'סעודת מלווה מלכה',
  301: 'באיזה דברים מותר לצאת בשבת',
  302: 'דין נקיון וקיפול הבגדים בשבת',
  303: 'במה אשה יוצאה',
  304: 'דין העבד בשבת',
  305: 'דין בהמתו בשבת',
  306: 'חפצים ודברי חול האסורים בשבת',
  307: 'דיני ממצוא חפצך ודבר דבר',
  308: 'דיני טלטול מוקצה',
  309: 'טלטול מוקצה על ידי דבר אחר',
  310: 'המשך דיני מוקצה',
  311: 'טלטול מת ומוקצה לצורך',
  312: 'דיני בית הכסא בשבת',
  313: 'החזרת ופתיחת דלתות וכלים בשבת',
  314: 'סתירה ובנין בכלים',
  315: 'עשיית אהל עראי בשבת',
  316: 'דין צידה בשבת',
  317: 'דין קשירה בשבת',
  318: 'דין מבשל בשבת',
  319: 'דין בורר בשבת',
  320: 'דין סוחט ומפרק בשבת',
  321: 'דין טוחן ולש בשבת',
  322: 'מוקצה במאכלים וביצה שנולדה',
  323: 'הדחת כלים בשבת',
  324: 'הכנת מאכל לבהמה בשבת',
  325: 'הנאה ממעשה אינו יהודי בשבת',
  326: 'דיני רחיצה בשבת',
  327: 'דין סיכה בשבת',
  328: 'דיני חולה בשבת',
  329: 'הצלת נפשות בשבת',
  330: 'דיני יולדת בשבת',
  331: 'דיני מילה בשבת',
  332: 'סיוע לבהמה ביום השבת',
  333: 'טלטול לצורך ופינוי המחסן בשבת',
  334: 'דיני הצלה מפני הדליקה',
  335: 'דינים שונים בשבת',
  336: 'דין עליה באילן ושימוש במחובר',
  337: 'כיבוד הבית ודברים המותרים בשבת',
  338: 'דין השמעת קול וכלי שיר בשבת',
  339: 'דברים האסורים בשבת משום שבות',
  340: 'תולדות מלאכות האסורות בשבת',
  341: 'עניני ממון ומת בשבת',
  342: 'דין בין השמשות של מוצאי שבת',
  343: 'דיני חינוך קטן בשבת',
  344: 'אמירת דבר תורה במקום שאינו נקי',
};

// Integer → Hebrew numeral (242 → רמ"ב), same rules as the old Python version.
function toHebrewNumeral(n) {
  const ones = ['', 'א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט'];
  const tens = ['', 'י', 'כ', 'ל', 'מ', 'נ', 'ס', 'ע', 'פ', 'צ'];
  const hundreds = ['', 'ק', 'ר', 'ש', 'ת'];
  let result = '';
  const h = Math.floor(n / 100);
  result += 'ת'.repeat(Math.floor(h / 4)) + hundreds[h % 4];
  n %= 100;
  if (n === 15 || n === 16) result += 'ט' + (n === 15 ? 'ו' : 'ז');
  else result += tens[Math.floor(n / 10)] + ones[n % 10];
  if (result.length > 1) result = result.slice(0, -1) + '"' + result.slice(-1);
  else if (result) result += "'";
  return result;
}

function stripHtml(text) {
  return String(text).replace(/<[^>]*>/g, '').replace(/\[\d+\]/g, '').trim();
}

// Small deterministic PRNG (mulberry32) seeded from the week key.
function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ISO date (YYYY-MM-DD) of the upcoming Saturday — the cache/seed key.
export function upcomingShabbatKey(now = new Date()) {
  const d = new Date(now);
  const diff = (6 - d.getUTCDay() + 7) % 7;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}

// Fetch this week's se'if from Sefaria. Deterministic for a given weekKey.
// Returns { dvar_torah, dvar_source, week } or null if Sefaria is unreachable.
export async function fetchWeeklyDvar(weekKey) {
  const rand = mulberry32(hashStr(weekKey));

  const pool = [];
  for (let s = SIMAN_RANGE[0]; s <= SIMAN_RANGE[1]; s++) {
    if (!EXCLUDED_SIMANIM.has(s)) pool.push(s);
  }
  // Deterministic Fisher–Yates shuffle, then try the first few simanim.
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  for (const siman of pool.slice(0, 8)) {
    try {
      const url = `https://www.sefaria.org/api/texts/Arukh_HaShulchan,_Orach_Chaim.${siman}?lang=he`;
      const resp = await fetch(url, { signal: AbortSignal.timeout(30000) });
      if (!resp.ok) continue;
      const payload = await resp.json();
      const segments = payload.he || [];
      const heRef = payload.heRef || `ערוך השולחן, אורח חיים ${toHebrewNumeral(siman)}`;

      // Goldilocks se'ifim: long enough to stand alone, short enough to read.
      const candidates = [];
      segments.forEach((seg, i) => {
        const clean = stripHtml(Array.isArray(seg) ? seg.join(' ') : seg);
        if (clean.length > MIN_LEN && clean.length < MAX_LEN) candidates.push([i, clean]);
      });
      if (!candidates.length) continue;

      const [idx, text] = candidates[Math.floor(rand() * candidates.length)];
      const title = SIMAN_TITLES[siman];
      const refWithTitle = title ? `${heRef} (${title})` : heRef;
      return {
        dvar_torah: text,
        dvar_source: `מקור: ${refWithTitle}, סעיף ${toHebrewNumeral(idx + 1)}`,
        week: weekKey,
      };
    } catch {
      // network error / timeout — try the next siman
    }
  }
  return null;
}
