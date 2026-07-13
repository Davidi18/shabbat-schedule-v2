// Community / location profiles. Each profile is everything the zmanim engine
// needs to compute times for that place + the community's display identity.
// The engine is fully client-side (see lib/zmanim.js) — no scraping, no server.
//
// Adding a community = adding an entry here (Phase 2 will make this user-selectable).

export const COMMUNITIES = {
  orot_yisrael: {
    id: 'orot_yisrael',
    name: 'קהילת אורות ישראל',
    cityHe: 'ירושלים',
    cityEn: 'Jerusalem',
    // Jerusalem — same coordinates the legacy scraper used (itimlabina).
    lat: 31.7198189,
    lng: 35.2306758,
    tz: 'Asia/Jerusalem',
    geonameid: 281184,
    il: true,
    // Candle-lighting minutes before sunset. Jerusalem minhag is 40.
    candleMins: 40,
    // Elevation-aware sunset. With Jerusalem's 754m + useElevation, the engine
    // reproduces itimlabina's published candle time EXACTLY (verified 19:09=19:09,
    // Emanuel Zisman St / geo 31.7198189,35.2306758) — same source the legacy
    // scraper read. This is also the more halachically precise sunset.
    elevation: 754,
    useElevation: true,
  },
};

export const DEFAULT_COMMUNITY = 'orot_yisrael';

export function getCommunity(id) {
  return COMMUNITIES[id] || COMMUNITIES[DEFAULT_COMMUNITY];
}
