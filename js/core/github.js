// core/github.js
// Talks directly to api.github.com using a fine-grained Personal Access Token
// (Contents: Read & Write on the target repo). Every journal save becomes a
// real commit, so git history IS the maintenance log.

import { getConfig } from './config.js';

const API = 'https://api.github.com';

function authHeaders(token) {
  return {
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28'
  };
}

function b64EncodeUnicode(str) {
  return btoa(unescape(encodeURIComponent(str)));
}
function b64DecodeUnicode(str) {
  return decodeURIComponent(escape(atob(str)));
}

async function ghFetch(path, opts = {}) {
  const cfg = getConfig();
  const { owner, repo, token } = cfg.github;
  if (!owner || !repo || !token) throw new Error('GitHub is not configured yet — add it in Settings.');
  const res = await fetch(`${API}/repos/${owner}/${repo}${path}`, {
    ...opts,
    headers: { ...authHeaders(token), ...(opts.headers || {}) }
  });
  return res;
}

/** Get a file's content + sha (sha is required to update an existing file). Returns null if it doesn't exist. */
export async function getFile(path) {
  const cfg = getConfig();
  const res = await ghFetch(`/contents/${encodeURIComponent(path).replace(/%2F/g, '/')}?ref=${cfg.github.branch}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GitHub read failed (${res.status}): ${await res.text()}`);
  const data = await res.json();
  return {
    sha: data.sha,
    content: b64DecodeUnicode(data.content.replace(/\n/g, '')),
    path: data.path
  };
}

/** Create or update a file at `path` with `content` (string). Commits with `message`. */
export async function putFile(path, content, message) {
  const cfg = getConfig();
  const existing = await getFile(path).catch(() => null);
  const body = {
    message,
    content: b64EncodeUnicode(content),
    branch: cfg.github.branch
  };
  if (existing) body.sha = existing.sha;
  const res = await ghFetch(`/contents/${encodeURIComponent(path).replace(/%2F/g, '/')}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error(`GitHub write failed (${res.status}): ${await res.text()}`);
  return res.json();
}

/** List files in a directory (non-recursive). Returns [] if the directory doesn't exist yet. */
export async function listDir(path) {
  const res = await ghFetch(`/contents/${path}`);
  if (res.status === 404) return [];
  if (!res.ok) throw new Error(`GitHub list failed (${res.status}): ${await res.text()}`);
  return res.json();
}

/** Recursively list every file under a path using the git trees API (one call, fast). */
export async function listAllFiles(rootPath) {
  const cfg = getConfig();
  const branchRes = await ghFetch(`/branches/${cfg.github.branch}`);
  if (!branchRes.ok) throw new Error('Could not resolve branch HEAD');
  const branchData = await branchRes.json();
  const treeSha = branchData.commit.sha;
  const treeRes = await ghFetch(`/git/trees/${treeSha}?recursive=1`);
  if (!treeRes.ok) throw new Error('Could not read repo tree');
  const treeData = await treeRes.json();
  return (treeData.tree || [])
    .filter(item => item.type === 'blob' && item.path.startsWith(rootPath) && item.path.endsWith('.json'));
}

/** Fetch and parse every journal entry JSON file under entriesPath. */
export async function fetchAllEntries() {
  const cfg = getConfig();
  const files = await listAllFiles(cfg.github.entriesPath);
  const entries = [];
  for (const f of files) {
    try {
      const file = await getFile(f.path);
      entries.push(JSON.parse(file.content));
    } catch (e) {
      console.warn('Skipping unreadable entry', f.path, e);
    }
  }
  entries.sort((a, b) => (a.date < b.date ? 1 : -1));
  return entries;
}

/** Save one journal entry as entries/YYYY/MM/YYYY-MM-DD.json, committed to GitHub. */
export async function saveEntry(entry) {
  const cfg = getConfig();
  const [y, m] = entry.date.split('-');
  const path = `${cfg.github.entriesPath}/${y}/${m}/${entry.date}.json`;
  const message = `Journal: ${entry.date} — ${summarize(entry)}`;
  await putFile(path, JSON.stringify(entry, null, 2) + '\n', message);
  return path;
}

function summarize(e) {
  const bits = [];
  if (e.watered) bits.push('watered');
  if (e.fertilized) bits.push('fertilized');
  if (e.pruned) bits.push('pruned');
  if (!bits.length) bits.push('check-in');
  return bits.join(', ');
}

/** Quick connectivity + permission check used by the Settings page. */
export async function testConnection() {
  const cfg = getConfig();
  const res = await ghFetch('');
  if (!res.ok) throw new Error(`Cannot reach repo (${res.status}). Check owner/repo/token.`);
  const data = await res.json();
  return { name: data.full_name, defaultBranch: data.default_branch, private: data.private };
}
