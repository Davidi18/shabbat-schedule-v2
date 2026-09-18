export function timeToMinutes(timeStr) {
  if (!timeStr) return 0;
  const parts = timeStr.split(':');
  return parseInt(parts[0]) * 60 + parseInt(parts[1]);
}

export function minutesToTime(totalMinutes) {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h}:${m.toString().padStart(2, '0')}`;
}

export function calculateMincha(candleTimeStr) {
  if (!candleTimeStr) return '--:--';
  const cTime = timeToMinutes(candleTimeStr);
  let target = cTime + 15;
  let rounded = Math.ceil(target / 5) * 5;
  if (rounded - cTime > 18) rounded -= 5;
  return minutesToTime(rounded);
}

// Mincha moves with the season, and the season is a judgement the gabbai
// makes — a fixed 18:00 suits high summer but not late September, when the
// community brings it forward. A time set in the admin page wins; with none
// set it falls back to the old rule.
export function calculateMinchaShabbat(data) {
  if (/^\d{1,2}:\d{2}$/.test(String(data.mincha_shabbat || '').trim())) {
    return String(data.mincha_shabbat).trim();
  }
  if (data.is_summer === true) return '18:00';
  if (!data.candles) return '--:--';
  const cTime = timeToMinutes(data.candles);
  const limit = cTime - 15;
  const rounded = Math.floor(limit / 15) * 15;
  return minutesToTime(rounded);
}

export function calculateOrot(minchaTimeStr) {
  if (!minchaTimeStr) return '--:--';
  const mTime = timeToMinutes(minchaTimeStr);
  return minutesToTime(mTime - 45);
}

export function calculateArvit(havdalahTimeStr) {
  if (!havdalahTimeStr) return '--:--';
  const hTime = timeToMinutes(havdalahTimeStr);
  const target = hTime - 5;
  const rounded = Math.ceil(target / 5) * 5;
  return minutesToTime(rounded);
}
