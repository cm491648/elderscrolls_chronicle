/** Pure helpers for the Timeline's pan / zoom behaviour (no DOM, no d3). */

export interface View {
  x: number;
  k: number;
}

const LINE_PX = 16;
const EPS = 0.5;

/** Signed pan distance in CSS pixels for a wheel event, from its dominant axis. */
export function normalizeWheelDelta(
  ev: { deltaX: number; deltaY: number; deltaMode: number },
  pageSize: number,
): number {
  const raw = Math.abs(ev.deltaX) > Math.abs(ev.deltaY) ? ev.deltaX : ev.deltaY;
  if (ev.deltaMode === 1) return raw * LINE_PX;
  if (ev.deltaMode === 2) return raw * pageSize;
  return raw;
}

/** True when panning by `delta` px (positive = toward later events) cannot move the view. */
export function isAtPanLimit(delta: number, view: View, width: number, totalWidth: number): boolean {
  if (delta === 0) return true;
  if (delta < 0) return view.x >= -EPS;
  return view.x + view.k * totalWidth <= width + EPS;
}

export function clampView(view: View, width: number, totalWidth: number, maxZoom: number): View {
  const fitK = width / totalWidth;
  const k = Math.min(fitK * maxZoom, Math.max(fitK, view.k));
  const x = Math.min(0, Math.max(view.x, width - k * totalWidth));
  return { x, k };
}

/** Keeps the world position at the viewport centre and the zoom level across a resize. */
export function preserveView(
  prev: View,
  prevWidth: number,
  width: number,
  totalWidth: number,
  maxZoom: number,
): View {
  const prevFit = prevWidth / totalWidth;
  const fit = width / totalWidth;
  const wasFit = prev.k <= prevFit * 1.001;
  const k = wasFit ? fit : prev.k;
  const center = (prevWidth / 2 - prev.x) / prev.k;
  return clampView({ x: width / 2 - k * center, k }, width, totalWidth, maxZoom);
}

export function zoomLimits(k: number, width: number, totalWidth: number, maxZoom: number) {
  const fitK = width / totalWidth;
  return { canZoomOut: k > fitK * 1.001, canZoomIn: k < fitK * maxZoom * 0.999 };
}

/** Index of the one timeline item that is a tab stop (roving tabindex); -1 when empty. */
export function tabStopIndex(
  items: { ids: string[]; x: number }[],
  selectedId: string | null,
  width: number,
): number {
  if (items.length === 0) return -1;
  if (selectedId) {
    const selected = items.findIndex((c) => c.ids.includes(selectedId));
    if (selected >= 0) return selected;
  }
  const visible = items.findIndex((c) => c.x >= 0 && c.x <= width);
  return visible >= 0 ? visible : 0;
}

/** Zoom factor for a Ctrl+wheel (or trackpad pinch) event; same curve as d3-zoom's default wheel delta. */
export function wheelZoomFactor(ev: { deltaY: number; deltaMode: number }): number {
  const unit = ev.deltaMode === 1 ? 0.05 : ev.deltaMode ? 1 : 0.002;
  return Math.pow(2, -ev.deltaY * unit * 10);
}

/**
 * The view for opening a cluster whose members sit at world x `xs`: three times deeper than now, centred on the
 * members, but never so deep that a member would land within `edge` px of the band's ends; clamped to the extent.
 * A long chain of merged dots may already fill (or overflow) the band, so keeping them all in view would barely zoom:
 * then it zooms twice as deep about the members' mean anyway, so every tap opens the cluster further.
 */
export function clusterView(xs: number[], k: number, width: number, totalWidth: number, maxZoom: number, edge: number): View {
  const lo = Math.min(...xs);
  const hi = Math.max(...xs);
  const room = width - 2 * edge;
  const fitK = width / totalWidth;
  let target = k * 3;
  if (hi > lo) target = Math.min(target, room / (hi - lo));
  if (target < k * 1.5) {
    const deeper = Math.min(Math.max(k * 2, fitK), fitK * maxZoom);
    const mean = xs.reduce((sum, x) => sum + x, 0) / xs.length;
    return clampView({ x: width / 2 - deeper * mean, k: deeper }, width, totalWidth, maxZoom);
  }
  // Cap the zoom first, so the members are centred at the zoom actually used (clampView keeps x as given).
  target = Math.min(Math.max(target, k, fitK), fitK * maxZoom);
  return clampView({ x: width / 2 - target * ((lo + hi) / 2), k: target }, width, totalWidth, maxZoom);
}

/** A view zoomed to `factor` × fit and centred on world x `center`, clamped to the extent. */
export function focusView(center: number, factor: number, width: number, totalWidth: number, maxZoom: number): View {
  const k = (width / totalWidth) * factor;
  return clampView({ x: width / 2 - k * center, k }, width, totalWidth, maxZoom);
}

/** Rough rendered width of a label: CJK glyphs are one em wide, Latin glyphs about 0.58 em. */
export function estimateTextWidth(text: string, fontSize: number): number {
  let em = 0;
  for (const ch of text) em += (ch.codePointAt(0) ?? 0) >= 0x2e80 ? 1 : 0.58;
  return em * fontSize;
}

/** Centre x for a label of width `w` near `x`, kept `pad` px inside [0, width]. */
export function clampLabelX(x: number, w: number, width: number, pad = 4): number {
  const lo = w / 2 + pad;
  const hi = width - w / 2 - pad;
  if (lo > hi) return width / 2;
  return Math.min(hi, Math.max(lo, x));
}

/** Short era tag for timeline year labels: `4E 171`. The two eras before the First carry their own initials. */
const ERA_SHORT: Record<string, string> = { dawn: 'DE', merethic: 'ME', '1E': '1E', '2E': '2E', '3E': '3E', '4E': '4E' };

type Dated = { era: string; year: number | null; circa?: boolean };

/**
 * Year under a timeline dot: `4E 171`, or `unknown` (the page language's word) when the year is not recorded; an
 * approximate year starts with `circaPrefix` (the page language's `c. ` or `約 `).
 */
export function yearLabel(e: Dated, unknown: string, circaPrefix = ''): string {
  if (e.year === null) return unknown;
  return `${e.circa ? circaPrefix : ''}${ERA_SHORT[e.era] ?? e.era} ${e.year}`;
}

/**
 * Range under a cluster, from its first to its last event (in time order): `1E 242–700` within one era,
 * `3E 433–4E 171` across eras, a single label when both ends read the same.
 */
export function yearRangeLabel(first: Dated, last: Dated, unknown: string, circaPrefix = ''): string {
  // One year, approximate at either end, is one label.
  if (first.year !== null && first.era === last.era && first.year === last.year)
    return yearLabel({ ...first, circa: first.circa || last.circa }, unknown, circaPrefix);
  const a = yearLabel(first, unknown, circaPrefix);
  const b = yearLabel(last, unknown, circaPrefix);
  if (a === b) return a;
  // `約 1E 668–700` reads as approximate at both ends, so shorten only when the ends agree on it.
  const sameCirca = !!first.circa === !!last.circa;
  if (first.year !== null && last.year !== null && first.era === last.era && sameCirca) return `${a}–${last.year}`;
  return `${a}–${b}`;
}

/** Year label for an item: `3E 121–127` for an event that lasted, as yearLabel otherwise. */
export function spanLabel(e: Dated & { yearEnd?: number }, unknown: string, circaPrefix = ''): string {
  if (e.year === null || e.yearEnd === undefined || e.yearEnd <= e.year) return yearLabel(e, unknown, circaPrefix);
  return yearRangeLabel(e, { ...e, year: e.yearEnd }, unknown, circaPrefix);
}

/**
 * Year after an event in the map's event lists: as spanLabel, but an undated event reads its era's short tag (`ME`)
 * instead of `unknown`, since the list has no era names above it to go by (decisions/p4-merge).
 */
export function listYearLabel(e: Dated & { yearEnd?: number }, circaPrefix = ''): string {
  return e.year === null ? ERA_SHORT[e.era] ?? e.era : spanLabel(e, '', circaPrefix);
}

/** True when two boxes share some area (touching edges do not count). */
export function boxesOverlap(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

/**
 * Which labels fit on one row without overlapping: higher `priority` first (the selection), then left to right.
 * Each label is centred on its `x`, kept inside [0, width] like clampLabelX; items whose `x` is off the band are
 * dropped. Returns the centre x of every placed label, or null where it was left out.
 */
export function placeLabels(items: { x: number; w: number; priority?: number }[], width: number, gap = 6): (number | null)[] {
  const order = items
    .map((_, i) => i)
    .sort((a, b) => (items[b].priority ?? 0) - (items[a].priority ?? 0) || items[a].x - items[b].x);
  const placed: [number, number][] = [];
  const out: (number | null)[] = items.map(() => null);
  for (const i of order) {
    const { x, w } = items[i];
    if (x < 0 || x > width) continue;
    const cx = clampLabelX(x, w, width, 2);
    const lo = cx - w / 2;
    const hi = cx + w / 2;
    if (placed.some(([a, b]) => lo < b + gap && hi > a - gap)) continue;
    placed.push([lo, hi]);
    out[i] = cx;
  }
  return out;
}

/**
 * More room after the end of time than before its start (decisions/p4-review: blank space to the right of 4E 201
 * even without events): 12% of the band, at least 48 px on a phone, at most 120 px.
 */
export function padEnd(svgWidth: number): number {
  return Math.round(Math.min(120, Math.max(48, svgWidth * 0.12)));
}

/** Dashed lines every century; zoomed out they thin to every 500 or 1000 years, never closer than this. */
export const CENTURY_GAP = 24;
const CENTURY_STEPS = [100, 500, 1000];

/**
 * Century lines (decisions/p4-design) inside the dated eras: every 100 years, or 500 / 1000 when 100 would be closer
 * than CENTURY_GAP on screen; none at an era's own start or end (the era separator is there). `toScreen` maps a
 * world x to the screen; only lines within [lo, hi] are returned.
 */
export function centuryLines(
  segments: readonly { era: string; start: number; end: number; pxPerYear: number }[],
  k: number,
  toScreen: (worldX: number) => number,
  lo: number,
  hi: number,
): { key: string; x: number }[] {
  return segments.flatMap((s) => {
    if (!s.pxPerYear) return [];
    const step = CENTURY_STEPS.find((n) => n * s.pxPerYear * k >= CENTURY_GAP);
    if (!step) return [];
    const eraYears = Math.round((s.end - s.start) / s.pxPerYear);
    const out: { key: string; x: number }[] = [];
    for (let y = step; y < eraYears; y += step) {
      const x = toScreen(s.start + y * s.pxPerYear);
      if (x >= lo && x <= hi) out.push({ key: `${s.era}-${y}`, x });
    }
    return out;
  });
}
