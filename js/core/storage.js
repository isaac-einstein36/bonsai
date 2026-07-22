// core/storage.js
// GitHub (the repo) is the permanent record. localStorage is just a fast,
// offline-friendly cache of the same data so the PWA still works with no
// signal on a balcony.

import { getConfig, isGithubConfigured } from './config.js';
import * as gh from './github.js';
import { pushEntryToSheet, deleteEntryFromSheet } from './sheets.js';

const CACHE_KEY = 'bonsaios.entries.cache';

function readCache() {
  try { return JSON.parse(localStorage.getItem(CACHE_KEY) || '[]'); } catch { return []; }
}
function writeCache(entries) {
  localStorage.setItem(CACHE_KEY, JSON.stringify(entries));
}

/** Returns cached entries immediately; if `refresh` and GitHub is configured, also refreshes from GitHub and updates the cache (returned via the callback). */
export async function getEntries({ refresh = true, onRefreshed } = {}) {
  const cached = readCache().sort((a, b) => (a.date < b.date ? 1 : -1));
  if (refresh && isGithubConfigured()) {
    gh.fetchAllEntries()
      .then((fresh) => {
        writeCache(fresh);
        if (onRefreshed) onRefreshed(fresh);
      })
      .catch((e) => console.warn('GitHub refresh failed, using cache', e));
  }
  return cached;
}

/** Save an entry: writes to GitHub (source of truth), mirrors to Google Sheets, updates local cache. Returns a report of what succeeded. */
export async function saveEntry(entry) {
  const report = { github: false, sheets: false, errors: [] };

  if (isGithubConfigured()) {
    try {
      await gh.saveEntry(entry);
      report.github = true;
    } catch (e) {
      report.errors.push(`GitHub: ${e.message}`);
    }
  } else {
    report.errors.push('GitHub not configured — saved locally only.');
  }

  const cfg = getConfig();
  if (cfg.sheets.webAppUrl) {
    try {
      await pushEntryToSheet(entry);
      report.sheets = true;
    } catch (e) {
      report.errors.push(`Sheets: ${e.message}`);
    }
  }

  // Always update local cache regardless of remote success, so nothing is lost.
  const cache = readCache().filter((e) => e.date !== entry.date);
  cache.push(entry);
  writeCache(cache);

  return report;
}

/** Delete an entry: removes the GitHub file (source of truth), removes the Sheets row, updates local cache. */
export async function deleteEntry(entry) {
  const report = { github: false, sheets: false, errors: [] };

  if (isGithubConfigured() && entry.__path) {
    try {
      await gh.deleteFile(entry.__path, `Journal: delete ${entry.date}`);
      report.github = true;
    } catch (e) {
      report.errors.push(`GitHub: ${e.message}`);
    }
  } else if (!entry.__path) {
    report.errors.push('No GitHub file path on this entry (was it ever synced?) — removed locally only.');
  }

  const cfg = getConfig();
  if (cfg.sheets.webAppUrl) {
    try {
      await deleteEntryFromSheet(entry.date);
      report.sheets = true;
    } catch (e) {
      report.errors.push(`Sheets: ${e.message}`);
    }
  }

  const cache = readCache().filter((e) => e.date !== entry.date);
  writeCache(cache);

  return report;
}

/** Upload a photo (File) into the repo under bonsai/images/YYYY/MM/, returns the relative path to store on the entry. */
export async function uploadPhoto(file, dateStr) {
  if (!isGithubConfigured()) throw new Error('Connect GitHub in Settings before uploading photos.');
  const [y, m] = dateStr.split('-');
  const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
  const path = `bonsai/images/${y}/${m}/${dateStr}-${safeName}`;

  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  const base64 = btoa(binary);

  const cfg = getConfig();
  const res = await fetch(`https://api.github.com/repos/${cfg.github.owner}/${cfg.github.repo}/contents/${path}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${cfg.github.token}`,
      'Accept': 'application/vnd.github+json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ message: `Photo: ${dateStr} — ${file.name}`, content: base64, branch: cfg.github.branch })
  });
  if (!res.ok) throw new Error(`Photo upload failed (${res.status}): ${await res.text()}`);
  return path;
}

/** Resolve a stored photo path to a viewable URL (raw.githubusercontent, or pass through if it's already a full URL like a Drive link). */
export function photoUrl(pathOrUrl) {
  if (/^https?:\/\//.test(pathOrUrl)) return pathOrUrl;
  const cfg = getConfig();
  return `https://raw.githubusercontent.com/${cfg.github.owner}/${cfg.github.repo}/${cfg.github.branch}/${pathOrUrl}`;
}
