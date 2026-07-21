// core/config.js
// Single source of truth for user-configurable settings.
// Stored in localStorage under "bonsaios.config". Tokens never leave the
// browser except in Authorization headers sent directly to api.github.com.

const KEY = 'bonsaios.config';

const DEFAULTS = {
  treeName: 'Gardenia Bonsai',
  species: 'Gardenia jasminoides',
  acquiredDate: '2026-07-01',
  location: { name: 'Minneapolis, MN', lat: 44.9778, lon: -93.2650 },
  github: { owner: '', repo: '', branch: 'main', token: '', entriesPath: 'bonsai/entries' },
  sheets: { webAppUrl: '' },
  weather: { openWeatherKey: '' }, // optional, only used for UV index fallback
  theme: 'dark',
  reminders: {
    wateringDays: 3,
    fertilizerDays: 14,
    repotMonths: 24
  }
};

export function getConfig() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return structuredClone(DEFAULTS);
    const parsed = JSON.parse(raw);
    return deepMerge(structuredClone(DEFAULTS), parsed);
  } catch (e) {
    console.error('config read failed', e);
    return structuredClone(DEFAULTS);
  }
}

export function setConfig(next) {
  localStorage.setItem(KEY, JSON.stringify(next));
  return next;
}

export function updateConfig(patch) {
  const cur = getConfig();
  const next = deepMerge(cur, patch);
  return setConfig(next);
}

export function isGithubConfigured(cfg = getConfig()) {
  return Boolean(cfg.github.owner && cfg.github.repo && cfg.github.token);
}

export function isSheetsConfigured(cfg = getConfig()) {
  return Boolean(cfg.sheets.webAppUrl);
}

function deepMerge(base, patch) {
  const out = { ...base };
  for (const k of Object.keys(patch || {})) {
    if (patch[k] && typeof patch[k] === 'object' && !Array.isArray(patch[k])) {
      out[k] = deepMerge(base[k] || {}, patch[k]);
    } else {
      out[k] = patch[k];
    }
  }
  return out;
}
