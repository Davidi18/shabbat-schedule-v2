// Location / community profiles. Each entry is everything the zmanim engine
// needs (lib/zmanim.js) plus multilingual display names. The engine is fully
// client-side — no scraping, no server. Adding a place = adding an entry here.
//
// candleMins  : candle-lighting minutes before sunset (local minhag).
// useElevation: astronomical sunset adjusted for altitude (matches itimlabina
//               for Jerusalem exactly). Enabled per-location.
// il          : Israel (1-day yom tov) vs diaspora (2-day). Drives the calendar.

export const LOCATIONS = {
  // ── Community (default) ─────────────────────────────────────────────
  orot_yisrael: {
    id: 'orot_yisrael', kind: 'community', region: 'israel',
    he: 'קהילת אורות ישראל', en: 'Orot Yisrael', fr: 'Orot Israël',
    cityHe: 'ירושלים', cityEn: 'Jerusalem', cityFr: 'Jérusalem',
    lat: 31.7198189, lng: 35.2306758, tz: 'Asia/Jerusalem', cc: 'IL',
    geonameid: 281184, il: true, candleMins: 40, elevation: 754, useElevation: true,
  },

  // ── Israel ──────────────────────────────────────────────────────────
  jerusalem: {
    id: 'jerusalem', kind: 'city', region: 'israel',
    he: 'ירושלים', en: 'Jerusalem', fr: 'Jérusalem',
    lat: 31.7683, lng: 35.2137, tz: 'Asia/Jerusalem', cc: 'IL',
    geonameid: 281184, il: true, candleMins: 40, elevation: 754, useElevation: true,
  },
  tel_aviv: {
    id: 'tel_aviv', kind: 'city', region: 'israel',
    he: 'תל אביב–יפו', en: 'Tel Aviv', fr: 'Tel Aviv',
    lat: 32.0853, lng: 34.7818, tz: 'Asia/Jerusalem', cc: 'IL',
    geonameid: 293397, il: true, candleMins: 18,
  },
  haifa: {
    id: 'haifa', kind: 'city', region: 'israel',
    he: 'חיפה', en: 'Haifa', fr: 'Haïfa',
    lat: 32.794, lng: 34.9896, tz: 'Asia/Jerusalem', cc: 'IL',
    geonameid: 294801, il: true, candleMins: 30, elevation: 300, useElevation: true,
  },
  bnei_brak: {
    id: 'bnei_brak', kind: 'city', region: 'israel',
    he: 'בני ברק', en: 'Bnei Brak', fr: 'Bnei Brak',
    lat: 32.0807, lng: 34.8338, tz: 'Asia/Jerusalem', cc: 'IL',
    geonameid: 295530, il: true, candleMins: 20,
  },
  beer_sheva: {
    id: 'beer_sheva', kind: 'city', region: 'israel',
    he: 'באר שבע', en: 'Beer Sheva', fr: 'Beer-Sheva',
    lat: 31.2518, lng: 34.7913, tz: 'Asia/Jerusalem', cc: 'IL',
    geonameid: 295530, il: true, candleMins: 20,
  },
  beit_shemesh: {
    id: 'beit_shemesh', kind: 'city', region: 'israel',
    he: 'בית שמש', en: 'Beit Shemesh', fr: 'Beit Chemech',
    lat: 31.7497, lng: 34.9887, tz: 'Asia/Jerusalem', cc: 'IL',
    geonameid: 295721, il: true, candleMins: 30, elevation: 300, useElevation: true,
  },

  // ── Diaspora (2-day yom tov) ────────────────────────────────────────
  new_york: {
    id: 'new_york', kind: 'city', region: 'diaspora',
    he: 'ניו יורק', en: 'New York', fr: 'New York',
    lat: 40.7128, lng: -74.006, tz: 'America/New_York', cc: 'US',
    il: false, candleMins: 18,
  },
  los_angeles: {
    id: 'los_angeles', kind: 'city', region: 'diaspora',
    he: 'לוס אנג׳לס', en: 'Los Angeles', fr: 'Los Angeles',
    lat: 34.0522, lng: -118.2437, tz: 'America/Los_Angeles', cc: 'US',
    il: false, candleMins: 18,
  },
  london: {
    id: 'london', kind: 'city', region: 'diaspora',
    he: 'לונדון', en: 'London', fr: 'Londres',
    lat: 51.5074, lng: -0.1278, tz: 'Europe/London', cc: 'GB',
    il: false, candleMins: 18,
  },
  paris: {
    id: 'paris', kind: 'city', region: 'diaspora',
    he: 'פריז', en: 'Paris', fr: 'Paris',
    lat: 48.8566, lng: 2.3522, tz: 'Europe/Paris', cc: 'FR',
    il: false, candleMins: 18,
  },
  toronto: {
    id: 'toronto', kind: 'city', region: 'diaspora',
    he: 'טורונטו', en: 'Toronto', fr: 'Toronto',
    lat: 43.6532, lng: -79.3832, tz: 'America/Toronto', cc: 'CA',
    il: false, candleMins: 18,
  },
  melbourne: {
    id: 'melbourne', kind: 'city', region: 'diaspora',
    he: 'מלבורן', en: 'Melbourne', fr: 'Melbourne',
    lat: -37.8136, lng: 144.9631, tz: 'Australia/Melbourne', cc: 'AU',
    il: false, candleMins: 18,
  },
};

export const DEFAULT_LOCATION = 'orot_yisrael';

export function getLocation(id) {
  return LOCATIONS[id] || LOCATIONS[DEFAULT_LOCATION];
}

// Display name of a location in the active language, with sensible fallback.
export function locationLabel(loc, lang) {
  if (!loc) return '';
  return loc[lang] || loc.en || loc.he;
}

// Ordered groups for the picker: community first, then Israel, then diaspora.
export const LOCATION_GROUPS = [
  { key: 'community', ids: ['orot_yisrael'] },
  { key: 'israel', ids: ['jerusalem', 'tel_aviv', 'haifa', 'bnei_brak', 'beer_sheva', 'beit_shemesh'] },
  { key: 'diaspora', ids: ['new_york', 'los_angeles', 'london', 'paris', 'toronto', 'melbourne'] },
];

// Back-compat aliases (Phase 1 naming).
export const COMMUNITIES = LOCATIONS;
export const DEFAULT_COMMUNITY = DEFAULT_LOCATION;
export const getCommunity = getLocation;

// Haversine (km) → nearest CITY profile to a coordinate (community excluded).
export function nearestLocation(lat, lng) {
  const toRad = (d) => (d * Math.PI) / 180;
  let best = DEFAULT_LOCATION;
  let bestKm = Infinity;
  for (const id in LOCATIONS) {
    const l = LOCATIONS[id];
    if (l.kind === 'community') continue;
    const dLat = toRad(l.lat - lat);
    const dLng = toRad(l.lng - lng);
    const a = Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat)) * Math.cos(toRad(l.lat)) * Math.sin(dLng / 2) ** 2;
    const km = 6371 * 2 * Math.asin(Math.sqrt(a));
    if (km < bestKm) { bestKm = km; best = id; }
  }
  return best;
}
