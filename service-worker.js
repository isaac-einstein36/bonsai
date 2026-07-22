// service-worker.js
// Caches only same-origin app-shell files so the PWA opens offline on the
// balcony with no signal. Never intercepts cross-origin requests
// (api.github.com, api.weather.gov, script.google.com, fonts, Chart.js CDN) —
// those need the network and fail gracefully in-app if unreachable.

const CACHE_NAME = 'bonsaios-shell-v2';
const SHELL_FILES = [
  'dashboard.html', 'journal.html', 'calendar.html', 'gallery.html',
  'analytics.html', 'settings.html', 'handbook.html',
  'css/main.css', 'manifest.json',
  'js/core/config.js', 'js/core/github.js', 'js/core/weather.js', 'js/core/sheets.js',
  'js/core/storage.js', 'js/core/health.js', 'js/core/growth-ring.js', 'js/core/icons.js',
  'js/core/toast.js', 'js/core/shell.js', 'js/core/solar.js',
  'icons/icon-192.png', 'icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_FILES)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return; // let cross-origin API calls hit the network directly
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const network = fetch(event.request)
        .then((res) => {
          if (res.ok) caches.open(CACHE_NAME).then((cache) => cache.put(event.request, res.clone()));
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
