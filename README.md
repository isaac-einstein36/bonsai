# BonsaiOS — Gardenia Bonsai Management System

A digital twin and care system for a single outdoor Gardenia bonsai (Minneapolis, MN). Vanilla HTML/CSS/JS, no build step, deployed as a `/bonsai` section inside an existing GitHub Pages (Jekyll) site.

**Live data model:** GitHub is the permanent record. Every journal entry is committed as `entries/YYYY/MM/YYYY-MM-DD.json` directly from the browser via the GitHub REST API — real git history is the maintenance log. Google Sheets is a mirror for spreadsheet-style analysis. NOAA (`api.weather.gov`) supplies live weather with no API key required.

---

## 1. What's included

```
bonsai/
  dashboard.html    Health/growth "growth ring", live weather, checklist, recent entries
  journal.html      Full entry form → commits to GitHub + mirrors to Sheets
  calendar.html     Month view of watering/fertilizer/reminder due-dates
  gallery.html      Photo timeline (month/year grouping, search, lightbox)
  analytics.html    Chart.js: health/growth trends, weather correlation, event history
  settings.html     GitHub / Sheets / location / reminder configuration
  handbook.html     Placeholder for the separate Handbook deliverable
  css/main.css      Design system (tokens, layout, components)
  js/core/*.js      Shared modules (config, github, weather, sheets, storage, health, shell)
  manifest.json, service-worker.js   PWA + offline shell caching
  icons/            Generated app icons
  entries/          Sample journal entry (this folder mirrors what GitHub will contain)
  google-apps-script/Code.gs   Apps Script backend for the Sheets mirror
  .github/workflows/validate-entries.yml   CI check that entry JSON is well-formed
  data/config.example.json   Reference for what Settings stores
```

## 2. Install into your existing Jekyll site

1. Copy the entire `bonsai/` folder into the root of your GitHub Pages repo (next to `_config.yml`).
2. Add a link to `/bonsai/dashboard.html` from your site nav (e.g. in `_includes/nav.html` or wherever your Jekyll theme defines its header links).
3. Commit and push — GitHub Pages serves static files under `/bonsai/` automatically; Jekyll ignores files/folders that aren't Markdown/Liquid, so nothing here interferes with your existing build. If your Jekyll config has an `exclude:` list, you don't need to add anything (this is plain static HTML), but if you use `include:`-only filtering, add `bonsai` to the include list.

## 3. Configure GitHub (source of truth)

1. GitHub → Settings → Developer settings → **Personal access tokens → Fine-grained tokens** → Generate new token.
   - Repository access: only this repo.
   - Permissions: **Contents → Read and write**.
2. Open `settings.html` in the app → GitHub section → fill in:
   - Owner (your username), Repo (this repo's name), Branch (usually `main`), Entries path (`bonsai/entries`), and the token.
3. Click **Test connection**. You should see `✓ Connected to owner/repo (main)`.

The token is stored only in this browser's `localStorage` and sent solely to `api.github.com` in `Authorization` headers — it never touches any third-party server. Because it's client-side, anyone with access to this browser profile can extract it; that's an accepted tradeoff for a static, backend-free personal tool. Don't use a token with access to other repos.

## 4. Configure the Google Sheets mirror

1. Go to https://script.google.com → New project → paste in `google-apps-script/Code.gs`.
2. `Deploy → New deployment → Web app`. Execute as **Me**, access **Anyone**.
3. Copy the deployment URL into `settings.html` → Google Sheets → **Test connection**.
4. The first `appendEntry` call auto-creates a `Journal` tab with headers in the script's bound spreadsheet (or `SPREADSHEET_ID` if you set one in the script).

Re-saving an entry for a date that's already in the sheet updates that row instead of duplicating it.

## 5. Weather

No setup needed — `js/core/weather.js` calls NOAA's public `api.weather.gov` (points → nearest station → latest observation) using the lat/lon set in Settings. Sunrise/sunset and moon phase are computed locally (small solar-position formulas in `js/core/solar.js`), so those work offline too. NOAA doesn't expose UV Index; if you want it, add a free OpenWeather API key in Settings and it'll be filled in automatically — everything else works without it.

## 6. PWA / offline

`manifest.json` + `service-worker.js` cache the app shell (HTML/CSS/JS/icons) so the app opens with no signal. Cross-origin calls (GitHub, NOAA, Sheets, the Chart.js CDN) are never intercepted by the service worker — they hit the network directly and fail gracefully in-app (cached journal data still renders from `localStorage`) if you're offline.

To install: open `dashboard.html` on a phone → browser menu → "Add to Home Screen" (iOS Safari) or the install icon in the address bar (Android Chrome / desktop Chrome).

## 7. Data format

```json
{
  "date": "2026-07-09",
  "time": "08:15",
  "temperature": 74,
  "humidity": 62,
  "wind": 6,
  "pressure": 29.94,
  "weatherDescription": "Partly cloudy, light breeze",
  "watered": true,
  "fertilized": false,
  "pruned": false,
  "repotted": false,
  "flowers": 0,
  "buds": 4,
  "leafCondition": "Good",
  "pestObservations": "None observed",
  "healthRating": 4,
  "notes": "Markdown-friendly free text.",
  "photos": ["bonsai/images/2026/07/2026-07-09-photo1.jpg"]
}
```

## 8. Internal API reference (`js/core/`)

| Module | Purpose |
|---|---|
| `config.js` | `getConfig()`, `updateConfig(patch)`, `isGithubConfigured()`, `isSheetsConfigured()` — all settings, persisted to `localStorage`. |
| `github.js` | `getFile`, `putFile`, `saveEntry(entry)`, `fetchAllEntries()`, `testConnection()` — thin wrapper over the GitHub Contents/Trees API. |
| `weather.js` | `getCurrentConditions()` — NOAA current conditions + local sun/moon data. |
| `sheets.js` | `pushEntryToSheet(entry)`, `testSheetsConnection()` — POSTs to the Apps Script web app. |
| `storage.js` | `getEntries()`, `saveEntry(entry)`, `uploadPhoto(file, date)`, `photoUrl(path)` — the offline-first data layer every page uses; GitHub is truth, `localStorage` is cache. |
| `health.js` | Pure functions turning entry history into health/growth scores, next-due dates, and the dashboard checklist. |
| `growth-ring.js` | Renders the signature concentric-ring SVG widget. |
| `shell.js` | Renders the sidebar/topbar into every page (`initShell('dashboard')`) and handles theme toggling. |
| `solar.js` | Sunrise/sunset + moon phase, no API required. |

## 9. Extending

- **Multiple bonsai:** add a `plantId` field to entries and a plant switcher in the sidebar (`shell.js`); `entriesPath` in config would become `entries/{plantId}`.
- **AI features (photo health analysis, disease detection):** the spec calls for future-ready architecture — the natural hook is in `journal.html`'s photo upload handler, sending the image to whatever vision API you choose before/after the GitHub commit.
- **Sensors (ESP32 / soil moisture):** have the device POST directly to the same Apps Script endpoint with a new `action`, and/or write directly to GitHub via a scheduled Action instead of a browser session.

## 10. Known limitations (be aware, not blockers)

- NOAA's API asks for a descriptive `User-Agent` header; browsers don't allow overriding this on `fetch`, so requests go out with the browser's own UA. This works today but if NOAA ever rate-limits anonymous traffic more aggressively, the fix is proxying weather calls through the same Apps Script deployment.
- The GitHub PAT lives in `localStorage` in plaintext (no backend to hold it server-side) — acceptable for a single-user tool on a device you control, not for a shared/public deployment.
- The Handbook (Deliverable 1 in the spec) isn't written yet — `handbook.html` is a placeholder in the app pending that work.
