// core/shell.js
// Every page calls initShell('dashboard' | 'journal' | ...) once on load.
// Keeps nav markup in exactly one place instead of six copy-pasted HTML files.

import { icons } from './icons.js';
import { getConfig, updateConfig } from './config.js';
import { getEntries } from './storage.js';
import { daysSince, currentSeason } from './health.js';

const NAV = [
  { id: 'dashboard', href: 'dashboard.html', label: 'Dashboard', icon: 'dashboard' },
  { id: 'journal', href: 'journal.html', label: 'Journal', icon: 'journal' },
  { id: 'calendar', href: 'calendar.html', label: 'Calendar', icon: 'calendar' },
  { id: 'gallery', href: 'gallery.html', label: 'Gallery', icon: 'gallery' },
  { id: 'analytics', href: 'analytics.html', label: 'Analytics', icon: 'analytics' },
  { id: 'handbook', href: 'handbook.html', label: 'Handbook', icon: 'handbook' },
  { id: 'settings', href: 'settings.html', label: 'Settings', icon: 'settings' },
];

export function applyTheme() {
  const cfg = getConfig();
  document.documentElement.setAttribute('data-theme', cfg.theme === 'light' ? 'light' : 'dark');
}

export async function initShell(activeId) {
  applyTheme();
  const cfg = getConfig();

  const root = document.getElementById('app-shell');
  root.innerHTML = `
    <aside class="sidebar">
      <div class="sidebar-brand">
        <div class="ring-mini" id="brand-ring"></div>
        <div class="sidebar-brand-text"><b>${escapeHtml(cfg.treeName)}</b><span>BonsaiOS</span></div>
      </div>
      <div class="nav-group">
        ${NAV.slice(0, 6).map(navLink).join('')}
      </div>
      <div class="nav-group" style="margin-top:auto;">
        ${NAV.slice(6).map(navLink).join('')}
      </div>
      <div class="sidebar-foot">
        <button class="theme-toggle" id="theme-toggle" type="button">${icons.sun}<span id="theme-toggle-label">Light</span></button>
      </div>
    </aside>
    <div class="main">
      <div class="topbar">
        <h1 id="page-title"></h1>
        <div class="topbar-meta" id="topbar-stats"></div>
      </div>
      <div class="content" id="page-content"></div>
    </div>
  `;

  function navLink(item) {
    const active = item.id === activeId ? ' active' : '';
    return `<a class="nav-link${active}" href="${item.href}">${icons[item.icon]}<span>${item.label}</span></a>`;
  }

  document.getElementById('page-title').textContent = NAV.find((n) => n.id === activeId)?.label || cfg.treeName;

  // Tiny growth-ring mark next to the brand, just a static decorative ring.
  document.getElementById('brand-ring').innerHTML =
    `<svg viewBox="0 0 26 26"><circle cx="13" cy="13" r="11" fill="none" stroke="var(--border)" stroke-width="2.4"/>
     <circle cx="13" cy="13" r="11" fill="none" stroke="var(--accent)" stroke-width="2.4" stroke-dasharray="42 100" stroke-linecap="round" transform="rotate(-90 13 13)"/>
     <circle cx="13" cy="13" r="6.2" fill="none" stroke="var(--accent-2)" stroke-width="2.4" stroke-dasharray="26 100" stroke-linecap="round" transform="rotate(-90 13 13)"/></svg>`;

  const themeBtn = document.getElementById('theme-toggle');
  const themeLabel = document.getElementById('theme-toggle-label');
  const syncThemeLabel = () => {
    const t = getConfig().theme;
    themeBtn.innerHTML = (t === 'light' ? icons.moon : icons.sun) + `<span>${t === 'light' ? 'Dark' : 'Light'}</span>`;
  };
  syncThemeLabel();
  themeBtn.addEventListener('click', () => {
    const cur = getConfig().theme;
    updateConfig({ theme: cur === 'light' ? 'dark' : 'light' });
    applyTheme();
    syncThemeLabel();
  });

  // Topbar quick stats: days owned + current season, always available with no network.
  const days = daysSince(cfg.acquiredDate);
  document.getElementById('topbar-stats').innerHTML = `
    <span class="topbar-stat"><b>${days}</b> days owned</span>
    <span class="topbar-stat">${currentSeason()}</span>
  `;

  return { cfg };
}

export function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
