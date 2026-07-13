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
    // (Legacy site published ~19:09 vs 40-min 19:04 — 5-min gap under review.)
    candleMins: 40,
  },
};

export const DEFAULT_COMMUNITY = 'orot_yisrael';

export function getCommunity(id) {
  return COMMUNITIES[id] || COMMUNITIES[DEFAULT_COMMUNITY];
}
