// core/health.js
// Turns raw journal entries into the numbers the Dashboard shows: a 0-100
// health score, a growth score, and next-due dates for watering/fertilizing.

export function daysBetween(a, b) {
  return Math.round((new Date(b) - new Date(a)) / 86400000);
}

export function daysSince(dateStr) {
  return daysBetween(dateStr, new Date().toISOString().slice(0, 10));
}

/** Most recent entry where `field` was truthy. */
function lastWhere(entries, field) {
  return entries.find((e) => e[field]);
}

export function computeHealthScore(entries) {
  if (!entries.length) return { score: null, label: 'No data yet' };
  const recent = entries.slice(0, 10);
  const ratings = recent.map((e) => Number(e.healthRating)).filter((n) => !isNaN(n));
  if (!ratings.length) return { score: null, label: 'No ratings logged' };
  const avg = ratings.reduce((a, b) => a + b, 0) / ratings.length;
  const score = Math.round((avg / 5) * 100);
  const label = score >= 85 ? 'Thriving' : score >= 65 ? 'Healthy' : score >= 45 ? 'Stressed' : 'At risk';
  return { score, label };
}

export function computeGrowthScore(entries) {
  if (entries.length < 2) return { score: null, label: 'Not enough entries yet' };
  const withFlowers = entries.filter((e) => typeof e.flowers === 'number');
  const withBuds = entries.filter((e) => typeof e.buds === 'number');
  const flowerTrend = withFlowers.length >= 2 ? withFlowers[0].flowers - withFlowers[withFlowers.length - 1].flowers : 0;
  const budTrend = withBuds.length >= 2 ? withBuds[0].buds - withBuds[withBuds.length - 1].buds : 0;
  const raw = 50 + flowerTrend * 4 + budTrend * 2;
  const score = Math.max(0, Math.min(100, Math.round(raw)));
  const label = score >= 65 ? 'Actively growing' : score >= 40 ? 'Steady' : 'Slow / dormant';
  return { score, label };
}

export function nextWateringDate(entries, intervalDays) {
  const last = lastWhere(entries, 'watered');
  if (!last) return null;
  const d = new Date(last.date);
  d.setDate(d.getDate() + intervalDays);
  return d.toISOString().slice(0, 10);
}

export function nextFertilizerDate(entries, intervalDays) {
  const last = lastWhere(entries, 'fertilized');
  if (!last) return null;
  const d = new Date(last.date);
  d.setDate(d.getDate() + intervalDays);
  return d.toISOString().slice(0, 10);
}

export function daysSinceRepot(entries) {
  const last = entries.find((e) => e.repotted);
  return last ? daysSince(last.date) : null;
}

export function currentSeason(date = new Date()) {
  const m = date.getMonth() + 1;
  if (m === 12 || m <= 2) return 'Winter (indoor)';
  if (m <= 5) return 'Spring';
  if (m <= 8) return 'Summer';
  return 'Fall';
}

/** Builds today's checklist based on due reminders. */
export function buildChecklist(entries, cfg) {
  const items = [];
  const today = new Date().toISOString().slice(0, 10);
  const nextWater = nextWateringDate(entries, cfg.reminders.wateringDays);
  const nextFert = nextFertilizerDate(entries, cfg.reminders.fertilizerDays);

  if (!nextWater || nextWater <= today) items.push({ label: 'Check soil moisture / water if dry', kind: 'water' });
  if (!nextFert || nextFert <= today) items.push({ label: 'Fertilize (seasonal schedule)', kind: 'fert' });
  const season = currentSeason();
  if (season === 'Winter (indoor)') items.push({ label: 'Confirm grow light + humidity tray', kind: 'other' });
  if (!entries.length) items.push({ label: 'Log your first journal entry', kind: 'other' });
  return items;
}
