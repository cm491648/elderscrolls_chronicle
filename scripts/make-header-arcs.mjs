// Draws the gold arcs behind the middle of the leather header (decisions/rings-2), after the thin glowing circles of the
// TES VI name reveal: six circles of similar size, loosely gathered round the gilt lozenge, each drawn only as a partial
// arc that is brightest in the middle and fades to nothing at both ends, with a soft glow. No star glints.
// Writes src/assets/ornaments/header-arcs.svg (each arc sways slowly along its own circle) and header-arcs-still.svg
// (the same picture, still, for readers who ask for less motion).
// Usage: node scripts/make-header-arcs.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const OUT = fileURLToPath(new URL('../src/assets/ornaments/', import.meta.url));
// Drawing box: 1100 wide, centred on the header; its bottom edge sits on the gilt rule under the header, and the
// header shows its lowest 48–54 px. A circle's top may lie above the box: only the part crossing the header shows.
export const BOX = { w: 1100, h: 80 };
const COLOR = '#e9b47c';
// [centre x, y of the circle's top, radius, angle of the brightest point (deg, 270 = straight up), span (deg), peak
// opacity]. Centres, sizes and angles are deliberately uneven (the user found an even row "too aligned").
const ARCS = [
  [312, -30, 228, 259, 150, 0.82],
  [702, -48, 251, 281, 140, 0.88],
  [489, -8, 309, 266, 106, 0.7],
  [626, -22, 197, 273, 170, 0.92],
  [205, 2, 160, 248, 90, 0.5],
  [820, -6, 286, 289, 118, 0.66],
];
const SEG = 5; // degrees per segment: the taper is drawn as short arcs whose opacity follows a sine curve

const f = (n) => +n.toFixed(1);

/** One tapered arc as a group of short arc paths. */
function arc([cx, top, r, mid, span, peak]) {
  const cy = top + r + (BOX.h - 54);
  const n = Math.round(span / SEG);
  const pt = (deg) => `${f(cx + r * Math.cos((deg * Math.PI) / 180))} ${f(cy + r * Math.sin((deg * Math.PI) / 180))}`;
  let d = '';
  for (let i = 0; i < n; i++) {
    const a0 = mid - span / 2 + (span * i) / n;
    const o = peak * Math.sin((Math.PI * (i + 0.5)) / n) ** 1.6;
    if (o < 0.02) continue;
    // a hair of overlap so the segments meet without a visible seam
    d += `<path d="M${pt(a0)}A${r} ${r} 0 0 1 ${pt(a0 + span / n + 0.2)}" stroke-opacity="${o.toFixed(2)}"/>`;
  }
  return { cx, cy, d };
}

export function headerArcs({ sway }) {
  const groups = ARCS.map(arc)
    .map(({ cx, cy, d }, i) => {
      const style = sway ? ` style="transform-origin:${cx}px ${f(cy)}px;animation-duration:${14 + ((i * 23) % 12)}s"` : '';
      return `<g${sway ? ` class="s${i % 2 ? ' r' : ''}"` : ''}${style}>${d}</g>`;
    })
    .join('');
  const css = sway
    ? '<style>.s{transform-box:view-box;animation:sway ease-in-out infinite alternate}.r{animation-direction:alternate-reverse}' +
      '@keyframes sway{from{transform:rotate(-14deg)}to{transform:rotate(14deg)}}' +
      '@media (prefers-reduced-motion:reduce){.s{animation:none}}</style>'
    : '';
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${BOX.w} ${BOX.h}" width="${BOX.w}" height="${BOX.h}">${css}` +
    '<defs><filter id="glow" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="2.4" result="b"/>' +
    '<feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>' +
    `<g filter="url(#glow)" fill="none" stroke="${COLOR}" stroke-width="1">${groups}</g></svg>\n`
  );
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  mkdirSync(OUT, { recursive: true });
  writeFileSync(OUT + 'header-arcs.svg', headerArcs({ sway: true }));
  writeFileSync(OUT + 'header-arcs-still.svg', headerArcs({ sway: false }));
  console.log('wrote header-arcs.svg and header-arcs-still.svg');
}
