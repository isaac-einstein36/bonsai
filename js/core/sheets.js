// core/sheets.js
// Posts to a deployed Google Apps Script web app (see /google-apps-script/Code.gs).
// Apps Script apps must be deployed as "Anyone" or "Anyone with Google account"
// web apps to accept POSTs from a static GitHub Pages site — the script itself
// still only writes to the one spreadsheet it's bound to.

import { getConfig } from './config.js';

export async function pushEntryToSheet(entry) {
  const cfg = getConfig();
  const url = cfg.sheets.webAppUrl;
  if (!url) throw new Error('Google Sheets sync is not configured yet — add the Apps Script URL in Settings.');

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // avoids CORS preflight on Apps Script
    body: JSON.stringify({ action: 'appendEntry', entry })
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { throw new Error(`Sheets sync returned unexpected response: ${text.slice(0, 200)}`); }
  if (!json.ok) throw new Error(json.error || 'Sheets sync failed');
  return json;
}

export async function deleteEntryFromSheet(dateStr) {
  const cfg = getConfig();
  const url = cfg.sheets.webAppUrl;
  if (!url) return; // Sheets optional — silently skip if not configured
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action: 'deleteEntry', date: dateStr })
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { throw new Error(`Sheets delete returned unexpected response: ${text.slice(0, 200)}`); }
  if (!json.ok) throw new Error(json.error || 'Sheets delete failed');
  return json;
}

export async function testSheetsConnection() {
  const cfg = getConfig();
  const url = cfg.sheets.webAppUrl;
  if (!url) throw new Error('No Apps Script URL set.');
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action: 'ping' })
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { throw new Error('Apps Script did not return JSON — check the deployment.'); }
  if (!json.ok) throw new Error(json.error || 'Ping failed');
  return json;
}
