import json
import os
import random
import re
import requests
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo
from playwright.sync_api import sync_playwright
from pyluach import dates

# --- CONFIGURATION: Parsha to Book Mapping ---
PARSHA_MAP = {
    # GENESIS
    "Bereshit": "Genesis", "Noach": "Genesis", "Lech-Lecha": "Genesis", "Vayera": "Genesis", 
    "Chayei Sara": "Genesis", "Toldot": "Genesis", "Vayetzei": "Genesis", "Vayishlach": "Genesis", 
    "Vayeshev": "Genesis", "Miketz": "Genesis", "Vayigash": "Genesis", "Vayechi": "Genesis",
    # EXODUS
    "Shemot": "Exodus", "Vaera": "Exodus", "Bo": "Exodus", "Beshalach": "Exodus", 
    "Yitro": "Exodus", "Mishpatim": "Exodus", "Terumah": "Exodus", "Tetzaveh": "Exodus", 
    "Ki Tisa": "Exodus", "Vayakhel": "Exodus", "Pekudei": "Exodus",
    # LEVITICUS
    "Vayikra": "Leviticus", "Tzav": "Leviticus", "Shmini": "Leviticus", "Tazria": "Leviticus", 
    "Metzora": "Leviticus", "Achrei Mot": "Leviticus", "Kedoshim": "Leviticus", "Emor": "Leviticus", 
    "Behar": "Leviticus", "Bechukotai": "Leviticus",
    # NUMBERS
    "Bamidbar": "Numbers", "Nasso": "Numbers", "Beha'alotcha": "Numbers", "Sh'lach": "Numbers", 
    "Korach": "Numbers", "Chukat": "Numbers", "Balak": "Numbers", "Pinchas": "Numbers", 
    "Matot": "Numbers", "Masei": "Numbers",
    # DEUTERONOMY
    "Devarim": "Deuteronomy", "Vaetchanan": "Deuteronomy", "Eikev": "Deuteronomy", "Re'eh": "Deuteronomy", 
    "Shoftim": "Deuteronomy", "Ki Teitzei": "Deuteronomy", "Ki Tavo": "Deuteronomy", "Nitzavim": "Deuteronomy", 
    "Vayeilech": "Deuteronomy", "Ha'Azinu": "Deuteronomy", "Vezot Haberakhah": "Deuteronomy"
}

def get_next_friday_date():
    today = date.today()
    days_ahead = (4 - today.weekday() + 7) % 7
    if days_ahead == 0: days_ahead = 0
    next_friday = today + timedelta(days=days_ahead)
    return next_friday.strftime("%Y-%m-%d")

def get_next_shabbat_date_obj():
    today = date.today()
    days_ahead = (5 - today.weekday() + 7) % 7
    if days_ahead == 0: days_ahead = 7
    return today + timedelta(days=days_ahead)

def get_friday_fmt_itin():
    d = date.today()
    days_ahead = (4 - d.weekday() + 7) % 7
    if days_ahead == 0: days_ahead = 0
    next_friday = d + timedelta(days=days_ahead)
    return next_friday.strftime("%a, %d %b %Y 00:00:00 GMT")

def to_24h(time_str):
    if not time_str: return "00:00"
    parts = time_str.split(':')
    hour = int(parts[0])
    minute = parts[1]
    if hour < 11: hour += 12
    return f"{hour}:{minute}"

def strip_html(text):
    if not isinstance(text, str): return ""
    clean = re.compile('<.*?>')
    text = re.sub(clean, '', text)
    text = re.sub(r'\[\d+\]', '', text)
    return text.strip()

# --- ARUKH HASHULCHAN FETCHER (Hilchot Shabbat: Orach Chaim 242-344) ---
ARUKH_SIMAN_RANGE = (242, 344)

# Simanim to skip when picking randomly.
ARUKH_EXCLUDED_SIMANIM = {280}

# Keep quoted se'ifim short and readable.
ARUKH_MIN_LEN = 250
ARUKH_MAX_LEN = 750

# Curated Hebrew topic headings for Orach Chaim, Hilchot Shabbat (242-344).
# Sefaria stores no per-siman title, so these are a static map used only for
# the "מקור" context line. Any siman missing here simply shows no heading.
SIMAN_TITLES = {
    242: "הכנת צרכי שבת וכבודה",
    243: "נתינת מלאכה לאינו יהודי",
    244: "עשיית מלאכה על ידי אינו יהודי",
    245: "ישראל ואינו יהודי שהם שותפים",
    246: "השאלה והשכרה לאינו יהודי",
    247: "שילוח אגרת ביד אינו יהודי",
    248: "היוצא בשיירא ובספינה",
    249: "דברים האסורים בערב שבת",
    250: "הכנת צרכי סעודה לשבת",
    251: "עשיית מלאכה בערב שבת",
    252: "מלאכות המותרות להתחיל בערב שבת",
    253: "שהיית וחזרת התבשיל על הכירה",
    254: "צליה ואפיה סמוך לחשכה",
    255: "הדלקת אש והטמנה סמוך לחשכה",
    256: "זמן איסור מלאכה בערב שבת",
    257: "דיני הטמנה",
    258: "הטמנה על גבי דבר שאין מוסיף הבל",
    259: "הטמנה בדבר המוסיף הבל",
    260: "דברים שצריך לעשות בערב שבת",
    261: "בין השמשות ותוספת שבת",
    262: "כבוד שבת במלבושים ובהצעת המיטות",
    263: "על מי חלה חובת הדלקת נר שבת",
    264: "הפתילות והשמנים הכשרים לנר שבת",
    265: "דינים שונים בהדלקת הנר",
    266: "מי שקדש עליו היום בדרך",
    267: "סדר תפילת ליל שבת",
    268: "דיני תפילת שבת",
    269: "מנהג הקידוש בבית הכנסת",
    270: "אמירת במה מדליקין",
    271: "קידוש היום על היין",
    272: "על איזה יין מקדשים",
    273: "שאין קידוש אלא במקום סעודה",
    274: "בציעת הפת בשבת",
    275: "מה שאסור לעשות לאור הנר",
    276: "הנאה מנר שהדליקו אינו יהודי",
    277: "שלא לטלטל את הנר",
    278: "כיבוי הנר מפני החולה",
    279: "טלטול הנר בשבת",
    281: "סדר תפילת שחרית של שבת",
    282: "קריאת התורה בשבת",
    283: "תפילת מוסף של שבת",
    284: "הפטרה וברכותיה",
    285: "שנים מקרא ואחד תרגום",
    286: "זמן תפילת מוסף",
    287: "ניחום אבלים וביקור חולים בשבת",
    288: "איסור תענית בשבת",
    289: "סדר הקידוש והסעודה ביום",
    290: "לעסוק בתורה ובסעודה ביום השבת",
    291: "דין סעודה שלישית",
    292: "תפילת מנחה בשבת",
    293: "תפילת ערבית במוצאי שבת",
    294: "הבדלה בתפילה",
    295: "שאין מבדילין קודם צאת הכוכבים",
    296: "סדר הבדלה על הכוס",
    297: "דיני בשמים בהבדלה",
    298: "דיני נר של הבדלה",
    299: "דברים האסורים עד שיבדיל",
    300: "סעודת מלווה מלכה",
    301: "באיזה דברים מותר לצאת בשבת",
    302: "דין נקיון וקיפול הבגדים בשבת",
    303: "במה אשה יוצאה",
    304: "דין העבד בשבת",
    305: "דין בהמתו בשבת",
    306: "חפצים ודברי חול האסורים בשבת",
    307: "דיני ממצוא חפצך ודבר דבר",
    308: "דיני טלטול מוקצה",
    309: "טלטול מוקצה על ידי דבר אחר",
    310: "המשך דיני מוקצה",
    311: "טלטול מת ומוקצה לצורך",
    312: "דיני בית הכסא בשבת",
    313: "החזרת ופתיחת דלתות וכלים בשבת",
    314: "סתירה ובנין בכלים",
    315: "עשיית אהל עראי בשבת",
    316: "דין צידה בשבת",
    317: "דין קשירה בשבת",
    318: "דין מבשל בשבת",
    319: "דין בורר בשבת",
    320: "דין סוחט ומפרק בשבת",
    321: "דין טוחן ולש בשבת",
    322: "מוקצה במאכלים וביצה שנולדה",
    323: "הדחת כלים בשבת",
    324: "הכנת מאכל לבהמה בשבת",
    325: "הנאה ממעשה אינו יהודי בשבת",
    326: "דיני רחיצה בשבת",
    327: "דין סיכה בשבת",
    328: "דיני חולה בשבת",
    329: "הצלת נפשות בשבת",
    330: "דיני יולדת בשבת",
    331: "דיני מילה בשבת",
    332: "סיוע לבהמה ביום השבת",
    333: "טלטול לצורך ופינוי המחסן בשבת",
    334: "דיני הצלה מפני הדליקה",
    335: "דינים שונים בשבת",
    336: "דין עליה באילן ושימוש במחובר",
    337: "כיבוד הבית ודברים המותרים בשבת",
    338: "דין השמעת קול וכלי שיר בשבת",
    339: "דברים האסורים בשבת משום שבות",
    340: "תולדות מלאכות האסורות בשבת",
    341: "עניני ממון ומת בשבת",
    342: "דין בין השמשות של מוצאי שבת",
    343: "דיני חינוך קטן בשבת",
    344: "אמירת דבר תורה במקום שאינו נקי",
}

def to_hebrew_numeral(n):
    """Convert an integer to a Hebrew numeral string (e.g. 242 -> רמ\"ב)."""
    ones = ["", "א", "ב", "ג", "ד", "ה", "ו", "ז", "ח", "ט"]
    tens = ["", "י", "כ", "ל", "מ", "נ", "ס", "ע", "פ", "צ"]
    hundreds = ["", "ק", "ר", "ש", "ת"]
    result = ""
    h = n // 100
    result += "ת" * (h // 4) + hundreds[h % 4]
    n %= 100
    if n in (15, 16):
        result += "ט" + ("ו" if n == 15 else "ז")
    else:
        result += tens[n // 10] + ones[n % 10]
    if len(result) > 1:
        result = result[:-1] + '"' + result[-1]
    elif result:
        result += "'"
    return result

def fetch_arukh_hashulchan():
    """Pick a random se'if from Arukh HaShulchan, Orach Chaim (Hilchot Shabbat).

    Returns (text, source) or (None, None).
    """
    lo, hi = ARUKH_SIMAN_RANGE
    pool = [n for n in range(lo, hi + 1) if n not in ARUKH_EXCLUDED_SIMANIM]
    random.shuffle(pool)

    for siman in pool[:8]:
        url = f"https://www.sefaria.org/api/texts/Arukh_HaShulchan,_Orach_Chaim.{siman}?lang=he"
        print(f"Trying Arukh HaShulchan siman {siman}: {url}")
        try:
            resp = requests.get(url, timeout=30)
            if resp.status_code != 200:
                continue
            payload = resp.json()
            segments = payload.get('he') or []
            he_ref = payload.get('heRef', f"ערוך השולחן, אורח חיים {to_hebrew_numeral(siman)}")

            # Goldilocks se'ifim: long enough to stand alone, short enough to read
            candidates = []
            for i, seg in enumerate(segments):
                if isinstance(seg, list):
                    seg = " ".join(str(x) for x in seg)
                clean = strip_html(str(seg))
                if ARUKH_MIN_LEN < len(clean) < ARUKH_MAX_LEN:
                    candidates.append((i, clean))

            if not candidates:
                print(f"⚠️ No fitting se'if in siman {siman}, retrying...")
                continue

            idx, text = random.choice(candidates)
            title = SIMAN_TITLES.get(siman)
            ref_with_title = f"{he_ref} ({title})" if title else he_ref
            source = f"מקור: {ref_with_title}, סעיף {to_hebrew_numeral(idx + 1)}"
            print(f"✅ Found Arukh HaShulchan se'if ({len(text)} chars): {source}")
            return text, source
        except Exception as e:
            print(f"❌ Error fetching Arukh HaShulchan: {e}")

    return None, None

def load_manual_data():
    try:
        with open('manual_data.json', 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception:
        return {}

HEB_WEEKDAYS = {
    "Sunday": "ראשון", "Monday": "שני", "Tuesday": "שלישי", "Wednesday": "רביעי",
    "Thursday": "חמישי", "Friday": "שישי", "Saturday": "שבת",
}

def parse_molad_memo(memo):
    """Parse Hebcal's mevarchim memo into structured parts.

    memo looks like: 'Molad Av: Tuesday, 19:30 and 17 chalakim'.
    Returns None if the format is unexpected.
    """
    m = re.search(r'Molad\s+(.+?):\s*(\w+),\s*(\d{1,2}:\d{2})\s*and\s*(\d+)\s*chalakim', memo or "")
    if not m:
        return None
    return {
        "month_en": m.group(1).strip(),
        "weekday_en": m.group(2),
        "time": m.group(3),
        "chalakim": int(m.group(4)),
    }

def get_rosh_chodesh_days(shabbat_date):
    """Gregorian date(s) of the upcoming Rosh Chodesh (1 or 2 days)."""
    d = shabbat_date
    first = None
    for _ in range(12):
        d = d + timedelta(days=1)
        if dates.HebrewDate.from_pydate(d).day == 1:
            first = d
            break
    if first is None:
        return []
    prev = first - timedelta(days=1)
    if dates.HebrewDate.from_pydate(prev).day == 30:
        return [prev, first]
    return [first]

def format_rosh_chodesh_he(rc_dates):
    names = [HEB_WEEKDAYS.get(d.strftime("%A"), "") for d in rc_dates]
    names = [n for n in names if n]
    if not names:
        return ""
    if len(names) == 1:
        return "ראש חודש בשבת" if names[0] == "שבת" else f"ראש חודש ביום {names[0]}"
    return f"ראש חודש בימים {names[0]} ו{names[1]}"

def format_molad(parts, rc_dates):
    """Build the Hebrew molad line, e.g.
    'המולד יהיה ביום שלישי, בשעה 19:30 ו-17 חלקים, ראש חודש ביום רביעי'.
    """
    if not parts:
        return ""
    weekday_he = HEB_WEEKDAYS.get(parts["weekday_en"], parts["weekday_en"])
    line = f"המולד יהיה ביום {weekday_he}, בשעה {parts['time']} ו-{parts['chalakim']} חלקים"
    rc = format_rosh_chodesh_he(rc_dates)
    if rc:
        line += f", {rc}"
    return line

def detect_is_summer(friday_date):
    """Check if Israel is in summer time (DST) on the given Friday."""
    tz = ZoneInfo("Asia/Jerusalem")
    dt = datetime(friday_date.year, friday_date.month, friday_date.day, 12, 0, tzinfo=tz)
    return bool(dt.dst())

def resolve_image(english_parsha, manual_config):
    """Pick the parsha image, with manual override and fallback."""
    manual_image = manual_config.get("image")
    if manual_image:
        return manual_image
    if english_parsha:
        parsha_img = f"images/{english_parsha}.jpg"
        if os.path.exists(parsha_img):
            return parsha_img
    return "kotel.jpg"

def scrape_times():
    friday_iso = get_next_friday_date()
    friday_itin = get_friday_fmt_itin()
    manual_config = load_manual_data()

    # is_summer: manual override takes precedence, otherwise auto-detect from DST
    friday_date = date.fromisoformat(friday_iso)
    manual_summer = manual_config.get("is_summer")
    is_summer = manual_summer if manual_summer is not None else detect_is_summer(friday_date)
    
    data = {
        "parsha": "שבת שלום",
        "parsha_en": "",
        "description": manual_config.get("description", ""),
        "molad": "",
        "molad_parts": None,
        "mevarchim": False,
        "candles": "16:00",
        "havdalah": "17:00",
        "dvar_torah": "",
        "dvar_source": "",
        "shiur_topic": manual_config.get("shiur_topic", "הלכות שבת"), 
        "kidush": manual_config.get("kidush", ""),
        "messages": manual_config.get("messages", ""),
        "is_summer": is_summer,
        "image": "kotel.jpg",
        "source": "Hybrid Data"
    }

    english_parsha = ""
    hebrew_parsha_name = ""
    is_mevarchim = False
    description_is_auto = not manual_config.get("description")

    # 1. METADATA & MEVARCHIM
    print("🤖 Step 1: Hebcal Metadata...")
    try:
        shabbat_date = get_next_shabbat_date_obj()
        heb_date = dates.HebrewDate.from_pydate(shabbat_date)

        if 23 <= heb_date.day <= 29:
            is_mevarchim = True
            data["mevarchim"] = True
            if description_is_auto:
                data["description"] = "שבת מברכין"
            print("🌙 Status: Mevarchim Detected")

        h_url = f"https://www.hebcal.com/shabbat?cfg=json&geonameid=281184&M=on&date={friday_iso}"
        h_data = requests.get(h_url).json()

        parsha_item = next((x for x in h_data['items'] if x['category'] == 'parashat'), None)
        if parsha_item:
            data["parsha"] = parsha_item['hebrew'].replace("פרשת", "").strip()
            hebrew_parsha_name = data["parsha"]
            english_parsha = parsha_item['title'].replace("Parashat ", "").strip()
            data["parsha_en"] = english_parsha
            print(f"📖 Parsha: {data['parsha']}")

        # Molad comes straight from Hebcal's mevarchim item (M=on above); it is a
        # fixed calculated value, identical in every luach, so no scraping needed.
        molad_item = next((x for x in h_data['items'] if x['category'] == 'mevarchim'), None)
        if molad_item:
            month_he = (molad_item.get("hebrew", "") or "").replace("מברכים חודש", "").strip()
            rc_dates = get_rosh_chodesh_days(shabbat_date)
            parts = parse_molad_memo(molad_item.get("memo", ""))
            if parts:
                parts["month_he"] = month_he
                parts["rosh_chodesh_weekdays_en"] = [d.strftime("%A") for d in rc_dates]
                data["molad_parts"] = parts
            data["molad"] = format_molad(parts, rc_dates)
            if description_is_auto and is_mevarchim and month_he:
                data["description"] = f"שבת מברכין חודש {month_he}"
            print(f"🌙 Molad: {data['molad']}")

    except Exception as e:
        print(f"❌ Metadata Error: {e}")

    # 2. ARUKH HASHULCHAN (Replaced Bat Ayin) — random halakha from Hilchot Shabbat
    print("📚 Step 2: Fetching Arukh HaShulchan (Hilchot Shabbat)...")
    text, source = fetch_arukh_hashulchan()
    if text:
        data["dvar_torah"] = text
        data["dvar_source"] = source
        print("✅ Arukh HaShulchan Found!")
    else:
        print("⚠️ Arukh HaShulchan not found.")

    # Resolve image based on parsha
    data["image"] = resolve_image(english_parsha, manual_config)
    print(f"🖼️ Image: {data['image']}")
    print(f"☀️ Summer: {is_summer}")

    # 3. ITIM LABINA
    print("🌍 Step 3: Scraping Times...")
    base_url = "https://itimlabina.co.il/calendar/weekly"
    full_url = f"{base_url}?address=Jerusalem&lat=31.7198189&lng=35.2306758&date={friday_itin}"
    
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={'width': 1280, 'height': 3000})
        
        try:
            page.goto(full_url, timeout=60000)
            page.keyboard.press("Escape")
            page.wait_for_selector("text=הדלקת נרות", timeout=60000)
            
            text_content = page.inner_text("body")
            clean_text = text_content.replace("\n", " ")

            candles_search = re.search(r'הדלקת נרות.*?(\d{1,2}:\d{2})', clean_text)
            if candles_search: data["candles"] = to_24h(candles_search.group(1))

            havdalah_search = re.search(r'צאת השבת.*?(\d{1,2}:\d{2})', clean_text)
            if havdalah_search: data["havdalah"] = to_24h(havdalah_search.group(1))

        except Exception as e:
            print(f"❌ Scrape Error: {e}")
        finally:
            browser.close()

    with open('data.json', 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

if __name__ == "__main__":
    scrape_times()