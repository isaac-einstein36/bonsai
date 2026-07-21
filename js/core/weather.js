// core/weather.js
// Primary source: NOAA / api.weather.gov (no API key required — the
// documented courtesy is a descriptive User-Agent, which browsers won't let
// us override; requests still work, just be a good citizen if you proxy
// this server-side later). Sunrise/sunset/moon phase computed locally.
// Optional fallback: OpenWeather, only used for UV Index if a key is set,
// since NOAA's public API doesn't expose UV.

import { getConfig } from './config.js';
import { getSunTimes, getMoonPhase } from './solar.js';

const NOAA = 'https://api.weather.gov';
const UA = { 'User-Agent': 'BonsaiOS (personal bonsai tracker)', 'Accept': 'application/geo+json' };

let pointCache = null; // caches the /points lookup per lat/lon for the session

async function getPoint(lat, lon) {
  const key = `${lat},${lon}`;
  if (pointCache && pointCache.key === key) return pointCache.data;
  const res = await fetch(`${NOAA}/points/${lat},${lon}`, { headers: UA });
  if (!res.ok) throw new Error(`NOAA points lookup failed (${res.status})`);
  const data = await res.json();
  pointCache = { key, data };
  return data;
}

async function nearestStation(lat, lon) {
  const point = await getPoint(lat, lon);
  const res = await fetch(point.properties.observationStations, { headers: UA });
  if (!res.ok) throw new Error(`NOAA station lookup failed (${res.status})`);
  const data = await res.json();
  const first = data.features?.[0];
  if (!first) throw new Error('No NOAA observation station found near this location.');
  return first.properties.stationIdentifier;
}

function c2f(c) { return c == null ? null : Math.round((c * 9) / 5 + 32); }
function ms2mph(ms) { return ms == null ? null : Math.round(ms * 2.23694); }
function pa2inhg(pa) { return pa == null ? null : +(pa / 3386.39).toFixed(2); }
function m2mi(m) { return m == null ? null : +(m / 1609.34).toFixed(1); }

/** Full current-conditions bundle for the dashboard + journal auto-fill. */
export async function getCurrentConditions() {
  const cfg = getConfig();
  const { lat, lon } = cfg.location;

  const stationId = await nearestStation(lat, lon);
  const obsRes = await fetch(`${NOAA}/stations/${stationId}/observations/latest`, { headers: UA });
  if (!obsRes.ok) throw new Error(`NOAA observation fetch failed (${obsRes.status})`);
  const obs = (await obsRes.json()).properties;

  const now = new Date();
  const sun = getSunTimes(now, lat, lon);
  const moon = getMoonPhase(now);

  let uvIndex = null;
  if (cfg.weather.openWeatherKey) {
    try {
      const owRes = await fetch(`https://api.openweathermap.org/data/3.0/onecall?lat=${lat}&lon=${lon}&exclude=minutely,daily,alerts&units=imperial&appid=${cfg.weather.openWeatherKey}`);
      if (owRes.ok) uvIndex = (await owRes.json()).current?.uvi ?? null;
    } catch (e) { /* optional, ignore failure */ }
  }

  const cloudLayer = obs.cloudLayers?.[0]?.amount || null;

  return {
    source: 'NOAA / api.weather.gov',
    station: stationId,
    observedAt: obs.timestamp,
    temperatureF: c2f(obs.temperature?.value),
    humidityPct: obs.relativeHumidity?.value != null ? Math.round(obs.relativeHumidity.value) : null,
    windMph: ms2mph(obs.windSpeed?.value),
    windGustMph: ms2mph(obs.windGust?.value),
    windDirection: obs.windDirection?.value ?? null,
    pressureInHg: pa2inhg(obs.barometricPressure?.value),
    visibilityMi: m2mi(obs.visibility?.value),
    precipitationLastHourIn: obs.precipitationLastHour?.value != null ? +(obs.precipitationLastHour.value / 25.4).toFixed(2) : null,
    cloudCover: cloudLayer,
    description: obs.textDescription || null,
    uvIndex,
    sunrise: sun.sunrise,
    sunset: sun.sunset,
    moonPhase: moon.label,
    moonFraction: moon.phase
  };
}
