// core/growth-ring.js
// The signature visual element of BonsaiOS. Modeled on a cut tree cross
// section: each ring is one metric, its arc-length is the score, and the
// rings nest like actual growth rings — a literal reading of "digital twin".

function arc(cx, cy, r, startDeg, endDeg) {
  const s = polar(cx, cy, r, endDeg);
  const e = polar(cx, cy, r, startDeg);
  const large = endDeg - startDeg <= 180 ? 0 : 1;
  return `M ${s.x} ${s.y} A ${r} ${r} 0 ${large} 0 ${e.x} ${e.y}`;
}
function polar(cx, cy, r, deg) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

/**
 * rings: [{ value: 0-100, color: css-color, label }]
 * Returns an SVG string sized to `size`.
 */
export function renderGrowthRing(rings, size = 168) {
  const cx = size / 2, cy = size / 2;
  const maxR = size / 2 - 8;
  const step = maxR / (rings.length + 0.6);
  let svg = `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" role="img" aria-label="Growth ring health summary">`;

  rings.forEach((ring, i) => {
    const r = maxR - i * step;
    const pct = Math.max(0, Math.min(100, ring.value ?? 0));
    const deg = (pct / 100) * 359.9;
    svg += `<path d="${arc(cx, cy, r, 0, 360)}" fill="none" stroke="var(--border)" stroke-width="${step * 0.62}" stroke-linecap="round"/>`;
    if (ring.value != null) {
      svg += `<path d="${arc(cx, cy, r, 0, deg)}" fill="none" stroke="${ring.color}" stroke-width="${step * 0.62}" stroke-linecap="round"/>`;
    }
  });

  svg += `</svg>`;
  return svg;
}

/** Convenience wrapper that also renders the center label + legend, matching .ring-wrap / .ring-center CSS. */
export function renderGrowthRingCard(rings, centerValue, centerCaption, size = 168) {
  const ringSvg = renderGrowthRing(rings, size);
  const legend = rings.map((r) => `
    <div style="display:flex;align-items:center;gap:8px;font-size:12px;color:var(--text-dim);margin-top:6px;">
      <span style="width:9px;height:9px;border-radius:2px;background:${r.color};display:inline-block;flex-shrink:0;"></span>
      <span>${r.label}</span>
      <span style="margin-left:auto;font-family:var(--font-mono);color:var(--text);">${r.value != null ? r.value : '—'}</span>
    </div>`).join('');

  return `
    <div class="ring-wrap" style="width:${size}px;height:${size}px;">
      ${ringSvg}
      <div class="ring-center">
        <span class="ring-num">${centerValue != null ? centerValue : '—'}</span>
        <span class="ring-cap">${centerCaption}</span>
      </div>
    </div>
    <div>${legend}</div>
  `;
}
