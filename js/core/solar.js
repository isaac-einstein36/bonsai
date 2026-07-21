// core/solar.js
// Small, dependency-free astronomical calculations so we can report
// sunrise/sunset/moon phase without needing a second API or key.

const RAD = Math.PI / 180;

/** Returns { sunrise: Date, sunset: Date } in local time for lat/lon on `date`. */
export function getSunTimes(date, lat, lon) {
  const dayOfYear = Math.floor((date - new Date(date.getFullYear(), 0, 0)) / 86400000);
  const lngHour = lon / 15;

  function calc(isRise) {
    const t = dayOfYear + ((isRise ? 6 : 18) - lngHour) / 24;
    const M = 0.9856 * t - 3.289;
    let L = M + 1.916 * Math.sin(M * RAD) + 0.020 * Math.sin(2 * M * RAD) + 282.634;
    L = normalize(L, 360);
    let RA = (1 / RAD) * Math.atan(0.91764 * Math.tan(L * RAD));
    RA = normalize(RA, 360);
    RA = RA + (Math.floor(L / 90) * 90 - Math.floor(RA / 90) * 90);
    RA /= 15;
    const sinDec = 0.39782 * Math.sin(L * RAD);
    const cosDec = Math.cos(Math.asin(sinDec));
    const cosH = (Math.cos(90.833 * RAD) - sinDec * Math.sin(lat * RAD)) / (cosDec * Math.cos(lat * RAD));
    if (cosH > 1 || cosH < -1) return null; // sun never rises/sets that day at this latitude
    let H = isRise ? 360 - (1 / RAD) * Math.acos(cosH) : (1 / RAD) * Math.acos(cosH);
    H /= 15;
    const T = H + RA - 0.06571 * t - 6.622;
    let UT = normalize(T - lngHour, 24);
    return UT;
  }

  const riseUT = calc(true);
  const setUT = calc(false);
  const base = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  const toDate = (ut) => ut == null ? null : new Date(base + ut * 3600000);
  return { sunrise: toDate(riseUT), sunset: toDate(setUT) };
}

function normalize(v, mod) {
  v = v % mod;
  return v < 0 ? v + mod : v;
}

/** Moon phase 0..1 (0/1 = new moon, 0.5 = full moon) plus a human label. */
export function getMoonPhase(date) {
  // Days since a known new moon (2000-01-06 18:14 UTC), synodic month ~29.53059 days.
  const synodic = 29.53058867;
  const known = Date.UTC(2000, 0, 6, 18, 14);
  const days = (date.getTime() - known) / 86400000;
  let phase = (days % synodic) / synodic;
  if (phase < 0) phase += 1;
  const labels = [
    [0.02, 'New Moon'], [0.24, 'Waxing Crescent'], [0.26, 'First Quarter'],
    [0.49, 'Waxing Gibbous'], [0.51, 'Full Moon'], [0.74, 'Waning Gibbous'],
    [0.76, 'Last Quarter'], [0.98, 'Waning Crescent'], [1.01, 'New Moon']
  ];
  const label = labels.find(([max]) => phase <= max)?.[1] || 'New Moon';
  return { phase, label };
}
